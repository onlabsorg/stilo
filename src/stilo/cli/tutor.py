"""`stilo tutor`: the tutorial, in a working copy (DECISIONS.md S14).

The tutorial's source is `tutorial/` at the root of the checkout, shipped in
the wheel as `stilo/tutorial` (pyproject.toml). The user never edits it:
`stilo tutor` copies it into a working folder, makes the copy a project with
the code of `stilo init`, and serves it. An existing copy is reused, so
progress is kept; `--reset` moves it aside first, never deleting it.
"""

from __future__ import annotations

import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

import platformdirs

from .project import MANIFEST, PACKAGE, make_project, stilo_version, swan_text
from .web import WEB_DIST, run_server

_INSTALLED_TUTORIAL = PACKAGE / "tutorial"
TUTORIAL = _INSTALLED_TUTORIAL if _INSTALLED_TUTORIAL.is_dir() else PACKAGE.parents[1] / "tutorial"

PROJECT_NAME = "Stilo tutorial"
INDEX = "index.texl"

# The value `stilo tutor` adds to the copy's project.texl: the folder of the
# copy, shown by the command-line lessons. It also tells a copy from any
# other folder.
FOLDER_NAME = "tutorial_folder"
_FOLDER_VALUE = re.compile(rf"<%\s*{FOLDER_NAME}\s*=")
_VERSION_VALUE = re.compile(r'stilo_version\s*=\s*"([^"]*)"')


def default_folder() -> Path:
    """Where the copy goes by default: `tutorial` in Stilo's user data folder."""
    return platformdirs.user_data_path("stilo", appauthor=False) / "tutorial"


def is_copy(folder: Path) -> bool:
    """Whether `folder` is a working copy of the tutorial."""
    try:
        return bool(_FOLDER_VALUE.search((folder / MANIFEST).read_text(encoding="utf-8")))
    except OSError:
        return False


def is_empty(folder: Path) -> bool:
    return not folder.exists() or (folder.is_dir() and not any(folder.iterdir()))


def create_copy(folder: Path):
    """Copies the tutorial into `folder` (missing or empty) and makes it a project."""
    shutil.copytree(TUTORIAL, folder, dirs_exist_ok=True)
    make_project(folder, PROJECT_NAME)
    with open(folder / MANIFEST, "a", encoding="utf-8") as file:
        file.write(f'<% {FOLDER_NAME} = "{swan_text(str(folder))}" %>\n')


def move_aside(folder: Path) -> Path:
    """Renames `folder` to a free name next to it, with the date and time."""
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = folder.with_name(f"{folder.name}-old-{stamp}")
    n = 1
    while target.exists():
        n += 1
        target = folder.with_name(f"{folder.name}-old-{stamp}-{n}")
    folder.rename(target)
    return target


def copy_version(folder: Path) -> str | None:
    """The `stilo_version` written in the copy's project.texl, if any."""
    try:
        match = _VERSION_VALUE.search((folder / MANIFEST).read_text(encoding="utf-8"))
    except OSError:
        return None
    return match.group(1) if match else None


def version_key(text: str) -> tuple[int, ...]:
    """A version for comparison: its leading numbers, `0.3.0rc1` as (0, 3, 0)."""
    numbers = []
    for part in text.split("."):
        digits = re.match(r"\d+", part)
        if not digits:
            break
        numbers.append(int(digits.group()))
    return tuple(numbers)


def is_older(version: str | None, than: str) -> bool:
    return version_key(version or "0") < version_key(than)


def prepare(folder: Path, reset: bool, out=None, err=None) -> bool:
    """Makes sure `folder` holds a working copy, as `stilo tutor` does before
    serving it. Says what it did on `out` (standard output); returns False
    on an error, reported on `err` (standard error)."""
    out, err = out or sys.stdout, err or sys.stderr
    if folder.exists() and not folder.is_dir():
        print(f"stilo: {folder}: not a folder", file=err)
        return False
    if not is_empty(folder) and not is_copy(folder):
        print(f"stilo: {folder}: not a copy of the tutorial, and not empty: "
              "choose another folder with --dir", file=err)
        return False
    try:
        if reset and not is_empty(folder):
            old = move_aside(folder)
            print(f"Stilo: your old copy of the tutorial is now in {old}", file=out)
        if is_empty(folder):
            create_copy(folder)
            print(f"Stilo: a new copy of the tutorial is in {folder}", file=out)
            return True
    except OSError as e:
        print(f"stilo: {folder}: {e}", file=err)
        return False
    print(f"Stilo: your copy of the tutorial is in {folder}", file=out)
    version, installed = copy_version(folder), stilo_version()
    if is_older(version, installed):
        print(f"Stilo: this copy was made by Stilo {version or '(unknown)'}, and Stilo "
              f"{installed} may have changed lessons. To start again with the new "
              f"lessons, run: stilo tutor --reset (your copy will be kept, moved aside)",
              file=out)
    return True


def tutor_arguments(parser):
    parser.add_argument("--dir", type=Path, default=None,
                        help="folder of your copy of the tutorial (default: "
                             f"{default_folder()})")
    parser.add_argument("--reset", action="store_true",
                        help="start again from a fresh copy; the old one is moved aside, not deleted")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true",
                        help="do not open the browser")


def tutor(args) -> int:
    """Copies the tutorial if needed, serves the copy and opens its index."""
    folder = (args.dir or default_folder()).expanduser().resolve()
    if not prepare(folder, args.reset):
        return 1
    host = "127.0.0.1"
    url = f"http://{host}:{args.port}/{INDEX}"
    print(f"Stilo: the tutorial is at {url} (press Ctrl+C here to stop)")
    sys.stdout.flush()
    run_server(folder, host, args.port, WEB_DIST, open_url=None if args.no_browser else url)
    return 0
