import { LitElement, html, css } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import DOMPurify from "dompurify";

/**
 * Base class of all cells.
 *
 * A cell has two modes:
 * - render mode shows `output`, the text that Texl rendered from the cell's
 *   source, set by the editor;
 * - edit mode shows the cell's own editing widget.
 *
 * The editor owns the document; a cell only receives its Texl source
 * (`texl`) and reports a new one with a `cell-change` event when an edit is
 * committed. Subclasses override:
 * - `fromTexl(texl)`: reads the cell's input from its Texl source;
 * - `toTexl()`: produces the Texl source from the current input;
 * - `renderEditor()`: the editing widget (the base only shows a notice);
 * - `renderView()`, rarely: the base shows `output` as sanitised HTML.
 * They also set the static `type`, and `label` and `icon`, which the
 * editor shows in the left margin and in the menu of cell types.
 *
 * A type may need a source of a certain shape (a table, a formula): it
 * overrides the static `accepts(source)` and says what it needs in
 * `needs`. White space and HTML comments around the content never make a
 * source unacceptable. The editor offers a type change only to the types
 * that accept the cell's source, and a cell refuses to commit a changed
 * source its type does not accept: it stays in edit mode and shows why
 * (`inputError(texl)`), as Excel does with an invalid formula.
 *
 * Reactive properties are declared in `static properties` and initialised in
 * the constructor (not as class fields, which would shadow Lit's accessors).
 */
export class TexlCell extends LitElement {
    /** The cell type written in the marker. Subclasses set it. */
    static type = "";

    /** The name of the type shown to the user; the type if empty. */
    static label = "";

    /** The type's icon: a Lit template of a 24×24 SVG drawn with strokes. */
    static icon = html`<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>`;

    /** What the type needs of a source, e.g. "a table"; empty if it accepts any. */
    static needs = "";

    /**
     * Whether the type can edit and show `source`. The base accepts any
     * source; a type that needs a shape overrides it.
     * @param {string} source
     * @returns {boolean}
     */
    static accepts(source) {
        return true;
    }

    static properties = {
        texl: { type: String },
        output: { type: String },
        mode: { type: String, reflect: true },
        selected: { type: Boolean, reflect: true },
        /** Why the last commit was refused, or empty. */
        _error: { state: true },
    };

    // Lined paper: every cell is at least one line high and ruled below.
    static styles = css`
        :host {
            display: block;
            box-sizing: border-box;
            min-height: var(--texl-line-height, 2rem);
            border-left: 3px solid transparent;
            border-bottom: 1px solid var(--texl-line, #e4e6ea);
            padding: 0.25rem 0.75rem;
            line-height: 1.5rem;
        }
        /* Selected: a light wash and a faint rounded ring */
        :host([selected]) {
            border-radius: 4px;
            background: var(--texl-selected-bg, rgb(37 99 235 / 0.05));
            box-shadow: inset 0 0 0 1px var(--texl-selected-ring, rgb(37 99 235 / 0.35));
        }
        /* Editing: the source takes the place of the output on the line, on a
           faint gray tint with the accent bar */
        :host([mode="edit"]) {
            border-radius: 0;
            border-left-color: var(--texl-accent, #2563eb);
            background: var(--texl-edit-bg, #f8f9fb);
            box-shadow: none;
        }
        /* The document's typography: serif text, sans headings, tables ruled
           as in a printed report */
        .view {
            font-family: var(--texl-font, "Literata Variable", Literata, Georgia, serif);
            font-size: var(--texl-font-size, 1rem);
            font-optical-sizing: auto;
            line-height: 1.65;
            text-rendering: optimizeLegibility;
        }
        .view > :first-child {
            margin-top: 0;
        }
        .view > :last-child {
            margin-bottom: 0;
        }
        .view :is(h1, h2, h3, h4, h5, h6, th) {
            font-family: var(--texl-heading-font, "Source Sans 3 Variable", "Source Sans 3", "Segoe UI", sans-serif);
            font-weight: 600;
        }
        .view :is(h1, h2, h3, h4, h5, h6) {
            line-height: 1.25;
            letter-spacing: -0.003em;
        }
        .view h1 {
            font-size: 1.85em;
            margin: 0.9em 0 0.35em;
            letter-spacing: -0.01em;
        }
        .view h2 {
            font-size: 1.3em;
            margin: 1.2em 0 0.4em;
        }
        .view h3 {
            font-size: 1.08em;
            margin: 1.1em 0 0.3em;
        }
        .view :is(h4, h5, h6) {
            font-size: 1em;
            margin: 1em 0 0.3em;
        }
        /* A title that starts a cell keeps some room from the text of the
           cell above */
        .view > :is(h1, h2, h3, h4, h5, h6):first-child {
            margin-top: 0.5em;
        }
        .view :is(p, ul, ol, blockquote, pre) {
            margin: 0 0 0.6em;
        }
        .view :is(ul, ol) {
            padding-left: 1.4em;
        }
        .view li {
            margin: 0.1em 0;
        }
        .view li::marker {
            color: var(--texl-text-muted, #687085);
        }
        .view strong {
            font-weight: 600;
        }
        .view a {
            color: var(--texl-accent, #2563eb);
            text-decoration-thickness: 1px;
            text-underline-offset: 0.18em;
            text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
        }
        /* Sub- and superscripts do not open up the line */
        .view :is(sub, sup) {
            position: relative;
            font-size: 0.72em;
            line-height: 0;
            vertical-align: baseline;
        }
        .view sub {
            bottom: -0.25em;
        }
        .view sup {
            top: -0.45em;
        }
        .view table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            margin: 0.25em 0 0.75em;
            font-size: 0.94em;
            font-variant-numeric: tabular-nums lining-nums;
            border-top: 1.5px solid var(--texl-rule, #1d2330);
            border-bottom: 1.5px solid var(--texl-rule, #1d2330);
        }
        .view th {
            border-bottom: 1px solid var(--texl-rule, #1d2330);
            padding: 0.35em 1.25em 0.35em 0;
        }
        .view th:not([align]) {
            text-align: left;
        }
        .view td {
            border-bottom: 1px solid var(--texl-line, #e4e6ea);
            padding: 0.3em 1.25em 0.3em 0;
        }
        .view tr:last-child td {
            border-bottom: 0;
        }
        .view :is(th, td):last-child {
            padding-right: 0;
        }
        .view code {
            font-family: var(--texl-mono, ui-monospace, monospace);
            font-size: 0.88em;
            background: var(--texl-edit-bg, #f8f9fb);
            padding: 0.1em 0.3em;
            border-radius: 4px;
        }
        .view pre code {
            padding: 0;
            background: none;
        }
        .view blockquote {
            margin-left: 0;
            padding-left: 0.9em;
            border-left: 3px solid var(--texl-line, #e4e6ea);
            color: var(--texl-text-muted, #687085);
        }
        .no-editor {
            color: #999;
        }
        .input-error {
            margin: 0.25rem 0 0;
            font-size: 0.85em;
            color: var(--texl-error, #c2410c);
        }
    `;

    constructor() {
        super();
        this.texl = "";
        this.output = "";
        this.mode = "render";
        this.selected = false;
        this._error = "";
    }

    willUpdate(changed) {
        if (changed.has("mode")) this._error = "";
        if (changed.has("mode") && this.mode === "edit") this.fromTexl(this.texl);
    }

    updated(changed) {
        if (changed.has("mode") && this.mode === "edit") this.focusEditor();
    }

    /** Reads the cell's input from its Texl source. */
    fromTexl(texl) {
        this.input = texl;
    }

    /** Returns the Texl source for the current input. */
    toTexl() {
        return this.input ?? "";
    }

    /**
     * Why `texl`, the source of the current input, cannot be committed, or
     * an empty string. The base refuses a source its type does not accept.
     * @param {string} texl
     * @returns {string}
     */
    inputError(texl) {
        const cellType = /** @type {typeof TexlCell} */ (this.constructor);
        if (cellType.accepts(texl)) return "";
        const { needs, label, type } = cellType;
        return `A ${(label || type).toLowerCase()} cell needs ${needs}: correct it, or press Escape to discard the changes.`;
    }

    /**
     * Leaves edit mode; reports the new source if `commit` and it changed.
     * A changed source that `inputError` refuses is not committed: the cell
     * stays in edit mode and shows the error.
     */
    exitEdit(commit = true) {
        if (this.mode !== "edit") return;
        if (commit) {
            const texl = this.toTexl();
            const error = texl !== this.texl ? this.inputError(texl) : "";
            if (error) {
                this._error = error;
                return;
            }
            if (texl !== this.texl) {
                this.dispatchEvent(
                    new CustomEvent("cell-change", {
                        detail: { texl },
                        bubbles: true,
                        composed: true,
                    }),
                );
            }
        }
        this.dispatchEvent(new CustomEvent("cell-exit", { bubbles: true, composed: true }));
    }

    /** Moves the keyboard focus into the editing widget. */
    focusEditor() {
        this.renderRoot.querySelector("textarea, input")?.focus();
    }

    render() {
        if (this.mode !== "edit") return this.renderView();
        const error = this._error ? html`<p class="input-error" role="alert">${this._error}</p>` : "";
        return html`${this.renderEditor()}${error}`;
    }

    /** The editing widget. Subclasses override it. */
    renderEditor() {
        return html`<p class="no-editor">No editor is defined for this cell type.</p>`;
    }

    /** Shows `output` as HTML, sanitised: documents are untrusted. */
    renderView() {
        const content = DOMPurify.sanitize(this.output);
        return html`<div class="view">${unsafeHTML(content)}</div>`;
    }
}
