import { expect } from "@open-wc/testing";
import { EditorState } from "prosemirror-state";
import { parseRich, serializeRich, acceptsRich } from "../src/editor/rich/markdown.js";
import { schema } from "../src/editor/rich/schema.js";

const { nodes, marks } = schema;

/** Writes a source back with the writer alone, ignoring how it was written. */
const rewritten = (source) => serializeRich(parseRich(source).doc);

const inlineOf = (source) => {
    const out = [];
    parseRich(source).doc.firstChild.forEach((n) => out.push(n.isText ? [n.text, ...n.marks.map((m) => m.type.name)] : n.type.name));
    return out;
};

const paragraph = (...content) => nodes.paragraph.create(null, content);
const doc = (...blocks) => nodes.doc.create(null, blocks);
const text = (value, ...markNames) => schema.text(value, markNames.map((name) => marks[name].create()));

describe("rich text: reading", () => {
    it("reads the blocks", () => {
        const { doc: d } = parseRich("# T\n\npara\n\n> q\n\n- a\n- b\n\n3. x\n\n```js\nc\n```\n\n---\n\n$$x^2$$\n");
        const types = [];
        d.forEach((n) => types.push(n.type.name));
        expect(types).to.deep.equal(["heading", "paragraph", "blockquote", "bullet_list", "ordered_list", "code_block", "horizontal_rule", "math_block"]);
        expect(d.child(4).attrs.start).to.equal(3);
        expect(d.child(5).attrs.lang).to.equal("js");
    });

    it("reads the marks", () => {
        expect(inlineOf("**b** *i* ~~d~~ `c` <u>u</u> H<sub>2</sub>")).to.deep.equal([
            ["b", "strong"], [" "], ["i", "em"], [" "], ["d", "strike"], [" "], ["c", "code"], [" "], ["u", "underline"], [" H"], ["2", "sub"],
        ]);
    });

    it("makes a tag a node, whatever Swan is in it", () => {
        const { doc: d } = parseRich("M = <% a * b * c %> kNm");
        expect(d.firstChild.child(1).type).to.equal(nodes.tag);
        expect(d.firstChild.child(1).attrs.source).to.equal("<% a * b * c %>");
    });

    it("makes a tag of several lines one node", () => {
        const { doc: d } = parseRich("<%\nL = 6,   # span\nq = 2\n%>\n\ntext");
        expect(d.firstChild.child(0).attrs.source).to.equal("<%\nL = 6,   # span\nq = 2\n%>");
    });

    it("keeps tags as source in code, equations and addresses", () => {
        const { doc: d } = parseRich("`<% a %>` $x = <% b %>$ [l](<% c %>)");
        const [code, , math, , link] = [0, 1, 2, 3, 4].map((i) => d.firstChild.child(i));
        expect(code.text).to.equal("<% a %>");
        expect(math.attrs.tex).to.equal("x = <% b %>");
        expect(link.marks[0].attrs.href).to.equal("<% c %>");
    });

    it("reads escapes and entities as text", () => {
        expect(parseRich("\\*a\\* &lt;% \\$5").doc.textContent).to.equal("*a* <% $5");
    });

    it("takes comments out", () => {
        const read = parseRich("a<!--[ note ]-->\n\n<!-- other -->\nb");
        expect(read.comments).to.deep.equal(["<!--[ note ]-->", "<!-- other -->"]);
        expect(read.doc.textContent).to.equal("ab");
    });

    for (const [name, source] of [
        ["raw HTML blocks", "<div>x</div>"],
        ["raw inline HTML", "a <span style='color:red'>x</span>"],
        ["tables", "| a |\n|---|\n| b |"],
        ["task lists", "- [ ] a"],
        ["reference links", "[a][b]\n\n[b]: http://x.io"],
        ["list items that start with a title", "- # a"],
        ["an unclosed HTML tag", "a <u>b"],
    ]) {
        it(`refuses ${name}`, () => {
            expect(parseRich(source) === null || !acceptsRich(source)).to.equal(true);
            expect(acceptsRich(source)).to.equal(false);
        });
    }
});

describe("rich text: writing", () => {
    for (const source of [
        "# Title",
        "para **bold** *it* ~~del~~ `code`",
        "a<br>",
        "- a\n- b\n  - c\n- d",
        "1. a\n2. b",
        "- a\n\n- b",
        "> quote\n>\n> more",
        "```js\nlet x = 1;\n```",
        "---",
        "$$x^2$$",
        "a $x^2$ b",
        "M = <% a * b %> kNm",
        "<% L = 6 %>",
        "[link](http://x.io \"title\")",
        "![pic](a.png)",
        "H<sub>2</sub>O and x<sup>2</sup> and <u>u</u>",
        "line\\\nbreak",
    ]) {
        it(`keeps the meaning of ${JSON.stringify(source)}`, () => {
            expect(acceptsRich(source), rewritten(source)).to.equal(true);
        });
    }

    for (const [name, value] of [
        ["stars", "2 * 3 * 4 and *not italic*"],
        ["underscores", "_a_ and snake_case"],
        ["backticks", "a ` b"],
        ["brackets", "[not](a link)"],
        ["a tilde", "~~no~~"],
        ["a backslash", "a\\*b"],
        ["a tag opening", "write <% like this"],
        ["a tag closing", "and %> like that"],
        ["a comment opening", "a <!-- b"],
        ["HTML", "<b>not bold</b>"],
        ["an entity", "&lt; stays"],
        ["two dollars", "$x$ and $5"],
        ["a title sign", "# not a title"],
        ["a quote sign", "> not a quote"],
        ["a dash", "- not a list"],
        ["a number", "1. not a list"],
        ["a rule", "---"],
        ["a fence", "```"],
        ["a marker", "<!--{ abc1 : text }-->"],
        ["an equals sign", "==="],
    ]) {
        it(`typed text with ${name} stays that text`, () => {
            const source = serializeRich(doc(paragraph(text(value))));
            const read = parseRich(source);
            expect(read, source).to.not.equal(null);
            expect(read.doc.firstChild.textContent, source).to.equal(value);
            expect(read.doc.firstChild.childCount, source).to.equal(1);
            expect(read.doc.childCount, source).to.equal(1);
        });
    }

    it("typed text cannot make a tag or a marker", () => {
        const source = serializeRich(doc(paragraph(text("<% 1 + 1 %>")), paragraph(text("<!--{ abc1 : text }-->"))));
        expect(source).to.not.include("<%");
        expect(source).to.not.include("<!--{");
    });

    it("moves white space out of marks", () => {
        expect(serializeRich(doc(paragraph(text("a"), text(" b ", "strong"), text("c"))))).to.equal("a **b** c");
    });

    it("nests marks that overlap", () => {
        const d = doc(paragraph(text("a", "strong"), text("b", "em", "strong"), text("c", "strong")));
        expect(parseRich(serializeRich(d)).doc.eq(d), serializeRich(d)).to.equal(true);
    });

    it("falls back to HTML where Markdown delimiters would not work", () => {
        const d = doc(paragraph(text("x"), text('"q"', "strong"), text("y")));
        const source = serializeRich(d);
        expect(source).to.equal('x<strong>"q"</strong>y');
        expect(parseRich(source).doc.eq(d)).to.equal(true);
    });

    it("drops empty paragraphs", () => {
        expect(serializeRich(doc(paragraph(text("a")), paragraph(), paragraph(), paragraph(text("b"))))).to.equal("a\n\nb");
        expect(serializeRich(doc(paragraph()))).to.equal("");
    });

    it("writes two lists in a row so that they stay two", () => {
        const item = (t) => nodes.list_item.create(null, paragraph(text(t)));
        const d = doc(nodes.bullet_list.create(null, item("a")), nodes.bullet_list.create(null, item("b")));
        expect(parseRich(serializeRich(d)).doc.childCount).to.equal(2);
    });

    it("makes a list loose when an item has two paragraphs", () => {
        const item = nodes.list_item.create(null, [paragraph(text("a")), paragraph(text("b"))]);
        const d = doc(nodes.bullet_list.create(null, [item]));
        expect(parseRich(serializeRich(d)).doc.firstChild.firstChild.childCount).to.equal(2);
    });

    it("uses a longer fence for code with a fence", () => {
        const d = doc(nodes.code_block.create(null, text("```\nx\n```")));
        expect(parseRich(serializeRich(d)).doc.firstChild.textContent).to.equal("```\nx\n```");
    });
});

describe("rich text: small changes to the file", () => {
    const source = "Wrapped  text\nover two lines, *starred*.\n\n* star list\n* two\n\nSetext title\n===\n<!--[ note ]-->\n";

    it("an unchanged document keeps its source exactly", () => {
        const read = parseRich(source);
        expect(serializeRich(read.doc, read)).to.equal(source);
        const crlf = "a\r\n\r\nb\r\n";
        const readCrlf = parseRich(crlf);
        expect(serializeRich(readCrlf.doc, readCrlf)).to.equal(crlf);
    });

    it("a change to one block leaves the others as written", () => {
        const read = parseRich(source);
        const state = EditorState.create({ doc: read.doc });
        const end = read.doc.child(0).nodeSize - 1;
        const changed = state.apply(state.tr.insertText(" More.", end)).doc;
        const out = serializeRich(changed, read);
        expect(out).to.include("* star list\n* two");
        expect(out).to.include("Setext title\n===");
        expect(out).to.include("Wrapped  text over two lines, *starred*. More.");
        expect(out).to.include("<!--[ note ]-->");
    });

    it("undoing by retyping restores the source of a block", () => {
        const read = parseRich(source);
        const same = schema.nodeFromJSON(read.doc.toJSON());
        const extended = doc(...[...Array(same.childCount).keys()].map((i) => same.child(i)), paragraph(text("new")));
        expect(serializeRich(extended, read)).to.include("Wrapped  text\nover two lines");
    });

    it("blocks that were neighbours without a blank line stay so", () => {
        const tight = "<% L = 6 %>\n- Span\n\nnext";
        const read = parseRich(tight);
        const d = doc(read.doc.child(0), read.doc.child(1), paragraph(text("changed")));
        expect(serializeRich(d, read)).to.equal("<% L = 6 %>\n- Span\n\nchanged");
    });

    it("keeps the comments, and adds new ones", () => {
        const read = parseRich("a\n<!--[ one ]-->");
        const d = doc(paragraph(text("b")));
        expect(serializeRich(d, read)).to.equal("b\n<!--[ one ]-->");
        expect(serializeRich(read.doc, read, [...read.comments, "<!--[ two ]-->"])).to.equal("a\n<!--[ one ]-->\n<!--[ two ]-->");
    });
});

describe("rich text: acceptance", () => {
    it("accepts empty sources and those with only comments", () => {
        expect(acceptsRich("")).to.equal(true);
        expect(acceptsRich("  \n<!--[ c ]-->\n")).to.equal(true);
    });

    it("accepts marks in any order and form", () => {
        for (const source of ["***x***", "**_x_**", "_**x**_", "<strong>x</strong>"]) expect(acceptsRich(source), source).to.equal(true);
    });

    it("accepts other ways of writing the same", () => {
        for (const source of ["* a\n* b", "+ a", "1) a", "Title\n===", "    indented code", "a  \nb", "___"]) {
            expect(acceptsRich(source), source).to.equal(true);
        }
    });

    for (const url of ["library/steel.texl", "http://x.io/a_b(c)", "a b.png"]) {
        it(`keeps the address ${url}`, () => {
            const d = doc(paragraph(schema.text("l", [marks.link.create({ href: url })])));
            expect(parseRich(serializeRich(d)).doc.firstChild.firstChild.marks[0].attrs.href).to.equal(url);
        });
    }
});

describe("rich text: the example documents", () => {
    const cellsOf = async (path) => {
        const { parseDocument } = await import("../src/editor/document.js");
        const response = await fetch(path);
        return parseDocument(await response.text());
    };

    for (const path of ["/examples/projects/beam/beam-check.texl", "/examples/sample.texl"]) {
        it(`round-trips every cell it accepts in ${path}, unchanged`, async () => {
            const cells = await cellsOf(path);
            expect(cells.length).to.be.greaterThan(1);
            for (const { texl } of cells) {
                const read = parseRich(texl);
                if (read) expect(serializeRich(read.doc, read)).to.equal(texl);
            }
        });
    }

    it("accepts the Markdown cells of the beam example, except those with a table or a caption", async () => {
        const cells = await cellsOf("/examples/projects/beam/beam-check.texl");
        const markdown = cells.filter(({ type }) => type === "markdown");
        const refused = markdown.filter(({ texl }) => !acceptsRich(texl));
        expect(markdown.length).to.be.greaterThan(2);
        expect(refused.filter(({ texl }) => !texl.includes("|---|") && !texl.includes("<caption>"))).to.deep.equal([]);
    });
});
