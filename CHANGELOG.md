# Changelog

All notable changes to Stilo are listed here, newest first. Versions follow
[semantic versioning](https://semver.org/); before 1.0, any version may
change the interfaces.

## Unreleased

- **The beam example is an engineering report**: `beam-check.texl` reads
  as a short design report (introduction, scope of work, basis of design,
  method statement, analysis results, conclusions and recommendations)
  that links to and takes its figures from two detail documents of the
  same project, `basis-of-design.texl` and `analysis.texl`. The steel
  library gains E, second moments of area and shear areas.
- **New document typography**: text, headings and table headers in
  Atkinson Hyperlegible Next, a wide, very legible sans in the spirit of
  Verdana; paragraphs and list items justified; tables full width with a
  small margin on each side, columns sized by their content, with strong
  rules above and below, a thin rule under the header and hairlines
  between rows. Equations are no longer larger than the text around them.
- **Table captions**: write `<caption>Table 1: …</caption>` on its own
  line right after a table in a Markdown cell; it shows below the table,
  left-aligned.
- **`stilo tutor`**: a guided tutorial for new users, in the web app.
  Twelve short lessons (30–45 minutes) teach the editor and the `stilo`
  command by doing, from the first edit to your own project, and two
  advanced lessons follow; many exercises check themselves and show
  "✓ Done", and the index shows your progress. The first run copies the
  tutorial into your user data folder (`--dir PATH` for another one) and
  makes it a project; later runs open your copy as you left it. `stilo tutor
  --reset` starts again from a fresh copy, moving the old one aside, never
  deleting it; when the copy was made by an older Stilo, `stilo tutor` says
  so and proposes `--reset`. Other options: `--port`, `--no-browser`.
  New dependency: `platformdirs`.

## 0.3.0 — 2026-11-09

- **Hidden cells**, as hidden rows in Excel. "Hide the selected cells" in the
  commands pane hides lines: they stay in the document and still compute, but
  are out of sight; the line numbers skip them and a double rule shows where
  they are. To bring them back, select the lines around them and choose
  "Unhide the cells in the selection", or show them all, greyed out, with
  "Show or hide the hidden cells". The arrow keys skip hidden lines; going to
  a hidden line from the errors or comments pane shows the hidden cells. File
  format: a hidden cell's marker ends with `| hidden`, as in
  `<!--{ bek4 : formula | hidden }-->`. The line that imports the Stilo
  library for a data table is now added hidden.
- **Data table cell** (key `d`, or "Data table" in the type menu): a table of
  values that other cells can compute with. Give it a name (optional), the
  column names, and a value in each field, written as a formula: `120`,
  `"ULS-1"`, `1.35 * Fx_k` (text needs its quotes; an empty field is
  empty). Outside editing it shows the computed table. A value that is not
  a valid formula is outlined as you type, and the cell cannot be committed
  until it is corrected. Rows and columns can be inserted and deleted
  anywhere. With the name `loads`, other cells read the data as
  `loads.column "Fx (kN)"` or `loads.row 0`. When the first data table is
  written, the editor adds a line at the top of the document that imports
  the Stilo library from the project (`~/lib/stilo/index.texl`); a document
  outside a project shows `[[Undefined]]` there until the library is found.
- **`stilo.dataframe`, the first function of the Stilo library.** After
  `texl.import "~/lib/stilo/index.texl"` (binding `lib.data.stilo` as
  `stilo`), `df: stilo.dataframe {columns: [...], rows: [[...], ...]}` makes a
  table of data and shows it as a table in place: column names are free text,
  `""` is an empty cell, short rows are padded, a column of numbers is aligned
  right, and a bad value shows as `[[Undefined]]` in its own cell.
  `df.column "name"`, `df.row 0`, `df.columns` and `df.rows` read it. The
  library's main document is now `index.texl` (it was `stilo.texl`).
- **Projects and libraries.** `stilo init` makes a folder a project: it writes
  `project.texl` (the project's name and the Stilo version that created it) and
  copies the Stilo library into `lib/stilo/`. In an import, `~` stands for the
  project's home folder, the nearest one with a `project.texl`, so
  `texl.import "~/lib/stilo/index.texl"` works from any document of the project,
  in the editor and in `stilo render`. Without a `project.texl`, `~` is the
  served folder in the editor and your home directory on the command line.
  Folders named `~` are hidden in the editor and cannot be created there.
- **Texl 0.8**, in the browser and on the command line (`pytexl` and
  `@onlabsorg/texl` 0.8.0). An imported document is identified by its final
  URL, after HTTP redirects.
- **`~` gives the real path.** The server answers a read whose path has `~`
  with a redirect (`307`) to the real path, and `stilo render` treats the
  file the same way. A library imported through `~` is now the document at
  its real path: imports of it by different paths share one copy, its
  relative imports resolve from its own folder, and a library importing
  itself through `~` gets an undefined value at once instead of after 16
  rounds.
- **Texl 0.7**, in the browser and on the command line (`pytexl` and
  `@onlabsorg/texl` 0.7.0). A namespace with a `__text__` function now renders
  as the text it returns.
- **Rich text cells, as in Word, and the default for new cells.** Bold is bold and
  a title is a title while you edit, with a toolbar and Word's keys: Ctrl+B, I, U,
  Ctrl+K for a link, Ctrl+Alt+1 to 3 for headings, Tab to indent a list, `# ` or `- `
  to start a heading or a list. Press `r` on a line to make it rich text.
  - **Formulas are chips** that show their value, with the expression on hover. A
    click edits it; Ctrl+E or typing `<%` inserts one. A formula with no output
    (`<% L = 6 %>`) shows a small ƒ.
  - **Equations** are typeset as you edit; a click edits the LaTeX, with a preview.
  - **Comments:** Shift+F2 adds one to the line.
  - **Files stay plain Markdown,** so a rich text cell and a Markdown cell change
    into each other with no conversion, and only the paragraphs you change differ
    in the file. Colours, fonts and alignment are not available, and repeated empty
    paragraphs collapse.
  - **Raw HTML and tables:** a cell with them cannot be rich text, and the type menu
    says why. Use a table cell for tables.
  - **Arrow keys stay in the cell** while editing. Ctrl+Enter commits, Escape
    discards.
- **A click on another line commits the cell you are editing,** in every cell type,
  as in Excel. A cell that cannot be committed stays open and says why.
- **Equations in Markdown and table cells.** Write LaTeX between `$...$` in the
  text, or `$$...$$` on lines of their own, and it is typeset when you leave the
  cell. A formula inside an equation shows its value:
  `$\sigma = <% M / W %>$`.
  - **Amounts of money stay text:** in `$5 and $10` nothing is an equation. An
    equation's opening `$` has no space after it, and its closing `$` no space
    before it and no digit after it. Write `\$` for a plain dollar.
  - **Bad LaTeX** shows in red with the reason on hover. An equation with an
    undefined value shows as its source, with the value highlighted.
  - **In a table**, write `\vert` for a `|` inside an equation.
  - The file format does not change: `stilo render` returns the LaTeX as text.

## 0.2.0 — 2026-11-07

- **Links to other files work.** An image, PDF or other file in the folder now
  opens from a relative link in a document. Before, a PDF link showed an empty
  Stilo, and an SVG image did not show.
  - **Clicking a link** to a file or to another website opens it in a new tab,
    so your document stays open. A link to a `.texl` document still opens in
    place.
  - **Relative links in imported text** resolve from the document showing them,
    not from the imported document's folder.
  - **Server:** other files are served at their public URL with their real
    content type, also to a browser asking for HTML. Files of unknown type
    download; HTML, XML and SVG opened directly are sandboxed, so they cannot
    run scripts on Stilo's address.
- **A formula can no longer run across cells.** A `<%` left open used to close
  at the first `%>` of a later cell, leaving the cells in between blank.
  - **In the editor**, leaving a cell in that state is refused with a message
    naming both lines; correct it, or press Escape to discard the changes.
    The same goes for a `%>` that would close a `<%` higher up, and for a paste
    or a move that would cause it. A lone `<%` with no `%>` below it stays plain
    text.
  - **In a file** already in that state, the cells down to the `%>` open as one
    cell, and the file does not change. Close the formula and they become
    separate cells again, with their types.
  - **A marker line typed or pasted into a cell** now makes a new cell when you
    leave the cell, instead of only when the document is opened again. A marker
    line inside a formula, e.g. in a string, stays part of the formula.
  - **File format:** a marker line inside a `<% %>` tag is not a marker.
  - For pages embedding the editor: `tagSpans`, `spanningTag` and
    `cellsFromSource` are new exports.
- **Output no longer lands under the wrong cell** when an imported document or a
  formula outputs text that looks like the marker of a later cell. The editor
  now places each cell's output from the positions of the formulas, instead of
  searching for the marker in the output.
  For pages embedding the editor: `splitRendering` takes the rendering
  (`splitRendering(doc, cells)`), which must be of `serializeDocument(cells)`,
  and `outputSpans(doc, cells)` gives the same split as positions.
- **Commands on the navigation pane.** Right-click a document, a folder or the
  empty area of the tree, or use the `⋯` button of a row or of the pane's header,
  for a menu. The header also has buttons for New document and New folder, and
  the commands are listed in the commands pane.
  - **New document** now asks for the name in the tree instead of a browser
    dialog, and creates the document in the folder you chose: the one you
    right-clicked, or for the header buttons and Alt+N the folder of the item
    you last used in the tree, instead of always the navigation root.
  - **Duplicate** copies a document next to it and opens the copy. It works on
    documents only.
  - **Copy link** copies a document's link, relative to the open document, ready
    for `texl.import` or a Markdown link.
  - **Open as root** makes a folder the navigation root, as a double click does.
  - **Refresh** reads the tree again.
  - **Show empty folders** shows or hides folders with no documents in them. It
    is on by default and remembered in the browser.
  - **New folder** creates a folder in the place you chose, the same way.
  - **Rename** (F2) changes a document's or folder's name in its row of the tree.
    **Move to…** moves it to a folder you choose. Both warn that links to it will
    stop working, as links are not updated. If it holds the open document, Stilo
    offers to save unsaved changes first and keeps the document open at its new
    address, with a fresh undo history.
  - **Delete** (Delete, when the tree has the focus) asks first, then moves a
    document to a `.trash` folder at the top of the served folder; its folder
    stays, even if empty. Deleting a folder moves all its documents to the trash,
    and removes the folder unless other files remain in it. A deleted open
    document closes.
- **Protocol:** new operations to create a folder, move or rename a document or
  folder, and delete a document or folder (`docs/protocol.md`).
- **Inserting a formula tag is now Ctrl+E** (Cmd+E on macOS), instead of
  Ctrl+Space, which switches the input source on macOS.
- **Saving includes the cell being edited.** Ctrl+S (or Save in the commands
  pane) now commits a cell in edit mode before saving, instead of leaving its
  edit out of the file. If the cell refuses the edit, it stays in edit mode
  with its message and nothing is saved.
- Editor API: new read-only property `editing`.
- **Comments pane**: each comment now says "Cell 3" instead of "Line 3", as the
  Errors pane does.
- **The web editor shows errors.** A value a formula returned as undefined is
  highlighted in its cell, with the reason as hover text, and the right margin
  shows the number of errors on each line. A new button in the top bar shows
  the document's total and opens the Errors pane: each error's description,
  its source line with the failing position marked, its causes and where it
  was made and shows, as "Cell 3, line 12" (the line is left out when the cell
  has only one). A click on a highlighted value or a margin count opens that
  error; a click on an entry selects its line; a link opens the imported
  document where the error was made. A double click still edits the cell. Only
  a value returned by a formula counts, directly or as an item of a tuple: not
  an assignment, not a value inside a list or namespace.
- **`stilo render` reports undefined values.** When a document returns
  undefined values, one line on standard error says how many; the output is
  unchanged. `-d` / `--debug` explains each one on standard error (location,
  source line, description, causes) and numbers them in the output as
  `[[Undefined #1]]`. `--strict` exits with status 1 if there are any. Only a
  value returned by a formula counts, directly or as an item of a tuple: not
  an assignment, not a value inside a list or namespace.
- **Texl 0.6** (`pytexl` and `@onlabsorg/texl`). A broken link is now visible:
  a formula whose `texl.import` fails shows `[[Undefined]]`; before, it showed
  nothing. `stilo render` says why a document cannot be loaded, e.g. `stilo:
  report.texl: could not be loaded: FileNotFoundError: ...`.
- **Texl 0.5** (`pytexl` and `@onlabsorg/texl`). Formulas are stricter: text
  left over after an expression, such as a stray `)`, now makes the whole
  formula show `[[Undefined]]`; before, it was ignored. A formula whose
  promise ends in an error also shows `[[Undefined]]`; before, it showed
  nothing. In documents, the rendered text of an imported document is now
  `lib.text`, no longer `lib.rendering`.
- **Table cell: column alignment**. Three buttons above the grid, as in
  Word, align the column of the current field left, centred or right; the
  pressed one shows the column's alignment, and the fields line up the
  same way. The table cell is now ready for use: each field shows its
  table cell's Texl source, and outside editing the cell shows the
  rendered table.
- **Commands pane**: Copy, Cut, Paste, Commit and Discard now run from
  the pane too (the browser may ask before pasting), and every command
  there does exactly what its key does.
- **Comments pane**: clicking a comment selects its line in the document.
- Editor API: `runCommand(name)` runs any editor command by name (the
  list is in `commands`), and `select(line)` selects a line; the app uses
  them instead of simulating key presses.
- **Type keys**: on a selected line, `=` makes it a Formula cell and
  starts editing, as `=` starts a formula in Excel; `t` does the same for
  Text, `m` for Markdown and Shift+T for Table. On a line that already has
  that type, the key just starts editing, as Enter does. If the line
  cannot take the type, it stays as it is and a message says why ("Needs
  a table"), as in the type menu, which now shows each type's key.
- **Formula cells**: a line that is a single formula can be a Formula
  cell, edited as the expression alone, `q * L ^ 2 / 8`, without the
  `<% %>` around it, and shown as its result.
  Comments around the formula are kept. A formula that contains `%>` is
  not saved: the cell says why, and Escape discards the change.
- **Changing a cell's type only offers types that fit**: in the type
  menu (Mod+/), Table is offered only for a cell that is a table or
  empty, Formula only for a cell that is one formula or empty; other
  types are greyed out with the reason ("Needs a table"). Blank lines and
  comments never count against a type. Text and Markdown are always
  offered.
- **A table or formula cell refuses an invalid edit**: Ctrl+Enter keeps
  the cell in edit mode with a message instead of saving something that
  is no longer a table or a formula.
- Table cells now accept blank lines and comments before and after the
  table and inside its rows, and an empty table cell starts a new
  two-column table.
- **Table cells** (first version): a table is a Markdown table edited as a
  grid, one field per table cell, formulas allowed in each. Tab and
  Shift+Tab move between fields, Tab in the last one adds a row; buttons
  insert and delete rows and columns. A Markdown cell holding a table can
  change to Table and back without loss.
- **New document typography**: text in Literata, headings and table
  headers in Source Sans 3; tables full width with equal columns, ruled
  as in a printed report, with numbers lined up in columns; sub- and superscripts no longer open up the
  line. The fonts ship with Stilo, so no network is needed.
- **Show source** (Alt+U, View): shows the document's text, read-only,
  in place of the editor, unsaved changes included; Alt+U again or the
  close button goes back to the editor.
- The button that opens the commands pane is now a menu icon (⋮), the
  last one on the right of the top bar.
- `examples/sample.texl` imports its library from the right folder.
- The user manual (getting started, the web editor, the `stilo` command,
  the document format) moved to the OnLabs.org manual,
  <https://www.onlabs.org/manual/>. This repository keeps the developer
  documentation, as plain Markdown in `docs/`; the site on
  <https://www.onlabs.org/stilo/> is no longer built.

## 0.1.0 — 2026-10-27

First release on PyPI, as `stilo-cli` (`pip install stilo-cli`; the
command and the Python package are still `stilo`).

Stilo restarted as the editor for Texl documents
(<https://github.com/onlabsorg/stilo>), bringing together:

- the web app: navigation pane, the editor, commands and comments panes,
  light and dark theme;
- the editor, formerly the `texl-editor` package (0.2.0, Texl 0.4): a
  document as a stack of `text` and `markdown` cells, live rendering, cell
  comments;
- the server, `stilo-server`: one folder of documents over plain HTTP
  (protocol v0);
- the command line, `stilo`, with `render` and `serve`.

The earlier, olojs-based Stilo is kept under the tag `olojs-v0.19.4`.

Since the restart:

- One package, `stilo`, with the command line (`stilo.cli`), the server
  (`stilo.server`, formerly `stilo_server`) and the web app (`stilo/web`):
  one Python project at the root of the repository, sources in
  `src/stilo/`, tests in `tests/`; the web app builds into the package.
  Built with `uv build` after the web build, installed from a checkout
  with `uv tool install .`. `python -m stilo_server` is gone: use
  `stilo serve`.
- Documentation site, built and published by GitHub Actions on
  <https://www.onlabs.org/stilo/>: getting started, the `stilo` command,
  the web editor, the document format, the protocol, the editor component
  and a developer guide.
- Web app: links to other documents open in the app, resolved from the open
  document.
- Commands pane: the command groups fold.
- The package builds without the web app (it is then left out), so that
  `uv run` works in a fresh checkout; the release checks that it is in.
- Releases: a pushed tag `vX.Y.Z` publishes the package on PyPI and
  creates the GitHub release (`.github/workflows/release.yml`).
