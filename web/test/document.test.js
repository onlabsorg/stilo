import { expect } from "@open-wc/testing";
import {
    parseDocument,
    serializeDocument,
    splitRendering,
    outputSpans,
    tagSpans,
    cellsFromSource,
    spanningTag,
    parseMarker,
    formatMarker,
    cellComments,
    cellName,
    nameCells,
    nameConflicts,
} from "../src/editor/document.js";
import { createEngine } from "../src/editor/engine.js";

describe("parseMarker", () => {
    it("reads the name and the type", () => {
        expect(parseMarker(" dkl6 : table ")).to.deep.equal({ name: "dkl6", type: "table" });
    });

    it("reads a marker without name", () => {
        expect(parseMarker(" table ")).to.deep.equal({ type: "table" });
    });

    it("defaults the type to text", () => {
        expect(parseMarker(" dkl6 : ")).to.deep.equal({ name: "dkl6", type: "text" });
        expect(parseMarker("  ")).to.deep.equal({ type: "text" });
    });
});

describe("marker options", () => {
    it("reads hidden, and keeps other options", () => {
        expect(parseMarker(" dkl6 : formula | hidden ")).to.deep.equal({ name: "dkl6", type: "formula", hidden: true });
        expect(parseMarker(" dkl6 : table | wide | hidden ")).to.deep.equal({
            name: "dkl6",
            type: "table",
            hidden: true,
            options: ["wide"],
        });
    });

    it("writes them back", () => {
        expect(formatMarker({ name: "dkl6", type: "formula", hidden: true })).to.equal("<!--{ dkl6 : formula | hidden }-->");
        expect(formatMarker({ type: "table", options: ["wide"] })).to.equal("<!--{ table | wide }-->");
    });

    it("round-trips a document with a hidden cell", () => {
        const source = "<!--{ imp1 : formula | hidden }-->\n<% x = 1 %>\n<!--{ txt2 : text }-->\nx = <% x %>\n";
        const cells = parseDocument(source);
        expect(cells[0].hidden).to.be.true;
        expect(cells[1].hidden).to.be.undefined;
        expect(serializeDocument(cells)).to.equal(source);
    });
});

describe("formatMarker", () => {
    it("writes the name and the type", () => {
        expect(formatMarker({ name: "dkl6", type: "markdown" })).to.equal("<!--{ dkl6 : markdown }-->");
    });

    it("writes only the type of a cell without name", () => {
        expect(formatMarker({ type: "markdown" })).to.equal("<!--{ markdown }-->");
    });
});

describe("cellName", () => {
    it("is four lowercase letters and digits", () => {
        for (let i = 0; i < 100; i++) expect(cellName()).to.match(/^[a-z][a-z][a-z][2-9]$/);
    });
});

describe("nameCells", () => {
    it("names every cell with a marker, uniquely", () => {
        const cells = nameCells(Array.from({ length: 50 }, () => ({ type: "text", texl: "" })));
        const names = cells.map((cell) => cell.name);
        expect(new Set(names).size).to.equal(50);
    });

    it("keeps existing names, even when they clash", () => {
        const cells = [
            { name: "abc2", type: "text", texl: "" },
            { name: "ABC2", type: "text", texl: "" },
        ];
        expect(nameCells(cells)).to.equal(cells);
    });

    it("leaves the leading cell without marker unnamed", () => {
        const [first, second] = nameCells([
            { type: "text", marker: false, texl: "Intro\n" },
            { type: "text", texl: "" },
        ]);
        expect(first.name).to.be.undefined;
        expect(second.name).to.match(/^[a-z0-9]{4}$/);
    });
});

describe("nameConflicts", () => {
    it("lists the names of more than one cell, without case, with their lines", () => {
        const cells = [
            { name: "abc2", type: "text", texl: "" },
            { name: "xyz3", type: "text", texl: "" },
            { name: "ABC2", type: "text", texl: "" },
        ];
        expect(nameConflicts(cells)).to.deep.equal([{ name: "abc2", lines: [1, 3] }]);
    });

    it("finds none in a document with unique names", () => {
        expect(nameConflicts(nameCells([{ type: "text", texl: "" }, { type: "text", texl: "" }]))).to.deep.equal([]);
    });
});

describe("parseDocument", () => {
    it("opens a plain Texl file as one text cell", () => {
        expect(parseDocument("Hi <% name %>\n")).to.deep.equal([
            { type: "text", marker: false, texl: "Hi <% name %>\n" },
        ]);
    });

    it("splits the document at marker lines", () => {
        const cells = parseDocument("<!--{ abc2 : text }-->\n# Title\n<!--{ xyz3 : markdown }-->\n<% 1 + 2 %>\n");
        expect(cells).to.deep.equal([
            { name: "abc2", type: "text", texl: "# Title\n" },
            { name: "xyz3", type: "markdown", texl: "<% 1 + 2 %>\n" },
        ]);
    });

    it("keeps text before the first marker", () => {
        const cells = parseDocument("preamble\n<!--{ abc2 : text }-->\nbody\n");
        expect(cells.map((c) => c.texl)).to.deep.equal(["preamble\n", "body\n"]);
        expect(cells[0].marker).to.equal(false);
    });

    it("ignores other HTML comments", () => {
        const cells = parseDocument("<!-- note -->\n<!--[ comment ]-->\ntext\n");
        expect(cells).to.have.length(1);
    });

    it("reads older markers, without their name", () => {
        const cells = parseDocument("<!--% markdown %-->\nA\n<!--% loads | table %-->\nB\n");
        expect(cells).to.deep.equal([
            { type: "markdown", texl: "A\n" },
            { type: "table", texl: "B\n" },
        ]);
    });
});

describe("cellComments", () => {
    it("lists the text of every cell comment in a cell, trimmed", () => {
        const texl = "<!--[ first ]-->\nText <!--[second]--> and <% x %>\n<!--[\n  third,\n  on lines\n]-->\n";
        expect(cellComments(texl)).to.deep.equal(["first", "second", "third,\n  on lines"]);
    });

    it("ignores other HTML comments", () => {
        expect(cellComments("Text <!-- note --> <!--{ abc2 : text }--> <!--[ comment ]-->\n")).to.deep.equal([
            "comment",
        ]);
    });

    it("finds none in a cell without comments", () => {
        expect(cellComments("Text <% x %>\n")).to.deep.equal([]);
    });
});

describe("serializeDocument", () => {
    const sources = [
        "",
        "Hi <% name %>\n",
        "<!--{ abc2 : text }-->\n# Title\n<!--{ xyz3 : markdown }-->\n<% 1 + 2 %>\n",
        "preamble\n<!--{ abc2 : text }-->\nbody",
        "<!--{ abc2 : text }-->\n<!--{ abc2 : text }-->\nbody",
        "<!--{ text }-->\nbody",
    ];
    for (const source of sources) {
        it(`round-trips ${JSON.stringify(source)}`, () => {
            expect(serializeDocument(parseDocument(source))).to.equal(source);
        });
    }

    it("ends every cell but the last with a line break", () => {
        const cells = [
            { name: "abc2", type: "text", texl: "one" },
            { name: "xyz3", type: "text", texl: "two" },
        ];
        expect(serializeDocument(cells)).to.equal("<!--{ abc2 : text }-->\none\n<!--{ xyz3 : text }-->\ntwo");
    });

    it("writes older markers in the new form", () => {
        expect(serializeDocument(parseDocument("<!--% markdown %-->\nA\n"))).to.equal("<!--{ markdown }-->\nA\n");
    });
});

describe("markers and tags", () => {
    const m = (name, type = "text") => `<!--{ ${name} : ${type} }-->\n`;

    it("finds the tags that the engine finds", async () => {
        const engine = await createEngine();
        const sources = [
            "plain",
            "<% 1 %> and <% 2 %>",
            "<%>",
            "<%%>",
            "<% 1 %",
            "open <% never",
            "%> <% 1 %> %>",
            '<% "a %> b" %>',
            "<%# a %> b %>",
            "<!-- <% 1 %> --> x",
            "<% <% 1 %> %>",
            "è😀 <% 1\n+ 2 %>\r\n<% 3 %>",
        ];
        for (const source of sources) {
            const doc = await engine.render("/doc.texl", source);
            const expected = [...doc.tags].map(({ start, end }) => ({ start, end }));
            expect(tagSpans(source), source).to.deep.equal(expected);
        }
    });

    it("reads a marker line inside a tag as part of the cell", () => {
        const source = `${m("abc2")}<% "one\n${m("xyz3")}two" %>\n${m("pim4")}end\n`;
        const cells = parseDocument(source);
        expect(cells.map((cell) => cell.name)).to.deep.equal(["abc2", "pim4"]);
        expect(cells[0].texl).to.equal(`<% "one\n${m("xyz3")}two" %>\n`);
        expect(serializeDocument(cells)).to.equal(source);
    });

    it("merges the cells a tag left open runs through, up to its %>", () => {
        const source = `${m("abc2")}Span: <% L\n${m("xyz3", "table")}Middle\n${m("pim4")}Load: <% 5 %> kN\n${m("dan5")}End\n`;
        const cells = parseDocument(source);
        expect(cells.map((cell) => cell.name)).to.deep.equal(["abc2", "dan5"]);
        expect(serializeDocument(cells)).to.equal(source);
    });

    it("reads markers after a <% with no %> as markers", () => {
        const cells = parseDocument(`${m("abc2")}a <% b\n${m("xyz3")}c\n`);
        expect(cells.map((cell) => cell.name)).to.deep.equal(["abc2", "xyz3"]);
    });

    it("reads markers after a closed tag and before the next", () => {
        const cells = parseDocument(`<% 1 %>\n${m("abc2")}<% 2 %>\n${m("xyz3")}c\n`);
        expect(cells.map((cell) => cell.name)).to.deep.equal([undefined, "abc2", "xyz3"]);
    });

    it("reads a marker line that opens a tag as text", () => {
        const cells = parseDocument(`${m("abc2")}a\n<!--{ x<% : text }-->\nb %>\n`);
        expect(cells).to.have.length(1);
    });

    it("reads a marker on the line a tag closes on as text", () => {
        const cells = parseDocument(`${m("abc2")}<% 1\n%><!--{ xyz3 : text }-->\nc\n`);
        expect(cells).to.have.length(1);
    });

    it("finds a tag that would run into a later cell", () => {
        const a = { name: "abc2", type: "text", texl: "a <% b\n" };
        const b = { name: "xyz3", type: "text", texl: "c\n" };
        const c = { name: "pim4", type: "text", texl: "<% 1 %>\n" };
        expect(spanningTag([a, b, c])).to.deep.equal({ opens: 0, reaches: 1 });
        expect(spanningTag([b, c, a])).to.equal(null);
        expect(spanningTag([a, b])).to.equal(null);
        expect(spanningTag([{ ...a, texl: "<% 1 %>\n" }, c])).to.equal(null);
    });

    it("finds it from a cell without marker", () => {
        const lead = { type: "text", texl: "<% a\n", marker: false };
        const b = { name: "xyz3", type: "text", texl: "%>\n" };
        expect(spanningTag([lead, b])).to.deep.equal({ opens: 0, reaches: 1 });
    });

    it("gives the cells of a new source", () => {
        const cell = { name: "abc2", type: "markdown", texl: "x" };
        expect(cellsFromSource(cell, "")).to.deep.equal([{ ...cell, texl: "" }]);
        expect(cellsFromSource(cell, "y\n")).to.deep.equal([{ ...cell, texl: "y\n" }]);
        expect(cellsFromSource(cell, `y\n${m("xyz3", "table")}z\n`)).to.deep.equal([
            { ...cell, texl: "y\n" },
            { name: "xyz3", type: "table", texl: "z\n" },
        ]);
        expect(cellsFromSource(cell, `${m("xyz3", "table")}z\n`)).to.deep.equal([
            { name: "xyz3", type: "table", texl: "z\n" },
        ]);
        expect(cellsFromSource(cell, `<% "${m("xyz3")}" %>`)).to.deep.equal([{ ...cell, texl: `<% "${m("xyz3")}" %>` }]);
    });
});

describe("splitRendering", () => {
    const a = { name: "abc2", type: "text", texl: "A\n" };
    const b = { name: "xyz3", type: "markdown", texl: "B\n" };
    const c = { name: "pim4", type: "text", texl: "C\n" };

    /** The rendering of cells whose source holds tags, with the real engine. */
    async function split(cells) {
        const engine = await createEngine();
        return splitRendering(await engine.render("/doc.texl", serializeDocument(cells)), cells);
    }

    it("splits a document without tags", () => {
        const text = serializeDocument([a, b]);
        expect(splitRendering({ text, tags: [] }, [a, b])).to.deep.equal(["A\n", "B\n"]);
    });

    it("finds the markers after tags that change the size of the text", async () => {
        const cells = [
            { ...a, texl: "<% x = 1 %>\n<% 1000 * 1000 %> m\n" },
            { ...b, texl: "<% x %>\n" },
            c,
        ];
        expect(await split(cells)).to.deep.equal(["\n1000000 m\n", "1\n", "C\n"]);
    });

    it("counts positions as string indices", async () => {
        const cells = [{ ...a, texl: 'è😀 <% "ñ😀" %>\n' }, { ...b, texl: "😀 <% 2 %>\n" }];
        expect(await split(cells)).to.deep.equal(["è😀 ñ😀\n", "😀 2\n"]);
    });

    it("gives the text before the first marker to the leading cell", async () => {
        const lead = { type: "text", texl: "<% 1 + 1 %> pre\n", marker: false };
        expect(await split([lead, a])).to.deep.equal(["2 pre\n", "A\n"]);
    });

    it("reads a tag's output as content, also with the marker of a later cell", async () => {
        const cells = [{ ...a, texl: '<% "<!--{ xyz3 : markdown }-->\nout\n" %>\n' }, b];
        expect(await split(cells)).to.deep.equal(["<!--{ xyz3 : markdown }-->\nout\n\n", "B\n"]);
    });

    it("reads a marker of an earlier cell in a tag's output as content", async () => {
        const cells = [a, { ...b, texl: '<% "<!--{ abc2 : text }-->\n" %>\n' }, c];
        expect(await split(cells)).to.deep.equal(["A\n", "<!--{ abc2 : text }-->\n\n", "C\n"]);
    });

    it("gives the text of a marker inside a tag to the last cell found", async () => {
        const cells = [{ ...a, texl: "q <% 1 +\n" }, { ...b, texl: " 2 %> r\n" }, c];
        expect(await split(cells)).to.deep.equal(["q [[Undefined]] r\n", "", "C\n"]);
    });

    it("keeps a string that holds a marker whole", async () => {
        const cells = [{ ...a, texl: 'q <% "open\n' }, { ...b, texl: 'close" %> r\n' }, c];
        expect(await split(cells)).to.deep.equal(["q open\n<!--{ xyz3 : markdown }-->\nclose r\n", "", "C\n"]);
    });

    it("reads an unclosed tag as text", async () => {
        const cells = [{ ...a, texl: "q <% 1 +\n" }, b];
        expect(await split(cells)).to.deep.equal(["q <% 1 +\n", "B\n"]);
    });

    it("drops the line break that serializeDocument adds", () => {
        const one = { name: "abc2", type: "text", texl: "one" };
        const two = { name: "xyz3", type: "text", texl: "two" };
        const cells = [one, two, b];
        expect(splitRendering({ text: serializeDocument(cells), tags: [] }, cells)).to.deep.equal(["one", "two", "B\n"]);
    });

    it("keeps a line break a tag ends its output with", async () => {
        const cells = [{ ...a, texl: '<% "x\n" %>' }, b];
        expect(await split(cells)).to.deep.equal(["x\n", "B\n"]);
    });

    it("keeps the line breaks of the cells", () => {
        const cells = [a, { ...b, texl: "B\n\n" }, { name: "pim4", type: "text", texl: "" }, a];
        expect(splitRendering({ text: serializeDocument(cells), tags: [] }, cells)).to.deep.equal(["A\n", "B\n\n", "", "A\n"]);
    });

    it("reads cells without name", () => {
        const cells = [{ type: "text", texl: "x" }, { type: "text", texl: "y" }];
        expect(splitRendering({ text: serializeDocument(cells), tags: [] }, cells)).to.deep.equal(["x", "y"]);
    });
});

describe("outputSpans", () => {
    it("gives an empty span to a cell whose marker is inside a tag", async () => {
        const cells = [
            { name: "abc2", type: "text", texl: "<% 1 +\n" },
            { name: "xyz3", type: "text", texl: "2 %>\n" },
        ];
        const engine = await createEngine();
        const doc = await engine.render("/doc.texl", serializeDocument(cells));
        const [first, second] = outputSpans(doc, cells);
        expect(doc.text.slice(first.start, first.end)).to.equal("[[Undefined]]\n");
        expect(second.end - second.start).to.equal(0);
    });
});
