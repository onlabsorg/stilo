# Changelog

All notable changes to Stilo are listed here, newest first. Versions follow
[semantic versioning](https://semver.org/); before 1.0, any version may
change the interfaces.

## 0.11.0 — 2026-11-27

- **Folders in the navigation pane start folded**, at every level: opening
  a folder shows its subfolders folded, and a folder folded again keeps
  what was opened inside it. The folders of the open document, and of an
  item just added, moved or uploaded, open so that it shows.
- **A packed package in the navigation pane reads as a file**: a click
  opens its `index.texl`, a double-click (or a click on its arrow) unfolds
  it to show what is inside. Opening its index leaves it folded.

## 0.10.0 — 2026-11-24

- **A menu on a cell** (S29): a right click on a cell (or the menu key,
  or Shift+F10) selects it and opens a menu: Edit, Change the cell type…,
  Cut, Copy, Paste, Insert a cell above or below, Delete, Show the cell's
  comments. In a read-only document (a packed package) those that would
  change it are greyed out, with the reason. A cell being edited keeps
  the browser's own menu. Extensions add to it with
  `menus.add("editor/cell", id)`; their commands run with `{line, cell}`.
  The editor fires `cell-menu` (cancelable) for a page that shows its own.
- **Hooks for notes and threads on a release** (S29, OnLabs D25), for
  extensions: `editor.selection` has the document's `path`;
  `editor.goTo({path | uri, cell | line})` opens a document and selects a
  cell by its name, `editor.lineOf(cell)`; `ui.write(message, value)`
  asks for a short rich text with the rich text cell's editor and returns
  its Markdown; `editor.renderHtml(text, {url})` (and `renderHtml` of the
  editor module) renders a Texl text that is not open, as
  `renderedHtml()` does; `tree.archiveOf(path)` gives the packed package
  a document is in, `transport.sha256(path)` the SHA-256 of a file.
- In a read-only document, the editor no longer reports a name for a
  cell read without one (`selection`, `cell-menu`): that name was random
  and never written.
- **Removed: comments from outside the document** (S30). Extensions can
  no longer add comments to the comments pane (`comments.addProvider`,
  `comments.refresh`, the `others` of `comments.list`), and the editor's
  `extraComments` is gone. The comments pane and the comment count in the
  margin show only the document's own comments. Notes, threads or issues
  kept elsewhere go in an extension's own panel, with marks on their
  cells (as the example below).
- **Example extension**: `examples/extensions/review-notes.js`, notes
  with a status on the cells of a packed package, in a panel of its own
  (`docs/extensions.md`).

## 0.9.0 — 2026-11-22

- **Your own brand in the top bar**: an extension can show its own name
  (a link to its home page, say) at the top left in place of "Stilo",
  with `topBar.setBrand(render)`; `render(stilo)` returns a Lit template
  like a top-bar item's. It returns a `dispose()`, recorded like the other
  hooks, so the "Stilo" label comes back when the extension is
  deactivated.

## 0.8.0 — 2026-11-20

- **The panel rail** (S28): the buttons that open the right pane's panels
  moved from the top bar to a narrow rail at the right edge of the window,
  always shown, one button per panel from the top: Commands, Errors (with
  the count of errors), Comments. The Commands button has a new icon, a
  list (it was ⋮). The top bar keeps only buttons that do something else
  (extensions' `topBar` items). Keys are unchanged (F1, Alt+C). For
  extensions, `panels` and `topBar` do not change; panels' `order` now runs
  from the top, and Stilo's own are commands (10), errors (20), comments
  (30).
- **The document as rendered**: the editor's `renderedHtml({hidden})`, and
  the `editor` service's, give the HTML every cell shows, sanitised, for an
  export or a print, without reaching into the editor. Cell types turn
  their output into HTML with a static `viewHtml(output, errorMessages)`,
  which `renderView()` and `renderedHtml()` share (`MarkdownCell`
  overrides it; a type that overrode `renderView()` only to convert its
  output should override `viewHtml` instead).
- **The selected cell's name**: the editor's `selection-change` event now
  gives `{line, cell}`, the name of the selected cell with its line, and
  the editor and the `editor` service have `selection`, the same, so an
  extension can anchor a comment or a mark to the selected cell.
- **An extension's badges go when it is deactivated**: `panels.setBadge`
  returns a `dispose()` and is recorded like the other hooks, so a badge
  an extension put on one of Stilo's panels (a count on Comments, say) no
  longer stays after it is deactivated. A badge set by someone else since
  stays; calling `setBadge` again and again keeps one record per panel.
- **Extensions can ask the server's info in `activate`**: `startStilo`
  reads `/_api/info` before it activates the extensions, so
  `info.hasExtension(id)` and `info.has(capability)` are right there; they
  said "no extensions" before, since the info was read only when the app
  connected. The info is read once. A `401` to it no longer asks the user
  to sign in: the app's first request after it does, in Stilo's dialog.
- **A save that did not happen stands out**: "Not saved: …" in the top
  bar is now coloured, as a warning when it can be fixed in the editor (a
  read-only document, a cell to correct) and as an error when the server
  refused the save or could not be reached. It was plain grey, like
  "Saved".
- **Any file can be updated** (S27, protocol capability `rewrite`): the
  server's UPDATE (PUT with `If-Match`) now replaces files that are not
  documents too (it answered `400` before), so an extension can keep its
  data in the folder, e.g. a JSON file. `transport.updateFile` takes a
  text or a `Blob`.
- **Fix: an extension's panel of several elements** (a header, then its
  content, as in the first example of `docs/extensions.md`) was spread
  over the right pane's height, each element getting an equal share. They
  now stack from the top and the pane scrolls; a panel of one element
  fills the pane, as Stilo's own do.
- **Fix: `stilo init` wrote an empty `references/stilo.texlz`** when Stilo
  was installed inside a git repository that ignores it (a virtual
  environment in a project): the navigation pane showed it as a plain
  file and imports of the library failed. The library is now always
  packed in full.
- **`stilo pack` and git's ignore rules** (S26): a package in a folder its
  repository ignores (e.g. inside a git-ignored `build/`) is packed by the
  `.gitignore` files inside it only, no longer emptied by the outer rule;
  outside any repository, a `.gitignore` in the package now counts too.
  Packing refuses a package whose `package.texl` would be left out,
  instead of writing an archive that cannot be opened. Server:
  `pack_package` takes `gitignore=False` to pack ignored files too.

## 0.7.0 — 2026-11-19

- **Packed packages**: a package can be one file, a zip named `*.texlz`
  with `package.texl` at its root, to share as one file. Stilo opens it as
  a folder that cannot be changed: the navigation pane shows it with its
  own icon and a lock, its documents open read-only, and the commands that
  change files are greyed out inside it. The file itself can be uploaded,
  renamed, moved, deleted and downloaded (new **Download** command, on
  packed packages and other files). Imports reach into it
  (`~/references/lib.texlz/index.texl`), relative imports and `~` resolve
  inside it, and packed packages nested in packed packages work too, in
  the editor and in `stilo render` alike.
- **Import a folder or a packed package by itself**: importing
  `~/references/steel-revA.texlz`, or a folder as `~/references/steel/`,
  imports its `index.texl`, whose own imports resolve from its folder, in
  the editor and in `stilo render` alike (which also accepts a folder or a
  `.texlz` file). Protocol: a read of a folder or packed package is
  redirected to its `index.texl` (it answered `400`), capability `index`.
  **`?download`** after a file's address downloads it: how a packed
  package's own file is fetched now, and what the Download command uses.
  The storage interface gets `read_target`; `INDEX` and
  `download_response` join `stilo.server.__all__`. Decision S25.
- **A new example**: the package `examples/packages/steel/`, packed as
  `examples/packages/beam/references/steel-revA.texlz`, which the beam
  example now imports instead of `examples/library/steel.texl`.
- **The Stilo library is now a packed package**: `stilo init` (and
  `stilo tutor`) writes it as `references/stilo.texlz`, which opens
  read-only, instead of a `references/stilo/` folder; data tables and
  charts import `~/references/stilo.texlz/index.texl`. `texl-lib/` gets a
  `package.texl`. An existing package keeps its `references/stilo/`
  folder, which still works. To use new data or chart cells in it, run
  `stilo init` there: in a folder that is already a package it now leaves
  `package.texl` alone and adds a missing `references/stilo.texlz` (it
  used to refuse, with exit status 1). Then change `~/references/stilo/`
  to `~/references/stilo.texlz/` in the imports and delete the old folder. The example package and the tutorial (lessons 7 and 12)
  follow. Decision S24.
- **`stilo pack [folder] [-o file]`** packs a package folder into a
  `.texlz` (default: the folder's name, next to the folder) and prints its
  SHA-256. The same files always give the same bytes; hidden entries
  (`.git/`, `.trash/`), links and git-ignored files are left out.
- Protocol: a packed package is a tree node with `"archive": true`, its
  items `readOnly`; writes inside it get `403`; `/_api/info` lists the
  capability `archives`. Still protocol 1. Server: `pack_package`,
  `ARCHIVE_SUFFIX`, `is_archive` and `ArchiveError` join
  `stilo.server.__all__`; `home_of` and `expand_home` take an optional
  `is_package` check. Web app: the `tree` service has `isArchive` and
  `addReason`, and the menu `tree/archive`. Decision S23.
- **`stilo serve` and `stilo tutor` now listen on port 8010 by default**
  (was 8000, often taken by other programs). `--port` still chooses
  another one. The tutorial's lesson 12 uses 8010 and 8011.

## 0.6.0 — 2026-11-18

- **Projects are now packages**: a folder with a `package.texl` (was
  `project.texl`) is a *package*, and `~` in imports stands for it.
  `stilo init` writes `package.texl`, binding `package_name` (was
  `project_name`). `project.texl` is no longer read: in an existing
  folder, rename it to `package.texl` (and `project_name` inside it).
  `stilo tutor` still recognises an old copy of the tutorial and proposes
  `stilo tutor --reset`. The tutorial's lesson 12 is now "Your first
  package". Decision S21.
- **Libraries are now references, in `references/`** (OnLabs D23): the
  packages a package uses live in its `references/` folder (was `lib/`).
  `stilo init` creates `references/` and copies the Stilo library into
  `references/stilo/`; data tables and charts import
  `~/references/stilo/index.texl`. An old `lib/` is not read or warned
  about: it is an ordinary folder. The tutorial follows: its lesson 14 is
  now "Your own references" (`14-references.texl`). Decision S22.
- **Migrating a folder made with Stilo 0.5** (once, for both renames):
  rename `project.texl` to `package.texl` and `project_name` to
  `package_name` inside it; rename `lib/` to `references/`; in every
  document, replace `~/lib/` with `~/references/` in imports. A tutorial
  copy is best made again with `stilo tutor --reset`.

## 0.5.1 — 2026-11-18

- **Releases publish the npm package automatically**: the release
  workflow publishes `@onlabsorg/stilo-web` by Trusted Publishing (0.5.0
  was published by hand), and PyPI waits for npm, so a failed publish
  leaves no half-released version.
- The server's version is tested against the package's, so a release
  can't forget to bump it.

## 0.5.0 — 2026-11-18

- **Server and CLI extensions documented** (for developers): the guide
  `docs/extensions.md` covers the Python side (server extensions, storage
  wrappers, CLI commands), and a contract test writes the version-history
  and PDF-export examples as separate packages with the public API alone.
  Decision S20.
- **`stilo` commands from other packages** (for developers;
  `docs/cli.md`): an installed package can add commands to `stilo`
  through the entry-point group `stilo.commands`; `stilo --help` lists
  them after Stilo's own. A broken plugin, or one that takes the name of
  an existing command, is skipped with a warning. `stilo.cli` names its
  public API (`Command`, `create_engine`, `run_server`, …); `run_server`
  now takes an app.
- **The server's public API** (for developers; `docs/server.md`):
  `stilo.server` lists in `__all__` what extensions and other servers may
  use, among them the helpers that make another server answer as Stilo's:
  file types and safety headers (`media_type`, `other_file_response`, in
  the new `files.py`), ETags, and the project-home rule.
- **Server extensions** (for developers; `docs/server.md`): `create_app()`
  takes `extensions`, each a `ServerExtension` (an id, a router mounted
  under `/_api/x/<id>/`, a storage wrapper, capabilities, a version),
  listed in `/_api/info`, and `middleware` for the whole app. Endpoints
  reach the storage with the dependency `get_storage`.
- **Any storage for the server** (for developers; `docs/server.md`):
  `create_app()` takes any object with the methods of `Storage`, now an
  interface, or a folder's path as before. The folder on disk is
  `FolderStorage` (was `Storage`); `StorageWrapper` passes every call to
  another storage, so a wrapper can act on every write.
- **Files the server cannot write are read-only**: a file or folder that
  Stilo's server has no permission to write on its computer now shows a
  lock in the navigation pane; such a document opens read-only, with the
  reason in the top bar, and cannot be saved, renamed, moved or deleted.
  Before, saving it failed with a server error.
- **Protocol v1 in Stilo's server and web app** (for developers): the
  server answers `/_api/info`, reserves `/_api/x/`, marks read-only items
  and refuses writes to them with `403`; the web app reads the info
  (`stilo.info`), greys out what a server cannot do, shows the server's
  read-only items and reasons, and on a `401` with a login address asks
  the user to sign in.
- **Protocol v1** (for developers; `docs/protocol.md`): adds to v0, which
  still works, `GET /_api/info` (the server, its capabilities and
  extensions, each with its id and, optionally, its version and its own
  capabilities), the `/_api/x/<id>/` space for server extensions, read-only
  items (`readOnly` in the tree, `403` on writing them), and `401` with a
  login page and `403` with a reason, for servers that need a signed-in
  user.
- **Questions in Stilo's own dialogs**: Stilo now asks before deleting,
  discarding unsaved changes, renaming or saving first in a dialog of its
  own, in the colours of the app, with buttons that say what they do
  (Delete, Discard, Save, Rename) instead of OK. Enter answers yes, Escape
  no. Leaving the page with unsaved changes is still asked by the browser.
- **Extensions, first part** (for developers): `startStilo({target,
  extensions, transport})`, exported by `@onlabsorg/stilo-web`, starts the
  web app with extensions, plain objects `{id, apiVersion, activate(stilo),
  deactivate?}`. An extension that cannot be activated is reported and
  skipped; deactivating one undoes everything it registered. The hooks it
  can use grow in the next versions (S17). Extensions can add items to
  the top bar and to a status line at the bottom of the window (shown only
  when it has items), and replace a panel of the right pane; the commands
  pane lists active extensions, and those not activated, in an Extensions
  group. Extensions can also send every request to the server through
  their own code (`stilo.transport.use`), Texl imports included.
  Nothing changes for users without extensions.
- **Read-only files and folders, markers in the navigation pane**
  (extensions): an extension can mark files and folders as read-only,
  put badges and hover text on items of the navigation pane, and hide
  items. A read-only document opens read-only ("Read-only" in the top
  bar, with the reason) and cannot be saved, renamed, moved or deleted;
  nothing can be added to a read-only folder. Commands that do not apply
  are greyed out in menus and in the commands pane, with the reason.
  Nothing changes for users without extensions.
- **Pages of extensions** (extensions): an extension can add pages that are
  not a document, such as a dashboard, at their own address
  (`/?view=<id>`), shown in place of the editor; they can be bookmarked,
  and the back button works. Nothing changes for users without
  extensions.
- **Comments from elsewhere, marks on cells** (extensions): an extension
  can add comments from outside the document (an issue tracker, a review),
  shown in the comments pane under the file's own, with their source,
  author and date, and counted in the margin, on the cells they belong
  to; and put short marks on cells (a checker's findings) in the right
  margin. Nothing changes for users without extensions.
- **The extension API, complete for the web app** (for developers): the
  package `@onlabsorg/stilo-web` exports `createStilo`, `StiloController`,
  `StiloProvider` and `stiloContext` beside `startStilo`; extensions can
  add cell types with their command (`stilo.cells.register`); the guide
  and reference are in `docs/extensions.md`, and a contract test uses
  every hook.
- **Dialogs and settings for extensions**: an extension can show dialogs,
  ask questions and texts in Stilo's own dialogs, show a status message
  as a warning or an error, and keep its settings in the browser.
- **Editor component** (for developers): `<texl-editor>` gains a
  read-only mode (`readonly`), a `loader` for the documents it imports,
  comments from outside counted in its margin (`extraComments`), marks on
  cells (`marks`, event `mark-click`),
  and `editorCommands()`, the list of its commands with their labels and
  keys. In Stilo's commands pane the "Make it …" commands now follow the
  order of the cell type menu.
- **Keyboard shortcuts match exactly**: a shortcut no longer runs when
  extra modifier keys are held. Alt+Shift+N used to act as Alt+N (New
  document); likewise Alt+C, Alt+U and Alt+T. The shortcuts as listed in
  the commands pane work as before.
- **Web app reorganised inside** (for developers): its state and behaviour
  now live in core services (`web/src/core/`) that the panes show and
  Stilo's own commands use, the first part of the extension system (S17).
  Nothing else changes for users. After a click in the comments pane while
  Show source is on, the editor now gets the focus back.
- **The web app on npm**: Stilo's web app and its editor component are
  published as the npm package `@onlabsorg/stilo-web`, for developers who
  build their own front end or embed the editor
  (`import "@onlabsorg/stilo-web/editor"`). It replaces using the editor
  from a copy of Stilo's source code; the guide in `docs/component/` shows
  how to install and configure it. Nothing changes for users of the
  `stilo` command.
- **Texl 0.10**: Stilo now requires `pytexl` 0.10 and `@onlabsorg/texl`
  0.10. Formulas are stricter: a syntax error anywhere in a formula, also
  inside brackets, makes the whole formula undefined (before, part of it
  could still run or a list item vanish), and endless recursion shows an
  error ("recursion too deep") instead of crashing. Data tables were
  already checked value by value as they are typed, so they are not
  affected.

## 0.4.0 — 2026-11-10

- **Tab icon**: the browser tab of Stilo shows an icon, the OnLabs.org mark
  (two concentric circles, the outer one with a sharp corner at the bottom
  left) in blue and orange.
- **Chart cells**: a new cell type, **Chart** (key **c**), draws a line
  chart, for example of two columns of a data table. It is edited as a
  form: the chart type (only Line for now), the X and Y values (formulas
  that give a list, such as `loads.column "x (m)"`), the axis labels and
  the title. The chart spans the width of the page and follows the light
  and dark themes. It is stored as one formula,
  `<% stilo.charts.line {x: ..., y: ..., x_label: "...", y_label: "...",
  title: "..."} %>`, so `stilo render` shows it too, as an SVG image.
- **`stilo.charts.line`**: the Stilo library has a new function that draws
  a line chart as an SVG image, with round-numbered axes. Points whose X or
  Y is not a number are left out. Copy the library into existing projects
  again (`lib/stilo/`) to use it.
- **Forms**: cells that set a few named values, such as the chart, are
  edited as a form, one line per field: a description on the left, a text
  box or a drop-down on the right. Tab and ↑/↓ move between fields.
- The tutorial's lesson 7 shows charts, and the beam example has a
  bending-moment diagram.

- **Ctrl+C stops `stilo serve` and `stilo tutor` cleanly**, with a goodbye
  message instead of an error traceback. `stilo serve` now says how to stop
  it when it starts.
- **Texl 0.9**: Stilo now requires `pytexl` 0.9 and `@onlabsorg/texl` 0.9,
  which add the Swan built-in `text.template`. The `stilo` library's
  dataframe uses it to write its Markdown table; the table is unchanged.
- **The navigation pane shows every file**: images, PDFs, data files and
  any other file appear in the tree beside the documents, greyed out, and
  so do folders that hold only such files. Clicking one opens it in a new
  browser tab. **Show other files**, in the pane's `⋯` menu, hides them;
  **Show empty folders** is gone.
- **Upload files…**: a new command on folders and in the pane's menu adds
  files from the computer through the browser's file dialog, several at a
  time. A file whose name is already taken is skipped and reported.
- **Other files can be renamed, moved, deleted and their link copied**, as
  documents can. A rename keeps a file a document or not: it cannot add or
  remove the `.texl` extension.
- **Deleting a folder deletes everything in it**, other files included,
  into the `.trash` folder; the folder is always gone afterwards. The
  question says how many documents and other files go with it.
- **Protocol:** the tree lists every file; CREATE, MOVE and DELETE accept
  any file; DELETE of a folder answers `{"deleted": <number of files>}`
  (no more `removed`).

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
