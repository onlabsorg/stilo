import { html } from "lit";
import { TextCell } from "./text-cell.js";
import { TAG_OPEN, TAG_CLOSE, swanExpression } from "../swan.js";

/**
 * @typedef {object} Formula
 * @property {string} before White space and comments before the tag.
 * @property {string | null} body The text between `<%` and `%>`, or null
 *   if there is no tag.
 * @property {string} after White space and comments after the tag.
 */

/**
 * Reads a formula: a source that is one tag, or nothing, with only white
 * space and HTML comments (cell comments among them) around it. Returns
 * null if the source has anything else, or a second tag.
 * @param {string} source
 * @returns {Formula | null}
 */
export function parseFormula(source) {
    let tag = null;
    for (let i = 0; i < source.length; ) {
        if (/\s/.test(source[i])) i++;
        else if (source.startsWith("<!--", i)) {
            const close = source.indexOf("-->", i + 4);
            if (close < 0) return null;
            i = close + 3;
        } else if (!tag && source.startsWith(TAG_OPEN, i)) {
            const close = source.indexOf(TAG_CLOSE, i + TAG_OPEN.length);
            if (close < 0) return null;
            tag = { from: i, to: close + TAG_CLOSE.length };
            i = tag.to;
        } else return null;
    }
    if (!tag) return { before: source, body: null, after: "" };
    return {
        before: source.slice(0, tag.from),
        body: source.slice(tag.from + TAG_OPEN.length, tag.to - TAG_CLOSE.length),
        after: source.slice(tag.to),
    };
}

/**
 * Writes a formula back as a source.
 * @param {Formula} formula
 * @returns {string}
 */
export function serializeFormula({ before, body, after }) {
    return before + (body === null ? "" : TAG_OPEN + body + TAG_CLOSE) + after;
}

/**
 * A formula: a cell that is one tag, `<% q * L ^ 2 / 8 %>`, edited as its
 * expression alone, `q * L ^ 2 / 8`, without the delimiters, and shown as
 * its output. Comments around the tag are kept, out of sight while
 * editing.
 *
 * The type accepts only a source that is one tag or nothing, with white
 * space and comments around it. An expression that would not stay one tag
 * (it contains `%>`) is not committed: the cell stays in edit mode and says
 * why. A source that is not a formula (e.g. edited by hand) is edited as
 * text, and must be a formula to be committed.
 */
export class FormulaCell extends TextCell {
    static type = "formula";

    static label = "Formula";

    static icon = html`<svg viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3" />
        <path d="M9 11.2h5.7" />
    </svg>`;

    static needs = "a single formula";

    static accepts(source) {
        return parseFormula(source) !== null;
    }

    constructor() {
        super();
        /** The formula read when editing started, or null if the source is not one. */
        this._formula = null;
    }

    fromTexl(texl) {
        super.fromTexl(texl);
        this._formula = parseFormula(this.input);
        if (this._formula) this.input = (this._formula.body ?? "").trim();
    }

    toTexl() {
        const formula = this._formula;
        if (!formula) return super.toTexl();
        const expression = (this.input ?? "").trim();
        // An unchanged expression keeps its source as written
        if (expression === (formula.body ?? "").trim()) return this.texl;
        const body = expression ? ` ${expression} ` : null;
        return serializeFormula({ ...formula, body }) + this._lineBreak;
    }

    inputError(texl) {
        if (this._formula && this.input.includes(TAG_CLOSE))
            return `A formula cannot contain “${TAG_CLOSE}”, which ends it: correct it, or press Escape to discard the changes.`;
        return super.inputError(texl);
    }

    languageExtensions() {
        return this._formula ? [swanExpression()] : super.languageExtensions();
    }
}
