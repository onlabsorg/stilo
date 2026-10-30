# stilo — summary

*What this repository is, how it is built and where it stands, in plain
words. The OnLabs.org coordination folder reads this file instead of the
code; keep it current as described in `CLAUDE.md`.*

Details: `CLAUDE.md` (stack, layout, commands), and the developer
documentation in `docs/` (the protocol is `docs/protocol.md`). The user
manual is the OnLabs.org manual, <https://www.onlabs.org/manual/>, outside
this repository.

## In one sentence

Stilo is the open-source editor for Texl documents: it edits a folder of
linked `.texl` files in the browser, as a stack of cells that feels familiar
to Word and Excel users, and renders them from the command line.

## Parts

| Part   | What                                                          |
|--------|---------------------------------------------------------------|
| Web app | The user interface (Lit web components, Vite): top bar, navigation pane with the folder's files, the editor, right pane with commands and cell comments. Light and dark theme. |
| Editor | Inside the web app: `<texl-editor>`, a document as a stack of typed cells (text, Markdown and a first table cell; formulas as `<% %>` tags), live rendering, cell comments. Until 2026-10-26 the separate `texl-editor` package. |
| Server | Python (FastAPI): serves one folder of documents and the web app, for one user. |
| CLI    | The `stilo` command: `stilo render <file>` prints a rendered document (or writes it to a file); `stilo serve [folder]` starts the server on a folder. |
| Protocol | Plain HTTP between web app and server: GET a file, CREATE (POST), UPDATE (PUT, with an ETag so concurrent saves don't overwrite each other), QUERY a folder's tree. |
| Documentation | Developer documentation only, as plain Markdown in `docs/`, read on GitHub: architecture, setup, server, CLI, web app, editor, the protocol, the editor component and its API. No site is built. Users read the OnLabs.org manual instead. |

Web app, server and CLI ship as **one Python package**, `stilo`, with the
built web app inside it. On PyPI it is named `stilo-cli` (`pip install
stilo-cli`), because PyPI refuses `stilo` as too similar to an existing
project; the command is still `stilo`. The server stays independent of the CLI (a test
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
- 2026-10-27: **release 0.1.0 prepared**, not yet published: version set to
  0.1.0, changelog entry written, install instructions (README, getting
  started) changed to install from PyPI, under the name `stilo-cli`. The
  package can also be built without the web app, so the tests run in a
  fresh checkout; the release checks that the web app is in. A release
  workflow publishes the
  package on PyPI and creates the GitHub release whenever a version tag is
  pushed; it needs a one-time setup on PyPI and GitHub, then the tag
  `v0.1.0`.
- 2026-10-27: **0.1.0 released**: tagged `v0.1.0` and published on PyPI as
  `stilo-cli` (`pip install stilo-cli`).
- 2026-10-28: **documentation split**: the documentation site is gone (no
  build, no publishing workflow). The user pages (getting started, the web
  editor, the `stilo` command, the document format) were removed; users
  are pointed to the OnLabs.org manual, <https://www.onlabs.org/manual/>,
  from the README and the package's PyPI links. The developer pages stay
  in `docs/` as plain Markdown read on GitHub. Commit messages now state
  user-visible changes plainly.
- 2026-10-28: **Show source** (Alt+U): a command that shows the document's
  plain text, read-only, in place of the editor. The button that opens the
  commands pane is now a menu icon (⋮), the last one on the right of the
  top bar. The sample `examples/sample.texl` imports its library from the
  right folder and renders fully.
- 2026-10-30: **new document typography**, chosen among six options: text
  in Literata (a serif made for reading on screens), headings and table
  headers in Source Sans 3; tables ruled as in a printed report, with
  numbers lined up in columns; more room above titles; sub- and
  superscripts no longer open up the line. The fonts ship inside the
  package, so no network is needed. Pages that embed the editor can choose
  other fonts.
- 2026-10-30: **first table cell**: a table is stored as an ordinary
  Markdown table, formulas allowed in each table cell, and edited as a
  grid with one field per table cell (Tab moves on and adds a row at the
  end; buttons add and remove rows and columns). A Markdown cell holding a
  table can change to Table and back without loss. A prototype to try out
  this way of storing tables; the sample document uses it.
- Next: the table cell, beyond the prototype; a small editor API for the app (`runCommand`,
  `select(line)`).

## Known limitations

- No authentication: serve to localhost, or behind your own access control.
- The app drives editor commands with synthetic key presses and cannot
  select a line from the comments pane.
- Editor: if an imported document's rendering contains a marker with the
  same name as a later cell, the split into cells goes wrong (rare); a
  formula tag spanning two cells hides the later cell's output; links in
  rendered text to files other than documents resolve against the page, not
  the document; autocompletion of names must be redesigned.
- The editor is not published as a package of its own: pages that embed it
  use it from a copy of the source code.
- Table cell: plain fields without formula highlighting; column alignment
  is kept but cannot be changed in the grid.
