import { html, css } from "lit";
import { MarkdownCell } from "./markdown-cell.js";
import { TAG_OPEN, TAG_CLOSE } from "../swan.js";

// A delimiter cell of the row under the header: `---`, `:--`, `--:`, `:-:`.
const DELIMITER = /^\s*(:?)-+(:?)\s*$/;

// Lines a table source may end with: blank lines and cell comments.
const TAIL = /^(\s*<!--\[[\s\S]*?\]-->)*\s*$/;

/**
 * Splits a source into lines, keeping a line break inside a tag in its
 * line, so a tag over several lines stays in one table row.
 * @param {string} source
 * @returns {string[]}
 */
function splitLines(source) {
    const lines = [];
    let line = "";
    for (let i = 0; i < source.length; i++) {
        if (source.startsWith(TAG_OPEN, i)) {
            const close = source.indexOf(TAG_CLOSE, i + TAG_OPEN.length);
            const end = close < 0 ? source.length : close + TAG_CLOSE.length;
            line += source.slice(i, end);
            i = end - 1;
        } else if (source[i] === "\n") {
            lines.push(line.replace(/\r$/, ""));
            line = "";
        } else line += source[i];
    }
    lines.push(line);
    return lines;
}

/**
 * Splits a table row into its cells: at the pipes outside tags that are
 * not escaped. Outside tags `\|` becomes `|`; tags are kept as written.
 * Returns null if the line is not a row (it must start with a pipe).
 * @param {string} line
 * @returns {string[] | null}
 */
function splitRow(line) {
    const text = line.trim();
    if (!text.startsWith("|")) return null;
    const cells = [];
    let cell = "";
    for (let i = 1; i < text.length; i++) {
        if (text.startsWith(TAG_OPEN, i)) {
            const close = text.indexOf(TAG_CLOSE, i + TAG_OPEN.length);
            const end = close < 0 ? text.length : close + TAG_CLOSE.length;
            cell += text.slice(i, end);
            i = end - 1;
        } else if (text.startsWith("\\|", i)) {
            cell += "|";
            i++;
        } else if (text[i] === "|") {
            cells.push(cell.trim());
            cell = "";
        } else cell += text[i];
    }
    if (cell.trim()) cells.push(cell.trim());
    return cells;
}

/** Escapes the pipes outside tags of a cell's text. */
function escapeCell(text) {
    let out = "";
    for (let i = 0; i < text.length; i++) {
        if (text.startsWith(TAG_OPEN, i)) {
            const close = text.indexOf(TAG_CLOSE, i + TAG_OPEN.length);
            const end = close < 0 ? text.length : close + TAG_CLOSE.length;
            out += text.slice(i, end);
            i = end - 1;
        } else out += text[i] === "|" ? "\\|" : text[i];
    }
    return out;
}

/**
 * @typedef {object} Table
 * @property {string[][]} rows The header row, then the body rows, all as
 *   long as the header.
 * @property {("left" | "right" | "center" | "")[]} align Per column.
 * @property {string} tail Blank lines and cell comments after the table.
 */

/**
 * Reads a Markdown pipe table, whose cells may hold tags. Returns null if
 * the source is not a table, followed only by blank lines and comments.
 * @param {string} source
 * @returns {Table | null}
 */
export function parseTable(source) {
    const lines = splitLines(source);
    const header = splitRow(lines[0] ?? "");
    const delimiters = splitRow(lines[1] ?? "");
    if (!header?.length || delimiters?.length !== header.length) return null;
    const align = [];
    for (const cell of delimiters) {
        const match = DELIMITER.exec(cell);
        if (!match) return null;
        align.push(match[1] && match[2] ? "center" : match[2] ? "right" : match[1] ? "left" : "");
    }
    const rows = [header];
    let i = 2;
    for (; i < lines.length; i++) {
        const row = splitRow(lines[i]);
        if (!row) break;
        rows.push(header.map((_, j) => row[j] ?? ""));
    }
    const tail = lines.slice(i).join("\n");
    if (!TAIL.test(tail)) return null;
    return { rows, align, tail };
}

/**
 * Writes a table as a Markdown pipe table, its columns lined up.
 * @param {Table} table
 * @returns {string}
 */
export function serializeTable({ rows, align, tail }) {
    const cells = rows.map((row) => row.map(escapeCell));
    const widths = align.map((_, j) => Math.max(3, ...cells.map((row) => row[j].length)));
    const line = (row) => "| " + row.map((cell, j) => cell.padEnd(widths[j])).join(" | ") + " |";
    const rule = (a, w) =>
        (a === "left" || a === "center" ? ":" : "-") + "-".repeat(w - 2) + (a === "right" || a === "center" ? ":" : "-");
    const lines = [line(cells[0]), "|" + align.map((a, j) => rule(a, widths[j] + 2)).join("|") + "|"];
    for (const row of cells.slice(1)) lines.push(line(row));
    return lines.join("\n") + (tail ? "\n" + tail : "");
}

/**
 * A table: a Markdown pipe table whose cells may hold tags, edited as a grid
 * where each cell has its own field, and shown as Markdown. The source stays
 * a plain Markdown table, so a `markdown` cell holding a table can change to
 * `table` and back without loss.
 *
 * In the grid, Tab and Shift+Tab move to the next and previous field (Tab
 * in the last one adds a row, as in Word), ↑/↓ to the field above and
 * below; the buttons above the grid insert and delete rows and columns. A
 * source that is not a table is edited as Markdown text.
 *
 * Proposal under test: how tables are stored is still open (see
 * docs/editor-design.md, O5 vs Swan data).
 */
export class TableCell extends MarkdownCell {
    static type = "table";

    static label = "Table";

    static icon = html`<svg viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M3 15h18" />
        <path d="M10 4v16" />
    </svg>`;

    static properties = {
        /** The table being edited, or null when the source is not a table. */
        _table: { state: true },
    };

    static styles = [
        MarkdownCell.styles,
        css`
            .grid-tools {
                display: flex;
                gap: 0.25rem;
                margin-bottom: 0.35rem;
            }
            .grid-tools button {
                font: inherit;
                font-size: 0.8rem;
                padding: 0.1rem 0.5rem;
                border: 1px solid var(--texl-line, #e4e6ea);
                border-radius: 4px;
                background: transparent;
                color: var(--texl-text-muted, #687085);
                cursor: pointer;
            }
            .grid-tools button:hover {
                color: var(--texl-accent, #2563eb);
                border-color: currentColor;
            }
            table.grid {
                border-collapse: collapse;
                width: 100%;
            }
            .grid td {
                border: 1px solid var(--texl-line, #e4e6ea);
                padding: 0;
            }
            .grid tr:first-child td {
                border-bottom: 1.5px solid var(--texl-rule, #1d2330);
            }
            .grid input {
                box-sizing: border-box;
                width: 100%;
                border: 0;
                padding: 0.2rem 0.4rem;
                font-family: var(--texl-mono, ui-monospace, monospace);
                font-size: 0.88em;
                background: transparent;
                color: inherit;
            }
            .grid tr:first-child input {
                font-weight: 600;
            }
            .grid input:focus {
                outline: 2px solid var(--texl-accent, #2563eb);
                outline-offset: -2px;
            }
        `,
    ];

    constructor() {
        super();
        this._table = null;
        /** The source read when editing started, and its table as text. */
        this._source = "";
        this._parsed = "";
        /** The field to focus after the next update: [row, column]. */
        this._focus = [0, 0];
    }

    fromTexl(texl) {
        super.fromTexl(texl);
        this._source = this.input;
        this._table = parseTable(this.input);
        this._parsed = JSON.stringify(this._table);
        this._focus = [0, 0];
    }

    toTexl() {
        // An unchanged table keeps its source as written
        if (this._table && JSON.stringify(this._table) !== this._parsed) this.input = serializeTable(this._table);
        else if (this._table) this.input = this._source;
        return super.toTexl();
    }

    updated(changed) {
        // The text editor only exists for a source that is not a table
        if (this.mode !== "edit" || !this._table) super.updated(changed);
        else if (changed.has("mode") || changed.has("_table")) this.focusEditor();
    }

    focusEditor() {
        if (!this._table) return super.focusEditor();
        const [row, col] = this._focus;
        this.renderRoot.querySelector(`input[data-row="${row}"][data-col="${col}"]`)?.focus();
    }

    renderEditor() {
        if (!this._table) return super.renderEditor();
        const { rows } = this._table;
        return html`<div class="grid-tools">
                <button @click=${() => this._insertRow()} title="Insert a row below">+ Row</button>
                <button @click=${() => this._insertColumn()} title="Insert a column to the right">+ Column</button>
                <button @click=${() => this._deleteRow()} title="Delete the row">− Row</button>
                <button @click=${() => this._deleteColumn()} title="Delete the column">− Column</button>
            </div>
            <table class="grid">
                ${rows.map(
                    (row, r) =>
                        html`<tr>
                            ${row.map(
                                (cell, c) =>
                                    html`<td>
                                        <input
                                            data-row=${r}
                                            data-col=${c}
                                            .value=${cell}
                                            @input=${(e) => this._setCell(r, c, e.target.value)}
                                            @focus=${() => (this._focus = [r, c])}
                                            @keydown=${(e) => this._onGridKeyDown(e, r, c)}
                                        />
                                    </td>`,
                            )}
                        </tr>`,
                )}
            </table>`;
    }

    _setCell(row, col, value) {
        // The rows are replaced, not changed in place, so the table compares
        // as changed; no new rendering is needed while typing
        const rows = this._table.rows.map((cells) => [...cells]);
        rows[row][col] = value;
        this._table.rows = rows;
    }

    _setTable(table, focus) {
        this._focus = focus;
        this._table = { ...this._table, ...table };
    }

    _insertRow(row = this._focus[0]) {
        const rows = [...this._table.rows];
        rows.splice(row + 1, 0, rows[0].map(() => ""));
        this._setTable({ rows }, [row + 1, this._focus[1]]);
    }

    _deleteRow() {
        const [row, col] = this._focus;
        // The header stays, and so does one body row
        if (row === 0 || this._table.rows.length <= 2) return;
        const rows = this._table.rows.filter((_, r) => r !== row);
        this._setTable({ rows }, [Math.min(row, rows.length - 1), col]);
    }

    _insertColumn() {
        const [row, col] = this._focus;
        const rows = this._table.rows.map((cells) => cells.toSpliced(col + 1, 0, ""));
        this._setTable({ rows, align: this._table.align.toSpliced(col + 1, 0, "") }, [row, col + 1]);
    }

    _deleteColumn() {
        const [row, col] = this._focus;
        if (this._table.align.length <= 1) return;
        const rows = this._table.rows.map((cells) => cells.toSpliced(col, 1));
        this._setTable({ rows, align: this._table.align.toSpliced(col, 1) }, [row, Math.min(col, rows[0].length - 1)]);
    }

    _onGridKeyDown(e, row, col) {
        const columns = this._table.align.length;
        const last = this._table.rows.length - 1;
        let target = null;
        if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const index = row * columns + col + (e.shiftKey ? -1 : 1);
            if (index > (last + 1) * columns - 1) {
                e.preventDefault();
                this._insertRow(last);
                this._focus = [last + 1, 0];
                return;
            }
            if (index >= 0) target = [Math.floor(index / columns), index % columns];
        } else if (e.key === "ArrowUp" && !e.shiftKey && !e.altKey && row > 0) target = [row - 1, col];
        else if (e.key === "ArrowDown" && !e.shiftKey && !e.altKey && row < last) target = [row + 1, col];
        if (!target) return;
        e.preventDefault();
        this._focus = target;
        this.focusEditor();
    }
}
