// The `panels` service: the panels of the right pane, each with its button in
// the top bar.

import { Service } from "./service.js";

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

export class Panels extends Service {
    constructor() {
        super();
        this._panels = [];
        /** @type {Map<string, Badge>} */
        this._badges = new Map();
    }

    /**
     * Add a panel. Returns the function that removes it. An id already taken
     * is refused.
     * @param {Panel} panel
     * @returns {() => void}
     */
    register(panel) {
        if (this.get(panel.id)) throw new Error(`a panel with the id "${panel.id}" exists already`);
        const entry = { order: 0, ...panel };
        this._panels.push(entry);
        this.changed();
        return () => {
            const i = this._panels.indexOf(entry);
            if (i < 0) return;
            this._panels.splice(i, 1);
            this._badges.delete(panel.id);
            this.changed();
        };
    }

    /** The panel with this id, if any. */
    get(id) {
        return this._panels.find((panel) => panel.id === id);
    }

    /** The panels, by `order`, then in the order they were added. */
    list() {
        return this._panels.map((panel, i) => ({ panel, i })).sort((a, b) => a.panel.order - b.panel.order || a.i - b.i).map(({ panel }) => panel);
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
