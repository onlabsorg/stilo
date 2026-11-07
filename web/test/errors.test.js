import { expect, fixture, html, oneEvent } from "@open-wc/testing";
import "../src/editor/index.js";
import { excerptAt, sanitizeOutput } from "../src/editor/errors.js";
import { lineAtOffset, parseDocument, serializeDocument, textLineAtOffset } from "../src/editor/document.js";

const FETCH = window.fetch;

/** Serves `files` to the engine's imports, by the end of their URL. */
function serve(files) {
    window.fetch = async (url, ...rest) => {
        const name = Object.keys(files).find((file) => String(url.url ?? url).endsWith(file));
        return name ? new Response(files[name]) : String(url.url ?? url).endsWith(".texl") ? new Response("", { status: 404 }) : FETCH(url, ...rest);
    };
}

async function editorWith(source) {
    const editor = await fixture(html`<texl-editor url="/docs/doc.texl"></texl-editor>`);
    editor.value = source;
    await editor.rendered;
    await editor.updateComplete;
    for (const cell of cells(editor)) await cell.updateComplete;
    return editor;
}

const cells = (editor) => [...editor.shadowRoot.querySelectorAll("[data-index]")];
const values = (cell) => [...cell.shadowRoot.querySelectorAll(".undefined-value")];
const counts = (editor) =>
    [...editor.shadowRoot.querySelectorAll(".error-count")].map((button) => button.textContent.trim());
const marker = (name, type = "text") => `<!--{ ${name} : ${type} }-->\n`;

describe("errors", () => {
    afterEach(() => {
        window.fetch = FETCH;
    });

    describe("counting", () => {
        it("counts returned values and tuple items: 1 + 2 = 3", async () => {
            const editor = await editorWith(marker("aaaa") + '<% 1 + "z" %> <% (1, 1 + "a", "abc", 1 + "b", {}) %>\n');
            expect(counts(editor)).to.deep.equal(["3"]);
            expect(editor.errors.map((error) => error.count)).to.deep.equal([1, 1, 1]);
            expect(values(cells(editor)[0])).to.have.length(3);
        });

        for (const [what, tag] of [
            ["an assignment", '<% y = 1 + "z" %>'],
            ["a value inside a list", '<% [1 + "c"] %>'],
            ["a value inside a namespace", '<% {a: 1 + "d"} %>'],
            ["an unknown name", "<% zzz %>"],
            ["a missing member", "<% {a: 1}.b %>"],
            ["a literal text", '<% "[[Undefined]]" %>'],
        ]) {
            it(`does not count ${what}`, async () => {
                const editor = await editorWith(marker("aaaa") + tag + "\n");
                expect(editor.errors).to.deep.equal([]);
                expect(counts(editor)).to.deep.equal([]);
                expect(values(cells(editor)[0])).to.have.length(0);
            });
        }

        it("counts a value from undef.from like any other", async () => {
            const editor = await editorWith(marker("aaaa") + '<% undef.from "x" %>\n');
            expect(counts(editor)).to.deep.equal(["1"]);
        });

        it("counts per line", async () => {
            const editor = await editorWith(
                `${marker("aaaa")}<% 1 + "a" %>\n${marker("bbbb")}fine\n${marker("cccc")}<% 2 + "b" %><% 3 + "c" %>\n`,
            );
            expect(cells(editor).map((cell) => values(cell).length).slice(0, 3)).to.deep.equal([1, 0, 2]);
            expect(counts(editor)).to.deep.equal(["1", "2"]);
        });
    });

    describe("the list of errors", () => {
        it("makes one error of a value returned by several lines", async () => {
            const editor = await editorWith(
                `${marker("aaaa")}<% y = 1 + "a" %>\n${marker("bbbb")}<% y %>\n${marker("cccc")}<% y %>\n`,
            );
            expect(editor.errors).to.have.length(1);
            const [error] = editor.errors;
            expect(error.lines).to.deep.equal([2, 3]);
            expect(error.count).to.equal(2);
            expect(error.location.line).to.equal(1);
            expect(error.location.local).to.be.true;
            expect(error.location.source[error.location.pos]).to.equal("+");
            expect(counts(editor)).to.deep.equal(["1", "1"]);
        });

        it("keeps values with no position apart, located at their tags", async () => {
            const editor = await editorWith(`${marker("aaaa")}<% undef.from "x" %>\n${marker("bbbb")}A <% undef.from "x" %>\n`);
            expect(editor.errors).to.have.length(2);
            const { source, pos, line } = editor.errors[1].location;
            expect(line).to.equal(2);
            expect(source.slice(pos, pos + 2)).to.equal("<%");
        });

        it("walks the chain of causes", async () => {
            const editor = await editorWith(marker("aaaa") + '<% (1 + "a") * 2 %>\n');
            const [error] = editor.errors;
            expect(error.description).to.contain("cannot multiply");
            expect(error.rootCause).to.contain("cannot add");
            expect(error.causes.map((cause) => cause.description)).to.deep.equal([error.rootCause]);
            expect(error.causes[0].location.line).to.equal(1);
        });

        it("locates an error in an imported document, with the line of its cell", async () => {
            serve({ "lib.texl": `Título µ\n${marker("aaaa")}text\n${marker("bbbb")}<% half = x -> x / "two" %>\n` });
            const editor = await editorWith(
                `${marker("aaaa")}<% texl.import("lib.texl") ~> (l -> bind "lib" l.data) %>\n${marker("bbbb")}<% lib.half 3 %>\n`,
            );
            const [error] = editor.errors;
            expect(error.lines).to.deep.equal([2]);
            expect(error.location.local).to.be.false;
            expect(error.location.uri).to.match(/lib\.texl$/);
            expect(error.location.line).to.equal(3);
            expect(error.location.source[error.location.pos]).to.equal("/");
        });

        it("gives the line of text within a cell of several lines", async () => {
            const editor = await editorWith(
                `${marker("aaaa")}one\ntwo <% 1 + "a" %>\nthree\n${marker("bbbb")}<% 2 + "b" %>\n`,
            );
            expect(editor.errors.map(({ location }) => [location.line, location.textLine])).to.deep.equal([
                [1, 2],
                [2, null],
            ]);
        });

        it("gives the line of text of a value with no position, from its tag", async () => {
            const editor = await editorWith(`${marker("aaaa")}one\n<% undef.from "x" %>\n`);
            expect(editor.errors[0].location.textLine).to.equal(2);
        });

        it("reports a failed import, with the reason as its root cause", async () => {
            serve({});
            const editor = await editorWith(marker("aaaa") + '<% texl.import("nope.texl") ~> (d -> d.text) %>\n');
            expect(editor.errors[0].rootCause).to.contain("cannot load");
        });

        it("fires errors-change after every rendering", async () => {
            const editor = await editorWith(marker("aaaa") + '<% 1 + "a" %>\n');
            const event = oneEvent(editor, "errors-change");
            editor.value = marker("aaaa") + "fine\n";
            expect((await event).detail.errors).to.deep.equal([]);
            expect(editor.errors).to.deep.equal([]);
        });
    });

    describe("highlighting", () => {
        const shown = async (type, source) => {
            const editor = await editorWith(marker("aaaa", type) + source);
            return cells(editor)[0];
        };

        it("highlights in a text cell, with the root cause as hover text", async () => {
            const [value] = values(await shown("text", 'A <% (1 + "a") * 2 %> B\n'));
            expect(value.textContent).to.equal("[[Undefined]]");
            expect(value.title).to.contain("cannot add");
        });

        it("highlights in a formula cell", async () => {
            expect(values(await shown("formula", '<% 1 + "a" %>\n'))).to.have.length(1);
        });

        it("highlights in Markdown, a table and a code span", async () => {
            expect(values(await shown("markdown", 'Some **<% 1 + "a" %>** text\n'))).to.have.length(1);
            const table = await shown("table", '| A |\n|---|\n| <% 1 + "a" %> |\n');
            expect(values(table)[0].closest("td")).to.exist;
            const code = await shown("markdown", '`<% 1 + "a" %>`\n');
            expect(values(code)[0].closest("code")).to.exist;
        });

        it("counts positions in characters after non-ASCII text", async () => {
            const cell = await shown("text", 'è µ 😀 <% 1 + "a" %> σ\n');
            expect(cell.shadowRoot.querySelector(".view").textContent.trim()).to.equal("è µ 😀 [[Undefined]] σ");
        });

        it("keeps the tuple's other items, past a literal", async () => {
            const cell = await shown("text", '<% ("[[Undefined]]", 1 + "a", 2) %>\n');
            const view = cell.shadowRoot.querySelector(".view");
            expect(view.textContent.trim()).to.equal("[[Undefined]], [[Undefined]], 2");
            expect(values(cell)).to.have.length(1);
            expect(view.innerHTML.indexOf("undefined-value")).to.be.greaterThan(view.innerHTML.indexOf("[[Undefined]]"));
        });

        it("shows plain text in a link's address, and still counts it", async () => {
            const editor = await editorWith(marker("aaaa", "markdown") + '[link](<% 1 + "a" %>)\n');
            const cell = cells(editor)[0];
            const link = cell.shadowRoot.querySelector("a");
            expect(decodeURI(link.getAttribute("href"))).to.equal("[[Undefined]]");
            expect(values(cell)).to.have.length(0);
            expect(counts(editor)).to.deep.equal(["1"]);
        });

        it("shows plain text in an HTML attribute", async () => {
            const cell = await shown("text", '<span title="<% 1 + "a" %>">x</span>\n');
            expect(cell.shadowRoot.querySelector("span").title).to.equal("[[Undefined]]");
            expect(values(cell)).to.have.length(0);
        });

        it("keeps sanitising the output", () => {
            const clean = sanitizeOutput('0<img src=x onerror="alert(1)"><script>alert(2)</script>', ["why"]);
            expect(clean).to.not.contain("onerror");
            expect(clean).to.not.contain("<script");
            expect(clean).to.contain("undefined-value");
        });

        it("leaves output without marks as it was", () => {
            expect(sanitizeOutput("<b>a</b>")).to.equal("<b>a</b>");
        });
    });

    describe("output of a document that holds a later cell's marker", () => {
        const source = `${marker("aaaa")}<% texl.import("./lib.texl") ~> (lib -> lib.text) %> A\n${marker("bbbb")}B <% 1 + "a" %>\n`;
        const outputs = (editor) => cells(editor).slice(0, 2).map((cell) => cell.output);

        it("stays under the cell of the tag", async () => {
            serve({ "lib.texl": `${marker("bbbb")}LIB\n` });
            const [first, second] = outputs(await editorWith(source));
            expect(first).to.contain("LIB").and.to.contain(" A\n");
            expect(second).to.not.contain("LIB");
            expect(second).to.match(/^B /);
        });

        it("marks the errors of the cell they are in", async () => {
            serve({ "lib.texl": `${marker("bbbb")}LIB\n` });
            const editor = await editorWith(source);
            const [first, second] = outputs(editor);
            expect(first).to.not.match(/\uE000/);
            expect(second).to.match(/\uE0000\uE001/);
            expect(editor.errors[0].lines).to.deep.equal([2]);
        });

        it("marks an error in a tag that holds a marker line, in its cell", async () => {
            const editor = await editorWith(`${marker("aaaa")}a <% 1 +\n${marker("bbbb")} 2 %> b\n${marker("cccc")}<% 1 + "a" %>\n`);
            const [first, second] = cells(editor).slice(0, 2).map((cell) => cell.output);
            expect(first).to.match(/^a \uE0000\uE001 b\n$/);
            expect(second).to.match(/^\uE0001\uE001\n$/);
        });
    });

    describe("clicks", () => {
        const SOURCE = `${marker("aaaa")}fine\n${marker("bbbb")}<% 1 + "a" %> <% 2 + "b" %>\n`;

        it("reports the clicked value, and selects its line", async () => {
            const editor = await editorWith(SOURCE);
            const event = oneEvent(editor, "error-click");
            values(cells(editor)[1])[1].click();
            const { detail } = await event;
            expect(detail.line).to.equal(2);
            expect(detail.error.description).to.contain("number `2`");
            await editor.updateComplete;
            expect(cells(editor)[1].selected).to.be.true;
        });

        it("reports the line's first error from the margin", async () => {
            const editor = await editorWith(SOURCE);
            const event = oneEvent(editor, "error-click");
            editor.shadowRoot.querySelector(".error-count").click();
            const { detail } = await event;
            expect(detail.line).to.equal(2);
            expect(detail.error.description).to.contain("number `1`");
        });

        it("does not report a click elsewhere in the cell", async () => {
            const editor = await editorWith(SOURCE);
            let fired = false;
            editor.addEventListener("error-click", () => (fired = true));
            cells(editor)[1].click();
            expect(fired).to.be.false;
        });

        it("runs as a command, with no error on a line without one", async () => {
            const editor = await editorWith(SOURCE);
            const event = oneEvent(editor, "error-click");
            expect(await editor.runCommand("errors")).to.be.true;
            expect((await event).detail).to.deep.equal({ line: 1, error: null });
        });
    });

    describe("excerptAt", () => {
        it("splits the line around the position", () => {
            expect(excerptAt("one\ntwo three\nfour", 8)).to.deep.equal({ before: "two ", at: "t", after: "hree" });
            expect(excerptAt("abc", 0)).to.deep.equal({ before: "", at: "a", after: "bc" });
        });

        it("shows a space at the end of a line", () => {
            expect(excerptAt("abc\ndef", 3)).to.deep.equal({ before: "abc", at: " ", after: "" });
            expect(excerptAt("abc", 3)).to.deep.equal({ before: "abc", at: " ", after: "" });
        });

        it("cuts a long line around the position", () => {
            const { before, at, after } = excerptAt("x".repeat(300) + "!" + "y".repeat(300), 300);
            expect(at).to.equal("!");
            expect(before.length + 1 + after.length).to.equal(80);
        });
    });

    describe("textLineAtOffset", () => {
        const source = `first\nsecond\n${marker("aaaa")}alone\n${marker("bbbb")}a\nb\nc`;
        const parsed = parseDocument(source);

        it("counts within a cell, without its marker", () => {
            expect(textLineAtOffset(parsed, source.indexOf("first"))).to.equal(1);
            expect(textLineAtOffset(parsed, source.indexOf("second"))).to.equal(2);
            expect(textLineAtOffset(parsed, source.indexOf("a\nb"))).to.equal(1);
            expect(textLineAtOffset(parsed, source.lastIndexOf("c"))).to.equal(3);
        });

        it("is null for a cell of one line", () => {
            expect(textLineAtOffset(parsed, source.indexOf("alone"))).to.be.null;
        });
    });

    describe("lineAtOffset", () => {
        it("finds the cell holding a position, as serialised", () => {
            const source = `first\n${marker("aaaa")}second\n${marker("bbbb")}third`;
            const parsed = parseDocument(source);
            expect(serializeDocument(parsed)).to.equal(source);
            expect(lineAtOffset(parsed, source.indexOf("first"))).to.equal(1);
            expect(lineAtOffset(parsed, source.indexOf("second"))).to.equal(2);
            expect(lineAtOffset(parsed, source.indexOf("third"))).to.equal(3);
            expect(lineAtOffset(parsed, source.length + 5)).to.equal(3);
        });
    });
});
