import { expect, fixture, html } from "@open-wc/testing";
import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import "../src/editor/index.js";
import { matchInlineMath } from "../src/editor/math.js";
import { markErrors } from "../src/editor/errors.js";

async function view(output, errorMessages = []) {
    const cell = await fixture(html`<texl-cell-markdown .output=${output} .errorMessages=${errorMessages}></texl-cell-markdown>`);
    return cell.shadowRoot.querySelector(".view");
}

describe("equations: which dollars open one (Pandoc's rule)", () => {
    const equations = {
        "$x$": "x",
        "$a + b$ and more": "a + b",
        "$\\sigma_1 = \\frac{M}{W}$.": "\\sigma_1 = \\frac{M}{W}",
        "$5$": "5",
        "$a \\$ b$": "a \\$ b",
        "$a\nb$": "a\nb",
        "$$x$$ text": "x",
    };
    for (const [text, tex] of Object.entries(equations)) {
        it(`finds ${JSON.stringify(tex)} in ${JSON.stringify(text)}`, () => {
            expect(matchInlineMath(text)?.tex).to.equal(tex);
        });
    }

    for (const text of ["$5 and $10", "$5-$10", "$ x$", "$x $", "$x$5", "$", "$$", "$a\n\nb$", "$no end"]) {
        it(`finds none in ${JSON.stringify(text)}`, () => {
            expect(matchInlineMath(text)).to.be.null;
        });
    }
});

describe("equations in a Markdown cell", () => {
    it("typesets one in the text", async () => {
        const shown = await view("Stress $\\sigma_y$ here");
        expect(shown.querySelector("p .katex")).to.exist;
        expect(shown.querySelector(".katex-display")).to.not.exist;
        expect(shown.querySelector("em")).to.not.exist;
        expect(shown.textContent).to.contain("Stress").and.to.contain("here");
    });

    it("typesets one on lines of its own as a display equation", async () => {
        const shown = await view("Before\n$$\nx_a = 1\n= y_a\n$$\nAfter");
        expect(shown.querySelector(".katex-display")).to.exist;
        expect(shown.querySelector("h1, h2")).to.not.exist;
        expect(shown.querySelector(".katex-error")).to.not.exist;
        expect(shown.querySelectorAll("p").length).to.equal(3);
    });

    it("keeps Markdown from reading the LaTeX", async () => {
        const shown = await view("$a_1 * b_1 * c < d$ and $\\frac{1}{2}$");
        expect(shown.querySelectorAll(".katex").length).to.equal(2);
        expect(shown.querySelector("em, strong")).to.not.exist;
    });

    it("leaves money, escaped dollars and code as they are", async () => {
        for (const [source, text] of [
            ["It costs $5 and $10.", "It costs $5 and $10."],
            ["From $5-$10 only", "From $5-$10 only"],
            ["\\$x\\$", "$x$"],
            ["`$x$`", "$x$"],
        ]) {
            const shown = await view(source);
            expect(shown.querySelector(".katex"), source).to.not.exist;
            expect(shown.textContent.trim()).to.equal(text);
        }
    });

    it("leaves a fenced code block alone", async () => {
        const shown = await view("```\n$$x$$\n```");
        expect(shown.querySelector(".katex")).to.not.exist;
        expect(shown.querySelector("pre").textContent).to.contain("$$x$$");
    });

    it("shows bad LaTeX in red with the reason, and the rest of the text", async () => {
        const shown = await view("a $\\frac{1$ b");
        const error = shown.querySelector(".katex-error");
        expect(error.title).to.contain("ParseError");
        expect(getComputedStyle(error).color).to.not.equal(getComputedStyle(shown).color);
        expect(shown.textContent).to.contain("b");
    });

    it("runs no script, link or class from the LaTeX", async () => {
        const shown = await view(
            "$\\href{javascript:alert(1)}{x}$ $\\htmlClass{evil}{x}$ $x$<img src=x onerror=alert(1)>",
        );
        expect(shown.querySelector("a")).to.not.exist;
        expect(shown.querySelector(".evil")).to.not.exist;
        expect(shown.querySelector("[onerror]")).to.not.exist;
    });

    it("declares the fonts in the document and the styles in the cell", async () => {
        const shown = await view("$x$");
        expect(getComputedStyle(shown.querySelector(".katex")).fontFamily).to.contain("KaTeX_Main");
        const faces = [...document.fonts].filter((font) => font.family.includes("KaTeX"));
        expect(faces.length).to.be.greaterThan(0);
    });

    it("keeps an equation with an undefined value as text, the value highlighted", async () => {
        const text = "$x = bad$";
        const start = text.indexOf("bad");
        const places = [{ start, end: start + 3 }];
        const marked = markErrors(text, places, { start: 0, end: text.length });
        const shown = await view(marked, ["why"]);
        expect(shown.querySelector(".katex")).to.not.exist;
        const value = shown.querySelector(".undefined-value");
        expect(value.dataset.error).to.equal("0");
        expect(value.title).to.equal("why");
        expect(shown.textContent.trim()).to.equal("$x = [[Undefined]]$");
    });

});

describe("equations in a table cell", () => {
    it("are typeset and styled", async () => {
        const cell = await fixture(
            html`<texl-cell-table .output=${"| a |\n|---|\n| $x_1$ |\n"}></texl-cell-table>`,
        );
        const katexNode = cell.shadowRoot.querySelector("td .katex");
        expect(katexNode).to.exist;
        expect(getComputedStyle(katexNode).fontFamily).to.contain("KaTeX_Main");
    });
});

describe("equations in the source of a Markdown cell", () => {
    it("are not read as emphasis", async () => {
        const cell = await fixture(html`<texl-cell-markdown .texl=${"$a_1 + b_1$\n"}></texl-cell-markdown>`);
        cell.mode = "edit";
        await cell.updateComplete;
        const editor = EditorView.findFromDOM(cell.shadowRoot.querySelector(".cm-editor"));
        const names = [];
        syntaxTree(editor.state).iterate({ enter: (node) => names.push(node.name) });
        expect(names).to.include("TexlMath");
        expect(names).to.not.include("Emphasis");
    });
});

describe("equations in a document", () => {
    it("show a computed value", async () => {
        const editor = await fixture(html`<texl-editor></texl-editor>`);
        editor.value = '<!--{ abcd : markdown }-->\n<% a = 6 * 7 %>$a = <% a %>$\n';
        await editor.rendered;
        const cell = editor.shadowRoot.querySelector("texl-cell-markdown");
        await cell.updateComplete;
        const katexNode = cell.shadowRoot.querySelector(".katex");
        expect(katexNode).to.exist;
        expect(katexNode.textContent).to.contain("42");
    });

    it("keep an undefined value clickable", async () => {
        const editor = await fixture(html`<texl-editor></texl-editor>`);
        editor.value = '<!--{ abcd : markdown }-->\n$a = <% 1 + "z" %>$\n';
        await editor.rendered;
        const cell = editor.shadowRoot.querySelector("texl-cell-markdown");
        await cell.updateComplete;
        expect(cell.shadowRoot.querySelector(".katex")).to.not.exist;
        expect(cell.shadowRoot.querySelector(".undefined-value")).to.exist;
        expect(editor.errors.length).to.equal(1);
    });
});
