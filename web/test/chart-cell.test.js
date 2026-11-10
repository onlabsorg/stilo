import { expect, fixture, html } from "@open-wc/testing";
import "../src/editor/index.js";
import { parseCall, serializeCall } from "../src/editor/cells/form-cell.js";
import { ChartCell } from "../src/editor/cells/chart-cell.js";
import { STILO_IMPORT } from "../src/editor/cells/data-cell.js";

const SOURCE = `<% stilo.charts.line {
    x: loads.column "x (m)",
    y: loads.column "M (kNm)",
    title: "Bending moment"
} %>
`;

/** A chart cell in edit mode, its checks done. */
async function chartCell(texl) {
    const cell = await fixture(html`<texl-cell-chart .texl=${texl}></texl-cell-chart>`);
    cell.mode = "edit";
    await cell.updateComplete;
    await settled(cell);
    return cell;
}

/** Waits for the cell's checks of its fields, and its updates. */
async function settled(cell) {
    while (cell._pending.size > 0) await Promise.all(cell._pending.values());
    await cell.updateComplete;
    await cell.shadowRoot.querySelector("texl-form")?.updateComplete;
}

const form = (cell) => cell.shadowRoot.querySelector("texl-form");
const field = (cell, key) => form(cell).shadowRoot.querySelector(`[data-key="${key}"]`);

function type(input, value) {
    input.value = value;
    input.dispatchEvent(new Event("input"));
}

/** The source the cell commits, or the error that keeps it in edit mode. */
function commit(cell) {
    let texl = null;
    cell.addEventListener("cell-change", (e) => (texl = e.detail.texl), { once: true });
    cell.exitEdit(true);
    return texl;
}

describe("form cell: source", () => {
    it("reads a function applied to a namespace, keeping each value as its source", () => {
        const call = parseCall(`<!--[ note ]-->\n${SOURCE}`);
        expect(call.before).to.equal("<!--[ note ]-->\n");
        expect(call.after).to.equal("\n");
        expect(call.call).to.equal("stilo.charts.line");
        expect(call.members).to.deep.equal([
            ["x", 'loads.column "x (m)"'],
            ["y", 'loads.column "M (kNm)"'],
            ["title", '"Bending moment"'],
        ]);
        expect(parseCall("<% f {} %>").members).to.deep.equal([]);
        expect(parseCall('<% f {a: [1, 2], b: {c: 3}, d: "x, }"} %>').members).to.deep.equal([
            ["a", "[1, 2]"],
            ["b", "{c: 3}"],
            ["d", '"x, }"'],
        ]);
    });

    it("refuses other shapes", () => {
        for (const source of [
            "text",
            "<% f %>",
            "<% c: f {a: 1} %>",
            "<% f {a: 1 # note\n} %>",
            "<% f {a: 1, a: 2} %>",
            "<% f {a: } %>",
            "<% f {a: 1} + 1 %>",
            "<% f {a: 1} %><% g {} %>",
        ])
            expect(parseCall(source), source).to.equal(null);
    });

    it("writes one member per line, and reads back the same", () => {
        const call = parseCall(SOURCE);
        expect(serializeCall(call)).to.equal(SOURCE);
        expect(serializeCall({ before: "", after: "", call: "f", members: [] })).to.equal("<% f {} %>");
    });
});

describe("chart cell: type", () => {
    it("accepts a chart, or an empty source", () => {
        expect(ChartCell.accepts(SOURCE)).to.be.true;
        expect(ChartCell.accepts("\n")).to.be.true;
        expect(ChartCell.accepts('<% stilo.charts.line {x: [1, 2], y: [3, 4], x_label: "", y_label: "M", title: "T"} %>')).to.be.true;
    });

    it("refuses other functions, unknown members, and texts that are formulas", () => {
        expect(ChartCell.accepts("<% stilo.charts.bar {x: [1], y: [2]} %>")).to.be.false;
        expect(ChartCell.accepts("<% stilo.charts.line {x: [1], y: [2], color: 3} %>")).to.be.false;
        expect(ChartCell.accepts('<% stilo.charts.line {x: [1], y: [2], title: "a" + "b"} %>')).to.be.false;
        expect(ChartCell.accepts("Some text")).to.be.false;
    });
});

describe("chart cell: editing", () => {
    it("edits a chart as a form: the chart type, then one line per field", async () => {
        const cell = await chartCell(SOURCE);
        const labels = [...form(cell).shadowRoot.querySelectorAll("label")].map((label) => label.textContent);
        expect(labels).to.deep.equal(["Chart type", "X values", "Y values", "X axis label", "Y axis label", "Title"]);
        const kind = field(cell, "-kind");
        expect(kind.localName).to.equal("select");
        expect(kind.value).to.equal("stilo.charts.line");
        expect([...kind.options].map((option) => option.textContent)).to.deep.equal(["Line"]);
        expect(field(cell, "x").value).to.equal('loads.column "x (m)"');
        expect(field(cell, "title").value).to.equal("Bending moment");
        expect(field(cell, "x_label").value).to.equal("");
        // The first field has the focus
        expect(form(cell).shadowRoot.activeElement).to.equal(kind);
    });

    it("keeps an unchanged source as written", async () => {
        const source = "<% stilo.charts.line {x: [1, 2],   y: [3, 4]} %>\n";
        const cell = await chartCell(source);
        expect(cell.toTexl()).to.equal(source);
    });

    it("writes the fields in their order, texts in quotes, and leaves out empty ones", async () => {
        const cell = await chartCell(SOURCE);
        type(field(cell, "y_label"), "M (kNm)");
        type(field(cell, "title"), "");
        type(field(cell, "x_label"), "x (m)");
        await settled(cell);
        expect(commit(cell)).to.equal(`<% stilo.charts.line {
    x: loads.column "x (m)",
    y: loads.column "M (kNm)",
    x_label: "x (m)",
    y_label: "M (kNm)"
} %>
`);
    });

    it("starts a new line chart in an empty source, and needs X and Y values", async () => {
        const cell = await chartCell("");
        expect(field(cell, "-kind").value).to.equal("stilo.charts.line");
        type(field(cell, "x"), "[1, 2]");
        await settled(cell);
        expect(commit(cell)).to.equal(null);
        expect(cell.mode).to.equal("edit");
        expect(cell._error).to.match(/^Y values is needed/);
        type(field(cell, "y"), "[3, 4]");
        await settled(cell);
        expect(commit(cell)).to.equal("<% stilo.charts.line {\n    x: [1, 2],\n    y: [3, 4]\n} %>");
    });

    it("marks a wrong formula and refuses to commit until it is corrected", async () => {
        const cell = await chartCell(SOURCE);
        type(field(cell, "x"), "loads.column (");
        await settled(cell);
        expect(field(cell, "x").classList.contains("error")).to.be.true;
        expect(field(cell, "x").title).to.match(/^Not a /);
        expect(commit(cell)).to.equal(null);
        expect(cell._error).to.match(/^X values: Not a /);
        type(field(cell, "x"), "loads.column \"x\"");
        await settled(cell);
        expect(field(cell, "x").classList.contains("error")).to.be.false;
        expect(commit(cell)).to.contain('x: loads.column "x"');
    });

    it("waits for the checks before committing", async () => {
        const cell = await chartCell(SOURCE);
        type(field(cell, "y"), "[5, 6]");
        let texl = null;
        cell.addEventListener("cell-change", (e) => (texl = e.detail.texl));
        cell.exitEdit(true);
        await settled(cell);
        await new Promise((resolve) => setTimeout(resolve));
        expect(texl).to.contain("y: [5, 6]");
    });

    it("refuses a text with a quote", async () => {
        const cell = await chartCell(SOURCE);
        type(field(cell, "title"), 'The "moment"');
        await settled(cell);
        expect(field(cell, "title").classList.contains("error")).to.be.true;
        expect(commit(cell)).to.equal(null);
        expect(cell._error).to.match(/^Title: A text cannot contain/);
    });

    it("moves between the text boxes with ↑ and ↓", async () => {
        const cell = await chartCell(SOURCE);
        field(cell, "x").focus();
        const down = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, composed: true, cancelable: true });
        field(cell, "x").dispatchEvent(down);
        expect(down.defaultPrevented).to.be.true;
        expect(form(cell).shadowRoot.activeElement).to.equal(field(cell, "y"));
        field(cell, "y").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, composed: true, cancelable: true }));
        expect(form(cell).shadowRoot.activeElement).to.equal(field(cell, "x"));
    });

    it("edits a source that is not a chart as text", async () => {
        const cell = await chartCell("<% stilo.charts.line {x: [1], y: [2]} # note\n %>\n");
        expect(form(cell)).to.equal(null);
        expect(cell.shadowRoot.querySelector(".editor .cm-editor")).to.exist;
    });
});

describe("chart cell in the editor", () => {
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

    it("shows the chart that stilo.charts.line draws, across the cell", async () => {
        await serveLibrary();
        const editor = await editorWith(
            `<!--{ imp1 : formula }-->\n${STILO_IMPORT}\n<!--{ cha1 : chart }-->\n` +
                `<% stilo.charts.line {x: [0, 1, 2], y: [0, 10, 5], y_label: "M (kNm)", title: "Moment"} %>\n`,
        );
        const cell = cells(editor)[1];
        await cell.updateComplete;
        const svg = cell.shadowRoot.querySelector(".view svg");
        expect(svg).to.exist;
        expect(svg.querySelector("polyline").getAttribute("points").split(" ")).to.have.length(3);
        // The sanitiser keeps what the chart needs: the accent colour, the
        // turned axis label
        expect(svg.querySelector("polyline").getAttribute("style")).to.contain("--texl-accent");
        expect(svg.querySelector("text[transform]").textContent).to.equal("M (kNm)");
        expect(svg.getBoundingClientRect().width).to.be.closeTo(cell.shadowRoot.querySelector(".view").getBoundingClientRect().width, 1);
    });

    it("adds the import of the Stilo library when a chart is first written", async () => {
        const editor = await editorWith("Intro\n");
        editor.select(2);
        await editor.runCommand("make-chart");
        await editor.updateComplete;
        const cell = cells(editor)[1];
        await settled(cell);
        type(field(cell, "x"), "[1, 2]");
        type(field(cell, "y"), "[3, 4]");
        await settled(cell);
        cell.exitEdit(true);
        await editor.updateComplete;
        expect(editor.value).to.contain(" : formula | hidden }-->\n" + STILO_IMPORT + "\n");
        expect(editor.value).to.contain(" : chart }-->\n<% stilo.charts.line {");
    });
});
