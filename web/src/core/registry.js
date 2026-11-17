// The base of the registries of visible contributions (S17): panels, top-bar
// items, status-line items.

import { Service } from "./service.js";

/**
 * Items by id, each `{id, order?, ...}`, listed by `order`. `register` adds
 * one; `replace` puts another in the place of one, until disposed. An id
 * holds a stack: the latest registration or replacement shows, and disposing
 * it brings back the one before. Every registration returns `dispose()`.
 */
export class Registry extends Service {
    constructor() {
        super();
        /** @type {Map<string, object[]>} ids in the order first added, each a stack */
        this._stacks = new Map();
    }

    /**
     * Add an item. Returns the function that removes it. An id already taken
     * is refused.
     * @returns {() => void}
     */
    register(item) {
        if (this._stacks.has(item.id)) throw new Error(`an item with the id "${item.id}" exists already`);
        return this._push(item);
    }

    /**
     * Put `item` in place of the item with the id `id` (its own id becomes
     * `id`). Returns the function that brings the one before back.
     * @returns {() => void}
     */
    replace(id, item) {
        if (!this._stacks.has(id)) throw new Error(`there is no item with the id "${id}" to replace`);
        return this._push({ ...item, id });
    }

    _push(item) {
        const entry = { order: 0, ...item };
        const stack = this._stacks.get(entry.id) ?? [];
        stack.push(entry);
        this._stacks.set(entry.id, stack);
        this.changed();
        return () => {
            const i = stack.indexOf(entry);
            if (i < 0) return;
            stack.splice(i, 1);
            if (!stack.length && this._stacks.get(entry.id) === stack) {
                this._stacks.delete(entry.id);
                this.removed(entry.id);
            }
            this.changed();
        };
    }

    /** Called when the last item of an id is gone. */
    removed(id) {}

    /** The item with this id, if any. */
    get(id) {
        return this._stacks.get(id)?.at(-1);
    }

    /** The items, by `order`, then in the order their ids were added. */
    list() {
        return [...this._stacks.values()]
            .map((stack, i) => ({ item: stack.at(-1), i }))
            .sort((a, b) => a.item.order - b.item.order || a.i - b.i)
            .map(({ item }) => item);
    }
}

/**
 * @typedef {object} BarItem
 * @property {string} id - Unique; an extension's are `<extension-id>.<name>`.
 * @property {number} [order] - Place among the items, left to right.
 * @property {(stilo: object) => unknown} render - Its content, a Lit template
 *   or an element. Rendered again when the registry changes: call its
 *   `changed()`, or render an element that follows the services itself.
 */

/**
 * @typedef {object} View
 * @property {string} id - Unique; an extension's are `<extension-id>.<name>`.
 *   Its address is `/?view=<id>`.
 * @property {string} label - Its name, shown in the top bar while it is open.
 * @property {(stilo: object, params: Record<string, string>) => unknown} render -
 *   Its content, a Lit template or an element, shown in place of the editor;
 *   `params` are the other parameters of the address.
 */

/** The `views` service: pages that are not a document, addressed by
 * `?view=<id>` (`router`), shown in place of the editor. */
export class Views extends Registry {
    constructor(stilo) {
        super();
        this._stilo = stilo;
    }

    /** Open a view, with parameters, as a new history entry (`router.go`). */
    open(id, params = {}) {
        const { router } = this._stilo;
        return router.go({ root: router.root ?? "", view: id, params });
    }
}

/** The `topBar` service: items in the top bar, left of the panels' buttons. */
export class TopBar extends Registry {}

/** The `status` service: items in the status line at the bottom of the
 * window, which shows only while it has items. */
export class Status extends Registry {}
