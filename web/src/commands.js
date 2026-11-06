// The user commands listed in the commands pane, with their shortcuts.
//
// App commands run a function of the app. Editor commands run a command of
// the editor (`runCommand`, docs/component/api.md), the one its key runs;
// their shortcuts are the editor's own keys. Commands without `run` are
// shown for reference only (keys of a cell's own text editor).

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

/** A command of the editor, by its name there, which is also its id. */
function editorCommand(id, label, keys, group = "Document") {
    return { id, label, keys, group, run: (app) => app.runEditorCommand(id) };
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
        id: "show-source",
        label: "Show source",
        keys: "Alt+U",
        group: "View",
        match: (e) => e.altKey && !mod(e) && e.code === "KeyU",
        run: (app) => app.toggleSource(),
    },
    {
        id: "toggle-theme",
        label: "Switch light / dark theme",
        keys: "Alt+T",
        group: "View",
        match: (e) => e.altKey && !mod(e) && e.code === "KeyT",
        run: (app) => app.toggleTheme(),
    },

    editorCommand("edit", "Edit the selected cell", "Enter"),
    editorCommand("insert-below", "Insert a cell below", "Alt+Enter"),
    editorCommand("insert-above", "Insert a cell above", "Alt+Shift+Enter"),
    editorCommand("move-up", "Move cells up", "Alt+↑"),
    editorCommand("move-down", "Move cells down", "Alt+↓"),
    editorCommand("delete", "Delete the selected cells", "Delete"),
    editorCommand("cell-type", "Change the cell type…", "Mod+/"),
    editorCommand("make-formula", "Make it a formula and edit", "="),
    editorCommand("make-text", "Make it text and edit", "T"),
    editorCommand("make-markdown", "Make it Markdown and edit", "M"),
    editorCommand("make-table", "Make it a table and edit", "Shift+T"),
    editorCommand("undo", "Undo", "Mod+Z"),
    editorCommand("redo", "Redo", "Mod+Shift+Z"),
    editorCommand("comments", "Show the cell's comments", "Shift+F2"),
    editorCommand("errors", "Show the cell's errors", ""),
    editorCommand("copy", "Copy cells", "Mod+C"),
    editorCommand("cut", "Cut cells", "Mod+X"),
    editorCommand("paste", "Paste cells", "Mod+V"),

    editorCommand("commit", "Commit the edit", "Mod+Enter", "While editing a cell"),
    editorCommand("discard", "Discard the edit", "Escape", "While editing a cell"),
    { id: "insert-tag", label: "Insert a formula tag", keys: "Mod+E", group: "While editing a cell" },
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
