"""Projects in the CLI (DECISIONS.md S10): the engine that resolves `~` in
file paths, and what `stilo init` (and `stilo tutor`, S14) writes.

The rule itself is in `stilo.server.home`, shared with the server.
"""

from __future__ import annotations

import re
import shutil
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

import pytexl
from pytexl.loaders import file_path, load_file

from stilo.server.home import MANIFEST, expand_home, has_home

# The Texl library Stilo bundles, copied into a project's lib/stilo/ by
# `stilo init`. Its source is `texl-lib/` at the root of the checkout; the
# wheel ships it as `stilo/texl-lib` (pyproject.toml).
PACKAGE = Path(__file__).resolve().parents[1]
_INSTALLED_LIB = PACKAGE / "texl-lib"
TEXL_LIB = _INSTALLED_LIB if _INSTALLED_LIB.is_dir() else PACKAGE.parents[1] / "texl-lib"

LIB = "lib"
LIBRARY_NAME = "stilo"


def make_project(folder: Path, name: str) -> bool:
    """Makes `folder` a project: creates it if missing, writes `project.texl`
    (never over an existing one: `FileExistsError`), creates `lib/` and
    copies the bundled library into `lib/stilo/`. Returns whether a
    `lib/stilo/` was already there, which is then left as it is."""
    library = folder / LIB / LIBRARY_NAME
    folder.mkdir(parents=True, exist_ok=True)
    with open(folder / MANIFEST, "x", encoding="utf-8") as file:
        file.write(manifest(name))
    (folder / LIB).mkdir(exist_ok=True)
    kept = library.exists()
    if not kept:
        shutil.copytree(TEXL_LIB, library)
    return kept


def stilo_version() -> str:
    """The version of the installed package (pyproject.toml), the one place it is set."""
    try:
        return version("stilo-cli")
    except PackageNotFoundError:  # a checkout run without installing
        return "0.0.0"


def top_of(folder: Path) -> Path:
    """The highest folder the search for a home may reach from `folder`: the
    user's home directory, or the file-system root for a folder outside it."""
    user_home = Path.home().resolve()
    return user_home if folder.is_relative_to(user_home) else Path(folder.anchor)


def resolve_file(uri: str) -> Path:
    """The file a `file://` URL or an absolute path stands for, `~` resolved."""
    path = file_path(uri)
    if not has_home(path):
        return path
    return expand_home(Path(path.anchor), path.parts[1:], top_of)


async def load_project_file(uri: str) -> str | tuple[str, str]:
    """pytexl's file loader, with `~` resolved. A path with `~` gives the
    real file as the document's final URL (Texl 0.8): its identity, so
    imports of one library by different paths share it, and a cycle
    through `~` ends."""
    if not has_home(file_path(uri)):
        return await load_file(uri)
    final_url = resolve_file(uri).as_uri()
    return final_url, await load_file(final_url)


def create_engine() -> pytexl.Engine:
    """The engine of every CLI command that renders."""
    engine = pytexl.Engine()
    engine.add_loader("file", load_project_file)
    engine.set_default_loader(load_project_file)
    return engine


def swan_text(value: str) -> str:
    """`value` made safe for a Swan text literal in a tag: Swan strings have
    no escapes, so it loses any `"` and `%>`."""
    return re.sub(r'"|%>', "", value).strip()


def manifest(name: str) -> str:
    """The text of a new `project.texl`."""
    name = swan_text(name) or "project"
    return f"""# {name}

This folder is a Stilo project. This file marks its home folder: in an
import, `~` stands for it, as in `~/lib/stilo/index.texl`. The values below
configure the project.

<% project_name = "{name}" %>
<% stilo_version = "{stilo_version()}" %>
"""
