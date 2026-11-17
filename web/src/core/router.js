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
        this._view = null;
        this._params = {};
        this._history = history;
        this._location = location;
        this._window = win;
        this._onPopState = () => this.apply(readRoute(this._location));
    }

    /** The navigation root, a folder path (`""` for the server root). */
    get root() {
        return this._root;
    }

    /** The id of the view shown in place of a document, or `null`. */
    get view() {
        return this._view;
    }

    /** The parameters of the view shown (`{}` without one). */
    get params() {
        return this._params;
    }

    /** The route shown now: `{root, doc, view, params}`. */
    get route() {
        return { root: this._root, doc: this._stilo.document.path, view: this._view, params: this._params };
    }

    /** Apply the address, and follow the back and forward buttons. */
    start() {
        this._window.addEventListener("popstate", this._onPopState);
        return this.apply(readRoute(this._location));
    }

    stop() {
        this._window.removeEventListener("popstate", this._onPopState);
    }

    /** Show a route (`{root, doc}`, or `{root, view, params}` for a view),
     * with a new history entry. Leaving a document with unsaved changes
     * asks first; declined, nothing happens. */
    async go(route) {
        const { document, ui } = this._stilo;
        const doc = route.view ? null : (route.doc ?? null);
        if (document.dirty && doc !== document.path && !(await ui.confirm("Discard unsaved changes?", { ok: "Discard", danger: true }))) return;
        this._history.pushState(null, "", routeUrl(route));
        return this.apply(route);
    }

    /** Show a route in place of the current history entry, without asking
     * (the old address is gone, e.g. after a move). */
    replace(route) {
        this._history.replaceState(null, "", routeUrl(route));
        return this.apply(route);
    }

    /** Show a route without touching the history. A view closes the
     * document. */
    async apply({ root, doc, view = null, params = {} }) {
        view = view || null;
        params = view ? { ...params } : {};
        if (view) doc = null;
        if (root !== this._root || view !== this._view || JSON.stringify(params) !== JSON.stringify(this._params)) {
            this._root = root;
            this._view = view;
            this._params = params;
            this.changed();
        }
        if ((doc ?? null) !== this._stilo.document.path) await this._stilo.document.load(doc ?? null);
    }
}
