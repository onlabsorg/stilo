import { LitElement, html, css } from "lit";

/**
 * @typedef {object} FormField
 * @property {string} key The name of the namespace member the field gives.
 * @property {string} label The description shown on the left.
 * @property {"text" | "choice" | "number" | "expression"} type What the
 *   field holds: free text, one of `options`, a number, or a Swan
 *   expression (a formula: `loads.column "x"`).
 * @property {{value: string, label: string}[]} [options] The choices of a
 *   `choice` field, shown in a drop-down.
 * @property {string} [placeholder] Shown in an empty field.
 * @property {boolean} [required] An empty field is an error.
 */

/**
 * A form: the edit mode of a cell whose source makes a namespace, such as a
 * chart's. One line per field, a fixed description on the left and an input
 * on the right: a text box (free text, a number, or a formula, written in
 * the monospaced font of source text), or a drop-down. Every form cell
 * looks and works the same, so a form is familiar wherever it appears.
 *
 * The form only shows: the cell holds the values and checks them. Set
 * `fields`, `values` (by key, as the text in the input; a `choice` field's
 * value is the `value` of an option) and `errors` (by key, the reason a
 * field is wrong: the field is outlined and the reason is its tooltip).
 * Each input fires `form-input`, with `{key, value}`.
 *
 * Keys: Tab and Shift+Tab move to the next and previous field, as in any
 * form; ↑ and ↓ too, from a text box (in a drop-down they change the
 * choice). Mod+Enter and Escape are the editor's: they commit or discard.
 */
export class TexlForm extends LitElement {
    static properties = {
        /** @type {FormField[]} */
        fields: { attribute: false },
        /** @type {Record<string, string>} */
        values: { attribute: false },
        /** @type {Map<string, string>} */
        errors: { attribute: false },
    };

    static styles = css`
        :host {
            display: grid;
            grid-template-columns: minmax(7rem, max-content) minmax(0, 1fr);
            align-items: center;
            column-gap: 1rem;
            row-gap: 0.3rem;
            padding: 0.15rem 0;
            font-size: 0.9rem;
        }
        label {
            color: var(--texl-text-muted, #687085);
            white-space: nowrap;
        }
        input,
        select {
            box-sizing: border-box;
            width: 100%;
            font: inherit;
            padding: 0.2rem 0.45rem;
            border: 1px solid var(--texl-line, #e4e6ea);
            border-radius: 4px;
            background: var(--texl-paper, transparent);
            color: inherit;
        }
        select {
            width: auto;
            min-width: 10rem;
            justify-self: start;
            cursor: pointer;
        }
        input.expression {
            font-family: var(--texl-mono, ui-monospace, monospace);
            font-size: 0.95em;
        }
        input.number {
            width: 12rem;
            text-align: right;
            font-variant-numeric: tabular-nums;
        }
        :is(input, select):focus {
            outline: 2px solid var(--texl-accent, #2563eb);
            outline-offset: -1px;
        }
        .error {
            box-shadow: inset 0 0 0 1.5px var(--texl-error, #c2410c);
        }
    `;

    constructor() {
        super();
        this.fields = [];
        this.values = {};
        this.errors = new Map();
    }

    /** Moves the keyboard focus to the field of `key`, or the first one. */
    focusField(key = this.fields[0]?.key) {
        this.renderRoot.querySelector(`[data-key="${CSS.escape(key ?? "")}"]`)?.focus();
    }

    render() {
        return this.fields.map((field) => {
            const id = `field-${field.key}`;
            return html`<label for=${id}>${field.label}</label>${this._renderInput(field, id)}`;
        });
    }

    _renderInput(field, id) {
        const value = this.values[field.key] ?? "";
        const error = this.errors.get(field.key) ?? "";
        const onInput = (e) => this._fire(field.key, e.target.value);
        if (field.type === "choice")
            return html`<select id=${id} data-key=${field.key} class=${error ? "error" : ""} title=${error} @change=${onInput}>
                ${(field.options ?? []).map((option) => html`<option value=${option.value} ?selected=${option.value === value}>${option.label}</option>`)}
            </select>`;
        return html`<input
            id=${id}
            data-key=${field.key}
            class="${field.type}${error ? " error" : ""}"
            title=${error}
            .value=${value}
            placeholder=${field.placeholder ?? ""}
            spellcheck=${field.type === "text" ? "true" : "false"}
            inputmode=${field.type === "number" ? "decimal" : "text"}
            @input=${onInput}
            @keydown=${(e) => this._onKeyDown(e, field.key)}
        />`;
    }

    _fire(key, value) {
        this.dispatchEvent(new CustomEvent("form-input", { detail: { key, value } }));
    }

    _onKeyDown(e, key) {
        const step = { ArrowUp: -1, ArrowDown: 1 }[e.key];
        if (!step || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
        const index = this.fields.findIndex((field) => field.key === key) + step;
        if (index < 0 || index >= this.fields.length) return;
        e.preventDefault();
        this.focusField(this.fields[index].key);
    }
}

if (!customElements.get("texl-form")) customElements.define("texl-form", TexlForm);
