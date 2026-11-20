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
when a task needs the "why". Stilo's own decisions (design, technology,
architecture) are in `DECISIONS.md` at the root of this repository.

A monorepo with three parts, kept strictly modular:

- **Web app** (`web/`) — the user interface: top bar, navigation pane (file
  tree), main area with the editor, right pane (commands, comments). The
  editor itself (`web/src/editor/`, the `<texl-editor>` component and its
  cells) was the `texl-editor` repository until 2026-10-26.
- **Server** (`src/stilo/server/`, module `stilo.server`) — Python, serves
  the documents of one folder over HTTP, and the built web app.
- **CLI** (`src/stilo/cli/`, module `stilo.cli`) — the `stilo` command:
  `init` a package, `pack` it into one file, `render` a document, `serve`
  a folder, `tutor` (the tutorial). It is the only Texl command line (D19).

Beside them, `texl-lib/` (root) is the **Stilo Texl library**: Texl
documents, not code, a package itself (`texl-lib/package.texl`), that
`stilo init` packs into a package's `references/stilo.texlz` (S24);
shipped in the wheel as `stilo/texl-lib` (hatch
`force-include`), read in place in a checkout (`TEXL_LIB` in
`src/stilo/cli/package.py`); `tutorial/` (root, S14) is shipped and read the
same way. **Packages** (S10, S21, S22, `docs/packages.md`; OnLabs D23): a
folder with `package.texl` is a package (a *Texl package*, not the Python
package; a "project" until 0.5), its *home*; the packages it uses, its
**references**, are in its `references/` folder (`lib/` until 0.5); in an
import path a `~`
segment stands for the home of the folder before it, resolved left to
right, by the server on reads (a protocol rule: a `307` redirect to the real
path) and by the CLI's file loader (which returns the real file as the final
URL), with one shared rule in `src/stilo/server/home.py`. The real path is
thus the document's identity for Texl (final URLs, Texl 0.8; S11). More
than 16 `~` segments are refused, a safeguard. **Packed packages** (S23):
a package in one zip file, `*.texlz` (`ARCHIVE_SUFFIX`) with
`package.texl` at its root, read as a read-only folder by
`FolderStorage` and by the CLI's loader alike (`src/stilo/server/archive.py`):
a path through the file names an entry, nested archives too; the tree
lists it as a folder (`"archive": true`, items `readOnly`); writes
inside get `403`; `~` inside one is its root. `stilo pack` makes one,
deterministically (`pack_package`, public). **A folder reads as its
index** (S25): a read of a folder or a packed package (not by a browser
asking for HTML) is redirected to its `index.texl` (`Storage.read_target`;
the CLI's loader returns it as the final URL), so `texl.import
"~/references/steel-revA.texlz"` imports its main document; `?download`
fetches a file itself, the zip of a packed package included.

**One package, one Python project.** `pyproject.toml` at the root is the
only Python project and builds the only Python package, `stilo`
(distribution name `stilo-cli` on PyPI, which refuses `stilo` as too close
to `stl10`; the command and the import name stay `stilo`)
(sources in `src/stilo/`, tests in `tests/`, one `uv.lock`). The web app's
source stays in `web/` (its own Node project); `npm run build` writes it
into the package, `src/stilo/web/` (git-ignored), so a checkout and an
install have the same layout. The server never locates the web app: the
CLI passes it to `create_app()` (`WEB_DIST` = `stilo/web`). The server
must not import the rest of the package (`tests/test_layout.py` checks
it), and neither imports the web app's code. The web app's source is
also published on npm as `@onlabsorg/stilo-web` (S16): `web/` as it is,
`files` = `src/`, public API = the `exports` map (`.` → `src/main.js`:
the app, `startStilo`, `API_VERSION`, `createStilo`, `StiloController`,
`StiloProvider`, `stiloContext`;
`./editor` → `src/editor/index.js`, `./theme.css`); a new entry point is
added only by a decision. `web/package-check/` checks it as a consumer
gets it. A future part (e.g. a
desktop window around the web app) goes in as another subpackage of
`stilo`, as a client of the server, with its dependencies as an extra.

The **protocol** (`docs/protocol.md`, plain HTTP: GET, CREATE
(POST), UPDATE (PUT with `If-Match`), QUERY tree, CREATE folder, MOVE, DELETE)
is the contract between
web app and server. Change it there first, then in `src/stilo/server/` and
`web/src/api.js`. Papiro is meant to speak the same protocol, so the web
app must use only it, and a server in another language (e.g. Node.js) must
be able to replace the Python one.

**Extensions** (S16, S17; built in phases). Anything beyond a
single-user editor is built outside Stilo, as an extension that uses Stilo
as a dependency; a missing hook is added to Stilo in general terms, never
for one consumer. The web app is published on npm as `@onlabsorg/stilo-web`
(S16): its public API is the `exports` map of `web/package.json`, nothing
else. The design (S17): core services hold the state and behaviour, panes
only show them, through Lit context; visible contributions go through
registries (no slots); Stilo's own panes and commands use the same API,
except the navigation pane, which is core and extended through the `tree`
and `menus` services. The core services are in place (`web/src/core/`,
phase 2), and so is the extension API of the web app (phase 3, S18;
guide and reference: `docs/extensions.md`):
`startStilo({target, extensions, transport})` (`web/src/start.js`) and the
`extensions` service (`web/src/core/extensions.js`) activate extensions,
each through a scoped `stilo` that records its registrations (the table
`REGISTRATIONS` there: a new hook returning `dispose()` is added to it,
to `docs/extensions.md` and to the contract test,
`web/test/contract.test.js`). Protocol v1 (S17 phase 4, S19) gives the
server's side: `/_api/info`, `/_api/x/<id>/` reserved, read-only items,
`401` with a login address and `403` with a reason. Phase 5 (S20) gives
the Python side: `create_app()` takes any storage (`Storage`, the
interface; `FolderStorage`, the default; `StorageWrapper`), server
extensions (`ServerExtension`: a router mounted under `/_api/x/<id>/`, a
storage wrapper, listed in `/_api/info`) and middleware; its public API
is `stilo.server.__all__`. CLI commands come also from other packages,
through the entry-point group `stilo.commands` (each a `Command`); the
CLI's public API is `stilo.cli.__all__`. A change to either list, or to
a hook of the Python side, updates `docs/extensions.md` ("Server and CLI
extensions") and the Python contract test,
`tests/test_extension_contract.py` (Validation 3 and 7 as separate
packages, public names only). Phase 6 (plugins loaded at run time from
`pip`, `stilo serve` taking their server extensions) is not built.
Keep each extension point in one place: cell types only through the registry
(`web/src/editor/registry.js`), CLI commands only through `COMMANDS`
(`src/stilo/cli/commands.py`) and the `stilo.commands` entry points, the
server only through `create_app()`.
Never shape a hook around one known consumer.

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
any you find before starting the task. Their consequences for Stilo are
recorded in this repository's `DECISIONS.md` (see Conventions).

Rules:

- Stay at helicopter level, in plain words for a non-programmer reader; code
  details belong in this repository's docs and this file.
- Do not write strategic content or decisions into the summary.
- English; Markdown wrapped at about 80 characters.

## Stack and commands

**Python** (server and CLI): Python ≥ 3.11, FastAPI + uvicorn, `pytexl`
for rendering, managed with `uv`. All commands at the root.

```bash
uv sync && uv run pytest              # tests/: server/, cli/, texl_lib/, tutorial/, test_layout.py,
                                      #   test_extension_contract.py
uv run stilo serve examples           # http://127.0.0.1:8010
uv run stilo render examples/packages/beam/beam-check.texl
uv run stilo init path/to/package     # package.texl, references/stilo.texlz
uv run stilo pack path/to/package     # path/to/package.texlz, deterministic
uv run stilo tutor --dir /tmp/t       # copies tutorial/ there, serves it
uv build                              # after npm run build: dist/stilo_cli-*.whl
```

**Web** (app and editor): plain JavaScript (ES modules, JSDoc types, no
TypeScript, no build step for the source) with Lit 3 web components, built
with Vite; services reach the panes by `@lit/context`. Texl runs in the
browser as WebAssembly (`@onlabsorg/texl`).
Cell output is sanitised with DOMPurify; Markdown cells convert it with
`marked` first, typesetting LaTeX equations with KaTeX (`math.js`). Source text is edited with CodeMirror 6 (`@codemirror/*`), rich text with ProseMirror (`prosemirror-*`). The document font
(Atkinson Hyperlegible Next) comes from `@fontsource-variable/*`, imported in
`web/src/main.js` and bundled by the build; the typography is in
`TexlCell`'s styles (`.view`), see `docs/editor-design.md`.
Requires Node.js 22 or later; locally Node is managed by nvm, so
non-interactive shells must run `source ~/.nvm/nvm.sh` first.

```bash
cd web
npm install
npm test             # @web/test-runner in headless local Chrome: test/**/*.test.js
npm run build        # src/stilo/web/, served by the Python server under /_app/
npm run smoke        # after the build: smoke/*.test.js, node --test + puppeteer-core
                     # against `uv run stilo serve` on a copy of examples/ ($STILO)
npm run dev          # Vite on :5173 with hot reload; proxies to the server on :8010
                     # (STILO_SERVER=http://127.0.0.1:8765 npm run dev for another port)
npm run check-package  # packs @onlabsorg/stilo-web, installs it in package-check/consumer/
                       # (a small Vite project), builds it (--out=<dir> keeps the tarball)
```

Two ways to run it:

- **One process:** `npm run build`, then `uv run stilo serve examples`
  at the root; open <http://127.0.0.1:8010/packages/beam/beam-check.texl>.
- **Development:** `uv run stilo serve examples` and `npm run dev` side
  by side; open <http://localhost:5173/packages/beam/beam-check.texl>.
  Vite serves the pages and forwards `/_api` and the public URLs of files
  (imports, images, PDFs).

The app shell has only smoke tests (`web/smoke/app-shell.test.js`: open,
edit and save, reload, open from the navigation pane; any page error fails
them); a new main path of the shell gets one there. To check other UI
behaviour, run the server and drive it with a headless browser
(puppeteer-core with the local Chrome works). CI: `.github/workflows/stilo.yml` (tests, web build, the npm package check, and
the `package` job: builds the wheel, installs it, smoke-tests `render` and
`serve`, and runs the app-shell smoke tests against the installed
`stilo`). Release: `.github/workflows/release.yml`, at a pushed tag
`vX.Y.Z` matching `pyproject.toml`, `web/package.json` and a
`CHANGELOG.md` entry: tests, builds, checks the npm package, publishes on
PyPI and npm (Trusted Publishing, environments `pypi` and `npm`; npm gets
the tarball the check packed) and creates the GitHub release. Bump the version in `pyproject.toml`,
`web/package.json` and `src/stilo/server/app.py`.

## Code layout

- `pyproject.toml` — the Python project and published package `stilo` (see
  above). `tests/` — its tests.
- `docs/` — the developer documentation, plain Markdown read on GitHub
  (no build, no site; relative links only). Index: `docs/README.md`;
  style guide: `docs/STYLE.md`. `architecture.md`, `setup.md`,
  `server.md`, `cli.md`, `packages.md` (packages, `~`, `texl-lib/`), `web-app.md`, `editor.md`, `editor-design.md`
  (editing model, open points), `texl-primer.md`, `tutorial.md` (how the
  tutorial is built and kept current), `protocol.md` (protocol
  v1: URL space, `/_api/info`, `/_api/x/`, the interactions, read-only
  items, packed packages, login and refusals, errors, public document
  URLs, why plain HTTP — also the contract), `component/` (embedding guide and
  editor API reference).
- The **user manual** (getting started, the web editor, the `stilo`
  command, the file format) is not in this repository: it is the
  OnLabs.org manual (<https://www.onlabs.org/manual/>), built from the
  `onlabsorg.github.io` repository and kept current from this repository's
  commits and docs by a session in the coordination folder (D21). Only
  `README.md` links to it.
- `CONTRIBUTING.md`, `CHANGELOG.md` — at the root.
- `DECISIONS.md` — Stilo's decision log (S1, S2, …), at the root.
- `src/stilo/server/home.py` — the package home rule: `MANIFEST`
  (`package.texl`), `home_of`, `expand_home` (left to right, `MAX_HOMES`),
  shared by the server and the CLI.
- `src/stilo/server/storage.py` — `Storage`, the interface of a storage
  (a `typing.Protocol`: the ten methods `create_app()` uses; S17 phase
  5, `read_target` S25); `StorageWrapper` (passes every call to another storage; a wrapper
  overrides what it changes); `is_document`; `FolderStorage`, the default:
  path validation (no `..`,
  no hidden segments, no `~` names, no `_` names at the root, no escape
  through symlinks), `expand_home` on reads,
  read / create / update / move / delete (to `.trash`) / tree, ETags (sha256);
  `read_only` (what the server cannot write, from the file system's
  permissions: `readOnly` in the tree, `Forbidden` (403) on writing it);
  packed packages (`_inside`, `_check_not_inside`, `IN_ARCHIVE`,
  `self.archives`). Raises `StorageError` subclasses carrying the HTTP
  status.
- `src/stilo/server/archive.py` — packed packages (S23): `ARCHIVE_SUFFIX`,
  `is_archive`, `ArchiveError`; `Archive` (one zip read and checked in
  memory: the safety rules and limits `MAX_*`, entries, nested archives);
  `Archives` (the cache by path, mtime and size; `locate`, `read`,
  `is_package`, used by the storage and the CLI's loader);
  `package_files`, `pack_package` (deterministic; which git ignore rules
  count, `_git_ignored`, S26; `gitignore=False` for the library). Imports
  only `home.py`.
- `src/stilo/server/app.py` — `create_app(storage | root, web_dist, *,
  extensions, middleware)` (a path is a `FolderStorage`; the storage, as
  wrapped by the extensions, kept as `app.state.storage`): the
  `/_api/` routes (`/_api/info` from `PROTOCOL`, `VERSION`,
  `CAPABILITIES` and the extensions; the extensions' routers under
  `/_api/x/<id>/`, then a `404` catch-all there), `/_app/` static bundle,
  and `/<path>` (web app for browsers, the file for other clients);
  `read_redirect` (`~`, a folder's index), `?download`.
- `src/stilo/server/files.py` — files by their public URL:
  `DOCUMENT_SUFFIX`, `is_document`, `etag`, `FILE_TYPES`, `media_type`,
  `other_file_response` (type and safety headers), `download_response`
  (`?download`), `INDEX` (`index.texl`, S25), `NO_CACHE`.
- `src/stilo/server/__init__.py` — the server's public API, `__all__`
  (the app, server extensions, storages, errors, files helpers, the home
  rule, packed packages), pinned by `tests/server/test_public_api.py`; anything else may
  change.
- `src/stilo/server/extensions.py` — `ServerExtension` (`id`, `router`,
  `wrap_storage`, `capabilities`, `version`), `check_extensions`,
  `get_storage` (the FastAPI dependency an extension's endpoint uses).
- `src/stilo/cli/package.py` — `create_engine()` (the one place an engine
  is made; its file loader resolves `~`, top: `$HOME` or `/`, and reads
  inside packed packages through `ARCHIVES`), `TEXL_LIB`, the text of a
  new `package.texl`.
- `texl-lib/` — the Stilo Texl library, a package (`package.texl`): `index.texl` binds `stilo`,
  gathering one document per function (`dataframe.texl`:
  `stilo.dataframe`; `charts.texl`: `stilo.charts.line`, an SVG line
  chart). Tested by the cases in `tests/texl_lib/<function>-cases.json`,
  run on both engines
  (`tests/texl_lib/`, `web/test/texl-lib.test.js`). Its text must not quote its own
  import tag: tags run even in code blocks. Swan texts have no escapes:
  markup written in Swan quotes its attributes with `'`.
- `tutorial/` — the tutorial (S14, `docs/tutorial.md`): `index.texl`,
  lessons `NN-name.texl`, `files/`, `references/tutorial/` (the checks:
  `tutorial.check`, `.progress`, `.tag`) and `references/steel/`. Shipped in
  the wheel as `stilo/tutorial`; `stilo tutor` (`src/stilo/cli/tutor.py`)
  copies it into a working folder made a package with `make_package`, the
  code of `stilo init`, reuses an existing copy, and moves it aside on
  `--reset`. Tested in `tests/tutorial/` (every document renders strictly
  or with its `expected_errors`; `solutions.json` turns every check to ✓
  Done) and `web/test/tutorial.test.js` (every cell fits its type).
- `src/stilo/cli/web.py` — `WEB_DIST`, `run_server(app, host, port,
  open_url)` (serve, tutor and plugins' commands).
- `src/stilo/cli/commands.py` — the subcommands (`init`, `pack`, `render`, `serve`, `tutor`) as
  `Command` entries in `COMMANDS`; `main()` in `src/stilo/cli/__init__.py`
  builds the parser from them and from `plugin_commands()` (the
  entry-point group `stilo.commands`: after Stilo's, sorted by name;
  clashes and broken plugins skipped with a warning) (the `stilo` script,
  `python -m stilo`). `__all__` there is the CLI's public API, pinned by
  `tests/cli/test_plugins.py`.
- `src/stilo/cli/errors.py` — finds the undefined values a document returned
  and formats the report of `stilo render`.
- `web/src/main.js` — entry: theme CSS, the editor, the app; exports
  `startStilo` and `API_VERSION`. `web/index.html` calls `startStilo()`.
  `web/src/start.js` — `startStilo()`: services, built-ins, extensions,
  then a `<stilo-app>` in the target.
  `web/public/` — files copied into the build as they are
  (`favicon.svg`, the tab icon, linked from `web/index.html`).
- `web/src/components/stilo-app.js` — the shell, with no state of its
  own: creates and provides the services, activates the built-ins, lays
  out the window, renders the editor of the open document (attached to
  the `editor` service after every rendering), the open panel and the Move
  to… dialog, handles link clicks and the window's shortcuts.
- `web/src/components/top-bar.js`, `nav-pane.js`, `commands-pane.js`,
  `comments-pane.js`, `errors-pane.js` — the parts of the layout, views of
  the services: they read them through context and call them. `context-menu.js` — the menu `nav-pane.js` opens.
  `move-dialog.js` — the Move to… dialog. `stilo-dialog.js` — the
  modal dialog of `ui.dialog`, `confirm`, `prompt`. The tree lists every file (S15):
  documents open in the editor; other files (`isDocument` in `api.js`) are
  muted, open by their public URL in a new tab and hide with Show other
  files; Upload files… adds files with the browser's file dialog.
- `web/src/builtins/` — Stilo's own contributions, registered through the
  services as extensions will be: `commands.js` (the commands, their keys,
  the navigation pane's menus; editor commands call the editor's
  `runCommand(name)`, tree commands have ids `tree-*`), `panels.js` (the
  errors, comments and commands panels), `go-to.js` (going to a place a
  pane points to, in another document if needed), `files.js` (the
  commands on files and folders, one function each), `server.js` (the
  server's read-only items, and its `401` with a login address: a Stilo
  dialog, then the login page with `next`), `index.js`
  (`activateBuiltins`, run by `<stilo-app>`).
- `web/src/core/` — the core services (S17): `createStilo()`
  (`index.js`, the `stilo` object), `Service` (`service.js`: an
  `EventTarget` firing `change`), `StiloController` and `<stilo-provider>`
  (`context.js`: the `stilo` object by Lit context); `commands.js`
  (`enabled`, `disabledReason`: a command that does not apply is greyed
  out with the reason, and does not run),
  `keys.js` (shortcuts bound to commands, `when` = `global`, `tree` or
  `editor`; `formatKeys`, `isMac`), `menus.js`, `info.js` (what the server
  is and can do, `/_api/info`; `has(capability)`), `ui.js` (status and its level, navigation
  pane, open panel, source view, dialogs: `dialog`, `confirm`, `prompt`,
  shown by `<stilo-app>`), `settings.js` (per browser, by namespace; an
  extension's own), `cells.js` (cell types for extensions, with
  their "Make it …" command), `registry.js` (`Registry`:
  items by id and order, `register`, `replace`; the `topBar` and `status`
  services: top-bar items, the status line at the bottom, shown only with
  items; `views`: pages that are not a document, at `?view=<id>`, shown in
  place of the editor), `panels.js` (the right pane's
  panels, the top bar's buttons, badges; a `Registry`), `errors.js` (the open document's
  errors, the one pointed out, `go-to`), `comments.js` (its cell comments
  by line, the line pointed out, `go-to`; comment providers, anchored to
  cells by name), `editor.js` (the open
  document's `<texl-editor>`, its events passed on; mark providers,
  `decorate`), `document.js` (the
  open document: load, save, reload, dirty), `router.js` (the address:
  navigation root, the view and its parameters, `go`, `replace`, back and
  forward), `tree.js` (the
  navigation pane's tree, current item, other files, `askName` through
  the pane, the Move to… dialog; `checkName`; providers: `decorate`,
  `filter`, `readOnly`, read by `decoration`, `shows`, `readOnlyReason`,
  `lockedReason`; packed packages: `isArchive`, `addReason`,
  `ARCHIVE_REASON`, menu `tree/archive`), `extensions.js` (the
  `extensions` service, `API_VERSION`, the scoped `stilo` an extension
  gets). `<stilo-app>` creates and
  provides it. A new command, key or menu entry is registered there.
- `web/src/route.js` — browser URL ↔ `{root, doc, view, params}`
  (`?view=<id>`: a view, no document). `web/src/api.js` —
  the protocol client, `Transport` (`stilo.transport`); every request goes
  through its `fetch`, and its middleware (`use`, `{outermost}`); `loader`,
  given to the editor, sends Texl imports through it too; `info()`;
  `ApiError` (`status`, message, `body`). `web/src/theme.js`,
  `theme.css` — light/dark theme (default dark), design tokens as CSS custom properties, also mapped onto
  the editor's `--texl-*` properties.
- `web/src/editor/` — the editor:
  - `index.js` — registers the built-in cells and `<texl-editor>`,
    re-exports the editor API.
  - `texl-editor.js` — `TexlEditor`: holds the cells, keyboard navigation,
    edit mode, and rendering (one `engine.render` of the whole document per
    pass, split into cell outputs at the markers by `outputSpans`, from the
    tags' positions).
    Public surface: `value`, `url`, `rows`, `readonly`, `loader`,
    `extraComments`, `marks` (both by cell name; event `mark-click`),
    `rendered`, `errors`, `editing`,
    `runCommand(name)`, `select(line)`, `commands`, events `change`,
    `comments-click`, `errors-change`, `error-click`, `selection-change`,
    `name-conflict`. Keys and `runCommand` share one
    table of commands (`_commands()`); a new editor action goes there,
    and in `commands.js` (`editorCommands()`: label, keys, group, whether
    it changes the document), which Stilo's commands pane lists.
  - `texl-cell.js` — `TexlCell`, base class of all cells: modes, layout,
    commit protocol (`cell-change` with `{texl}`, then `cell-exit`).
  - `cells/` — built-in cell types (`rich`, the default: WYSIWYG, its source
    the same Markdown as `markdown`; `text`, `markdown`, `table`: a Markdown
    pipe table edited as a grid, `formula`: one tag edited without its delimiters,
    `data`: a `stilo.dataframe` formula edited as a name and a grid of Swan
    values, each checked by the engine (`expression.js`); `grid-cell.js`,
    the grid both `table` and `data` extend; `chart`: a `stilo.charts`
    formula edited as a form; `form-cell.js`, `FormCell`, the base of
    cells edited as a form, `<texl-form>` (`texl-form.js`): fixed lines,
    a description and a field each, of type text, choice, number or
    expression; a new form-like cell extends `FormCell`);
    formulas are `<% %>` tags inside them. A type that needs a shape
    overrides the static `accepts(source)` (white space and comments
    never count against it): the type menu offers only accepting types,
    and a cell refuses to commit a changed source its type rejects
    (`inputError`), so a type change never converts content. A type
    whose cells need a library sets `requires` (`{url, source}`): the
    editor adds the import at the top when such a cell is first written
    (`_withImports`; S12).
  - `rich/` — the `rich` cell's `schema.js` (what it can hold), `markdown.js`
    (source ↔ ProseMirror document, read with `marked`; `acceptsRich` refuses
    what would not survive) and `commands.js` (keys and typing shortcuts).
  - `errors.js` — the errors of a rendering: the undefined values tags
    returned (the same rule as `src/stilo/cli/errors.py`; S7), their marks in
    the output, `sanitizeOutput` (the one way a cell shows HTML).
  - `math.js` — equations in Markdown: finds `$...$` and `$$...$$`, typesets
    them with KaTeX, declares its fonts in the document (a shadow root ignores
    them). Imports KaTeX's styles with `?inline`, as Vite does and as
    `web-test-runner.config.js` imitates.
  - `registry.js` — `registerCell(CellClass)`; unknown types fall back to
    `text`. `document.js` — parse/serialise (round-trip exact), tags and markers
    (`tagSpans`, `spanningTag`, `cellsFromSource`), cell names, comments, `outputSpans`, `splitRendering`. `swan.js` — Swan highlighting. `engine.js`
    — loads the wasm module once, creates engines.
- `web/test/` — the editor's browser tests.
- `web/package-check/` — `check.js` (`npm run check-package`) and
  `consumer/`, the small Vite project that imports every entry point of
  the npm package. `web/README.md` — the package's page on npm.
- `examples/` — sample documents: `library/steel.texl`, `sample.texl`,
  the package `packages/steel/` (a steel reference: `index.texl` imports
  `sections.texl`), and the package `packages/beam/`: `beam-check.texl`, a short design
  report that links to and imports `basis-of-design.texl` (design data,
  imports `~/references/steel-revA.texlz`, `packages/steel/` packed,
  checked against it in `tests/cli/test_render.py`; repack with `uv run
  stilo pack examples/packages/steel -o
  examples/packages/beam/references/steel-revA.texlz`) and
  `analysis.texl` (the checks); its
  `references/stilo.texlz` is the library packed, checked against
  `texl-lib/` (`tests/texl_lib/test_library.py`; repack with `uv run
  stilo pack texl-lib -o examples/packages/beam/references/stilo.texlz`
  when the library changes). Every
  example renders with `stilo render --strict` (`tests/cli/test_render.py`)
  and its cells fit their types (`web/test/examples.test.js`).

## File format

One Texl text file per document. Each cell starts with a marker line
`<!--{ name : type }-->`; text before the first marker is a `text` cell
without marker. A marker line inside a `<% %>` tag is not a marker, so a tag
always belongs to the cell it opens in, and the editor refuses a change that
would make one run into a later cell. The name (4 lowercase alphanumerics,
unique, compared without case) is generated by the editor and not shown.
Options follow the type, each after a bar: `<!--{ name : type | hidden }-->`
hides the cell in the editor (it still renders; S13); unknown options are
kept. Cell comments are
`<!--[ ... ]-->`; other HTML comments are ignored. The file must stay a
valid Texl document that renders without the editor (`stilo render`,
`pytexl`, `texl.import`). Imports may use `~` for the package home
(`docs/packages.md`); other Texl hosts do not resolve it.

## Conventions

- The UI must feel familiar to Word/Excel users and look light and modern.
  Colours only through the tokens in `theme.css`; both themes must work.
- The editor owns the document; cells are views of their Texl source and
  report changes by events. Don't keep cell data outside the Texl source.
- In the web app, state and behaviour go in a core service
  (`web/src/core/`); components are views that read the services through
  a `StiloController` and call them. Stilo's own commands, keys, menus and
  panels are registered through the services (`web/src/builtins/`), never
  wired around them.
- Lit in plain JS: declare reactive properties in `static properties` and
  initialise them in the constructor, never as class fields.
- A cell that handles a key itself calls `preventDefault()`; the editor
  ignores keydown events that are already default-prevented.
- Documents are untrusted: rendered HTML is always sanitised; the server
  never executes documents. Other files are untrusted too: by their public
  URL they get their real type, sandboxed if they could run scripts
  (`docs/protocol.md`); links opening in a new tab use `noopener`.
- Tests of the editor run in a real browser (custom elements, wasm).
  Synthetic key events in tests need `cancelable: true`.
- `vite.config.js` excludes `@onlabsorg/texl` from `optimizeDeps`; the wasm
  file is loaded relative to `texl_wasm.js`.
- Keep the protocol plain HTTP and the stored documents plain Texl files.
- When the protocol, a command, the layout, the editing model or the
  editor API changes, update the matching pages in `docs/`, update this
  file, and add a line to `CHANGELOG.md`. Status changes go into
  `stilo.summary.md` (see above).
- **Keep the tutorial current** (S14): a user-visible change (a key, a
  command, a pane, a cell type, a `stilo` option) updates the lesson in
  `tutorial/` that teaches it, in the same commit, and its solution in
  `tests/tutorial/solutions.json` if a check changes
  (`docs/tutorial.md`).
- **Decisions** (OnLabs D22): a decision about Stilo's design, technology
  or architecture goes in `DECISIONS.md` as a new entry (`S<n>`, date,
  decision, reason); never rewrite old entries, supersede them. Detailed
  editor design choices stay in `docs/editor-design.md`, with an entry in
  `DECISIONS.md` only when one shapes the whole repository. Decisions
  about OnLabs as a whole (products, business, repositories) belong in
  the coordination folder (`../DECISIONS.md`), not here; if one comes up,
  say so.
- **Commit messages state user-visible changes plainly** (editor features,
  keys, `stilo` options, file format, install): the OnLabs.org user manual
  is updated from them.
- `local/` is git-ignored, for local notes.
- English; Markdown wrapped at about 80 characters.

## Known limitations

- **No authentication:** `stilo serve` is meant for one user; bind it to
  localhost, or put it behind your own access control when serving
  remotely.
