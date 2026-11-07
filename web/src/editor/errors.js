// The errors of a rendered document, and how a cell shows them.
//
// An error is an undefined value that a tag returned, directly or as an item
// of a returned tuple: the Swan counterpart of an exception that was thrown.
// An undefined value that was only assigned, or that sits inside a list or a
// namespace, is not one, and neither is `Nothing`.
//
// The same rule is in src/stilo/cli/errors.py, for `stilo render`.

import DOMPurify from "dompurify";
import { isUndefined, Tuple } from "@onlabsorg/texl";
import { parseDocument, lineAtOffset, textLineAtOffset } from "./document.js";

/** How Texl renders an undefined value. */
const UNDEFINED_TEXT = "[[Undefined]]";

// An error's place in a rendering, until a cell has sanitised its output. The
// characters are for private use, so neither Markdown nor DOMPurify touches
// them. Markdown percent-encodes them in the address of a link.
const MARK_OPEN = "";
const MARK_CLOSE = "";
const MARK_IN_TEXT = /(\d+)/g;
const MARK_IN_ATTRIBUTE = /(?:|%EE%80%80)(\d+)(?:|%EE%80%81)/gi;
const MAY_HAVE_MARK = /|%EE%80%80/i;

/** Elements whose content is text only: an element inside would show as text. */
const TEXT_ONLY = new Set(["OPTION", "SCRIPT", "STYLE", "TEXTAREA", "TITLE"]);

/** The longest source line in `excerptAt`; longer ones are cut around `pos`. */
const MAX_EXCERPT = 80;

/**
 * Where an error was made.
 * @typedef {object} ErrorLocation
 * @property {string | null} uri - The document, or null for code run by Swan's `parse`.
 * @property {boolean} local - Whether it is the rendered document itself.
 * @property {number} pos - Index in `source`.
 * @property {string} source - The text `pos` is an index of.
 * @property {number | null} line - The line (cell) in that document, from 1.
 * @property {number | null} textLine - The line of text within that cell, from
 *   1; null if the cell has only one, or for parsed code.
 */

/**
 * One error of a document, with every line that returned it.
 * @typedef {object} DocumentError
 * @property {string} key - The same across renderings while the error stays.
 * @property {string} description - What went wrong, in plain words.
 * @property {string} rootCause - The description at the end of the chain of causes.
 * @property {ErrorLocation} location - Where it was made. A value with no
 *   position of its own points at the tag that returned it.
 * @property {{description: string, location: ErrorLocation | null}[]} causes -
 *   The undefined values that caused it, outermost first.
 * @property {number[]} lines - The lines that returned it, from 1.
 * @property {number} count - How many values were returned, repeats included.
 */

/**
 * A value returned in the rendering.
 * @typedef {object} ErrorPlace
 * @property {DocumentError} error
 * @property {number} line - From 1.
 * @property {number} start - Start of its text in the rendering.
 * @property {number} end - End of its text in the rendering.
 */

/**
 * Finds the errors of a rendered document. The same value returned by several
 * tags is one error with several places.
 * @param {import("@onlabsorg/texl").TexlDocument} doc
 * @param {import("./document.js").CellData[]} cells - The cells `doc` was rendered from.
 * @returns {{errors: DocumentError[], places: ErrorPlace[]}} `places` in order
 *   of the rendering.
 */
export function findErrors(doc, cells) {
    const found = new Map();
    const places = [];
    const sources = new Map([[doc.uri, { source: doc.source, cells }]]);
    for (const tag of doc.tags) {
        const line = lineAtOffset(cells, tag.start);
        for (const { value, start, end } of returnedValues(doc.text, tag)) {
            // A value with no position can only be told apart by its tag
            const where = value.pos !== null ? `${value.uri} ${value.pos}` : `tag ${tag.start}`;
            const key = `${where} ${value.description}`;
            if (!found.has(key)) {
                const tagLocation = {
                    uri: doc.uri,
                    local: true,
                    pos: tag.start,
                    source: doc.source,
                    line,
                    textLine: textLineAtOffset(cells, tag.start),
                };
                found.set(key, makeError(key, value, tagLocation, doc, sources));
            }
            const error = found.get(key);
            if (!error.lines.includes(line)) error.lines.push(line);
            error.count += 1;
            places.push({ error, line, start, end });
        }
    }
    return { errors: [...found.values()], places };
}

/** The undefined values `tag` returned, each with the span of its text. */
function* returnedValues(text, tag) {
    if (isUndefined(tag.value)) {
        yield { value: tag.value, start: tag.out_start, end: tag.out_end };
    } else if (tag.value instanceof Tuple) {
        // A tuple shows its items in order. A text item may itself read
        // "[[Undefined]]", so the search moves past each text item too.
        let cursor = tag.out_start;
        for (const item of tag.value) {
            if (isUndefined(item)) {
                const start = text.indexOf(UNDEFINED_TEXT, cursor);
                cursor = start + UNDEFINED_TEXT.length;
                yield { value: item, start, end: cursor };
            } else if (typeof item === "string") {
                const start = text.indexOf(item, cursor);
                if (start >= 0 && start + item.length <= tag.out_end) cursor = start + item.length;
            }
        }
    }
}

/** A `DocumentError` from an undefined value. */
function makeError(key, value, tagLocation, doc, sources) {
    const causes = [];
    for (let cause = value.cause; cause !== null; cause = cause.cause) {
        causes.push({ description: cause.description, location: locate(cause, doc, sources) });
    }
    return {
        key,
        description: value.description,
        rootCause: causes.at(-1)?.description ?? value.description,
        location: locate(value, doc, sources) ?? tagLocation,
        causes,
        lines: [],
        count: 0,
    };
}

/**
 * Where an undefined value was made, or null if it has no position.
 * `value.source` makes a new string each time it is read, so each document's
 * is read once.
 */
function locate(value, doc, sources) {
    if (value.pos === null) return null;
    const { uri, pos } = value;
    if (uri === null) return { uri, local: false, pos, source: value.source, line: null, textLine: null };
    if (!sources.has(uri)) {
        const source = value.source;
        sources.set(uri, { source, cells: parseDocument(source) });
    }
    const { source, cells } = sources.get(uri);
    return {
        uri,
        local: uri === doc.uri,
        pos,
        source,
        line: lineAtOffset(cells, pos),
        textLine: textLineAtOffset(cells, pos),
    };
}

/**
 * Replaces the text of each place in a span of a rendering with a mark holding
 * its index in `places`, for `sanitizeOutput` to find after Markdown has run.
 * @param {string} text
 * @param {ErrorPlace[]} places - In order of the rendering.
 * @param {{start: number, end: number}} span - The part of `text` to return.
 * @returns {string}
 */
export function markErrors(text, places, span) {
    let marked = "";
    let from = span.start;
    places.forEach(({ start, end }, i) => {
        if (start < span.start || end > span.end) return;
        marked += text.slice(from, start) + MARK_OPEN + i + MARK_CLOSE;
        from = end;
    });
    return marked + text.slice(from, span.end);
}

/**
 * Sanitises a cell's HTML output: documents are untrusted. Then shows the
 * marks of `markErrors` as highlighted `[[Undefined]]` values, carrying the
 * mark's index in `data-error`. A mark inside an attribute, such as the
 * address of a link, becomes the plain text: nothing there can be highlighted.
 * @param {string} output
 * @param {string[]} [messages] - The hover text of each mark, by index.
 * @returns {string} Safe HTML.
 */
export function sanitizeOutput(output, messages = []) {
    if (!MAY_HAVE_MARK.test(output)) return DOMPurify.sanitize(output);
    const fragment = DOMPurify.sanitize(output, { RETURN_DOM_FRAGMENT: true });
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
        if (node.nodeType === Node.TEXT_NODE) showMarks(node, messages);
        else
            for (const attribute of node.attributes) {
                attribute.value = attribute.value.replace(MARK_IN_ATTRIBUTE, UNDEFINED_TEXT);
            }
    }
    const box = document.createElement("div");
    box.append(fragment);
    return box.innerHTML;
}

/** Replaces the marks in a text node with highlighted values. */
function showMarks(node, messages) {
    const text = node.data;
    if (TEXT_ONLY.has(node.parentNode.nodeName)) {
        node.data = text.replace(MARK_IN_TEXT, UNDEFINED_TEXT);
        return;
    }
    const parts = [];
    let from = 0;
    for (const match of text.matchAll(MARK_IN_TEXT)) {
        parts.push(text.slice(from, match.index));
        const value = document.createElement("span");
        value.className = "undefined-value";
        value.dataset.error = match[1];
        value.title = messages[match[1]] ?? "";
        value.textContent = UNDEFINED_TEXT;
        parts.push(value);
        from = match.index + match[0].length;
    }
    if (from === 0) return;
    node.replaceWith(...parts, text.slice(from));
}

/**
 * The source line holding `pos`, split around it to show where an error is.
 * @param {string} source
 * @param {number} pos
 * @returns {{before: string, at: string, after: string}} `at` is the character
 *   at `pos`, or a space at the end of the line.
 */
export function excerptAt(source, pos) {
    let start = source.lastIndexOf("\n", pos - 1) + 1;
    if (pos === 0) start = 0;
    let end = source.indexOf("\n", pos);
    if (end < 0) end = source.length;
    if (source[end - 1] === "\r") end -= 1;
    if (end - start > MAX_EXCERPT) {
        start = Math.max(start, Math.min(pos - MAX_EXCERPT / 2, end - MAX_EXCERPT));
        end = start + MAX_EXCERPT;
    }
    return {
        before: source.slice(start, pos),
        at: pos < end ? source[pos] : " ",
        after: source.slice(pos + 1, end),
    };
}
