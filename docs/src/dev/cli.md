# The CLI

*`src/stilo/cli/`, the module `stilo.cli`: the `stilo` command. Its user
manual is [The stilo command](../cli/index.md).*

| Module                  | Role                                              |
|-------------------------|---------------------------------------------------|
| `stilo/cli/__init__.py` | `main()`: builds the argument parser from `COMMANDS` and runs the chosen command. The `stilo` script and `python -m stilo` (`stilo/__main__.py`) both call it. |
| `stilo/cli/commands.py` | The subcommands, as `Command` entries in `COMMANDS` |

## `Command`

```python
@dataclass
class Command:
    name: str
    help: str
    add_arguments: Callable   # (parser) -> None
    run: Callable             # (args) -> exit status
```

Describes one subcommand: its name, the help line that `stilo --help`
shows, a function that adds its arguments to an `argparse` parser, and a
function that runs it with the parsed arguments and returns the exit status.

## `COMMANDS`

```python
COMMANDS = [
    Command("render", "render a Texl document", render_arguments, render),
    Command("serve", "serve a folder of Texl documents with the web app", serve_arguments, serve),
]
```

Lists the subcommands, in the order `stilo --help` shows them. It is the
only place where commands are defined: a plugin system will add its own
commands to this list.

### Add a command

Write the two functions and add an entry:

```python
def check_arguments(parser):
    parser.add_argument("file", type=Path, help="document to check")


def check(args) -> int:
    """Prints the cells of a document that render an undefined value."""
    ...
    return 0


COMMANDS = [
    ...,
    Command("check", "check a Texl document", check_arguments, check),
]
```

Print errors to standard error, prefixed with `stilo:`, and return 1. Add a
test in `tests/cli/` that calls `main([...])`, and document the command in
`docs/src/cli/`.

## `render`

```python
def render(args) -> int
```

Renders `args.file` with a new `pytexl.Engine`, loading it by its `file:`
URI so that relative imports resolve from its folder, and writes the
rendering to standard output or to `args.output`. Returns 1 if the document
cannot be loaded or the output cannot be written.

## `serve`

```python
def serve(args) -> int
```

Runs `create_app(args.folder, args.web)` from the server with uvicorn on
`args.host` and `args.port`. Returns 1 if `args.folder` is not a folder.

The default for `--web` is `WEB_DIST`, the folder `stilo/web` of the
package: the build of the web app, in a checkout as in an installed package
(see [Development setup](setup.md#the-package-stilo)). The server never
looks for the web app itself: the CLI hands it over to `create_app()`.

## Tests

`tests/cli/test_render.py` runs `main()` on the sample documents in
`examples/`: rendering with imports, writing to a file, and a missing file.

```sh
uv run pytest tests/cli
```
