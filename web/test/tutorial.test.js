import { expect } from "@open-wc/testing";
import { cellClass, nameConflicts, parseDocument, serializeDocument, spanningTag } from "../src/editor/index.js";

// The tutorial's documents (tutorial/, DECISIONS.md S14) open in the editor
// as written: every cell fits its type, so a rich text cell is edited as
// rich text and not as plain text, no two cells share a name, and the file
// round-trips. Their rendering and their checks are tested on the Python
// engine (tests/tutorial/). The test runner serves the repository.

const read = async (path) => {
    const response = await fetch(`/tutorial/${path}`);
    expect(response.ok, path).to.be.true;
    return response.text();
};

const index = await read("index.texl");
const lessons = [...new Set(index.match(/\d\d-[a-z-]+\.texl/g))];
const documents = ["index.texl", ...lessons, "files/report.texl", "lib/steel/sections.texl"];

describe("the tutorial's documents", () => {
    it("include the lessons of the index", () => {
        expect(lessons.length).to.be.at.least(12);
    });

    for (const path of documents) {
        it(`${path}: every cell fits its type`, async () => {
            const source = await read(path);
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
