# Architecture

*For developers who want to change Stilo. It describes how the code is organized, the parts and their most important
modules, classes and functions. Start with [Development
setup](setup.md).*

## Three parts and a contract

Stilo is one repository with three parts, kept strictly apart:

| Folder             | Part     | Language                  |
|--------------------|----------|---------------------------|
| `web/`             | Web app, with the editor in `web/src/editor/` | JavaScript (Lit web components, Vite), Node project `@onlabsorg/stilo-web` (private) |
| `src/stilo/server/`| Server   | Python (FastAPI), module `stilo.server` |
| `src/stilo/cli/`   | Command line | Python, module `stilo.cli` |

The server and the CLI are one Python package, `stilo`, and the only
published one; the web app is built into it, as `src/stilo/web/` (see
[Development setup](setup.md#the-package-stilo)). The server never imports
the CLI.

```text
        browser                                  your computer or server
┌──────────────────────────┐   protocol v0   ┌──────────────────────────────┐
│ web app (web/)           │   plain HTTP    │ server (stilo.server)        │
│  ├ app shell: navigation,│ ──────────────▶ │  create_app(): HTTP routes   │
│  │ panes, commands, save │  GET / POST /   │  Storage: one folder on disk │
│  └ <texl-editor>: cells, │  PUT / tree     │                              │
│    Texl as WebAssembly   │ ◀────────────── │  started by `stilo serve`    │
└──────────────────────────┘                 └──────────────────────────────┘
                                          stilo.cli (`stilo`): serve, render
```

The [protocol](protocol.md) is the contract between the web app and the
server: four interactions over plain HTTP (GET, CREATE, UPDATE, QUERY the
tree). The rules that follow from it:

- The web app talks to the server **only** through the protocol, in
  `web/src/api.js`. So another server that speaks the protocol, in another
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
2. The app reads the path from the address (`web/src/route.js`), asks for
   the folder tree (`GET /_api/tree/`) and the document
   (`GET /_api/files/projects/beam/beam-check.texl`), and gives the text to
   `<texl-editor>`.
3. The editor parses the text into cells, renders the whole document with
   Texl, as the document at its public address, and splits the rendering
   into the cells' outputs.
4. An import, `texl.import("../../library/steel.texl")`, is fetched by Texl
   from the public address `/library/steel.texl`, without `text/html`, so the
   server returns the file.
5. Ctrl+S sends the text back with `PUT /_api/files/...` and the ETag of
   the last read, so a file changed meanwhile is not overwritten.

## Extension points

There is no plugin system yet, but there will be: custom cell types, CLI
commands, loaders. Each extension point lives in one place, so a plugin
system can be added without restructuring:

| Extension       | The one place                              |
|-----------------|--------------------------------------------|
| Cell types      | The registry, `registerCell()` in `web/src/editor/registry.js` |
| CLI commands    | The `COMMANDS` list in `src/stilo/cli/commands.py` |
| Server          | `create_app()` in `src/stilo/server/app.py` |

## Conventions that apply everywhere

- **Users are not programmers.** Stilo is for engineers, finance people and
  other Word and Excel users. Every visible feature is judged by how
  familiar it feels to them.
- **The editor owns the document.** Cells are views of their Texl source
  and report changes by events. No cell data lives outside the source.
- **Documents are untrusted.** Rendered HTML is always sanitized
  (DOMPurify), and the server never executes documents.
- **Single user.** Accounts, organizations, permissions, revisions,
  release and accept are not Stilo's job: they belong to a platform built
  on top of it, which speaks the same protocol.

## In this guide

- [Development setup](setup.md): build, run and test everything.
- [The server](server.md): `Storage` and `create_app()`.
- [The CLI](cli.md): `Command` and `COMMANDS`.
- [The web app](web-app.md): the shell around the editor.
- [The editor](editor.md): `<texl-editor>`, cells, rendering;
  [Editor design](editor-design.md): the editing model and its open points.
- [Texl primer](texl-primer.md): the Texl you need to work on the editor.
- [Protocol](protocol.md): the contract between web app and server.
- [The editor component](component/README.md): embedding `<texl-editor>`
  and its API.
- [Contributing](../CONTRIBUTING.md): how to propose a change.
