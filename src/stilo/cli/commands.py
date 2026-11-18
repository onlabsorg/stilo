"""The `stilo` subcommands.

Each command is a `Command`: a name, a help line, a function that adds its
arguments to a parser and a function that runs it. `COMMANDS` lists Stilo's own, in
the order `stilo --help` shows them; other packages add theirs through the
entry-point group `stilo.commands` (`__init__.py`, `plugin_commands`).
"""

import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import pytexl

from stilo.server import create_app

from .errors import count_returned, find_errors, format_report, numbered_text
from .package import LIBRARY_NAME, MANIFEST, REFERENCES, create_engine, make_package
from .tutor import tutor, tutor_arguments
from .web import WEB_DIST, run_server


@dataclass
class Command:
    name: str
    help: str
    add_arguments: Callable
    run: Callable  # (args) -> exit status


def render_arguments(parser):
    parser.add_argument("file", type=Path,
                        help="document to render; relative imports resolve from its folder")
    parser.add_argument("-o", "--output", type=Path,
                        help="output file (default: standard output)")
    parser.add_argument("-d", "--debug", action="store_true",
                        help="number the undefined values in the output and explain each one on standard error")
    parser.add_argument("--strict", action="store_true",
                        help="exit with status 1 if the document returned an undefined value")


def render(args) -> int:
    """Renders a document to standard output or a file, like `texl`."""
    path = args.file.resolve()
    try:
        doc = asyncio.run(create_engine().load(path.as_uri()))
    except pytexl.LoadError as e:
        print(f"stilo: {args.file}: could not be loaded: {e.reason}", file=sys.stderr)
        return 1
    errors = find_errors(doc)
    text = numbered_text(doc, errors) if args.debug else doc.text
    if args.output:
        try:
            args.output.write_text(text, encoding="utf-8")
        except OSError as e:
            print(f"stilo: {args.output}: {e}", file=sys.stderr)
            return 1
    else:
        sys.stdout.write(text)
        sys.stdout.flush()  # the document comes before the report on a terminal
    if errors:
        report_errors(args, doc, errors)
    return 1 if errors and args.strict else 0


def report_errors(args, doc, errors):
    """Says on standard error how many undefined values `doc` returned, and, with `--debug`, why."""
    count = count_returned(errors)
    summary = f"stilo: {args.file}: {count} undefined value{'' if count == 1 else 's'}"
    if args.debug:
        print(f"{summary}\n\n{format_report(doc, errors)}", file=sys.stderr)
    else:
        print(f"{summary} (use --debug to list them)", file=sys.stderr)


def serve_arguments(parser):
    parser.add_argument("folder", type=Path, nargs="?", default=Path("."),
                        help="folder of the documents (default: the current folder)")
    parser.add_argument("--host", default="127.0.0.1",
                        help="address to listen on (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--web", type=Path, default=WEB_DIST,
                        help="built web app (default: the one installed with stilo)")


def serve(args) -> int:
    """Serves a folder of documents and the Stilo web app over HTTP."""
    if not args.folder.is_dir():
        print(f"stilo: {args.folder}: not a folder", file=sys.stderr)
        return 1
    print(f"Stilo: serving {args.folder.resolve()} at http://{args.host}:{args.port}/ "
          "(press Ctrl+C here to stop)")
    run_server(create_app(args.folder, args.web), args.host, args.port)
    return 0


def init_arguments(parser):
    parser.add_argument("folder", type=Path, nargs="?", default=Path("."),
                        help="folder of the package, created if missing (default: the current folder)")
    parser.add_argument("--name", help="package name (default: the folder's name)")


def init(args) -> int:
    """Makes a folder a Stilo package: writes package.texl, creates
    references/ and copies the Stilo library into references/stilo/, never
    over an existing one."""
    folder = args.folder.resolve()
    if (folder / MANIFEST).exists():
        print(f"stilo: {args.folder}: already a package ({MANIFEST} exists)", file=sys.stderr)
        return 1
    try:
        kept = make_package(folder, args.name or folder.name)
    except OSError as e:
        print(f"stilo: {args.folder}: {e}", file=sys.stderr)
        return 1
    print(f"Stilo: {folder} is a package: {MANIFEST}, {REFERENCES}/")
    if kept:
        print(f"Stilo: {REFERENCES}/{LIBRARY_NAME}/ already exists: left as it is")
    return 0


COMMANDS = [
    Command("init", "make a folder a Stilo package, with the Stilo library", init_arguments, init),
    Command("render", "render a Texl document", render_arguments, render),
    Command("serve", "serve a folder of Texl documents with the web app", serve_arguments, serve),
    Command("tutor", "learn Stilo: open the tutorial in the web app", tutor_arguments, tutor),
]
