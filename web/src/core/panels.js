// The `panels` service: the panels of the right pane, each with its button in
// the top bar.

import { Registry } from "./registry.js";

/**
 * @typedef {object} Panel
 * @property {string} id - Unique; an extension's are `<extension-id>.<name>`.
 * @property {string} label - The button's name, e.g. "Comments".
 * @property {unknown} icon - The button's icon, a Lit template (an SVG).
 * @property {number} [order] - Place among the buttons, left to right.
 * @property {(stilo: object) => unknown} render - The panel's content, a Lit
 *   template or an element, rendered when it is open.
 */

/**
 * @typedef {object} Badge
 * @property {string} text - Shown on the button, e.g. a count.
 * @property {string} [label] - The button's name while the badge shows, e.g. "3 errors".
 * @property {"danger"} [tone] - Its colour.
 */

export class Panels extends Registry {
    constructor() {
        super();
        /** The badge of each panel, in an entry of its own per setBadge call.
         * @type {Map<string, {badge: Badge}>} */
        this._badges = new Map();
    }

    /**
     * Add a panel. Returns the function that removes it. An id already taken
     * is refused. `replace(id, panel)` puts another in place of one (`Registry`).
     * @param {Panel} panel
     * @returns {() => void}
     */
    register(panel) {
        return super.register(panel);
    }

    removed(id) {
        this._badges.delete(id);
    }

    /**
     * Show a badge on a panel's button, or remove it with `null`, on any
     * panel, Stilo's own too. Returns the function that removes this badge,
     * if it is still the one shown (a badge set since stays). It has a `key`,
     * the same for every call on one panel: an extension's scoped `stilo`
     * keeps only the latest, and calls it when the extension is deactivated.
     * @param {string} id
     * @param {Badge | null} badge
     * @returns {(() => void) & {key: string}}
     */
    setBadge(id, badge) {
        const entry = badge ? { badge } : null;
        if (entry) this._badges.set(id, entry);
        if (entry || this._badges.delete(id)) this.changed();
        const dispose = () => {
            if (!entry || this._badges.get(id) !== entry) return;
            this._badges.delete(id);
            this.changed();
        };
        return Object.assign(dispose, { key: `panels.badge:${id}` });
    }

    /** The badge on a panel's button, if any. @returns {Badge | undefined} */
    badge(id) {
        return this._badges.get(id)?.badge;
    }
}
