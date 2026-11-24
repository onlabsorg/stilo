// The HTML the cells of a document show, as the editor's `renderedHtml()`
// gives it, also for a text rendered without an editor (`renderHtml`).

import { parseDocument, serializeDocument, outputSpans } from "./document.js";
import { cellTagName } from "./registry.js";
import { createEngine } from "./engine.js";
import { findErrors, markErrors } from "./errors.js";
import { TexlCell } from "./texl-cell.js";

/** A text safe inside a double-quoted HTML attribute. */
function escapeAttribute(text) {
    return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * The HTML of rendered cells: each as its type shows it (`viewHtml`,
 * sanitised), in a `<div class="texl-cell" data-cell data-type>`; hidden
 * cells left out unless `hidden`.
 * @param {object[]} cells - As `parseDocument` reads them.
 * @param {string[]} outputs - What each cell output, with its errors marked.
 * @param {string[]} errorMessages - The hover texts of the errors marked.
 */
export function cellsHtml(cells, outputs, errorMessages, { hidden = false } = {}) {
    return cells
        .map((cell, i) => {
            if (cell.hidden && !hidden) return "";
            const type = customElements.get(cellTagName(cell.type)) ?? TexlCell;
            const content = type.viewHtml(outputs[i] ?? "", errorMessages ?? []);
            return `<div class="texl-cell" data-cell="${escapeAttribute(cell.name ?? "")}" data-type="${escapeAttribute(cell.type ?? "")}">${content}</div>`;
        })
        .filter(Boolean)
        .join("\n");
}

/**
 * Render the text of a document as the document at `url`, without an
 * editor, and return the HTML its cells show, as `renderedHtml()` of an
 * editor holding it would: sanitised, one `<div class="texl-cell" data-cell
 * data-type>` per cell. Imports resolve against `url` and are read with
 * `loader` (the editor's `loader`); a text that cannot be rendered gives
 * cells without output.
 * @param {string} source
 * @param {{url: string, loader?: ((url: string) => Promise<{url: string, source: string}>) | null, hidden?: boolean}} options
 * @returns {Promise<string>}
 */
export async function renderHtml(source, { url, loader = null, hidden = false }) {
    const cells = parseDocument(source ?? "");
    const engine = await createEngine();
    try {
        if (loader) for (const scheme of ["http", "https"]) engine.addLoader(scheme, loader);
        let doc = null;
        try {
            doc = await engine.render(url, serializeDocument(cells));
        } catch {
            // The URL cannot be resolved: the cells show no output
        }
        const { places } = doc ? findErrors(doc, cells) : { places: [] };
        const outputs = doc ? outputSpans(doc, cells).map((span) => markErrors(doc.text, places, span)) : [];
        return cellsHtml(cells, outputs, places.map(({ error }) => error.rootCause), { hidden });
    } finally {
        engine.free();
    }
}
