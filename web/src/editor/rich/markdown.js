// The rich text cell's bridge between its source, Markdown with Texl tags, and
// the document of its editor. It reads Markdown with `marked`, the parser that
// shows the output, so the two cannot disagree on what a source means.
//
// Texl finds its tags before anything else reads the text. So does this: each
// tag is replaced by a placeholder, which Markdown takes for a word, and comes
// back as a tag node in text, or as its source where Markdown keeps text as it
// is (code, equations, addresses). HTML comments are cell-level: they are taken
// out and written back after the content.
//
// An edit should change no more of the file than it has to: an unchanged block
// keeps its source as written, and an unchanged document all of it.
//
// `acceptsRich` is the guard: a source is accepted only if the writer's form of
// it shows the same as the source. So nothing the editor cannot hold is lost.

import { Marked } from "marked";
import { isBlank, tagSpans } from "../document.js";
import { mathMarkdown } from "../math.js";
import { schema } from "./schema.js";

const { nodes, marks } = schema;
const markdown = new Marked(mathMarkdown);

const PLACEHOLDER_OPEN = "";
const PLACEHOLDER_CLOSE = "";
const PLACEHOLDER = /(\d+)/g;
const PLACEHOLDER_SPLIT = /(\d+)/;
const COMMENT = /<!--[\s\S]*?-->/g;

/** Thrown for what a rich text cell cannot hold. */
class Unsupported extends Error {}

/**
 * @typedef {object} RichSource
 * @property {import("prosemirror-model").Node} doc
 * @property {string} source - The source it was read from.
 * @property {string[]} comments - The HTML comments of the source, in order.
 * @property {Map<string, string>} written - The source of each block as
 *   written, by the block's JSON.
 * @property {{key: string, gap: string}[]} order - The blocks in order of the
 *   source, with the text between each and the next.
 */

function protect(source) {
    const tags = [];
    let text = "";
    let from = 0;
    for (const { start, end } of tagSpans(source)) {
        text += source.slice(from, start) + PLACEHOLDER_OPEN + tags.length + PLACEHOLDER_CLOSE;
        tags.push(source.slice(start, end));
        from = end;
    }
    return { text: text + source.slice(from), tags };
}

function decodeEntities(text) {
    if (!text.includes("&")) return text;
    const box = document.createElement("textarea");
    box.innerHTML = text;
    return box.value;
}

/** Reads the tokens of `marked` into the nodes of the editor. */
class Reader {
    constructor(tags) {
        this.tags = tags;
    }

    restore(text) {
        return text.replace(PLACEHOLDER, (_, index) => this.tags[index]);
    }

    blocks(tokens) {
        return tokens.flatMap((token) => this.block(token));
    }

    block(token) {
        switch (token.type) {
            case "space":
                return [];
            case "paragraph":
            case "text":
                return [nodes.paragraph.create(null, this.inline(token.tokens ?? [token]))];
            case "heading":
                return [nodes.heading.create({ level: token.depth }, this.inline(token.tokens))];
            case "blockquote":
                return [nodes.blockquote.create(null, orEmpty(this.blocks(token.tokens)))];
            case "code": {
                const text = this.restore(token.text);
                const lang = token.lang ?? "";
                return [nodes.code_block.create({ lang }, text ? schema.text(text) : null)];
            }
            case "hr":
                return [nodes.horizontal_rule.create()];
            case "mathBlock":
                return [nodes.math_block.create({ tex: this.restore(token.tex) })];
            case "list":
                return [this.list(token)];
            case "html":
                if (!token.text.trim()) return [];
                throw new Unsupported("raw HTML");
            default:
                throw new Unsupported(token.type);
        }
    }

    list(token) {
        const items = token.items.map((item) => {
            if (item.task) throw new Unsupported("a task list");
            const content = orEmpty(this.blocks(item.tokens));
            if (content[0].type !== nodes.paragraph) throw new Unsupported("a list item without text first");
            return nodes.list_item.create(null, content);
        });
        const attrs = { tight: !token.loose };
        if (token.ordered) return nodes.ordered_list.create({ ...attrs, start: token.start === "" ? 1 : token.start }, items);
        return nodes.bullet_list.create(attrs, items);
    }

    inline(tokens, active = []) {
        const result = [];
        const open = []; // The marks opened by inline HTML in these tokens
        const current = () => [...active, ...open];
        for (const token of tokens) {
            switch (token.type) {
                case "text":
                    if (token.tokens) result.push(...this.inline(token.tokens, current()));
                    else result.push(...this.text(decodeEntities(token.text), current()));
                    break;
                case "escape":
                    result.push(...this.text(decodeEntities(token.text), current()));
                    break;
                case "strong":
                    result.push(...this.inline(token.tokens, [...current(), marks.strong.create()]));
                    break;
                case "em":
                    result.push(...this.inline(token.tokens, [...current(), marks.em.create()]));
                    break;
                case "del":
                    result.push(...this.inline(token.tokens, [...current(), marks.strike.create()]));
                    break;
                case "codespan":
                    result.push(schema.text(this.restore(token.text), withMarks(current(), marks.code.create())));
                    break;
                case "br":
                    result.push(nodes.hard_break.create(null, null, withMarks(current())));
                    break;
                case "link": {
                    const mark = marks.link.create({ href: this.restore(token.href), title: token.title ?? "" });
                    result.push(...this.inline(token.tokens, [...current(), mark]));
                    break;
                }
                case "image":
                    result.push(
                        nodes.image.create(
                            { src: this.restore(token.href), alt: this.restore(token.text), title: token.title ?? "" },
                            null,
                            withMarks(current()),
                        ),
                    );
                    break;
                case "mathInline":
                    result.push(
                        nodes.math.create({ tex: this.restore(token.tex), display: token.display }, null, withMarks(current())),
                    );
                    break;
                case "html":
                    this.inlineHtml(token.text, open, result, current);
                    break;
                default:
                    throw new Unsupported(token.type);
            }
        }
        if (open.length > 0) throw new Unsupported("an unclosed HTML tag");
        return result;
    }

    inlineHtml(text, open, result, current) {
        const match = /^<(\/?)([a-z]+)\s*\/?>$/i.exec(text.trim());
        const name = match?.[2].toLowerCase();
        if (name === "br" && !match[1]) {
            result.push(nodes.hard_break.create(null, null, withMarks(current())));
            return;
        }
        const type = HTML_MARKS[name];
        if (!type) throw new Unsupported("raw HTML");
        if (!match[1]) open.push(type.create());
        else if (open.at(-1)?.type === type) open.pop();
        else throw new Unsupported("unbalanced HTML");
    }

    text(text, active) {
        // A line break within a paragraph is a space to a reader
        const parts = text.replace(/[ \t]*\n[ \t]*/g, " ").split(PLACEHOLDER_SPLIT);
        return parts.flatMap((part, i) => {
            if (!part) return [];
            if (i % 2 === 0) return [schema.text(part, withMarks(active))];
            const source = this.tags[part.slice(1, -1)];
            return [nodes.tag.create({ source }, null, withMarks(active))];
        });
    }
}

const HTML_MARKS = {
    u: marks.underline,
    sub: marks.sub,
    sup: marks.sup,
    strong: marks.strong,
    b: marks.strong,
    em: marks.em,
    i: marks.em,
    del: marks.strike,
    s: marks.strike,
};

function withMarks(active, ...more) {
    return [...active, ...more].reduce((set, mark) => mark.addToSet(set), []);
}

function orEmpty(blocks) {
    return blocks.length > 0 ? blocks : [nodes.paragraph.create()];
}

function parseBlocks(text, tags) {
    return new Reader(tags).blocks(markdown.lexer(text));
}

/**
 * Reads a source into the document of the editor.
 * @param {string} source
 * @returns {RichSource | null} Null if the source has what the editor cannot hold.
 */
export function parseRich(source) {
    if (source.includes(PLACEHOLDER_OPEN) || source.includes(PLACEHOLDER_CLOSE)) return null;
    const { text, tags } = protect(source);
    const comments = [];
    const content = text.replace(COMMENT, (comment) => {
        comments.push(comment);
        return "";
    });
    const reader = new Reader(tags);
    const written = new Map();
    const order = [];
    const blocks = [];
    try {
        for (const token of markdown.lexer(content)) {
            const made = reader.block(token);
            if (made.length === 0) {
                if (order.length > 0) order.at(-1).gap += token.raw;
                continue;
            }
            const [node] = made;
            const raw = reader.restore(token.raw);
            const body = raw.replace(/\s+$/, "");
            const key = JSON.stringify(node.toJSON());
            if (!written.has(key)) written.set(key, body);
            order.push({ key, gap: raw.slice(body.length) });
            blocks.push(node);
        }
    } catch (error) {
        if (error instanceof Unsupported) return null;
        throw error;
    }
    return {
        doc: nodes.doc.create(null, orEmpty(blocks)),
        source,
        comments: comments.map((comment) => reader.restore(comment)),
        written,
        order,
    };
}

/**
 * The paragraphs of a plain text: a line each, with its tags as tag nodes.
 * @param {string} plain
 * @returns {import("prosemirror-model").Node[]}
 */
export function paragraphsOfText(plain) {
    const { text, tags } = protect(plain);
    const reader = new Reader(tags);
    return text.split(/\r?\n/).map((line) => nodes.paragraph.create(null, reader.text(line, [])));
}

/** What the marks are written as: in Markdown or, when that fails, in HTML. */
const DELIMITERS = {
    em: ["*", "*"],
    strong: ["**", "**"],
    strike: ["~~", "~~"],
    underline: ["<u>", "</u>"],
    sub: ["<sub>", "</sub>"],
    sup: ["<sup>", "</sup>"],
};
const HTML_DELIMITERS = {
    ...DELIMITERS,
    em: ["<em>", "</em>"],
    strong: ["<strong>", "</strong>"],
    strike: ["<del>", "</del>"],
};

function escapeText(text, escapeDollars) {
    let result = text
        .replace(/\\/g, "\\\\")
        .replace(/[*`[\]~]/g, "\\$&")
        .replace(/(^|[^\p{L}\p{N}])_|_(?=$|[^\p{L}\p{N}])/gu, (match) => match.replace("_", "\\_"))
        .replace(/&(?=#?\w+;)/g, "&amp;")
        .replace(/<(?=[%!/?a-zA-Z])/g, "&lt;")
        .replace(/%>/g, "%&gt;")
        .replace(/\n/g, " ");
    if (escapeDollars) result = result.replace(/\$/g, "\\$");
    return result;
}

function escapeLineStart(line) {
    return line
        .replace(/^[ \t]+/, "")
        .replace(/^#{1,6}(?=\s|$)/, "\\$&")
        .replace(/^>/, "\\>")
        .replace(/^[-+](?=\s|$)/, "\\$&")
        .replace(/^(\d+)([.)])(?=\s|$)/, "$1\\$2")
        .replace(/^(?:-{3,}|={1,})[ \t]*$/, "\\$&");
}

function inlineCode(text) {
    const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
    const fence = "`".repeat(longest + 1);
    const pad = text.startsWith("`") || text.endsWith("`") || /^ .* $/.test(text) ? " " : "";
    return fence + pad + text + pad + fence;
}

function address(url, title) {
    const outsideTags = url.replace(/<%[\s\S]*?%>/g, "");
    const written = /[\s()]/.test(outsideTags) ? `<${url}>` : url;
    return title ? `${written} "${title.replace(/"/g, '\\"')}"` : written;
}

/** The runs of text and inline nodes of a text block, with white space moved out of marks. */
function inlineRuns(node) {
    const children = [];
    node.forEach((child) => children.push(child));
    const runs = [];
    const onlyAlso = (child, neighbour) => child.marks.filter((mark) => mark.type === marks.code || neighbour?.marks.some((other) => other.eq(mark)));
    children.forEach((child, i) => {
        if (!child.isText || child.marks.some((mark) => mark.type === marks.code)) {
            runs.push({ node: child, marks: child.marks });
            return;
        }
        const [, lead, inner, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(child.text);
        if (lead) runs.push({ text: lead, marks: onlyAlso(child, children[i - 1]) });
        if (inner) runs.push({ text: inner, marks: child.marks });
        if (trail) runs.push({ text: trail, marks: onlyAlso(child, children[i + 1]) });
    });
    return runs;
}

function writeInline(node, delimiters, inHeading) {
    const dollars = (node.textContent.match(/\$/g) ?? []).length > 1;
    const stack = [];
    let out = "";
    const close = (mark) => {
        if (mark.type === marks.link) out += `](${address(mark.attrs.href, mark.attrs.title)})`;
        else out += delimiters[mark.type.name][1];
    };
    const runs = inlineRuns(node);
    for (const run of runs) {
        const wanted = run.marks.filter((mark) => mark.type !== marks.code);
        let keep = 0;
        while (keep < stack.length && wanted.some((mark) => mark.eq(stack[keep]))) keep++;
        while (stack.length > keep) close(stack.pop());
        for (const mark of wanted) {
            if (stack.some((other) => other.eq(mark))) continue;
            out += mark.type === marks.link ? "[" : delimiters[mark.type.name][0];
            stack.push(mark);
        }
        if (run.text !== undefined) out += escapeText(run.text, dollars);
        else if (run.node.isText) out += inlineCode(run.node.text);
        else if (run.node.type === nodes.tag) out += run.node.attrs.source;
        else if (run.node.type === nodes.hard_break) out += inHeading || run === runs.at(-1) ? "<br>" : "\\\n";
        else if (run.node.type === nodes.math) {
            const fence = run.node.attrs.display ? "$$" : "$";
            out += fence + run.node.attrs.tex + fence;
        } else if (run.node.type === nodes.image) {
            const { src, alt, title } = run.node.attrs;
            out += `![${escapeText(alt, false)}](${address(src, title)})`;
        }
    }
    while (stack.length > 0) close(stack.pop());
    return out;
}

function sameInline(text, node) {
    const { text: protectedText, tags } = protect(text);
    try {
        const [block, ...more] = parseBlocks(protectedText, tags);
        if (more.length > 0 || block?.type !== nodes.paragraph) return false;
        const shape = (content) =>
            JSON.stringify(content.toJSON() ?? []).replace(/\s+/g, " ");
        return shape(block.content) === shape(node.content);
    } catch (error) {
        if (error instanceof Unsupported) return false;
        throw error;
    }
}

/** The Markdown of a text block's content. */
function inlineOf(node, inHeading = false) {
    const finish = (text) => text.split("\n").map(escapeLineStart).join("\n");
    const written = finish(writeInline(node, DELIMITERS, inHeading));
    if (node.childCount === 0 || sameInline(written, node)) return written;
    const html = finish(writeInline(node, HTML_DELIMITERS, inHeading));
    return sameInline(html, node) ? html : written;
}

function indent(text, by) {
    return text.split("\n").map((line, i) => (i === 0 || !line ? line : by + line)).join("\n");
}

function writeList(list, alternate) {
    const ordered = list.type === nodes.ordered_list;
    const items = [];
    list.forEach((item) => items.push(item));
    const loose = !list.attrs.tight || items.some((item) => {
        const blocks = [];
        item.forEach((child) => blocks.push(child));
        return blocks.filter((child) => child.type !== nodes.bullet_list && child.type !== nodes.ordered_list).length > 1;
    });
    return items
        .map((item, i) => {
            const marker = ordered ? `${list.attrs.start + i}${alternate ? ")" : "."} ` : `${alternate ? "*" : "-"} `;
            return marker + indent(writeBlocks(item, loose ? "\n\n" : "\n"), " ".repeat(marker.length));
        })
        .join(loose ? "\n\n" : "\n");
}

function writeBlock(node, previous) {
    switch (node.type) {
        case nodes.paragraph:
            return inlineOf(node);
        case nodes.heading: {
            const text = inlineOf(node, true).replace(/(^|\s)(#+)\s*$/, (match) => match.replace(/#/g, "\\#"));
            return `${"#".repeat(node.attrs.level)} ${text}`;
        }
        case nodes.blockquote:
            return writeBlocks(node, "\n\n")
                .split("\n")
                .map((line) => (line ? `> ${line}` : ">"))
                .join("\n");
        case nodes.code_block: {
            const longest = Math.max(2, ...(node.textContent.match(/^ {0,3}`+/gm) ?? []).map((run) => run.trim().length));
            const fence = "`".repeat(longest + 1);
            return `${fence}${node.attrs.lang}\n${node.textContent}\n${fence}`;
        }
        case nodes.horizontal_rule:
            return "---";
        case nodes.math_block:
            return `$$${node.attrs.tex}$$`;
        case nodes.bullet_list:
        case nodes.ordered_list:
            return writeList(node, previous?.type === node.type);
        default:
            return node.textContent;
    }
}

function isEmptyParagraph(node) {
    return node.type === nodes.paragraph && node.childCount === 0;
}

function writeBlocks(parent, separator) {
    const out = [];
    let previous = null;
    parent.forEach((child, _, index) => {
        // Markdown has no empty paragraphs, except the one that starts an item
        if (isEmptyParagraph(child) && !(index === 0 && parent.type === nodes.list_item)) return;
        out.push(writeBlock(child, previous));
        previous = child;
    });
    return out.join(separator);
}

/**
 * Writes the document of the editor as a source.
 * @param {import("prosemirror-model").Node} doc
 * @param {RichSource} [from] - What it was read from: an unchanged document
 *   keeps that source, and an unchanged block its text.
 * @param {string[]} [comments] - The cell's comments; those of `from` by default.
 * @returns {string}
 */
export function serializeRich(doc, from, comments = from?.comments ?? []) {
    if (from && doc.eq(from.doc) && comments.length === from.comments.length) return from.source;
    const parts = [];
    let previous = null;
    let previousOrder = -1;
    doc.forEach((child) => {
        if (isEmptyParagraph(child)) return;
        const key = JSON.stringify(child.toJSON());
        const order = from ? from.order.findIndex((block, i) => i > previousOrder && block.key === key) : -1;
        const text = from?.written.get(key) ?? writeBlock(child, previous);
        // Blocks that were neighbours keep what was between them
        const gap = order >= 0 && order === previousOrder + 1 && previousOrder >= 0 ? from.order[previousOrder].gap : "\n\n";
        parts.push(parts.length > 0 ? gap || "\n\n" : "", text);
        previous = child;
        if (order >= 0) previousOrder = order;
    });
    const body = parts.join("");
    if (comments.length === 0) return body;
    return (body ? `${body}\n` : "") + comments.join("\n");
}

// Marks are sets, whatever the order or the splitting of their HTML elements
const FORMATTING = { STRONG: "strong", B: "strong", EM: "em", I: "em", U: "u", DEL: "del", S: "del", SUB: "sub", SUP: "sup" };
const BLOCKS = /^(?:P|H[1-6]|UL|OL|LI|BLOCKQUOTE|HR|PRE|DIV)$/;

/** What an HTML shows, as a text that does not depend on how it was written. */
function shownAs(html) {
    const box = document.createElement("template");
    box.innerHTML = html;
    let out = "";
    let lastMarks = null;
    const walk = (parent, active, keepSpace) => {
        for (const child of parent.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = keepSpace ? child.data : child.data.replace(/\s+/g, " ");
                if (!text) continue;
                const key = [...active].sort().join(",");
                if (key !== lastMarks) out += `{${key}}`;
                lastMarks = key;
                out += text;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const mark = FORMATTING[child.nodeName];
                if (mark) {
                    walk(child, new Set(active).add(mark), keepSpace);
                    continue;
                }
                const attributes = [...child.attributes].map(({ name, value }) => `${name}=${value}`).sort().join(" ");
                const block = BLOCKS.test(child.nodeName);
                out += `${block ? "\n" : ""}<${child.nodeName} ${attributes}>`;
                lastMarks = null;
                walk(child, active, keepSpace || child.nodeName === "PRE" || child.nodeName === "CODE");
                out += `</${child.nodeName}>${block ? "\n" : ""}`;
                lastMarks = null;
            }
        }
    };
    walk(box.content, new Set(), false);
    return out
        .replace(/\s*\n\s*/g, "\n")
        .replace(/\{[^{}]*\}\s*\n/g, "\n")
        .trim();
}

/**
 * Whether a rich text cell can edit `source` and lose nothing: the writer's
 * form of it must show the same as the source.
 * @param {string} source
 * @returns {boolean}
 */
export function acceptsRich(source) {
    if (isBlank(source)) return true;
    const read = parseRich(source);
    if (!read) return false;
    const written = serializeRich(read.doc);
    return shownAs(markdown.parse(protect(source).text)) === shownAs(markdown.parse(protect(written).text));
}
