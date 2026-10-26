"""Development entry point: `python -m stilo_server --root <folder>`.
Users start the server with `stilo serve` (the CLI, `cli/`)."""

import argparse
from pathlib import Path

import uvicorn

from .app import create_app

HERE = Path(__file__).resolve().parent
DEFAULT_ROOT = HERE.parents[1] / "examples"
DEFAULT_WEB = HERE.parents[1] / "web" / "dist"


def main():
    parser = argparse.ArgumentParser(description="Stilo server")
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT,
                        help="folder of the documents (default: stilo/examples)")
    parser.add_argument("--web", type=Path, default=DEFAULT_WEB,
                        help="built web app (default: stilo/web/dist)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    uvicorn.run(create_app(args.root, args.web), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
