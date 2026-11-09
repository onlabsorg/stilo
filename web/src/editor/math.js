// Equations in Markdown: LaTeX between $...$ (in the text) or $$...$$ (on
// lines of their own), typeset by KaTeX. Dollars follow Pandoc's rule, so
// that amounts of money stay text: "$5 and $10" is no equation. `\$` is a
// plain dollar.

import katex from "katex";
import katexStyles from "katex/dist/katex.min.css?inline";
import { unsafeCSS } from "lit";
import { hasErrorMark } from "./errors.js";

// The opening $ has no white space after it, the closing one none before it
// and no digit after it. A \$ inside an equation does not close it.
const INLINE = /^\$(?!\s)((?:\\[\s\S]|[^$\\])+?)(?<!\s)\$(?!\d)/;
const DISPLAY_INLINE = /^\$\$((?:\\[\s\S]|[^$\\])+?)\$\$/;
const DISPLAY_BLOCK = /^ {0,3}\$\$((?:\\[\s\S]|[^$\\])+?)\$\$[ \t]*(?:\n+|$)/;
const BLANK_LINE = /\n[ \t]*\n/;

const FONT_FACE = /@font-face\s*\{[^}]*\}/g;
let fontsInstalled = false;

/**
 * The styles of typeset equations, for the styles of a cell that shows them.
 * The fonts are not in here: a browser ignores fonts declared in a shadow
 * root, so `installFonts` declares them in the document.
 */
export const mathStyles = unsafeCSS(`
    ${katexStyles.replace(FONT_FACE, "")}
    /* KaTeX enlarges equations by 1.21 to make up for the small x-height of
       its font; the text font's is large (0.50 against 0.43), so 1.08 keeps
       letters and digits close to the text's in size */
    .katex {
        font-size: var(--texl-math-size, 1.08em);
    }
    .katex-display {
        overflow-x: auto;
        overflow-y: hidden;
    }
`);

function installFonts() {
    if (fontsInstalled) return;
    fontsInstalled = true;
    const style = document.createElement("style");
    style.textContent = katexStyles.match(FONT_FACE).join("\n");
    document.head.append(style);
}

/**
 * The inline equation at the start of `text`, for the Markdown parser and
 * the source highlighting.
 * @param {string} text
 * @returns {{raw: string, tex: string, display: boolean} | null}
 */
export function matchInlineMath(text) {
    const match = DISPLAY_INLINE.exec(text) ?? INLINE.exec(text);
    if (!match || BLANK_LINE.test(match[1])) return null;
    return { raw: match[0], tex: match[1], display: match[0].startsWith("$$") };
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The HTML of an equation; bad LaTeX shows in red with the reason on hover.
 * An equation holding the mark of an undefined value stays source text, so
 * that the value can be highlighted and clicked as anywhere else.
 */
function typeset({ raw, tex, display }) {
    if (hasErrorMark(raw)) return escapeHtml(raw.trim());
    installFonts();
    return katex.renderToString(tex, {
        displayMode: display,
        output: "html",
        throwOnError: false,
        errorColor: "var(--texl-error, #b91c1c)",
        strict: "ignore",
        trust: false, // documents are untrusted: no links, classes or images
    });
}

/**
 * The HTML of one equation, for what shows equations outside Markdown.
 * @param {string} tex
 * @param {boolean} display
 * @returns {string}
 */
export function typesetEquation(tex, display) {
    return typeset({ raw: tex, tex, display });
}

/** The `marked` extensions that find equations and typeset them. */
export const mathMarkdown = {
    extensions: [
        {
            name: "mathBlock",
            level: "block",
            start: (src) => src.match(/^ {0,3}\$\$/m)?.index,
            tokenizer(src) {
                const match = DISPLAY_BLOCK.exec(src);
                if (!match || BLANK_LINE.test(match[1])) return undefined;
                return { type: "mathBlock", raw: match[0], tex: match[1], display: true };
            },
            renderer: (token) => `<p>${typeset(token)}</p>\n`,
        },
        {
            name: "mathInline",
            level: "inline",
            start: (src) => {
                const index = src.indexOf("$");
                return index < 0 ? undefined : index;
            },
            tokenizer(src) {
                const math = matchInlineMath(src);
                return math ? { type: "mathInline", ...math } : undefined;
            },
            renderer: typeset,
        },
    ],
};
