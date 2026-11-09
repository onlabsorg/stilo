import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { Marked } from "marked";
import { sanitizeOutput } from "../errors.js";
import { mathMarkdown, mathStyles, matchInlineMath } from "../math.js";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { TextCell } from "./text-cell.js";
import { TAG_OPEN, TAG_CLOSE } from "../swan.js";

// Markdown does not look inside a tag: its Swan code is not emphasis, links
// and the like. Tags are found within a paragraph or other inline text.
const texlTags = {
    defineNodes: ["TexlTag"],
    parseInline: [
        {
            name: "TexlTag",
            before: "Escape",
            parse(cx, next, pos) {
                if (cx.slice(pos, pos + TAG_OPEN.length) !== TAG_OPEN) return -1;
                const close = cx.slice(pos, cx.end).indexOf(TAG_CLOSE, TAG_OPEN.length);
                const end = close < 0 ? cx.end : pos + close + TAG_CLOSE.length;
                return cx.addElement(cx.elt("TexlTag", pos, end));
            },
        },
    ],
};

// Nor inside an equation: its LaTeX is not emphasis either.
const texlMath = {
    defineNodes: ["TexlMath"],
    parseInline: [
        {
            name: "TexlMath",
            before: "Emphasis",
            parse(cx, next, pos) {
                if (next !== 36 /* $ */) return -1;
                const math = matchInlineMath(cx.slice(pos, cx.end));
                return math ? cx.addElement(cx.elt("TexlMath", pos, pos + math.raw.length)) : -1;
            },
        },
    ],
};

const markdownParser = new Marked(mathMarkdown);

// A table's caption is an HTML <caption>, written on its own line right
// after the table (or right before it; between two tables it belongs to the
// one above). Markdown leaves it outside the table, where a browser would
// drop the element and keep only its text, so it is moved inside.
const CAPTION = String.raw`<caption\b[^>]*>[\s\S]*?<\/caption>`;
const CAPTION_AFTER = new RegExp(String.raw`<\/table>\s*(${CAPTION})`, "gi");
const CAPTION_BEFORE = new RegExp(String.raw`(${CAPTION})\s*(<table\b[^>]*>)`, "gi");

/**
 * Moves each `<caption>` that stands next to a table into it.
 * @param {string} html - The HTML of a Markdown rendering.
 * @returns {string}
 */
export function captionTables(html) {
    return html.replace(CAPTION_AFTER, "$1</table>").replace(CAPTION_BEFORE, "$2$1");
}

/**
 * A Markdown Texl template: the text cell, with Markdown highlighting in
 * the editor (the Swan highlighting of tags stays) and the output turned
 * from Markdown into HTML before it is shown, with equations typeset.
 */
export class MarkdownCell extends TextCell {
    static type = "markdown";

    static label = "Markdown";

    static key = "m";

    static styles = [TextCell.styles, mathStyles];

    static icon = html`<svg viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M6 15V9l3 3 3-3v6" />
        <path d="M17 9v6" />
        <path d="m15 13 2 2 2-2" />
    </svg>`;

    languageExtensions() {
        return [
            markdown({ extensions: [texlTags, texlMath] }),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            super.languageExtensions(),
        ];
    }

    /** Shows `output` as Markdown, sanitised: documents are untrusted. */
    renderView() {
        const content = sanitizeOutput(captionTables(markdownParser.parse(this.output)), this.errorMessages);
        return html`<div class="view">${unsafeHTML(content)}</div>`;
    }
}
