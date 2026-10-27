"""The `stilo` subcommands.

Each command is a `Command`: a name, a help line, a function that adds its
arguments to a parser and a function that runs it. `COMMANDS` lists them in
the order `stilo --help` shows them; a plugin system can later add its own.
"""

import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import pytexl
import uvicorn

from stilo.server import create_app

# The built web app, `stilo/web`: written there by `npm run build` in a
# checkout, shipped there in the package
WEB_DIST = Path(__file__).resolve().parents[1] / "web"


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


def render(args) -> int:
    """Renders a document to standard output or a file, like `texl`."""
    path = args.file.resolve()
    doc = asyncio.run(pytexl.Engine().load(path.as_uri()))
    if doc is None:
        print(f"stilo: {args.file}: could not be loaded", file=sys.stderr)
        return 1
    if args.output:
        try:
            args.output.write_text(doc.rendering, encoding="utf-8")
        except OSError as e:
            print(f"stilo: {args.output}: {e}", file=sys.stderr)
            return 1
    else:
        sys.stdout.write(doc.rendering)
    return 0


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
    print(f"Stilo: serving {args.folder.resolve()} at http://{args.host}:{args.port}/")
    uvicorn.run(create_app(args.folder, args.web), host=args.host, port=args.port)
    return 0


COMMANDS = [
    Command("render", "render a Texl document", render_arguments, render),
    Command("serve", "serve a folder of Texl documents with the web app", serve_arguments, serve),
]
