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
        /** @type {Map<string, Badge>} */
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

    /** Show a badge on a panel's button, or remove it with `null`. */
    setBadge(id, badge) {
        if (badge) this._badges.set(id, badge);
        else if (!this._badges.delete(id)) return;
        this.changed();
    }

    /** The badge on a panel's button, if any. @returns {Badge | undefined} */
    badge(id) {
        return this._badges.get(id);
    }
}
