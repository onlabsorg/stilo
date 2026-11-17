// Stilo's own commands, keys and menus, registered through the services as
// an extension would (S17).
//
// App commands run a function of the app. Editor commands run a command of
// the editor (`runCommand`, docs/component/api.md), the one its key runs;
// their keys are the editor's own, bound `when: "editor"` to be listed.
// Commands without `run` are listed for reference only (keys of a cell's own
// text editor).
//
// Until the state has moved into the services (phase 2 of S17), commands
// reach the app through `stilo._app`.

import { isMac } from "../core/keys.js";
import { toggleTheme } from "../theme.js";

const app = (stilo) => stilo._app;

/** A command of the editor, by its name there, which is also its id. */
function editorCommand(id, label, keys, group = "Document") {
    return { id, label, keys, when: "editor", group, run: (stilo) => stilo.editor.runCommand(id) };
}

/** Show the document's text, as it would be saved, instead of the editor;
 * read-only. Again: back to the editor. */
function toggleSource({ ui, editor }) {
    if (!editor.element) return;
    if (ui.source === null) return ui.setSource(editor.value);
    ui.setSource(null);
    editor.settled().then((element) => element?.focus());
}

/** A command on an item of the navigation pane. Without a node, from the
 * commands pane, it acts on the app's `treeTarget`. */
function treeCommand(id, label, keys, run) {
    return {
        id,
        label,
        keys,
        when: "tree",
        group: "Navigation pane",
        run: (stilo, { node } = {}) => run(app(stilo), node ?? app(stilo).treeTarget),
    };
}

/** A command of the navigation pane as a whole. */
function paneCommand(id, label, run) {
    return { id, label, group: "Navigation pane", run: (stilo) => run(app(stilo)) };
}

/**
 * The commands, in the order of the commands pane, with their keys (`keys`,
 * bound where `when` says, `global` by default).
 */
export const definitions = [
    { id: "save", label: "Save", keys: "Mod+S", group: "File", run: (stilo) => stilo.document.save() },
    {
        id: "new-document",
        label: "New document…",
        keys: "Alt+N",
        group: "File",
        run: (stilo, { node } = {}) => app(stilo).newDocument(node),
    },
    { id: "reload", label: "Reload document", group: "File", run: (stilo) => stilo.document.reload() },

    {
        id: "tree-new-folder",
        label: "New folder…",
        group: "Navigation pane",
        run: (stilo, { node } = {}) => app(stilo).newFolder(node),
    },
    {
        id: "tree-upload",
        label: "Upload files…",
        group: "Navigation pane",
        run: (stilo, { node } = {}) => app(stilo).upload(node),
    },
    treeCommand("tree-rename", "Rename", "F2", (app, node) => app.rename(node)),
    treeCommand("tree-duplicate", "Duplicate", "", (app, node) => app.duplicate(node)),
    treeCommand("tree-move", "Move to…", "", (app, node) => app.moveTo(node)),
    treeCommand("tree-copy-link", "Copy link", "", (app, node) => app.copyLink(node)),
    treeCommand("tree-open-root", "Open as root", "", (app, node) => app.openAsRoot(node)),
    treeCommand("tree-delete", "Delete", "Delete", (app, node) => app.deleteItem(node)),
    paneCommand("tree-refresh", "Refresh", (app) => app.refreshTree()),
    {
        ...paneCommand("tree-show-other", "Show other files", (app) => app.toggleOtherFiles()),
        checked: (stilo) => app(stilo)._showOther,
    },

    { id: "toggle-nav", label: "Toggle navigation pane", keys: "Mod+B", group: "View", run: (stilo) => stilo.ui.toggleNav() },
    { id: "show-commands", label: "Show commands", keys: "F1", group: "View", run: (stilo) => stilo.ui.togglePane("commands") },
    { id: "show-comments", label: "Show comments", keys: "Alt+C", group: "View", run: (stilo) => stilo.ui.togglePane("comments") },
    { id: "show-source", label: "Show source", keys: "Alt+U", group: "View", run: toggleSource },
    { id: "toggle-theme", label: "Switch light / dark theme", keys: "Alt+T", group: "View", run: () => toggleTheme() },

    editorCommand("edit", "Edit the selected cell", "Enter"),
    editorCommand("insert-below", "Insert a cell below", "Alt+Enter"),
    editorCommand("insert-above", "Insert a cell above", "Alt+Shift+Enter"),
    editorCommand("move-up", "Move cells up", "Alt+↑"),
    editorCommand("move-down", "Move cells down", "Alt+↓"),
    editorCommand("delete", "Delete the selected cells", "Delete"),
    editorCommand("cell-type", "Change the cell type…", "Mod+/"),
    editorCommand("hide", "Hide the selected cells", ""),
    editorCommand("unhide", "Unhide the cells in the selection", ""),
    editorCommand("show-hidden", "Show or hide the hidden cells", ""),
    editorCommand("make-formula", "Make it a formula and edit", "="),
    editorCommand("make-rich", "Make it rich text and edit", "R"),
    editorCommand("make-text", "Make it text and edit", "T"),
    editorCommand("make-markdown", "Make it Markdown and edit", "M"),
    editorCommand("make-table", "Make it a table and edit", "Shift+T"),
    editorCommand("make-data", "Make it a data table and edit", "D"),
    editorCommand("make-chart", "Make it a chart and edit", "C"),
    editorCommand("undo", "Undo", "Mod+Z"),
    editorCommand("redo", "Redo", "Mod+Shift+Z"),
    editorCommand("comments", "Show the cell's comments", "Shift+F2"),
    editorCommand("errors", "Show the cell's errors", ""),
    editorCommand("copy", "Copy cells", "Mod+C"),
    editorCommand("cut", "Cut cells", "Mod+X"),
    editorCommand("paste", "Paste cells", "Mod+V"),

    editorCommand("commit", "Commit the edit", "Mod+Enter", "While editing a cell"),
    editorCommand("discard", "Discard the edit", "Escape", "While editing a cell"),
    { id: "insert-tag", label: "Insert a formula tag", keys: "Mod+E", when: "editor", group: "While editing a cell" },
    { id: "insert-comment", label: "Insert a cell comment", keys: "Shift+F2", when: "editor", group: "While editing a cell" },
];

/**
 * The menus of the navigation pane: command ids by group, in order. The
 * menu `tree/document` opens on a document, `tree/other` on any other file.
 */
export const menus = {
    "tree/document": { edit: ["tree-rename", "tree-duplicate", "tree-move", "tree-copy-link"], delete: ["tree-delete"] },
    "tree/other": { edit: ["tree-rename", "tree-move", "tree-copy-link"], delete: ["tree-delete"] },
    "tree/folder": {
        new: ["new-document", "tree-new-folder", "tree-upload"],
        place: ["tree-open-root", "tree-rename", "tree-move"],
        delete: ["tree-delete"],
    },
    "tree/pane": { new: ["new-document", "tree-new-folder", "tree-upload"], view: ["tree-refresh", "tree-show-other"] },
};

/** Register Stilo's commands, keys and menus. Returns the function that
 * removes them all. */
export function activate(stilo) {
    const disposers = [];
    for (const { keys, when, ...command } of definitions) {
        disposers.push(stilo.commands.register(command));
        if (keys) disposers.push(stilo.keys.bind(keys, command.id, { when }));
    }
    // On macOS, Backspace deletes a tree item too, as in Finder
    if (isMac) disposers.push(stilo.keys.bind("Backspace", "tree-delete", { when: "tree", show: false }));
    for (const [menu, groups] of Object.entries(menus))
        for (const [group, ids] of Object.entries(groups)) for (const id of ids) disposers.push(stilo.menus.add(menu, id, { group }));
    return () => disposers.reverse().forEach((dispose) => dispose());
}
