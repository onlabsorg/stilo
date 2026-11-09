import { html, css } from "lit";
import { GridCell } from "./grid-cell.js";
import { TAG_OPEN, TAG_CLOSE } from "../swan.js";
import { isBlank } from "../document.js";

// A delimiter cell of the row under the header: `---`, `:--`, `--:`, `:-:`.
const DELIMITER = /^\s*(:?)-+(:?)\s*$/;

// HTML comments, cell comments among them.
const COMMENT = /<!--[\s\S]*?-->/g;

/**
 * The end of the tag or HTML comment that starts at `i` in `text`, or -1
 * if none starts there. Pipes and line breaks inside them do not count.
 * @param {string} text
 * @param {number} i
 * @returns {number}
 */
function atomEnd(text, i) {
    for (const [open, close] of [
        [TAG_OPEN, TAG_CLOSE],
        ["<!--", "-->"],
    ]) {
        if (!text.startsWith(open, i)) continue;
        const end = text.indexOf(close, i + open.length);
        return end < 0 ? text.length : end + close.length;
    }
    return -1;
}

/** Joins the parts of a cell's text that are not empty with a space. */
const joinText = (...parts) => parts.filter(Boolean).join(" ");

/**
 * Splits a source into lines, keeping a line break inside a tag or a
 * comment in its line, so a tag over several lines stays in one table row.
 * @param {string} source
 * @returns {string[]}
 */
function splitLines(source) {
    const lines = [];
    let line = "";
    for (let i = 0; i < source.length; i++) {
        const end = atomEnd(source, i);
        if (end >= 0) {
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
 * Splits a table row into its cells: at the pipes outside tags and
 * comments that are not escaped. Outside them `\|` becomes `|`; tags and
 * comments are kept as written. Comments before the first pipe go to the
 * first cell, and after the last pipe to the last cell. Returns null if
 * the line is not a row (it must start with a pipe, after any comments).
 * @param {string} line
 * @returns {string[] | null}
 */
function splitRow(line) {
    const [lead] = /^(\s*<!--[\s\S]*?-->)*\s*/.exec(line);
    const text = line.slice(lead.length).trimEnd();
    if (!text.startsWith("|")) return null;
    const cells = [];
    let cell = "";
    for (let i = 1; i < text.length; i++) {
        const end = atomEnd(text, i);
        if (end >= 0) {
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
    const rest = cell.trim();
    if (rest && isBlank(rest) && cells.length > 0) cells.push(joinText(cells.pop(), rest));
    else if (rest) cells.push(rest);
    if (lead.trim()) cells[0] = joinText(lead.trim(), cells[0]);
    return cells;
}

/** Escapes the pipes outside tags and comments of a cell's text. */
function escapeCell(text) {
    let out = "";
    for (let i = 0; i < text.length; i++) {
        const end = atomEnd(text, i);
        if (end >= 0) {
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
 * @property {string} [head] Blank lines and comments before the table,
 *   each line with its line break.
 * @property {string} tail Blank lines and comments after the table.
 */

/**
 * Reads a Markdown pipe table, whose cells may hold tags. Returns null if
 * the source is not a table, with only blank lines and comments (HTML or
 * cell comments) before and after it. Comments in a row stay in its cells;
 * comments in the delimiter row go to the header cells above them.
 * @param {string} source
 * @returns {Table | null}
 */
export function parseTable(source) {
    const lines = splitLines(source);
    let first = 0;
    while (first < lines.length && isBlank(lines[first])) first++;
    const head = lines
        .slice(0, first)
        .map((line) => line + "\n")
        .join("");
    const header = splitRow(lines[first] ?? "");
    const delimiters = splitRow(lines[first + 1] ?? "");
    if (!header?.length || delimiters?.length !== header.length) return null;
    const align = [];
    for (const [j, cell] of delimiters.entries()) {
        const match = DELIMITER.exec(cell.replace(COMMENT, ""));
        if (!match) return null;
        align.push(match[1] && match[2] ? "center" : match[2] ? "right" : match[1] ? "left" : "");
        header[j] = joinText(header[j], ...(cell.match(COMMENT) ?? []));
    }
    const rows = [header];
    let i = first + 2;
    for (; i < lines.length; i++) {
        const row = splitRow(lines[i]);
        if (!row) break;
        rows.push(header.map((_, j) => row[j] ?? ""));
    }
    const tail = lines.slice(i).join("\n");
    if (!isBlank(tail)) return null;
    return { rows, align, head, tail };
}

/**
 * A new, empty table of two columns, a header and a body row, after
 * `source`: a source with only blank lines and comments.
 * @param {string} source
 * @returns {Table}
 */
function newTable(source) {
    const head = source.trimEnd();
    return {
        rows: [
            ["", ""],
            ["", ""],
        ],
        align: ["", ""],
        head: head ? head + "\n" : "",
        tail: "",
    };
}

/**
 * Writes a table as a Markdown pipe table, its columns lined up.
 * @param {Table} table
 * @returns {string}
 */
export function serializeTable({ rows, align, head = "", tail }) {
    const cells = rows.map((row) => row.map(escapeCell));
    const widths = align.map((_, j) => Math.max(3, ...cells.map((row) => row[j].length)));
    const line = (row) => "| " + row.map((cell, j) => cell.padEnd(widths[j])).join(" | ") + " |";
    const rule = (a, w) =>
        (a === "left" || a === "center" ? ":" : "-") + "-".repeat(w - 2) + (a === "right" || a === "center" ? ":" : "-");
    const lines = [line(cells[0]), "|" + align.map((a, j) => rule(a, widths[j] + 2)).join("|") + "|"];
    for (const row of cells.slice(1)) lines.push(line(row));
    return head + lines.join("\n") + (tail ? "\n" + tail : "");
}

/** The alignment buttons: value, tooltip, icon (lines aligned as the text). */
const ALIGNMENTS = [
    ["left", "Align the column left", html`<svg viewBox="0 0 24 24"><path d="M4 6h16M4 10h10M4 14h16M4 18h10" /></svg>`],
    ["center", "Centre the column", html`<svg viewBox="0 0 24 24"><path d="M4 6h16M7 10h10M4 14h16M7 18h10" /></svg>`],
    ["right", "Align the column right", html`<svg viewBox="0 0 24 24"><path d="M4 6h16M10 10h10M4 14h16M10 18h10" /></svg>`],
];

/**
 * A table: a Markdown pipe table whose cells may hold tags, edited as a grid
 * where each cell has its own field (`GridCell`), and shown as Markdown. The
 * source stays a plain Markdown table, so a `markdown` cell holding a table
 * can change to `table` and back without loss.
 *
 * Besides the grid's buttons, three buttons align the column of the current
 * field left, centred or right (as the `:` of its delimiter, `:--`, `:-:`,
 * `--:`); a column without alignment counts as left. An empty source (blank
 * lines and comments only) starts a new table.
 *
 * The type accepts only a table or an empty source, with blank lines and
 * comments around it; a source that is not a table (e.g. edited by hand)
 * is edited as Markdown text, and must be a table to be committed.
 *
 * Each field holds its table cell's Texl source, with formulas between
 * `<% %>` as anywhere else; the cell shows the rendered table outside edit
 * mode. Table cells cannot refer to each other (docs/editor-design.md, O5).
 */
export class TableCell extends GridCell {
    static type = "table";

    static label = "Table";

    static key = "T";

    static icon = html`<svg viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M3 15h18" />
        <path d="M10 4v16" />
    </svg>`;

    static needs = "a table";

    static accepts(source) {
        return isBlank(source) || parseTable(source) !== null;
    }

    static styles = [
        GridCell.styles,
        css`
            .grid-tools .align {
                display: flex;
                margin-left: 0.5rem;
            }
            .grid-tools .align button {
                display: flex;
                align-items: center;
                padding: 0.1rem 0.3rem;
                border-radius: 0;
            }
            .grid-tools .align button:first-child {
                border-radius: 4px 0 0 4px;
            }
            .grid-tools .align button:last-child {
                border-radius: 0 4px 4px 0;
            }
            .grid-tools .align button + button {
                margin-left: -1px;
            }
            .grid-tools .align button[aria-pressed="true"] {
                color: var(--texl-accent, #2563eb);
                background: var(--texl-edit-bg, #f8f9fb);
                border-color: currentColor;
                position: relative;
            }
            .grid-tools .align svg {
                width: 1rem;
                height: 1rem;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
            }
            .grid input.center {
                text-align: center;
            }
            .grid input.right {
                text-align: right;
            }
        `,
    ];

    constructor() {
        super();
        /** The source read when editing started, and its table as text. */
        this._source = "";
        this._parsed = "";
    }

    fromTexl(texl) {
        super.fromTexl(texl);
        this._source = this.input;
        this._grid = parseTable(this.input) ?? (isBlank(this.input) ? newTable(this.input) : null);
        this._parsed = JSON.stringify(this._grid);
        this._focus = [0, 0];
    }

    toTexl() {
        // An unchanged table keeps its source as written
        if (this._grid && JSON.stringify(this._grid) !== this._parsed) this.input = serializeTable(this._grid);
        else if (this._grid) this.input = this._source;
        return super.toTexl();
    }

    renderEditor() {
        if (!this._grid) return super.renderEditor();
        const current = this._grid.align[this._focus[1]] || "left";
        return html`<div class="grid-tools">
                ${this._renderRowColumnButtons()}
                <div class="align" role="group" aria-label="Column alignment">
                    ${ALIGNMENTS.map(
                        ([value, title, icon]) =>
                            html`<button
                                data-align=${value}
                                title=${title}
                                aria-pressed=${current === value ? "true" : "false"}
                                @mousedown=${(e) => e.preventDefault()}
                                @click=${() => this._alignColumn(value)}
                            >
                                ${icon}
                            </button>`,
                    )}
                </div>
            </div>
            ${this._renderGrid()}`;
    }

    _fieldClass(row, col) {
        return this._grid.align[col] || "left";
    }

    /**
     * Aligns the column of the current field. A column without alignment
     * already counts as left, so it keeps its delimiter (`---`) when set to
     * left.
     * @param {"left" | "center" | "right"} value
     */
    _alignColumn(value) {
        const [row, col] = this._focus;
        if ((this._grid.align[col] || "left") === value) return this.focusEditor();
        this._setGrid({ align: this._grid.align.with(col, value) }, [row, col]);
    }
}
