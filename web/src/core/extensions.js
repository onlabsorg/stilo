// The `extensions` service: activates extensions on the services (S17),
// each through a scoped `stilo` object that records what it registers, so
// that deactivating it undoes all of it.

import { LitElement, html, css, svg } from "lit";
import { Service } from "./service.js";
import { base } from "../components/shared.js";
import { StiloController } from "./context.js";
import { TexlCell } from "../editor/index.js";

/** The version of the extension API: `major.minor`. An extension written
 * for the same major version and a minor version up to this one works. */
export const API_VERSION = "1.0";

/** What an extension id may be: lowercase letters, digits and dashes,
 * starting with a letter (its commands are `<id>.<name>`). */
const ID = /^[a-z][a-z0-9-]*$/;

/**
 * The registrations a scoped `stilo` records, by service and method. The
 * value names the property of the first argument that holds an id, which
 * must start with `<extension-id>.`; `null` if there is none. Every
 * service's `on` is recorded too. A new hook that returns `dispose()` is
 * added here. A `dispose()` with a `key` (a badge) replaces the one recorded
 * with the same key, so a hook called again and again keeps one record.
 */
const REGISTRATIONS = {
    commands: { register: "id" },
    keys: { bind: null },
    menus: { add: null },
    panels: { register: "id", replace: null, setBadge: null },
    topBar: { register: "id", replace: null, setBrand: null },
    status: { register: "id", replace: null },
    views: { register: "id", replace: null },
    transport: { use: null },
    tree: { decorate: null, filter: null, readOnly: null },
    editor: { decorate: null },
    cells: { register: null },
};

/**
 * Whether an extension written for API version `version` works with this
 * one. @param {unknown} version
 */
export function compatible(version) {
    const match = /^(\d+)(?:\.(\d+))?$/.exec(String(version ?? ""));
    if (!match) return false;
    const [major, minor] = API_VERSION.split(".").map(Number);
    return Number(match[1]) === major && Number(match[2] ?? 0) <= minor;
}

/**
 * @typedef {object} Extension
 * @property {string} id - Lowercase letters, digits and dashes; its commands,
 *   panels and views are named `<id>.<name>`.
 * @property {string} apiVersion - The API version it was written for, e.g. "1.0".
 * @property {(stilo: object) => void | Promise<void>} activate - Registers
 *   its contributions on the `stilo` object it is given.
 * @property {() => void} [deactivate] - Undoes what the registrations do not.
 */

/** What an extension registered, and how to undo it. */
class Scope {
    constructor(stilo, id) {
        this.id = id;
        /** @type {Set<() => void>} */
        this.disposers = new Set();
        /** The recorded disposer of each key (`dispose.key`). @type {Map<string, () => void>} */
        this.keyed = new Map();
        this.stilo = {
            apiVersion: API_VERSION,
            html,
            css,
            svg,
            LitElement,
            StiloController,
            TexlCell,
            styles: { base },
        };
        // Its own settings, named by its id
        if (stilo.settings) this.stilo.settings = this._wrap("settings", stilo.settings.scope(id));
        for (const [name, service] of Object.entries(stilo)) {
            if (name in this.stilo) continue;
            this.stilo[name] = service && typeof service === "object" ? this._wrap(name, service) : service;
        }
    }

    /** The service as the extension sees it: the same, but its
     * registrations are recorded. */
    _wrap(name, service) {
        const methods = { on: null, ...REGISTRATIONS[name] };
        return new Proxy(service, {
            get: (target, prop) => {
                const value = Reflect.get(target, prop, target);
                if (typeof value !== "function") return value;
                if (!Object.hasOwn(methods, prop)) return value.bind(target);
                return (...args) => {
                    const key = methods[prop];
                    if (key) this._checkId(name, args[0]?.[key]);
                    return this._track(value.apply(target, args));
                };
            },
        });
    }

    _checkId(service, id) {
        if (typeof id !== "string" || !id.startsWith(`${this.id}.`))
            throw new Error(`the ${service} of the extension "${this.id}" must have ids starting with "${this.id}.", not "${id}"`);
    }

    /** Record a `dispose()`; the one returned forgets it when called. */
    _track(dispose) {
        if (typeof dispose !== "function") return dispose;
        const { key } = dispose;
        let done = false;
        const once = () => {
            if (done) return;
            done = true;
            this.disposers.delete(once);
            if (key && this.keyed.get(key) === once) this.keyed.delete(key);
            dispose();
        };
        if (key) {
            // The latest of a key takes the place of the one before, whose
            // effect it has replaced
            const before = this.keyed.get(key);
            if (before) this.disposers.delete(before);
            this.keyed.set(key, once);
        }
        this.disposers.add(once);
        return once;
    }

    /** Undo every registration still in place, the latest first. */
    dispose() {
        for (const dispose of [...this.disposers].reverse()) {
            try {
                dispose();
            } catch (error) {
                console.error(`Stilo: undoing a registration of the extension "${this.id}" failed`, error);
            }
        }
    }
}

/**
 * The extensions of one app. `activate` checks an extension and activates
 * it; one that cannot be activated is reported (console and status) and
 * skipped, with whatever it registered undone, and the app goes on.
 * Stilo's own contributions (`builtins/`) are not listed here.
 */
export class Extensions extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
        /** @type {Map<string, {extension: Extension, scope: Scope}>} */
        this._active = new Map();
        /** @type {{id: string, reason: string}[]} */
        this._failures = [];
    }

    /** The active extensions, in the order they were activated. */
    list() {
        return [...this._active.values()].map(({ extension }) => extension);
    }

    /** The active extension with this id, if any. */
    get(id) {
        return this._active.get(id)?.extension;
    }

    /** The extensions that could not be activated: `{id, reason}`. */
    get failures() {
        return this._failures;
    }

    /**
     * Activate an extension. Resolves to whether it was activated.
     * @param {Extension} extension
     */
    async activate(extension) {
        const id = extension?.id;
        const problem =
            !extension || typeof extension.activate !== "function"
                ? "it is not an extension: it has no activate()"
                : typeof id !== "string" || !ID.test(id)
                  ? "its id must be lowercase letters, digits and dashes, starting with a letter"
                  : this._active.has(id)
                    ? "an extension with this id is active already"
                    : !compatible(extension.apiVersion)
                      ? `it was written for API version ${extension.apiVersion ?? "(none)"}, and this Stilo has ${API_VERSION}`
                      : "";
        if (problem) return this._fail(id, problem);
        const scope = new Scope(this._stilo, id);
        this._active.set(id, { extension, scope });
        try {
            await extension.activate(scope.stilo);
        } catch (error) {
            this._active.delete(id);
            scope.dispose();
            return this._fail(id, `activate() failed: ${error?.message ?? error}`, error);
        }
        this.changed();
        return true;
    }

    /** Deactivate an extension: its `deactivate()`, then every registration
     * it made is undone. */
    deactivate(id) {
        const entry = this._active.get(id);
        if (!entry) return;
        this._active.delete(id);
        try {
            entry.extension.deactivate?.();
        } catch (error) {
            console.error(`Stilo: deactivate() of the extension "${id}" failed`, error);
        }
        entry.scope.dispose();
        this.changed();
    }

    _fail(id, reason, error) {
        const name = typeof id === "string" ? id : String(id ?? "(no id)");
        this._failures.push({ id: name, reason });
        console.error(`Stilo: the extension "${name}" was not activated: ${reason}`, ...(error ? [error] : []));
        this._stilo.ui?.notify(`Extension "${name}" not activated`);
        this.changed();
        return false;
    }
}
