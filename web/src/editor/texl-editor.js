import { LitElement, css } from "lit";
import { html, unsafeStatic } from "lit/static-html.js";
import {
    parseDocument,
    serializeDocument,
    outputSpans,
    cellsFromSource,
    spanningTag,
    cellComments,
    nameCells,
    nameConflicts,
} from "./document.js";
import { cellTagName, cellClass, cellTypes } from "./registry.js";
import { createEngine } from "./engine.js";
import { findErrors, markErrors } from "./errors.js";
import { TexlCell } from "./texl-cell.js";

/** What an empty line below the document shows: an empty markdown cell. */
const EMPTY_LINE = { type: "markdown", texl: "" };

/** Says that a tag would run into a later cell (`spanningTag`). */
const spanMessage = ({ opens, reaches }) =>
    `The “<%” on line ${opens + 1} has no closing “%>”, so it would run into line ${reaches + 1}`;

/** Whether a cell looks like an empty line: an empty markdown or text cell. */
function isEmptyLine(cell) {
    return (cell.type === "markdown" || cell.type === "text") && !cell.texl;
}

/** The name of a cell type shown to the user. */
function typeLabel(type) {
    return cellClass(type)?.label || type;
}

/**
 * The key of a cell type (`TexlCell.key`), or "" if it has none. A subclass
 * does not inherit its parent's key.
 */
function typeKey(type) {
    const cellType = cellClass(type);
    return cellType && Object.hasOwn(cellType, "key") ? cellType.key : "";
}

/** The most changes that can be undone. */
const HISTORY_SIZE = 100;

/** Whether Ctrl, Cmd, Alt or Shift is held, apart from `allowed`. */
function hasModifier(e, ...allowed) {
    return ["ctrlKey", "metaKey", "altKey", "shiftKey"].some((key) => !allowed.includes(key) && e[key]);
}

/** Whether the command modifier is held: Ctrl, or Cmd on macOS. */
function isMod(e) {
    return e.ctrlKey || e.metaKey;
}

/**
 * The editor: a vertical stack of cells.
 *
 * Set `value` to the document text; read it back from `value` or from the
 * `change` event. Keyboard: ArrowUp/ArrowDown select a cell, Shift+ArrowUp/
 * ArrowDown (or Shift+click) several; Enter, Ctrl+Enter or F2 edits the
 * selected one; in edit mode Ctrl+Enter (Cmd+Enter on macOS) commits and
 * leaves, Escape discards the changes and leaves. Cells may handle keys
 * themselves and call `preventDefault()` to keep them from the editor.
 *
 * Outside edit mode (Mod is Ctrl, or Cmd on macOS):
 * - Alt+Enter or Insert inserts an empty cell below the selected ones,
 *   Alt+Shift+Enter above them;
 * - Alt+ArrowUp/ArrowDown moves the selected cells one line up or down;
 * - Delete or Backspace deletes the selected cells;
 * - Mod+C/X/V copy, cut and paste the selected cells: they handle the
 *   browser's clipboard events, so the clipboard holds the cells as Texl
 *   source with their markers, and pasted text replaces the selected cells;
 * - Mod+Z undoes the last change to the cells, Mod+Shift+Z or Mod+Y redoes
 *   it. While editing, these keys belong to the cell's own text editor;
 * - Mod+/ opens the menu of cell types for the selected cells, as the icon
 *   of a cell's type in the left margin does on a click. In the menu,
 *   ArrowUp/ArrowDown (or a type's first letter) pick a type, Enter changes
 *   the selected cells to it, Escape closes the menu. A type that does not
 *   accept the source of every selected cell (e.g. a table, for a cell
 *   that is not one) is greyed out, with the reason, and cannot be picked;
 * - Shift+F2 reports the comments of the selected line, as a click on its
 *   comment icon does (below), also when it has none;
 * - a type's key (`TexlCell.key`: "t" text, "m" Markdown, "T" table, "="
 *   formula) changes the selected line to that type and edits it; on a
 *   line that has the type already it edits it, as Enter does. If the type
 *   does not accept the line's source, nothing changes and the line shows
 *   why, as the menu does. Several selected lines: it acts on the last
 *   one selected, alone.
 *
 * The editor looks like a sheet of lined paper: each line is a cell. The
 * sheet has `rows` lines (100 by default), or more if the document has more
 * cells. Lines below the last cell are empty and not part of the document;
 * writing in one adds it to the document, together with empty cells for the
 * lines above it. Empty markdown or text cells at the end of the document
 * are dropped, as they look the same as the empty lines. The editor scrolls
 * its own lines: give it a height and it shows a scrollbar and keeps the
 * selected line in view.
 *
 * Two vertical lines (`--texl-margin-line`) rule a margin on each side of
 * the cells, as on legal paper, both `--texl-margin` wide. The left margin
 * (part `left-margin`) is for the editor's own objects about each line; it
 * shows the line number, 1, 2, 3, ..., also on the empty lines below the
 * document, as in Excel. The user knows cells by their line number; their
 * names, in the markers, are not shown (see below). Before the number, a discreet icon shows the cell's type (on the
 * empty lines, only under the mouse or when selected); a click on it opens
 * the menu of cell types. Changing the type keeps the cell's Texl source,
 * so it is offered only to the types that accept that source.
 * The right margin (part `right-margin`) is for the comments of a cell:
 * every cell comment (`<!--[ ... ]-->`) in its Texl source; other HTML
 * comments are ignored.
 * The margin shows a comment icon with their number; a click on it fires
 * `comments-click`, whose `detail` has the line number (`line`, from 1)
 * and the comments as strings (`comments`). Showing them is up to the page.
 * It also shows the errors of a cell: the undefined values its tags returned,
 * directly or as items of a tuple, which the cell highlights. The margin
 * shows a warning icon with their number. A click on it or on a highlighted
 * value fires `error-click`, whose `detail` has the line number (`line`, from
 * 1) and the error (`error`). The errors of the document are in `errors`;
 * `errors-change` is fired after every rendering, with the same list in
 * `detail.errors`. Showing them is up to the page.
 * When another line is selected, the editor fires `selection-change`, whose
 * `detail` has the selected line number (`line`, from 1).
 *
 * A page drives the editor with `runCommand(name)`, which does what a key
 * does (the names are in `commands`), and `select(line)`.
 *
 * Every cell with a marker has a name, unique in the document: the editor
 * gives one to cells without (new, or read without one), and new names to
 * pasted cells whose names are in use. Names edited by hand may clash: the
 * editor keeps them and fires `name-conflict`, whose `detail` has the
 * `conflicts`, each `{name, lines}`. It fires again only when the clashing
 * names change.
 *
 * After every change the whole document is rendered again as the document
 * at `url`, as any other Texl host renders it, and the rendering is split
 * into the outputs of the cells at their marker lines. Each cell sees the
 * names bound by the cells above; imports resolve against `url` and show
 * the current content of the imported documents. `url` may change at any
 * time: the editor renders again.
 */
export class TexlEditor extends LitElement {
    static properties = {
        url: { type: String },
        rows: { type: Number },
        _cells: { state: true },
        _outputs: { state: true },
        _errors: { state: true },
        _anchor: { state: true },
        _selected: { state: true },
        _editing: { state: true },
        _menu: { state: true },
        _menuItem: { state: true },
        _notice: { state: true },
    };

    static styles = css`
        :host {
            display: block;
            overflow-y: auto;
            outline: none;
            background: var(--texl-paper, #fff);
            border-top: 1px solid var(--texl-line, #e4e6ea);
        }
        /* One row per line: left margin, cell, right margin */
        .sheet {
            display: grid;
            grid-template-columns:
                var(--texl-margin, 6rem)
                minmax(0, 1fr)
                var(--texl-margin, 6rem);
        }
        .margin {
            box-sizing: border-box;
            min-width: 0;
            border-bottom: 1px solid var(--texl-line, #e4e6ea);
        }
        /* The type icon on the left, the line number on the right */
        .margin.left {
            position: relative;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            border-right: 1px solid var(--texl-margin-line, #7aa2f0);
            padding: 0.25rem 0.5rem 0.25rem 0.375rem;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 0.625rem;
            font-weight: normal;
            line-height: 1.5rem;
            /* The line number stays in the background, clearer on the
               selected lines or under the mouse */
            color: var(--texl-line-number, #c4c8cf);
            user-select: none;
        }
        .margin.left.selected,
        .margin.left:hover {
            color: var(--texl-line-number-active, #9aa0aa);
        }
        /* The number sits a little higher than the text, as before the icon */
        .line-number {
            margin: -0.1875rem 0 0 auto;
        }
        /* The type icon: as discreet as the line number, until pointed at */
        .type-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 1.5rem;
            height: 1.5rem;
            padding: 0;
            border: none;
            border-radius: 4px;
            background: none;
            color: inherit;
            cursor: pointer;
        }
        .type-button:hover,
        .type-button[aria-expanded="true"] {
            background: var(--texl-hover-bg, rgb(15 23 42 / 0.06));
            color: var(--texl-icon-active, #4b5563);
        }
        .margin.left.empty:not(:hover, .selected) .type-button:not([aria-expanded="true"]) {
            visibility: hidden;
        }
        svg {
            fill: none;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
        }
        .type-button svg {
            width: 0.875rem;
            height: 0.875rem;
        }
        /* The menu of cell types: a light card below the icon */
        .type-menu {
            position: absolute;
            top: calc(100% - 0.125rem);
            left: 0.25rem;
            z-index: 10;
            min-width: 11rem;
            margin: 0;
            padding: 0.25rem;
            list-style: none;
            border: 1px solid var(--texl-menu-border, rgb(15 23 42 / 0.08));
            border-radius: 8px;
            background: var(--texl-menu-bg, #fff);
            box-shadow:
                0 1px 2px rgb(15 23 42 / 0.06),
                0 8px 24px rgb(15 23 42 / 0.1);
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            font-size: 0.8125rem;
            line-height: 1.25rem;
            color: var(--texl-menu-text, #1f2937);
            animation: menu-in 0.12s ease-out;
        }
        @keyframes menu-in {
            from {
                opacity: 0;
                transform: translateY(-4px);
            }
        }
        .type-menu li {
            display: flex;
            align-items: center;
            gap: 0.625rem;
            padding: 0.3125rem 0.5rem;
            border-radius: 5px;
            cursor: pointer;
        }
        .type-menu li.active {
            background: var(--texl-menu-active-bg, rgb(37 99 235 / 0.08));
        }
        .type-menu li svg {
            flex: none;
            width: 1rem;
            height: 1rem;
            color: var(--texl-menu-icon, #6b7280);
        }
        .type-menu li.active svg {
            color: var(--texl-accent, #2563eb);
        }
        .type-menu .label {
            flex: 1;
        }
        /* A type the selected cells cannot change to */
        .type-menu li.disabled {
            cursor: default;
            color: var(--texl-text-muted, #687085);
        }
        .type-menu li.disabled svg {
            opacity: 0.5;
        }
        .type-menu .reason {
            font-size: 0.8em;
            white-space: nowrap;
        }
        /* A type's key, as shortcuts are shown in a desktop menu */
        .type-menu .key {
            min-width: 1.5em;
            font-family: inherit;
            font-size: 0.8em;
            text-align: right;
            color: var(--texl-text-muted, #687085);
        }
        /* A message at a line, e.g. why its type cannot change */
        .notice {
            position: absolute;
            top: calc(100% - 0.125rem);
            left: 0.25rem;
            z-index: 10;
            padding: 0.3125rem 0.625rem;
            border: 1px solid var(--texl-menu-border, rgb(15 23 42 / 0.08));
            border-radius: 8px;
            background: var(--texl-menu-bg, #fff);
            box-shadow:
                0 1px 2px rgb(15 23 42 / 0.06),
                0 8px 24px rgb(15 23 42 / 0.1);
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            font-size: 0.8125rem;
            line-height: 1.25rem;
            white-space: nowrap;
            color: var(--texl-menu-text, #1f2937);
            animation: menu-in 0.12s ease-out;
        }
        .type-menu .check {
            width: 0.875rem;
            height: 0.875rem;
            color: var(--texl-accent, #2563eb);
        }
        .margin.right {
            border-left: 1px solid var(--texl-margin-line, #7aa2f0);
            padding: 0.25rem 0.5rem;
        }
        .comment-count,
        .error-count {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            height: 1.5rem;
            padding: 0 0.25rem;
            border: none;
            border-radius: 4px;
            background: none;
            font: inherit;
            font-size: 0.8125rem;
            color: var(--texl-comment, #b7791f);
            cursor: pointer;
        }
        .error-count {
            color: var(--texl-error, #b91c1c);
        }
        .comment-count:hover,
        .error-count:hover {
            background: var(--texl-hover-bg, rgb(15 23 42 / 0.06));
        }
        .comment-count svg,
        .error-count svg {
            width: 1rem;
            height: 1rem;
        }
    `;

    constructor() {
        super();
        /** The URL of the document, resolved against the page. */
        this.url = "untitled.texl";
        this.rows = 100;
        this._cells = [];
        /** The clashing names last reported with `name-conflict`. */
        this._reportedConflicts = "";
        this._outputs = [];
        this._errors = [];
        /** The returned undefined values, as `ErrorPlace`s; a mark's index is its place here. */
        this._errorPlaces = [];
        /** The hover text of each marked error, for the cells. */
        this._errorMessages = [];
        this._anchor = 0;
        this._selected = 0;
        this._editing = -1;
        /** The Texl engine, as a promise, created on the first rendering. */
        this._engine = null;
        this._generation = 0;
        /** Earlier and undone states, as `{cells, anchor, selected}`. */
        this._undoStack = [];
        this._redoStack = [];
        /** The line whose menu of cell types is open, or -1. */
        this._menu = -1;
        /** The highlighted item of the menu, an index in `cellTypes()`. */
        this._menuItem = 0;
        /** A message shown at a line until the next key or press, as `{index, text}`, or null. */
        this._notice = null;
        /** Closes the menu on a press outside it and its icon. */
        this._onPointerDown = (e) => {
            this._notice = null;
            const path = e.composedPath();
            if (!path.some((node) => node.classList?.contains("type-menu") || node.classList?.contains("type-button")))
                this._closeMenu();
        };
        this.addEventListener("keydown", (e) => this._onKeyDown(e));
        for (const type of ["copy", "cut", "paste"]) this.addEventListener(type, (e) => this._onClipboard(e));
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
        document.addEventListener("pointerdown", this._onPointerDown, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener("pointerdown", this._onPointerDown, true);
        // Release the wasm memory; a rendering in progress keeps what it needs
        this._engine?.then((engine) => engine.free());
        this._engine = null;
    }

    willUpdate(changed) {
        // The first rendering follows `value`; later, a new URL renders again
        if (changed.has("url") && this.hasUpdated) this.rendered = this._renderCells();
    }

    /** The document text. */
    get value() {
        return serializeDocument(this._cells);
    }

    set value(source) {
        this._cells = nameCells(parseDocument(source ?? ""));
        this._reportedConflicts = "";
        this._checkNames();
        this._anchor = 0;
        this._selected = 0;
        this._editing = -1;
        this._menu = -1;
        this._notice = null;
        this._undoStack = [];
        this._redoStack = [];
        this.rendered = this._renderCells();
    }

    /** The errors of the document, as of the last rendering (`DocumentError`). */
    get errors() {
        return this._errors;
    }

    /** Resolves when the outputs of the current cells are rendered. */
    rendered = Promise.resolve();

    async _renderCells() {
        const generation = ++this._generation;
        const cells = this._cells;
        this._engine ??= createEngine();
        const engine = await this._engine;
        let doc = null;
        try {
            doc = await engine.render(this.url, serializeDocument(cells));
        } catch {
            // The URL cannot be resolved: the cells show no output
        }
        if (generation !== this._generation) return;
        const { errors, places } = doc ? findErrors(doc, cells) : { errors: [], places: [] };
        this._outputs = doc ? outputSpans(doc, cells).map((span) => markErrors(doc.text, places, span)) : [];
        this._errors = errors;
        this._errorPlaces = places;
        this._errorMessages = places.map(({ error }) => error.rootCause);
        this.dispatchEvent(new CustomEvent("errors-change", { detail: { errors }, bubbles: true, composed: true }));
    }

    _onKeyDown(e) {
        // Keys from children of the editor (put there by the page) are theirs
        if (e.defaultPrevented || e.target !== this) return;
        this._notice = null;
        if (this._menu >= 0) {
            this._onMenuKeyDown(e);
            return;
        }
        if (this._editing >= 0) {
            const commit = e.key === "Enter" && (e.ctrlKey || e.metaKey);
            if (commit || e.key === "Escape") {
                e.preventDefault();
                this._cellElement(this._editing)?.exitEdit(commit);
            }
            return;
        }
        const step = { ArrowUp: -1, ArrowDown: 1 }[e.key];
        let command;
        if (step && e.altKey && !hasModifier(e, "altKey")) command = step < 0 ? "move-up" : "move-down";
        else if (step && !hasModifier(e, "shiftKey")) this._select(this._selected + step, e.shiftKey);
        else if (e.key === "F2" && e.shiftKey && !hasModifier(e, "shiftKey")) command = "comments";
        else if (e.key === "Enter" && e.altKey && !hasModifier(e, "altKey", "shiftKey"))
            command = e.shiftKey ? "insert-above" : "insert-below";
        else if (e.key === "Enter" || e.key === "F2") command = "edit";
        // Ctrl+Insert, Shift+Insert and Shift+Delete are left to the browser:
        // they copy, paste and cut
        else if (e.key === "Insert" && !hasModifier(e)) command = "insert-below";
        else if ((e.key === "Delete" || e.key === "Backspace") && !hasModifier(e)) command = "delete";
        else if (isMod(e) && !e.altKey && e.key.toLowerCase() === "z") command = e.shiftKey ? "redo" : "undo";
        else if (isMod(e) && !hasModifier(e, "ctrlKey", "metaKey") && e.key.toLowerCase() === "y") command = "redo";
        // Shift is allowed: some layouts need it for "/"
        else if (isMod(e) && !e.altKey && e.key === "/") command = "cell-type";
        // Shift is allowed: "T" needs it, and so does "=" on some layouts
        else if (!hasModifier(e, "shiftKey") && this._typeOfKey(e.key)) command = `make-${this._typeOfKey(e.key)}`;
        else return;
        if (command) this._commands()[command]();
        e.preventDefault();
    }

    /** Whether a cell is in edit mode. Its edit is not in `value` until committed. */
    get editing() {
        return this._editing >= 0;
    }

    /**
     * The names of the commands that `runCommand` takes: the editor's own
     * actions, and `make-<type>` for every registered cell type.
     */
    get commands() {
        return Object.keys(this._commands());
    }

    /**
     * Runs the command `name` (see `commands`), as its key does. While a
     * cell is in edit mode only `commit` and `discard` run, and only then;
     * an open menu of cell types is closed first. Resolves to whether the
     * command ran: false if it does not apply now, e.g. `undo` with nothing
     * to undo, `move-up` on the first line, `make-table` on a line that is
     * not a table (which shows why, as the key does), or `commit` of an
     * edit the cell refuses. Rejects for an unknown name. `copy`, `cut`
     * and `paste` use the system clipboard (`navigator.clipboard`), which
     * the browser may refuse or ask the user about; they resolve to false
     * if it does.
     */
    async runCommand(name) {
        const command = this._commands()[name];
        if (!command) throw new Error(`Unknown editor command "${name}"`);
        const editOnly = name === "commit" || name === "discard";
        if ((this._editing >= 0) !== editOnly) return false;
        this._notice = null;
        if (name !== "cell-type") this._closeMenu();
        return (await command()) !== false;
    }

    /**
     * Selects line `line` (from 1), or the lines from the anchor to it with
     * `extend`, as a click on it does, and scrolls it into view. The line
     * is kept within the sheet. Does not take the focus.
     */
    select(line, extend = false) {
        this._notice = null;
        this._closeMenu();
        this._select(line - 1, extend);
    }

    /**
     * The commands by name, as functions that do what their key does and
     * return false when they do not apply (or a promise of it).
     */
    _commands() {
        const commands = {
            edit: () => this._rowCount() > 0 && this._edit(this._selected),
            // A refused edit stays in edit mode: the command did not apply
            commit: () => {
                this._cellElement(this._editing)?.exitEdit(true);
                return this._editing < 0;
            },
            discard: () => this._cellElement(this._editing)?.exitEdit(false),
            "insert-below": () => this._insertCell("below"),
            "insert-above": () => this._insertCell("above"),
            "move-up": () => this._moveCells(-1),
            "move-down": () => this._moveCells(1),
            delete: () => this._deleteCells(),
            copy: () => this._writeClipboard(),
            cut: async () => (await this._writeClipboard()) && this._deleteCells(),
            paste: () => this._readClipboard(),
            undo: () => this._undo("undo"),
            redo: () => this._undo("redo"),
            "cell-type": () => this._openMenu(this._selected),
            comments: () =>
                this._onCommentsClick(this._selected, cellComments((this._cells[this._selected] ?? EMPTY_LINE).texl)),
            errors: () => this._onErrorClick(this._selected, this._errorPlaces.find(({ line }) => line === this._selected + 1)),
        };
        for (const type of cellTypes()) commands[`make-${type}`] = () => this._editAs(type);
        return commands;
    }

    /** Copies the selected cells to the system clipboard; false if refused. */
    async _writeClipboard() {
        try {
            await navigator.clipboard.writeText(this._copiedText());
            return true;
        } catch {
            return false;
        }
    }

    /** Pastes the system clipboard over the selected cells; false if refused. */
    async _readClipboard() {
        let text;
        try {
            text = await navigator.clipboard.readText();
        } catch {
            return false;
        }
        return this._paste(text);
    }

    /** Keys while the menu of cell types is open: it takes them all. */
    _onMenuKeyDown(e) {
        const types = cellTypes();
        // The next type, from `from` by `step`, that the selected cells can take
        const next = (from, step, match = () => true) => {
            for (let i = 1; i <= types.length; i++) {
                const item = (from + i * step + types.length) % types.length;
                if (this._canSetType(types[item]) && match(types[item])) return item;
            }
            return this._menuItem;
        };
        const step = { ArrowUp: -1, ArrowDown: 1 }[e.key];
        if (step) this._menuItem = next(this._menuItem, step);
        else if (e.key === "Home") this._menuItem = next(-1, 1);
        else if (e.key === "End") this._menuItem = next(types.length, -1);
        else if (e.key === "Enter" || e.key === " ") this._setType(types[this._menuItem]);
        else if (e.key === "Escape" || e.key === "Tab") this._closeMenu();
        else if (e.key.length === 1 && !hasModifier(e, "shiftKey")) {
            // A letter picks the next type whose name starts with it
            const letter = e.key.toLowerCase();
            this._menuItem = next(this._menuItem, 1, (type) => typeLabel(type).toLowerCase().startsWith(letter));
        }
        e.preventDefault();
    }

    /**
     * Whether all the selected lines can change to `type`: it accepts the
     * source of each one that has another type.
     */
    _canSetType(type) {
        const cellType = cellClass(type);
        if (!cellType) return false;
        const [first, last] = this._range();
        for (let i = first; i <= Math.min(last, this._cells.length - 1); i++) {
            const cell = this._cells[i];
            if (cell.type !== type && !cellType.accepts(cell.texl)) return false;
        }
        return true;
    }

    /**
     * Opens the menu of cell types on line `index`, or closes it if it is
     * open there. The menu acts on the selected lines: a line outside the
     * selection is selected first.
     */
    _openMenu(index) {
        if (this._menu === index) {
            this._closeMenu();
            return;
        }
        const [first, last] = this._range();
        if (index < first || index > last) this._select(index);
        this._editing = -1;
        this._menu = index;
        // The line's type is highlighted, unless another selected cell cannot take it
        const type = (this._cells[index] ?? EMPTY_LINE).type;
        const types = cellTypes();
        this._menuItem = Math.max(0, types.indexOf(this._canSetType(type) ? type : types.find((t) => this._canSetType(t))));
        this.focus();
    }

    _closeMenu() {
        this._menu = -1;
    }

    /** Why the selected lines cannot change to `type`, or "" if they can. */
    _typeRefusal(type) {
        return this._canSetType(type) ? "" : `Needs ${cellClass(type).needs}`;
    }

    /** The cell type whose key is `key`, or undefined. */
    _typeOfKey(key) {
        return key ? cellTypes().find((type) => typeKey(type) === key) : undefined;
    }

    /**
     * Changes the selected line, alone, to `type` and edits it; if the type
     * does not accept its source, shows why at the line instead.
     */
    _editAs(type) {
        const index = this._selected;
        this._select(index);
        const refusal = this._typeRefusal(type);
        if (refusal) {
            this._notice = { index, text: refusal };
            return false;
        }
        this._setType(type);
        this._edit(index);
    }

    /**
     * Changes the selected cells to `type`, keeping their Texl source, and
     * closes the menu. Selected lines below the document are added to it.
     * Nothing changes if the type does not accept a cell's source.
     */
    _setType(type) {
        if (!this._canSetType(type)) return;
        this._closeMenu();
        this.focus();
        const [first, last] = this._range();
        const cells = [...this._cells];
        while (cells.length <= last) cells.push({ ...EMPTY_LINE });
        let changed = false;
        for (let i = first; i <= last; i++) {
            if (cells[i].type === type) continue;
            // The type must be written: the cell needs a marker
            const { marker, ...cell } = cells[i];
            cells[i] = { ...cell, type };
            // An empty markdown or text line below the document stays empty
            if (i < this._cells.length || !isEmptyLine(cells[i])) changed = true;
        }
        if (changed) this._setCells(cells);
    }

    /** The first and last selected lines: from the anchor to `_selected`. */
    _range() {
        return [Math.min(this._anchor, this._selected), Math.max(this._anchor, this._selected)];
    }

    /** Selects line `index`; with `extend`, the lines from the anchor to it. */
    _select(index, extend = false) {
        this._selected = Math.max(0, Math.min(index, this._rowCount() - 1));
        if (!extend) this._anchor = this._selected;
    }

    /** Selects line `index` alone and edits it. */
    _edit(index) {
        this._closeMenu();
        this._select(index);
        this._editing = index;
    }

    /** Copies, cuts or pastes the selected cells, outside edit mode. */
    _onClipboard(e) {
        // Leave text selected with the mouse to the browser
        if (this._editing >= 0 || !e.clipboardData || e.target !== this || document.getSelection()?.toString())
            return;
        e.preventDefault();
        if (e.type === "paste") this._paste(e.clipboardData.getData("text/plain"));
        else {
            e.clipboardData.setData("text/plain", this._copiedText());
            if (e.type === "cut") this._deleteCells();
        }
    }

    /** The selected cells as Texl source, without their marker flags. */
    _copiedText() {
        const [first, last] = this._range();
        // Lines below the document are left out, unless only they are selected
        const copied = this._cells.slice(first, last + 1);
        const cells = (copied.length > 0 ? copied : [EMPTY_LINE]).map(({ marker, ...cell }) => cell);
        return serializeDocument(cells);
    }

    /** Replaces the selected cells with the cells of `text`; false if it has none. */
    _paste(text) {
        const [first, last] = this._range();
        const parsed = parseDocument(text);
        if (parsed.length === 0) return false;
        const pasted = this._withFreeNames(parsed, first, last);
        if (!this._spliceCells(first, last - first + 1, pasted)) return;
        this._select(first);
        this._select(first + pasted.length - 1, true);
    }

    /**
     * Gives new names to the cells whose names are in use (e.g. copied ones)
     * outside lines `first` to `last`, which they will replace.
     */
    _withFreeNames(cells, first, last) {
        const taken = new Set(
            this._cells.filter((_, i) => i < first || i > last).map((cell) => cell.name?.toLowerCase()),
        );
        return nameCells(
            cells.map(({ name, ...cell }) => {
                if (!name || taken.has(name.toLowerCase())) return cell;
                taken.add(name.toLowerCase());
                return { ...cell, name };
            }),
            taken,
        );
    }

    _deleteCells() {
        const [first, last] = this._range();
        if (first < this._cells.length) this._spliceCells(first, last - first + 1);
        this._select(first);
    }

    /** Inserts an empty cell above or below the selected ones and selects it. */
    _insertCell(where) {
        const [first, last] = this._range();
        const index = where === "below" ? last + 1 : first;
        // Below the document all lines are empty already: only move there
        if (index < this._cells.length) this._spliceCells(index, 0, [{ ...EMPTY_LINE }]);
        this._select(index);
    }

    /** Moves the selected cells one line up (`step` -1) or down (1). */
    _moveCells(step) {
        const [first, last] = this._range();
        if (first + step < 0 || last + step >= this._rowCount()) return false;
        // Below the document all lines are empty: only the selection moves
        if (first < this._cells.length) {
            const cells = [...this._cells];
            while (cells.length <= last + Math.max(step, 0)) cells.push({ ...EMPTY_LINE });
            cells.splice(first + step, 0, ...cells.splice(first, last - first + 1));
            if (!this._setCells(cells)) return false;
        }
        this._anchor += step;
        this._selected += step;
    }

    /** The number of lines on the sheet. */
    _rowCount() {
        return Math.max(this.rows, this._cells.length);
    }

    /** Undoes the last change to the cells, or redoes the last undone one. */
    _undo(direction) {
        const [from, to] = direction === "undo" ? [this._undoStack, this._redoStack] : [this._redoStack, this._undoStack];
        const state = from.pop();
        if (!state) return false;
        to.push(this._state());
        this._cells = state.cells;
        this._checkNames();
        this._select(state.anchor);
        this._select(state.selected, true);
        this.rendered = this._renderCells();
        this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    /** The cells and the selection, as kept for undo. */
    _state() {
        return { cells: this._cells, anchor: this._anchor, selected: this._selected };
    }

    _onCellChange(index, texl) {
        const cell = this._cells[index];
        this._spliceCells(index, cell ? 1 : 0, this._cellsAfterEdit(index, texl));
    }

    /** The cells that line `index` becomes with a new source. */
    _cellsAfterEdit(index, texl) {
        const cell = this._cells[index] ?? EMPTY_LINE;
        const [first, ...rest] = cellsFromSource(cell, texl);
        if (rest.length === 0 && first.name === cell.name) return [first];
        return this._withFreeNames([first, ...rest], index, index);
    }

    /**
     * Why line `index` cannot take a new source: a tag left open would run
     * into a later cell. An empty string if it can.
     */
    _commitError(index, texl) {
        const cells = [...this._cells];
        while (cells.length < index) cells.push({ ...EMPTY_LINE });
        cells.splice(index, this._cells[index] ? 1 : 0, ...this._cellsAfterEdit(index, texl));
        const span = spanningTag(cells);
        return span ? `${spanMessage(span)}: correct it, or press Escape to discard the changes.` : "";
    }

    /**
     * Changes the cells as `Array.prototype.splice`. Empty cells fill the
     * lines between the document and `index`, if it is below the document.
     * Returns whether the change was made (see `_setCells`).
     */
    _spliceCells(index, count, inserted = []) {
        const cells = [...this._cells];
        while (cells.length < index) cells.push({ ...EMPTY_LINE });
        cells.splice(index, count, ...inserted);
        return this._setCells(cells);
    }

    /**
     * Replaces the cells, keeping the old ones for undo; renders and reports
     * them. Refuses cells where a tag would run into a later cell, which would
     * read differently when the document is opened again: it shows why, and
     * returns false.
     */
    _setCells(cells) {
        const span = spanningTag(cells);
        if (span) {
            this._notice = { index: this._selected, text: `${spanMessage(span)}.` };
            return false;
        }
        this._undoStack = [...this._undoStack, this._state()].slice(-HISTORY_SIZE);
        this._redoStack = [];
        // Empty cells at the end look like the empty lines below: drop them
        while (cells.length > 0 && isEmptyLine(cells.at(-1))) cells = cells.slice(0, -1);
        // Only the first cell may go without marker; the others need one
        // and every cell with a marker needs a name
        this._cells = nameCells(
            cells.map(({ marker, ...cell }, i) => (i === 0 && marker === false ? { ...cell, marker } : cell)),
        );
        this._checkNames();
        this._anchor = Math.min(this._anchor, this._rowCount() - 1);
        this._select(this._selected, true);
        this.rendered = this._renderCells();
        this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        return true;
    }

    /**
     * Fires `name-conflict` if cells share a name, unless the same names
     * were already reported. The editor leaves the names as they are.
     */
    _checkNames() {
        const conflicts = nameConflicts(this._cells);
        const key = conflicts.map(({ name }) => name.toLowerCase()).join(" ");
        if (key === this._reportedConflicts) return;
        this._reportedConflicts = key;
        if (conflicts.length > 0)
            this.dispatchEvent(new CustomEvent("name-conflict", { detail: { conflicts }, bubbles: true, composed: true }));
    }

    _onCellExit() {
        this._editing = -1;
        this.focus();
    }

    updated(changed) {
        // Keep the selected line in view while moving with the keys
        if (changed.has("_selected")) {
            this._cellElement(this._selected)?.scrollIntoView({ block: "nearest" });
            const line = this._selected + 1;
            this.dispatchEvent(new CustomEvent("selection-change", { detail: { line }, bubbles: true, composed: true }));
        }
        if (changed.has("_menu")) this.renderRoot.querySelector(".type-menu")?.scrollIntoView({ block: "nearest" });
    }

    /** Selects line `index` and reports its `comments` with `comments-click`. */
    _onCommentsClick(index, comments) {
        this._select(index);
        this.focus();
        this.dispatchEvent(
            new CustomEvent("comments-click", { detail: { line: index + 1, comments }, bubbles: true, composed: true }),
        );
    }

    /** Selects line `index` and reports the error of `place` (may be none) with `error-click`. */
    _onErrorClick(index, place) {
        this._select(index);
        this.focus();
        this.dispatchEvent(
            new CustomEvent("error-click", {
                detail: { line: index + 1, error: place?.error ?? null },
                bubbles: true,
                composed: true,
            }),
        );
    }

    /** A click on line `index`'s cell selects it; on a highlighted value, also reports that error. */
    _onCellClick(index, e) {
        this._select(index, e.shiftKey);
        if (e.shiftKey) return;
        const value = e.composedPath().find((node) => node.classList?.contains("undefined-value"));
        const place = this._errorPlaces[value?.dataset.error];
        if (place) this._onErrorClick(index, place);
    }

    /** A warning icon with the number of errors of line `index`, or nothing. */
    _renderErrorCount(index) {
        const places = this._errorPlaces.filter(({ line }) => line === index + 1);
        if (places.length === 0) return "";
        const label = places.length === 1 ? "1 error" : `${places.length} errors`;
        return html`<button
            class="error-count"
            type="button"
            tabindex="-1"
            title=${label}
            aria-label=${label}
            @mousedown=${(e) => e.preventDefault()}
            @click=${() => this._onErrorClick(index, places[0])}
        >
            <svg viewBox="0 0 24 24">
                <path d="M12 4 3 20h18z" />
                <path d="M12 10v4" />
                <path d="M12 17h.01" /></svg
            >${places.length}
        </button>`;
    }

    /** A comment icon with the number of `comments` of line `index`, or nothing. */
    _renderCommentCount(index, comments) {
        if (comments.length === 0) return "";
        const label = comments.length === 1 ? "1 comment" : `${comments.length} comments`;
        return html`<button
            class="comment-count"
            type="button"
            tabindex="-1"
            title=${label}
            aria-label=${label}
            @mousedown=${(e) => e.preventDefault()}
            @click=${() => this._onCommentsClick(index, comments)}
        >
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>${comments.length}
        </button>`;
    }

    /** The icon of line `index`'s cell type, which opens the menu of types. */
    _renderTypeButton(index, type) {
        const cellType = cellClass(type);
        const label = cellType ? typeLabel(type) : `${type} (unknown type)`;
        const open = this._menu === index;
        return html`<button
                class="type-button"
                type="button"
                tabindex="-1"
                title=${label}
                aria-label="Cell type: ${label}"
                aria-haspopup="menu"
                aria-expanded=${open ? "true" : "false"}
                @mousedown=${(e) => e.preventDefault()}
                @click=${(e) => {
                    e.stopPropagation();
                    this._openMenu(index);
                }}
            >
                ${(cellType ?? TexlCell).icon}
            </button>
            ${open ? this._renderMenu(type) : ""}`;
    }

    /** The menu of cell types, with `current` checked. */
    _renderMenu(current) {
        const items = cellTypes().map((type, i) => {
            const reason = this._typeRefusal(type);
            const enabled = !reason;
            const key = typeKey(type);
            return html`<li
                role="menuitemradio"
                aria-checked=${type === current ? "true" : "false"}
                aria-disabled=${enabled ? "false" : "true"}
                title=${reason}
                class=${[i === this._menuItem ? "active" : "", enabled ? "" : "disabled"].join(" ")}
                @pointerenter=${() => enabled && (this._menuItem = i)}
                @click=${() => this._setType(type)}
            >
                ${cellClass(type).icon}
                <span class="label">${typeLabel(type)}</span>
                ${reason ? html`<span class="reason">${reason}</span>` : ""}
                ${key ? html`<kbd class="key">${key}</kbd>` : ""}
                ${type === current
                    ? html`<svg class="check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>`
                    : ""}
            </li>`;
        });
        return html`<ul class="type-menu" role="menu" aria-label="Cell type" @click=${(e) => e.stopPropagation()}>
            ${items}
        </ul>`;
    }

    _cellElement(index) {
        return this.renderRoot.querySelector(`[data-index="${index}"]`);
    }

    render() {
        const [first, last] = this._range();
        const rows = Array.from({ length: this._rowCount() }, (_, i) => {
            const cell = this._cells[i] ?? EMPTY_LINE;
            const tag = unsafeStatic(cellTagName(cell.type));
            const classes = [i >= first && i <= last ? "selected" : "", i >= this._cells.length ? "empty" : ""].join(" ");
            return html`<div class="margin left ${classes}" part="left-margin" @click=${(e) => this._select(i, e.shiftKey)}>
                    ${this._renderTypeButton(i, cell.type)}<span class="line-number">${i + 1}</span>
                    ${this._notice?.index === i
                        ? html`<div class="notice" role="alert">${this._notice.text}</div>`
                        : ""}
                </div>
                <${tag}
                data-index=${i}
                .texl=${cell.texl}
                .output=${this._outputs[i] ?? ""}
                .errorMessages=${this._errorMessages}
                .mode=${i === this._editing ? "edit" : "render"}
                .selected=${i >= first && i <= last}
                @click=${(e) => this._onCellClick(i, e)}
                @dblclick=${() => this._edit(i)}
                .commitError=${(texl) => this._commitError(i, texl)}
                @cell-change=${(e) => this._onCellChange(i, e.detail.texl)}
                @cell-exit=${() => this._onCellExit()}
            ></${tag}>
                <div class="margin right" part="right-margin">
                    ${this._renderErrorCount(i)}${this._renderCommentCount(i, cellComments(cell.texl))}
                </div>`;
        });
        return html`<div class="sheet">${rows}</div>`;
    }
}
