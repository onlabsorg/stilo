// The editor's commands as the user sees them: label, keys and group, for a
// page that lists them (Stilo's commands pane). The keys are the ones
// `TexlEditor` handles; `runCommand(name)` runs the same commands.

import { cellClass, cellTypes } from "./registry.js";

/**
 * @typedef {object} EditorCommand
 * @property {string} name - The name `runCommand` takes.
 * @property {string} label - As the user sees it.
 * @property {string} keys - Its shortcut, in the notation `Mod+Shift+Z`
 *   (`Mod` is Ctrl, or ⌘ on macOS), or "".
 * @property {string} group - "Document", or "While editing a cell".
 * @property {boolean} [cell] - A key of a cell's own text editor, not a
 *   command of the editor: listed for reference, `runCommand` does not take it.
 * @property {boolean} [changes] - Whether it changes the document (refused
 *   in read-only mode).
 */

const DOCUMENT = "Document";
const EDITING = "While editing a cell";

/** @type {EditorCommand[]} The commands before the `make-<type>` ones. */
const BEFORE = [
    { name: "edit", label: "Edit the selected cell", keys: "Enter", changes: true },
    { name: "insert-below", label: "Insert a cell below", keys: "Alt+Enter", changes: true },
    { name: "insert-above", label: "Insert a cell above", keys: "Alt+Shift+Enter", changes: true },
    { name: "move-up", label: "Move cells up", keys: "Alt+↑", changes: true },
    { name: "move-down", label: "Move cells down", keys: "Alt+↓", changes: true },
    { name: "delete", label: "Delete the selected cells", keys: "Delete", changes: true },
    { name: "cell-type", label: "Change the cell type…", keys: "Mod+/", changes: true },
    { name: "hide", label: "Hide the selected cells", keys: "", changes: true },
    { name: "unhide", label: "Unhide the cells in the selection", keys: "", changes: true },
    { name: "show-hidden", label: "Show or hide the hidden cells", keys: "" },
];

/** @type {EditorCommand[]} The commands after the `make-<type>` ones. */
const AFTER = [
    { name: "undo", label: "Undo", keys: "Mod+Z", changes: true },
    { name: "redo", label: "Redo", keys: "Mod+Shift+Z", changes: true },
    { name: "comments", label: "Show the cell's comments", keys: "Shift+F2" },
    { name: "errors", label: "Show the cell's errors", keys: "" },
    { name: "copy", label: "Copy cells", keys: "Mod+C" },
    { name: "cut", label: "Cut cells", keys: "Mod+X", changes: true },
    { name: "paste", label: "Paste cells", keys: "Mod+V", changes: true },
    { name: "commit", label: "Commit the edit", keys: "Mod+Enter", group: EDITING, changes: true },
    { name: "discard", label: "Discard the edit", keys: "Escape", group: EDITING },
    { name: "insert-tag", label: "Insert a formula tag", keys: "Mod+E", group: EDITING, cell: true },
    { name: "insert-comment", label: "Insert a cell comment", keys: "Shift+F2", group: EDITING, cell: true },
];

/** A cell type's key (`TexlCell.key`, not inherited) in the keys notation:
 * "t" is T, "T" is Shift+T. */
function typeKeys(type) {
    const cellType = cellClass(type);
    const key = cellType && Object.hasOwn(cellType, "key") ? cellType.key : "";
    if (/^[a-z]$/.test(key)) return key.toUpperCase();
    if (/^[A-Z]$/.test(key)) return `Shift+${key}`;
    return key;
}

/** The `make-<type>` command of a cell type. Its label is the type's
 * `commandLabel`, or else made from its `label`. */
function makeCommand(type) {
    const cellType = cellClass(type);
    const label = cellType?.commandLabel || `Change to ${cellType?.label || type} and edit`;
    return { name: `make-${type}`, label, keys: typeKeys(type), changes: true };
}

/**
 * The editor's commands, in the order a list shows them, with a
 * `make-<type>` command for every registered cell type.
 * @returns {EditorCommand[]}
 */
export function editorCommands() {
    return [...BEFORE, ...cellTypes().map(makeCommand), ...AFTER].map((command) => ({ group: DOCUMENT, ...command }));
}

/** Whether the command `name` changes the document. */
export function changesDocument(name) {
    return name.startsWith("make-") || !![...BEFORE, ...AFTER].find((command) => command.name === name)?.changes;
}
