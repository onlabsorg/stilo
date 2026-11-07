// Entry point: registers the built-in cells and the <texl-editor> element.

import { registerCell } from "./registry.js";
import { TextCell } from "./cells/text-cell.js";
import { MarkdownCell } from "./cells/markdown-cell.js";
import { RichCell } from "./cells/rich-cell.js";
import { TableCell, parseTable, serializeTable } from "./cells/table-cell.js";
import { FormulaCell, parseFormula, serializeFormula } from "./cells/formula-cell.js";
import { TexlEditor } from "./texl-editor.js";

registerCell(RichCell);
registerCell(TextCell);
registerCell(MarkdownCell);
registerCell(TableCell);
registerCell(FormulaCell);
if (!customElements.get("texl-editor")) customElements.define("texl-editor", TexlEditor);

export { TexlCell } from "./texl-cell.js";
export { TextCell, MarkdownCell, RichCell, TableCell, FormulaCell, TexlEditor };
export { parseTable, serializeTable, parseFormula, serializeFormula };
export { registerCell, cellTagName, cellClass, cellTypes } from "./registry.js";
export { parseDocument, serializeDocument, parseMarker, formatMarker, cellComments, isBlank, cellName, nameCells, nameConflicts, tagSpans, cellsFromSource, spanningTag, outputSpans, tagOutputs, splitRendering } from "./document.js";
export { createEngine } from "./engine.js";
export { excerptAt } from "./errors.js";
export { swanTags, swanExpression, insertTag, insertComment } from "./swan.js";
