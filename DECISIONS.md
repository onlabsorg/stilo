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
