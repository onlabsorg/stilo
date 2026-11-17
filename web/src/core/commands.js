// The `commands` service: every command of the app, by id.

import { Service } from "./service.js";

/**
 * @typedef {object} Command
 * @property {string} id - Unique; an extension's are `<extension-id>.<name>`.
 * @property {string} label - As the user sees it, in the commands pane and menus.
 * @property {string} group - The heading it is listed under in the commands pane.
 * @property {(stilo: object, context: {node?: object}) => any} [run] - What it
 *   does; `context.node` is the tree item it was called on, if any. A command
 *   without `run` is listed for reference (a key a cell handles itself).
 * @property {(stilo: object) => boolean} [checked] - For an option: whether it
 *   is on, shown as a check mark in menus.
 */

export class Commands extends Service {
    constructor(stilo) {
        super();
        this._stilo = stilo;
        /** @type {Map<string, Command>} */
        this._commands = new Map();
    }

    /**
     * Add a command. Returns the function that removes it. An id already
     * taken is refused.
     * @param {Command} command
     * @returns {() => void}
     */
    register(command) {
        if (this._commands.has(command.id)) throw new Error(`a command with the id "${command.id}" exists already`);
        this._commands.set(command.id, command);
        this.changed();
        return () => {
            if (this._commands.get(command.id) !== command) return;
            this._commands.delete(command.id);
            this.changed();
        };
    }

    /** The command with this id, if any. @returns {Command | undefined} */
    get(id) {
        return this._commands.get(id);
    }

    /** Every command, in the order they were added. @returns {Command[]} */
    list() {
        return [...this._commands.values()];
    }

    /** Run a command, with a context (`{node}`). Returns what it returns. */
    run(id, context = {}) {
        return this._commands.get(id)?.run?.(this._stilo, context);
    }
}
