# Documentation style guide

This guide keeps the Stilo documentation consistent: the manual
(`docs/src`), the landing page, and the docstrings and comments in the
code. It follows the
[Texl style guide](https://github.com/onlabsorg/texl/blob/main/docs/STYLE.md),
so the OnLabs.org sites read and look alike.

## Where things live

| What                                   | Where                                   |
|----------------------------------------|-----------------------------------------|
| Landing page                           | `docs/site/index.html`              |
| Manual: getting started, the `stilo` command, the web editor, the document format, protocol, editor component, developer guide | `docs/src` (an mdBook; `docs/book.toml`) |
| Contributing, changelog                | `CONTRIBUTING.md`, `CHANGELOG.md` at the repository root, included in the manual |
| Shared look and feel                   | `docs/assets`                       |
| The built site                         | `target/site`, built by `docs/build.sh` (git-ignored) |

The protocol chapter, `docs/src/protocol.md`, is also the contract
between the web app and the server: change it first, then the code.

## Narrative style

- Write for the reader of that page. The user chapters (getting started,
  the `stilo` command, the web editor) speak to engineers and Word or Excel
  users, not to programmers: no jargon, no code they do not need. The developer guide speaks to programmers.
- Address the reader as "you". Use the present tense and the active voice.
- Prefer short sentences and short paragraphs. One idea per paragraph.
- Show an example first, then explain it.
- Describe what the software does today. Describe planned features only as
  "coming soon", and never in an API reference.
- When the behavior is surprising, say so plainly and show the fix.
- Use American spelling. (Pages that came from the former `texl-editor`
  still use British spelling in places; fix it when you edit them.)
- Wrap Markdown lines at about 80 characters.

## Terms

| Use                | For                                                              |
|--------------------|------------------------------------------------------------------|
| document           | one `.texl` file                                                 |
| folder             | the folder that `stilo serve` serves; its documents             |
| the web editor     | the whole user interface in the browser (users' word)            |
| the web app        | the same, in the developer guide                                 |
| the editor         | the sheet of cells, `<texl-editor>`                              |
| line               | a cell, as the user sees it, by its number                       |
| cell               | a line, as the file format and the code see it                   |
| formula            | a `<% %>` tag, in the user chapters                              |
| tag                | a `<% %>` tag, in the developer guide                            |
| name               | a Swan identifier (not "variable", except in passing)            |
| comment            | a cell comment, `<!--[ ... ]-->`                                 |

Write "Stilo", "Texl" and "Swan" capitalized in prose, and `stilo` in code
font for the command. Write keys as `Ctrl+Enter`, with Mac keys mentioned
once per page ("⌘ instead of Ctrl").

## Code examples

- Texl documents go in ```` ```texl ```` blocks, Swan code in
  ```` ```swan ```` blocks, shell commands in ```` ```sh ```` blocks, and
  output in ```` ```text ```` blocks.
- A ```` ```texl ```` block followed by a ```` ```text ```` block shows a
  document and its exact rendering.
- Keep examples small and runnable. Every rendering and every command
  output must be the real output of the current implementation.

## API references

Every entry has the same shape: a heading with the name in code font, a
signature block, a one-sentence summary that starts with a verb in the
third person ("Returns ...", "Creates ..."), details, and an example where
it helps. Signatures use the language's own notation: Python with type
hints, JavaScript as in the editor's API reference
(`docs/src/component/api.md`).

Python docstrings follow the Google style. JavaScript uses JSDoc comments.

## Look and feel

- All pages share the design tokens of `docs/assets/texl.css`: colors,
  fonts, spacing and code colors, in a light and a dark variant.
- `texl.css`, `landing.css`, `book.css` and `texl-highlight.js` are copies
  of the Texl documentation's files: refresh them from there, do not edit
  them. Stilo's additions go in `stilo.css`, and use the tokens only.
- `book.js` adds the Stilo wordmark and the site links to mdBook's menu
  bar.
