import { collect, isUndefined } from "@onlabsorg/texl";
import { TAG_CLOSE } from "./swan.js";
import { createEngine } from "./engine.js";

// The check of a value that a structured cell writes as Swan source inside its
// tag: an entry of a data table, an expression field of a form. Written in
// a list or a namespace, a value that does not parse would vanish silently,
// so these cells check each one as it is typed.

/**
 * Why `text` cannot be a value, as far as its text tells: it would end the
 * tag, or a comma outside brackets and texts would make two items (of a list)
 * or two members (of a namespace).
 */
function expressionTextError(text) {
    if (text.includes(TAG_CLOSE)) return `A value cannot contain “${TAG_CLOSE}”`;
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            const close = text.indexOf('"', i + 1);
            if (close < 0) return "";
            i = close;
        } else if ("([{".includes(c)) depth++;
        else if (")]}".includes(c)) depth--;
        else if (c === "," && depth === 0) return "A value cannot hold a comma outside brackets; for a tuple, write (a, b)";
    }
    return "";
}

// The engine the values are checked with, made on first use, and the
// checks done so far, by value
let checker = null;
const checked = new Map();

/**
 * Why `text` cannot be a value, or "": checked by the browser's Texl engine.
 * A value is accepted when, put alone in a namespace beside another member,
 * the namespace keeps both: a syntax error there would drop the value, and
 * others after it, from the list or namespace it is written in. The check
 * evaluates the value in an empty context (names are unknown there), so a
 * value that is merely undefined, such as `1 + "a"`, passes: it shows as
 * `[[Undefined]]`.
 * @param {string} text
 * @returns {Promise<string>}
 */
export function expressionError(text) {
    const value = text.trim();
    if (!value) return Promise.resolve("");
    const quick = expressionTextError(value);
    if (quick) return Promise.resolve(quick);
    if (!checked.has(value)) checked.set(value, checkExpression(value).catch(() => ""));
    return checked.get(value);
}

async function checkExpression(value) {
    checker ??= createEngine();
    const engine = await checker;
    const context = engine.createContext({});
    try {
        const probe = await context.render(`<% nspace.size {x__: (${value}), y__: 1} %>`);
        if (probe.text === "2") return "";
        const alone = await context.render(`<% ${value} %>`);
        const result = alone.tags[0]?.value;
        return isUndefined(result) ? `Not a valid value: ${result.description}` : "Not a single value";
    } finally {
        context.free();
        collect();
    }
}
