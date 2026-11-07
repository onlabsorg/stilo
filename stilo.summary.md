# stilo — summary

*What this repository is, how it is built and where it stands, in plain
words. The OnLabs.org coordination folder reads this file instead of the
code; keep it current as described in `CLAUDE.md`.*

Details: `CLAUDE.md` (stack, layout, commands), and the developer
documentation in `docs/` (the protocol is `docs/protocol.md`); the
decisions behind Stilo's design are logged in `DECISIONS.md`. The user
manual is the OnLabs.org manual, <https://www.onlabs.org/manual/>, outside
this repository.

## In one sentence

Stilo is the open-source editor for Texl documents: it edits a folder of
linked `.texl` files in the browser, as a stack of cells that feels familiar
to Word and Excel users, and renders them from the command line.

## Parts

| Part   | What                                                          |
|--------|---------------------------------------------------------------|
| Web app | The user interface (Lit web components, Vite): top bar, navigation pane with the folder's files and commands to manage them, the editor, right pane with commands, cell comments and errors. Light and dark theme. |
| Editor | Inside the web app: `<texl-editor>`, a document as a stack of typed cells (text, Markdown, table and formula; formulas as `<% %>` tags), live rendering, cell comments, errors shown where they happen. Until 2026-10-26 the separate `texl-editor` package. |
| Server | Python (FastAPI): serves one folder of documents and the web app, for one user. |
| CLI    | The `stilo` command: `stilo render <file>` prints a rendered document (or writes it to a file), says how many errors it has and can explain them; `stilo serve [folder]` starts the server on a folder. |
| Protocol | Plain HTTP between web app and server: GET a file, CREATE (POST), UPDATE (PUT, with an ETag so concurrent saves don't overwrite each other), QUERY a folder's tree, create a folder, move or rename a document or folder, delete a document or folder. |
| Documentation | Developer documentation only, as plain Markdown in `docs/`, read on GitHub: architecture, setup, server, CLI, web app, editor, the protocol, the editor component and its API. No site is built. Users read the OnLabs.org manual instead. |

Web app, server and CLI ship as **one Python package**, `stilo`, with the
built web app inside it. On PyPI it is named `stilo-cli` (`pip install
stilo-cli`), because PyPI refuses `stilo` as too similar to an existing
project; the command is still `stilo`. The server stays independent of the CLI (a test
checks it), so it can be reused or replaced on its own.

Each document has one URL, `/path/to/doc.texl`: a browser gets the web app,
`texl.import` gets the file. Any other file in the folder, such as an image or
a PDF, has its URL too and is served as itself. A link in a document to another
document opens it in the app; a link to another file or website opens in a new
tab. Imports with relative paths resolve from the document's own folder, the
same in the browser and on the command line, and are fetched again at every
rendering. Relative links in text shown from an imported document resolve from
the document showing it.

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
  headers in Source Sans 3; tables full width with equal columns, ruled
  as in a printed report, with numbers lined up in columns; more room above titles; sub- and
  superscripts no longer open up the line. The fonts ship inside the
  package, so no network is needed. Pages that embed the editor can choose
  other fonts.
- 2026-10-30: **first table cell**: a table is stored as an ordinary
  Markdown table, formulas allowed in each table cell, and edited as a
  grid with one field per table cell (Tab moves on and adds a row at the
  end; buttons add and remove rows and columns). A Markdown cell holding a
  table can change to Table and back without loss. A prototype to try out
  this way of storing tables; the sample document uses it.
- 2026-10-30: **changing a cell's type only offers types that fit**: the
  type menu greys out, with the reason ("Needs a table"), the types that
  cannot hold the cell's content, so changing type never alters it.
  Blank lines and comments never count against a type. A table or
  formula cell refuses an edit that would no longer fit, and says why.
  New **formula cell**: a line that is a single formula, edited as the
  expression alone (without the `<% %>`) and shown as its result. Table
  cells now accept blank lines and comments around and inside the table,
  and an empty one starts a new table.
- 2026-10-31: **type keys**: on a selected line, `=` makes it a formula
  cell and starts editing it, as `=` starts a formula in Excel; `t`, `m`
  and Shift+T do the same for text, Markdown and table. On a line of that
  type already, the key just starts editing. A line that cannot take the
  type stays as it is, with the reason shown, as in the type menu, which
  now shows each type's key. The developer documentation now covers the
  table and formula cells everywhere and links the decision log.
- 2026-10-31: **editor API**: the app now tells the editor what to do by
  naming a command ("insert a cell below", "undo", "make it a table", …)
  and can select a line, instead of imitating key presses. Each command
  does exactly what its key does. As a result, Copy, Cut, Paste, Commit
  and Discard work from the commands pane too (the browser may ask before
  pasting), and clicking a comment in the comments pane selects its line.
  Pages that embed the editor can use the same commands.
- 2026-10-31: **how tables are stored is settled**: a table stays an
  ordinary Markdown table, and each table cell is plain Texl text, with
  formulas between `<% %>` as anywhere else. Table cells cannot refer to
  each other, as spreadsheet cells do; a value needed elsewhere is given a
  name inside its formula.
- 2026-10-31: **table cell ready for use**: three buttons above the grid,
  as in Word, align a column left, centred or right, and the grid shows
  the alignment while editing. Each field shows its table cell's Texl
  text; outside editing the cell shows the rendered table. The table cell
  is no longer a prototype.
- 2026-11-04: **moved to Texl 0.5**, in the browser and on the command line.
  Formulas are stricter: text left over after an expression, such as a
  stray `)`, now makes the whole formula show `[[Undefined]]`, where it used
  to be ignored. A formula whose promise ends in an error also shows
  `[[Undefined]]`, where it used to show nothing. A document that shows the
  rendered text of an imported document now reads it as `text`, no longer
  `rendering`.
- 2026-11-05: **moved to Texl 0.6**, in the browser and on the command line.
  A broken link between documents is now visible: a formula whose import
  fails shows `[[Undefined]]`, where it used to show nothing. `stilo render`
  now says why a document cannot be loaded.
- 2026-11-05: **errors can be found and explained**, in the web editor and on
  the command line. An error is an undefined value that a formula returns,
  also as one of several values; one that is only given a name, or sits
  inside a list or namespace, does not count. In the editor each error is
  highlighted in its cell, with the reason when pointed at, the right margin
  shows how many a line has, and a new Errors pane lists them all, in plain
  words: what went wrong, the source line with the place marked, what caused
  it, and where it was made, also in an imported document, which a link opens.
  Positions read "Cell 3, line 12"; the comments pane now says "Cell 3" too.
  `stilo render` keeps its output as it was and adds one line saying how many
  errors there are; `--debug` numbers them in the output and explains each one,
  and `--strict` makes the command fail if there are any.
- 2026-11-05: **saving includes the cell being edited**: Ctrl+S now commits a
  cell in edit mode before saving, where its edit used to be left out of the
  file. If the cell refuses the edit, it stays open with its message and
  nothing is saved.
- 2026-11-06: **new key to insert a formula** while editing a cell: Ctrl+E
  (Cmd+E on macOS) instead of Ctrl+Space, which switches the keyboard's input
  source on macOS.
- 2026-11-07: **managing files and folders in the navigation pane**. A right
  click or a `⋯` button opens a menu on a document, a folder or the pane; the
  pane's header has buttons for a new document and a new folder, and the
  commands are also in the commands pane. New document, New folder, Rename, Move
  to, Duplicate (documents only), Copy link (relative to the open document),
  Open as root, Delete and Refresh. F2 renames and Delete deletes the item in
  focus. Names are typed in the tree, no longer in a browser dialog. Empty
  folders show by default and can be hidden. Renaming or moving warns that links
  to the item will stop working; if the open document is affected, Stilo offers
  to save first and keeps it open at its new address. Delete moves documents to
  a hidden `.trash` folder at the top of the served folder. Deleting a document
  leaves its folder; deleting a folder removes its documents, and the folder too
  unless other files remain in it.
- 2026-11-07: **cells and formulas always agree**: each cell's output now
  stays under its own cell, even when an imported document or a formula
  outputs text that looks like another cell's marker. A formula can no longer
  run across cells. Leaving a formula open above a later one, or a paste or
  move that would cause this, is refused with a message naming both lines. A
  file already in that state opens with those cells merged into one and is not
  changed; closing the formula separates them again. A marker line typed in a
  cell makes a new cell when you leave it. File format: a marker line inside a
  formula is not a marker.
- 2026-11-07: **links to other files work**: a relative link or image in a
  document can point to an image, a PDF or any other file in the folder. A PDF
  link used to show an empty Stilo and an SVG image did not show. Clicking a
  link to a file or a website opens a new tab, so the document stays open.
  Files of unknown type download. HTML, XML and SVG files opened by their
  address are sandboxed, so they cannot run scripts on Stilo's address.

## Known limitations

- No authentication: serve to localhost, or behind your own access control.
- Editor: autocompletion of names must be redesigned; plain text cannot hold a literal `<%` above a later formula, as
  the formula's `%>` would close it (the editor refuses this, and says why).
- The editor is not published as a package of its own: pages that embed it
  use it from a copy of the source code. On a page whose address differs from
  its document's, links in rendered text resolve against the page.
- Links: a link to a file that does not exist opens an empty Stilo in the new
  tab, not a "file not found" page. Images and other files can only be added to
  the folder outside Stilo, and their links typed by hand.
- Files and folders: renaming or moving does not update links to the item;
  documents are got back from `.trash` by hand, as there is no restore command.
- Table cell: plain fields without formula highlighting.
- Errors: a value inside a link's address or another HTML attribute counts but
  cannot be highlighted. The failing place is marked in the Errors pane, not
  in the source while editing.
