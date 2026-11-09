import { schema } from "../src/editor/rich/schema.js";
import { expect, fixture, html } from "@open-wc/testing";
import { EditorView } from "@codemirror/view";
import "../src/editor/index.js";
import { parseDocument } from "../src/editor/document.js";

const SOURCE = `<!--{ txt2 : text }-->
<% L = 6, q = 12.5 %>Span: <% L %> m
<!--{ mdn3 : markdown }-->
<% q * L ^ 2 / 8 %>
`;

/** A document without its cell names, which the editor may generate. */
const anon = (source) => source.replace(/<!--\{ [^:]*? : /g, "<!--{ ");

async function editorWith(source) {
    const editor = await fixture(html`<texl-editor></texl-editor>`);
    editor.value = source;
    await editor.rendered;
    await editor.updateComplete;
    return editor;
}

function cells(editor) {
    return [...editor.shadowRoot.querySelectorAll("[data-index]")];
}

describe("texl-editor", () => {
    it("renders one element per cell, by type", async () => {
        const editor = await editorWith(SOURCE);
        expect(cells(editor).slice(0, 2).map((c) => c.localName)).to.deep.equal([
            "texl-cell-text",
            "texl-cell-markdown",
        ]);
    });

    it("renders cells in one shared scope", async () => {
        const editor = await editorWith(SOURCE);
        const [text, formula] = cells(editor);
        await formula.updateComplete;
        expect(text.output).to.equal("Span: 6 m\n");
        expect(formula.shadowRoot.textContent.trim()).to.equal("56.25");
    });

    it("returns the document unchanged", async () => {
        const editor = await editorWith(SOURCE);
        expect(anon(editor.value)).to.equal(anon(SOURCE));
    });

    it("edits a cell and updates the document", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        const formula = cells(editor)[1];
        await formula.updateComplete;
        const view = EditorView.findFromDOM(formula.shadowRoot.querySelector(".cm-editor"));
        expect(view.state.doc.toString()).to.equal("<% q * L ^ 2 / 8 %>");

        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "<% q * L %>" } });
        view.contentDOM.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, keyCode: 13, bubbles: true, composed: true, cancelable: true }),
        );
        await editor.rendered;
        await editor.updateComplete;
        expect(editor.value).to.contain("<% q * L %>\n");
        expect(cells(editor)[1].mode).to.equal("render");
        expect(cells(editor)[1].output.trim()).to.equal("75");
    });

    it("leaves the document unchanged when an edit changes nothing", async () => {
        const editor = await editorWith(SOURCE);
        let changes = 0;
        editor.addEventListener("change", () => changes++);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, cancelable: true }));
        await editor.updateComplete;
        expect(changes).to.equal(0);
        expect(anon(editor.value)).to.equal(anon(SOURCE));
    });

    it("edits a text cell in a CodeMirror editor: Enter adds a line, Ctrl+Enter commits", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        const text = cells(editor)[0];
        await text.updateComplete;
        const view = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        expect(view.hasFocus).to.be.true;

        view.dispatch({ selection: { anchor: view.state.doc.length } });
        const enter = new KeyboardEvent("keydown", {
            key: "Enter", keyCode: 13, bubbles: true, composed: true, cancelable: true,
        });
        view.contentDOM.dispatchEvent(enter);
        expect(enter.defaultPrevented).to.be.true;
        expect(text.mode).to.equal("edit");

        view.dispatch({ changes: { from: view.state.doc.length, insert: "Load: <% q %>" } });
        view.contentDOM.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, keyCode: 13, bubbles: true, composed: true, cancelable: true }),
        );
        await editor.rendered;
        await editor.updateComplete;
        expect(text.mode).to.equal("render");
        expect(text.shadowRoot.querySelector(".cm-editor")).to.be.null;
        expect(text.texl).to.equal("<% L = 6, q = 12.5 %>Span: <% L %> m\nLoad: <% q %>\n");
        expect(text.output).to.equal("Span: 6 m\nLoad: 12.5\n");
    });

    it("hides the line break that ends the source while editing", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
        await editor.updateComplete;
        const text = cells(editor)[0];
        await text.updateComplete;
        const view = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        expect(text.texl.endsWith("\n")).to.be.true;
        expect(view.state.doc.toString().endsWith("\n")).to.be.false;
    });

    it("starts editing with the cursor at the end of the text", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
        await editor.updateComplete;
        const text = cells(editor)[0];
        await text.updateComplete;
        const view = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        expect(view.state.selection.main.head).to.equal(view.state.doc.length);
    });

    it("shows the cursor before the first character", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
        await editor.updateComplete;
        const text = cells(editor)[0];
        await text.updateComplete;
        const view = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        view.dispatch({ selection: { anchor: 0 } });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const cursor = text.shadowRoot.querySelector(".cm-cursor").getBoundingClientRect();
        const scroller = text.shadowRoot.querySelector(".cm-scroller").getBoundingClientRect();
        expect(cursor.left).to.be.at.least(scroller.left);
    });

    it("discards the changes on Escape", async () => {
        const editor = await editorWith(SOURCE);
        let changes = 0;
        editor.addEventListener("change", () => changes++);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        const text = cells(editor)[0];
        await text.updateComplete;
        const view = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        view.dispatch({ changes: { from: 0, insert: "Changed " }, selection: { anchor: 0, head: 7 } });

        const escape = new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true, composed: true, cancelable: true });
        view.contentDOM.dispatchEvent(escape);
        await editor.updateComplete;
        expect(escape.defaultPrevented).to.be.true;
        expect(text.mode).to.equal("render");
        expect(changes).to.equal(0);
        expect(anon(editor.value)).to.equal(anon(SOURCE));

        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        await text.updateComplete;
        const reopened = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        expect(reopened.state.doc.toString()).to.equal("<% L = 6, q = 12.5 %>Span: <% L %> m");
    });

    for (const init of [{ key: "Enter" }, { key: "Enter", ctrlKey: true }, { key: "F2" }]) {
        it(`starts editing with ${init.ctrlKey ? "Ctrl+" : ""}${init.key}`, async () => {
            const editor = await editorWith(SOURCE);
            const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
            editor.dispatchEvent(event);
            await editor.updateComplete;
            expect(event.defaultPrevented).to.be.true;
            expect(cells(editor)[0].mode).to.equal("edit");
        });
    }

    it("shows a sheet of 100 lines, or `rows` lines", async () => {
        const editor = await editorWith(SOURCE);
        expect(cells(editor)).to.have.length(100);
        editor.rows = 5;
        await editor.updateComplete;
        expect(cells(editor)).to.have.length(5);
        editor.rows = 1;
        await editor.updateComplete;
        expect(cells(editor)).to.have.length(2);
    });

    it("scrolls to keep the selected line in view", async () => {
        const editor = await editorWith(SOURCE);
        editor.style.height = "200px";
        for (let i = 0; i < 30; i++) editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        await editor.updateComplete;
        const box = editor.getBoundingClientRect();
        const line = cells(editor)[30].getBoundingClientRect();
        expect(editor.scrollTop).to.be.greaterThan(0);
        expect(line.top).to.be.at.least(box.top);
        expect(line.bottom).to.be.at.most(box.bottom);
    });

    it("adds an empty line to the document when written in", async () => {
        const editor = await editorWith(SOURCE);
        const key = (init) => editor.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, ...init }));
        for (let i = 0; i < 3; i++) key({ key: "ArrowDown" });
        key({ key: "Enter", ctrlKey: true });
        await editor.updateComplete;
        const line = cells(editor)[3];
        await line.updateComplete;
        const { _rich: view } = line;
        view.dispatch(view.state.tr.insertText("Load: ", 1).insert(7, schema.nodes.tag.create({ source: "<% q %>" })));
        key({ key: "Enter", ctrlKey: true });
        await editor.rendered;
        await editor.updateComplete;
        expect(anon(editor.value)).to.equal(anon(`${SOURCE}<!--{ mdn3 : rich }-->\n<!--{ mdn3 : rich }-->\nLoad: <% q %>`));
        expect(cells(editor)[3].output).to.equal("Load: 12.5");
        expect(cells(editor)).to.have.length(100);
    });

    describe("cell actions", () => {
        const key = (editor, init) => {
            const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
            editor.dispatchEvent(event);
            return event;
        };
        const clipboard = (editor, type, text) => {
            const clipboardData = new DataTransfer();
            if (text !== undefined) clipboardData.setData("text/plain", text);
            const event = new ClipboardEvent(type, { clipboardData, cancelable: true });
            editor.dispatchEvent(event);
            return event;
        };
        const settle = async (editor) => {
            await editor.rendered;
            await editor.updateComplete;
        };
        const FORMULA = "<!--{ mdn3 : markdown }-->\n<% q * L ^ 2 / 8 %>\n";

        for (const name of ["Delete", "Backspace"]) {
            it(`deletes the selected cell with ${name}`, async () => {
                const editor = await editorWith(SOURCE);
                let changes = 0;
                editor.addEventListener("change", () => changes++);
                expect(key(editor, { key: name }).defaultPrevented).to.be.true;
                await settle(editor);
                expect(anon(editor.value)).to.equal(anon(FORMULA));
                expect(changes).to.equal(1);
                expect(cells(editor)[0].localName).to.equal("texl-cell-markdown");
            });
        }

        it("does nothing on Delete below the document", async () => {
            const editor = await editorWith(SOURCE);
            let changes = 0;
            editor.addEventListener("change", () => changes++);
            for (let i = 0; i < 5; i++) key(editor, { key: "ArrowDown" });
            key(editor, { key: "Delete" });
            await settle(editor);
            expect(changes).to.equal(0);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        for (const init of [{ key: "Insert" }, { key: "Enter", altKey: true }]) {
            it(`inserts an empty cell below with ${init.altKey ? "Alt+" : ""}${init.key} and selects it`, async () => {
                const editor = await editorWith(SOURCE);
                expect(key(editor, init).defaultPrevented).to.be.true;
                await settle(editor);
                expect(anon(editor.value)).to.equal(anon(SOURCE.replace("<!--{ mdn3 : markdown", "<!--{ mdn3 : rich }-->\n<!--{ mdn3 : markdown")));
                expect(cells(editor)[1].selected).to.be.true;
                expect(cells(editor)[1].mode).to.equal("render");
                expect(cells(editor)[2].output.trim()).to.equal("56.25");
            });
        }

        it("inserts an empty cell above with Alt+Shift+Enter and selects it", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            key(editor, { key: "Enter", altKey: true, shiftKey: true });
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE.replace("<!--{ mdn3 : markdown", "<!--{ mdn3 : rich }-->\n<!--{ mdn3 : markdown")));
            expect(cells(editor)[1].selected).to.be.true;
        });

        it("leaves Shift+Insert, Ctrl+Insert and Shift+Delete to the browser", async () => {
            const editor = await editorWith(SOURCE);
            for (const init of [
                { key: "Insert", shiftKey: true },
                { key: "Insert", ctrlKey: true },
                { key: "Delete", shiftKey: true },
            ]) {
                expect(key(editor, init).defaultPrevented).to.be.false;
            }
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("only moves down on Insert below the last cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            key(editor, { key: "Insert" });
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
            expect(cells(editor)[2].selected).to.be.true;
        });

        it("drops empty cells at the end of the document", async () => {
            const editor = await editorWith(SOURCE + "<!--{ txt2 : text }-->\n");
            key(editor, { key: "ArrowDown" });
            key(editor, { key: "Delete" });
            expect(anon(editor.value)).to.equal(anon(SOURCE.slice(0, -FORMULA.length)));
        });

        it("gives a marker to a cell without one that is no longer first", async () => {
            const editor = await editorWith("Intro\n");
            key(editor, { key: "Enter", altKey: true, shiftKey: true });
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon("<!--{ mdn3 : rich }-->\n<!--{ txt2 : text }-->\nIntro\n"));
        });

        it("copies the selected cell with its marker", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            const event = clipboard(editor, "copy");
            expect(event.defaultPrevented).to.be.true;
            expect(anon(event.clipboardData.getData("text/plain"))).to.equal(anon(FORMULA));
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("cuts the selected cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            const event = clipboard(editor, "cut");
            await settle(editor);
            expect(anon(event.clipboardData.getData("text/plain"))).to.equal(anon(FORMULA));
            expect(anon(editor.value)).to.equal(anon(SOURCE.slice(0, -FORMULA.length)));
        });

        it("pastes a copied cell in place of the selected one", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            const copied = clipboard(editor, "copy").clipboardData.getData("text/plain");
            key(editor, { key: "ArrowDown" });
            clipboard(editor, "paste", copied);
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE + FORMULA));
            expect(cells(editor)[2].output.trim()).to.equal("56.25");
        });

        it("pastes plain text as a text cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            clipboard(editor, "paste", "Load: <% q %>");
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE.replace(FORMULA, "<!--{ txt2 : text }-->\nLoad: <% q %>")));
            expect(cells(editor)[1].output).to.equal("Load: 12.5");
        });

        it("undoes and redoes cell actions", async () => {
            const editor = await editorWith(SOURCE);
            let changes = 0;
            editor.addEventListener("change", () => changes++);
            key(editor, { key: "Delete" });
            key(editor, { key: "Enter", altKey: true, shiftKey: true });
            const changed = editor.value;
            expect(anon(changed)).to.equal(anon("<!--{ mdn3 : rich }-->\n" + FORMULA));
            expect(key(editor, { key: "z", ctrlKey: true }).defaultPrevented).to.be.true;
            expect(anon(editor.value)).to.equal(anon(FORMULA));
            key(editor, { key: "z", metaKey: true });
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
            expect(cells(editor)[0].output).to.equal("Span: 6 m\n");
            key(editor, { key: "z", ctrlKey: true });
            expect(anon(editor.value)).to.equal(anon(SOURCE));

            key(editor, { key: "Z", ctrlKey: true, shiftKey: true });
            expect(anon(editor.value)).to.equal(anon(FORMULA));
            key(editor, { key: "y", ctrlKey: true });
            expect(anon(editor.value)).to.equal(anon(changed));
            key(editor, { key: "y", ctrlKey: true });
            expect(anon(editor.value)).to.equal(anon(changed));
            expect(changes).to.equal(6);
        });

        it("undoes an edit and selects the edited cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            clipboard(editor, "paste", "Load: <% q %>");
            key(editor, { key: "ArrowUp" });
            key(editor, { key: "z", ctrlKey: true });
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
            expect(cells(editor)[1].selected).to.be.true;
        });

        it("forgets the changes to undo when a new change is made or the value is set", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "Delete" });
            key(editor, { key: "z", ctrlKey: true });
            key(editor, { key: "Insert" });
            const changed = editor.value;
            key(editor, { key: "y", ctrlKey: true });
            expect(anon(editor.value)).to.equal(anon(changed));

            editor.value = SOURCE;
            key(editor, { key: "z", ctrlKey: true });
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        describe("on several cells", () => {
            const A = "<!--{ alf2 : text }-->\nA\n";
            const B = "<!--{ brv3 : text }-->\nB\n";
            const C = "<!--{ chl4 : text }-->\nC\n";
            const selected = (editor) => cells(editor).flatMap((c, i) => (c.selected ? [i] : []));

            it("selects several cells with Shift+ArrowDown/ArrowUp and Shift+click", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "ArrowDown", shiftKey: true });
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([0, 1, 2]);
                key(editor, { key: "ArrowUp", shiftKey: true });
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([0, 1]);
                key(editor, { key: "ArrowDown" });
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([2]);

                cells(editor)[0].dispatchEvent(new MouseEvent("click", { shiftKey: true }));
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([0, 1, 2]);
                cells(editor)[1].click();
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([1]);
            });

            it("edits only the last selected cell", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "Enter" });
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([1]);
                expect(cells(editor)[1].mode).to.equal("edit");
            });

            it("deletes, copies and cuts the selected cells", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown" });
                key(editor, { key: "ArrowDown", shiftKey: true });
                expect(anon(clipboard(editor, "copy").clipboardData.getData("text/plain"))).to.equal(anon(B + C));
                key(editor, { key: "Delete" });
                expect(anon(editor.value)).to.equal(anon(A));
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([1]);

                key(editor, { key: "z", ctrlKey: true });
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(A + B + C));
                expect(selected(editor)).to.deep.equal([1, 2]);
                key(editor, { key: "ArrowUp" });
                key(editor, { key: "ArrowUp" });
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "ArrowDown", shiftKey: true });
                expect(anon(clipboard(editor, "cut").clipboardData.getData("text/plain"))).to.equal(anon(A + B + C));
                expect(anon(editor.value)).to.equal(anon(""));
            });

            it("pastes over the selected cells and selects the pasted ones", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                clipboard(editor, "paste", C + C + C);
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(C + C + C + C));
                expect(selected(editor)).to.deep.equal([0, 1, 2]);
            });

            it("inserts below and above the selected cells", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "Insert" });
                expect(anon(editor.value)).to.equal(anon(A + B + "<!--{ mdn3 : rich }-->\n" + C));
                key(editor, { key: "ArrowUp", shiftKey: true });
                key(editor, { key: "Enter", altKey: true, shiftKey: true });
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(A + "<!--{ mdn3 : rich }-->\n" + B + "<!--{ mdn3 : rich }-->\n" + C));
                expect(selected(editor)).to.deep.equal([1]);
            });
        });

        describe("moving cells", () => {
            const A = "<!--{ alf2 : text }-->\nA\n";
            const B = "<!--{ brv3 : text }-->\nB\n";
            const C = "<!--{ chl4 : text }-->\nC\n";
            const selected = (editor) => cells(editor).flatMap((c, i) => (c.selected ? [i] : []));

            it("moves the selected cell with Alt+ArrowDown/ArrowUp", async () => {
                const editor = await editorWith(A + B + C);
                expect(key(editor, { key: "ArrowDown", altKey: true }).defaultPrevented).to.be.true;
                await settle(editor);
                expect(anon(editor.value)).to.equal(anon(B + A + C));
                expect(selected(editor)).to.deep.equal([1]);
                expect(cells(editor)[1].output).to.equal("A\n");
                key(editor, { key: "ArrowUp", altKey: true });
                expect(anon(editor.value)).to.equal(anon(A + B + C));
                key(editor, { key: "ArrowUp", altKey: true });
                expect(anon(editor.value)).to.equal(anon(A + B + C));
            });

            it("moves several selected cells together", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "ArrowDown", altKey: true });
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(C + A + B));
                expect(selected(editor)).to.deep.equal([1, 2]);
            });

            it("moves the last cell down onto the empty lines and back", async () => {
                const editor = await editorWith(A + B);
                key(editor, { key: "ArrowDown" });
                key(editor, { key: "ArrowDown", altKey: true });
                key(editor, { key: "ArrowDown", altKey: true });
                expect(anon(editor.value)).to.equal(anon(A + "<!--{ mdn3 : rich }-->\n<!--{ mdn3 : rich }-->\n" + B));
                key(editor, { key: "ArrowUp", altKey: true });
                key(editor, { key: "ArrowUp", altKey: true });
                expect(anon(editor.value)).to.equal(anon(A + B));
            });

            it("only moves the selection below the document and stops at the last line", async () => {
                const editor = await editorWith(A);
                editor.rows = 3;
                await editor.updateComplete;
                key(editor, { key: "ArrowDown" });
                key(editor, { key: "ArrowDown", altKey: true });
                key(editor, { key: "ArrowDown", altKey: true });
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(A));
                expect(selected(editor)).to.deep.equal([2]);
            });

            it("undoes a move", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", altKey: true });
                key(editor, { key: "z", ctrlKey: true });
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(A + B + C));
                expect(selected(editor)).to.deep.equal([0]);
            });
        });

        it("leaves the clipboard to the cell while editing", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "Enter" });
            await editor.updateComplete;
            expect(clipboard(editor, "copy").defaultPrevented).to.be.false;
            expect(clipboard(editor, "paste", "x").defaultPrevented).to.be.false;
        });

        it("leaves text selected in the output to the browser", async () => {
            const editor = await editorWith(SOURCE);
            const view = cells(editor)[0].shadowRoot.querySelector(".view");
            document.getSelection().selectAllChildren(view);
            const event = clipboard(editor, "copy");
            document.getSelection().removeAllRanges();
            expect(event.defaultPrevented).to.be.false;
        });
    });

    describe("margins", () => {
        const NOTES = `<!--{ mdn3 : markdown }-->
First line
<!--{ mdn3 : markdown }-->
Second line <!--[ On line 2 ]-->
<!--[ Also on line 2 ]-->
<!--{ txt2 : text }-->
Third line
`;
        // The comment count shown in the right margin of each of the first lines
        const counts = (editor) =>
            [...editor.shadowRoot.querySelectorAll(".margin.right")]
                .slice(0, 3)
                .map((margin) => margin.querySelector(".comment-count")?.textContent.trim() ?? "");
        const countButton = (editor, index) =>
            editor.shadowRoot.querySelectorAll(".margin.right")[index].querySelector(".comment-count");

        it("rules a left and a right margin on every line", async () => {
            const editor = await editorWith(SOURCE);
            const lines = editor.rows;
            expect(editor.shadowRoot.querySelectorAll(".margin.left")).to.have.length(lines);
            expect(editor.shadowRoot.querySelectorAll(".margin.right")).to.have.length(lines);
        });

        it("shows the number of comments in each cell's source", async () => {
            const editor = await editorWith(NOTES);
            expect(counts(editor)).to.deep.equal(["", "2", ""]);
        });

        it("keeps the comments with their cell when it moves", async () => {
            const editor = await editorWith(NOTES);
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true }));
            await editor.updateComplete;
            expect(counts(editor)).to.deep.equal(["2", "", ""]);
        });

        it("reports a line's comments on a click on their icon", async () => {
            const editor = await editorWith(NOTES);
            let detail = null;
            editor.addEventListener("comments-click", (e) => (detail = e.detail));
            countButton(editor, 1).click();
            await editor.updateComplete;
            expect(detail).to.deep.equal({ line: 2, comments: ["On line 2", "Also on line 2"] });
            expect(cells(editor)[1].selected).to.be.true;
        });

        it("reports the selected line's comments on Shift+F2", async () => {
            const editor = await editorWith(NOTES);
            const details = [];
            editor.addEventListener("comments-click", (e) => details.push(e.detail));
            const key = (options) =>
                editor.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, ...options }));
            key({ key: "ArrowDown" });
            key({ key: "F2", shiftKey: true });
            key({ key: "ArrowDown" });
            key({ key: "F2", shiftKey: true });
            await editor.updateComplete;
            expect(details).to.deep.equal([
                { line: 2, comments: ["On line 2", "Also on line 2"] },
                { line: 3, comments: [] },
            ]);
            expect(cells(editor).some((cell) => cell.mode === "edit")).to.be.false;
        });

        it("reports the selected line when another one is selected", async () => {
            const editor = await editorWith(NOTES);
            const lines = [];
            editor.addEventListener("selection-change", (e) => lines.push(e.detail.line));
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
            await editor.updateComplete;
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true }));
            await editor.updateComplete;
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", shiftKey: true }));
            await editor.updateComplete;
            expect(lines).to.deep.equal([2, 3]);
        });

        it("numbers every line in the left margin, also the empty ones", async () => {
            const editor = await editorWith(SOURCE);
            const numbers = [...editor.shadowRoot.querySelectorAll(".margin.left .line-number")].map((m) => m.textContent);
            expect(numbers).to.have.length(100);
            expect(numbers.slice(0, 3)).to.deep.equal(["1", "2", "3"]);
            expect(numbers.slice(8, 11)).to.deep.equal(["9", "10", "11"]);
            expect(numbers.at(-1)).to.equal("100");
        });

        it("selects a line on a click in its left margin", async () => {
            const editor = await editorWith(SOURCE);
            editor.shadowRoot.querySelectorAll(".margin.left")[1].click();
            await editor.updateComplete;
            expect(cells(editor)[1].selected).to.be.true;
            expect(cells(editor)[0].selected).to.be.false;
        });
    });

    describe("cell types", () => {
        const key = (editor, key, options = {}) =>
            editor.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true, ...options }));
        const typeButton = (editor, index) => editor.shadowRoot.querySelectorAll(".type-button")[index];
        const menu = (editor) => editor.shadowRoot.querySelector(".type-menu");
        const items = (editor) => [...menu(editor).querySelectorAll("li")];

        it("shows the type of each cell in its left margin", async () => {
            const editor = await editorWith(SOURCE + "<!--{ crt4 : chart }-->\ndata\n");
            const titles = [0, 1, 2, 3].map((i) => typeButton(editor, i).title);
            expect(titles).to.deep.equal(["Text", "Markdown", "chart (unknown type)", "Rich text"]);
        });

        it("opens the menu of types on a click on the icon, with the type checked", async () => {
            const editor = await editorWith(SOURCE);
            typeButton(editor, 1).click();
            await editor.updateComplete;
            expect(cells(editor)[1].selected).to.be.true;
            const labels = items(editor).map((li) => li.querySelector(".label").textContent);
            expect(labels).to.deep.equal(["Rich text", "Text", "Markdown", "Table", "Formula", "Data table"]);
            const checked = items(editor).map((li) => li.getAttribute("aria-checked"));
            expect(checked).to.deep.equal(["false", "false", "true", "false", "false", "false"]);

            typeButton(editor, 1).click();
            await editor.updateComplete;
            expect(menu(editor)).to.be.null;
        });

        it("changes the type on a click in the menu, keeping the source", async () => {
            const editor = await editorWith(SOURCE);
            typeButton(editor, 0).click();
            await editor.updateComplete;
            items(editor)[2].click();
            await editor.rendered;
            await editor.updateComplete;
            expect(menu(editor)).to.be.null;
            expect(cells(editor)[0].localName).to.equal("texl-cell-markdown");
            expect(anon(editor.value)).to.equal(anon(SOURCE.replace("<!--{ txt2 : text }-->", "<!--{ mdn3 : markdown }-->")));
        });

        it("opens the menu with Mod+/ and picks a type with the arrows and Enter", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "/", { ctrlKey: true });
            await editor.updateComplete;
            expect(menu(editor)).to.exist;
            key(editor, "ArrowDown");
            await editor.updateComplete;
            expect(items(editor)[2].classList.contains("active")).to.be.true;
            // Table and Formula do not accept the cell: the arrows skip them
            key(editor, "ArrowDown");
            await editor.updateComplete;
            expect(items(editor)[0].classList.contains("active")).to.be.true;
            key(editor, "ArrowUp");
            key(editor, "Enter");
            await editor.rendered;
            await editor.updateComplete;
            expect(menu(editor)).to.be.null;
            expect(cells(editor)[0].localName).to.equal("texl-cell-markdown");
        });

        it("picks a type by its first letter, and closes with Escape without a change", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "/", { metaKey: true });
            key(editor, "m");
            await editor.updateComplete;
            expect(items(editor)[2].classList.contains("active")).to.be.true;
            key(editor, "Delete");
            key(editor, "Escape");
            await editor.updateComplete;
            expect(menu(editor)).to.be.null;
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("closes the menu on a press outside it", async () => {
            const editor = await editorWith(SOURCE);
            typeButton(editor, 0).click();
            await editor.updateComplete;
            document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
            await editor.updateComplete;
            expect(menu(editor)).to.be.null;
        });

        it("changes all the selected cells, and undoes the change", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "ArrowDown", { shiftKey: true });
            key(editor, "/", { ctrlKey: true });
            key(editor, "Home");
            key(editor, "Enter");
            await editor.rendered;
            await editor.updateComplete;
            expect(cells(editor).slice(0, 2).map((c) => c.localName)).to.deep.equal(["texl-cell-rich", "texl-cell-rich"]);
            key(editor, "z", { ctrlKey: true });
            await editor.updateComplete;
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("gives the first cell a marker when its type changes", async () => {
            const editor = await editorWith("Hello\n");
            key(editor, "/", { ctrlKey: true });
            key(editor, "End");
            key(editor, "Enter");
            await editor.updateComplete;
            expect(anon(editor.value)).to.equal(anon("<!--{ mdn3 : markdown }-->\nHello\n"));
        });

        it("greys out the types that do not accept the selected cells, with the reason", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "ArrowDown", { shiftKey: true });
            typeButton(editor, 1).click();
            await editor.updateComplete;
            // The text cell is neither a table nor a formula; the markdown one is a formula
            const disabled = items(editor).map((li) => li.getAttribute("aria-disabled"));
            expect(disabled).to.deep.equal(["false", "false", "false", "true", "true", "true"]);
            expect(items(editor)[3].title).to.equal("Needs a table");
            expect(items(editor)[4].querySelector(".reason").textContent).to.equal("Needs a single formula");
            items(editor)[4].click();
            await editor.updateComplete;
            expect(menu(editor)).to.exist;
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("changes an empty line to a formula with = and edits it", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "ArrowDown");
            key(editor, "ArrowDown");
            const event = new KeyboardEvent("keydown", { key: "=", cancelable: true });
            editor.dispatchEvent(event);
            await editor.rendered;
            await editor.updateComplete;
            expect(event.defaultPrevented).to.be.true;
            expect(cells(editor)[2].localName).to.equal("texl-cell-formula");
            expect(cells(editor)[2].mode).to.equal("edit");
            expect(anon(editor.value)).to.equal(anon(SOURCE + "<!--{ frm4 : formula }-->\n"));
        });

        it("edits a line that has the key's type already, as Enter does", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "t");
            await editor.updateComplete;
            expect(cells(editor)[0].mode).to.equal("edit");
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("changes a line to the key's type if it accepts the source: m, t, = and T", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "m");
            await editor.rendered;
            await editor.updateComplete;
            expect(cells(editor)[0].localName).to.equal("texl-cell-markdown");
            expect(cells(editor)[0].mode).to.equal("edit");
            key(editor, "Escape");
            key(editor, "ArrowDown");
            key(editor, "=");
            await editor.rendered;
            await editor.updateComplete;
            expect(cells(editor)[1].localName).to.equal("texl-cell-formula");
            key(editor, "Escape");
            key(editor, "ArrowDown");
            key(editor, "T", { shiftKey: true });
            await editor.rendered;
            await editor.updateComplete;
            expect(cells(editor)[2].localName).to.equal("texl-cell-table");
            expect(cells(editor)[2].mode).to.equal("edit");
        });

        it("shows why a line cannot take the key's type, until the next key", async () => {
            const editor = await editorWith(SOURCE);
            const notice = () => editor.shadowRoot.querySelector(".notice");
            key(editor, "=");
            await editor.updateComplete;
            expect(notice().textContent).to.equal("Needs a single formula");
            expect(cells(editor)[0].mode).to.equal("render");
            expect(anon(editor.value)).to.equal(anon(SOURCE));
            key(editor, "ArrowDown");
            await editor.updateComplete;
            expect(notice()).to.be.null;
            key(editor, "T", { shiftKey: true });
            await editor.updateComplete;
            expect(notice().textContent).to.equal("Needs a table");
        });

        it("acts on the last selected line alone, and ignores keys with Ctrl or Alt", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "ArrowDown", { shiftKey: true });
            key(editor, "=", { ctrlKey: true });
            key(editor, "=", { altKey: true });
            await editor.updateComplete;
            expect(cells(editor)[1].localName).to.equal("texl-cell-markdown");
            key(editor, "=");
            await editor.rendered;
            await editor.updateComplete;
            expect(cells(editor).slice(0, 2).map((c) => c.localName)).to.deep.equal(["texl-cell-text", "texl-cell-formula"]);
            expect(cells(editor)[0].selected).to.be.false;
            expect(cells(editor)[1].mode).to.equal("edit");
        });

        it("shows each type's key in the menu", async () => {
            const editor = await editorWith(SOURCE);
            typeButton(editor, 0).click();
            await editor.updateComplete;
            expect(items(editor).map((li) => li.querySelector(".key")?.textContent)).to.deep.equal(["r", "t", "m", "T", "=", "d"]);
        });

        it("changes a cell that is one tag to a formula, and an empty one to a table", async () => {
            const editor = await editorWith(SOURCE);
            typeButton(editor, 1).click();
            await editor.updateComplete;
            items(editor)[4].click();
            typeButton(editor, 2).click();
            await editor.updateComplete;
            items(editor)[3].click();
            await editor.rendered;
            await editor.updateComplete;
            expect(cells(editor)[1].localName).to.equal("texl-cell-formula");
            // An empty table cell stays empty until it is edited
            expect(anon(editor.value)).to.equal(
                anon(SOURCE.replace("mdn3 : markdown", "frm4 : formula") + "<!--{ tbl5 : table }-->\n"),
            );
        });

        it("leaves an empty line below the document empty when its type changes", async () => {
            const editor = await editorWith(SOURCE);
            let changes = 0;
            editor.addEventListener("change", () => changes++);
            typeButton(editor, 3).click();
            await editor.updateComplete;
            items(editor)[0].click();
            await editor.updateComplete;
            expect(changes).to.equal(0);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });
    });

    describe("cell names", () => {
        const names = (editor) => [...editor.value.matchAll(/<!--\{ (\S+) : /g)].map((match) => match[1]);
        const key = (editor, init) => editor.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, ...init }));
        const paste = (editor, text) => {
            const clipboardData = new DataTransfer();
            clipboardData.setData("text/plain", text);
            editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData, cancelable: true }));
        };

        it("names the cells read without a name", async () => {
            const editor = await editorWith("<!--{ markdown }-->\nA\n<!--% text %-->\nB\n");
            const [first, second] = names(editor);
            expect(first).to.match(/^[a-z0-9]{4}$/);
            expect(second).to.match(/^[a-z0-9]{4}$/);
            expect(first).to.not.equal(second);
        });

        it("names new cells, unlike the others", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "Insert" });
            key(editor, { key: "Insert" });
            expect(new Set(names(editor)).size).to.equal(4);
        });

        it("gives new names to pasted copies, and keeps them on a cut and paste", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            key(editor, { key: "ArrowDown" });
            paste(editor, SOURCE);
            const [a, b, c, d] = names(editor);
            expect([a, b]).to.deep.equal(["txt2", "mdn3"]);
            expect(new Set([a, b, c, d]).size).to.equal(4);

            const moved = await editorWith(SOURCE);
            key(moved, { key: "ArrowDown" });
            key(moved, { key: "ArrowDown" });
            paste(moved, "<!--{ mdn3 : markdown }-->\nA\n");
            expect(new Set(names(moved)).size).to.equal(3);
            paste(moved, "<!--{ new5 : markdown }-->\nA\n<!--{ NEW5 : markdown }-->\nB\n");
            expect(names(moved)[2]).to.equal("new5");
            expect(new Set(names(moved).map((name) => name.toLowerCase())).size).to.equal(4);
        });

        it("keeps clashing names and reports them with name-conflict", async () => {
            const editor = await fixture(html`<texl-editor></texl-editor>`);
            const reported = [];
            editor.addEventListener("name-conflict", (e) => reported.push(e.detail.conflicts));
            const source = "<!--{ abc2 : text }-->\nA\n<!--{ xyz3 : text }-->\nB\n<!--{ ABC2 : text }-->\nC\n";
            editor.value = source;
            expect(editor.value).to.equal(source);
            expect(reported).to.deep.equal([[{ name: "abc2", lines: [1, 3] }]]);
            // The same clash is not reported again
            key(editor, { key: "Insert" });
            expect(reported).to.have.length(1);
            editor.value = source;
            expect(reported).to.have.length(2);
        });

        it("reports nothing for a document with unique names", async () => {
            const editor = await fixture(html`<texl-editor></texl-editor>`);
            let reported = false;
            editor.addEventListener("name-conflict", () => (reported = true));
            editor.value = SOURCE;
            expect(reported).to.be.false;
        });
    });

    describe("a click elsewhere while editing", () => {
        const TWO = "<!--{ abc1 : text }-->\nA\n<!--{ abc2 : text }-->\nB\n";

        async function editFirst(editor, text) {
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
            await editor.updateComplete;
            const cell = cells(editor)[0];
            await cell.updateComplete;
            const view = EditorView.findFromDOM(cell.shadowRoot.querySelector(".cm-editor"));
            view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
            return cell;
        }

        const settled = async (editor) => {
            await editor.rendered;
            await editor.updateComplete;
        };

        it("commits the cell and selects the line clicked", async () => {
            const editor = await editorWith(TWO);
            await editFirst(editor, "x");
            cells(editor)[1].click();
            await settled(editor);
            expect(editor.editing).to.be.false;
            expect(editor.value).to.equal(TWO.replace("A\n", "Ax\n"));
            expect(cells(editor)[1].selected).to.be.true;
            expect(cells(editor)[0].selected).to.be.false;
        });

        it("commits on a click in a margin too", async () => {
            const editor = await editorWith(TWO);
            await editFirst(editor, "x");
            editor.shadowRoot.querySelectorAll(".margin.left")[1].click();
            await settled(editor);
            expect(editor.editing).to.be.false;
            expect(editor.value).to.include("Ax\n");
            expect(cells(editor)[1].selected).to.be.true;
        });

        it("does not commit on a click in the cell itself", async () => {
            const editor = await editorWith(TWO);
            const cell = await editFirst(editor, "x");
            cell.shadowRoot.querySelector(".cm-content").click();
            await settled(editor);
            expect(editor.editing).to.be.true;
            expect(editor.value).to.equal(TWO);
        });

        it("does not commit when a selection is dragged out of the cell", async () => {
            const editor = await editorWith(TWO);
            const cell = await editFirst(editor, "x");
            cell.shadowRoot.querySelector(".cm-content").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
            // The browser sends the click to what holds both ends: the sheet
            editor.shadowRoot.querySelector(".sheet").click();
            await settled(editor);
            expect(editor.editing).to.be.true;
        });

        it("stays in edit mode if the cell refuses, and the click does nothing", async () => {
            const editor = await editorWith("<!--{ abc1 : formula }-->\n<% a %>\n<!--{ abc2 : text }-->\nB\n");
            const cell = await editFirst(editor, " %> b");
            cells(editor)[1].click();
            await settled(editor);
            await cell.updateComplete;
            expect(editor.editing).to.be.true;
            expect(cell.mode).to.equal("edit");
            expect(cell.shadowRoot.querySelector(".input-error")).to.exist;
            expect(cells(editor)[0].selected).to.be.true;
            expect(cells(editor)[1].selected).to.be.false;
        });

        it("a double click on a line does not take over while another refuses", async () => {
            const editor = await editorWith("<!--{ abc1 : formula }-->\n<% a %>\n<!--{ abc2 : text }-->\nB\n");
            const cell = await editFirst(editor, " %> b");
            cells(editor)[1].dispatchEvent(new MouseEvent("dblclick", { bubbles: true, composed: true }));
            await settled(editor);
            expect(cell.mode).to.equal("edit");
            expect(cells(editor)[1].mode).to.equal("render");
        });
    });

    describe("commands", () => {
        const settle = async (editor) => {
            await editor.rendered;
            await editor.updateComplete;
        };
        const FORMULA = "<!--{ mdn3 : markdown }-->\n<% q * L ^ 2 / 8 %>\n";

        it("lists its commands, with one per cell type", async () => {
            const editor = await editorWith(SOURCE);
            expect(editor.commands).to.include.members([
                "edit",
                "commit",
                "discard",
                "insert-below",
                "insert-above",
                "move-up",
                "move-down",
                "delete",
                "copy",
                "cut",
                "paste",
                "undo",
                "redo",
                "cell-type",
                "comments",
                "make-rich",
                "make-text",
                "make-markdown",
                "make-table",
                "make-formula",
            ]);
        });

        it("rejects an unknown command", async () => {
            const editor = await editorWith(SOURCE);
            let error;
            await editor.runCommand("fly").catch((e) => (error = e));
            expect(error?.message).to.contain('"fly"');
        });

        it("runs a command as its key does", async () => {
            const editor = await editorWith(SOURCE);
            let changes = 0;
            editor.addEventListener("change", () => changes++);
            expect(await editor.runCommand("insert-below")).to.be.true;
            await settle(editor);
            expect(anon(editor.value)).to.equal(
                anon(SOURCE.replace("<!--{ mdn3 : markdown", "<!--{ mdn3 : rich }-->\n<!--{ mdn3 : markdown")),
            );
            expect(cells(editor)[1].selected).to.be.true;
            expect(changes).to.equal(1);

            expect(await editor.runCommand("delete")).to.be.true;
            expect(await editor.runCommand("move-up")).to.be.true;
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(FORMULA + SOURCE.slice(0, -FORMULA.length)));
        });

        it("reports a command that does not apply", async () => {
            const editor = await editorWith(SOURCE);
            expect(await editor.runCommand("move-up")).to.be.false;
            expect(await editor.runCommand("undo")).to.be.false;
            expect(await editor.runCommand("redo")).to.be.false;
            expect(await editor.runCommand("commit")).to.be.false;
            expect(await editor.runCommand("discard")).to.be.false;
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("undoes and redoes", async () => {
            const editor = await editorWith(SOURCE);
            await editor.runCommand("delete");
            expect(await editor.runCommand("undo")).to.be.true;
            expect(anon(editor.value)).to.equal(anon(SOURCE));
            expect(await editor.runCommand("redo")).to.be.true;
            expect(anon(editor.value)).to.equal(anon(FORMULA));
        });

        it("edits, then only commits or discards", async () => {
            const editor = await editorWith(SOURCE);
            expect(await editor.runCommand("edit")).to.be.true;
            await editor.updateComplete;
            expect(cells(editor)[0].mode).to.equal("edit");
            expect(await editor.runCommand("delete")).to.be.false;
            expect(await editor.runCommand("edit")).to.be.false;
            expect(await editor.runCommand("discard")).to.be.true;
            await editor.updateComplete;
            expect(cells(editor)[0].mode).to.equal("render");

            await editor.runCommand("edit");
            await editor.updateComplete;
            expect(await editor.runCommand("commit")).to.be.true;
            await editor.updateComplete;
            expect(cells(editor)[0].mode).to.equal("render");
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("does not commit an edit the cell refuses", async () => {
            const editor = await editorWith("<!--{ frm1 : formula }-->\n<% 1 %>\n");
            await editor.runCommand("edit");
            await editor.updateComplete;
            const cell = cells(editor)[0];
            await cell.updateComplete;
            const view = EditorView.findFromDOM(cell.shadowRoot.querySelector(".cm-editor"));
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "1 %> 2" } });
            expect(await editor.runCommand("commit")).to.be.false;
            await editor.updateComplete;
            expect(cell.mode).to.equal("edit");
            expect(editor.editing).to.be.true;
            expect(await editor.runCommand("discard")).to.be.true;
            expect(editor.editing).to.be.false;
        });

        describe("tags and cells", () => {
            const m = (name, type = "text") => `<!--{ ${name} : ${type} }-->\n`;

            /** Edits line `index`, sets its source and tries to commit. */
            async function commit(editor, index, source) {
                editor.select(index + 1);
                await editor.runCommand("edit");
                await editor.updateComplete;
                const cell = cells(editor)[index];
                await cell.updateComplete;
                const view = EditorView.findFromDOM(cell.shadowRoot.querySelector(".cm-editor"));
                view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
                const done = await editor.runCommand("commit");
                await editor.updateComplete;
                await cell.updateComplete;
                return { done, cell };
            }

            const LATER = `${m("abc2")}one\n${m("xyz3")}two\n${m("pim4")}<% 1 %>\n`;

            it("refuses a <% left open above a later %>, and says why", async () => {
                const editor = await editorWith(LATER);
                const { done, cell } = await commit(editor, 0, "one <% L\n");
                expect(done).to.be.false;
                expect(cell.mode).to.equal("edit");
                expect(cell.shadowRoot.querySelector(".input-error").textContent).to.contain("line 1").and.to.contain("line 2");
                await editor.runCommand("discard");
                expect(editor.value).to.equal(LATER);
            });

            it("refuses a %> that would close a <% in a cell above", async () => {
                const source = `${m("abc2")}a <% b\n${m("xyz3")}two\n`;
                const editor = await editorWith(source);
                const { done, cell } = await commit(editor, 1, "<% 1 %>\n");
                expect(done).to.be.false;
                expect(cell.shadowRoot.querySelector(".input-error").textContent).to.contain("line 1").and.to.contain("line 2");
                await editor.runCommand("discard");
                expect(editor.value).to.equal(source);
            });

            it("accepts a lone <% with no %> below it", async () => {
                const editor = await editorWith(`${m("abc2")}one\n${m("xyz3")}two\n`);
                const { done } = await commit(editor, 0, "write <% to open\n");
                expect(done).to.be.true;
                expect(editor.value).to.contain("write <% to open");
            });

            it("keeps a marker line in a tag inside the cell", async () => {
                const editor = await editorWith(`${m("abc2")}one\n`);
                const source = `<% "a\n${m("xyz3")}b" %>`;
                expect((await commit(editor, 0, source)).done).to.be.true;
                expect(editor.value).to.equal(`${m("abc2")}${source}\n`);
                expect(parseDocument(editor.value)).to.have.length(1);
            });

            it("splits a merged cell when its tag is closed, with one undo", async () => {
                const merged = `${m("abc2")}Span: <% L\n${m("xyz3", "table")}\n${m("pim4")}Load: <% 5 %> kN\n${m("dan5")}End\n`;
                const editor = await editorWith(merged);
                expect(parseDocument(editor.value)).to.have.length(2);
                const body = parseDocument(merged)[0].texl.replace("<% L\n", "<% 6 %>\n");
                expect((await commit(editor, 0, body)).done).to.be.true;
                const parsed = parseDocument(editor.value);
                expect(parsed.map((cell) => cell.name)).to.deep.equal(["abc2", "xyz3", "pim4", "dan5"]);
                expect(parsed[1].type).to.equal("table");
                await editor.runCommand("undo");
                expect(editor.value).to.equal(merged);
            });

            it("splits a cell when a marker line is typed in it", async () => {
                const editor = await editorWith(`${m("abc2")}one\n`);
                expect((await commit(editor, 0, `one\n${m("xyz3", "markdown")}two\n`)).done).to.be.true;
                expect(parseDocument(editor.value).map((cell) => cell.type)).to.deep.equal(["text", "markdown"]);
            });

            it("renames a cell split off with a name in use", async () => {
                const editor = await editorWith(`${m("abc2")}one\n${m("xyz3")}two\n`);
                expect((await commit(editor, 0, `one\n${m("xyz3")}new\n`)).done).to.be.true;
                const names = parseDocument(editor.value).map((cell) => cell.name);
                expect(names).to.have.length(3);
                expect(new Set(names).size).to.equal(3);
                expect(names[0]).to.equal("abc2");
                expect(names[2]).to.equal("xyz3");
            });

            it("refuses to move a <% above a %>, and says why", async () => {
                const source = `${m("abc2")}<% 1 %>\n${m("xyz3")}a <% b\n`;
                const editor = await editorWith(source);
                editor.select(2);
                expect(await editor.runCommand("move-up")).to.be.false;
                expect(editor.value).to.equal(source);
                await editor.updateComplete;
                expect(editor.shadowRoot.querySelector(".notice").textContent).to.contain("line 1");
            });

            it("keeps a document unchanged when opened and read back", async () => {
                const source = `${m("abc2")}a <% b\n${m("xyz3")}c %> d\n${m("pim4")}<% 1 %>\n`;
                expect((await editorWith(source)).value).to.equal(source);
            });
        });

        it("changes the type and edits with make-<type>, or shows why not", async () => {
            const editor = await editorWith(SOURCE);
            editor.select(2);
            expect(await editor.runCommand("make-formula")).to.be.true;
            await settle(editor);
            expect(cells(editor)[1].localName).to.equal("texl-cell-formula");
            expect(cells(editor)[1].mode).to.equal("edit");
            await editor.runCommand("discard");

            editor.select(1);
            expect(await editor.runCommand("make-table")).to.be.false;
            await editor.updateComplete;
            expect(editor.shadowRoot.querySelector(".notice").textContent).to.equal("Needs a table");
            expect(cells(editor)[0].localName).to.equal("texl-cell-text");
        });

        it("opens the menu of types, and closes it on another command", async () => {
            const editor = await editorWith(SOURCE);
            await editor.runCommand("cell-type");
            await editor.updateComplete;
            expect(editor.shadowRoot.querySelector(".type-menu")).to.exist;
            await editor.runCommand("insert-below");
            await editor.updateComplete;
            expect(editor.shadowRoot.querySelector(".type-menu")).to.be.null;
        });

        it("reports the selected line's comments", async () => {
            const editor = await editorWith("<!--{ txt2 : text }-->\nA <!--[ check ]-->\n");
            let detail;
            editor.addEventListener("comments-click", (e) => (detail = e.detail));
            await editor.runCommand("comments");
            expect(detail).to.deep.equal({ line: 1, comments: ["check"] });
        });

        describe("with the system clipboard", () => {
            let text = "";
            let refuse = false;
            before(() => {
                const clipboard = {
                    writeText: async (value) => {
                        if (refuse) throw new DOMException("Denied", "NotAllowedError");
                        text = value;
                    },
                    readText: async () => {
                        if (refuse) throw new DOMException("Denied", "NotAllowedError");
                        return text;
                    },
                };
                Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
            });
            after(() => delete navigator.clipboard);
            beforeEach(() => {
                text = "";
                refuse = false;
            });

            it("copies, cuts and pastes cells", async () => {
                const editor = await editorWith(SOURCE);
                editor.select(2);
                expect(await editor.runCommand("copy")).to.be.true;
                expect(anon(text)).to.equal(anon(FORMULA));
                expect(await editor.runCommand("cut")).to.be.true;
                expect(anon(editor.value)).to.equal(anon(SOURCE.slice(0, -FORMULA.length)));
                editor.select(1);
                expect(await editor.runCommand("paste")).to.be.true;
                await settle(editor);
                expect(anon(editor.value)).to.equal(anon(FORMULA));
                await cells(editor)[0].updateComplete;
                expect(cells(editor)[0].shadowRoot.querySelector(".view").textContent.trim()).to.equal("[[Undefined]]");
            });

            it("reports a refused clipboard and changes nothing", async () => {
                const editor = await editorWith(SOURCE);
                refuse = true;
                expect(await editor.runCommand("copy")).to.be.false;
                expect(await editor.runCommand("cut")).to.be.false;
                expect(await editor.runCommand("paste")).to.be.false;
                expect(anon(editor.value)).to.equal(anon(SOURCE));
            });
        });
    });

    describe("select", () => {
        it("selects a line, counted from 1, and reports it", async () => {
            const editor = await editorWith(SOURCE);
            let line;
            editor.addEventListener("selection-change", (e) => (line = e.detail.line));
            editor.select(2);
            await editor.updateComplete;
            expect(line).to.equal(2);
            expect(cells(editor).map((c) => c.selected).slice(0, 3)).to.deep.equal([false, true, false]);
        });

        it("extends the selection from the anchor", async () => {
            const editor = await editorWith(SOURCE);
            editor.select(3, true);
            await editor.updateComplete;
            expect(cells(editor).map((c) => c.selected).slice(0, 4)).to.deep.equal([true, true, true, false]);
            await editor.runCommand("delete");
            expect(editor.value).to.equal("");
        });

        it("keeps the line within the sheet", async () => {
            const editor = await editorWith(SOURCE);
            editor.select(1000);
            await editor.updateComplete;
            expect(cells(editor)[99].selected).to.be.true;
            editor.select(-5);
            await editor.updateComplete;
            expect(cells(editor)[0].selected).to.be.true;
        });

        it("closes the menu of types", async () => {
            const editor = await editorWith(SOURCE);
            await editor.runCommand("cell-type");
            await editor.updateComplete;
            editor.select(2);
            await editor.updateComplete;
            expect(editor.shadowRoot.querySelector(".type-menu")).to.be.null;
        });
    });

    it("shows unknown cell types as text and keeps their type", async () => {
        const source = "<!--{ crt4 : chart }-->\nsome data\n";
        const editor = await editorWith(source);
        expect(cells(editor)[0].localName).to.equal("texl-cell-text");
        expect(anon(editor.value)).to.equal(anon(source));
    });
});

describe("texl-editor rendering", () => {
    // Documents served by a stand-in for `fetch`, by URL
    const served = new Map();
    const realFetch = window.fetch;
    before(() => {
        window.fetch = async (url) => {
            const key = String(url);
            return served.has(key) ? new Response(served.get(key)) : realFetch(url);
        };
    });
    after(() => (window.fetch = realFetch));
    afterEach(() => served.clear());

    const IMPORTER = `<!--{ abc2 : text }-->
<% texl.import("lib.texl") ~> (lib -> bind "lib" lib.data) %>Width: <% lib.w %>
<!--{ xyz3 : text }-->
Twice: <% 2 * lib.w %>
`;

    async function editorAt(url, source) {
        const editor = await fixture(html`<texl-editor url=${url}></texl-editor>`);
        editor.value = source;
        await editor.rendered;
        await editor.updateComplete;
        return editor;
    }

    it("resolves imports against the document URL", async () => {
        served.set("https://example.com/docs/lib.texl", "<% w = 3 %>");
        const editor = await editorAt("https://example.com/docs/main.texl", IMPORTER);
        expect(cells(editor).slice(0, 2).map((cell) => cell.output)).to.deep.equal(["Width: 3\n", "Twice: 6\n"]);
    });

    it("shows a changed imported document on the next rendering", async () => {
        served.set("https://example.com/docs/lib.texl", "<% w = 3 %>");
        const editor = await editorAt("https://example.com/docs/main.texl", IMPORTER);
        served.set("https://example.com/docs/lib.texl", "<% w = 5 %>");
        editor.value = editor.value;
        await editor.rendered;
        await editor.updateComplete;
        expect(cells(editor)[1].output).to.equal("Twice: 10\n");
    });

    it("renders again when the URL changes", async () => {
        served.set("https://example.com/a/lib.texl", "<% w = 3 %>");
        served.set("https://example.com/b/lib.texl", "<% w = 4 %>");
        const editor = await editorAt("https://example.com/a/main.texl", IMPORTER);
        editor.url = "https://example.com/b/main.texl";
        await editor.updateComplete;
        await editor.rendered;
        await editor.updateComplete;
        expect(cells(editor)[1].output).to.equal("Twice: 8\n");
    });

    it("keeps the rendering of an imported editor document in one cell", async () => {
        served.set("https://example.com/docs/lib.texl", "<!--{ lib5 : text }-->\nlib\n<!--{ xyz3 : text }-->\nend\n");
        const source = `<!--{ abc2 : text }-->
<% texl.import("lib.texl") ~> (lib -> lib.text) %>
<!--{ pim4 : text }-->
after
`;
        const editor = await editorAt("https://example.com/docs/main.texl", source);
        expect(cells(editor)[0].output).to.contain("lib5").and.contain("end");
        expect(cells(editor)[1].output).to.equal("after\n");
    });

    it("shows no output if the URL cannot be resolved", async () => {
        const editor = await editorAt("http://[bad/main.texl", "<!--{ abc2 : text }-->\nA\n");
        expect(cells(editor)[0].output).to.equal("");
        expect(anon(editor.value)).to.equal("<!--{ text }-->\nA\n");
    });
});
