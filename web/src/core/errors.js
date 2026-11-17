// The `errors` service: the errors of the open document's rendering.

import { Service } from "./service.js";

/**
 * The editor finds the errors on every rendering (`DocumentError`s, see
 * docs/component/api.md); this service holds the latest list, and which
 * error to point out. Going to an error's place is done by whoever handles
 * the `go-to` event (Stilo's own: `builtins/go-to.js`).
 */
export class Errors extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
        this._list = [];
        this._current = null;
        stilo.editor.on("errors-change", ({ errors }) => this.set(errors));
        stilo.editor.on("error-click", ({ error }) => this.show(error?.key ?? null));
    }

    /** The errors, as the editor gives them. */
    get list() {
        return this._list;
    }

    /** How many undefined values were returned, all errors together. */
    get count() {
        return this._list.reduce((sum, error) => sum + error.count, 0);
    }

    /** The key of the error pointed out, or `null`. */
    get current() {
        return this._current;
    }

    /** Take the errors of a new rendering. */
    set(list) {
        this._list = list ?? [];
        this.changed();
    }

    /** Forget the errors and the one pointed out (no document, or a new one). */
    clear() {
        this._list = [];
        this._current = null;
        this.changed();
    }

    /** Point out an error by its key, and open the errors panel. */
    show(key) {
        this._current = key ?? null;
        this.changed();
        this._stilo.ui.openPane("errors");
    }

    /**
     * Go to a place an error names: `{line}` in the open document, or
     * `{uri, line}` in another document. Fires `go-to`.
     */
    goTo(place) {
        this.emit("go-to", place);
    }
}
