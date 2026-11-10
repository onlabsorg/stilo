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
  `init` a project, `render` a document, `serve` a folder, `tutor` (the
  tutorial). It is the only Texl command line (D19).

Beside them, `texl-lib/` (root) is the **Stilo Texl library**: Texl
documents, not code, that `stilo init` copies into a project's
`lib/stilo/`; shipped in the wheel as `stilo/texl-lib` (hatch
`force-include`), read in place in a checkout (`TEXL_LIB` in
`src/stilo/cli/project.py`); `tutorial/` (root, S14) is shipped and read the
same way. **Projects** (S10, `docs/projects.md`): a
folder with `project.texl` is a project, its *home*; in an import path a
`~` segment stands for the home of the folder before it, resolved left to
right, by the server on reads (a protocol rule: a `307` redirect to the real
path) and by the CLI's file loader (which returns the real file as the final
URL), with one shared rule in `src/stilo/server/home.py`. The real path is
thus the document's identity for Texl (final URLs, Texl 0.8; S11). More
than 16 `~` segments are refused, a safeguard.

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

The **protocol** (`docs/protocol.md`, plain HTTP: GET, CREATE
(POST), UPDATE (PUT with `If-Match`), QUERY tree, CREATE folder, MOVE, DELETE)
is the contract between
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
uv sync && uv run pytest              # tests/: server/, cli/, texl_lib/, tutorial/, test_layout.py
uv run stilo serve examples           # http://127.0.0.1:8000
uv run stilo render examples/projects/beam/beam-check.texl
uv run stilo init path/to/project     # project.texl, lib/stilo/
uv run stilo tutor --dir /tmp/t       # copies tutorial/ there, serves it
uv build                              # after npm run build: dist/stilo_cli-*.whl
```

**Web** (app and editor): plain JavaScript (ES modules, JSDoc types, no
TypeScript, no build step for the source) with Lit 3 web components, built
with Vite. Texl runs in the browser as WebAssembly (`@onlabsorg/texl`).
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
npm run dev          # Vite on :5173 with hot reload; proxies to the server on :8000
                     # (STILO_SERVER=http://127.0.0.1:8765 npm run dev for another port)
```

Two ways to run it:

- **One process:** `npm run build`, then `uv run stilo serve examples`
  at the root; open <http://127.0.0.1:8000/projects/beam/beam-check.texl>.
- **Development:** `uv run stilo serve examples` and `npm run dev` side
  by side; open <http://localhost:5173/projects/beam/beam-check.texl>.
  Vite serves the pages and forwards `/_api` and the public URLs of files
  (imports, images, PDFs).

The app shell has only smoke tests (`web/smoke/app-shell.test.js`: open,
edit and save, reload, open from the navigation pane; any page error fails
them); a new main path of the shell gets one there. To check other UI
behaviour, run the server and drive it with a headless browser
(puppeteer-core with the local Chrome works). CI: `.github/workflows/stilo.yml` (tests, web build, and
the `package` job: builds the wheel, installs it, smoke-tests `render` and
`serve`, and runs the app-shell smoke tests against the installed
`stilo`). Release: `.github/workflows/release.yml`, at a pushed tag
`vX.Y.Z` matching `pyproject.toml` and a `CHANGELOG.md` entry: tests,
builds, publishes on PyPI (Trusted Publishing, environment `pypi`) and
creates the GitHub release. Bump the version in `pyproject.toml`,
`web/package.json` and `src/stilo/server/app.py`.

## Code layout

- `pyproject.toml` — the Python project and published package `stilo` (see
  above). `tests/` — its tests.
- `docs/` — the developer documentation, plain Markdown read on GitHub
  (no build, no site; relative links only). Index: `docs/README.md`;
  style guide: `docs/STYLE.md`. `architecture.md`, `setup.md`,
  `server.md`, `cli.md`, `projects.md` (projects, `~`, `texl-lib/`), `web-app.md`, `editor.md`, `editor-design.md`
  (editing model, open points), `texl-primer.md`, `tutorial.md` (how the
  tutorial is built and kept current), `protocol.md` (protocol
  v0: URL space, the interactions, errors, public document URLs, why
  plain HTTP — also the contract), `component/` (embedding guide and
  editor API reference).
- The **user manual** (getting started, the web editor, the `stilo`
  command, the file format) is not in this repository: it is the
  OnLabs.org manual (<https://www.onlabs.org/manual/>), built from the
  `onlabsorg.github.io` repository and kept current from this repository's
  commits and docs by a session in the coordination folder (D21). Only
  `README.md` links to it.
- `CONTRIBUTING.md`, `CHANGELOG.md` — at the root.
- `DECISIONS.md` — Stilo's decision log (S1, S2, …), at the root.
- `src/stilo/server/home.py` — the project home rule: `MANIFEST`
  (`project.texl`), `home_of`, `expand_home` (left to right, `MAX_HOMES`),
  shared by the server and the CLI.
- `src/stilo/server/storage.py` — `Storage`: path validation (no `..`,
  no hidden segments, no `~` names, no `_` names at the root, no escape
  through symlinks), `expand_home` on reads,
  read / create / update / move / delete (to `.trash`) / tree, ETags (sha256). Raises `StorageError`
  subclasses carrying the HTTP status.
- `src/stilo/server/app.py` — `create_app(root, web_dist)`: the
  `/_api/` routes, `/_app/` static bundle, and `/<path>` (web app for
  browsers, the file for other clients).
- `src/stilo/cli/project.py` — `create_engine()` (the one place an engine
  is made; its file loader resolves `~`, top: `$HOME` or `/`), `TEXL_LIB`,
  the text of a new `project.texl`.
- `texl-lib/` — the Stilo Texl library: `index.texl` binds `stilo`,
  gathering one document per function (`dataframe.texl`:
  `stilo.dataframe`; `charts.texl`: `stilo.charts.line`, an SVG line
  chart). Tested by the cases in `tests/texl_lib/<function>-cases.json`,
  run on both engines
  (`tests/texl_lib/`, `web/test/texl-lib.test.js`). Its text must not quote its own
  import tag: tags run even in code blocks. Swan texts have no escapes:
  markup written in Swan quotes its attributes with `'`.
- `tutorial/` — the tutorial (S14, `docs/tutorial.md`): `index.texl`,
  lessons `NN-name.texl`, `files/`, `lib/tutorial/` (the checks:
  `tutorial.check`, `.progress`, `.tag`) and `lib/steel/`. Shipped in the
  wheel as `stilo/tutorial`; `stilo tutor` (`src/stilo/cli/tutor.py`)
  copies it into a working folder made a project with `make_project`, the
  code of `stilo init`, reuses an existing copy, and moves it aside on
  `--reset`. Tested in `tests/tutorial/` (every document renders strictly
  or with its `expected_errors`; `solutions.json` turns every check to ✓
  Done) and `web/test/tutorial.test.js` (every cell fits its type).
- `src/stilo/cli/web.py` — `WEB_DIST`, `run_server` (serve and tutor).
- `src/stilo/cli/commands.py` — the subcommands (`init`, `render`, `serve`, `tutor`) as
  `Command` entries in `COMMANDS`; `main()` in `src/stilo/cli/__init__.py`
  builds the parser from them (the `stilo` script, `python -m stilo`).
- `src/stilo/cli/errors.py` — finds the undefined values a document returned
  and formats the report of `stilo render`.
- `web/src/main.js` — entry: theme CSS, the editor, the app.
  `web/public/` — files copied into the build as they are
  (`favicon.svg`, the tab icon, linked from `web/index.html`).
- `web/src/components/stilo-app.js` — the shell: layout, state (navigation
  root and tree, open document, ETag, dirty flag, open pane), routing,
  commands (save, new, …), editor events.
- `web/src/components/top-bar.js`, `nav-pane.js`, `commands-pane.js`,
  `comments-pane.js`, `errors-pane.js` — the parts of the layout. They fire events; the app
  holds the state. `context-menu.js` — the menu `nav-pane.js` opens.
  `move-dialog.js` — the Move to… dialog. The tree lists every file (S15):
  documents open in the editor; other files (`isDocument` in `api.js`) are
  muted, open by their public URL in a new tab and hide with Show other
  files; Upload files… adds files with the browser's file dialog.
- `web/src/commands.js` — the command list shown in the commands pane, with
  shortcuts, and the navigation pane's menus (`treeMenus`). Editor commands
  call the editor's `runCommand(name)`; tree commands have ids `tree-*`.
- `web/src/route.js` — browser URL ↔ `{root, doc}`. `web/src/api.js` —
  protocol client. `web/src/theme.js`,
  `theme.css` — light/dark theme (default dark), design tokens as CSS custom properties, also mapped onto
  the editor's `--texl-*` properties.
- `web/src/editor/` — the editor:
  - `index.js` — registers the built-in cells and `<texl-editor>`,
    re-exports the editor API.
  - `texl-editor.js` — `TexlEditor`: holds the cells, keyboard navigation,
    edit mode, and rendering (one `engine.render` of the whole document per
    pass, split into cell outputs at the markers by `outputSpans`, from the
    tags' positions).
    Public surface: `value`, `url`, `rows`, `rendered`, `errors`, `editing`,
    `runCommand(name)`, `select(line)`, `commands`, events `change`,
    `comments-click`, `errors-change`, `error-click`, `selection-change`,
    `name-conflict`. Keys and `runCommand` share one
    table of commands (`_commands()`); a new editor action goes there.
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
- `examples/` — sample documents: `library/steel.texl`, `sample.texl`,
  and the project `projects/beam/`: `beam-check.texl`, a short design
  report that links to and imports `basis-of-design.texl` (design data,
  imports the steel library) and `analysis.texl` (the checks). Every
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
`pytexl`, `texl.import`). Imports may use `~` for the project home
(`docs/projects.md`); other Texl hosts do not resolve it.

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
