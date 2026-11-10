import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import "../src/editor/index.js";
import { parseData, serializeData, entryError, STILO_IMPORT } from "../src/editor/cells/data-cell.js";

const SOURCE = `<% loads: stilo.dataframe {
    columns: ["case", "Fx (kN)", "Fy (kN)"],
    rows: [
        ["ULS-1", 120, 35],
        ["ULS-2", 1.35 * Fx_k, ""]
    ]
} %>
`;

/** A data cell in edit mode, its checks done. */
async function dataCell(texl) {
    const cell = await fixture(html`<texl-cell-data .texl=${texl}></texl-cell-data>`);
    cell.mode = "edit";
    await cell.updateComplete;
    await settled(cell);
    return cell;
}

/** Waits for the cell's checks of its fields, and its update. */
async function settled(cell) {
    while (cell._pending.size > 0) await Promise.all(cell._pending.values());
    await cell.updateComplete;
}

const field = (cell, row, col) => cell.shadowRoot.querySelector(`.grid input[data-row="${row}"][data-col="${col}"]`);

function type(input, value) {
    input.value = value;
    input.dispatchEvent(new Event("input"));
}

describe("data cell: source", () => {
    it("reads a labelled dataframe", () => {
        const data = parseData(SOURCE.trimEnd());
        expect(data.name).to.equal("loads");
        expect(data.columns).to.deep.equal(["case", "Fx (kN)", "Fy (kN)"]);
        expect(data.rows).to.deep.equal([
            ['"ULS-1"', "120", "35"],
            ['"ULS-2"', "1.35 * Fx_k", ""],
        ]);
    });

    it("reads one without a name, with comments around it, and pads short rows", () => {
        const data = parseData('<!--[ Anna: check ]-->\n<% stilo.dataframe {columns: ["a", "b"], rows: [[[1, 2], f (x, y)], [3]]} %>');
        expect(data.name).to.equal("");
        expect(data.before).to.equal("<!--[ Anna: check ]-->\n");
        expect(data.rows).to.deep.equal([
            ["[1, 2]", "f (x, y)"],
            ["3", ""],
        ]);
        expect(parseData('<% stilo.dataframe {columns: ["a"], rows: []} %>').rows).to.deep.equal([]);
    });

    it("refuses other shapes", () => {
        for (const source of [
            "Some text",
            "<% 1 + 2 %>",
            '<% stilo.dataframe {columns: [], rows: []} %>',
            '<% stilo.dataframe {columns: [a], rows: []} %>',
            '<% stilo.dataframe {columns: ["a"], rows: [[1, 2]]} %>',
            '<% stilo.dataframe {columns: ["a"], rows: [[1,, 2]]} %>',
            '<% stilo.dataframe {columns: ["a"], rows: [[1 # note\n]]} %>',
            '<% stilo.dataframe {rows: [], columns: ["a"]} %>',
            '<% stilo.dataframe {columns: ["a"], rows: [], extra: 1} %>',
            '<% x = stilo.dataframe {columns: ["a"], rows: []} %>',
            '<% stilo.dataframe {columns: ["a"], rows: [[(1]]} %>',
            '<% stilo.dataframe {columns: ["a"], rows: [["x]]} %>',
            '<% stilo.dataframe {columns: ["a"], rows: []} %> and text',
        ])
            expect(parseData(source), source).to.be.null;
    });

    it("writes one row per line, and reads back the same", () => {
        const data = parseData(SOURCE.trimEnd());
        expect(serializeData(data)).to.equal(SOURCE.trimEnd());
        expect(serializeData({ ...data, name: "", rows: [] })).to.equal(
            '<% stilo.dataframe {\n    columns: ["case", "Fx (kN)", "Fy (kN)"],\n    rows: []\n} %>',
        );
    });
});

describe("data cell: checking values", () => {
    it("accepts complete values, also undefined ones", async () => {
        for (const value of ["", "120", '"ULS-1"', "1.35 * Fx_k", '1 + "a"', "(1, 2)", "[1, 2]", "x -> x", '"a, b"'])
            expect(await entryError(value), value).to.equal("");
    });

    it("refuses values that would break the row, and says why", async () => {
        expect(await entryError("1 +")).to.match(/^Not a valid value/);
        expect(await entryError("(1")).to.equal("Not a valid value: missing closing `)`");
        expect(await entryError("a = 3")).to.equal("Not a single value");
        expect(await entryError("1, 2")).to.match(/comma/);
        expect(await entryError("1 %> 2")).to.match(/%>/);
        expect(await entryError("1 # note")).to.match(/^Not a/);
    });
});

describe("data cell: editing", () => {
    it("edits the table as a grid and keeps an unchanged source as written", async () => {
        const cell = await dataCell(SOURCE);
        expect(cell.shadowRoot.querySelectorAll(".grid input").length).to.equal(9);
        expect(cell.shadowRoot.querySelector(".data-name input").value).to.equal("loads");
        expect(field(cell, 0, 1).value).to.equal("Fx (kN)");
        expect(field(cell, 2, 2).value).to.equal("");
        expect(cell.toTexl()).to.equal(SOURCE);
        type(field(cell, 2, 2), "40");
        expect(parseData(cell.toTexl()).rows[1]).to.deep.equal(['"ULS-2"', "1.35 * Fx_k", "40"]);
        expect(cell.toTexl().endsWith(" %>\n")).to.be.true;
    });

    it("changes the name, and writes no label without one", async () => {
        const cell = await dataCell(SOURCE);
        const name = cell.shadowRoot.querySelector(".data-name input");
        type(name, "");
        expect(cell.toTexl()).to.match(/^<% stilo\.dataframe \{/);
        type(name, "forces");
        expect(cell.toTexl()).to.match(/^<% forces: stilo\.dataframe \{/);
    });

    it("starts a new table of two columns in an empty source", async () => {
        const cell = await dataCell("");
        expect(cell.shadowRoot.querySelectorAll(".grid input").length).to.equal(4);
        expect(cell.toTexl()).to.equal("");
        type(field(cell, 1, 0), "1");
        expect(cell.toTexl()).to.equal(
            '<% stilo.dataframe {\n    columns: ["Column 1", "Column 2"],\n    rows: [\n        [1, ""]\n    ]\n} %>',
        );
    });

    it("marks a wrong value and refuses to commit until it is corrected", async () => {
        const cell = await dataCell(SOURCE);
        let changed = null;
        cell.addEventListener("cell-change", (e) => (changed = e.detail.texl));
        type(field(cell, 1, 1), "120 +");
        await settled(cell);
        expect(field(cell, 1, 1).classList.contains("error")).to.be.true;
        cell.exitEdit(true);
        await cell.updateComplete;
        expect(changed).to.be.null;
        expect(cell.shadowRoot.querySelector(".input-error").textContent).to.match(/^Row 1, column 2: Not a valid value/);
        type(field(cell, 1, 1), "125");
        await settled(cell);
        expect(field(cell, 1, 1).classList.contains("error")).to.be.false;
        cell.exitEdit(true);
        expect(parseData(changed).rows[0][1]).to.equal("125");
    });

    it("waits for the checks before committing", async () => {
        const cell = await dataCell(SOURCE);
        let changed = null;
        cell.addEventListener("cell-change", (e) => (changed = e.detail.texl));
        type(field(cell, 1, 2), "36");
        cell.exitEdit(true);
        await waitUntil(() => changed !== null);
        expect(parseData(changed).rows[0][2]).to.equal("36");
    });

    it("refuses a name that is not a Swan name, and a column name with a quote", async () => {
        const cell = await dataCell(SOURCE);
        type(cell.shadowRoot.querySelector(".data-name input"), "2 loads");
        cell.exitEdit(true);
        await cell.updateComplete;
        expect(cell.shadowRoot.querySelector(".input-error").textContent).to.match(/^A name has only letters/);
        type(cell.shadowRoot.querySelector(".data-name input"), "loads");
        type(field(cell, 0, 0), 'the "case"');
        await settled(cell);
        cell.exitEdit(true);
        await cell.updateComplete;
        expect(cell.shadowRoot.querySelector(".input-error").textContent).to.match(/^Column 1: A column name cannot contain/);
    });

    it("moves the marks with inserted rows", async () => {
        const cell = await dataCell(SOURCE);
        type(field(cell, 2, 0), "(");
        await settled(cell);
        field(cell, 1, 0).dispatchEvent(new FocusEvent("focus"));
        cell.shadowRoot.querySelector('.grid-tools button[title="Insert a row below"]').click();
        await settled(cell);
        expect(field(cell, 3, 0).classList.contains("error")).to.be.true;
        expect(field(cell, 2, 0).classList.contains("error")).to.be.false;
    });

    it("edits a source that is not a data table as text", async () => {
        const cell = await fixture(html`<texl-cell-data .texl=${"<% 1 + 2 %>\n"}></texl-cell-data>`);
        cell.mode = "edit";
        await cell.updateComplete;
        expect(cell.shadowRoot.querySelector(".grid")).to.be.null;
        expect(cell.shadowRoot.querySelector(".cm-editor")).to.exist;
    });
});

describe("data cell in the editor", () => {
    const FETCH = window.fetch;
    afterEach(() => (window.fetch = FETCH));

    /** Serves the Stilo library from texl-lib/ where a project would have it, under lib/stilo/. */
    async function serveLibrary() {
        const files = {};
        for (const name of ["index.texl", "dataframe.texl", "charts.texl"])
            files[`/lib/stilo/${name}`] = await (await FETCH(`/texl-lib/${name}`)).text();
        window.fetch = async (url, ...rest) => {
            const name = Object.keys(files).find((file) => String(url.url ?? url).endsWith(file));
            return name ? new Response(files[name]) : FETCH(url, ...rest);
        };
    }

    async function editorWith(source) {
        const editor = await fixture(html`<texl-editor url="/docs/doc.texl"></texl-editor>`);
        editor.value = source;
        await editor.rendered;
        await editor.updateComplete;
        return editor;
    }

    const cells = (editor) => [...editor.shadowRoot.querySelectorAll("[data-index]")];

    it("adds the import of the Stilo library at the top when a data table is first written, once", async () => {
        const editor = await editorWith("Intro\n");
        editor.select(2);
        await editor.runCommand("make-data");
        await editor.updateComplete;
        let cell = cells(editor)[1];
        await settled(cell);
        type(field(cell, 1, 0), "1");
        await settled(cell);
        cell.exitEdit(true);
        await editor.updateComplete;
        expect(editor.value.startsWith("<!--{ ")).to.be.true;
        expect(editor.value).to.contain(" : formula | hidden }-->\n" + STILO_IMPORT + "\n");
        expect(editor.value).to.contain("Intro\n");
        expect(editor.value.indexOf(STILO_IMPORT)).to.be.below(editor.value.indexOf("stilo.dataframe"));
        // The selection stays on the data table, now one line down
        expect(cells(editor)[2].localName).to.equal("texl-cell-data");
        // A second data table adds no second import
        editor.select(4);
        await editor.runCommand("make-data");
        await editor.updateComplete;
        cell = cells(editor)[3];
        await settled(cell);
        type(field(cell, 1, 0), "2");
        await settled(cell);
        cell.exitEdit(true);
        await editor.updateComplete;
        expect(editor.value.split(STILO_IMPORT).length).to.equal(2);
        // Undo takes back the first table and its import together (each
        // table took two steps: the type change, then the commit)
        for (let i = 0; i < 3; i++) await editor.runCommand("undo");
        expect(editor.value).to.not.contain("stilo.dataframe");
        expect(editor.value).to.not.contain(STILO_IMPORT);
    });

    it("shows the table that stilo.dataframe renders", async () => {
        await serveLibrary();
        const editor = await editorWith(`<!--{ imp1 : formula }-->\n${STILO_IMPORT}\n<!--{ dat1 : data }-->\n${SOURCE.replace("1.35 * Fx_k", "140")}`);
        const cell = cells(editor)[1];
        await cell.updateComplete;
        const table = cell.shadowRoot.querySelector(".view table");
        expect(table).to.exist;
        expect([...table.querySelectorAll("th")].map((th) => th.textContent)).to.deep.equal(["case", "Fx (kN)", "Fy (kN)"]);
        expect(table.querySelectorAll("tbody tr").length).to.equal(2);
    });
});
