# Architecture

*For developers who want to change Stilo. It describes how the code is organized, the parts and their most important
modules, classes and functions. Start with [Development
setup](setup.md).*

## Three parts and a contract

Stilo is one repository with three parts, kept strictly apart:

| Folder             | Part     | Language                  |
|--------------------|----------|---------------------------|
| `web/`             | Web app, with the editor in `web/src/editor/` | JavaScript (Lit web components, Vite), Node project `@onlabsorg/stilo-web`, published on npm (S16) |
| `src/stilo/server/`| Server   | Python (FastAPI), module `stilo.server` |
| `src/stilo/cli/`   | Command line | Python, module `stilo.cli` |

The server and the CLI are one Python package, `stilo`; the web app is
built into it, as `src/stilo/web/` (see
[Development setup](setup.md#the-package-stilo)). The web app's source is
also published on npm, as `@onlabsorg/stilo-web`
([setup](setup.md#the-npm-package-onlabsorgstilo-web)). The server never imports
the CLI. A third source folder, `texl-lib/`, is not code but Texl: the
library `stilo init` copies into projects, shipped in the package as
`stilo/texl-lib` ([Projects](projects.md)).

```text
        browser                                  your computer or server
┌──────────────────────────┐   protocol v0   ┌──────────────────────────────┐
│ web app (web/)           │   plain HTTP    │ server (stilo.server)        │
│  ├ core services, and    │ ──────────────▶ │  create_app(): HTTP routes   │
│  │ panes that show them  │  GET / POST /   │  Storage: one folder on disk │
│  └ <texl-editor>: cells, │  PUT / tree     │                              │
│    Texl as WebAssembly   │ ◀────────────── │  started by `stilo serve`    │
└──────────────────────────┘                 └──────────────────────────────┘
                                          stilo.cli (`stilo`): serve, render
```

The [protocol](protocol.md) is the contract between the web app and the
server: a few interactions over plain HTTP (GET, CREATE, UPDATE, QUERY the
tree, CREATE a folder, MOVE, DELETE). The rules that follow from it:

- The web app talks to the server **only** through the protocol, in
  `web/src/api.js` (the `Transport`, `stilo.transport`). So another server that speaks the protocol, in another
  language or with accounts and permissions, can replace the Python one.
- A change to the protocol is made in `docs/protocol.md` first,
  then in `src/stilo/server/` and `web/src/api.js`.
- Documents stay plain Texl files, and the protocol stays plain HTTP: a
  document's address is all that `texl.import` needs to read it.

The CLI depends on the server (it starts it), and on
[`pytexl`](https://github.com/onlabsorg/texl) to render
documents. The web app renders with
[`@onlabsorg/texl`](https://github.com/onlabsorg/texl),
the same Texl engine compiled to WebAssembly, in the browser. The server
never renders a document: it only reads and writes files.

## What runs where

When a user opens `http://127.0.0.1:8000/projects/beam/beam-check.texl`:

1. The browser asks for the address with `Accept: text/html`, so the server
   answers with the web app's `index.html`, and then its bundle from
   `/_app/`.
2. The app's router reads the path from the address (`web/src/route.js`);
   the services ask for the folder tree (`GET /_api/tree/`) and the
   document (`GET /_api/files/projects/beam/beam-check.texl`), and give the
   text to `<texl-editor>` ([The web app](web-app.md#the-core-srccore)).
3. The editor parses the text into cells, renders the whole document with
   Texl, as the document at its public address, and splits the rendering
   into the cells' outputs.
4. An import, `texl.import("../../library/steel.texl")`, is fetched by Texl
   from the public address `/library/steel.texl`, without `text/html`, so the
   server returns the file. An import from the project's libraries,
   `texl.import("~/lib/stilo/index.texl")`, is fetched as
   `/projects/beam/~/lib/stilo/index.texl`, and the server redirects it to
   the file under the project home, `/projects/beam/lib/stilo/index.texl`,
   which Texl takes as the library's URL ([Projects](projects.md)).
5. Ctrl+S commits the cell being edited and sends the text back with
   `PUT /_api/files/...` and the ETag of the last read, so a file changed
   meanwhile is not overwritten.

## Extension points

Stilo is getting an extension system, built in phases
([S16, S17](../DECISIONS.md)): anything beyond a single-user editor is built
outside Stilo, as an extension that uses it as a dependency and plugs into
public hooks. The core services are in place (the web app's state and
behaviour, which Stilo's own panes and commands use); the extension API
that opens them to others is being built: `startStilo()` and the
`extensions` service activate extensions
([The web app](web-app.md#extensions-startstilo-and-extensions)), and the
hooks open to them grow step by step. Each extension point lives in one
place:

| Extension       | The one place today                        | Planned (S17) |
|-----------------|--------------------------------------------|---------------|
| Extensions of the web app | `startStilo()` (`web/src/start.js`) and the `extensions` service (`web/src/core/extensions.js`) | More hooks; exports for front ends |
| Cell types      | The registry, `registerCell()` in `web/src/editor/registry.js` | Also `stilo.cells.register()` |
| Web app as a dependency | — | The npm package `@onlabsorg/stilo-web`; its public API is the `exports` map of `web/package.json` (S16) |
| Commands, keys, menus | The `commands`, `keys` and `menus` services (`web/src/core/`); Stilo's own in `web/src/builtins/commands.js` | Open to extensions |
| Right-pane panels, top bar, status line | The `panels`, `topBar` and `status` registries (`web/src/core/`), open to extensions, which may also replace a panel; Stilo's own panels in `web/src/builtins/panels.js` | — |
| Tree markers, filters, read-only items | Providers in the `tree` service (`decorate`, `filter`, `readOnly`); read-only documents open in the editor's read-only mode; commands say when they do not apply (`enabled`). The navigation pane itself stays core | — |
| Comments from elsewhere, marks on cells | Comment providers in the `comments` service (`addProvider`) and mark providers in the `editor` service (`decorate`), anchored to cells by name | — |
| Pages that are not documents | The `views` service (`web/src/core/registry.js`), addressed by `?view=<id>` (`route.js`, `router`) | — |
| Server access | The `transport` service, a `Transport` (`web/src/api.js`): replaceable (`startStilo({transport})`), wrapped by middleware (`transport.use`); Texl imports go through it (the editor's `loader`) | — |
| CLI commands    | The `COMMANDS` list in `src/stilo/cli/commands.py` | Also from other packages, by a Python entry-point group |
| Server          | `create_app()` in `src/stilo/server/app.py` | `create_app()` takes a storage, routers and middleware; extension endpoints under `/_api/x/<id>/` |

How it fits together, in short: core services hold the state and the
behaviour, and panes only show them, reaching the services through Lit
context ([The web app](web-app.md#the-core-srccore)). An extension is an object with `activate(stilo)`, which registers
its contributions; each registration returns a `dispose()`. Stilo's own
panes and commands are registered the same way, so the API stays complete.
A guide, `docs/extensions.md`, comes with the extension API.

## Conventions that apply everywhere

- **Users are not programmers.** Stilo is for engineers, finance people and
  other Word and Excel users. Every visible feature is judged by how
  familiar it feels to them.
- **The editor owns the document.** Cells are views of their Texl source
  and report changes by events. No cell data lives outside the source.
- **Documents are untrusted.** Rendered HTML is always sanitized
  (DOMPurify), and the server never executes documents; other files opened
  by their URL are sandboxed if they could run scripts (`docs/protocol.md`).
- **Single user.** Accounts, organizations, permissions, revisions,
  release and accept are not Stilo's job: they belong to a platform built
  on top of it, which speaks the same protocol.

## In this guide

- [Development setup](setup.md): build, run and test everything.
- [The server](server.md): `Storage` and `create_app()`.
- [The CLI](cli.md): `Command` and `COMMANDS`.
- [Projects and the Stilo library](projects.md): `project.texl`, `~`,
  `lib/`.
- [The web app](web-app.md): the shell around the editor.
- [The editor](editor.md): `<texl-editor>`, cells, rendering;
  [Editor design](editor-design.md): the editing model and its open points.
- [Texl primer](texl-primer.md): the Texl you need to work on the editor.
- [Protocol](protocol.md): the contract between web app and server.
- [The editor component](component/README.md): embedding `<texl-editor>`
  and its API.
- [Decisions](../DECISIONS.md): the decisions behind this design.
- [Contributing](../CONTRIBUTING.md): how to propose a change.
