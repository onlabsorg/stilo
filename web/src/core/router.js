// The `router` service: the browser's address decides what the app shows
// (route.js), so every view can be bookmarked and the back button works.

import { Service } from "./service.js";
import { readRoute, routeUrl } from "../route.js";

/**
 * Holds the navigation root (a folder path) and opens the document of the
 * address (`document.load`). `go` adds a history entry, `replace` changes
 * the current one; the back and forward buttons apply the address again.
 */
export class Router extends Service {
    /**
     * @param {object} stilo
     * @param {{history?: History, location?: Location, window?: Window}} [browser] -
     *   The browser's objects, replaceable in tests.
     */
    constructor(stilo, { history = window.history, location = window.location, window: win = window } = {}) {
        super();
        this._stilo = stilo;
        this._root = null;
        this._history = history;
        this._location = location;
        this._window = win;
        this._onPopState = () => this.apply(readRoute(this._location));
    }

    /** The navigation root, a folder path (`""` for the server root). */
    get root() {
        return this._root;
    }

    /** Apply the address, and follow the back and forward buttons. */
    start() {
        this._window.addEventListener("popstate", this._onPopState);
        return this.apply(readRoute(this._location));
    }

    stop() {
        this._window.removeEventListener("popstate", this._onPopState);
    }

    /** Show a route (`{root, doc}`), with a new history entry. Leaving a
     * document with unsaved changes asks first; declined, nothing happens. */
    async go(route) {
        const { document, ui } = this._stilo;
        if (document.dirty && route.doc !== document.path && !(await ui.confirm("Discard unsaved changes?"))) return;
        this._history.pushState(null, "", routeUrl(route));
        return this.apply(route);
    }

    /** Show a route in place of the current history entry, without asking
     * (the old address is gone, e.g. after a move). */
    replace(route) {
        this._history.replaceState(null, "", routeUrl(route));
        return this.apply(route);
    }

    /** Show a route without touching the history. */
    async apply({ root, doc }) {
        if (root !== this._root) {
            this._root = root;
            this.changed();
        }
        if (doc !== this._stilo.document.path) await this._stilo.document.load(doc);
    }
}
