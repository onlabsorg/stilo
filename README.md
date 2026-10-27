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
cd cli && uv sync
uv run stilo serve ../examples          # http://127.0.0.1:8000
uv run stilo render ../examples/projects/beam/beam-check.texl
```

Open <http://127.0.0.1:8000/projects/beam/beam-check.texl>.

## Parts

| Folder    | What                                                          |
|-----------|---------------------------------------------------------------|
| `web/`    | The web app (Lit, Vite): navigation, side panes and the editor (`web/src/editor/`, the `<texl-editor>` component) |
| `server/` | `stilo-server`: Python (FastAPI) server for one folder of documents |
| `cli/`    | `stilo`: the command line, `render` and `serve`               |
| `docs/`   | The documentation (manual, editor manual, landing page), published on <https://www.onlabs.org/stilo/>; `docs/build.sh` builds it into `target/site` |
| `examples/` | Sample documents                                            |

## Documentation

<https://www.onlabs.org/stilo/>: getting started, the `stilo` command, the
web editor (with an interactive editor manual), the protocol, the editor
component and a developer guide. See also [CONTRIBUTING.md](CONTRIBUTING.md)
and [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
