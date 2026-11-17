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
 * @property {(stilo: object, context: {node?: object}) => boolean | string} [enabled] -
 *   Whether it applies now: `true`, or why not (a text, shown with it greyed
 *   out), or `false`. Without it, a command always applies.
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

    /**
     * Why a command does not apply now, in a context (`{node}`): `null` if it
     * does, else the reason, `""` if it gives none. A command whose `enabled`
     * throws does not apply.
     * @returns {string | null}
     */
    disabledReason(id, context = {}) {
        const command = this._commands.get(id);
        if (!command?.enabled) return null;
        let enabled;
        try {
            enabled = command.enabled(this._stilo, context);
        } catch (error) {
            console.error(`Stilo: enabled() of the command "${id}" failed`, error);
            return "";
        }
        return enabled === true ? null : typeof enabled === "string" ? enabled : "";
    }

    /** Run a command, with a context (`{node}`). Returns what it returns. A
     * command that does not apply now does not run: the status says why. */
    run(id, context = {}) {
        const command = this._commands.get(id);
        if (!command?.run) return;
        const reason = this.disabledReason(id, context);
        if (reason !== null) {
            this._stilo.ui?.notify(`${command.label.replace(/…$/, "")} is not available${reason ? `: ${reason}` : " now"}`);
            return;
        }
        return command.run(this._stilo, context);
    }
}
