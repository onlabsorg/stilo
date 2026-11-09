import { expect } from "@open-wc/testing";
import { cellClass, nameConflicts, parseDocument, serializeDocument, spanningTag } from "../src/editor/index.js";

// The example documents (examples/) open in the editor as written: every
// cell fits its type, no two cells share a name, and the file round-trips.
// Their rendering is tested on the Python engine (tests/cli/). The test
// runner serves the repository.

const documents = [
    "sample.texl",
    "library/steel.texl",
    "projects/beam/beam-check.texl",
    "projects/beam/basis-of-design.texl",
    "projects/beam/analysis.texl",
];

describe("the example documents", () => {
    for (const path of documents) {
        it(`${path}: every cell fits its type`, async () => {
            const response = await fetch(`/examples/${path}`);
            expect(response.ok, path).to.be.true;
            const source = await response.text();
            const cells = parseDocument(source);
            expect(serializeDocument(cells)).to.equal(source);
            expect(nameConflicts(cells), "name conflicts").to.deep.equal([]);
            expect(spanningTag(cells), "a tag runs into another cell").to.not.be.ok;
            for (const [i, cell] of cells.entries()) {
                const Cell = cellClass(cell.type);
                expect(Cell.type, `${path}, cell ${i}: unknown type ${cell.type}`).to.equal(cell.type);
                expect(Cell.accepts(cell.texl), `${path}, cell ${i} (${cell.name}): not a ${cell.type} cell`).to.be.true;
            }
        });
    }
});
