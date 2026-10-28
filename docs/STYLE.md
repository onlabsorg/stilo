# Documentation style guide

This guide keeps Stilo's developer documentation consistent: the pages in
`docs/`, `CONTRIBUTING.md`, and the docstrings and comments in the code.
The user manual is not written here (see [README.md](README.md)).

## Where things live

| What                                   | Where                                   |
|----------------------------------------|-----------------------------------------|
| Developer docs: architecture, setup, server, CLI, web app, editor, protocol, editor component | `docs/`, plain Markdown, index in `docs/README.md` |
| Contributing, changelog                | `CONTRIBUTING.md`, `CHANGELOG.md` at the repository root |
| API details next to the code           | Python docstrings, JSDoc comments       |

**The protocol is a contract.** `docs/protocol.md` is the contract between
the web app and the server, and with any other server that speaks it.
Change it first, then `src/stilo/server/` and `web/src/api.js`.

## Narrative style

- Write for programmers. Name things as the code names them: modules,
  classes, functions, events.
- Address the reader as "you". Use the present tense and the active voice.
- Prefer short sentences and short paragraphs. One idea per paragraph.
- Show an example first, then explain it.
- Describe what the code does today. Mark undecided design points as
  **(open)**; never describe planned features in an API reference.
- When the behavior is surprising, say so plainly and show the fix.
- Use American spelling. (Pages that came from the former `texl-editor`
  still use British spelling in places; fix it when you edit them.)
- Link between pages with relative links, so they work on GitHub. Do not
  link to the OnLabs.org site.
- Wrap Markdown lines at about 80 characters.

## Terms

| Use                | For                                                              |
|--------------------|------------------------------------------------------------------|
| document           | one `.texl` file                                                 |
| folder             | the folder that `stilo serve` serves                             |
| the web app        | the whole user interface in the browser                          |
| the editor         | the sheet of cells, `<texl-editor>`                              |
| cell               | one part of a document, from its marker to the next              |
| line               | a cell, as the user sees it, by its number                       |
| tag                | a `<% %>` tag                                                    |
| name               | a Swan identifier (not "variable", except in passing)            |
| comment            | a cell comment, `<!--[ ... ]-->`                                 |

Write "Stilo", "Texl" and "Swan" capitalized in prose, and `stilo` in code
font for the command. Write keys as `Ctrl+Enter`.

## Code examples

- Texl documents go in ```` ```texl ```` blocks, Swan code in
  ```` ```swan ```` blocks, shell commands in ```` ```sh ```` blocks,
  Python in ```` ```python ````, JavaScript in ```` ```js ````, and output
  in ```` ```text ```` blocks.
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
([`component/api.md`](component/api.md)).

## Docstrings and comments

- Python: Google-style docstrings on every public module, class and
  function.
- JavaScript: JSDoc comments, with types (`@param`, `@returns`,
  `@type`): they are the type checking, since there is no TypeScript.
- A comment that refers to the docs names the file in `docs/`, e.g.
  `docs/protocol.md`.
