import { expect } from "@open-wc/testing";
import { createEngine } from "../src/editor/engine.js";

// `stilo.dataframe` of the Stilo Texl library, on the browser engine. The
// cases are shared with the Python engine's test
// (tests/texl_lib/test_dataframe.py): each renders as a document of
// texl-lib/, after the import of index.texl, and must give `text`. The test
// runner serves the repository, so both folders are reachable.

const { import: IMPORT, cases } = await (await fetch("/tests/texl_lib/dataframe-cases.json")).json();

describe("stilo.dataframe (Texl library)", () => {
    for (const { name, source, text } of cases) {
        it(name, async () => {
            const engine = await createEngine();
            const doc = await engine.render("/texl-lib/case.texl", IMPORT + source);
            expect(doc.text).to.equal(text);
        });
    }
});
