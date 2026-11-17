// The `ui` service: what the window shows around the document, and the ways
// to talk to the user that look like Stilo.

import { Service } from "./service.js";

export class UI extends Service {
    constructor() {
        super();
        this._status = "";
        this._navOpen = true;
        this._pane = null;
        this._source = null;
        this._settle = null;
    }

    /** The message in the top bar ("Saved", an error), or `""`. */
    get status() {
        return this._status;
    }

    /** Whether the navigation pane is open. */
    get navOpen() {
        return this._navOpen;
    }

    /** The id of the panel open in the right pane (`panels`), or `null`. */
    get pane() {
        return this._pane;
    }

    /** The document's text shown read-only in place of the editor (Show
     * source), or `null`. */
    get source() {
        return this._source;
    }

    _set(name, value) {
        if (this[name] === value) return;
        this[name] = value;
        this.changed();
    }

    /** Show a message in the top bar; `""` clears it. */
    notify(message) {
        this._set("_status", message);
    }

    /** Ask the user to confirm; resolves to whether they did. */
    async confirm(message) {
        return window.confirm(message);
    }

    setNavOpen(open) {
        this._set("_navOpen", !!open);
    }

    toggleNav() {
        this.setNavOpen(!this._navOpen);
    }

    /** Open a panel in the right pane by its id, or close it with `null`. */
    openPane(id) {
        this._set("_pane", id ?? null);
    }

    /** Open a panel, or close it if it is the one open. */
    togglePane(id) {
        this.openPane(this._pane === id ? null : id);
    }

    /** Set how to wait until the window shows the latest state: the app
     * that renders the window gives it (`settled`). */
    setSettle(settle) {
        this._settle = settle;
    }

    /** Resolves when the window shows the latest state, e.g. the navigation
     * pane after `setNavOpen(true)`, or the editor after `setSource(null)`. */
    async settled() {
        await this._settle?.();
    }

    /** Show a text read-only in place of the editor, or go back with `null`. */
    setSource(text) {
        this._set("_source", text ?? null);
    }
}
