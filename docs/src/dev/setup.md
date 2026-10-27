# Development setup

You need git, Python 3.11 or later with [uv](https://docs.astral.sh/uv/),
Node.js 22 or later, and Google Chrome or Chromium (the web tests run in
it). To build the documentation you also need
[mdBook](https://rust-lang.github.io/mdBook/) 0.4.

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
```

The source is plain JavaScript (ES modules, with JSDoc types): there is no
TypeScript and no build step for the source itself. Vite bundles it.

## Run it

Two ways:

- **One process.** Build the web app (`npm run build`), then serve a folder:

    ```sh
    uv run stilo serve examples
    ```

    and open <http://127.0.0.1:8000/projects/beam/beam-check.texl>.

- **With hot reload**, while you work on the web app. Run the server and
  Vite side by side:

    ```sh
    uv run stilo serve examples       # the server, on :8000
    cd web && npm run dev              # Vite, on :5173
    ```

    and open <http://localhost:5173/projects/beam/beam-check.texl>. Vite
    serves the pages and forwards to the server the protocol (`/_api`)
    and the `.texl` files requested by anything but a page (the imports).
    For a server on another port: `STILO_SERVER=http://127.0.0.1:8765 npm
    run dev`.

## The package `stilo`

Stilo is published as one Python package, `stilo`, with the three parts in
it:

| In `src/stilo/` | Part                                              |
|-----------------|---------------------------------------------------|
| `cli/`          | The `stilo` command                               |
| `server/`       | The server; it never imports the CLI (checked by `tests/test_layout.py`) |
| `web/`          | The built web app, written by `npm run build` in `web/` (git-ignored) |

The web app's source stays in `web/`, a Node project of its own; only its
build goes into the package. A checkout and an installed package thus have
the same layout, and the CLI finds the web app in the same place in both.
Build the web app first: the package build fails if `src/stilo/web` is
missing.

```sh
cd web && npm ci && npm run build && cd ..
uv build              # dist/stilo-<version>.tar.gz and dist/stilo-<version>-py3-none-any.whl
```

To try the wheel as a user would, install it outside the checkout:
`uv tool install --python ">=3.11" .` from the root, or
`uv pip install dist/stilo-*.whl` in a fresh environment. The `package` job
of the continuous integration builds it, installs it, renders a sample
document and serves the samples.

## Tests

| Part    | Tests                        | Run with                 |
|---------|------------------------------|--------------------------|
| Server  | `tests/server/test_api.py`: every interaction of the protocol, path validation, errors | `uv run pytest` |
| CLI     | `tests/cli/test_render.py`   | `uv run pytest` |
| Layout  | `tests/test_layout.py`: the server does not import the rest of the package | `uv run pytest` |
| Editor  | `web/test/document.test.js` (file format), `cells.test.js` (cells), `texl-editor.test.js` (editing, keys, clipboard, undo) | `npm test` in `web/` |

The editor tests run in a real browser, because cells are custom elements
and Texl is WebAssembly. Synthetic key events in tests need
`cancelable: true`, or the editor cannot tell that a cell handled them.

The app shell has no tests yet. To check it, run the server and drive the
page with a headless browser (puppeteer-core with the local Chrome works).

The continuous integration, `.github/workflows/stilo.yml`, runs all the
tests, the web build and the package build on every push and pull request.

## Releasing

A release is a tag. `.github/workflows/release.yml` runs at every pushed
tag `vX.Y.Z`: it checks that the tag matches the version in
`pyproject.toml` and that `CHANGELOG.md` has an entry `## X.Y.Z`, runs the
tests, builds the package, publishes it on
[PyPI](https://pypi.org/project/stilo/) and creates the GitHub release with
the changelog entry and the built files. PyPI trusts the workflow by
Trusted Publishing, in the GitHub environment `pypi`: there is no token.

To release:

1. Set the version in `pyproject.toml`, `web/package.json` and
   `src/stilo/server/app.py`; run `uv lock` and `npm install` in `web/`.
2. Rename the changelog's *Unreleased* section to `## X.Y.Z — <date>` and
   start a new, empty *Unreleased*.
3. Commit on `main`, then `git tag vX.Y.Z && git push origin main vX.Y.Z`.
