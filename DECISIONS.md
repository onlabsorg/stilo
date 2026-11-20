# Stilo — Decision Log

*Decisions about Stilo's design, technology and architecture, newest last.
Each entry: date, decision, reason. To revisit a decision, add a new entry
that supersedes it; do not edit old ones.*

*Scope.* Decisions about OnLabs.org as a whole (vision, products, business,
the set of repositories) stay in the coordination folder's log,
`../DECISIONS.md`; one that changes Stilo is recorded there, and its
consequences for Stilo here. Detailed editor design choices (key map,
changing a cell's type, table storage, …) are recorded with their options
in [`docs/editor-design.md`](docs/editor-design.md); an entry here only when
one shapes the whole repository.

S1–S6 were moved from the OnLabs.org log on 2026-10-30 (OnLabs D22; full
original text there at commit `4700343`). Their text is kept as written;
notes in *Since then* say where later work changed a detail.

## S1 — 2026-10-18 — Editing model: a stack of cells (was OnLabs D9)

The web editor shows a document as a vertical stack of cells, navigated like
a spreadsheet (select a cell, press Enter to edit). Each cell has a type
(text, formula, table, chart, …), an edit mode with its own widget and a
render mode. A cell turns the user's input into plain Texl; that Texl is the
only thing stored, so a document is still one Texl file that renders without
the editor. Cells start with an HTML comment marker
(`<!--% name | type %-->`). Text cells are Markdown first; a WYSIWYG text cell
follows, before Christmas 2026 if possible. Revisions, comments, release and
accept belong to the platform, not the editor.
*Reason:* the cell-and-Enter model is what Excel users already know, and it
lets each kind of content get a familiar widget, while the stored documents
stay clean Texl for linking, services and power users.
*Since then:* the marker is `<!--{ name : type }-->` (older markers still
open). Cell comments live in the document (`<!--[ ... ]-->`). OnLabs D11
(no formula cell) was withdrawn with D22: a `formula` cell exists, and a
type change never converts content because a type is offered only if it
accepts the cell's source (the shape rule, `docs/editor-design.md`).

## S2 — 2026-10-18 — Open source (MIT), Lit web components (was OnLabs D10)

The editor is MIT licensed, built as web components in plain JavaScript
with Lit: a base cell, one component per cell type, and the editor itself
as an embeddable `<texl-editor>` component.
*Reason:* developers can write their own cell types; the editor can be
embedded in other apps and in the OnLabs web app.
*Since then:* the editor was the separate `texl-editor` repository; it is
now `web/src/editor/` in Stilo (S6), and all of Stilo is MIT. The split
between open source and private code is set by OnLabs D18 (Stilo open,
Papiro private).

## S3 — 2026-10-24 — Server, web app and an HTTP protocol (was OnLabs D12)

Stilo has three parts: a **server** in Python (FastAPI; `pytexl` for
rendering), a **web app** of Lit web components built with Vite that embeds
the editor, and a **protocol** of plain HTTP: GET a file, create (POST),
update (PUT with ETag), query a folder's tree (JSON). Documents are files
on the server's file system, and each has one public URL, `/<path>`, that
serves the web app to browsers and the file to `texl.import`.
*Reason:* Python matches `pytexl` and the founder's tools; Lit matches the
editor; plain HTTP is what `texl.import` already speaks, so documents render
the same in the web app, the CLI and Python, and standard ETags give safe
saves.
*Since then:* this was the private `platform` scaffolding; with OnLabs D18
it became Stilo, and the protocol is `docs/protocol.md`. Papiro is meant to
speak the same protocol.

## S4 — 2026-10-25 — Render the whole document per pass (was part of OnLabs D17)

Texl engines render per document, with no cache across renderings (OnLabs
D17). The editor therefore renders the whole document with one
`render(documentUrl, source)` and splits the output at its own cell markers,
matched in order (markers from imported documents are content); the host
gives the editor the document's URL instead of a base URL.
*Reason:* a rendering then depends only on the document's source and the
current content of what it imports, the same as in every other Texl host;
a changed library shows on the next rendering.

## S5 — 2026-10-26 — Python for now, modular, extension points in one place (from OnLabs D18)

The server and CLI are in Python for now, kept strictly modular so that
another server (e.g. Node.js) can replace the Python one, and later a native
application (e.g. Electron) can wrap the web app. There is no plugin system
at first, but each extension point is kept in one place: the cell registry
(`web/src/editor/registry.js`), the CLI command table (`COMMANDS`,
`src/stilo/cli/commands.py`) and the server app factory (`create_app()`), so
plugins (custom cells, commands, loaders) can be added later without a
refactoring.
*Reason:* one developer until funding: Python is fastest now, and the
protocol, not the language, is the contract; keeping the extension points
together keeps a plugin system cheap to add.

## S6 — 2026-10-26 — One repository; Stilo is the only Texl CLI (from OnLabs D19)

The `texl-editor` repository moved into Stilo (code in `web/src/editor/`),
together with the platform's server, web app, protocol and examples, in a
fresh history; the olojs-era code is kept under the tag `olojs-v0.19.4`.
`stilo` is the only Texl command line (`texl-cli` is removed from the Texl
repository). A Rust CLI may replace the Python one after the MVP.
*Reason:* one repository for the whole editor is simpler for one developer
and keeps web app and editor in step; one CLI avoids two renderers drifting
apart.
*Since then:* the editor's docs are `docs/editor.md`, `docs/editor-design.md`
and `docs/component/` (not `docs/editor/`); server and CLI are one Python
package, `stilo` (`stilo-cli` on PyPI).

## S7 — 2026-11-05 — Only a returned undefined value is an error

The CLI and the editor report an undefined value only when a tag returns it,
directly or as an item of a returned tuple. An undefined value that is only
assigned, or that sits inside a list or a namespace, is not reported, and
neither is `Nothing`. All undefined values count alike, including those made
with `undef.from`. The default output stays `[[Undefined]]`, as in every other
Texl host; a host adds its report beside it.
*Reason:* an undefined value is like an error object: creating one is harmless,
and returning one is throwing it. So what the reader sees as `[[Undefined]]` is
exactly what gets reported. Scanning `data` for assigned values, and marking
`undef.from` values as made on purpose, were considered and rejected. Blanks
from unknown names are Texl's behaviour, not something a host should patch.

## S8 — 2026-11-06 — Delete moves Texl files to a trash folder

The Delete command of the navigation pane moves documents to a `.trash` folder
at the server root; it does not erase them. Deleting a document leaves its
folder, even if empty. Deleting a folder deletes the `.texl` files in it, at any
depth, and removes the folder if nothing else is left in it; other files stay.
The tree can show or hide empty folders, an empty folder being one with no
`.texl` files in it, at the user's choice; they are shown by default. Renaming or
moving a document does not update the links to it; for the MVP the user gets a
warning. In the protocol, DELETE is its own operation, not a MOVE to `.trash`:
what deleting means is up to the server. Folders cannot be duplicated in the MVP.
*Reason:* Word and Excel users expect to get a deleted file back, and Stilo has
no history of its own. The tree shows only folders and `.texl` files, so
deleting anything else would remove files the user cannot see. Links are Swan
code, which cannot be rewritten reliably. A git repository can ignore `.trash`.
A folder document (a file in each folder, shown as the folder) was considered and
dropped: a folder is just a folder. As a consequence, git does not keep empty
folders.

## S9 — 2026-11-07 — Rich text cell: ProseMirror over Markdown, the default type
The `rich` cell edits text as in Word, with ProseMirror, and stores it as the
Markdown of the `markdown` cell, read with the same parser (`marked`). New cells
and empty lines are `rich`; a configuration file may change that default later.
The type refuses, with a message, a source it could not write back with the same
meaning (raw HTML, tables). Word's colours, fonts and alignment are left out, and
repeated empty paragraphs collapse. In edit mode arrow keys stay in the cell.
*Reason:* the MVP must feel like Office to Office users, while files stay readable
and small to diff, since a release is a commit. Markdown keeps a type change from
converting anything, and one parser cannot disagree with itself; that is why
TipTap and `prosemirror-markdown` (markdown-it) were not used. HTML as the source
would allow all of Word's formatting, at the cost of files people cannot review.

## S10 — 2026-11-08 — Projects, a home folder `~`, and the Texl library in `lib/`
A **project** is a folder with a manifest, `project.texl`: a Texl document
whose text is notes and whose tags bind configuration values, for now
`project_name` and `stilo_version` (the version that created it, not a
requirement). The folder of the nearest `project.texl` at or above a document
is its **home**. In an import URL, a path segment `~` stands for the home: the
URL resolves as usual, then each `~` segment, left to right, becomes the home
of the folder before it. A library under `lib/` is just a folder of Texl files;
a library with its own `project.texl` is its own home. Without a manifest the
home is the highest folder reachable: the served folder for the server, the
user's home directory for the CLI (the filesystem root for a document outside
it). Folders named `~` are hidden and refused, like hidden names. `..` after
`~` cancels it (`~/../x.texl` is a plain relative path). The server resolves
`~` for every client (a protocol rule); the CLI does it in a `file` loader.
The server only checks that a manifest exists; it never renders it.
More than 16 `~` segments are refused: Texl tells an import cycle by its
URLs, and those of a cycle through `~` grow at every turn.
`stilo init` creates `project.texl` and `lib/`, and copies the library
Stilo bundles into `lib/stilo/`; it refuses to run where `project.texl`
exists and never overwrites `lib/stilo/`. There is no package manager:
libraries are copied or cloned by hand, and versions and clashes are the
project's business. A missing library is an ordinary failed import
(`Undefined`), and the editor works without a project. Stilo's library is
written in `texl-lib/` (a third source folder beside `src/` and `web/`),
copied into the package at build time, and published on its own. Its first
function, `stilo.dataframe`, is what the coming `data` cell writes; that cell
replaces the dropped `spreadsheet` cell.
*Reason:* the self-contained unit is the project, not the document: a document
already depends on others in its folder, as a module depends on its library. A
project that holds its libraries keeps working when external URLs change or
vanish, which a versioned web URL cannot promise for libraries we do not
publish. Copying folders by hand is enough until a package manager is needed.
This replaces the design agreed earlier the same day: importing the library by
a versioned GitHub URL that Stilo mapped to its bundled copy.
*Not settled:* the editor's import cell and the "add-in" view of libraries.

## S11 — 2026-11-09 — `~` resolves to the real path, the document's final URL
A path with `~` gives Texl the real path as the document's *final URL*
(Texl 0.8, texl decision T18): the server answers a read (`GET`, `HEAD`,
public URL or `/_api/files/`) whose path has `~` with `307 Temporary
Redirect` to the real path, and the CLI's file loader returns
`(final_url, source)` with the real file. This supersedes, in S10, the server
answering a `~` path with the file itself; the rule of S10 for finding the
home is unchanged. The limit of 16 `~` segments stays, as a safeguard for
clients that do not follow redirects.
*Reason:* Texl identifies a document by its URL. With the file served in
place, a library was a different document at every path that led to it:
two paths rendered it twice, its relative imports resolved from the alias,
and a library importing itself through `~` asked for a longer URL at every
turn, ending only at the limit. With the real path as final URL, a library is
one document, and such a cycle is an ordinary import cycle. A redirect, not a
header, because HTTP clients (the browser's `fetch`, `load_http`) already
report the URL after redirects, so every Texl host, and Papiro, gets it
without knowing Stilo. Temporary, because the home depends on manifests that
can change.

## S12 — 2026-11-09 — The data cell, and the editor adds the imports a cell type needs
The `data` cell ("Data table", key `d`) stores one formula,
`<% name: stilo.dataframe {columns: [...], rows: [[...], ...]} %>`, row by
row, with the column names as texts and each value as a Swan expression
(an empty one is `""`); the name is optional. It is edited as a name and a
grid, and shown as the table that `stilo.dataframe` (the Stilo library,
S10) gives as its text. Its values do not refer to each other. A value that
would break the row is refused on commit, checked by the browser's Texl
engine. A cell type may declare a document its cells import
(`TexlCell.requires`); when a cell of that type is first written with
content and no cell mentions the imported path, the editor adds a visible
formula cell with the import at the top of the document. For the data cell
that is `~/lib/stilo/index.texl`, always the whole library. Undefined values
inside the table show as `[[Undefined]]` and are not listed as errors (S7
unchanged).
*Reason:* a data set cell is more general than an imitation of an Excel
sheet (analysis, reports, charts), and Swan already does what Excel
formulas do; without references between values, rows and columns can move
freely. The source is row by row because Swan enumerates namespace members
sorted and drops `()` from lists, and headers must be free text. A
syntax error inside a list drops the item silently, so the editor must
refuse it. The import is a plain cell so the document still renders in
`stilo render` and any Texl host, which a hidden import would not allow; it
is added once, so a user who removes it is not overruled at every edit.
This settles the import cell that S10 left open; the "add-in" view of
libraries stays open.

## S13 — 2026-11-09 — Hidden cells
A cell marker may carry options after the type, each after a bar; the first
is `hidden`: `<!--{ name : type | hidden }-->`. A hidden cell is out of
sight in the editor, as a hidden row in Excel: it keeps its line number and
still renders in its place, the line numbers skip it, and a double rule
shows where hidden lines are. Hide, Unhide (the hidden cells inside the
selection) and "Show hidden" (a view setting, not saved) are commands. The
import of the Stilo library that the editor adds for a data table (S12) is
added hidden. Unknown options are kept as written.
*Reason:* some cells are machinery a reader does not need to see, such as
an import; hiding them keeps the document readable without changing what it
computes. Hidden rows are what Excel users know. The option lives in the
marker, which other Texl hosts read as a comment, so the file still renders
anywhere; and a bar after the type leaves room for further options.


## S14 — 2026-11-09 — `stilo tutor`: a tutorial of Texl documents, in a working copy
Stilo ships a guided tutorial for new users, served in the web app by
`stilo tutor`. It teaches by doing; the OnLabs.org manual stays the
reference, and lessons link to it instead of repeating it.

- **Source:** `tutorial/` at the root of the repository, shipped in the
  wheel as `stilo/tutorial` (like `texl-lib/`, S10): `index.texl`, numbered
  lessons (`01-welcome.texl`, …), and the files they link to or import (an
  image, a PDF, a library). About ten short lessons make the core path
  (30–45 minutes in all), web app and CLI; optional advanced lessons follow.
- **Working copy:** the user never edits the source. `stilo tutor` copies
  it into a working folder (default: the user data folder,
  `platformdirs.user_data_path("stilo")/tutorial`; `--dir PATH` for
  another) and makes it a project with the same code as `stilo init`, so
  `~` imports and data tables work. An existing copy is reused, so progress
  is kept. `stilo tutor --reset` moves the old copy aside, next to it,
  never deleting it; there is no reset in the web app for now. If the copy's
  `stilo_version` (in `project.texl`) is older than the installed Stilo,
  `stilo tutor` says so and proposes `--reset`; it never overwrites on its
  own. Then it serves the copy like `stilo serve` and opens the browser at
  `index.texl` (`--port`, `--no-browser`).
- **Exercises check themselves with Texl:** where Texl can see the result
  (a name, a value, a data table, an import), a check cell shows "✓ Done" or
  "○ Not yet", computed by a small tutorial library in the copy
  (`lib/tutorial/`). `index.texl` imports the lessons and counts the checks
  their tags returned, so progress needs no extra state. Steps Texl cannot
  see (hiding a cell, using a pane, formatting) are "try it" steps.
- **CI:** every lesson renders with `stilo render --strict` in a fresh copy;
  a lesson that teaches errors declares how many it expects
  (`expected_errors`), and the test checks that number. Each lesson's
  solutions are applied in a test, which checks that every check turns to
  "✓ Done". Copy, reset, the version check and serving the index are
  tested too.
- **Kept current:** a user-visible change updates the matching lesson, in
  the same commit, as with the summary (`CLAUDE.md`, `/commit-changes`).

*Reason:* a new user learns faster by doing than by reading, and Stilo's own
documents are the best place to do it: the tutorial is itself an example of
what Stilo makes. A copy keeps the shipped lessons intact and makes the
user's progress theirs; moving an old copy aside and never overwriting
protects work done in it. Checks written in Texl need no new machinery in
the app or the server, render in `stilo render`, and keep the tutorial a
folder of plain Texl files. Testing the lessons in CI, with their solutions,
keeps them true as the app changes.

## S15 — 2026-11-09 — The navigation tree shows every file; Delete takes a folder whole

Supersedes the parts of S8 on other files and empty folders.

- **Every file in the tree.** The navigation pane lists every file, not only
  `.texl` documents: images, PDFs, data files. Other files and folders that
  hold only other files (no document at any depth) are muted, so documents
  stand out; an empty folder is not muted. A click opens another file by its
  public URL in a new browser tab. "Show other files", in the pane's menu,
  hides them (on by default, remembered per browser); "Show empty folders" is
  gone.
- **Upload.** Folders and the pane have **Upload files…**, the browser's
  file dialog for now (drag and drop later). An upload never overwrites: a
  name that exists or cannot be used is skipped and reported.
- **Other files can be managed.** Rename, Move to…, Copy link and Delete work
  on them as on documents; Duplicate stays for documents. A rename or a move
  never turns a file into a document or back (the `.texl` extension cannot be
  gained or lost).
- **Delete takes a folder whole**: everything in it, other files and hidden
  entries too, goes to the trash, and the folder is gone. An empty folder is
  a real empty folder.
- **Protocol:** QUERY lists every file; CREATE takes any file; MOVE and
  DELETE take any file; DELETE of a folder answers `{"deleted": <files>}`.
  UPDATE stays for documents.

*Reason:* a project is more than its documents: the figures, PDFs and data a
report links to live beside it, and the user needs to see, add and tidy them
without leaving Stilo. S8 kept other files out of Delete because the tree did
not show them; now it does, and the trash keeps deletion recoverable, so the
simpler rule, a folder goes with everything in it, is safe and what Word and
Excel users expect from a file manager. Keeping the document/other-file
distinction fixed through renames keeps the editor from opening, or losing,
a file by surprise.

## S16 — 2026-11-17 — The web app is published on npm as `@onlabsorg/stilo-web`

Extends S5.

- **Two outputs, one repository, one version.** `stilo-cli` on PyPI (the
  server, the CLI and the *built* web app, as today) and
  `@onlabsorg/stilo-web` on npm (the web app's source, `web/src/`, as ES
  modules). Both are published by the release workflow from the same `v*`
  tag, with the same version; the workflow checks that `pyproject.toml`
  and `web/package.json` both match the tag. The Python package does not
  depend on the npm package.
- **The public API is the `exports` map**; everything else is internal and
  may change without notice. At first it exposes only what exists: the app
  (`.`, what `main.js` does: fonts, theme, `<stilo-app>`), the editor
  (`./editor`: `<texl-editor>`, `TexlCell`, `registerCell`, the document
  functions) and `./theme.css`. The panes are not exported until the
  core services (S17) have settled their shape.
- **Consumers build with Vite** (or a bundler that understands the same
  imports: `?inline` CSS, assets by `new URL(…, import.meta.url)`), with
  `@onlabsorg/texl` excluded from dependency pre-bundling. The
  documentation gives the configuration, and CI builds a small consumer
  project with exactly that configuration. A consumer brings its own
  `index.html` (tab icon, early theme script).
- **0.x is unstable.** Until 1.0 any version may change the API, as the
  changelog already says for the whole of Stilo.

*Reason:* extensions and other front ends (S17) need Stilo's components as
a dependency, not a fork. Publishing the source rather than a bundle keeps
one copy of Lit and the editor in a consumer's build and needs no second
build. Same version for both keeps a single release; a Python-only fix
publishing an unchanged npm package is a small price. Exporting little at
first keeps the promise small while the panes are being rewritten.

## S17 — 2026-11-17 — Extensions: core services, registries and Lit context

Extends S5; the cell registry, `COMMANDS` and `create_app()` stay the
places named there, and become part of this system.

Stilo stays a single-user editor of one folder. Anything beyond it is
built outside Stilo as an **extension**, which uses Stilo as a dependency
and plugs into public hooks; a hook Stilo lacks is added to Stilo in
general terms, never for one consumer. The system is general: the test is
a list of example extensions (word count, checker, version history,
read-only folders, a server behind a login, outside comments, export to
PDF, a dashboard page, a custom cell type, a replaced panel) that must be
writable with the public API alone (`docs/extensions.md`, when written).

- **Core services hold the data and behaviour**; panes only show them. What
  `StiloApp` holds today moves into services (`commands`, `keys`, `menus`,
  `tree`, `document`, `editor`, `comments`, `errors`, `views`, `panels`,
  `topBar`, `status`, `transport`, `ui`, `settings`, `info`). Each service
  is an `EventTarget` that fires `change`; panes re-render through one
  Lit controller that watches services. `<stilo-app>` keeps the layout.
- **Lit context.** `<stilo-app>` provides the `stilo` object with
  `@lit/context`; any element inside, at any depth, gets the services from
  it.
- **Registries, not slots.** Visible contributions (right-pane panels,
  top-bar and status items) are added through the registries and rendered
  by `<stilo-app>`. A front end built differently composes the exported
  components itself.
- **An extension** is a plain object `{id, apiVersion, activate(stilo),
  deactivate?}`. Every registration returns a `dispose()`. The `stilo`
  object is complete on its own: services plus what an element needs
  (`html`, `css`, `LitElement`, the shared styles), so an extension that
  imports nothing from Stilo works bundled into a front end or loaded at
  run time. An extension whose `activate` throws, or whose `apiVersion`
  does not match, is reported and skipped.
- **Stilo uses its own API**: the commands pane, the comments pane, the
  errors pane and Stilo's own commands are registered like extensions.
  The **navigation pane is part of the core**, not an extension: it is
  extended through the `tree` and `menus` services (markers, filters,
  read-only items, menu entries), not replaced.
- **Ids and keys.** Commands, panels and views of an extension are named
  `<extension-id>.<name>`; Stilo's own keep their names. A duplicate id
  is refused at registration. Key bindings have a context (`global`,
  `tree`, `editor`); the editor's own keys always come first; for the same
  key and context the last binding wins, with a warning, and disposing it
  brings back the one before. The editor owns the labels and keys of its
  commands; the commands pane reads them from it.
- **Read-only items.** A provider in the `tree` service can mark paths as
  read-only. Such a document can be opened and viewed, but not changed:
  it opens in the editor's read-only mode, and save, rename, move and
  delete are disabled, with the reason. The editor gains a read-only mode.
- **Views** (pages that are not a document) are addressed in the query
  string (`?view=<id>`, like `?root=`), never by a path: every path is a
  file's public URL, owned by the server.
- **Comments from other sources** are anchored to cells by name, not to
  lines, and are read-only unless their provider handles edits.
- **The transport** wraps every request to the server, imports by Texl
  included (the editor takes a loader for its engine; Texl's `addLoader`).
- **Settings** of extensions are kept per browser, namespaced by
  extension. Settings stored in the folder are left for later.
- **No veto on save**: extensions hear `save` after the fact; refusing a
  change is done by read-only items, and by the server.
- **Server**: `create_app()` takes a storage (any object with the methods
  of `Storage`) and extra routers and middleware as arguments, mounted
  under `/_api/x/<extension-id>/` before the catch-all routes. CLI
  commands can come from other packages through a Python entry-point
  group. Protocol additions (`/_api/info`, access-control answers,
  read-only items) go to `docs/protocol.md` first (S3).
- **Nothing visible changes** for users until an extension is installed;
  the list of active extensions shows only when there is a third-party one.

The work goes in phases, each leaving Stilo releasable: publish the
package (S16); move the state into services with no change for users;
the extension API; the protocol; the Python side; plugins installed with
`pip` and loaded at run time, later.

*Reason:* S5 kept the extension points together so that a plugin system
would be cheap; the platform and other tools now need to change Stilo
deeply without forking it, while Stilo itself stays single-user and
simple. Services with views make the API complete because Stilo's own
panes depend on it. Registries are one route where slots and registries
would be two; context is the standard Lit way to reach shared services
across shadow roots. The navigation pane is too tied to the commands that
ask for names and to the tree's keys to be worth making replaceable; its
hooks cover what extensions need. Cell names are the only stable anchor in
a document; a path-based view would collide with files.

## S18 — 2026-11-17 — The extension API of the web app, as built

Refines S17 with what phase 3 settled; S17 stays in force.

- **Activation.** `startStilo({target, extensions, transport})` activates
  Stilo's own contributions, then the extensions in order. An
  extension's `apiVersion` is `"major.minor"`: it works with the same
  major version and a minor version up to Stilo's (`API_VERSION`,
  `"1.0"`). Stilo's own contributions are not listed as extensions and
  keep their bare ids.
- **A recording `stilo`.** Each extension gets the services through a
  proxy that records its registrations (one table, `REGISTRATIONS`), so
  deactivating it undoes everything, even what it forgot to dispose. The
  object also carries Lit, `StiloController`, `TexlCell` and the shared
  styles, so an extension imports nothing from Stilo.
- **Registries hold stacks.** Panels, top-bar and status items and views
  share one `Registry`: `replace(id, item)` puts an extension's item in
  place of any, Stilo's too, and disposing it brings the old one back.
  This is how a built-in panel is replaced.
- **The status line** is at the bottom of the window, as in Word, and
  shows only while it has items, so nothing changes without extensions.
- **No `document.open({source})`.** The `document` service is always the
  file on the server. A document as it was earlier is an extension's
  view that renders a read-only `<texl-editor>` with that text.
- **Commands say when they do not apply** (`enabled`: `true` or the
  reason); menus and the commands pane grey them out with the reason,
  and running one only says why. Read-only items use it.
- **Comments and marks are anchored by cell name**, in the `comments`
  service (providers, read-only) and the `editor` service (mark
  providers, synchronous: an asynchronous checker calls `invalidate()`).
- **Dialogs are Stilo's own** (`ui.dialog`, `confirm`, `prompt`), also for
  Stilo's questions, with buttons that say what they do; the browser's
  are used only where no view shows dialogs, and for leaving the page.
- **`info` waits for the protocol** (phase 4, `/_api/info`); until then
  `extensions.list()` gives the active extensions.

*Reason:* each point is the smallest design that lets the Validation
extensions be written with the public API alone (`docs/extensions.md`)
while keeping Stilo without extensions unchanged for users, except the
dialogs, which look like the app and name their actions. A recording
`stilo` makes deactivation reliable without asking extensions to be
careful; stacks make replacement a registration like any other; a view
for old versions keeps one meaning for "the open document".

## S19 — 2026-11-17 — Protocol v1: the server describes itself, read-only items, login

Extends S3 and S17 (phase 4); the protocol is `docs/protocol.md`.

- **Version 1 adds to version 0 and changes none of it.** A version 0
  client works with a version 1 server; a server without `/_api/info`
  counts as version 0, with every capability of version 0.
- **`GET /_api/info`** gives the protocol version, the server, its
  capabilities (`files`, `tree`, `folders`, `move`, `upload`, `trash`,
  `home`) and its extensions. A client hides what a server cannot do; a
  request for it gets `501`. Clients ignore what they do not know. The web
  app reads it once (`stilo.info`); until then nothing is greyed out.
- **`/_api/x/<id>/`** is reserved for server extensions, listed in
  `info`. Stilo's server answers `404` there until `create_app()` takes
  extensions (phase 5).
- **Read-only items** are marked in the tree (`readOnly`, the reason) and
  refused with `403` on writing. Stilo's own server marks what it cannot
  write on its file system, a file in a folder it cannot write included,
  since a document is saved by renaming a sibling over it. The web app
  turns the marks into a read-only provider of the `tree` service, so
  phase 3's lock, greyed-out commands and read-only editor apply.
- **Login and refusal**: `401` with `login`, an address; the client sends
  the user there, adding `next=<the page>`, and does not retry on its own.
  `403` with a reason a user can read. Stilo's server sends neither for
  access. The web app's handling of `401` is a transport middleware that
  wraps all others (`use(…, {outermost: true})`), so an extension can
  handle a `401` first.

*Reason:* a front end must work against servers that can do less (or
more) than Stilo's, and against a platform that knows its users (Papiro,
D18), without changing; describing the server and marking items in the
tree keeps the protocol plain HTTP, and reusing the read-only machinery of
phase 3 gives one behaviour whatever says an item is read-only. The client
adds `next` because it alone knows where the user was.

## S20 — 2026-11-18 — The Python side of extensions: storage, server extensions, CLI plugins

Refines S17 with what phase 5 settled; S17 stays in force.

- **`Storage` is an interface**, a `typing.Protocol` with the nine methods
  `create_app()` uses; the folder on disk is `FolderStorage`, the default,
  and `StorageWrapper` passes every call to another storage, so a wrapper
  overrides only what it changes. A storage refuses by raising the
  `StorageError` subclasses, which carry the HTTP status.
- **One value per server extension**: `ServerExtension(id, router,
  wrap_storage, capabilities, version)`, given to `create_app(storage,
  web_dist, extensions=…, middleware=…)`. Routers go under
  `/_api/x/<id>/`; wrappers wrap in order, the last outermost, and every
  route, Stilo's too, uses the result (`get_storage`); middleware wraps the
  whole app. A later loader of installed packages (phase 6) takes the same
  value from an entry point.
- **An extension's capabilities stay in its own entry** of `/_api/info`
  (`{id, version?, capabilities?}`), never in the protocol's list, so
  names cannot collide. Still protocol 1.
- **CLI commands from other packages** through the entry-point group
  `stilo.commands`, each a `Command`, listed after Stilo's own, sorted by
  name. Stilo's own commands win a name clash; a broken plugin, or one that
  loses a clash, is skipped with a warning, never stops `stilo`.
- **Public APIs are named and pinned**: `stilo.server.__all__` (the app,
  server extensions, storages, errors, the helpers another server reuses:
  file types and safety headers, ETags, the `~` rule) and
  `stilo.cli.__all__` (`Command`, `COMMANDS`, `main`, `create_engine`,
  `WEB_DIST`, `run_server`); anything else may change. A contract test
  writes Validation 3 and 7 with these names alone.
- **`stilo serve` takes no server extensions yet**: until phase 6, a
  package with one offers its own command to serve, built on
  `create_app()` and `run_server()`.

*Reason:* each point is the smallest design that lets the Validation
extensions be written as separate Python packages with the public API
alone. A protocol rather than a base class lets a storage of any kind
plug in without inheriting from Stilo; one value per extension keeps its
parts together and makes run-time loading a loader only; a plugin that
cannot break `stilo` or take its commands' names keeps installing one
safe. Pinned lists make the public API a deliberate choice, as the
`exports` map is for the npm package (S16).

## S21 — 2026-11-18 — A folder with `package.texl` is a package; "project" is left to OnLabs
The folder unit of S10 is renamed: a **package** is a folder with a
manifest, `package.texl`, which is its home (`~`). Everything else in S10 and
S11 is unchanged. The binding `project_name` becomes `package_name`; the
example moves to `examples/packages/beam/`, the guide to `docs/packages.md`,
the module to `stilo.cli.package`. `project.texl` is no longer read: a clean
rename, with no fallback, because two manifest names would blur the one home
rule. Only `stilo tutor` still recognises a tutorial copy made with
`project.texl`, so that it can propose `--reset`. This supersedes the name
"project" in S10.
*Reason:* the founder keeps the word *project* for planned work done with
Texl over a finite time, for a particular purpose, which may consist of one
or more packages: an OnLabs concept (`../CONCEPTS.md`), not a Stilo one.
"Package" is neutral: it names what the folder is, a bundle of Texl files
with its own `lib/`, nestable like npm or Cargo packages, without suggesting
a purpose. It is done before 1.0, while few folders have a manifest.

## S22 — 2026-11-18 — A package's references live in `references/` (was `lib/`)
Following OnLabs D23, the packages a package uses are its **references**,
and they live in its `references/` folder, which replaces `lib/` (S10). `stilo
init` creates `references/` and copies the Stilo library into
`references/stilo/`, so its import is `~/references/stilo/index.texl`; the
data and chart cells write that import, and the example package and the
tutorial (`references/tutorial/`, `references/steel/`) follow. Stilo
never gave `lib/` a meaning beyond `stilo init`, so an old `lib/` is
neither read nor warned about: it is an ordinary folder, and its imports
keep working until the user moves it. The rename ships in the same
version as S21, so users migrate once: rename `project.texl` to
`package.texl`, `lib/` to `references/`, and `~/lib/` to `~/references/`
in imports. Words follow too: in Stilo's docs, help texts and tutorial,
what a package imports from `references/` is a *reference*, not a
library; "the Stilo library" stays the name of that one reference, and a
document that gives names to values for others may still be called a
library. This supersedes the folder name `lib/` in S10 and S21.
*Reason:* OnLabs D23 gives Stilo and Papiro one vocabulary: a reference
is to a package what a library is to software, and "references" names
what the folder holds, as the references of an engineering report. A
fallback or a warning would keep two folder names alive for a rename that
costs users one `mv` and a search-and-replace, before 1.0.

## S23 — 2026-11-19 — Packed packages: a package in one `.texlz` file, read as a read-only folder
A **packed package** is a zip file named `*.texlz` (one constant,
`ARCHIVE_SUFFIX`) with `package.texl` at its root. Stilo reads it as a
folder that cannot be changed, everywhere it loads documents, and makes
one with `stilo pack`.

- **In `FolderStorage`**, not in the app, so a wrapped storage (Papiro
  wraps one per package) gets it too. A path through a `.texlz` file names
  an entry inside it; nested archives work the same way. The code is in
  `stilo/server/archive.py`, which the CLI's file loader shares, so the
  browser (through the server) and `stilo render` read archives alike.
- **The endpoint tells the file from the folder**, not the URL's shape:
  the path of the archive itself is the file for `/_api/files/` and the
  public URL (a download), and the folder for `/_api/tree/`. No trailing
  slash or query parameter carries meaning, which keeps paths as they are
  everywhere else in the protocol.
- **In the tree**, an archive is a folder node with `"archive": true` and
  its file's `size` and `modified`; its items carry `readOnly`. The
  archive node itself is not `readOnly`: the file moves, renames and
  deletes as one item (protocol v1 says a read-only folder cannot be
  moved). Writes inside get `403`. An archive keeps its extension when
  moved, and a folder cannot be named `*.texlz`, so an item never turns
  from a folder into a file. Still protocol 1, with the capability
  `archives`: a client that ignores `archive` sees read-only items.
- **`~` inside an archive** stands for its root, by the unchanged home
  rule: every archive holds a manifest, and `home_of`/`expand_home` take
  an `is_package` check that looks inside archives.
- **Untrusted, in memory**: never extracted; entries with absolute paths,
  `..`, links, duplicates, encryption or another compression are refused,
  as are archives over 10 000 entries, 256 MiB unpacked (by declared
  sizes, which reading enforces) or 8 levels of nesting. Opened archives
  are cached by path, modification time and size.
- **`stilo pack` is deterministic**: sorted entries, a fixed date and
  permissions, no folder entries, deflate at level 9 (archives inside
  stored). It packs every regular file except hidden entries, `~`, links
  and files git ignores (the repository's rules, not the user's global
  ones). `pack_package` is in `stilo.server.__all__` for Papiro's
  releases.

*Reason:* Papiro will publish a release as a packed package, a file people
download, email and keep; references then become packed packages, and a
single user shares a package the same way, so it belongs in open-source
Stilo. Reading in place keeps the release's bytes, and so its hash, the
identity of what was released; read-only follows from that. Deflate
rather than stored keeps files small; its bytes are the same for the same
zlib, which is the reproducibility a release needs (the hash is taken
once, of the file published).

## S24 — 2026-11-19 — The Stilo library goes into a package packed, as `references/stilo.texlz`
`stilo init` (and so `stilo tutor`) writes the Stilo library into a
package as a packed package (S23), `references/stilo.texlz`, instead of
copying it into a `references/stilo/` folder. Its import is
`~/references/stilo.texlz/index.texl`, which the data and chart cells
write. The source stays plain files in `texl-lib/`, which becomes a
package with its own `package.texl` (packing needs one); the archive is
packed when a package is made (`library_archive()`), so the wheel ships no
binary and needs no build step. The example package commits the packed
library, and a test checks its entries against `texl-lib/`. A package
made before keeps its `references/stilo/` folder, which still works; there
is no fallback in the cells, as for S21 and S22. Instead `stilo init`, run
in a folder that is already a package, no longer refuses: it leaves
`package.texl` as it is and adds a missing `references/stilo.texlz`, so
moving a package over is `stilo init` and a search-and-replace of the
imports. This supersedes the
folder `references/stilo/` of S10 and S22.
*Reason:* the library is a reference the user does not edit, and a packed
package says so: it opens read-only, travels as one file, and shows that
Stilo's own references are packed packages like those Papiro will
release. Packing at `init`, deterministically, keeps one source for the
library and gives every package made by one Stilo version the same bytes.

## S25 — 2026-11-19 — A folder, or a packed package, reads as its `index.texl`; `?download` fetches a file
A read of a folder or of a packed package is redirected (`307`) to its
`index.texl`, by both forms (`/_api/files/` and the public URL), with or
without a final `/`, after `~` is expanded; a browser asking for HTML
still gets the web app. The CLI's loader does the same, returning the
index as the final URL, from one rule (`INDEX`, `Archives.is_folder`). So
`texl.import "~/references/steel-revA.texlz"` or `"~/references/steel/"`
imports the reference's main document. The server does not check that the
index exists. `index.texl` was already the main document of the Stilo
library and of the tutorial's references.

Since the path of a packed package now reads as its index, its file is
fetched with **`?download`**, which works on any file and sends it as an
attachment. This supersedes, in S23, the archive's own path serving the
file. The storage interface gets a tenth method, `read_target(path)`,
where a read leads (`~` and the index), which replaces the app's use of
`expand_home` for redirects; this changes the interface of S20 (pre-1.0;
`StorageWrapper` passes it on). Protocol 1, with the capability `index`;
a read of a folder answered `400` before.

*Reason:* importing a package by its name is what a reference is for, and
an archive shown as a folder should read like one. A redirect, not the
content, keeps the index the document at its real path, so its relative
imports resolve from its folder, as with `~` (S11). The download needs its
own address because a server cannot tell an import from a download by the
request; a query parameter keeps every path meaning one thing.

## S26 — 2026-11-20 — Which git ignore rules count when packing (amends S23)
`pack_package` leaves out the files git ignores, by these rules:

- **A package that belongs to a repository**, one whose working tree it is
  in and which does not ignore the package folder (or a folder above it):
  that repository's rules count, as before (its `.gitignore` files, those
  above the package included, and `.git/info/exclude`).
- **Otherwise** (no repository, or one that ignores the package folder):
  the package counts as the top of a repository of its own, so only the
  `.gitignore` files inside it count.
- Never the user's global excludes (as in S23).
- **Stilo's own library** is packed with no ignore rules at all
  (`gitignore=False`, a keyword of `pack_package`): `texl-lib/` is Stilo's
  source, nothing in it is private.
- **Packing refuses** (`ArchiveError`) when `package.texl` would be left
  out, ignored or excluded, instead of writing an archive that cannot be
  read as a package.

*Reason:* installed in a git-ignored virtual environment of a project
(Papiro's `.venv/`), the library was packed by the project's rules, which
ignore every file in it: `stilo init` wrote an empty
`references/stilo.texlz`. A rule that ignores the package folder itself
says the folder is not part of that repository, not that each file in it
is private. Papiro's releases (Papiro P5) pack a checkout whose top is the
package, where both cases give the same result; a package in a subfolder
of a repository keeps the repository's rules, `*.log` at its top
included.
