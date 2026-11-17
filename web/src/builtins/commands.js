// Stilo's own commands, keys and menus, registered through the services as
// an extension would (S17).
//
// App commands run a function of the app. Editor commands run a command of
// the editor (`runCommand`, docs/component/api.md), the one its key runs;
// their keys are the editor's own, bound `when: "editor"` to be listed.
// Commands without `run` are listed for reference only (keys of a cell's own
// text editor).
//
import { isMac } from "../core/keys.js";
import { toggleTheme } from "../theme.js";
import { editorCommands } from "../editor/index.js";
import * as files from "./files.js";

/** A command of the editor (`editorCommands`), by its name there, which is
 * also its id; a key of a cell's own text editor is listed without `run`. */
function editorCommand({ name, label, keys, group, cell }) {
    return { id: name, label, keys, when: "editor", group, ...(cell ? {} : { run: (stilo) => stilo.editor.runCommand(name) }) };
}

/** Show the document's text, as it would be saved, instead of the editor;
 * read-only. Again: back to the editor. */
function toggleSource({ ui, editor }) {
    if (!editor.element) return;
    if (ui.source === null) return ui.setSource(editor.value);
    ui.setSource(null);
    editor.settled().then((element) => element?.focus());
}

/** A command on an item of the navigation pane (`files.js`). Without a
 * node, from the commands pane, it acts on `tree.target`. */
function treeCommand(id, label, keys, run) {
    return {
        id,
        label,
        keys,
        when: "tree",
        group: "Navigation pane",
        run: (stilo, { node } = {}) => run(stilo, node ?? stilo.tree.target),
    };
}

/** A command of the navigation pane as a whole. */
function paneCommand(id, label, run) {
    return { id, label, group: "Navigation pane", run };
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
        run: (stilo, { node } = {}) => files.newDocument(stilo, node),
    },
    { id: "reload", label: "Reload document", group: "File", run: (stilo) => stilo.document.reload() },

    {
        id: "tree-new-folder",
        label: "New folder…",
        group: "Navigation pane",
        run: (stilo, { node } = {}) => files.newFolder(stilo, node),
    },
    {
        id: "tree-upload",
        label: "Upload files…",
        group: "Navigation pane",
        run: (stilo, { node } = {}) => files.upload(stilo, node),
    },
    treeCommand("tree-rename", "Rename", "F2", files.rename),
    treeCommand("tree-duplicate", "Duplicate", "", files.duplicate),
    treeCommand("tree-move", "Move to…", "", files.moveTo),
    treeCommand("tree-copy-link", "Copy link", "", files.copyLink),
    treeCommand("tree-open-root", "Open as root", "", files.openAsRoot),
    treeCommand("tree-delete", "Delete", "Delete", files.deleteItem),
    paneCommand("tree-refresh", "Refresh", (stilo) => stilo.tree.refresh()),
    {
        ...paneCommand("tree-show-other", "Show other files", (stilo) => stilo.tree.toggleShowOther()),
        checked: (stilo) => stilo.tree.showOther,
    },

    { id: "toggle-nav", label: "Toggle navigation pane", keys: "Mod+B", group: "View", run: (stilo) => stilo.ui.toggleNav() },
    { id: "show-commands", label: "Show commands", keys: "F1", group: "View", run: (stilo) => stilo.ui.togglePane("commands") },
    { id: "show-comments", label: "Show comments", keys: "Alt+C", group: "View", run: (stilo) => stilo.ui.togglePane("comments") },
    { id: "show-source", label: "Show source", keys: "Alt+U", group: "View", run: toggleSource },
    { id: "toggle-theme", label: "Switch light / dark theme", keys: "Alt+T", group: "View", run: () => toggleTheme() },

    // The editor's commands follow, from the editor itself (`editorCommands`)
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
    for (const { keys, when, ...command } of [...definitions, ...editorCommands().map(editorCommand)]) {
        disposers.push(stilo.commands.register(command));
        if (keys) disposers.push(stilo.keys.bind(keys, command.id, { when }));
    }
    // On macOS, Backspace deletes a tree item too, as in Finder
    if (isMac) disposers.push(stilo.keys.bind("Backspace", "tree-delete", { when: "tree", show: false }));
    for (const [menu, groups] of Object.entries(menus))
        for (const [group, ids] of Object.entries(groups)) for (const id of ids) disposers.push(stilo.menus.add(menu, id, { group }));
    return () => disposers.reverse().forEach((dispose) => dispose());
}
