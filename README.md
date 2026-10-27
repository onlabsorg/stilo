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

Requires Python 3.11+ with [uv](https://docs.astral.sh/uv/), and Node.js 22+.

```bash
cd web && npm install && npm run build && cd ..
uv tool install --python ">=3.11" .     # the `stilo` command, web app included
stilo serve examples                     # http://127.0.0.1:8000
stilo render examples/projects/beam/beam-check.texl
```

For development, use `uv run stilo` at the root instead; see the developer
guide.

Open <http://127.0.0.1:8000/projects/beam/beam-check.texl>.

## Parts

| Folder    | What                                                          |
|-----------|---------------------------------------------------------------|
| `web/`    | The web app's source (Lit, Vite): navigation, side panes and the editor (`web/src/editor/`, the `<texl-editor>` component) |
| `src/stilo/` | The Python package `stilo`: `server/` (FastAPI, one folder of documents), `cli/` (the `stilo` command, `render` and `serve`), `web/` (the built web app) |
| `tests/`  | The Python tests                                              |
| `pyproject.toml` | The package `stilo`, the only one published          |
| `docs/`   | The documentation (manual, editor manual, landing page), published on <https://www.onlabs.org/stilo/>; `docs/build.sh` builds it into `target/site` |
| `examples/` | Sample documents                                            |

## Documentation

<https://www.onlabs.org/stilo/>: getting started, the `stilo` command, the
web editor (with an interactive editor manual), the protocol, the editor
component and a developer guide. See also [CONTRIBUTING.md](CONTRIBUTING.md)
and [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
