import { expect } from "@open-wc/testing";
import { createEngine } from "../src/editor/engine.js";

// The functions of the Stilo Texl library, on the browser engine. The cases
// are shared with the Python engine's test (tests/texl_lib/test_library.py),
// one file per function: each renders as a document of texl-lib/, after the
// import of index.texl, and must give `text`, if the case has one, contain
// each of `contains` and none of `excludes`. The test runner serves the
// repository, so both folders are reachable.

for (const file of ["dataframe", "charts"]) {
    const { import: IMPORT, cases } = await (await fetch(`/tests/texl_lib/${file}-cases.json`)).json();

    describe(`stilo.${file} (Texl library)`, () => {
        for (const { name, source, text, contains = [], excludes = [] } of cases) {
            it(name, async () => {
                const engine = await createEngine();
                const doc = await engine.render("/texl-lib/case.texl", IMPORT + source);
                if (text !== undefined) expect(doc.text).to.equal(text);
                for (const part of contains) expect(doc.text).to.include(part);
                for (const part of excludes) expect(doc.text).not.to.include(part);
            });
        }
    });
}
