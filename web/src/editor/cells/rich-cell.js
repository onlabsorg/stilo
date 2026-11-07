import { html, css, svg } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { EditorState as CodeState } from "@codemirror/state";
import { EditorView as CodeView, keymap as codeKeymap } from "@codemirror/view";
import { defaultKeymap, history as codeHistory, historyKeymap } from "@codemirror/commands";
import { toggleMark } from "prosemirror-commands";
import { gapCursor } from "prosemirror-gapcursor";
import { history } from "prosemirror-history";
import { Slice, Fragment } from "prosemirror-model";
import { EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { MarkdownCell } from "./markdown-cell.js";
import { sanitizeOutput } from "../errors.js";
import { typesetEquation } from "../math.js";
import { swanExpression, TAG_CLOSE, TAG_OPEN } from "../swan.js";
import { acceptsRich, paragraphsOfText, parseRich, serializeRich } from "../rich/markdown.js";
import { isOneEquation, schema } from "../rich/schema.js";
import {
    blockStyle,
    inList,
    markActive,
    richPlugins,
    selectedNode,
    setBlockStyle,
    toggleList,
    toggleQuote,
} from "../rich/commands.js";

const { nodes, marks } = schema;
const TAG_IN_TEX = /<%[\s\S]*?%>/g;
const UNDEFINED = "[[Undefined]]";

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "Cmd" : "Ctrl";

const STYLES = [
    ["paragraph", "Normal"],
    ["h1", "Heading 1"],
    ["h2", "Heading 2"],
    ["h3", "Heading 3"],
    ["code", "Code"],
];

const MARK_BUTTONS = [
    ["strong", `Bold (${MOD}+B)`, html`<b>B</b>`],
    ["em", `Italic (${MOD}+I)`, html`<i>I</i>`],
    ["underline", `Underline (${MOD}+U)`, html`<u>U</u>`],
    ["strike", "Strikethrough", html`<s>S</s>`],
    ["sub", `Subscript (${MOD}+=)`, html`x<sub>2</sub>`],
    ["sup", `Superscript (${MOD}+Shift+=)`, html`x<sup>2</sup>`],
];

const icon = (content) => html`<svg viewBox="0 0 24 24" aria-hidden="true">${content}</svg>`;

const ICONS = {
    bullets: icon(svg`<circle cx="5" cy="7" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="17" r="1" /><path d="M10 7h10M10 12h10M10 17h10" />`),
    numbers: icon(svg`<path d="M4 5h2v5M4 10h4M4 15h4l-4 4h4M11 7h9M11 12h9M11 17h9" />`),
    quote: icon(svg`<path d="M5 6v12M10 8h9M10 12h9M10 16h6" />`),
    link: icon(svg`<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1" /><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" />`),
    comment: icon(svg`<path d="M4 5h16v11H9l-5 4z" />`),
};

/** The text an output shows on a chip: no HTML, and no more than a line. */
function plainValue(output) {
    const box = document.createElement("div");
    box.innerHTML = sanitizeOutput(output.replace(/<!--[\s\S]*?-->/g, ""));
    return box.textContent.replace(/\s+/g, " ").trim();
}

/** The body of a tag, without its delimiters. */
function tagBody(source) {
    return source.slice(TAG_OPEN.length, -TAG_CLOSE.length).trim();
}

/** A tag with this body. A body of several lines gets lines of its own. */
function tagOf(body) {
    return body.includes("\n") ? `${TAG_OPEN}\n${body}\n${TAG_CLOSE}` : `${TAG_OPEN} ${body} ${TAG_CLOSE}`;
}

/** The range of `type` around the cursor in its text block, or null. */
function markRange($pos, type) {
    const parent = $pos.parent;
    const start = $pos.start();
    let from = -1;
    let to = -1;
    let pos = start;
    for (let i = 0; i < parent.childCount; i++) {
        const child = parent.child(i);
        const end = pos + child.nodeSize;
        if (type.isInSet(child.marks)) {
            if (from < 0) from = pos;
            to = end;
            if (from <= $pos.pos && $pos.pos <= to && !(i + 1 < parent.childCount && type.isInSet(parent.child(i + 1).marks))) {
                return { from, to };
            }
        } else {
            if (from >= 0 && $pos.pos <= to) return { from, to };
            from = -1;
        }
        pos = end;
    }
    return from >= 0 && from <= $pos.pos && $pos.pos <= to ? { from, to } : null;
}

/**
 * Rich text, edited as in Word: bold is bold, a title is a title, a formula is
 * a chip that shows its value. The source is the Markdown of the `markdown`
 * cell, so it is shown by the same code, and the two types change into each
 * other without converting anything.
 *
 * In edit mode a ProseMirror editor takes the place of CodeMirror, on the same
 * typography as the output (`.view`). A click on a chip, or Enter with one
 * selected, opens a field under it for its expression. Keys belong to the
 * cell: arrows stay inside it, Mod+Enter commits, Escape discards.
 *
 * The type accepts only a source it would not lose anything of
 * (`acceptsRich`). A source it does not accept (e.g. edited by hand) is edited
 * as Markdown, and must be accepted to be committed.
 */
export class RichCell extends MarkdownCell {
    static type = "rich";

    static label = "Rich text";

    static key = "r";

    static needs = "text with simple formatting, without raw HTML or a table";

    static icon = html`<svg viewBox="0 0 24 24">
        <path d="M5 19 10 5h1l5 14" />
        <path d="M7 14h7" />
        <path d="M18 8c1.5 2.5 1.5 8 0 11" />
    </svg>`;

    static accepts(source) {
        return acceptsRich(source);
    }

    static properties = {
        /** The field open under a chip, or null: see `_openField`. */
        _field: { state: true },
    };

    static styles = [
        MarkdownCell.styles,
        css`
            :host([mode="edit"]) {
                position: relative;
                z-index: 5;
            }
            .tools {
                position: sticky;
                top: 0;
                z-index: 2;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 0.125rem;
                margin: 0 0 0.35rem;
                padding: 0.15rem 0;
                background: var(--texl-edit-bg, #f8f9fb);
                border-bottom: 1px solid var(--texl-line, #e4e6ea);
                font-family: var(--texl-heading-font, "Source Sans 3 Variable", "Segoe UI", sans-serif);
            }
            .tools .gap {
                width: 1px;
                height: 1.1rem;
                margin: 0 0.3rem;
                background: var(--texl-line, #e4e6ea);
            }
            .tools button,
            .tools select {
                font: inherit;
                font-size: 0.85rem;
                line-height: 1.2;
                color: var(--texl-text-muted, #687085);
                background: transparent;
                border: 1px solid transparent;
                border-radius: 4px;
                cursor: pointer;
            }
            .tools button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 1.6rem;
                height: 1.6rem;
                padding: 0 0.25rem;
            }
            .tools select {
                height: 1.6rem;
                padding: 0 0.15rem;
                border-color: var(--texl-line, #e4e6ea);
            }
            .tools select option {
                color: var(--texl-menu-text, #1d2330);
                background: var(--texl-menu-bg, #fff);
            }
            .tools button:hover,
            .tools select:hover {
                color: var(--texl-accent, #2563eb);
            }
            .tools button[aria-pressed="true"] {
                color: var(--texl-accent, #2563eb);
                border-color: currentColor;
            }
            .tools sub,
            .tools sup {
                font-size: 0.7em;
                line-height: 0;
            }
            .tools svg {
                width: 1.1rem;
                height: 1.1rem;
                fill: none;
                stroke: currentColor;
                stroke-width: 1.8;
                stroke-linecap: round;
                stroke-linejoin: round;
            }
            .ProseMirror {
                position: relative;
                min-height: 1.5rem;
                outline: none;
                white-space: pre-wrap;
                word-wrap: break-word;
                font-variant-ligatures: none;
            }
            /* A tight list shows its items without paragraphs, so without their room */
            .ProseMirror [data-tight] > li > p {
                margin: 0;
            }
            .ProseMirror pre {
                white-space: pre-wrap;
                font-family: var(--texl-mono, ui-monospace, monospace);
                font-size: 0.88em;
            }
            .ProseMirror-separator,
            .ProseMirror-trailingBreak {
                line-height: inherit;
            }
            .ProseMirror-gapcursor {
                display: none;
                position: absolute;
                pointer-events: none;
            }
            .ProseMirror-gapcursor::after {
                content: "";
                display: block;
                position: absolute;
                top: -2px;
                width: 20px;
                border-top: 1px solid currentColor;
                animation: gap-blink 1.1s steps(2, start) infinite;
            }
            @keyframes gap-blink {
                to {
                    visibility: hidden;
                }
            }
            .ProseMirror-focused .ProseMirror-gapcursor {
                display: block;
            }
            .ProseMirror-selectednode {
                outline: 2px solid var(--texl-accent, #2563eb);
                outline-offset: 1px;
                border-radius: 3px;
            }
            .chip {
                display: inline-block;
                max-width: 24em;
                overflow: hidden;
                vertical-align: bottom;
                white-space: nowrap;
                text-overflow: ellipsis;
                padding: 0 0.3em;
                border-radius: 3px;
                background: color-mix(in srgb, var(--texl-accent, #2563eb) 12%, transparent);
                cursor: pointer;
            }
            .chip:hover {
                background: color-mix(in srgb, var(--texl-accent, #2563eb) 22%, transparent);
            }
            .chip.silent {
                font-style: italic;
                font-size: 0.85em;
                color: var(--texl-text-muted, #687085);
            }
            .chip.new {
                font-family: var(--texl-mono, ui-monospace, monospace);
                font-size: 0.85em;
            }
            .chip.error {
                background: var(--texl-error-bg, rgb(220 38 38 / 0.1));
                color: var(--texl-error, #b91c1c);
            }
            .equation {
                cursor: pointer;
            }
            .equation:hover {
                background: color-mix(in srgb, var(--texl-accent, #2563eb) 10%, transparent);
            }
            div.equation {
                display: block;
                margin: 0 0 0.6em;
            }
            .field {
                position: absolute;
                z-index: 10;
                box-sizing: border-box;
                width: min(26rem, 90%);
                padding: 0.4rem 0.5rem;
                border: 1px solid var(--texl-menu-border, #d5d8de);
                border-radius: 6px;
                background: var(--texl-menu-bg, #fff);
                color: var(--texl-menu-text, #1d2330);
                box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
                font-family: var(--texl-heading-font, "Source Sans 3 Variable", "Segoe UI", sans-serif);
                font-size: 0.85rem;
                line-height: 1.3;
            }
            .field label {
                display: block;
                margin-bottom: 0.2rem;
                font-weight: 600;
            }
            .field .input {
                padding: 0.15rem 0.3rem;
                border: 1px solid var(--texl-line, #e4e6ea);
                border-radius: 4px;
            }
            .field .cm-editor.cm-focused {
                outline: none;
            }
            .field .cm-scroller {
                font-family: var(--texl-mono, ui-monospace, monospace);
                line-height: 1.4;
            }
            .field .cm-content {
                padding: 0;
                caret-color: currentColor;
            }
            .field .cm-line {
                padding: 0;
            }
            .field .preview {
                margin-top: 0.3rem;
                min-height: 1.2rem;
                font-size: 1rem;
            }
            .field .hint {
                margin-top: 0.25rem;
                color: var(--texl-text-muted, #687085);
                font-size: 0.8em;
            }
            .field .problem {
                margin-top: 0.25rem;
                color: var(--texl-error, #b91c1c);
            }
        `,
    ];

    constructor() {
        super();
        /** The source as read when editing started, or null if it is edited as Markdown. */
        this._read = null;
        /** The comments of the cell, with those added while editing. */
        this._comments = [];
        /** @type {EditorView | null} */
        this._rich = null;
        this._field = null;
        /** @type {CodeView | null} */
        this._fieldView = null;
        this._fieldIsNew = false;
    }

    fromTexl(texl) {
        super.fromTexl(texl);
        this._read = acceptsRich(this.input) ? parseRich(this.input) : null;
        this._comments = this._read ? [...this._read.comments] : [];
        this._field = null;
    }

    toTexl() {
        if (this._read && this._rich) {
            this._applyField();
            this.input = serializeRich(this._rich.state.doc, this._read, this._comments);
        }
        return super.toTexl();
    }

    willUpdate(changed) {
        if (changed.has("mode") && this.mode !== "edit") this._destroyRich();
        super.willUpdate(changed);
    }

    updated(changed) {
        // The text editor only exists for a source that is not accepted
        if (this.mode !== "edit" || !this._read) super.updated(changed);
        else {
            if (!this._rich) this._createRich();
            else if (changed.has("tagOutputs")) this._rich.setProps({ nodeViews: this._nodeViews() });
            if (changed.has("mode")) this.focusEditor();
        }
        if (changed.has("_field")) this._syncField();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._destroyRich();
    }

    _createRich() {
        const { doc } = this._read;
        this._rich = new EditorView(
            { mount: this.renderRoot.querySelector(".rich") },
            {
                state: EditorState.create({
                    doc,
                    selection: TextSelection.atEnd(doc),
                    plugins: [
                        history(),
                        gapCursor(),
                        ...richPlugins({
                            commit: () => (this.exitEdit(true), true),
                            discard: () => (this.exitEdit(false), true),
                            openSelected: () => this._openSelected(),
                            editTag: () => this._editNewTag(),
                            editLink: () => this._editLink(),
                            addComment: () => this._addComment(),
                            startTag: () => this._editNewTag(),
                        }),
                    ],
                }),
                nodeViews: this._nodeViews(),
                dispatchTransaction: (tr) => {
                    this._rich.updateState(this._rich.state.apply(tr));
                    this.requestUpdate();
                },
                handleClickOn: (view, pos, node, nodePos, event, direct) => {
                    if (!direct || !isEditable(node)) return false;
                    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)));
                    this._openSelected();
                    return true;
                },
                clipboardTextParser: (text) => {
                    const content = paragraphsOfText(text);
                    const open = content.length === 1 ? 1 : 0;
                    return new Slice(Fragment.fromArray(content), open, open);
                },
                clipboardTextSerializer: (slice) =>
                    slice.content.textBetween(0, slice.content.size, "\n\n", (leaf) => {
                        if (leaf.type === nodes.tag) return leaf.attrs.source;
                        if (leaf.type === nodes.hard_break) return "\n";
                        if (leaf.type === nodes.math) return `$${leaf.attrs.tex}$`;
                        if (leaf.type === nodes.math_block) return `$$${leaf.attrs.tex}$$`;
                        return "";
                    }),
            },
        );
        this.requestUpdate();
    }

    _destroyRich() {
        this._closeField();
        this._rich?.destroy();
        this._rich = null;
    }

    focusEditor() {
        if (this._read) this._rich?.focus();
        else super.focusEditor();
    }

    /** How a tag, or an equation with its tags, shows while editing. */
    _nodeViews() {
        const outputs = this.tagOutputs ?? new Map();
        const equation = (tag) => (node) => {
            const dom = document.createElement(tag);
            dom.className = "equation";
            dom.title = "Click to edit the equation";
            const display = tag === "div" || node.attrs.display;
            const tex = node.attrs.tex.replace(TAG_IN_TEX, (source) => outputs.get(source) ?? "\\square");
            dom.innerHTML = sanitizeOutput(typesetEquation(tex, display));
            return { dom, ignoreMutation: () => true, stopEvent: () => false };
        };
        return {
            tag: (node) => {
                const source = node.attrs.source;
                const body = tagBody(source);
                const dom = document.createElement("span");
                dom.className = "chip";
                dom.title = body;
                if (!outputs.has(source)) {
                    // Not rendered yet: a new or changed formula
                    dom.classList.add("new");
                    dom.textContent = body.split("\n")[0] || "ƒ";
                } else {
                    const value = plainValue(outputs.get(source));
                    if (!value) dom.classList.add("silent");
                    if (value.includes(UNDEFINED)) dom.classList.add("error");
                    dom.textContent = value || "ƒ";
                }
                return { dom, ignoreMutation: () => true, stopEvent: () => false };
            },
            math: equation("span"),
            math_block: equation("div"),
        };
    }

    /** Edits the formula or equation selected as a whole. False if there is none. */
    _openSelected() {
        const node = selectedNode(this._rich.state);
        if (!node || !isEditable(node)) return false;
        if (node.type === nodes.tag) {
            this._openField({
                label: "Formula",
                value: tagBody(node.attrs.source),
                swan: true,
                check: tagProblem,
                apply: (body) => this._replaceSelected(body ? nodes.tag.create({ source: tagOf(body) }) : null),
            });
        } else {
            const display = node.type === nodes.math_block || node.attrs.display;
            // The field shows the equation; the lines around it stay in the source
            const [, before, body, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(node.attrs.tex);
            this._openField({
                label: "Equation (LaTeX)",
                value: body,
                preview: (tex) => this._previewEquation(tex, display),
                check: (tex) => (!tex || isOneEquation(tex, display) ? "" : "This is not one equation: check the dollars."),
                apply: (tex) => this._replaceSelected(tex ? node.type.create({ ...node.attrs, tex: before + tex + after }) : null),
            });
        }
        return true;
    }

    _replaceSelected(node) {
        const { state } = this._rich;
        const tr = node ? state.tr.replaceSelectionWith(node, true) : state.tr.deleteSelection();
        this._rich.dispatch(tr.scrollIntoView());
    }

    /** A new formula at the selection, of the selected text if any. */
    _editNewTag() {
        const { state } = this._rich;
        const { from, to } = state.selection;
        this._openField({
            label: "Formula",
            value: state.doc.textBetween(from, to, " "),
            swan: true,
            check: tagProblem,
            apply: (body) => {
                if (body) this._replaceRange(from, to, nodes.tag.create({ source: tagOf(body) }));
            },
        });
        return true;
    }

    /** A new equation at the selection. */
    _editNewEquation() {
        const { from, to } = this._rich.state.selection;
        this._openField({
            label: "Equation (LaTeX)",
            value: "",
            preview: (tex) => this._previewEquation(tex, false),
            check: (tex) => (!tex || isOneEquation(tex) ? "" : "This is not one equation: check the dollars."),
            apply: (tex) => {
                if (tex) this._replaceRange(from, to, nodes.math.create({ tex }));
            },
        });
    }

    _replaceRange(from, to, node) {
        const tr = this._rich.state.tr.replaceWith(from, to, node);
        this._rich.dispatch(tr.setSelection(TextSelection.create(tr.doc, from + node.nodeSize)).scrollIntoView());
    }

    _previewEquation(tex, display) {
        const outputs = this.tagOutputs ?? new Map();
        const shown = tex.replace(TAG_IN_TEX, (source) => outputs.get(source) ?? "\\square");
        return sanitizeOutput(typesetEquation(shown, display));
    }

    /** Makes the selection a link, or changes or removes the link it is in. */
    _editLink() {
        const { state } = this._rich;
        const { from, to, empty, $from } = state.selection;
        const range = empty ? markRange($from, marks.link) : { from, to };
        const current = (range ? state.doc.nodeAt(range.from)?.marks : []).find((mark) => mark.type === marks.link);
        this._openField({
            label: "Link address",
            value: current?.attrs.href ?? "",
            check: (url) => (/\n/.test(url) ? "An address is one line." : ""),
            apply: (url) => {
                const tr = this._rich.state.tr;
                if (range) {
                    tr.removeMark(range.from, range.to, marks.link);
                    if (url) tr.addMark(range.from, range.to, marks.link.create({ href: url }));
                } else if (url) {
                    tr.insert(from, schema.text(url, [marks.link.create({ href: url })]));
                }
                this._rich.dispatch(tr);
            },
        });
        return true;
    }

    _addComment() {
        this._openField({
            label: "Comment on this line",
            value: "",
            check: (text) => (text.includes("-->") ? "A comment cannot contain “-->”." : ""),
            apply: (text) => {
                if (text) {
                    this._comments = [...this._comments, `<!--[ ${text} ]-->`];
                    this.requestUpdate();
                }
            },
        });
        return true;
    }

    /**
     * Opens the field under the selection.
     * @param {object} field
     * @param {string} field.label
     * @param {string} field.value
     * @param {boolean} [field.swan] - Highlight it as Swan.
     * @param {(value: string) => string} [field.check] - Why it cannot be applied, or "".
     * @param {(value: string) => string} [field.preview] - The HTML of a preview.
     * @param {(value: string) => void} field.apply
     */
    _openField(field) {
        const host = this.getBoundingClientRect();
        const at = this._rich.coordsAtPos(this._rich.state.selection.from);
        const left = Math.max(0, Math.min(at.left - host.left, host.width * 0.45));
        this._field = { ...field, problem: "", shown: field.preview?.(field.value) ?? "", top: at.bottom - host.top + 4, left };
        this._fieldIsNew = true;
    }

    /** Makes the input of a field just opened; one already open keeps its own. */
    _syncField() {
        if (!this._fieldIsNew) return;
        this._fieldIsNew = false;
        this._fieldView?.destroy();
        this._fieldView = null;
        const parent = this.renderRoot.querySelector(".field .input");
        if (!this._field || !parent) return;
        const run = (action) => () => (action(), true);
        this._fieldView = new CodeView({
            state: CodeState.create({
                doc: this._field.value,
                // At the end, as with F2 in Excel: a first key does not wipe it
                selection: { anchor: this._field.value.length },
                extensions: [
                    codeHistory(),
                    CodeView.lineWrapping,
                    this._field.swan ? swanExpression() : [],
                    codeKeymap.of([
                        { key: "Enter", run: run(() => this._applyField(true)) },
                        { key: "Mod-Enter", run: run(() => this._applyField(true)) },
                        { key: "Escape", run: run(() => this._closeField(true)) },
                        { key: "Shift-Enter", run: (view) => (view.dispatch(view.state.replaceSelection("\n")), true) },
                        ...defaultKeymap.filter(({ key }) => key !== "Enter" && key !== "Mod-Enter" && key !== "Escape"),
                        ...historyKeymap,
                    ]),
                    CodeView.updateListener.of((update) => {
                        if (update.docChanged && this._field?.preview) {
                            this._field = { ...this._field, shown: this._field.preview(update.state.doc.toString()) };
                        }
                    }),
                ],
            }),
            parent,
            root: this.renderRoot,
        });
        this._fieldView.focus();
    }

    /** Applies the open field; if it cannot be, says why and returns false. */
    _applyField(refocus = false) {
        if (!this._field || !this._fieldView) return true;
        const value = this._fieldView.state.doc.toString().trim();
        const problem = this._field.check?.(value) ?? "";
        if (problem) {
            this._field = { ...this._field, problem };
            return false;
        }
        const { apply } = this._field;
        this._closeField();
        apply(value);
        if (refocus) this._rich?.focus();
        return true;
    }

    _closeField(refocus = false) {
        this._fieldView?.destroy();
        this._fieldView = null;
        this._field = null;
        if (refocus) this._rich?.focus();
    }

    /** Leaving the field for elsewhere in the cell applies it, as in Excel. */
    _onFieldFocusOut(e) {
        const field = e.currentTarget;
        if (this._field && !field.contains(e.relatedTarget)) queueMicrotask(() => this._fieldView && this._applyField());
    }

    _run(command) {
        const view = this._rich;
        command(view.state, view.dispatch, view);
        view.focus();
    }

    renderEditor() {
        if (!this._read) return super.renderEditor();
        const state = this._rich?.state;
        const pressed = (on) => (on ? "true" : "false");
        const button = (title, content, action, on = false) =>
            html`<button
                type="button"
                title=${title}
                aria-label=${title}
                aria-pressed=${pressed(on)}
                tabindex="-1"
                @mousedown=${(e) => e.preventDefault()}
                @click=${action}
            >
                ${content}
            </button>`;
        return html`<div class="tools" role="toolbar" aria-label="Formatting">
                <select
                    title="Style"
                    aria-label="Style"
                    tabindex="-1"
                    .value=${state ? blockStyle(state) : "paragraph"}
                    @change=${(e) => this._run(setBlockStyle(e.target.value))}
                >
                    ${STYLES.map(
                        ([value, label]) =>
                            html`<option value=${value} ?selected=${state && blockStyle(state) === value}>${label}</option>`,
                    )}
                </select>
                <span class="gap"></span>
                ${MARK_BUTTONS.map(([name, title, content]) =>
                    button(title, content, () => this._run(toggleMark(marks[name])), state && markActive(state, marks[name])),
                )}
                <span class="gap"></span>
                ${button("Bulleted list", ICONS.bullets, () => this._run(toggleList(nodes.bullet_list)), state && inList(state, nodes.bullet_list))}
                ${button("Numbered list", ICONS.numbers, () => this._run(toggleList(nodes.ordered_list)), state && inList(state, nodes.ordered_list))}
                ${button("Quote", ICONS.quote, () => this._run(toggleQuote), state && inList(state, nodes.blockquote))}
                <span class="gap"></span>
                ${button(`Link (${MOD}+K)`, ICONS.link, () => this._editLink(), state && markActive(state, marks.link))}
                ${button(`Formula (${MOD}+E)`, html`<i>ƒ</i>`, () => this._editNewTag())}
                ${button("Equation", "∑", () => this._editNewEquation())}
                ${button("Comment (Shift+F2)", ICONS.comment, () => this._addComment())}
            </div>
            <div class="view rich"></div>
            ${this._renderField()}`;
    }

    _renderField() {
        const field = this._field;
        if (!field) return "";
        return html`<div
            class="field"
            style=${styleMap({ top: `${field.top}px`, left: `${field.left}px` })}
            @focusout=${(e) => this._onFieldFocusOut(e)}
        >
            <label>${field.label}</label>
            <div class="input"></div>
            ${field.preview ? html`<div class="preview view"><span .innerHTML=${field.shown}></span></div>` : ""}
            ${field.problem ? html`<div class="problem" role="alert">${field.problem}</div>` : ""}
            <div class="hint">Enter applies · Shift+Enter starts a new line · Esc cancels</div>
        </div>`;
    }
}

function isEditable(node) {
    return node.type === nodes.tag || node.type === nodes.math || node.type === nodes.math_block;
}

function tagProblem(body) {
    return body.includes(TAG_CLOSE) ? "A formula cannot contain “%>”." : "";
}
