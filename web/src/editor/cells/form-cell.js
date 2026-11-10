import { html, css } from "lit";
import { TextCell } from "./text-cell.js";
import { parseFormula, serializeFormula } from "./formula-cell.js";
import { TAG_CLOSE } from "../swan.js";
import { isBlank } from "../document.js";
import { expressionError } from "../expression.js";
import "../texl-form.js";

/**
 * @typedef {import("../texl-form.js").FormField} FormField
 *
 * @typedef {object} Form One kind of thing a form cell makes: a function
 *   applied to a namespace, `call {key: value, ...}`.
 * @property {string} call The function, a dotted Swan name:
 *   `stilo.charts.line`.
 * @property {string} label Its name in the drop-down of kinds: "Line".
 * @property {FormField[]} fields The members of the namespace, in order.
 *
 * @typedef {object} Call
 * @property {string} before White space and comments before the tag.
 * @property {string} after White space and comments after the tag.
 * @property {string} call The function applied.
 * @property {[string, string][]} members The members of the namespace, in
 *   order: name and value, as Swan source.
 */

/** A Swan name, and a dotted one. */
const NAME_AT = /[\p{L}_][\p{L}\p{N}_]*/uy;
const CALL_AT = /[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)*/uy;

/** A number as a `number` field holds it, and as Swan reads it. */
const NUMBER = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/** A text as Swan writes it: no escapes, so no `"` inside. */
const TEXT = /^"[^"]*"$/;

/** The key of the drop-down of kinds; not a Swan name, so never a member's. */
const KIND = "-kind";

/** Thrown by the reader of a source that is not a call. */
const NOT_CALL = Symbol("not a call");

/**
 * Reads a call: one tag holding `function {name: value, ...}`, with white
 * space and HTML comments around the tag. Each value is kept as its Swan
 * source. Returns null for anything else: a label, comments inside the tag,
 * an empty value, a name given twice.
 * @param {string} source
 * @returns {Call | null}
 */
export function parseCall(source) {
    const formula = parseFormula(source);
    if (!formula || formula.body === null) return null;
    const s = formula.body;
    let i = 0;
    const fail = () => {
        throw NOT_CALL;
    };
    const space = () => {
        while (i < s.length && /\s/.test(s[i])) i++;
    };
    const match = (pattern) => {
        space();
        pattern.lastIndex = i;
        const found = pattern.exec(s) ?? fail();
        i = pattern.lastIndex;
        return found[0];
    };
    const expect = (text) => {
        space();
        if (!s.startsWith(text, i)) fail();
        i += text.length;
    };
    // One value: Swan source up to a comma or `}` outside brackets and texts
    const value = () => {
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
                    if (c === "}") break;
                    fail();
                }
                depth--;
            } else if (c === "," && depth === 0) break;
        }
        const text = s.slice(from, i).trim();
        if (i >= s.length || !text) fail();
        return text;
    };
    try {
        const call = match(CALL_AT);
        expect("{");
        const members = [];
        space();
        if (s[i] === "}") i++;
        else
            for (;;) {
                const name = match(NAME_AT);
                if (members.some(([other]) => other === name)) fail();
                expect(":");
                members.push([name, value()]);
                if (s[i++] === "}") break;
            }
        space();
        if (i < s.length) fail();
        return { before: formula.before, after: formula.after, call, members };
    } catch (e) {
        if (e === NOT_CALL) return null;
        throw e;
    }
}

/**
 * Writes a call back as a source: one member per line.
 * @param {Call} call
 * @returns {string}
 */
export function serializeCall({ before, after, call, members }) {
    const body = members.length
        ? ` ${call} {\n${members.map(([name, value]) => `    ${name}: ${value}`).join(",\n")}\n} `
        : ` ${call} {} `;
    return serializeFormula({ before, body, after });
}

/** The text in the input of `field` for a member's source, or null if the field cannot hold it. */
function fieldText(field, source) {
    if (field.type === "expression") return source;
    if (field.type === "number") return NUMBER.test(source) ? source : null;
    if (!TEXT.test(source)) return null;
    const text = source.slice(1, -1);
    if (field.type === "choice" && !field.options?.some((option) => option.value === text)) return null;
    return text;
}

/** The member's source for the text in the input of `field`, or null for an empty field (no member). */
function fieldSource(field, text) {
    const value = field.type === "text" ? text : text.trim();
    if (!value.trim()) return null;
    return field.type === "text" || field.type === "choice" ? `"${value}"` : value;
}

/** Why the text in the input of `field` cannot be written, as far as it tells, or "". */
function fieldTextError(field, text) {
    if (!text.trim()) return "";
    if (field.type === "text") {
        if (text.includes('"')) return "A text cannot contain “\"”";
        if (text.includes(TAG_CLOSE)) return `A text cannot contain “${TAG_CLOSE}”`;
    }
    if (field.type === "number" && !NUMBER.test(text.trim())) return "Not a number: write it as 12, -0.5 or 1.2e3";
    return "";
}

/**
 * Base of the cells edited as a form (`<texl-form>`, see `texl-form.js`):
 * cells that store one tag applying a function to a namespace, `<%
 * stilo.charts.line {x: ..., y: ..., title: "..."} %>`, written one member
 * per line, and show its output as HTML, like the base cell. Not a cell type
 * itself.
 *
 * A subclass sets `forms`, the kinds of thing it makes (a function and its
 * fields each), and `kindLabel`, the description of the drop-down that
 * chooses among them ("Chart type"); the drop-down is the first line of the
 * form. Changing the kind keeps the values of the fields the kinds share.
 *
 * Fields: `text` (saved as a Swan text, `"..."`: no `"` or `%>`), `choice`
 * (one option, saved as a text), `number`, and `expression` (Swan source,
 * checked by the Texl engine as it is typed, as the values of a data
 * table). An empty field writes no member; a `required` one refuses the
 * commit. A wrong field is outlined, with the reason as its tooltip, and
 * the cell refuses to commit until it is corrected. An unchanged form keeps
 * its source as written.
 *
 * The type accepts only such a tag, with the members of one of its forms,
 * each of a shape its field holds, or an empty source (a new form of the
 * first kind). A source of another shape (edited by hand) is edited as
 * text.
 */
export class FormCell extends TextCell {
    /** @type {Form[]} */
    static forms = [];

    /** The description of the drop-down of kinds. */
    static kindLabel = "Kind";

    static needs = "a form";

    /**
     * Reads the form of `source`: its kind and the text of each field, or
     * null if `source` is not one.
     * @param {string} source
     * @returns {{call: Call, form: Form, values: Record<string, string>} | null}
     */
    static readForm(source) {
        const call = parseCall(source);
        const form = call && this.forms.find((candidate) => candidate.call === call.call);
        if (!form) return null;
        const values = {};
        for (const [name, value] of call.members) {
            const field = form.fields.find((candidate) => candidate.key === name);
            const text = field && fieldText(field, value);
            if (text === null || text === undefined) return null;
            values[name] = text;
        }
        return { call, form, values };
    }

    static accepts(source) {
        return isBlank(source) || this.readForm(source) !== null;
    }

    static properties = {
        /** The kind of the form being edited, or null when the source is not a form. */
        _form: { state: true },
        /** The text in each field, by key, of every kind used while editing. */
        _values: { state: true },
        /** Why fields cannot be committed, by key. */
        _errors: { state: true },
    };

    static styles = [
        TextCell.styles,
        css`
            /* A chart, or other picture, spans the cell */
            .view svg {
                display: block;
                max-width: 100%;
                height: auto;
            }
        `,
    ];

    constructor() {
        super();
        this._form = null;
        this._values = {};
        this._errors = new Map();
        /** The checks still running, by key. */
        this._pending = new Map();
        /** The call read when editing started (or a new one), and its form as text. */
        this._call = null;
        this._parsed = "";
        /** The source read when editing started. */
        this._source = "";
    }

    fromTexl(texl) {
        super.fromTexl(texl);
        const cellType = /** @type {typeof FormCell} */ (this.constructor);
        this._source = this.input;
        const read = cellType.readForm(this.input);
        if (read) {
            this._call = read.call;
            this._form = read.form;
            this._values = read.values;
        } else if (isBlank(this.input)) {
            const before = this.input.trimEnd();
            this._call = { before: before ? before + "\n" : "", after: "", call: "", members: [] };
            this._form = cellType.forms[0] ?? null;
            this._values = {};
        } else {
            this._call = null;
            this._form = null;
            this._values = {};
        }
        this._parsed = this._formText();
        this._checkAll();
    }

    toTexl() {
        // An unchanged form keeps its source as written
        if (this._form && this._formText() !== this._parsed) {
            const members = this._form.fields
                .map((field) => [field.key, fieldSource(field, this._values[field.key] ?? "")])
                .filter(([, value]) => value !== null);
            this.input = serializeCall({ ...this._call, call: this._form.call, members });
        } else if (this._form) this.input = this._source;
        return super.toTexl();
    }

    /** The kind and the fields of the form being edited, as text, to compare. */
    _formText() {
        if (!this._form) return "";
        return JSON.stringify([this._form.call, this._form.fields.map((field) => this._values[field.key] ?? "")]);
    }

    inputError(texl) {
        if (!this._form) return super.inputError(texl);
        const fix = "correct it, or press Escape to discard the changes.";
        for (const field of this._form.fields) {
            const error = this._errors.get(field.key);
            if (error) return `${field.label}: ${error}: ${fix}`;
            if (field.required && !(this._values[field.key] ?? "").trim()) return `${field.label} is needed: fill it in, or press Escape to discard the changes.`;
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

    updated(changed) {
        // The text editor only exists for a source that is not a form
        if (this.mode !== "edit" || !this._form) super.updated(changed);
        else if (changed.has("mode")) this.focusEditor();
    }

    async focusEditor() {
        if (!this._form) return super.focusEditor();
        const form = this.renderRoot.querySelector("texl-form");
        await form?.updateComplete;
        form?.focusField();
    }

    /** The fields shown: the drop-down of kinds, then the fields of the kind. */
    _fields() {
        const cellType = /** @type {typeof FormCell} */ (this.constructor);
        const kinds = {
            key: KIND,
            label: cellType.kindLabel,
            type: "choice",
            options: cellType.forms.map((form) => ({ value: form.call, label: form.label })),
        };
        return [kinds, ...this._form.fields];
    }

    renderEditor() {
        if (!this._form) return super.renderEditor();
        return html`<texl-form
            .fields=${this._fields()}
            .values=${{ ...this._values, [KIND]: this._form.call }}
            .errors=${this._errors}
            @form-input=${(e) => this._setField(e.detail.key, e.detail.value)}
        ></texl-form>`;
    }

    _setField(key, value) {
        if (key === KIND) {
            const cellType = /** @type {typeof FormCell} */ (this.constructor);
            this._form = cellType.forms.find((form) => form.call === value) ?? this._form;
            this._checkAll();
            return;
        }
        this._values = { ...this._values, [key]: value };
        const field = this._form.fields.find((candidate) => candidate.key === key);
        if (field) this._check(field, value);
    }

    /** Checks every field of the kind being edited (each expression is checked once, then remembered). */
    _checkAll() {
        this._errors = new Map();
        this._pending = new Map();
        for (const field of this._form?.fields ?? []) this._check(field, this._values[field.key] ?? "");
    }

    /** Checks `field`, holding `text`, and marks it if it is wrong. */
    _check(field, text) {
        const { key } = field;
        const quick = fieldTextError(field, text);
        if (quick || field.type !== "expression") {
            this._pending.delete(key);
            return this._mark(key, quick);
        }
        const pending = expressionError(text).then((error) => {
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
