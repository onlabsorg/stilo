// The `settings` service: settings kept in this browser, namespaced, so that
// each extension has its own (S17). Settings stored in the folder are left
// for later.

import { Service } from "./service.js";

const PREFIX = "stilo.ext.";

/**
 * The settings of one namespace, kept in the browser's `localStorage` as
 * JSON under `stilo.ext.<namespace>.<key>`. Values are anything JSON can
 * hold. Fires `change` with `{key, value}` after `set` or `remove`, and when
 * another tab of the same browser changes one. Where the browser keeps
 * nothing (a private window that refuses storage), settings live as long as
 * the page.
 *
 * The app's `stilo.settings` is the namespace `stilo`; an extension's
 * `stilo.settings` is its own, named by its id (`scope(id)`).
 */
export class Settings extends Service {
    /** @param {string} [namespace] */
    constructor(namespace = "stilo") {
        super();
        this.namespace = namespace;
        /** Values kept in the page where the browser keeps none. */
        this._memory = new Map();
        /** @type {Map<string, Settings>} */
        this._scopes = new Map();
        this._onStorage = (e) => {
            const prefix = this._key("");
            if (e.key?.startsWith(prefix)) this.emit("change", { key: e.key.slice(prefix.length), value: this.get(e.key.slice(prefix.length)) });
        };
        if (typeof window !== "undefined") window.addEventListener("storage", this._onStorage);
    }

    _key(key) {
        return `${PREFIX}${this.namespace}.${key}`;
    }

    /** The value of `key`, or `fallback` if it has none. */
    get(key, fallback = undefined) {
        let text = null;
        try {
            text = localStorage.getItem(this._key(key));
        } catch {
            text = this._memory.get(key) ?? null;
        }
        if (text === null) return fallback;
        try {
            return JSON.parse(text);
        } catch {
            return fallback;
        }
    }

    /** Keep `value` under `key`. */
    set(key, value) {
        const text = JSON.stringify(value);
        try {
            localStorage.setItem(this._key(key), text);
        } catch {
            this._memory.set(key, text);
        }
        this.emit("change", { key, value });
    }

    /** Forget `key`. */
    remove(key) {
        try {
            localStorage.removeItem(this._key(key));
        } catch {}
        this._memory.delete(key);
        this.emit("change", { key, value: undefined });
    }

    /** The keys that have a value. */
    keys() {
        const prefix = this._key("");
        const keys = new Set(this._memory.keys());
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(prefix)) keys.add(key.slice(prefix.length));
            }
        } catch {}
        return [...keys];
    }

    /** The settings of the namespace `namespace` (an extension's id). */
    scope(namespace) {
        if (!this._scopes.has(namespace)) this._scopes.set(namespace, new Settings(namespace));
        return this._scopes.get(namespace);
    }
}
