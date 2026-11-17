// The `editor` service: the `<texl-editor>` of the open document.

import { Service } from "./service.js";

/** The editor's events the service passes on, under the same names, except
 * `change` (an edit), passed on as `edit`. */
const EVENTS = { change: "edit", "comments-click": "comments-click", "errors-change": "errors-change", "error-click": "error-click", "selection-change": "selection-change" };

/**
 * A new `<texl-editor>` is made for every document, so value, undo history
 * and selection start fresh. The view that makes it attaches it here; the
 * service passes on its events (`edit`, `comments-click`, `errors-change`,
 * `error-click`, `selection-change`, with the editor's `detail`) and lets
 * others use it without holding on to the element.
 */
export class Editor extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
        this._element = null;
        this._stops = [];
        this._newWait();
    }

    _newWait() {
        this._ready = new Promise((resolve) => (this._resolve = resolve));
    }

    /** The editor element, or `null` while there is none. */
    get element() {
        return this._element;
    }

    /** The document's text in the editor, as it would be saved. */
    get value() {
        return this._element?.value ?? "";
    }

    /** Whether a cell is being edited. */
    get editing() {
        return !!this._element?.editing;
    }

    /**
     * Attach the editor element the view made (or `null`).
     * @param {HTMLElement | null} element
     */
    attach(element) {
        if (element === this._element) return;
        for (const stop of this._stops) stop();
        this._stops = [];
        this._element = element ?? null;
        if (this._element) {
            for (const [from, to] of Object.entries(EVENTS)) {
                const listener = (e) => this.emit(to, e.detail);
                this._element.addEventListener(from, listener);
                this._stops.push(() => element.removeEventListener(from, listener));
            }
            this._resolve(this._element);
        }
        this.changed();
    }

    /** Let go of the editor: a new document is coming, in a new one. Who
     * waits for the old one gets `null`. */
    reset() {
        this.attach(null);
        this._resolve(null);
        this._newWait();
    }

    /** The next editor attached (or the one attached now), or `null` if a
     * new document comes first. */
    whenReady() {
        return this._element ? Promise.resolve(this._element) : this._ready;
    }

    /** The editor once the window shows the latest state (`ui.settled`),
     * or `null`. */
    async settled() {
        await this._stilo.ui.settled();
        return this._element;
    }

    focus() {
        this._element?.focus();
    }

    /** Select a line (from 1), back in the editor view, and focus it. */
    async reveal(line) {
        this._stilo.ui.setSource(null);
        const element = await this.settled();
        element?.select(line);
        element?.focus();
    }

    /** Run a command of the editor (`runCommand`, docs/component/api.md),
     * back in the editor view. */
    runCommand(name) {
        const element = this._element;
        if (!element) return;
        this._stilo.ui.setSource(null);
        element.focus();
        return element.runCommand(name);
    }
}
