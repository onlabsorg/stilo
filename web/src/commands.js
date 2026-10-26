// The user commands listed in the commands pane, with their shortcuts.
//
// App commands run a function of the app. Editor commands are the editor's
// own keys (texl-editor docs/api.md, Keyboard): clicking one sends the key to
// the editor as a synthetic keydown, until texl-editor offers a command API.
// Commands without `run` are shown for reference only (the clipboard needs a
// real key press; edit-mode keys need a cell in edit mode).

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * @typedef {object} Command
 * @property {string} id
 * @property {string} label
 * @property {string} group
 * @property {string} [keys]  Shortcut as text, "Mod" is Ctrl or ⌘.
 * @property {(app: any) => void} [run]
 * @property {(e: KeyboardEvent) => boolean} [match]  App shortcut matcher.
 */

const mod = (e) => (isMac ? e.metaKey : e.ctrlKey);

/** A command that sends a key to the editor. */
function editorKey(id, label, keys, key, options = {}) {
    return {
        id,
        label,
        keys,
        group: "Document",
        run: (app) => app.sendEditorKey(key, options),
    };
}

/** @type {Command[]} */
export const commands = [
    {
        id: "save",
        label: "Save",
        keys: "Mod+S",
        group: "File",
        match: (e) => mod(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s",
        run: (app) => app.save(),
    },
    {
        id: "new-document",
        label: "New document…",
        keys: "Alt+N",
        group: "File",
        match: (e) => e.altKey && !mod(e) && e.code === "KeyN",
        run: (app) => app.newDocument(),
    },
    {
        id: "reload",
        label: "Reload document",
        group: "File",
        run: (app) => app.reload(),
    },
    {
        id: "toggle-nav",
        label: "Toggle navigation pane",
        keys: "Mod+B",
        group: "View",
        match: (e) => mod(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b",
        run: (app) => app.toggleNav(),
    },
    {
        id: "show-commands",
        label: "Show commands",
        keys: "F1",
        group: "View",
        match: (e) => e.key === "F1" && !mod(e) && !e.altKey && !e.shiftKey,
        run: (app) => app.togglePane("commands"),
    },
    {
        id: "show-comments",
        label: "Show comments",
        keys: "Alt+C",
        group: "View",
        match: (e) => e.altKey && !mod(e) && e.code === "KeyC",
        run: (app) => app.togglePane("comments"),
    },
    {
        id: "toggle-theme",
        label: "Switch light / dark theme",
        keys: "Alt+T",
        group: "View",
        match: (e) => e.altKey && !mod(e) && e.code === "KeyT",
        run: (app) => app.toggleTheme(),
    },

    editorKey("edit-cell", "Edit the selected cell", "Enter", "Enter"),
    editorKey("insert-below", "Insert a cell below", "Alt+Enter", "Enter", { altKey: true }),
    editorKey("insert-above", "Insert a cell above", "Alt+Shift+Enter", "Enter", { altKey: true, shiftKey: true }),
    editorKey("move-up", "Move cells up", "Alt+↑", "ArrowUp", { altKey: true }),
    editorKey("move-down", "Move cells down", "Alt+↓", "ArrowDown", { altKey: true }),
    editorKey("delete-cells", "Delete the selected cells", "Delete", "Delete"),
    editorKey("cell-type", "Change the cell type…", "Mod+/", "/", { mod: true }),
    editorKey("undo", "Undo", "Mod+Z", "z", { mod: true }),
    editorKey("redo", "Redo", "Mod+Shift+Z", "z", { mod: true, shiftKey: true }),
    editorKey("cell-comments", "Show the cell's comments", "Shift+F2", "F2", { shiftKey: true }),
    { id: "copy", label: "Copy cells", keys: "Mod+C", group: "Document" },
    { id: "cut", label: "Cut cells", keys: "Mod+X", group: "Document" },
    { id: "paste", label: "Paste cells", keys: "Mod+V", group: "Document" },

    { id: "commit", label: "Commit the edit", keys: "Mod+Enter", group: "While editing a cell" },
    { id: "discard", label: "Discard the edit", keys: "Escape", group: "While editing a cell" },
    { id: "insert-tag", label: "Insert a formula tag", keys: "Ctrl+Space", group: "While editing a cell" },
    { id: "insert-comment", label: "Insert a cell comment", keys: "Shift+F2", group: "While editing a cell" },
];

/** The app command whose shortcut matches a key event, if any. */
export function matchCommand(e) {
    return commands.find((command) => command.match?.(e));
}

/** A shortcut for display, with ⌘ on macOS. */
export function formatKeys(keys) {
    return isMac ? keys.replace("Mod+", "⌘").replace("Alt+", "⌥").replace("Shift+", "⇧") : keys.replace("Mod+", "Ctrl+");
}
