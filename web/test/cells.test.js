import { expect, fixture, html, unsafeStatic } from "@open-wc/testing";
import { EditorView } from "@codemirror/view";
import { swanTokens, findTags } from "../src/editor/swan.js";
import { parseTable, serializeTable, parseFormula, TableCell, FormulaCell, TextCell, MarkdownCell } from "../src/editor/index.js";

async function cellInEditMode(tag, texl) {
    const element = await fixture(html`<${unsafeStatic(tag)} .texl=${texl}></${unsafeStatic(tag)}>`);
    element.mode = "edit";
    await element.updateComplete;
    return [element, EditorView.findFromDOM(element.shadowRoot.querySelector(".cm-editor"))];
}

function ctrlSpace(view) {
    const event = new KeyboardEvent("keydown", {
        key: " ", code: "Space", keyCode: 32, ctrlKey: true, bubbles: true, cancelable: true,
    });
    view.contentDOM.dispatchEvent(event);
    return event;
}

function shiftF2(view) {
    const event = new KeyboardEvent("keydown", {
        key: "F2", code: "F2", keyCode: 113, shiftKey: true, bubbles: true, cancelable: true,
    });
    view.contentDOM.dispatchEvent(event);
    return event;
}

describe("cell rendering", () => {
    it("shows the output of a text cell as HTML, not Markdown", async () => {
        const cell = await fixture(html`<texl-cell-text .output=${"**a** <em>b</em>"}></texl-cell-text>`);
        const view = cell.shadowRoot.querySelector(".view");
        expect(view.textContent).to.equal("**a** b");
        expect(view.querySelector("em")).to.exist;
        expect(view.querySelector("strong")).to.be.null;
    });

    it("shows the output of a markdown cell as Markdown", async () => {
        const cell = await fixture(html`<texl-cell-markdown .output=${"**a**"}></texl-cell-markdown>`);
        expect(cell.shadowRoot.querySelector(".view strong").textContent).to.equal("a");
    });

    it("sanitises the output", async () => {
        const cell = await fixture(html`<texl-cell-text .output=${'<img src="x" onerror="alert(1)">'}></texl-cell-text>`);
        expect(cell.shadowRoot.querySelector("img").hasAttribute("onerror")).to.be.false;
    });
});

describe("Swan highlighting", () => {
    it("finds tags up to the first %>, and unclosed tags to the end", () => {
        expect(findTags("a <% x %> b <% y")).to.deep.equal([
            { from: 2, to: 9, closed: true },
            { from: 12, to: 16, closed: false },
        ]);
    });

    it("splits Swan into tokens", () => {
        const source = 'x = "a", n.f 1.5e3 ? TRUE ; {k: 2} # note';
        const types = swanTokens(source).map(({ from, to, type }) => [source.slice(from, to), type]);
        expect(types).to.deep.equal([
            ["x", "definition"], ["=", "operator"], ['"a"', "string"], [",", "operator"],
            [".", "operator"], ["f", "property"], ["1.5e3", "number"], ["?", "operator"],
            ["TRUE", "atom"], [";", "operator"], ["{", "bracket"], ["k", "property"],
            [":", "operator"], ["2", "number"], ["}", "bracket"], ["# note", "comment"],
        ]);
    });

    for (const tag of ["texl-cell-text", "texl-cell-markdown"]) {
        it(`highlights the tags in a ${tag}`, async () => {
            const [cell] = await cellInEditMode(tag, "# Title\nSpan <% L = 6 %> m\n");
            const root = cell.shadowRoot;
            expect(root.querySelector(".cm-texl-tag").textContent).to.equal("<% L = 6 %>");
            expect(root.querySelector(".cm-swan-definition").textContent).to.equal("L");
            expect(root.querySelector(".cm-swan-number").textContent).to.equal("6");
        });
    }
});

describe("Ctrl+Space", () => {
    it("inserts a tag with the cursor between the delimiters", async () => {
        const [, view] = await cellInEditMode("texl-cell-text", "Span: \n");
        expect(ctrlSpace(view).defaultPrevented).to.be.true;
        expect(view.state.doc.toString()).to.equal("Span: <%  %>");
        expect(view.state.selection.main.head).to.equal("Span: <% ".length);
    });

    it("puts the selected text in a tag", async () => {
        const [, view] = await cellInEditMode("texl-cell-markdown", "Span: L\n");
        view.dispatch({ selection: { anchor: 6, head: 7 } });
        ctrlSpace(view);
        expect(view.state.doc.toString()).to.equal("Span: <% L %>");
        expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).to.equal("L");
    });
});

describe("Shift+F2 while editing", () => {
    it("inserts a comment with the cursor inside it", async () => {
        const [, view] = await cellInEditMode("texl-cell-text", "Span \n");
        expect(shiftF2(view).defaultPrevented).to.be.true;
        expect(view.state.doc.toString()).to.equal("Span <!--[  ]-->");
        expect(view.state.selection.main.head).to.equal("Span <!--[ ".length);
    });

    it("puts the selected text in a comment", async () => {
        const [, view] = await cellInEditMode("texl-cell-markdown", "Span: check\n");
        view.dispatch({ selection: { anchor: 6, head: 11 } });
        shiftF2(view);
        expect(view.state.doc.toString()).to.equal("Span: <!--[ check ]-->");
        expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).to.equal("check");
    });
});

describe("table cell", () => {
    const source =
        "| Quantity | Value |\n" +
        "|----------|------:|\n" +
        "| Stress   | <% math.round s %> N/mm² |\n" +
        "| Pipe     | a \\| b <% x | y %> |\n" +
        "<!--[ Anna: check. ]-->\n";

    it("reads a pipe table with tags and an escaped pipe", () => {
        const table = parseTable(source);
        expect(table.rows).to.deep.equal([
            ["Quantity", "Value"],
            ["Stress", "<% math.round s %> N/mm²"],
            ["Pipe", "a | b <% x | y %>"],
        ]);
        expect(table.align).to.deep.equal(["", "right"]);
        expect(table.tail).to.equal("<!--[ Anna: check. ]-->\n");
    });

    it("refuses a source that is not a table", () => {
        expect(parseTable("Some text\n")).to.be.null;
        expect(parseTable("| a | b |\n| c | d |\n")).to.be.null;
        expect(parseTable("| a |\n|---|\n| b |\nmore text\n")).to.be.null;
    });

    it("writes a table that reads back the same", () => {
        const table = parseTable(source);
        expect(parseTable(serializeTable(table))).to.deep.equal(table);
        expect(serializeTable({ rows: [["a", "bb"], ["1", "2"]], align: ["center", ""], tail: "" })).to.equal(
            "| a   | bb  |\n|:---:|-----|\n| 1   | 2   |",
        );
    });

    it("edits a table as a grid and keeps an unchanged source as written", async () => {
        const cell = await fixture(html`<texl-cell-table .texl=${source}></texl-cell-table>`);
        cell.mode = "edit";
        await cell.updateComplete;
        const inputs = cell.shadowRoot.querySelectorAll(".grid input");
        expect(inputs.length).to.equal(6);
        expect(cell.shadowRoot.activeElement).to.equal(inputs[0]);
        expect(cell.toTexl()).to.equal(source);
        inputs[3].value = "<% s %>";
        inputs[3].dispatchEvent(new Event("input"));
        expect(parseTable(cell.toTexl()).rows[1][1]).to.equal("<% s %>");
    });

    it("adds a row on Tab in the last field", async () => {
        const cell = await fixture(html`<texl-cell-table .texl=${"| a |\n|---|\n| b |\n"}></texl-cell-table>`);
        cell.mode = "edit";
        await cell.updateComplete;
        const last = cell.shadowRoot.querySelector('input[data-row="1"]');
        last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
        await cell.updateComplete;
        expect(cell.shadowRoot.querySelectorAll(".grid input").length).to.equal(3);
        expect(cell.toTexl()).to.equal("| a   |\n|-----|\n| b   |\n|     |\n");
    });

    it("edits a source that is not a table as text", async () => {
        const [cell, view] = await cellInEditMode("texl-cell-table", "Not a table\n");
        expect(view).to.exist;
        expect(cell.toTexl()).to.equal("Not a table\n");
    });

    it("reads a table with blank lines and comments around it and in its rows", () => {
        const table = parseTable(
            "\n  <!--[ head ]-->\n<!-- note -->\n" +
            "<!--[ a ]--> | a | b |  <!--[ b ]-->\n" +
            "|---|:--<!--[ d ]-->|\n" +
            "  | <% x | y %> | 2 <!--[ c | d ]--> |   \n" +
            "\n<!--[ tail ]-->\n  \n",
        );
        expect(table.head).to.equal("\n  <!--[ head ]-->\n<!-- note -->\n");
        expect(table.rows).to.deep.equal([
            ["<!--[ a ]--> a", "b <!--[ b ]--> <!--[ d ]-->"],
            ["<% x | y %>", "2 <!--[ c | d ]-->"],
        ]);
        expect(table.align).to.deep.equal(["", "left"]);
        expect(parseTable(serializeTable(table))).to.deep.equal(table);
    });

    it("accepts a table or an empty source, with blank lines and comments", () => {
        expect(TableCell.accepts("| a |\n|---|\n")).to.be.true;
        expect(TableCell.accepts("\n<!--[ c ]-->\n| a |\n|---|\n<!--[ d ]-->\n")).to.be.true;
        expect(TableCell.accepts("")).to.be.true;
        expect(TableCell.accepts("  \n<!--[ only a comment ]-->\n")).to.be.true;
        expect(TableCell.accepts("Some text\n")).to.be.false;
        expect(TableCell.accepts("| a |\n|---|\n<!--[ c ]-->\n| b |\n")).to.be.false;
        expect(TableCell.accepts("<% x %>")).to.be.false;
    });

    it("starts a new table in an empty source, after its comments", async () => {
        const cell = await fixture(html`<texl-cell-table .texl=${"<!--[ c ]-->\n"}></texl-cell-table>`);
        cell.mode = "edit";
        await cell.updateComplete;
        const inputs = cell.shadowRoot.querySelectorAll(".grid input");
        expect(inputs.length).to.equal(4);
        expect(cell.toTexl()).to.equal("<!--[ c ]-->\n");
        inputs[0].value = "a";
        inputs[0].dispatchEvent(new Event("input"));
        expect(cell.toTexl()).to.equal("<!--[ c ]-->\n| a   |     |\n|-----|-----|\n|     |     |\n");
    });

    it("refuses to commit a source that is not a table, and says why", async () => {
        const [cell, view] = await cellInEditMode("texl-cell-table", "Not a table\n");
        let changes = 0;
        cell.addEventListener("cell-change", () => changes++);
        view.dispatch({ changes: { from: 0, insert: "Still " } });
        cell.exitEdit(true);
        await cell.updateComplete;
        expect(changes).to.equal(0);
        expect(cell.mode).to.equal("edit");
        expect(cell.shadowRoot.querySelector(".input-error").textContent).to.contain("needs a table");
    });
});

describe("formula cell", () => {
    it("reads one tag, or nothing, with white space and comments around it", () => {
        expect(parseFormula("<% a + 1 %>")).to.deep.equal({ before: "", body: " a + 1 ", after: "" });
        expect(parseFormula("\n <!--[ c ]-->\n<% a %>  <!-- d -->\n")).to.deep.equal({
            before: "\n <!--[ c ]-->\n",
            body: " a ",
            after: "  <!-- d -->\n",
        });
        expect(parseFormula(" <!--[ c ]--> ")).to.deep.equal({ before: " <!--[ c ]--> ", body: null, after: "" });
        expect(parseFormula("<% a %> m")).to.be.null;
        expect(parseFormula("<% a %><% b %>")).to.be.null;
        expect(parseFormula("<% a")).to.be.null;
    });

    it("accepts what it reads; text and Markdown accept any source", () => {
        expect(FormulaCell.accepts("  <% a %>\n<!--[ c ]-->\n")).to.be.true;
        expect(FormulaCell.accepts("")).to.be.true;
        expect(FormulaCell.accepts("Span: <% L %> m\n")).to.be.false;
        expect(TextCell.accepts("anything <%")).to.be.true;
        expect(MarkdownCell.accepts("| a |")).to.be.true;
    });

    it("edits the expression without the delimiters, keeping the comments", async () => {
        const source = "<!--[ c ]-->\n<%  q * L ^ 2 / 8 %>\n";
        const [cell, view] = await cellInEditMode("texl-cell-formula", source);
        expect(view.state.doc.toString()).to.equal("q * L ^ 2 / 8");
        expect(cell.toTexl()).to.equal(source);
        view.dispatch({ changes: { from: view.state.doc.length, insert: " + 1" } });
        expect(cell.toTexl()).to.equal("<!--[ c ]-->\n<% q * L ^ 2 / 8 + 1 %>\n");
    });

    it("writes a tag in an empty formula, and removes it when the formula is emptied", async () => {
        const [cell, view] = await cellInEditMode("texl-cell-formula", "");
        view.dispatch({ changes: { from: 0, insert: "1 + 1" } });
        expect(cell.toTexl()).to.equal("<% 1 + 1 %>");
        const [other, otherView] = await cellInEditMode("texl-cell-formula", "<% a %>\n");
        otherView.dispatch({ changes: { from: 0, to: 1 } });
        expect(other.toTexl()).to.equal("\n");
    });

    it("refuses to commit an expression with %>, and says why", async () => {
        const [cell, view] = await cellInEditMode("texl-cell-formula", "<% a %>\n");
        let changes = 0;
        cell.addEventListener("cell-change", () => changes++);
        view.dispatch({ changes: { from: 1, insert: " %> b" } });
        cell.exitEdit(true);
        await cell.updateComplete;
        expect(changes).to.equal(0);
        expect(cell.shadowRoot.querySelector(".input-error").textContent).to.contain("%>");
        view.dispatch({ changes: { from: 1, to: 6 } });
        cell.exitEdit(true);
        expect(changes).to.equal(0);
        view.dispatch({ changes: { from: 1, insert: " + 1" } });
        cell.exitEdit(true);
        expect(changes).to.equal(1);
    });

    it("edits a source that is not a formula as text, and commits it unchanged", async () => {
        const [cell, view] = await cellInEditMode("texl-cell-formula", "Span: <% L %> m\n");
        let exits = 0;
        cell.addEventListener("cell-exit", () => exits++);
        expect(view.state.doc.toString()).to.equal("Span: <% L %> m");
        cell.exitEdit(true);
        expect(exits).to.equal(1);
    });
});
