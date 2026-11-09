import { html, css } from "lit";
import { MarkdownCell } from "./markdown-cell.js";

/**
 * @typedef {object} Grid
 * @property {string[][]} rows The header row, then the body rows, all as
 *   long as the header.
 * @property {string[]} align One entry per column (its alignment, or "").
 */

/**
 * Base of the cells edited as a grid of fields, one per table cell, and shown
 * as their Markdown output: `table` and `data`. Not a cell type itself.
 *
 * A subclass reads its source into `_grid` (or leaves it null when the
 * source is not a grid, to be edited as Markdown text) in `fromTexl`, and
 * writes it back in `toTexl`. In the grid, Tab and Shift+Tab move to the next
 * and previous field (Tab in the last one adds a row, as in Word), ↑/↓ to the
 * field above and below; the buttons insert and delete rows and columns. The
 * header row and one body row always stay.
 *
 * Hooks: `_fieldClass(row, col)` and `_fieldTitle(row, col)`, the class and
 * tooltip of a field; `_setCell(row, col, value)` is called on each input.
 */
export class GridCell extends MarkdownCell {
    static properties = {
        /** The grid being edited, or null when the source is not a grid. */
        _grid: { state: true },
        /** The field that has the focus, or had it last: [row, column]. */
        _focus: { state: true },
    };

    static styles = [
        MarkdownCell.styles,
        css`
            .grid-tools {
                display: flex;
                align-items: center;
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
        this._grid = null;
        this._focus = [0, 0];
    }

    updated(changed) {
        // The text editor only exists for a source that is not a grid
        if (this.mode !== "edit" || !this._grid) super.updated(changed);
        else if (changed.has("mode") || changed.has("_grid")) this.focusEditor();
    }

    focusEditor() {
        if (!this._grid) return super.focusEditor();
        const [row, col] = this._focus;
        this.renderRoot.querySelector(`input[data-row="${row}"][data-col="${col}"]`)?.focus();
    }

    /** The buttons that insert and delete rows and columns. */
    _renderRowColumnButtons() {
        return html`<button @click=${() => this._insertRow()} title="Insert a row below">+ Row</button>
            <button @click=${() => this._insertColumn()} title="Insert a column to the right">+ Column</button>
            <button @click=${() => this._deleteRow()} title="Delete the row">− Row</button>
            <button @click=${() => this._deleteColumn()} title="Delete the column">− Column</button>`;
    }

    /** The grid of fields. */
    _renderGrid() {
        return html`<table class="grid">
            ${this._grid.rows.map(
                (row, r) =>
                    html`<tr>
                        ${row.map(
                            (cell, c) =>
                                html`<td>
                                    <input
                                        data-row=${r}
                                        data-col=${c}
                                        class=${this._fieldClass(r, c)}
                                        title=${this._fieldTitle(r, c)}
                                        .value=${cell}
                                        @input=${(e) => this._setCell(r, c, e.target.value)}
                                        @focus=${() => this._focusField(r, c)}
                                        @keydown=${(e) => this._onGridKeyDown(e, r, c)}
                                    />
                                </td>`,
                        )}
                    </tr>`,
            )}
        </table>`;
    }

    /** The class of the field at `row`, `col`. */
    _fieldClass(row, col) {
        return "";
    }

    /** The tooltip of the field at `row`, `col`. */
    _fieldTitle(row, col) {
        return "";
    }

    _focusField(row, col) {
        // Only a new field updates the buttons: the grid focuses the current
        // one again after each update
        if (this._focus[0] !== row || this._focus[1] !== col) this._focus = [row, col];
    }

    _setCell(row, col, value) {
        // The rows are replaced, not changed in place, so the grid compares
        // as changed; no new rendering is needed while typing
        const rows = this._grid.rows.map((cells) => [...cells]);
        rows[row][col] = value;
        this._grid.rows = rows;
    }

    _setGrid(grid, focus) {
        this._focus = focus;
        this._grid = { ...this._grid, ...grid };
    }

    _insertRow(row = this._focus[0]) {
        const rows = [...this._grid.rows];
        rows.splice(row + 1, 0, rows[0].map(() => ""));
        this._setGrid({ rows }, [row + 1, this._focus[1]]);
    }

    _deleteRow() {
        const [row, col] = this._focus;
        // The header stays, and so does one body row
        if (row === 0 || this._grid.rows.length <= 2) return;
        const rows = this._grid.rows.filter((_, r) => r !== row);
        this._setGrid({ rows }, [Math.min(row, rows.length - 1), col]);
    }

    _insertColumn() {
        const [row, col] = this._focus;
        const rows = this._grid.rows.map((cells) => cells.toSpliced(col + 1, 0, ""));
        this._setGrid({ rows, align: this._grid.align.toSpliced(col + 1, 0, "") }, [row, col + 1]);
    }

    _deleteColumn() {
        const [row, col] = this._focus;
        if (this._grid.align.length <= 1) return;
        const rows = this._grid.rows.map((cells) => cells.toSpliced(col, 1));
        this._setGrid({ rows, align: this._grid.align.toSpliced(col, 1) }, [row, Math.min(col, rows[0].length - 1)]);
    }

    _onGridKeyDown(e, row, col) {
        const columns = this._grid.align.length;
        const last = this._grid.rows.length - 1;
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
