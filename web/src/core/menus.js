// The `menus` service: what each menu of the app offers.

import { Service } from "./service.js";

/**
 * The menus are known by id: `tree/document`, `tree/other`, `tree/folder` and
 * `tree/pane` are the navigation pane's (on a document, on another file, on a
 * folder, on the pane itself). A menu lists commands by group, with a
 * separator between groups; groups come in the order they were first used,
 * and within a group the items by `order`, then in the order they were added.
 */
export class Menus extends Service {
    constructor() {
        super();
        this._entries = [];
        this._groups = [];
    }

    /**
     * Put a command in a menu. Returns the function that takes it out.
     * @param {string} menu
     * @param {string} command
     * @param {{group?: string, order?: number}} [options]
     * @returns {() => void}
     */
    add(menu, command, { group = "", order = 0 } = {}) {
        const entry = { menu, command, group, order };
        if (!this._groups.includes(`${menu}\n${group}`)) this._groups.push(`${menu}\n${group}`);
        this._entries.push(entry);
        this.changed();
        return () => {
            const i = this._entries.indexOf(entry);
            if (i < 0) return;
            this._entries.splice(i, 1);
            this.changed();
        };
    }

    /** The command ids of a menu, in order, with `"-"` between groups. */
    items(menu) {
        const items = [];
        for (const key of this._groups) {
            if (!key.startsWith(`${menu}\n`)) continue;
            const group = key.slice(menu.length + 1);
            const entries = this._entries
                .map((entry, i) => ({ entry, i }))
                .filter(({ entry }) => entry.menu === menu && entry.group === group)
                .sort((a, b) => a.entry.order - b.entry.order || a.i - b.i);
            if (!entries.length) continue;
            if (items.length) items.push("-");
            items.push(...entries.map(({ entry }) => entry.command));
        }
        return items;
    }
}
