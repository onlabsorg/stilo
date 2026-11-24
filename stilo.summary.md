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
| Web app | The user interface (Lit web components, Vite): top bar, navigation pane with all the folder's files (documents, and other files greyed out) and commands to manage and upload them, the editor, right pane with commands, errors and cell comments, opened from a narrow bar of buttons at the right edge of the window (the panel rail); the top bar holds the other buttons. Light and dark theme. |
| Editor | Inside the web app: `<texl-editor>`, a document as a stack of typed cells (rich text, the default; text, Markdown, table, formula, data table and chart; formulas as `<% %>` tags; LaTeX equations in Markdown and tables), live rendering, cell comments, errors shown where they happen. Until 2026-10-26 the separate `texl-editor` package. |
| Server | Python (FastAPI): serves one folder of documents and the web app, for one user. |
| CLI    | The `stilo` command: `stilo init [folder]` makes a folder a package, with the Stilo library in it (run again in a package, it only adds the library if missing); `stilo pack [folder]` packs a package into one `.texlz` file; `stilo render <file>` prints a rendered document (or writes it to a file), says how many errors it has and can explain them; `stilo serve [folder]` starts the server on a folder; `stilo tutor` opens the tutorial. |
| Stilo library | A package of Texl documents (`texl-lib/`) that `stilo init` puts into each package's references as one packed file, `references/stilo.texlz`, for documents to import. `stilo.dataframe` makes a table of data, which the data table cell writes; `stilo.charts.line` draws a line chart as an image, which the chart cell writes. Tested on both Texl engines, the browser's and Python's, with the same cases. |
| Tutorial | A guided tutorial for new users (`tutorial/`), Texl documents shipped in the package and served by `stilo tutor` in the web app: twelve short lessons (30–45 minutes) on the editor and the command line, from the first edit to one's own package, and two advanced ones. Many exercises check themselves and show "✓ Done"; an index shows the progress. The lessons link to the OnLabs.org manual instead of repeating it. Tested automatically, exercises included. |
| Protocol | Plain HTTP between web app and server: GET a file, CREATE (POST), UPDATE (PUT, with an ETag so concurrent saves don't overwrite each other), QUERY a folder's tree (every file), create a folder, move or rename a file or folder, delete a file or folder. Any file can be created, so files can be uploaded, and any file can be updated, so extensions can keep their own data (a JSON file, say) in the folder. Reading a folder or a packed package leads to its `index.texl`; `?download` after an address downloads the file itself. |
| Documentation | Developer documentation only, as plain Markdown in `docs/`, read on GitHub: architecture, setup, server, CLI, web app, editor, the protocol, the editor component and its API. No site is built. Users read the OnLabs.org manual instead. |

Web app, server and CLI ship as **one Python package**, `stilo`, with the
built web app inside it. On PyPI it is named `stilo-cli` (`pip install
stilo-cli`), because PyPI refuses `stilo` as too similar to an existing
project; the command is still `stilo`. The server stays independent of the CLI (a test
checks it), so it can be reused or replaced on its own.

The web app's source, the editor included, is also prepared as an **npm
package**, `@onlabsorg/stilo-web`, for developers who build their own front
end or embed the editor, published on npm since 0.5.0. It has the same version
as the Python package; only its three entry points (the whole app, the
editor and the theme) are its public interface, and before 1.0 any version
may change them. The web app can be extended without changing its
code: extensions add commands (also in the menu on a cell), panels,
pages, marks on cells and more;
the server and the `stilo` command can be extended too, by separate
Python packages (see Status).

Each document has one URL, `/path/to/doc.texl`: a browser gets the web app,
`texl.import` gets the file. Any other file in the folder, such as an image or
a PDF, has its URL too and is served as itself. A link in a document to another
document opens it in the app; a link to another file or website opens in a new
tab. Imports with relative paths resolve from the document's own folder, the
same in the browser and on the command line, and are fetched again at every
rendering. Relative links in text shown from an imported document resolve from
the document showing it.

A **package** is a folder with a `package.texl` file (the package's name and
the Stilo version that created it): a bundle of Texl files that belong
together. Until 2026-11-18 it was called a project, with a `project.texl`.
A subfolder with its own `package.texl` is a separate package. The packages
a package uses, its *references* (as a library is to software), live in its
`references/` folder (called `lib/` until 2026-11-18), so the package works
as a whole wherever it is copied. In an import, `~` stands for the package's
folder, so `~/references/stilo.texlz/index.texl` works from any document of the
package, in the browser and on the command line. There is no package
manager: references are copied or cloned in by hand. Importing a folder or
a packed package by itself (`~/references/steel-revA.texlz`) imports its
main document, `index.texl`.

A **packed package** is a package stored as one zip file named `*.texlz`,
to share as one file, as a Word file is; a reference can be one, and the
Stilo library now is. Stilo opens it as a folder that cannot be changed,
in the browser and on the command line alike, packed packages inside it
included: its documents open read-only, imports reach into it, and the
file itself can be uploaded, renamed, moved, deleted and downloaded.
`stilo pack` makes one, giving the same bytes for the same files, so a
packed package can be identified by its fingerprint (hash).

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
  `platformdirs`.
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
  it.
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
  teach it.
- 2026-11-09: **moved to Texl 0.9**, in the browser and on the command line.
  Nothing changes for users. The Stilo library's data tables now use Texl's
  new text templates to write their table, which shows exactly as before.
- 2026-11-09: **Ctrl+C stops `stilo serve` and `stilo tutor` cleanly**, with
  a goodbye message instead of an error report; `stilo serve` says at start
  how to stop it.
- 2026-11-10: **chart cell**. A new cell type, Chart (key `c`), draws a line
  chart, for example of two columns of a data table, across the width of
  the page, in the colours of the light or dark theme. It is edited as a
  **form**: a fixed line per setting, a description on the left and a box or
  drop-down on the right: the chart type (only Line for now), the X and Y
  values (formulas that give a list of numbers, such as
  `loads.column "x (m)"`), the axis labels and the title (plain text,
  optional). Wrong formulas are outlined while typing, and X and Y must be
  filled in before the cell is committed. Points that are not numbers are
  left out. Axes run between round numbers. File format: the cell stores
  one formula calling `stilo.charts.line` from the Stilo library, which
  returns the chart as an SVG image, so `stilo render` shows it too; the
  first chart adds the import of the library, as a data table does. The
  form is a shared part, meant for future cells that set a few named
  values. The beam example has a bending-moment diagram; lesson 7 of the
  tutorial shows charts. Existing projects need their copy of the library
  refreshed to use charts.
- 2026-11-10: **the app itself is now tested**, with a few quick smoke
  tests: a headless browser runs against `stilo serve` and opens a
  document, edits and saves it, reloads it, and opens another document
  from the navigation pane; any error the page reports fails them. The
  continuous integration runs them against the installed package. Nothing
  changes for users.
- 2026-11-10: **tab icon**: the browser tab of Stilo shows the OnLabs.org
  mark (two concentric circles, the outer one with a sharp corner at the
  bottom left), in Stilo's blue with an orange centre.
- 2026-11-10: **0.4.0 released**: tagged `v0.4.0` and published on PyPI as
  `stilo-cli`, with all the changes since 0.3.0 listed above.
- 2026-11-13: **moved to Texl 0.10**, in the browser and on the command
  line. Formulas are stricter: a syntax error anywhere in a formula makes
  the whole formula show as an error (before, part of it could still work
  or a list could silently lose an item), and endless recursion shows an
  error instead of crashing. Data tables already check each value as it is
  typed, so they are not affected.
- 2026-11-17: **npm package prepared**: the web app and its editor are set up
  as the npm package `@onlabsorg/stilo-web`, with the editor's guide now
  installing it from npm instead of a copy of the source. An automatic check
  packs the package, installs it in a small test project and builds it, on
  every push. The release workflow will publish it on npm together with the
  PyPI package at the next version tag, once npm has been set up for it
  (a one-time step); nothing is published yet.
- 2026-11-17: **web app reorganised inside**, the first part of a larger
  rework: the commands, keyboard shortcuts, menus, the status message, the
  open pane, the right pane's panels, the document's errors and cell
  comments, the open document itself (opening, saving, reloading, unsaved
  changes), the browser address and the navigation pane's folder tree are
  now kept in shared building blocks ("services") that every part of the
  window reads, instead of in the app shell, which now only lays out the
  window. Stilo's own commands, including those that manage files and
  folders, use only these services. Nothing visible changes, except that a shortcut no
  longer runs when extra modifier keys are held (Alt+Shift+N used to act as
  Alt+N).
- 2026-11-17: **extensions, first part** (for developers): the web app can
  be started with extensions, small add-ons written by others that plug
  into the services above without changing Stilo's code. An extension
  that is broken or written for another version is skipped and reported,
  and the app goes on; switching one off removes everything it added. So
  far an extension can add commands, shortcuts, menu entries and right-pane
  panels, and follow what happens in the app; more ways to extend Stilo
  follow in the next steps. Nothing changes for users.
- 2026-11-17: **extensions, second part**: an extension can also add items
  to the top bar and to a status line at the bottom of the window (as in
  Word; the line appears only when an extension puts something in it), and
  replace one of the right pane's panels with its own. The commands pane
  lists the active extensions, and those that failed, but only when there
  are any. Nothing changes for users without extensions.
- 2026-11-17: **extensions, third part**: an extension can now pass every
  request to the server through its own code, imports between documents
  included (for example to add sign-in details, or to send the user to a
  login page). The editor component gained a read-only mode, in which a
  document can be viewed, selected and copied but not changed, and it
  now lists its own commands with their names and keys, which Stilo's
  commands pane shows. The only visible change: in the commands pane the
  "Make it …" commands now follow the order of the cell type menu.
- 2026-11-17: **extensions, fourth part**: an extension can mark files and
  folders as read-only, put small badges and hover text on items of the
  navigation pane, and hide items there. A read-only document opens
  read-only, with "Read-only" and the reason in the top bar, and cannot be
  saved, renamed, moved or deleted; nothing can be added to a read-only
  folder. Commands that do not apply at the moment are greyed out in
  menus and in the commands pane, with the reason. Nothing changes for
  users without extensions.
- 2026-11-17: **extensions, fifth part**: an extension can add pages that
  are not documents, such as a dashboard, each at its own web address and
  shown in place of the editor; they can be bookmarked, the back button
  works, and links to them open them in the app. Nothing changes for users
  without extensions.
- 2026-11-17: **extensions, sixth part**: an extension can add comments
  from outside the document (for example from an issue tracker or a
  review), shown in the comments pane under the document's own, with where
  they come from, who wrote them and when, and counted in the margin of
  the cells they belong to; they stay with their cell when it moves. It
  can also put short marks on cells, such as a checker's findings.
  Nothing changes for users without extensions.
- 2026-11-17: **questions in Stilo's own dialogs**: Stilo now asks before
  deleting, discarding unsaved changes, renaming or saving first in a
  dialog of its own, in the app's colours, with buttons that say what they
  do (Delete, Discard, Save, Rename); Enter answers yes, Escape no. Leaving
  the page with unsaved changes is still asked by the browser. The
  tutorial says so. **Extensions, seventh part**: an extension can show
  dialogs and ask questions in the same style, show a status message as a
  warning or an error, and keep its own settings in the browser.
- 2026-11-17: **extensions for the web app complete**: an extension can
  also add a cell type of its own; the npm package offers what a
  developer needs to start Stilo with extensions or to build a different
  front end from its parts. A developer guide (`docs/extensions.md`)
  describes every way to extend the web app, with a sketch of ten example
  extensions (word count, checker, version history, read-only folders, a
  server behind a login, outside comments, export to PDF, a dashboard, a
  custom cell type, a replaced panel), and an automatic test exercises
  all of them at once. The server and command-line sides of extensions
  are not built yet. Nothing changes for users without extensions.
- 2026-11-17: **protocol version 1 written down**: the
  rules between the web app and a server now also say how a server
  describes itself and what it can do, where server extensions put their
  own addresses, how it marks files and folders that cannot be changed,
  and how it asks the user to sign in or refuses a request with a reason.
  Everything from version 0 stays as it was. Stilo's server and web app
  follow in the next steps.
- 2026-11-17: **protocol version 1 built** in Stilo's server and web app.
  The server says what it is and what it can do, and keeps a place for
  the addresses of server extensions (none yet). Files and folders the
  server has no permission to write on its computer are now read-only in
  Stilo: they show a lock, such a document opens read-only with the
  reason in the top bar, and it cannot be saved, renamed, moved or
  deleted (before, saving it failed with a server error). The web app
  greys out what a server cannot do, shows the reason when a server
  refuses a change, and when a server asks for a login, offers to go to
  its sign-in page.
- 2026-11-18: **protocol: server extensions describe themselves**: in
  what a server says about itself, each server extension can give its
  version and what it can do, and its addresses answer errors the same
  way as the rest of the server. Groundwork for the server and
  command-line sides of extensions; nothing changes for users.
- 2026-11-18: **the server can keep documents anywhere**: a developer can
  give Stilo's server any store of documents that answers the same few
  operations (read, save, create, move, delete, list), not only a folder
  on disk, and can wrap the folder to act on every change (for example,
  record a version after each save). The folder on disk stays the
  default. Nothing changes for users.
- 2026-11-18: **server extensions**: a developer can now add to Stilo's
  server, without changing it, an extension with its own addresses (for
  example, one that lists a document's earlier versions or returns a PDF),
  that can also act on every change to the documents; the server lists
  its extensions when asked what it can do. Something can also be put in
  front of the whole server, such as a sign-in check. Stilo's own `stilo
  serve` has no extensions; nothing changes for users.
- 2026-11-18: **the server's public parts named**: the server now lists
  the parts other developers may rely on (for extensions, other kinds of
  storage, or another server that must behave like Stilo's: how files are
  typed and kept from running scripts, and how `~` is resolved), and an
  automatic test keeps that list from changing by accident. Nothing
  changes for users.
- 2026-11-18: **`stilo` commands from other packages**: a package
  installed beside Stilo can add its own commands to the `stilo` command
  line (for example `stilo pdf`), listed in `stilo --help` after Stilo's
  own. A broken add-on, or one that takes the name of an existing
  command, is skipped with a warning, and Stilo's own commands always
  keep their names. The command line also lists the parts add-ons may
  rely on. Nothing changes for users without add-ons.
- 2026-11-18: **extensions on every side, documented and tested**: the
  developer guide now covers the server and command-line sides of
  extensions as well as the web app, and an automatic test writes two of
  the example extensions (version history, export to PDF) as separate
  add-on packages that use only the parts Stilo names as public. Add-ons
  for the server still have to be started by their own command: `stilo
  serve` does not pick them up by itself yet.
- 2026-11-18: **0.5.0 released**: tagged `v0.5.0`, published on PyPI as
  `stilo-cli` and, for the first time, on npm as `@onlabsorg/stilo-web`
  (by hand), with all the changes since 0.4.0 listed above.
- 2026-11-18: **0.5.1 released**: tagged `v0.5.1`. Releases now publish
  the npm package automatically, and PyPI only after npm, so a failed
  publish leaves no half-released version. A test checks that the
  server reports the package's version. Nothing changes for users.
- 2026-11-18: **projects renamed packages**: a folder with a `package.texl`
  is now a *package* (it was a *project*, with a `project.texl`); `~` in
  imports stands for it, and `stilo init` writes `package.texl`. An
  existing `project.texl` is no longer read and must be renamed by hand.
  `stilo tutor` still recognises an old copy of the tutorial and proposes
  starting again. The example moved to `examples/packages/beam/`, and
  lesson 12 of the tutorial is now "Your first package".
- 2026-11-18: **libraries renamed references**: the packages a package
  uses are now its *references*, in a `references/` folder (it was
  `lib/`); `stilo init` copies the Stilo library into `references/stilo/`,
  and data tables and charts import it from there. An old `lib/` folder is
  not read or warned about: it must be renamed by hand, and `~/lib/`
  changed to `~/references/` in imports. The changelog explains how to
  move a folder made with 0.5 in one go (both renames). The tutorial and
  the example follow; lesson 14 is now "Your own references". Ships with
  the package rename in the same version.
- 2026-11-18: **0.6.0 released**: tagged `v0.6.0`, with the two renames
  above (projects to packages, libraries to references).
- 2026-11-19: **default port 8010**: `stilo serve` and `stilo tutor` now
  listen on port 8010 unless told otherwise (it was 8000, often taken by
  other programs); the tutorial and the documentation follow. Not
  released yet.
- 2026-11-19: **packed packages**: a package can be one file, a zip named
  `*.texlz` with its `package.texl` at the root. Stilo shows it in the
  navigation pane as a folder with its own icon and a lock; its documents
  open read-only and the commands that change files are greyed out inside
  it, while the file itself can be uploaded, renamed, moved, deleted and,
  with the new **Download** command (also on other files), saved to the
  computer. Imports reach into it, its own relative imports and `~`
  resolve inside it, and packed packages nested in it work too, the same
  in the editor and in `stilo render`. Archives are treated as untrusted:
  they are read in memory, never unpacked to disk, and refused if they
  hold dangerous names or links or are too large once unpacked. **`stilo
  pack [folder] [-o file]`** makes one and prints its fingerprint; the
  same files always give the same bytes, and hidden files (such as
  `.git/`), links and files git ignores are left out. The server's
  developers can make packed packages with the same function the command
  uses.
- 2026-11-19: **the Stilo library is packed**: `stilo init` and `stilo
  tutor` now put it into a package as `references/stilo.texlz`, and data
  tables and charts import `~/references/stilo.texlz/index.texl`. Run in a
  folder that is already a package, `stilo init` no longer refuses: it
  leaves `package.texl` alone and adds the library if it is missing, which
  is how a package made before moves over (its imports are then changed by
  hand from `~/references/stilo/`). Lessons 7, 10, 12 and 14 of the
  tutorial follow.
- 2026-11-19: **a folder or a packed package imports its `index.texl`**:
  importing `~/references/steel-revA.texlz`, or a folder as
  `~/references/steel/`, imports its main document, whose own imports
  resolve from its folder, in the editor and in `stilo render` (which
  also accepts a folder or a `.texlz` file). The protocol says so (a
  folder answered an error before), and `?download` after a file's
  address downloads it. The examples gain a small steel package, packed as
  `steel-revA.texlz` into the beam package, which now imports its steel
  data from it. Not released yet.
- 2026-11-19: **0.7.0 released**: tagged `v0.7.0`, with the default port
  8010, packed packages and `stilo pack`, the packed Stilo library and
  folder imports above.
- 2026-11-20: **fix: the library packed empty**: installed inside a
  project's git-ignored folder (such as a virtual environment), `stilo
  init` wrote an empty `references/stilo.texlz`, so imports of the library
  failed; the library is now always packed in full. **`stilo pack` and git's
  ignore rules**: a package inside a folder its repository ignores is
  packed by the ignore files inside the package only, instead of being
  emptied; outside any repository, the package's own ignore files now
  count too. Packing refuses a package whose `package.texl` would be left
  out, instead of writing a file that cannot be opened. Not released yet.
- 2026-11-20: **fix: extension panels made of several parts** (a heading,
  then the content) were spread over the whole height of the right pane;
  they now start at the top and the pane scrolls. Stilo's own panels look
  as before. Not released yet.
- 2026-11-20: **any file can be updated**: the server now saves changes to
  files that are not documents too (only documents before), with the same
  protection against overwriting someone else's change, so an extension
  can keep its data in the folder as an ordinary file. The server says it
  can do this, so extensions can check before relying on it. The editor
  itself still edits only documents. Not released yet.
- 2026-11-20: **a save that did not happen stands out**: "Not saved" in
  the top bar is now coloured, as a warning when it can be fixed in the
  editor (a read-only document, a cell to correct) and as an error when
  the server refused the save or could not be reached; it looked like
  "Saved" before. Not released yet.
- 2026-11-20: **extensions know the server from the start**: the web app
  now asks the server what it can do, and which server extensions it has,
  before it starts the extensions, so an extension can check for its
  server part as it starts (it was told "none" before). It asks once.
  Signing in is unchanged for the user. Not released yet.
- 2026-11-20: **an extension's badges go with it**: a count an extension
  shows on a panel button, Stilo's own included (on Comments, say), is
  now taken away when the extension is turned off; it stayed before. A
  badge set by Stilo since stays. Not released yet.
- 2026-11-20: **extensions know the selected cell**: the editor now tells
  which cell is selected, by its name, not only which line, so an
  extension can attach a comment or a mark to the cell the user chose.
  Not released yet.
- 2026-11-20: **the document as rendered, for extensions**: the editor
  now gives the whole document as it shows it, ready for an export or a
  print (an extension that makes a PDF, say), cleaned of anything unsafe,
  hidden cells left out. Cell types and the export share one way of
  turning a cell's result into a page, so an export looks like the
  editor. Not released yet.
- 2026-11-20: **the panel rail**: the buttons that open the right pane's
  panels moved from the top bar to a narrow bar at the right edge of the
  window, always shown: Commands (now with a list icon), Errors (with the
  number of errors) and Comments, from the top. The open panel's button
  shows as pressed. The top bar keeps only buttons that do something else,
  which extensions add, so the two kinds no longer look alike. Keys are
  unchanged; extensions need no change. Lessons 1 and 9 of the tutorial
  follow. Not released yet.
- 2026-11-20: **0.8.0 released**: tagged `v0.8.0`, with the changes of
  2026-11-20 above (any file can be updated, the panel rail, the
  extension hooks and the fixes).
- 2026-11-22: **a product's own name in the top bar**: an extension can
  show its own name, a link to its home page for example, at the top left
  in place of "Stilo", so a product built on Stilo (or anyone embedding
  it) carries its own name there. "Stilo" comes back when the extension is
  turned off. Nothing changes for users without extensions.
- 2026-11-22: **0.9.0 released**: tagged `v0.9.0`, published on PyPI and
  npm, with the top-bar brand above.
- 2026-11-24: **a menu on a cell**: a right click on a cell (or the menu
  key) selects it and opens a menu, as in Excel: Edit, Change the cell
  type, Cut, Copy, Paste, Insert a cell above or below, Delete, Show the
  cell's comments. In a read-only document (a packed package) the entries
  that would change it are greyed out, with the reason. Lesson 2 of the
  tutorial mentions it. Not released yet.
- 2026-11-24: **hooks for notes and threads on a release** (for
  developers; for Papiro's Threads panel, OnLabs D25): an extension can
  put its own commands in the menu on a cell, read-only documents
  included; know which document and cell are selected; go to a cell by
  its name, in any document or packed package; ask the user for a short
  rich text, written with the rich text cell's own editor; show a Texl
  document that is not open, rendered as Stilo renders it; and find the
  packed package a document is in and its SHA-256, which identifies a
  release. In a read-only document, a cell without a name in the file no
  longer gets a made-up one that could not be found again. An example
  extension, notes with a status on the cells of a packed package in a
  panel of their own, shows them at work and is tested. Not released yet.
- 2026-11-24: **no more comments from outside the document**: extensions
  can no longer add comments to the comments pane (the sixth part of
  2026-11-17). The comments pane and the comment count in the margin show
  only the document's own comments. Notes, threads or issues kept
  elsewhere are shown by an extension in a panel of its own, with marks
  on their cells, as the example above does. Not released yet.

## Known limitations

- No authentication: serve to localhost, or behind your own access control.
- Editor: autocompletion of names must be redesigned; plain text cannot hold a literal `<%` above a later formula, as
  the formula's `%>` would close it (the editor refuses this, and says why).
- Server extensions are not loaded by `stilo serve` from installed
  packages: an add-on with a server part comes with its own command to
  serve a folder, and its web part in a front end built for it.
- The npm package `@onlabsorg/stilo-web` needs Vite (or a similar bundler)
  to build. On a page whose address differs from its document's, links in
  rendered text resolve against the page.
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
  outside a package the table shows `[[Undefined]]`.
- Chart cell: line charts only, one line per chart; its text grows and
  shrinks with the page width; a label or title cannot contain `"` or `%>`.
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
- Packages: other Texl programs do not understand `~` in imports, packed
  packages, or importing a folder.
- Notes and threads on a release can be anchored only to cells that have
  a name in the file; Stilo names every cell when it saves a document.
- Packed packages: read-only in Stilo; to change one, unpack it, edit the
  folder and pack it again by hand (there is no unpack command).
- Errors: a value inside a link's address or another HTML attribute counts but
  cannot be highlighted. The failing place is marked in the Errors pane, not
  in the source while editing.
