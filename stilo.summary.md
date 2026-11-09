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
| Web app | The user interface (Lit web components, Vite): top bar, navigation pane with all the folder's files (documents, and other files greyed out) and commands to manage and upload them, the editor, right pane with commands, cell comments and errors. Light and dark theme. |
| Editor | Inside the web app: `<texl-editor>`, a document as a stack of typed cells (rich text, the default; text, Markdown, table, formula and data table; formulas as `<% %>` tags; LaTeX equations in Markdown and tables), live rendering, cell comments, errors shown where they happen. Until 2026-10-26 the separate `texl-editor` package. |
| Server | Python (FastAPI): serves one folder of documents and the web app, for one user. |
| CLI    | The `stilo` command: `stilo init [folder]` makes a folder a project, with the Stilo library in it; `stilo render <file>` prints a rendered document (or writes it to a file), says how many errors it has and can explain them; `stilo serve [folder]` starts the server on a folder; `stilo tutor` opens the tutorial. |
| Stilo library | A folder of Texl documents (`texl-lib/`) that `stilo init` copies into each project, for documents to import. Its first function, `stilo.dataframe`, makes a table of data; it is what the data table cell writes. Tested on both Texl engines, the browser's and Python's, with the same cases. |
| Tutorial | A guided tutorial for new users (`tutorial/`), Texl documents shipped in the package and served by `stilo tutor` in the web app: twelve short lessons (30–45 minutes) on the editor and the command line, from the first edit to one's own project, and two advanced ones. Many exercises check themselves and show "✓ Done"; an index shows the progress. The lessons link to the OnLabs.org manual instead of repeating it. Tested automatically, exercises included. |
| Protocol | Plain HTTP between web app and server: GET a file, CREATE (POST), UPDATE (PUT, with an ETag so concurrent saves don't overwrite each other), QUERY a folder's tree (every file), create a folder, move or rename a file or folder, delete a file or folder. Any file can be created, so files can be uploaded; only documents can be updated. |
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

A **project** is a folder with a `project.texl` file (the project's name and
the Stilo version that created it). Its libraries live in its `lib/` folder,
so the project works as a whole wherever it is copied. In an import, `~`
stands for the project's folder, so `~/lib/stilo/index.texl` works from any
document of the project, in the browser and on the command line. There is no
package manager: libraries are copied or cloned in by hand.

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
- 2026-11-07: **0.2.0 released**: tagged `v0.2.0` and published on PyPI as
  `stilo-cli`, with all the changes since 0.1.0 listed above.
- 2026-11-07: **equations in Markdown and table cells**: LaTeX between `$...$`
  in the text, or `$$...$$` on lines of their own, is typeset when you leave the
  cell, in the browser and with fonts inside the package. A formula inside an
  equation shows its value. Amounts of money such as `$5 and $10` stay text, and
  `\$` is a plain dollar. Bad LaTeX shows in red with the reason; an equation
  with an undefined value shows as its source, with the value highlighted. The
  file format does not change: `stilo render` returns the LaTeX as text. The
  sample documents use equations, and the link to the library in
  `examples/sample.texl` now works.
- 2026-11-07: **rich text cell, the default for new cells**: text is edited as
  in Word, on the same typography as the output, with a toolbar and Word's keys
  for bold, italic, underline, headings, lists and links. Formulas show as chips
  with their value, the expression on hover and in a small field on a click; one
  with no output shows a small ƒ. Equations are typeset while editing, with a
  preview when changed. Shift+F2 adds a comment. Pasting keeps the supported
  formatting. File format: the source is the same Markdown as a Markdown cell's,
  under the new type `rich`, so the two change into each other with nothing
  converted, and only the changed paragraphs differ in the file. A cell with raw
  HTML or a table cannot be rich text, and the type menu says why. Arrow keys
  stay in the cell while editing.
- 2026-11-07: **a click on another line commits the cell being edited**, in every
  cell type, as in Excel; a cell that refuses its edit stays open and says why. A
  double click on another line could lose the edit; it no longer does.
- 2026-11-08: **moved to Texl 0.7**, in the browser and on the command line.
  A formula that gives a namespace with a `__text__` function now shows the
  text that function returns, so a value can be shown as a label and still be
  used as data.
- 2026-11-08: **projects and libraries**: `stilo init` makes a folder a
  project: it writes `project.texl` and copies the Stilo library into
  `lib/stilo/`. In an import, `~` stands for the nearest folder with a
  `project.texl` (a library with its own `project.texl` is its own project);
  without one, it is the served folder in the browser and the user's home
  folder on the command line. Folders named `~` are hidden in the navigation
  pane and cannot be created there. The Stilo library holds a placeholder
  function only. The package and its automatic checks include the library.
- 2026-11-09: **moved to Texl 0.8**, in the browser and on the command line.
  A path with `~` now leads to the real file: the server sends a redirect to
  it, and `stilo render` reads it the same way. A library imported through
  `~` is thus one document, at its own place: imported from several folders,
  it is loaded once; its own imports resolve from its folder; and a library
  that imports itself through `~` is stopped at once.
- 2026-11-09: **data table cell and the first library function**. A new
  cell type, Data table (key `d`), holds a table of values that other cells
  can compute with: an optional name, column names in plain text, and in
  each field a value written as a formula (`120`, `"ULS-1"`, `1.35 * Fx`;
  text needs quotes, an empty field is empty). Outside editing it shows the
  computed table, numbers aligned right and a bad value as `[[Undefined]]`
  in its own cell. A value that is not a valid formula is outlined while
  typing, and the cell cannot be committed until it is corrected. Rows and
  columns can be inserted and deleted anywhere; the values do not refer to
  each other. With a name such as `loads`, other cells read the data as
  `loads.column "Fx (kN)"` or `loads.row 0`. File format: the cell stores
  one formula calling `stilo.dataframe` from the Stilo library, one row per
  line, so the document renders with `stilo render` too. When the first data
  table is written, the editor adds a line at the top that imports the
  library from the project (`~/lib/stilo/index.texl`). The library's main
  document is now `index.texl`, and the placeholder function is gone. The
  beam example is now a project, with the library and a table of load
  combinations. The table and data table cells share their grid editing.
- 2026-11-09: **hidden cells**, as hidden rows in Excel: commands hide the
  selected cells, unhide the hidden ones inside a selection, and show them
  all greyed out (a view setting, not saved). A hidden cell still computes in
  its place and keeps its line number; the numbers skip it and a double rule
  shows where it is. The arrow keys skip hidden lines, and going to one from
  the errors or comments pane shows them. File format: the cell's marker ends
  with `| hidden`; other Texl programs read it as a comment. The line that
  imports the Stilo library for a data table is now added hidden.
- 2026-11-09: **0.3.0 released**: tagged `v0.3.0` and published on PyPI as
  `stilo-cli`, with all the changes since 0.2.0 listed above.
- 2026-11-09: **tutorial**: `stilo tutor` copies the tutorial into the user's
  data folder (or another, with `--dir`), makes the copy a project, serves it
  and opens its index in the browser. Later runs reopen the copy as it was
  left; `--reset` starts from a fresh copy and moves the old one aside, never
  deleting it; a copy made by an older Stilo is reported, with `--reset`
  proposed, and never overwritten. Each exercise that Texl can see checks
  itself; the others are steps to try. Every lesson, and every exercise with
  its solution, is checked by the automatic tests, and a change visible to
  users must now update its lesson in the same commit. New dependency:
  `platformdirs`. Not yet released.
- 2026-11-09: **new document typography**, after an engineering report the
  founder liked, replacing the one of 2026-10-30: one font, Atkinson
  Hyperlegible Next (wide and very legible, in the spirit of Verdana), for
  text, headings and tables; paragraphs justified; tables full width with a
  small margin on each side, columns sized by their content, strong rules
  above and below, a thin rule under the header and light lines between
  rows. Equations are now about the size of the text around them, no longer
  larger. The font ships inside the package, so it works offline. Not yet
  released.
- 2026-11-09: **table captions**: a line `<caption>…</caption>` written
  right after a table in a Markdown line shows below the table,
  left-aligned. Plain HTML, no new syntax; lesson 6 of the tutorial shows
  it. Not yet released.
- 2026-11-09: **the beam example reads as an engineering report**: a short
  design report (introduction, scope of work, basis of design, method
  statement, results, conclusions, recommendations) that links to two
  detail documents of the same project, a basis of design and a
  calculation note, and takes its figures from them; its conclusions and
  recommendations are computed, so they follow any change in the data. It
  shows how linked documents replace a long report. The automatic tests now
  check that every example renders without errors and opens in the editor
  as written.
- 2026-11-09: **the navigation pane shows every file**: images, PDFs, data
  and any other file appear beside the documents, greyed out, and so do
  folders that hold only such files; empty folders look normal. Clicking one
  opens it in a new browser tab. **Show other files**, in the pane's menu,
  hides them; "Show empty folders" is gone. **Upload files…**, on folders and
  in the pane's menu, adds files from the computer through the browser's
  file dialog, several at a time; a name already taken is skipped and
  reported. Other files can be renamed, moved, deleted and their link
  copied, like documents; a rename cannot add or remove `.texl`. **Deleting
  a folder now deletes everything in it**, other files included, into
  `.trash`, and the folder is always gone; the question says how many
  documents and other files go with it. Lessons 1, 8 and 10 of the tutorial
  teach it. Not yet released.
- 2026-11-09: **moved to Texl 0.9**, in the browser and on the command line.
  Nothing changes for users. The Stilo library's data tables now use Texl's
  new text templates to write their table, which shows exactly as before.
  Not yet released.
- 2026-11-09: **Ctrl+C stops `stilo serve` and `stilo tutor` cleanly**, with
  a goodbye message instead of an error report; `stilo serve` says at start
  how to stop it. Not yet released.

## Known limitations

- No authentication: serve to localhost, or behind your own access control.
- Editor: autocompletion of names must be redesigned; plain text cannot hold a literal `<%` above a later formula, as
  the formula's `%>` would close it (the editor refuses this, and says why).
- The editor is not published as a package of its own: pages that embed it
  use it from a copy of the source code. On a page whose address differs from
  its document's, links in rendered text resolve against the page.
- Links: a link to a file that does not exist opens an empty Stilo in the new
  tab, not a "file not found" page.
- Files and folders: renaming or moving does not update links to the item;
  deleted files are got back from `.trash` by hand, as there is no restore
  command. Upload is through the file dialog only (no drag and drop) and never
  replaces an existing file.
- Table cell: plain fields without formula highlighting; it cannot hold a
  caption (only a Markdown line can).
- Data table cell: a value or column name cannot contain `"` or `%>`; a
  wrong value inside a table is shown but not listed in the Errors pane;
  outside a project the table shows `[[Undefined]]`.
- Hidden cells: no keys for hiding and unhiding, only commands.
- Rich text cell: no colours, fonts or alignment; repeated empty paragraphs
  collapse; images are shown and kept but cannot be inserted; a comment can be
  added but not edited; a new or changed formula shows its expression, not its
  value, until the cell is committed; the toolbar moves the text down a line when
  editing starts. Tried in Chrome; ProseMirror, the library under it, also in
  Firefox and Linux WebKit; not on Safari on a Mac.
- Equations: in a table, a `|` inside an equation ends the table cell (write
  `\vert`). Only the editor typesets them: other outputs show the LaTeX as text.
- Tutorial: the index counts only saved lessons; changed lessons reach an
  existing copy only after `stilo tutor --reset`; no reset from the web app.
- Projects: other Texl programs do not understand `~` in imports.
- Errors: a value inside a link's address or another HTML attribute counts but
  cannot be highlighted. The failing place is marked in the Errors pane, not
  in the source while editing.
