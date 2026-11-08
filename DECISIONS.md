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
