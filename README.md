# Stilo

Stilo is the editor for [Texl](https://github.com/onlabsorg/texl) documents:
living documents that compute their content and link to each other. It
edits a folder of `.texl` files in the browser, as a stack of cells that
feels familiar to Word and Excel users, and renders them from the command
line.

Stilo is single-user and open source (MIT). Use it on your own folder,
locally or on a server of your own; collaboration between people and
organisations (accounts, permissions, release and accept) is the job of a
platform built on top of it.

> This repository used to hold the olojs version of Stilo, a CLI for
> olo-docs. That code is kept under the tag `olojs-v0.19.4`.

## Getting started

Requires Python 3.11 or later. Install the `stilo` command from PyPI, with
[uv](https://docs.astral.sh/uv/) or pip:

```bash
uv tool install stilo-cli    # or: pip install stilo-cli
stilo serve my-folder        # http://127.0.0.1:8000
stilo render my-folder/report.texl
```

To try the sample documents, or to work on Stilo itself, use a checkout
(Node.js 22+ builds the web app):

```bash
git clone https://github.com/onlabsorg/stilo.git && cd stilo
cd web && npm install && npm run build && cd ..
uv run stilo serve examples
```

Open <http://127.0.0.1:8000/projects/beam/beam-check.texl>. See the
[getting started guide](https://www.onlabs.org/stilo/book/getting-started.html)
and the developer guide.

## Parts

| Folder    | What                                                          |
|-----------|---------------------------------------------------------------|
| `web/`    | The web app's source (Lit, Vite): navigation, side panes and the editor (`web/src/editor/`, the `<texl-editor>` component) |
| `src/stilo/` | The Python package `stilo`: `server/` (FastAPI, one folder of documents), `cli/` (the `stilo` command, `render` and `serve`), `web/` (the built web app) |
| `tests/`  | The Python tests                                              |
| `pyproject.toml` | The package `stilo`, the only one published (on PyPI: `stilo-cli`) |
| `docs/`   | The documentation (manual, editor manual, landing page), published on <https://www.onlabs.org/stilo/>; `docs/build.sh` builds it into `target/site` |
| `examples/` | Sample documents                                            |

## Documentation

<https://www.onlabs.org/stilo/>: getting started, the `stilo` command, the
web editor (with an interactive editor manual), the protocol, the editor
component and a developer guide. See also [CONTRIBUTING.md](https://github.com/onlabsorg/stilo/blob/main/CONTRIBUTING.md)
and [CHANGELOG.md](https://github.com/onlabsorg/stilo/blob/main/CHANGELOG.md).

## License

[MIT](https://github.com/onlabsorg/stilo/blob/main/LICENSE)
