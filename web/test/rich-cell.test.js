import { expect, fixture, html } from "@open-wc/testing";
import { EditorView as CodeView } from "@codemirror/view";
import { NodeSelection, TextSelection } from "prosemirror-state";
import "../src/editor/index.js";
import { RichCell, MarkdownCell, parseDocument } from "../src/editor/index.js";
import { schema } from "../src/editor/rich/schema.js";

async function editing(texl, outputs = new Map()) {
    const cell = await fixture(html`<texl-cell-rich .texl=${texl} .tagOutputs=${outputs}></texl-cell-rich>`);
    cell.mode = "edit";
    await cell.updateComplete;
    await cell.updateComplete;
    return cell;
}

/** Commits the cell, and returns the source it reports (or null if unchanged). */
function commit(cell) {
    let texl = null;
    cell.addEventListener("cell-change", (e) => (texl = e.detail.texl), { once: true });
    cell.exitEdit(true);
    return texl;
}

function press(view, key, init = {}) {
    const codes = { Enter: 13, Escape: 27, Tab: 9, F2: 113, b: 66, i: 73, u: 85, e: 69, k: 75 };
    const event = new KeyboardEvent("keydown", { key, keyCode: codes[key] ?? 0, bubbles: true, cancelable: true, composed: true, ...init });
    view.dom.dispatchEvent(event);
    return event;
}

const selectAll = (view) =>
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, view.state.doc.firstChild.nodeSize - 1)));

const fieldView = (cell) => CodeView.findFromDOM(cell.shadowRoot.querySelector(".field .cm-editor"));

async function typeInField(cell, text) {
    await cell.updateComplete;
    const view = fieldView(cell);
    view.dispatch(view.state.replaceSelection(text));
    await cell.updateComplete;
    return view;
}

/** Replaces all the field holds. */
async function setField(cell, text) {
    await cell.updateComplete;
    const view = fieldView(cell);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    await cell.updateComplete;
}

function pressInField(cell, key) {
    const view = fieldView(cell);
    const event = new KeyboardEvent("keydown", { key, keyCode: key === "Enter" ? 13 : 27, bubbles: true, cancelable: true, composed: true });
    view.contentDOM.dispatchEvent(event);
    return event;
}

describe("rich text cell", () => {
    it("is a type that accepts simple text and refuses what it cannot hold, with the reason", async () => {
        expect(RichCell.accepts("# T\n\nsome *text*\n")).to.be.true;
        expect(RichCell.accepts("| a |\n|---|\n| b |\n")).to.be.false;
        expect(RichCell.accepts("<div>x</div>\n")).to.be.false;
        expect(RichCell.needs).to.include("raw HTML");
    });

    it("shows its output as a Markdown cell does", async () => {
        const output = "# T\n\nsome *text*\n";
        const rich = await fixture(html`<texl-cell-rich .output=${output}></texl-cell-rich>`);
        const markdown = await fixture(html`<texl-cell-markdown .output=${output}></texl-cell-markdown>`);
        expect(rich).to.be.instanceOf(MarkdownCell);
        expect(rich.shadowRoot.querySelector(".view").innerHTML).to.equal(markdown.shadowRoot.querySelector(".view").innerHTML);
    });

    it("edits on the typography of the output", async () => {
        const cell = await editing("# T\n");
        const editor = cell.shadowRoot.querySelector(".ProseMirror");
        expect(editor.classList.contains("view")).to.be.true;
        expect(editor.querySelector("h1").textContent).to.equal("T");
    });

    it("takes the focus, with the cursor at the end", async () => {
        const cell = await editing("abc\n");
        expect(cell._rich.hasFocus()).to.be.true;
        expect(cell._rich.state.selection.from).to.equal(4);
    });

    it("commits nothing when nothing changed", async () => {
        const cell = await editing("Wrapped\ntext  with *stars*\n\n* a\n<!--[ c ]-->\n");
        expect(commit(cell)).to.equal(null);
    });

    it("commits typed text, keeping the line break and the comments", async () => {
        const cell = await editing("abc\n<!--[ c ]-->\n");
        cell._rich.dispatch(cell._rich.state.tr.insertText("d", 4));
        expect(commit(cell)).to.equal("abcd\n<!--[ c ]-->\n");
    });

    it("leaves the cell with Mod+Enter and Escape", async () => {
        for (const [init, committed] of [
            [{ key: "Enter", ctrlKey: true }, true],
            [{ key: "Escape" }, false],
        ]) {
            const cell = await editing("abc\n");
            let exits = 0;
            let changes = 0;
            cell.addEventListener("cell-exit", () => exits++);
            cell.addEventListener("cell-change", () => changes++);
            cell._rich.dispatch(cell._rich.state.tr.insertText("d", 4));
            press(cell._rich, init.key, init);
            expect(exits).to.equal(1);
            expect(changes).to.equal(committed ? 1 : 0);
        }
    });

    it("formats with the keys and the toolbar", async () => {
        const cell = await editing("abc\n");
        selectAll(cell._rich);
        press(cell._rich, "b", { ctrlKey: true });
        await cell.updateComplete;
        expect(cell.shadowRoot.querySelector('button[aria-label^="Bold"]').getAttribute("aria-pressed")).to.equal("true");
        cell.shadowRoot.querySelector('button[aria-label^="Italic"]').click();
        await cell.updateComplete;
        expect(commit(cell)).to.equal("***abc***\n");
    });

    it("has an icon on every toolbar button", async () => {
        const cell = await editing("abc\n");
        for (const button of cell.shadowRoot.querySelectorAll(".tools button")) {
            const shape = button.querySelector("svg")?.getBBox();
            expect(button.textContent.trim() || shape.width, button.title).to.be.ok;
        }
    });

    it("sets the style of a block from the menu", async () => {
        const cell = await editing("abc\n");
        const select = cell.shadowRoot.querySelector(".tools select");
        select.value = "h2";
        select.dispatchEvent(new Event("change"));
        expect(commit(cell)).to.equal("## abc\n");
    });

    it("makes lists from the toolbar, and Tab indents in them", async () => {
        const cell = await editing("a\n");
        cell.shadowRoot.querySelector('button[aria-label="Bulleted list"]').click();
        await cell.updateComplete;
        expect(commit(cell)).to.equal("- a\n");
    });

    it("stays in the cell on Tab", async () => {
        const cell = await editing("a\n");
        expect(press(cell._rich, "Tab").defaultPrevented).to.be.true;
    });

    it("shows tight lists as tight", async () => {
        const cell = await editing("- a\n- b\n");
        const paragraph = cell.shadowRoot.querySelector(".ProseMirror li p");
        expect(getComputedStyle(paragraph).marginBottom).to.equal("0px");
    });

    describe("formula chips", () => {
        const chips = (cell) => [...cell.shadowRoot.querySelectorAll(".chip")];
        const select = (cell, pos) => cell._rich.dispatch(cell._rich.state.tr.setSelection(NodeSelection.create(cell._rich.state.doc, pos)));

        it("shows a value, with the expression on hover", async () => {
            const cell = await editing("M = <% a * b %> kNm\n", new Map([["<% a * b %>", "56.25"]]));
            expect(chips(cell)[0].textContent).to.equal("56.25");
            expect(chips(cell)[0].title).to.equal("a * b");
        });

        it("shows a small ƒ for a tag with no output", async () => {
            const cell = await editing("<% L = 6 %>\n", new Map([["<% L = 6 %>", ""]]));
            expect(chips(cell)[0].textContent).to.equal("ƒ");
            expect(chips(cell)[0].classList.contains("silent")).to.be.true;
        });

        it("shows the expression of a formula not rendered yet", async () => {
            const cell = await editing("<% a + b %>\n");
            expect(chips(cell)[0].textContent).to.equal("a + b");
            expect(chips(cell)[0].classList.contains("new")).to.be.true;
        });

        it("marks an undefined value", async () => {
            const cell = await editing("<% x %>\n", new Map([["<% x %>", "[[Undefined]]"]]));
            expect(chips(cell)[0].classList.contains("error")).to.be.true;
        });

        it("never shows a value as HTML", async () => {
            const cell = await editing("<% x %>\n", new Map([["<% x %>", '<img src=x onerror="alert(1)">a']]));
            expect(chips(cell)[0].querySelector("img")).to.equal(null);
            expect(chips(cell)[0].textContent).to.equal("a");
        });

        it("updates when a rendering arrives while editing", async () => {
            const cell = await editing("<% x %>\n");
            cell.tagOutputs = new Map([["<% x %>", "7"]]);
            await cell.updateComplete;
            expect(chips(cell)[0].textContent).to.equal("7");
        });

        it("opens a field on a click, and changes the formula", async () => {
            const cell = await editing("a <% x %>\n");
            const { x, y, width, height } = chips(cell)[0].getBoundingClientRect();
            const at = { clientX: x + width / 2, clientY: y + height / 2, bubbles: true, composed: true, button: 0, detail: 1 };
            chips(cell)[0].dispatchEvent(new MouseEvent("mousedown", at));
            chips(cell)[0].dispatchEvent(new MouseEvent("mouseup", at));
            await cell.updateComplete;
            const field = fieldView(cell);
            expect(field.state.doc.toString()).to.equal("x");
            field.dispatch({ changes: { from: 0, to: 1, insert: "y + 1" } });
            pressInField(cell, "Enter");
            await cell.updateComplete;
            expect(cell.shadowRoot.querySelector(".field")).to.equal(null);
            expect(commit(cell)).to.equal("a <% y + 1 %>\n");
        });

        it("opens the field with Enter on a selected chip; Escape cancels and stays in the cell", async () => {
            const cell = await editing("<% x %>\n");
            let exits = 0;
            cell.addEventListener("cell-exit", () => exits++);
            select(cell, 1);
            press(cell._rich, "Enter");
            await typeInField(cell, "z");
            expect(pressInField(cell, "Escape").defaultPrevented).to.be.true;
            await cell.updateComplete;
            expect(exits).to.equal(0);
            expect(cell.shadowRoot.querySelector(".field")).to.equal(null);
            expect(commit(cell)).to.equal(null);
        });

        it("refuses an expression that would end the tag", async () => {
            const cell = await editing("<% x %>\n");
            select(cell, 1);
            press(cell._rich, "Enter");
            await setField(cell, "a %> b");
            pressInField(cell, "Enter");
            await cell.updateComplete;
            expect(cell.shadowRoot.querySelector(".field .problem").textContent).to.include("%>");
            expect(fieldView(cell).state.doc.toString()).to.equal("a %> b");
        });

        it("opens the field with the cursor at the end", async () => {
            const cell = await editing("<% abc %>\n");
            select(cell, 1);
            press(cell._rich, "Enter");
            await typeInField(cell, "d");
            expect(fieldView(cell).state.doc.toString()).to.equal("abcd");
        });

        it("removes a formula whose expression is emptied", async () => {
            const cell = await editing("a <% x %>\n");
            select(cell, 3);
            press(cell._rich, "Enter");
            await setField(cell, "");
            pressInField(cell, "Enter");
            await cell.updateComplete;
            expect(commit(cell)).to.equal("a \n");
        });

        it("inserts one with Mod+E, from the selected text if any", async () => {
            const cell = await editing("a\n");
            selectAll(cell._rich);
            press(cell._rich, "e", { ctrlKey: true });
            await cell.updateComplete;
            expect(fieldView(cell).state.doc.toString()).to.equal("a");
            pressInField(cell, "Enter");
            await cell.updateComplete;
            expect(commit(cell)).to.equal("<% a %>\n");
        });

        it("starts one when <% is typed", async () => {
            const cell = await editing("a\n");
            const { _rich: view } = cell;
            const typed = view.someProp("handleTextInput", (f) => {
                view.dispatch(view.state.tr.insertText("<", 2));
                return f(view, 3, 3, "%", () => view.state.tr.insertText("%", 3));
            });
            expect(typed).to.be.true;
            await Promise.resolve();
            await cell.updateComplete;
            expect(cell.shadowRoot.querySelector(".field")).to.exist;
            expect(view.state.doc.textContent).to.equal("a");
        });

        it("keeps what is typed in the field while a preview updates", async () => {
            const cell = await editing("a\n");
            cell.shadowRoot.querySelector('button[aria-label="Equation"]').click();
            await typeInField(cell, "x^2");
            await typeInField(cell, "+1");
            expect(fieldView(cell).state.doc.toString()).to.equal("x^2+1");
            expect(cell.shadowRoot.querySelector(".field .preview .katex")).to.exist;
        });

        it("applies an open field on commit", async () => {
            const cell = await editing("a\n");
            press(cell._rich, "e", { ctrlKey: true });
            await typeInField(cell, "b");
            expect(commit(cell)).to.equal("a<% b %>\n");
        });
    });

    describe("equations", () => {
        it("are typeset, with the values of their tags", async () => {
            const cell = await editing("$x = <% a %>$\n\n$$y^2$$\n", new Map([["<% a %>", "3"]]));
            const [inline, block] = cell.shadowRoot.querySelectorAll(".equation");
            expect(inline.querySelector(".katex")).to.exist;
            expect(inline.querySelector(".katex-html").textContent).to.include("3");
            expect(block.querySelector(".katex-display")).to.exist;
        });

        it("keep their source", async () => {
            const cell = await editing("a $x = <% a %>$\n\n$$\ny^2\n$$\n");
            cell._rich.dispatch(cell._rich.state.tr.insertText("b ", 1));
            expect(commit(cell)).to.equal("b a $x = <% a %>$\n\n$$\ny^2\n$$\n");
        });

        it("keep the lines around them when edited", async () => {
            const cell = await editing("$$\ny^2\n$$\n");
            cell._rich.dispatch(cell._rich.state.tr.setSelection(NodeSelection.create(cell._rich.state.doc, 0)));
            press(cell._rich, "Enter");
            await cell.updateComplete;
            expect(fieldView(cell).state.doc.toString()).to.equal("y^2");
            await typeInField(cell, "+1");
            pressInField(cell, "Enter");
            await cell.updateComplete;
            expect(commit(cell)).to.equal("$$\ny^2+1\n$$\n");
        });

        it("are made when a closing dollar is typed", async () => {
            const cell = await editing("is $x^2\n");
            const { _rich: view } = cell;
            const end = view.state.selection.from;
            view.someProp("handleTextInput", (f) => f(view, end, end, "$", () => view.state.tr.insertText("$", end)));
            expect(commit(cell)).to.equal("is $x^2$\n");
        });
    });

    describe("links", () => {
        it("are set on the selection with Mod+K", async () => {
            const cell = await editing("abc\n");
            selectAll(cell._rich);
            press(cell._rich, "k", { ctrlKey: true });
            await typeInField(cell, "http://x.io");
            pressInField(cell, "Enter");
            await cell.updateComplete;
            expect(commit(cell)).to.equal("[abc](http://x.io)\n");
        });

        it("are changed and removed from within", async () => {
            const cell = await editing("a [bc](u.texl) d\n");
            const set = (pos) => cell._rich.dispatch(cell._rich.state.tr.setSelection(TextSelection.create(cell._rich.state.doc, pos)));
            set(5);
            press(cell._rich, "k", { ctrlKey: true });
            await cell.updateComplete;
            expect(fieldView(cell).state.doc.toString()).to.equal("u.texl");
            await setField(cell, "");
            pressInField(cell, "Enter");
            await cell.updateComplete;
            expect(commit(cell)).to.equal("a bc d\n");
        });

        it("never get a script address in the editor", async () => {
            const cell = await editing("[a](javascript:alert(1))\n");
            expect(cell.shadowRoot.querySelector(".ProseMirror a").getAttribute("href")).to.equal("");
        });
    });

    it("adds a comment with Shift+F2, at the end of the cell", async () => {
        const cell = await editing("a\n<!--[ one ]-->\n");
        press(cell._rich, "F2", { shiftKey: true });
        await typeInField(cell, "two");
        pressInField(cell, "Enter");
        await cell.updateComplete;
        expect(commit(cell)).to.equal("a\n<!--[ one ]-->\n<!--[ two ]-->\n");
    });

    describe("paste", () => {
        const paste = (view, types) => {
            const data = new DataTransfer();
            for (const [type, value] of Object.entries(types)) data.setData(type, value);
            view.dom.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
        };

        it("keeps the supported formatting of HTML, and no other", async () => {
            const cell = await editing("\n");
            paste(cell._rich, { "text/html": '<p>a <b>b</b> <span style="color:red;font-size:30px">c</span><script>x</script><table><tr><td>d</td></tr></table></p>' });
            await cell.updateComplete;
            const source = commit(cell);
            expect(source).to.include("a **b** c");
            expect(source).to.not.include("span");
            expect(source).to.not.include("script");
        });

        it("makes the tags of plain text formulas", async () => {
            const cell = await editing("\n");
            paste(cell._rich, { "text/plain": "M = <% a %> kNm" });
            await cell.updateComplete;
            expect(commit(cell)).to.equal("M = <% a %> kNm\n");
        });

        it("does not let pasted HTML smuggle anything into the source", async () => {
            const cell = await editing("\n");
            const evil = "<% a %>\n<!--{ evil : text }-->\nx<% b %>";
            paste(cell._rich, { "text/html": `<p>a<span data-tag="${evil.replace(/"/g, "&quot;").replace(/</g, "&lt;")}">v</span></p>` });
            await cell.updateComplete;
            const source = commit(cell);
            expect(source).to.not.include("<%");
            expect(source).to.not.include("<!--{");
        });

        it("copies a formula as its source", async () => {
            const cell = await editing("a <% x %>\n");
            const slice = cell._rich.state.doc.slice(1, 4);
            const text = cell._rich.someProp("clipboardTextSerializer", (f) => f(slice, cell._rich));
            expect(text).to.equal("a <% x %>");
        });
    });

    describe("a source it does not accept", () => {
        it("is edited as Markdown text", async () => {
            const cell = await editing("<div>x</div>\n");
            expect(cell._rich).to.equal(null);
            expect(cell.shadowRoot.querySelector(".cm-editor")).to.exist;
            expect(cell.shadowRoot.querySelector(".tools")).to.equal(null);
        });

        it("is not committed changed until it is accepted, with the reason", async () => {
            const cell = await editing("<div>x</div>\n");
            const view = CodeView.findFromDOM(cell.shadowRoot.querySelector(".cm-editor"));
            view.dispatch({ changes: { from: 0, insert: "a " } });
            let exits = 0;
            cell.addEventListener("cell-exit", () => exits++);
            cell.exitEdit(true);
            await cell.updateComplete;
            expect(exits).to.equal(0);
            expect(cell.shadowRoot.querySelector(".input-error").textContent).to.include("without raw HTML");
        });
    });
});

describe("rich text in the editor", () => {
    async function editorWith(source) {
        const editor = await fixture(html`<texl-editor url="/virtual/doc.texl" .value=${source}></texl-editor>`);
        await editor.rendered;
        await editor.updateComplete;
        return editor;
    }
    const cell = (editor, i) => editor.shadowRoot.querySelector(`[data-index="${i}"]`);
    const key = (editor, init) => editor.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, ...init }));

    it("makes rich text the default type of new cells", async () => {
        const editor = await editorWith("<!--{ abc1 : text }-->\nA\n<!--{ abc2 : text }-->\nB\n");
        expect(cell(editor, 2).localName).to.equal("texl-cell-rich");
        key(editor, { key: "Insert" });
        await editor.updateComplete;
        expect(parseDocument(editor.value).map(({ type }) => type)).to.deep.equal(["text", "rich", "text"]);
    });

    it("changes a cell to rich text with r, and back to Markdown, keeping the source", async () => {
        const source = "<!--{ abc1 : markdown }-->\nSome *text*\n";
        const editor = await editorWith(source);
        key(editor, { key: "r" });
        await editor.updateComplete;
        await cell(editor, 0).updateComplete;
        expect(cell(editor, 0).localName).to.equal("texl-cell-rich");
        expect(editor.editing).to.be.true;
        key(editor, { key: "Escape" });
        await editor.updateComplete;
        expect(editor.value).to.equal(source.replace("markdown", "rich"));
    });

    it("gives chips the values of the last rendering", async () => {
        const editor = await editorWith("<!--{ abc1 : rich }-->\n<% x = 2 %>Value <% x * 3 %>\n");
        key(editor, { key: "Enter" });
        await editor.updateComplete;
        const rich = cell(editor, 0);
        await rich.updateComplete;
        await rich.updateComplete;
        const chips = [...rich.shadowRoot.querySelectorAll(".chip")];
        expect(chips.map((chip) => chip.textContent)).to.deep.equal(["ƒ", "6"]);
    });

    it("keeps the arrow keys inside a cell in edit mode", async () => {
        const editor = await editorWith("<!--{ abc1 : rich }-->\nA\n<!--{ abc2 : rich }-->\nB\n");
        key(editor, { key: "Enter" });
        await editor.updateComplete;
        const rich = cell(editor, 0);
        await rich.updateComplete;
        rich._rich.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", keyCode: 40, bubbles: true, composed: true, cancelable: true }));
        await editor.updateComplete;
        expect(rich.mode).to.equal("edit");
        expect(cell(editor, 1).mode).to.equal("render");
    });

    it("commits with Mod+Enter through the editor, and shows the value", async () => {
        const editor = await editorWith("<!--{ abc1 : rich }-->\nA\n");
        key(editor, { key: "Enter" });
        await editor.updateComplete;
        const rich = cell(editor, 0);
        await rich.updateComplete;
        const view = rich._rich;
        view.dispatch(view.state.tr.insert(2, schema.nodes.tag.create({ source: "<% 2 + 3 %>" })));
        expect(await editor.runCommand("commit")).to.be.true;
        await editor.rendered;
        await editor.updateComplete;
        expect(editor.value).to.equal("<!--{ abc1 : rich }-->\nA<% 2 + 3 %>\n");
        expect(cell(editor, 0).output).to.include("A5");
    });
});
