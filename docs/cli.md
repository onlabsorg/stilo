# The CLI

*`src/stilo/cli/`, the module `stilo.cli`: the `stilo` command. Its user
documentation is in the OnLabs.org user manual.*

| Module                  | Role                                              |
|-------------------------|---------------------------------------------------|
| `stilo/cli/__init__.py` | `main()`: builds the argument parser from `COMMANDS` and runs the chosen command. The `stilo` script and `python -m stilo` (`stilo/__main__.py`) both call it. |
| `stilo/cli/commands.py` | The subcommands, as `Command` entries in `COMMANDS` |
| `stilo/cli/project.py`  | Projects: `create_engine()` (the engine every command renders with, `~` resolved), `TEXL_LIB`, the text of a new `project.texl` |

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
    Command("init", "make a folder a Stilo project, with the Stilo library", init_arguments, init),
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
test in `tests/cli/` that calls `main([...])`, and state the new command
plainly in the commit message: the OnLabs.org user manual is updated from
it.

## `render`

```python
def render(args) -> int
```

Renders `args.file` with the engine of `create_engine()`, loading it by its
`file:` URI so that relative imports resolve from its folder and `~` from
its project home ([Projects](projects.md)), and writes the
rendering to standard output or to `args.output`. Returns 1 if the document
cannot be loaded (`pytexl.LoadError`; the message says why) or the output
cannot be written.

If the document returned undefined values, one line on standard error says how
many. The output stays as any Texl host renders it, and the exit status stays
0. Two options change that:

- `-d`, `--debug` numbers the values in the output (`[[Undefined #1]]`, the
  same value keeps its number) and explains each one on standard error.
- `--strict` returns 1 if there are any. The output is still written.

```text
#2 report.texl:9:33  cannot multiply an undefined value by the number `2`
     A chain of causes: <% (2 + "b") * 2 %>
                                     ^
     caused by report.texl:9:26: cannot add the number `2` and the text `"b"`
```

### `errors.py`

`src/stilo/cli/errors.py` finds and formats the errors. An error is an undefined
value a tag returned, directly or as an item of a tuple
([S7](../DECISIONS.md)):

| Function | Purpose |
|----------|---------|
| `find_errors(doc)` | The `DocumentError`s of a document: number, value and places. Values with the same `uri`, `pos` and `description` are one error with several places; a value with no `pos` is told apart by its tag. |
| `count_returned(errors)` | How many values were returned, repeats included. |
| `numbered_text(doc, errors)` | The text with each value as `[[Undefined #n]]`. |
| `format_report(doc, errors)` | The report above. |

The location comes from the value (`uri`, `pos`, `source`), so an error made in
an imported document points into that document, without loading it again. A
value with no `pos`, such as one from `undef.from`, points at the tag that
returned it. `cause` is walked with `is not None`, since an undefined value is
falsy in Python.

## `init`

```python
def init(args) -> int
```

Makes `args.folder` (default: the current folder, created if missing) a
project: writes `project.texl`, binding `project_name` (`--name`, default
the folder's name) and `stilo_version` (the installed package's version),
creates `lib/`, and copies `TEXL_LIB` into `lib/stilo/`. Returns 1 if
`project.texl` already exists. An existing `lib/stilo/` is left as it is.
The work is done by `make_project(folder, name)` in `project.py`, which
`stilo tutor` shares. See [Projects and the Stilo library](projects.md).

## `create_engine`

```python
def create_engine() -> pytexl.Engine
```

In `project.py`: a `pytexl.Engine` whose loader for `file:` URLs and plain
paths resolves `~` segments before reading (`resolve_file`), with the rule
of the server's `home.py`, and for a path with `~` returns the real file as
the document's final URL, `(final_url, source)`, as the server's redirect
does ([Projects](projects.md#how--resolves)). Its top, the highest folder
the search for a home may reach, is the user's home directory, or the
file-system root for a document outside it. A command that renders creates its engine here.

## `serve`

```python
def serve(args) -> int
```

Runs `create_app(args.folder, args.web)` from the server with uvicorn on
`args.host` and `args.port`, through `run_server` (`web.py`, shared with
`tutor`). Returns 1 if `args.folder` is not a folder.

Ctrl+C stops the server. uvicorn shuts down cleanly, then re-raises the
interrupt for its caller (asyncio raises it out of a `CancelledError`);
`run_server` catches it and prints a goodbye instead of a traceback, and
the command returns 0.

The default for `--web` is `WEB_DIST`, the folder `stilo/web` of the
package: the build of the web app, in a checkout as in an installed package
(see [Development setup](setup.md#the-package-stilo)). The server never
looks for the web app itself: the CLI hands it over to `create_app()`.

## `tutor`

```python
def tutor(args) -> int
```

In `tutor.py` (DECISIONS.md S14). The tutorial's source is `tutorial/` at
the root of the checkout, shipped in the wheel as `stilo/tutorial`
(`TUTORIAL`, found as `TEXL_LIB` is). `prepare(folder, reset)` makes sure
the working folder (`--dir`, default `default_folder()`:
`platformdirs.user_data_path("stilo")/tutorial`) holds a copy:

- missing or empty: `create_copy` copies `TUTORIAL`, runs `make_project`
  (as `stilo init`, name "Stilo tutorial") and appends
  `tutorial_folder = "<path>"` to `project.texl`. That value marks a copy
  (`is_copy`), and lesson 1 and 11 show it;
- a copy: reused. If its `stilo_version` is older than the installed one
  (`is_older`, numeric parts only), a message proposes `--reset`;
- anything else (a non-empty folder that is not a copy, a file): refused,
  status 1, also with `--reset`.

With `--reset`, an existing copy is first renamed `<name>-old-<date-time>`
next to it (`move_aside`); nothing is deleted. Then `run_server` serves the
folder on 127.0.0.1:`--port` and, unless `--no-browser`, opens
`index.texl` in the browser once the server has started.

How the lessons are written and tested: [The tutorial](tutorial.md).

## Tests

`tests/cli/test_render.py` runs `main()` on the sample documents in
`examples/`: rendering with imports, writing to a file, a missing file, and
every example rendered with `--strict`.
`tests/cli/test_project.py` covers `stilo init` and `~` in `render`, with
`Path.home()` moved into a temporary folder.
`tests/cli/test_errors.py` covers the report of undefined values, on documents
it writes to a temporary folder. `tests/cli/test_tutor.py` covers `stilo
tutor`: copy, reuse, reset, refusals, the version check (with `run_server`
replaced), and the real command serving the index in a subprocess.
`tests/cli/test_web.py` covers Ctrl+C in `run_server`.

```sh
uv run pytest tests/cli
```
