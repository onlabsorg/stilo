# stilo — summary

*What this repository is, how it is built and where it stands, in plain
words. The OnLabs.org coordination folder reads this file instead of the
code; keep it current as described in `CLAUDE.md`.*

Details: `CLAUDE.md` (stack, layout, commands), `docs/protocol.md`,
`docs/editor/`.

## In one sentence

Stilo is the open-source editor for Texl documents: it edits a folder of
linked `.texl` files in the browser, as a stack of cells that feels familiar
to Word and Excel users, and renders them from the command line.

## Parts

| Part   | What                                                          |
|--------|---------------------------------------------------------------|
| Web app | The user interface (Lit web components, Vite): top bar, navigation pane with the folder's files, the editor, right pane with commands and cell comments. Light and dark theme. |
| Editor | Inside the web app: `<texl-editor>`, a document as a stack of typed cells (text and Markdown so far; formulas as `<% %>` tags), live rendering, cell comments. Until 2026-10-26 the separate `texl-editor` package. |
| Server | Python (FastAPI): serves one folder of documents and the web app, for one user. |
| CLI    | The `stilo` command: `stilo render <file>` prints a rendered document (or writes it to a file); `stilo serve [folder]` starts the server on a folder. |
| Protocol | Plain HTTP between web app and server: GET a file, CREATE (POST), UPDATE (PUT, with an ETag so concurrent saves don't overwrite each other), QUERY a folder's tree. |

Each document has one URL, `/path/to/doc.texl`: a browser gets the web app,
`texl.import` gets the file. Imports with relative paths resolve from the
document's own folder, the same in the browser and on the command line, and
are fetched again at every rendering.

Single-user by design: no accounts or permissions. Revisions, release and
accept are not part of Stilo.

## Status

- 2026-10-26: **repository restarted** on <https://github.com/onlabsorg/stilo>
  (the olojs-era Stilo is kept under the tag `olojs-v0.19.4`). Brought
  together the scaffolding of the former platform (server, web app,
  protocol; 2026-10-24) and `texl-editor` 0.2.0 (Texl 0.4), and added the
  CLI with `render` and `serve`. Web app and editor build; editor tests
  (121), server tests (23) and CLI tests (3) pass. MIT. Nothing published.
- Next: the table cell; a small editor API for the app (`runCommand`,
  `select(line)`); packaging so that Stilo installs with one command.

## Known limitations

- Not installable on its own yet: run from a checkout (the CLI finds the
  built web app there).
- No authentication: serve to localhost, or behind your own access control.
- The app drives editor commands with synthetic key presses and cannot
  select a line from the comments pane.
- Editor: if an imported document's rendering contains a marker with the
  same name as a later cell, the split into cells goes wrong (rare); a
  formula tag spanning two cells hides the later cell's output; links in
  rendered text resolve against the page, not the document; autocompletion
  of names must be redesigned.
- The editor documentation (`docs/editor/`) still describes the former
  `@onlabsorg/texl-editor` package.
