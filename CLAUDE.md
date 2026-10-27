# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project

Stilo is the editor for [Texl](https://github.com/onlabsorg/texl) documents,
part of OnLabs.org: it edits a folder of interconnected `.texl` files, as
Word edits `.docx` files. Its users are engineers, finance people and other
Word/Excel users, not programmers: every visible feature is judged by how
familiar it feels to them. Open source, MIT.

Stilo is **single-user**: it reads and writes one folder, locally or on a
server the user runs. Whether the folder is a git repository does not
concern Stilo. Accounts, organisations, permissions, revisions, release and
accept belong to Papiro, the private OnLabs platform built on top of Stilo.
The strategy lives one folder up, in the OnLabs.org coordination folder
(`../VISION.md`, `../CONCEPTS.md`, `../DECISIONS.md`, D18–D19); read it only
when a task needs the "why".

A monorepo with three parts, kept strictly modular:

- **Web app** (`web/`) — the user interface: top bar, navigation pane (file
  tree), main area with the editor, right pane (commands, comments). The
  editor itself (`web/src/editor/`, the `<texl-editor>` component and its
  cells) was the `texl-editor` repository until 2026-10-26.
- **Server** (`src/stilo/server/`, module `stilo.server`) — Python, serves
  the documents of one folder over HTTP, and the built web app.
- **CLI** (`src/stilo/cli/`, module `stilo.cli`) — the `stilo` command:
  `render` a document, `serve` a folder. It is the only Texl command line
  (D19).

**One package, one Python project.** `pyproject.toml` at the root is the
only Python project and builds the only published package, `stilo`
(distribution name `stilo-cli` on PyPI, which refuses `stilo` as too close
to `stl10`; the command and the import name stay `stilo`)
(sources in `src/stilo/`, tests in `tests/`, one `uv.lock`). The web app's
source stays in `web/` (its own Node project); `npm run build` writes it
into the package, `src/stilo/web/` (git-ignored), so a checkout and an
install have the same layout. The server never locates the web app: the
CLI passes it to `create_app()` (`WEB_DIST` = `stilo/web`). The server
must not import the rest of the package (`tests/test_layout.py` checks
it), and neither imports the web app's code. A future part (e.g. a
desktop window around the web app) goes in as another subpackage of
`stilo`, as a client of the server, with its dependencies as an extra.

The **protocol** (`docs/src/protocol.md`, plain HTTP: GET, CREATE
(POST), UPDATE (PUT with `If-Match`), QUERY tree) is the contract between
web app and server. Change it there first, then in `src/stilo/server/` and
`web/src/api.js`. Papiro is meant to speak the same protocol, so the web
app must use only it, and a server in another language (e.g. Node.js) must
be able to replace the Python one.

**Plugins later.** There is no plugin system yet, but there will be (custom
cells, CLI commands, loaders). Keep the extension points in one place each,
so a plugin system can be added without refactoring: cell types only through
the registry (`web/src/editor/registry.js`), CLI commands only through
`COMMANDS` (`src/stilo/cli/commands.py`), the server only through
`create_app()`.

## Summary for OnLabs.org (`stilo.summary.md`)

`stilo.summary.md` (repository root, committed) is the factual summary of
this repository for the OnLabs.org coordination folder (the parent folder):
what it is, how it is built at a high level, published versions, status,
next steps and known limitations. Strategy sessions read it instead of the
code. Strategic matters (why it matters for OnLabs, priorities, timing,
strategic open points) are not written here: they live in the coordination
folder's `SUBPROJECTS.md`.

**When to update it:** only when the user runs `/commit-changes` (the skill
in `.claude/skills/commit-changes/`). The skill updates the summary with the
pending changes and with any commits it does not cover yet, then commits the
changes and the summary together. The summary covers every commit up to and
including the last commit that changed it (`git log -1 --
stilo.summary.md`). Do not update the summary or commit on your own
initiative; if a task clearly makes the summary outdated, say so once at the
end and suggest running `/commit-changes`.

**Decisions from the coordination folder:** at the start of a session, if
`../DECISIONS.md` exists, check it for entries dated after the last commit
that changed the summary (`git log -1 --format=%ad --date=short --
stilo.summary.md`) that concern this repository, and tell the user about
any you find before starting the task.

Rules:

- Stay at helicopter level, in plain words for a non-programmer reader; code
  details belong in this repository's docs and this file.
- Do not write strategic content or decisions into the summary.
- English; Markdown wrapped at about 80 characters.

## Stack and commands

**Python** (server and CLI): Python ≥ 3.11, FastAPI + uvicorn, `pytexl`
for rendering, managed with `uv`. All commands at the root.

```bash
uv sync && uv run pytest              # tests/: server/, cli/, test_layout.py
uv run stilo serve examples           # http://127.0.0.1:8000
uv run stilo render examples/projects/beam/beam-check.texl
uv build                              # after npm run build: dist/stilo_cli-*.whl
```

**Web** (app and editor): plain JavaScript (ES modules, JSDoc types, no
TypeScript, no build step for the source) with Lit 3 web components, built
with Vite. Texl runs in the browser as WebAssembly (`@onlabsorg/texl`).
Cell output is sanitised with DOMPurify; Markdown cells convert it with
`marked` first. Text is edited with CodeMirror 6 (`@codemirror/*`).
Requires Node.js 22 or later; locally Node is managed by nvm, so
non-interactive shells must run `source ~/.nvm/nvm.sh` first.

```bash
cd web
npm install
npm test             # @web/test-runner in headless local Chrome: test/**/*.test.js
npm run build        # src/stilo/web/, served by the Python server under /_app/
npm run dev          # Vite on :5173 with hot reload; proxies to the server on :8000
                     # (STILO_SERVER=http://127.0.0.1:8765 npm run dev for another port)
```

Two ways to run it:

- **One process:** `npm run build`, then `uv run stilo serve examples`
  at the root; open <http://127.0.0.1:8000/projects/beam/beam-check.texl>.
- **Development:** `uv run stilo serve examples` and `npm run dev` side
  by side; open <http://localhost:5173/projects/beam/beam-check.texl>.
  Vite serves the pages and forwards `/_api` and non-HTML `.texl` requests
  (imports).

The app shell has no tests yet (the editor has). To check the UI, run the
server and drive it with a headless browser (puppeteer-core with the local
Chrome works). CI: `.github/workflows/stilo.yml` (tests, web build, and
the `package` job: builds the wheel, installs it, smoke-tests `render` and
`serve`). Release: `.github/workflows/release.yml`, at a pushed tag
`vX.Y.Z` matching `pyproject.toml` and a `CHANGELOG.md` entry: tests,
builds, publishes on PyPI (Trusted Publishing, environment `pypi`) and
creates the GitHub release. Bump the version in `pyproject.toml`,
`web/package.json` and `src/stilo/server/app.py`.

## Code layout

- `pyproject.toml` — the Python project and published package `stilo` (see
  above). `tests/` — its tests.
- `docs/` — the documentation, as in Texl: `docs/build.sh` builds the
  site into `target/site` (git-ignored); the workflow
  `.github/workflows/docs.yml` builds and publishes it on GitHub Pages
  (<https://www.onlabs.org/stilo/>) at every push to `main`. Style guide:
  `docs/STYLE.md`.
  - `src/` (mdBook, `book.toml`): user chapters (`getting-started.md`,
    `cli/`, `editor/`, `file-format.md`), `protocol.md` (protocol v0: URL
    space, the four interactions, errors, public document URLs, why plain
    HTTP — also the contract), `component/` (embedding guide and editor
    API reference), `dev/` (developer guide: architecture, setup, server,
    CLI, web app, editor, editor design with open points, Texl primer,
    docs).
  - `site/index.html` (landing), `assets/` (copies of the Texl site's
    CSS/JS, plus `stilo.css`, `book.js`).
- `CONTRIBUTING.md`, `CHANGELOG.md` — included in the manual.
- `src/stilo/server/storage.py` — `Storage`: path validation (no `..`,
  no hidden segments, no `_` names at the root, no escape through symlinks),
  read / create / update / tree, ETags (sha256). Raises `StorageError`
  subclasses carrying the HTTP status.
- `src/stilo/server/app.py` — `create_app(root, web_dist)`: the
  `/_api/` routes, `/_app/` static bundle, and `/<path>` (web app for
  browsers, the file for other clients).
- `src/stilo/cli/commands.py` — the subcommands (`render`, `serve`) as
  `Command` entries in `COMMANDS`; `main()` in `src/stilo/cli/__init__.py`
  builds the parser from them (the `stilo` script, `python -m stilo`).
- `web/src/main.js` — entry: theme CSS, the editor, the app.
- `web/src/components/stilo-app.js` — the shell: layout, state (navigation
  root and tree, open document, ETag, dirty flag, open pane), routing,
  commands (save, new, …), editor events.
- `web/src/components/top-bar.js`, `nav-pane.js`, `commands-pane.js`,
  `comments-pane.js` — the parts of the layout. They fire events; the app
  holds the state.
- `web/src/commands.js` — the command list shown in the commands pane, with
  shortcuts. Editor commands send the editor's own key as a synthetic
  `keydown` (a stopgap until the editor has a command API).
- `web/src/route.js` — browser URL ↔ `{root, doc}`. `web/src/api.js` —
  protocol client. `web/src/theme.js`,
  `theme.css` — light/dark theme (default dark), design tokens as CSS custom properties, also mapped onto
  the editor's `--texl-*` properties.
- `web/src/editor/` — the editor:
  - `index.js` — registers the built-in cells and `<texl-editor>`,
    re-exports the editor API.
  - `texl-editor.js` — `TexlEditor`: holds the cells, keyboard navigation,
    edit mode, and rendering (one `engine.render` of the whole document per
    pass, split into cell outputs at the markers by `splitRendering`).
    Public surface: `value`, `url`, `rows`, events `change`,
    `comments-click`, `selection-change`, `name-conflict`, and `rendered`.
  - `texl-cell.js` — `TexlCell`, base class of all cells: modes, layout,
    commit protocol (`cell-change` with `{texl}`, then `cell-exit`).
  - `cells/` — built-in cell types (`text`, `markdown`); formulas are
    `<% %>` tags inside them, there is no formula cell (D11).
  - `registry.js` — `registerCell(CellClass)`; unknown types fall back to
    `text`. `document.js` — parse/serialise (round-trip exact), cell names,
    comments, `splitRendering`. `swan.js` — Swan highlighting. `engine.js`
    — loads the wasm module once, creates engines.
- `web/test/` — the editor's browser tests.
- `examples/` — sample documents: `library/steel.texl`,
  `projects/beam/beam-check.texl` (imports it), `sample.texl`.

## File format

One Texl text file per document. Each cell starts with a marker line
`<!--{ name : type }-->`; text before the first marker is a `text` cell
without marker. The name (4 lowercase alphanumerics, unique, compared
without case) is generated by the editor and not shown. Cell comments are
`<!--[ ... ]-->`; other HTML comments are ignored. The file must stay a
valid Texl document that renders without the editor (`stilo render`,
`pytexl`, `texl.import`).

## Conventions

- The UI must feel familiar to Word/Excel users and look light and modern.
  Colours only through the tokens in `theme.css`; both themes must work.
- The editor owns the document; cells are views of their Texl source and
  report changes by events. Don't keep cell data outside the Texl source.
- Lit in plain JS: declare reactive properties in `static properties` and
  initialise them in the constructor, never as class fields.
- A cell that handles a key itself calls `preventDefault()`; the editor
  ignores keydown events that are already default-prevented.
- Documents are untrusted: rendered HTML is always sanitised; the server
  never executes documents.
- Tests of the editor run in a real browser (custom elements, wasm).
  Synthetic key events in tests need `cancelable: true`.
- `vite.config.js` excludes `@onlabsorg/texl` from `optimizeDeps`; the wasm
  file is loaded relative to `texl_wasm.js`.
- Keep the protocol plain HTTP and the stored documents plain Texl files.
- When the protocol, a command, the layout, the editing model or the
  editor API changes, update the matching chapters in `docs/`, rebuild the site with `docs/build.sh`, update this
  file, and add a line to `CHANGELOG.md`. Status changes go into
  `stilo.summary.md` (see above); decisions are recorded in the coordination folder (`../DECISIONS.md`), not here.
- `local/` is git-ignored, for local notes.
- English; Markdown wrapped at about 80 characters.

## Known limitations

- **Save** writes the editor's committed cells: a cell still in edit mode
  is not saved until committed (Mod+Enter).
- **App ↔ editor:** the app drives editor commands with synthetic keys and
  cannot select a line from the comments pane; the editor needs a small
  API (`runCommand(name)`, `select(line)`).
- **No authentication:** `stilo serve` is meant for one user; bind it to
  localhost, or put it behind your own access control when serving
  remotely.
