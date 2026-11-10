import { html, css } from "lit";
import { GridCell } from "./grid-cell.js";
import { parseFormula, serializeFormula } from "./formula-cell.js";
import { TAG_CLOSE } from "../swan.js";
import { isBlank } from "../document.js";
import { expressionError } from "../expression.js";

/** The import path of the Stilo library, in a project (docs/projects.md). */
export const STILO_LIBRARY = "~/lib/stilo/index.texl";

/** The tag that imports the Stilo library and binds it as `stilo`. */
export const STILO_IMPORT = `<% texl.import "${STILO_LIBRARY}" ~> (lib -> bind "stilo" lib.data.stilo) %>`;

/** A Swan name, as the lexer reads one. */
const NAME = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const NAME_AT = /[\p{L}_][\p{L}\p{N}_]*/uy;

/**
 * @typedef {object} Data
 * @property {string} before White space and comments before the tag.
 * @property {string} after White space and comments after the tag.
 * @property {string} name The name the dataframe is labelled with, or "".
 * @property {string[]} columns The column names.
 * @property {string[][]} rows The entries of each row, as Swan source, one
 *   per column; "" for an empty entry (`""` in the source).
 */

/** Thrown by the reader of a source that is not a data table. */
const NOT_DATA = Symbol("not data");

/**
 * Reads a data table: one tag holding `name: stilo.dataframe {columns:
 * [...], rows: [[...], ...]}` (the name and its colon are optional), with
 * white space and HTML comments around the tag. The column names must be
 * texts; each entry is kept as its Swan source. Returns null for anything
 * else: other members, comments inside the tag, an empty entry, no columns,
 * or a row longer than the columns. Shorter rows are padded with "".
 * @param {string} source
 * @returns {Data | null}
 */
export function parseData(source) {
    const formula = parseFormula(source);
    if (!formula || formula.body === null) return null;
    const s = formula.body;
    let i = 0;
    const fail = () => {
        throw NOT_DATA;
    };
    const space = () => {
        while (i < s.length && /\s/.test(s[i])) i++;
    };
    const name = () => {
        space();
        NAME_AT.lastIndex = i;
        const match = NAME_AT.exec(s);
        if (match) i = NAME_AT.lastIndex;
        return match?.[0] ?? "";
    };
    const expect = (text) => {
        space();
        if (!s.startsWith(text, i)) fail();
        i += text.length;
    };
    const word = (text) => name() === text || fail();
    // One entry: Swan source up to a comma or `]` outside brackets and texts
    const entry = () => {
        const from = i;
        let depth = 0;
        for (; i < s.length; i++) {
            const c = s[i];
            if (c === '"') {
                const close = s.indexOf('"', i + 1);
                if (close < 0) fail();
                i = close;
            } else if (c === "#") fail();
            else if ("([{".includes(c)) depth++;
            else if (")]}".includes(c)) {
                if (depth === 0) {
                    if (c === "]") break;
                    fail();
                }
                depth--;
            } else if (c === "," && depth === 0) break;
        }
        const text = s.slice(from, i).trim();
        if (i >= s.length || !text) fail();
        return text;
    };
    const list = () => {
        expect("[");
        space();
        if (s[i] === "]") {
            i++;
            return [];
        }
        const items = [];
        for (;;) {
            items.push(entry());
            if (s[i++] === "]") return items;
        }
    };
    try {
        const start = i;
        let label = name();
        space();
        if (label && s[i] === ":") i++;
        else {
            label = "";
            i = start;
        }
        word("stilo");
        expect(".");
        word("dataframe");
        expect("{");
        word("columns");
        expect(":");
        const columns = list().map((column) => (/^"[^"]*"$/.test(column) ? column.slice(1, -1) : fail()));
        if (columns.length === 0) fail();
        expect(",");
        word("rows");
        expect(":");
        expect("[");
        space();
        const rows = [];
        if (s[i] === "]") i++;
        else
            for (;;) {
                const row = list().map((value) => (value === '""' ? "" : value));
                if (row.length > columns.length) fail();
                rows.push(columns.map((_, j) => row[j] ?? ""));
                space();
                if (s[i++] === "]") break;
                if (s[i - 1] !== ",") fail();
            }
        expect("}");
        space();
        if (i < s.length) fail();
        return { before: formula.before, after: formula.after, name: label, columns, rows };
    } catch (e) {
        if (e === NOT_DATA) return null;
        throw e;
    }
}

/**
 * Writes a data table back as a source: one row per line, an empty entry as
 * `""`.
 * @param {Data} data
 * @returns {string}
 */
export function serializeData({ before, after, name, columns, rows }) {
    const entry = (value) => value.trim() || '""';
    const lines = rows.map((row) => "        [" + row.map(entry).join(", ") + "]");
    const body =
        ` ${name ? name + ": " : ""}stilo.dataframe {\n` +
        `    columns: [${columns.map((column) => `"${column}"`).join(", ")}],\n` +
        `    rows: ${rows.length ? "[\n" + lines.join(",\n") + "\n    ]" : "[]"}\n} `;
    return serializeFormula({ before, body, after });
}

/** A new data table of two columns and an empty row, after `source` (blank). */
function newData(source) {
    const before = source.trimEnd();
    return {
        before: before ? before + "\n" : "",
        after: "",
        name: "",
        columns: ["Column 1", "Column 2"],
        rows: [["", ""]],
    };
}

/** Why `name` cannot label a data table, or "" (an empty name is none). */
export function nameError(name) {
    return !name || NAME.test(name) ? "" : "A name has only letters, digits and _, and does not start with a digit";
}

/**
 * Why `text` cannot be an entry of a row, or "": the check of any value
 * written as Swan source (`expression.js`).
 */
export const entryError = expressionError;

/** Why `text` cannot be a column name, or "". */
export function columnError(text) {
    if (text.includes('"')) return "A column name cannot contain “\"”";
    if (text.includes(TAG_CLOSE)) return `A column name cannot contain “${TAG_CLOSE}”`;
    return "";
}

/**
 * A data table: a table of values that other cells can compute with,
 * stored as one formula, `<% loads: stilo.dataframe {columns: [...], rows:
 * [[...], ...]} %>`, written one row per line, and shown as the table that
 * `stilo.dataframe` renders (the Stilo library, `texl-lib/dataframe.texl`).
 *
 * In edit mode: a name field (optional; with a name, other cells read the
 * data as `loads.column "Fx (kN)"`), and a grid (`GridCell`) whose header
 * row holds the column names, as plain text, and whose other fields each
 * hold one value as a Swan expression: `120`, `"ULS-1"`, `1.35 * Fx_k`. An
 * empty field is an empty value (`""`). The data cells do not refer to each
 * other.
 *
 * A value that would break the row (a syntax error drops it from the list,
 * silently) is marked as it is typed, checked by the Texl engine
 * (`entryError`), and the cell refuses to commit while one is marked, as
 * Excel does with an invalid formula. A name that is not a Swan name, and a
 * column name with `"` or `%>`, are refused too.
 *
 * The type accepts only such a formula, or an empty source (a new table of
 * two columns and one row). A source edited by hand into another shape is
 * edited as text. The editor adds the import of the Stilo library at the
 * top of the document when a data table is first written (`requires`).
 */
export class DataCell extends GridCell {
    static type = "data";

    static label = "Data table";

    static key = "d";

    static icon = html`<svg viewBox="0 0 24 24">
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </svg>`;

    static needs = "a data table";

    static requires = { url: STILO_LIBRARY, source: STILO_IMPORT };

    static accepts(source) {
        return isBlank(source) || parseData(source) !== null;
    }

    static properties = {
        /** Why fields cannot be committed, by "row,column". */
        _errors: { state: true },
    };

    static styles = [
        GridCell.styles,
        css`
            .data-name {
                display: flex;
                align-items: baseline;
                gap: 0.75rem;
                margin-bottom: 0.35rem;
                font-size: 0.85rem;
                color: var(--texl-text-muted, #687085);
            }
            .data-name input {
                font-family: var(--texl-mono, ui-monospace, monospace);
                font-size: 0.88rem;
                margin-left: 0.4rem;
                padding: 0.1rem 0.4rem;
                width: 12rem;
                border: 1px solid var(--texl-line, #e4e6ea);
                border-radius: 4px;
                background: transparent;
                color: var(--texl-text, inherit);
            }
            .data-name input:focus {
                outline: 2px solid var(--texl-accent, #2563eb);
                outline-offset: -1px;
            }
            .data-name .hint {
                margin-left: auto;
                font-size: 0.8rem;
            }
            .grid input.error {
                box-shadow: inset 0 0 0 1.5px var(--texl-error, #c2410c);
            }
        `,
    ];

    constructor() {
        super();
        this._errors = new Map();
        /** The checks still running, by "row,column". */
        this._pending = new Map();
        /** The data table read when editing started, and the name being edited. */
        this._data = null;
        this._name = "";
        /** The source read when editing started, and its table as text. */
        this._source = "";
        this._parsed = "";
    }

    fromTexl(texl) {
        super.fromTexl(texl);
        this._source = this.input;
        this._data = parseData(this.input) ?? (isBlank(this.input) ? newData(this.input) : null);
        this._name = this._data?.name ?? "";
        this._grid = this._data && {
            rows: [this._data.columns, ...this._data.rows],
            align: this._data.columns.map(() => ""),
        };
        this._parsed = JSON.stringify([this._name, this._grid]);
        this._focus = [0, 0];
        this._checkAll();
    }

    toTexl() {
        // An unchanged table keeps its source as written
        if (this._grid && JSON.stringify([this._name, this._grid]) !== this._parsed) {
            const [columns, ...rows] = this._grid.rows;
            this.input = serializeData({ ...this._data, name: this._name.trim(), columns, rows });
        } else if (this._grid) this.input = this._source;
        return super.toTexl();
    }

    inputError(texl) {
        if (!this._grid) return super.inputError(texl);
        const fix = "correct it, or press Escape to discard the changes.";
        const name = nameError(this._name.trim());
        if (name) return `${name}: ${fix}`;
        const first = [...this._errors.keys()]
            .map((key) => key.split(",").map(Number))
            .sort(([r1, c1], [r2, c2]) => r1 - r2 || c1 - c2)[0];
        if (first) {
            const [row, col] = first;
            const where = row === 0 ? `Column ${col + 1}` : `Row ${row}, column ${col + 1}`;
            return `${where}: ${this._errors.get(first.join(","))}: ${fix}`;
        }
        return super.inputError(texl);
    }

    /** Commits once the checks of the fields are done. */
    exitEdit(commit = true) {
        if (commit && this.mode === "edit" && this._pending.size > 0) {
            Promise.all(this._pending.values()).then(() => {
                if (this.mode === "edit") this.exitEdit(true);
            });
            return;
        }
        super.exitEdit(commit);
    }

    renderEditor() {
        if (!this._grid) return super.renderEditor();
        return html`<div class="data-name">
                <label
                    >Name<input
                        class="name"
                        .value=${this._name}
                        placeholder="none"
                        spellcheck="false"
                        @input=${(e) => (this._name = e.target.value)}
                /></label>
                <span class="hint">Each value is a formula: 120, "text", 1.35 * Fx</span>
            </div>
            <div class="grid-tools">${this._renderRowColumnButtons()}</div>
            ${this._renderGrid()}`;
    }

    _fieldClass(row, col) {
        return this._errors.has(`${row},${col}`) ? "error" : "";
    }

    _fieldTitle(row, col) {
        return this._errors.get(`${row},${col}`) ?? "";
    }

    _setCell(row, col, value) {
        super._setCell(row, col, value);
        this._check(row, col, value);
    }

    _setGrid(grid, focus) {
        super._setGrid(grid, focus);
        // Rows and columns moved: the marks follow them
        this._checkAll();
    }

    /** Checks every field (each entry is checked once, then remembered). */
    _checkAll() {
        this._errors = new Map();
        this._pending = new Map();
        this._grid?.rows.forEach((row, r) => row.forEach((value, c) => this._check(r, c, value)));
    }

    /** Checks the field at `row`, `col`, holding `value`, and marks it if it is wrong. */
    _check(row, col, value) {
        const key = `${row},${col}`;
        if (row === 0) {
            this._pending.delete(key);
            return this._mark(key, columnError(value));
        }
        const pending = entryError(value).then((error) => {
            if (this._pending.get(key) !== pending) return;
            this._pending.delete(key);
            this._mark(key, error);
        });
        this._pending.set(key, pending);
    }

    _mark(key, error) {
        if ((this._errors.get(key) ?? "") === error) return;
        const errors = new Map(this._errors);
        if (error) errors.set(key, error);
        else errors.delete(key);
        this._errors = errors;
    }
}
