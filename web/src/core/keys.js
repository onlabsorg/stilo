// The `keys` service: keyboard shortcuts bound to commands.

import { Service } from "./service.js";

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/** A shortcut for display, with ⌘ on macOS. */
export function formatKeys(keys) {
    return isMac ? keys.replace("Mod+", "⌘").replace("Alt+", "⌥").replace("Shift+", "⇧") : keys.replace("Mod+", "Ctrl+");
}

/**
 * Read a shortcut such as `Mod+Shift+Z`, `Alt+N` or `F1`: modifiers joined by
 * `+` before a key. `Mod` is Ctrl, or ⌘ on macOS.
 */
export function parseKeys(keys) {
    const parts = keys.split("+");
    const key = parts.pop();
    const mods = new Set(parts);
    return { mod: mods.has("Mod"), alt: mods.has("Alt"), shift: mods.has("Shift"), key };
}

/**
 * Whether a key event is the shortcut `keys`. A letter with Alt is matched by
 * the key's place (`e.code`), since Alt changes the character on macOS; other
 * letters by the character, in either case; other keys by name (`F1`, `Delete`).
 */
export function matchesKeys(e, keys) {
    const { mod, alt, shift, key } = parseKeys(keys);
    if ((isMac ? e.metaKey : e.ctrlKey) !== mod || e.altKey !== alt || e.shiftKey !== shift) return false;
    if (isMac ? e.ctrlKey : e.metaKey) return false;
    if (/^[A-Za-z]$/.test(key)) return alt ? e.code === `Key${key.toUpperCase()}` : e.key.toLowerCase() === key.toLowerCase();
    return e.key === key;
}

/**
 * @typedef {object} Binding
 * @property {string} keys - The shortcut, e.g. `Mod+S`.
 * @property {string} command - The id of the command it runs.
 * @property {"global" | "tree" | "editor"} when - Where it applies: anywhere,
 *   when an item of the navigation pane has the focus, or in the editor. The
 *   editor handles its keys itself, before anyone else: its bindings are
 *   listed, never dispatched here.
 * @property {boolean} show - Whether the commands pane and menus show it.
 */

export class Keys extends Service {
    constructor() {
        super();
        /** @type {Binding[]} */
        this._bindings = [];
    }

    /**
     * Bind a shortcut to a command. For the same keys and place, the last
     * binding wins, with a warning; removing it brings back the one before.
     * Returns the function that removes it.
     * @param {string} keys
     * @param {string} command
     * @param {{when?: Binding["when"], show?: boolean}} [options]
     * @returns {() => void}
     */
    bind(keys, command, { when = "global", show = true } = {}) {
        const binding = { keys, command, when, show };
        const taken = this._bindings.findLast((b) => b.keys === keys && b.when === when);
        if (taken) console.warn(`Stilo: ${keys} (${when}) now runs ${command} instead of ${taken.command}`);
        this._bindings.push(binding);
        this.changed();
        return () => {
            const i = this._bindings.indexOf(binding);
            if (i < 0) return;
            this._bindings.splice(i, 1);
            this.changed();
        };
    }

    /** The id of the command a key event runs in a place (`global`, `tree`),
     * or `null`. */
    match(e, when = "global") {
        return this._bindings.findLast((b) => b.when === when && when !== "editor" && matchesKeys(e, b.keys))?.command ?? null;
    }

    /** The shortcut shown for a command, if any (the first one bound). */
    keysFor(command) {
        return this._bindings.find((b) => b.command === command && b.show)?.keys ?? "";
    }
}
