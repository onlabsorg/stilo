// What a rich text cell can hold: the document model of its ProseMirror
// editor. Everything here has a Markdown form (`markdown.js`); a source with
// anything else is not accepted by the cell type.

import { Schema } from "prosemirror-model";
import { tagSpans } from "../document.js";
import { matchInlineMath } from "../math.js";

const SAFE_URL = /^(?:https?:|mailto:|tel:|#|[^:]*$|<%)/i;

/** A link or image address, or nothing if it could run a script. */
export function safeUrl(url) {
    return SAFE_URL.test(url.trim()) ? url : "";
}

/** Whether `source` is exactly one tag. Pasted HTML can claim anything. */
export function isOneTag(source) {
    const tags = tagSpans(source);
    return tags.length === 1 && tags[0].start === 0 && tags[0].end === source.length;
}

/** Whether `tex` stays one equation when written between dollars. */
export function isOneEquation(tex, display = false) {
    const fence = display ? "$$" : "$";
    const raw = fence + tex + fence;
    return matchInlineMath(raw)?.raw === raw;
}

function headings() {
    return [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } }));
}

export const schema = new Schema({
    nodes: {
        doc: { content: "block+" },
        paragraph: {
            content: "inline*",
            group: "block",
            parseDOM: [{ tag: "p" }],
            toDOM: () => ["p", 0],
        },
        heading: {
            attrs: { level: { default: 1 } },
            content: "inline*",
            group: "block",
            defining: true,
            parseDOM: headings(),
            toDOM: (node) => [`h${node.attrs.level}`, 0],
        },
        blockquote: {
            content: "block+",
            group: "block",
            defining: true,
            parseDOM: [{ tag: "blockquote" }],
            toDOM: () => ["blockquote", 0],
        },
        code_block: {
            attrs: { lang: { default: "" } },
            content: "text*",
            marks: "",
            group: "block",
            code: true,
            defining: true,
            parseDOM: [{ tag: "pre", preserveWhitespace: "full" }],
            toDOM: () => ["pre", ["code", 0]],
        },
        horizontal_rule: {
            group: "block",
            parseDOM: [{ tag: "hr" }],
            toDOM: () => ["hr"],
        },
        // An equation on lines of its own: `tex` is all that is between the $$
        math_block: {
            attrs: { tex: {} },
            group: "block",
            atom: true,
            parseDOM: [{ tag: "div[data-tex]", getAttrs: (dom) => isOneEquation(dom.dataset.tex, true) && { tex: dom.dataset.tex } }],
            toDOM: (node) => ["div", { "data-tex": node.attrs.tex }, node.attrs.tex],
        },
        bullet_list: {
            attrs: { tight: { default: true } },
            content: "list_item+",
            group: "block",
            parseDOM: [{ tag: "ul" }],
            toDOM: (node) => ["ul", node.attrs.tight ? { "data-tight": "" } : {}, 0],
        },
        ordered_list: {
            attrs: { start: { default: 1 }, tight: { default: true } },
            content: "list_item+",
            group: "block",
            parseDOM: [{ tag: "ol", getAttrs: (dom) => ({ start: Number(dom.getAttribute("start") ?? 1) || 1 }) }],
            toDOM: ({ attrs }) => ["ol", { start: attrs.start === 1 ? null : attrs.start, "data-tight": attrs.tight ? "" : null }, 0],
        },
        list_item: {
            content: "paragraph block*",
            defining: true,
            parseDOM: [{ tag: "li" }],
            toDOM: () => ["li", 0],
        },
        text: { group: "inline" },
        hard_break: {
            inline: true,
            group: "inline",
            selectable: false,
            parseDOM: [{ tag: "br" }],
            toDOM: () => ["br"],
        },
        // A Texl tag: `source` is the whole tag, `<% ... %>`
        tag: {
            inline: true,
            group: "inline",
            atom: true,
            attrs: { source: {} },
            parseDOM: [{ tag: "span[data-tag]", getAttrs: (dom) => isOneTag(dom.dataset.tag) && { source: dom.dataset.tag } }],
            toDOM: (node) => ["span", { "data-tag": node.attrs.source }, node.attrs.source],
        },
        // An equation in the text; `display` if written between $$
        math: {
            inline: true,
            group: "inline",
            atom: true,
            attrs: { tex: {}, display: { default: false } },
            parseDOM: [{ tag: "span[data-tex]", getAttrs: (dom) => isOneEquation(dom.dataset.tex) && { tex: dom.dataset.tex } }],
            toDOM: (node) => ["span", { "data-tex": node.attrs.tex }, node.attrs.tex],
        },
        image: {
            inline: true,
            group: "inline",
            atom: true,
            attrs: { src: {}, alt: { default: "" }, title: { default: "" } },
            parseDOM: [
                {
                    tag: "img[src]",
                    getAttrs: (dom) => ({
                        src: dom.getAttribute("src"),
                        alt: dom.getAttribute("alt") ?? "",
                        title: dom.getAttribute("title") ?? "",
                    }),
                },
            ],
            toDOM: ({ attrs }) => ["img", { src: safeUrl(attrs.src), alt: attrs.alt, title: attrs.title || null }],
        },
    },
    // In the order they nest when they span the same text; `code` is innermost
    marks: {
        link: {
            attrs: { href: {}, title: { default: "" } },
            inclusive: false,
            parseDOM: [
                {
                    tag: "a[href]",
                    getAttrs: (dom) => ({ href: dom.getAttribute("href"), title: dom.getAttribute("title") ?? "" }),
                },
            ],
            toDOM: ({ attrs }) => ["a", { href: safeUrl(attrs.href), title: attrs.title || null }, 0],
        },
        em: {
            parseDOM: [{ tag: "i" }, { tag: "em" }, { style: "font-style=italic" }],
            toDOM: () => ["em", 0],
        },
        strong: {
            parseDOM: [
                { tag: "strong" },
                // Word and Google Docs paste a <b> that is not bold
                { tag: "b", getAttrs: (dom) => dom.style.fontWeight !== "normal" && null },
                { style: "font-weight", getAttrs: (value) => /^(?:bold(?:er)?|[6-9]\d\d)$/.test(value) && null },
            ],
            toDOM: () => ["strong", 0],
        },
        underline: {
            parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }],
            toDOM: () => ["u", 0],
        },
        strike: {
            parseDOM: [{ tag: "del" }, { tag: "s" }, { tag: "strike" }, { style: "text-decoration=line-through" }],
            toDOM: () => ["del", 0],
        },
        sub: {
            excludes: "sup",
            parseDOM: [{ tag: "sub" }],
            toDOM: () => ["sub", 0],
        },
        sup: {
            excludes: "sub",
            parseDOM: [{ tag: "sup" }],
            toDOM: () => ["sup", 0],
        },
        code: {
            parseDOM: [{ tag: "code" }],
            toDOM: () => ["code", 0],
        },
    },
});
