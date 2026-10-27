# stilo — summary

*What this repository is, how it is built and where it stands, in plain
words. The OnLabs.org coordination folder reads this file instead of the
code; keep it current as described in `CLAUDE.md`.*

Details: `CLAUDE.md` (stack, layout, commands), and the documentation in
`docs/` (the protocol is `docs/src/protocol.md`), published on
<https://www.onlabs.org/stilo/>.

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
| Documentation | A static site, in the same style as the Texl and OnLabs.org sites: landing page and a manual (getting started, the `stilo` command, the web editor, the document format, the protocol, the editor component, a developer guide, contributing, changelog). Built and published on GitHub Pages by GitHub Actions. |

Web app, server and CLI ship as **one Python package**, `stilo`, with the
built web app inside it. The server stays independent of the CLI (a test
checks it), so it can be reused or replaced on its own.

Each document has one URL, `/path/to/doc.texl`: a browser gets the web app,
`texl.import` gets the file. A link in a document to another document opens
it in the app. Imports with relative paths resolve from the document's own
folder, the same in the browser and on the command line, and are fetched
again at every rendering.

Single-user by design: no accounts or permissions. Revisions, release and
accept are not part of Stilo.

## Status

- 2026-10-26: **repository restarted** on <https://github.com/onlabsorg/stilo>
  (the olojs-era Stilo is kept under the tag `olojs-v0.19.4`). Brought
  together the scaffolding of the former platform (server, web app,
  protocol; 2026-10-24) and `texl-editor` 0.2.0 (Texl 0.4), and added the
  CLI with `render` and `serve`. Web app and editor build; editor tests
  (121), server tests (23) and CLI tests (3) pass. MIT. Nothing published.
- 2026-10-27: the command groups in the commands pane fold. **Documentation
  site** added (`docs/`, built into `target/site` and published by a GitHub
  Actions workflow on every push to `main`), with `CONTRIBUTING.md` and
  `CHANGELOG.md`; the former `texl-editor` documents were updated and moved
  into it. Not live until GitHub Pages is set to deploy from GitHub Actions.
- 2026-10-27: **one package**, `stilo`: the code was reorganised into a
  single Python project (server and CLI as parts of one package, the web
  app built into it). From a checkout, one command builds and installs
  `stilo` with the web app included; the continuous integration builds the
  package, installs it and tries `render` and `serve`. Version 0.0.1, not
  published.
- Next: the table cell; a small editor API for the app (`runCommand`,
  `select(line)`); publishing the package on PyPI.

## Known limitations

- Not on PyPI yet: install from a checkout (`uv tool install .` after
  building the web app); no release workflow.
- No authentication: serve to localhost, or behind your own access control.
- The app drives editor commands with synthetic key presses and cannot
  select a line from the comments pane.
- The sample `examples/sample.texl` imports a library from the wrong folder
  and does not render fully.
- Editor: if an imported document's rendering contains a marker with the
  same name as a later cell, the split into cells goes wrong (rare); a
  formula tag spanning two cells hides the later cell's output; links in
  rendered text to files other than documents resolve against the page, not
  the document; autocompletion of names must be redesigned.
- The editor is not published as a package of its own: pages that embed it
  use it from a copy of the source code.
