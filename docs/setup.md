# Development setup

You need git, Python 3.11 or later with [uv](https://docs.astral.sh/uv/),
Node.js 22 or later, and Google Chrome or Chromium (the web tests run in
it).

```sh
git clone https://github.com/onlabsorg/stilo.git
cd stilo
```

## Python: server and CLI

The server and the CLI are one Python package, `stilo` (in `src/stilo/`),
and one uv project, `pyproject.toml` at the root of the repository. `uv
sync` installs it editable, so changes are seen at once.

```sh
uv sync && uv run pytest     # all Python tests: tests/
```

## Web: the app and the editor

```sh
cd web
npm install
npm test             # browser tests, in headless Chrome: test/**/*.test.js
npm run build        # src/stilo/web/: the app served by the Python server
npm run smoke        # after the build: the app shell against stilo serve
```

The source is plain JavaScript (ES modules, with JSDoc types): there is no
TypeScript and no build step for the source itself. Vite bundles it.

## Run it

Two ways:

- **One process.** Build the web app (`npm run build`), then serve a folder:

    ```sh
    uv run stilo serve examples
    ```

    and open <http://127.0.0.1:8010/packages/beam/beam-check.texl>.

- **With hot reload**, while you work on the web app. Run the server and
  Vite side by side:

    ```sh
    uv run stilo serve examples       # the server, on :8010
    cd web && npm run dev              # Vite, on :5173
    ```

    and open <http://localhost:5173/packages/beam/beam-check.texl>. Vite
    serves the pages and forwards to the server the protocol (`/_api`)
    and the public URLs of files: imports, images, PDFs.
    For a server on another port: `STILO_SERVER=http://127.0.0.1:8765 npm
    run dev`.

## The package `stilo`

Stilo is published as one Python package, `stilo` (on PyPI `stilo-cli`,
since PyPI refuses `stilo` as too close to an existing name), with the
three parts in it:

| In `src/stilo/` | Part                                              |
|-----------------|---------------------------------------------------|
| `cli/`          | The `stilo` command                               |
| `server/`       | The server; it never imports the CLI (checked by `tests/test_layout.py`) |
| `web/`          | The built web app, written by `npm run build` in `web/` (git-ignored) |
| `texl-lib/`     | Only in the wheel: the Stilo Texl library, copied from `texl-lib/` at the root |
| `tutorial/`     | Only in the wheel: the tutorial, copied from `tutorial/` at the root |

The web app's source stays in `web/`, a Node project of its own; only its
build goes into the package. A checkout and an installed package thus have
the same layout, and the CLI finds the web app in the same place in both.
Build the web app first: the package includes `src/stilo/web` when it is
there, and leaves it out silently when it is not (so that `uv run` works
without a web build). The release workflow checks that the wheel has it.
The Texl library in `texl-lib/` needs no build: the wheel takes it as it
is, and in a checkout the CLI reads it at the root
([Packages](packages.md#the-stilo-library-texl-lib)).

```sh
cd web && npm ci && npm run build && cd ..
uv build              # dist/stilo_cli-<version>.tar.gz and dist/stilo_cli-<version>-py3-none-any.whl
```

To try the wheel as a user would, install it outside the checkout:
`uv tool install --python ">=3.11" .` from the root, or
`uv pip install dist/stilo_cli-*.whl` in a fresh environment. The `package` job
of the continuous integration builds it, installs it, renders a sample
document and serves the samples.

## The npm package `@onlabsorg/stilo-web`

The web app's source is also published on npm, as `@onlabsorg/stilo-web`
(S16), for developers who build their own front end or embed the editor.
It is `web/` as it is, no build: `files` in `web/package.json` ships
`src/`, with `README.md` and the repository's `LICENSE` (copied in by the
`prepack` script, removed by `postpack`). Its interface is the `exports`
map, nothing else:

| Entry point                      | Module                 |
|----------------------------------|------------------------|
| `@onlabsorg/stilo-web`           | `src/main.js`: fonts, theme, `<stilo-app>`; `startStilo`, `API_VERSION`, `createStilo`, `StiloController`, `StiloProvider`, `stiloContext` |
| `@onlabsorg/stilo-web/editor`    | `src/editor/index.js`  |
| `@onlabsorg/stilo-web/theme.css` | `src/theme.css`        |

A new entry point is a promise to keep it; add one only by a decision.
Consumers build with Vite and exclude `@onlabsorg/texl` from
`optimizeDeps` ([the guide](component/guide.md#2-configure-vite)).

`npm run check-package` in `web/` checks the package as a consumer gets
it: it packs it, installs the tarball in a copy of `web/package-check/consumer/`
(a small Vite project importing every entry point, with the configuration
the guide gives), builds that, and checks that the build has the script,
the Texl `.wasm` module and the document font. `--out=<folder>` keeps the
tarball there; `--keep` keeps the consumer project.

## Tests

| Part    | Tests                        | Run with                 |
|---------|------------------------------|--------------------------|
| Server  | `tests/server/test_api.py`: every interaction of the protocol, path validation, errors; `test_home.py`: the package home `~` | `uv run pytest` |
| CLI     | `tests/cli/`: `test_render.py` (`stilo render`, every example renders), `test_errors.py` (the error report), `test_package.py` (`stilo init`, `~`), `test_tutor.py` (`stilo tutor`), `test_web.py` (stopping with Ctrl+C) | `uv run pytest` |
| Layout  | `tests/test_layout.py`: the server does not import the rest of the package | `uv run pytest` |
| Stilo library | `tests/texl_lib/`: the cases in `<function>-cases.json`, run on pytexl; `web/test/texl-lib.test.js` runs the same cases in the browser | `uv run pytest`, `npm test` in `web/` |
| Tutorial | `tests/tutorial/`: every lesson renders, `solutions.json` turns every check to ✓ Done; `web/test/tutorial.test.js`: every cell fits its type | `uv run pytest`, `npm test` in `web/` |
| Editor  | `web/test/`: `document.test.js` (file format), `cells.test.js` (cells), `rich-cell.test.js` and `rich-markdown.test.js` (rich text), `data-cell.test.js`, `chart-cell.test.js`, `math.test.js` (equations), `errors.test.js` (errors), `texl-editor.test.js` (editing, keys, clipboard, undo), `examples.test.js` (every example's cells fit their types) | `npm test` in `web/` |
| Web app | `web/test/`: `core.test.js` (services, context, transport), `commands.test.js` (commands, keys, menus, panels, errors, comments, top bar and panes), `services.test.js` (router, document, editor, tree, file commands, on a stand-in server and editor), `nav-pane.test.js` (navigation pane) | `npm test` in `web/` |
| App shell | `web/smoke/app-shell.test.js`: smoke tests (open, edit and save, reload, open from the navigation pane) | `npm run smoke` in `web/`, after `npm run build` |
| npm package | `web/package-check/`: the package packed, installed in a small Vite project and built | `npm run check-package` in `web/` |

The editor tests run in a real browser, because cells are custom elements
and Texl is WebAssembly. Synthetic key events in tests need
`cancelable: true`, or the editor cannot tell that a cell handled them.

The app shell has only smoke tests: a few quick checks that the app starts
and its main paths work at all. They start `stilo serve` on a copy of
`examples/` (`uv run stilo` at the root, or the command in `STILO`) and
drive the page in the local Chrome with puppeteer-core, through
`node --test`. A path they do not cover is checked by hand the same way:
run the server and drive the page with a headless browser.

The continuous integration, `.github/workflows/stilo.yml`, runs all the
tests, the web build and the package build on every push and pull request.

## Releasing

A release is a tag. `.github/workflows/release.yml` runs at every pushed
tag `vX.Y.Z`: it checks that the tag matches the version in
`pyproject.toml` and in `web/package.json` and that `CHANGELOG.md` has an
entry `## X.Y.Z`, runs the tests, builds the Python package and checks the
npm package (`npm run check-package`), publishes them on
[PyPI](https://pypi.org/project/stilo-cli/) and
[npm](https://www.npmjs.com/package/@onlabsorg/stilo-web) (the very tarball
that was checked), and creates the GitHub release with the changelog entry
and the built files. PyPI and npm trust the workflow by Trusted Publishing,
in the GitHub environments `pypi` and `npm`: there are no tokens.

To release:

1. Set the version in `pyproject.toml`, `web/package.json` and
   `src/stilo/server/app.py` (`VERSION`); run `uv lock` and `npm install` in `web/`.
2. Rename the changelog's *Unreleased* section to `## X.Y.Z — <date>` and
   start a new, empty *Unreleased*.
3. Commit on `main`, then `git tag vX.Y.Z && git push origin main vX.Y.Z`.
