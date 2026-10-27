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

Each Python part is a uv project with its own environment. The CLI depends
on the server by path (`cli/pyproject.toml`), so a change in `server/` is
seen by the CLI at once.

```sh
cd server && uv sync && uv run pytest     # server tests: tests/test_api.py
cd cli && uv sync && uv run pytest        # CLI tests: tests/test_render.py
```

## Web: the app and the editor

```sh
cd web
npm install
npm test             # browser tests, in headless Chrome: test/**/*.test.js
npm run build        # dist/: the app served by the Python server
```

The source is plain JavaScript (ES modules, with JSDoc types): there is no
TypeScript and no build step for the source itself. Vite bundles it.

## Run it

Two ways:

- **One process.** Build the web app (`npm run build`), then serve a folder:

    ```sh
    cd cli && uv run stilo serve ../examples
    ```

    and open <http://127.0.0.1:8000/projects/beam/beam-check.texl>.

- **With hot reload**, while you work on the web app. Run the server and
  Vite side by side:

    ```sh
    cd cli && uv run stilo serve ../examples      # the server, on :8000
    cd web && npm run dev                          # Vite, on :5173
    ```

    and open <http://localhost:5173/projects/beam/beam-check.texl>. Vite
    serves the pages and forwards to the server the protocol (`/_api`)
    and the `.texl` files requested by anything but a page (the imports).
    For a server on another port: `STILO_SERVER=http://127.0.0.1:8765 npm
    run dev`.

## Tests

| Part    | Tests                        | Run with                 |
|---------|------------------------------|--------------------------|
| Server  | `server/tests/test_api.py`: every interaction of the protocol, path validation, errors | `uv run pytest` in `server/` |
| CLI     | `cli/tests/test_render.py`   | `uv run pytest` in `cli/` |
| Editor  | `web/test/document.test.js` (file format), `cells.test.js` (cells), `texl-editor.test.js` (editing, keys, clipboard, undo) | `npm test` in `web/` |

The editor tests run in a real browser, because cells are custom elements
and Texl is WebAssembly. Synthetic key events in tests need
`cancelable: true`, or the editor cannot tell that a cell handled them.

The app shell has no tests yet. To check it, run the server and drive the
page with a headless browser (puppeteer-core with the local Chrome works).

The continuous integration, `.github/workflows/stilo.yml`, runs all the
tests and the web build on every push and pull request.
