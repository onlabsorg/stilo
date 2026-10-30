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
