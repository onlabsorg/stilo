// Entry point: registers the built-in cells and the <texl-editor> element.

import { registerCell } from "./registry.js";
import { TextCell } from "./cells/text-cell.js";
import { MarkdownCell } from "./cells/markdown-cell.js";
import { TableCell, parseTable, serializeTable } from "./cells/table-cell.js";
import { TexlEditor } from "./texl-editor.js";

registerCell(TextCell);
registerCell(MarkdownCell);
registerCell(TableCell);
if (!customElements.get("texl-editor")) customElements.define("texl-editor", TexlEditor);

export { TexlCell } from "./texl-cell.js";
export { TextCell, MarkdownCell, TableCell, TexlEditor };
export { parseTable, serializeTable };
export { registerCell, cellTagName, cellClass, cellTypes } from "./registry.js";
export { parseDocument, serializeDocument, parseMarker, formatMarker, cellComments, cellName, nameCells, nameConflicts, splitRendering } from "./document.js";
export { createEngine } from "./engine.js";
export { swanTags, insertTag, insertComment } from "./swan.js";
