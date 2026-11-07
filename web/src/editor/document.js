// Parsing and serialization of a Texl document as a stack of cells.
//
// A document is one Texl text file. Each cell starts with a marker line:
//
//     <!--{ name : type }-->
//
// followed by the cell body: the Texl source the cell produced, up to the
// next marker line. Text before the first marker is a cell without marker
// (type "text"), so a plain Texl file opens as a single text cell.
//
// A marker line inside a tag is not a marker: to Texl it is part of the tag,
// so a tag always belongs to the cell it opens in.
//
// The name identifies the cell, e.g. as a fragment identifier: four
// lowercase letters and digits, compared without case. The editor gives one
// to every cell with a marker (`nameCells`). Names edited by hand may clash:
// `nameConflicts` finds them, and the editor only reports them.
//
// Older markers, `<!--% type %-->`, are read too and written in the new form.

const MARKER = /^<!--\{(.*?)\}-->[ \t]*$/;
const OLD_MARKER = /^<!--%(.*?)%-->[ \t]*$/;

const TAG_OPEN = "<%";
const TAG_CLOSE = "%>";

/**
 * A cell of a document.
 * @typedef {object} CellData
 * @property {string} type - The cell type, e.g. "text" or "markdown".
 * @property {string} texl - The Texl source of the cell body.
 * @property {string} [name] - The cell name, e.g. "bak7".
 * @property {boolean} [marker] - False for the leading cell without marker.
 */

/**
 * Parses the text of a marker (between `<!--{` and `}-->`): a name and a
 * type, separated by a colon. A marker without colon has only the type.
 * @param {string} inner
 * @returns {{type: string, name?: string}}
 */
export function parseMarker(inner) {
    const colon = inner.indexOf(":");
    const type = inner.slice(colon + 1).trim() || "text";
    const name = colon >= 0 ? inner.slice(0, colon).trim() : "";
    return name ? { name, type } : { type };
}

/**
 * Formats a cell marker line.
 * @param {{type: string, name?: string}} cell
 * @returns {string}
 */
export function formatMarker({ name, type }) {
    return name ? `<!--{ ${name} : ${type} }-->` : `<!--{ ${type} }-->`;
}

/** The letters of a name: consonants and vowels, without the l (like a 1). */
const CONSONANTS = "bcdfghjkmnprstvz";
const VOWELS = "aeiou";
/** The digit at the end of a name: 0 and 1 look like o and l. */
const DIGITS = "23456789";

/**
 * A new random cell name: a syllable and a digit, e.g. "bak7", easy to
 * read out and to remember.
 * @returns {string}
 */
export function cellName() {
    const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];
    return pick(CONSONANTS) + pick(VOWELS) + pick(CONSONANTS) + pick(DIGITS);
}

/**
 * Gives a new name to every cell with a marker but no name, unique in the
 * document (without case); `taken` are names in use elsewhere. Cells that
 * have a name keep it, also when it clashes. Returns `cells` itself if no
 * cell needs a name.
 * @param {CellData[]} cells
 * @param {Iterable<string>} [taken]
 * @returns {CellData[]}
 */
export function nameCells(cells, taken = []) {
    if (cells.every((cell) => cell.name || cell.marker === false)) return cells;
    const names = new Set([...taken, ...cells.map((cell) => cell.name)].filter(Boolean).map((name) => name.toLowerCase()));
    return cells.map((cell) => {
        if (cell.name || cell.marker === false) return cell;
        let name;
        do name = cellName();
        while (names.has(name));
        names.add(name);
        return { ...cell, name };
    });
}

/**
 * The names given to more than one cell, compared without case, with the
 * lines (from 1) of the cells that have them.
 * @param {CellData[]} cells
 * @returns {{name: string, lines: number[]}[]}
 */
export function nameConflicts(cells) {
    const lines = new Map();
    cells.forEach((cell, i) => {
        if (!cell.name) return;
        const key = cell.name.toLowerCase();
        if (!lines.has(key)) lines.set(key, { name: cell.name, lines: [] });
        lines.get(key).lines.push(i + 1);
    });
    return [...lines.values()].filter((conflict) => conflict.lines.length > 1);
}

/**
 * The tags of a source, as Texl reads them: from `<%` to the first `%>`. A
 * `<%` with no `%>` after it is text.
 * @param {string} source
 * @returns {{start: number, end: number}[]} In order of the source.
 */
export function tagSpans(source) {
    const tags = [];
    let start = source.indexOf(TAG_OPEN);
    while (start >= 0) {
        const close = source.indexOf(TAG_CLOSE, start + TAG_OPEN.length);
        if (close < 0) break;
        const end = close + TAG_CLOSE.length;
        tags.push({ start, end });
        start = source.indexOf(TAG_OPEN, end);
    }
    return tags;
}

/**
 * Splits a document into cells.
 * @param {string} source - The document text.
 * @returns {CellData[]}
 */
export function parseDocument(source) {
    const cells = [];
    let current = null;
    let body = [];
    const flush = () => {
        if (current) cells.push({ ...current, texl: body.join("") });
        body = [];
    };
    const tags = tagSpans(source);
    let next = 0; // The first tag not wholly before the line
    let lineStart = 0;
    for (const line of source.split(/(?<=\n)/)) {
        const text = line.replace(/\r?\n$/, "");
        const start = lineStart;
        lineStart += line.length;
        while (next < tags.length && tags[next].end <= start) next++;
        if (next < tags.length && tags[next].start < start + text.length) {
            body.push(line);
            continue;
        }
        const match = MARKER.exec(text);
        const old = !match && OLD_MARKER.exec(text);
        if (match || old) {
            if (current || body.length > 0) {
                current ??= { type: "text", marker: false };
                flush();
            }
            // An older marker may have a name before the type, `name | type`: it is dropped
            current = match ? parseMarker(match[1]) : { type: old[1].split("|").at(-1).trim() || "text" };
        } else {
            body.push(line);
        }
    }
    if (current || body.length > 0) {
        current ??= { type: "text", marker: false };
        flush();
    }
    return cells;
}

/**
 * The cells a cell becomes with a new source: itself, and one more for each
 * marker line in the source outside a tag. If the source starts with a marker,
 * that marker replaces the cell's own.
 * @param {CellData} cell
 * @param {string} texl - The new source.
 * @returns {CellData[]}
 */
export function cellsFromSource(cell, texl) {
    const [first, ...rest] = parseDocument(texl);
    if (!first) return [{ ...cell, texl }];
    return first.marker === false ? [{ ...cell, texl: first.texl }, ...rest] : [first, ...rest];
}

/**
 * The first tag that would run from a cell into a later one, swallowing its
 * marker. `parseDocument` never gives such cells, but changing the cells can:
 * a `<%` left open closes at the first `%>` of any cell below it.
 * @param {CellData[]} cells
 * @returns {{opens: number, reaches: number} | null} The indices of the cell
 *   where the tag opens and of the first cell whose marker it swallows.
 */
export function spanningTag(cells) {
    const tags = tagSpans(serializeDocument(cells));
    let next = 0;
    let start = 0;
    for (let i = 0; i < cells.length; i++) {
        const marker = cells[i].marker === false ? 0 : formatMarker(cells[i]).length;
        while (next < tags.length && tags[next].end <= start) next++;
        if (marker > 0 && next < tags.length && tags[next].start < start + marker) {
            return { opens: cellAtOffset(cells, tags[next].start).index, reaches: i };
        }
        start += serializeCell(cells[i], i, cells).length;
    }
    return null;
}

/**
 * The comments of a cell: the text of every cell comment (`<!--[ ... ]-->`)
 * in its body, trimmed. Other HTML comments are not cell comments. A
 * comment has no structure: hosts may give it one with their own syntax.
 * @param {string} texl - The Texl source of the cell body.
 * @returns {string[]}
 */
export function cellComments(texl) {
    return [...texl.matchAll(/<!--\[([\s\S]*?)\]-->/g)].map((match) => match[1].trim());
}

/** HTML comments, cell comments among them. */
const COMMENT = /<!--[\s\S]*?-->/g;

/**
 * Whether a source holds nothing but white space and HTML comments (cell
 * comments among them): nothing that renders.
 * @param {string} texl
 * @returns {boolean}
 */
export function isBlank(texl) {
    return !texl.replace(COMMENT, "").trim();
}

/**
 * Joins cells into a document.
 * @param {CellData[]} cells
 * @returns {string}
 */
export function serializeDocument(cells) {
    return cells.map((cell, i) => serializeCell(cell, i, cells)).join("");
}

/** The text of cell `i` in its document. */
function serializeCell(cell, i, cells) {
    const texl = addsLineBreak(cell, i, cells) ? cell.texl + "\n" : cell.texl;
    return cell.marker === false ? texl : formatMarker(cell) + "\n" + texl;
}

/** Whether serialising adds a line break to cell `i`, so the next marker starts a line. */
function addsLineBreak(cell, i, cells) {
    return Boolean(cell.texl) && i < cells.length - 1 && !cell.texl.endsWith("\n");
}

/**
 * The line (cell) of a document that holds a position in its text.
 * @param {CellData[]} cells
 * @param {number} offset - Index in `serializeDocument(cells)`.
 * @returns {number} The line, from 1; the last one if `offset` is past the end.
 */
export function lineAtOffset(cells, offset) {
    return cellAtOffset(cells, offset).index + 1;
}

/**
 * The line of text within a cell that holds a position in the document.
 * @param {CellData[]} cells
 * @param {number} offset - Index in `serializeDocument(cells)`.
 * @returns {number | null} The line of the cell's source, from 1, not counting
 *   its marker; null if the cell has only one line.
 */
export function textLineAtOffset(cells, offset) {
    const { index, start } = cellAtOffset(cells, offset);
    const cell = cells[index];
    if (!cell || !cell.texl.replace(/\n$/, "").includes("\n")) return null;
    const marker = cell.marker === false ? 0 : formatMarker(cell).length + 1;
    const before = cell.texl.slice(0, Math.max(0, offset - start - marker));
    return before.split("\n").length;
}

/** The index of the cell holding a position, and where the cell starts. */
function cellAtOffset(cells, offset) {
    let start = 0;
    for (let i = 0; i < cells.length; i++) {
        const end = start + serializeCell(cells[i], i, cells).length;
        if (offset < end || i === cells.length - 1) return { index: i, start };
        start = end;
    }
    return { index: 0, start: 0 };
}

/**
 * Where the output of each cell is in the rendering of a whole document,
 * `serializeDocument(cells)`.
 *
 * The positions come from the document's tags, not from a search of the
 * text: the text outside tags renders to itself, so a marker's place in the
 * rendering is its place in the source plus the change in size of the tags
 * before it. Whatever a tag outputs, marker lines included, stays content of
 * the cell the tag is in.
 *
 * `parseDocument` and the editor give no marker inside a tag. If `cells` has
 * one anyway, it is not in the rendering: its text goes to the last cell whose
 * marker is, and the cell gets an empty span. The line break that `serializeDocument`
 * adds to a cell is not part of its output.
 * @param {{text: string, tags: {start: number, end: number, out_start: number, out_end: number}[]}} doc
 *   The rendering of `serializeDocument(cells)`.
 * @param {CellData[]} cells
 * @returns {{start: number, end: number}[]} One span of `doc.text` per cell.
 */
export function outputSpans(doc, cells) {
    const spans = cells.map(() => ({ start: 0, end: 0 }));
    const { tags } = doc;
    let owner = cells[0]?.marker === false ? 0 : -1; // The cell that gets the text being passed
    let next = 0; // The first tag not wholly before the cell
    let shift = 0; // How much those before it moved the text
    let source = 0; // Where the cell starts in the source
    cells.forEach((cell, i) => {
        const start = source;
        source += serializeCell(cell, i, cells).length;
        if (cell.marker === false) return;
        const marker = formatMarker(cell).length;
        while (next < tags.length && tags[next].end <= start) {
            const tag = tags[next++];
            shift += tag.out_end - tag.out_start - (tag.end - tag.start);
        }
        if (next < tags.length && tags[next].start < start + marker) return; // Inside a tag
        if (owner >= 0) spans[owner].end = start + shift - (addsLineBreak(cells[i - 1], i - 1, cells) ? 1 : 0);
        owner = i;
        spans[i].start = start + shift + marker + 1;
    });
    if (owner >= 0) spans[owner].end = doc.text.length;
    return spans;
}

/**
 * Splits the rendering of a whole document into the outputs of its cells
 * (see `outputSpans`).
 * @param {{text: string, tags: object[]}} doc - The rendering of `serializeDocument(cells)`.
 * @param {CellData[]} cells
 * @returns {string[]}
 */
export function splitRendering(doc, cells) {
    return outputSpans(doc, cells).map(({ start, end }) => doc.text.slice(start, end));
}
