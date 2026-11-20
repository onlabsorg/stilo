"""Packages in the CLI (DECISIONS.md S10): the engine that resolves `~` in
file paths and reads inside packed packages (S23), and what `stilo init`
(and `stilo tutor`, S14) writes.

The rules themselves are in `stilo.server.home` and `stilo.server.archive`,
shared with the server, so that both read the same way.
"""

from __future__ import annotations

import re
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

import pytexl
from pytexl.loaders import file_path, load_file

from stilo.server.archive import ARCHIVE_SUFFIX, ArchiveError, Archives, pack_package
from stilo.server.files import INDEX
from stilo.server.home import MANIFEST, expand_home, has_home

# The Texl library Stilo bundles, a package packed into a package's
# references/stilo.texlz by `stilo init` (S24). Its source is `texl-lib/` at
# the root of the checkout; the wheel ships it as `stilo/texl-lib`
# (pyproject.toml), and it is packed when a package is made.
STILO_DIR = Path(__file__).resolve().parents[1]
_INSTALLED_LIB = STILO_DIR / "texl-lib"
TEXL_LIB = _INSTALLED_LIB if _INSTALLED_LIB.is_dir() else STILO_DIR.parents[1] / "texl-lib"

REFERENCES = "references"
LIBRARY_NAME = "stilo"
LIBRARY_FILE = LIBRARY_NAME + ARCHIVE_SUFFIX  # references/stilo.texlz

# The packed packages the loader opened, kept until their file changes
ARCHIVES = Archives()


def library_archive() -> bytes:
    """The Stilo library as a packed package: `texl-lib/` packed, the same
    bytes for the same library, wherever Stilo is installed. Git's ignore
    rules do not apply: an install inside a repository that ignores it (a
    virtual environment in a project) would otherwise leave out every file."""
    return pack_package(TEXL_LIB, gitignore=False)


def make_package(folder: Path, name: str) -> bool:
    """Makes `folder` a package: creates it if missing, writes `package.texl`
    (never over an existing one: `FileExistsError`), creates `references/` and
    writes the Stilo library there as a packed package, `references/stilo.texlz`.
    Returns whether a `references/stilo.texlz` was already there, which is then
    left as it is."""
    folder.mkdir(parents=True, exist_ok=True)
    with open(folder / MANIFEST, "x", encoding="utf-8") as file:
        file.write(manifest(name))
    return not add_library(folder)


def add_library(folder: Path) -> bool:
    """Creates `references/` in `folder` if missing and writes the Stilo
    library there, `references/stilo.texlz`, unless one is there already.
    Returns whether it wrote it."""
    library = folder / REFERENCES / LIBRARY_FILE
    (folder / REFERENCES).mkdir(exist_ok=True)
    if library.exists():
        return False
    library.write_bytes(library_archive())
    return True


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
    return expand_home(Path(path.anchor), path.parts[1:], top_of, ARCHIVES.is_package)


def read_archived(path: Path) -> str | None:
    """The text of `path` if it goes through a packed package, read in
    memory; None if it goes through none."""
    try:
        content = ARCHIVES.read(path)
    except ArchiveError as e:
        raise ValueError(f"not a valid packed package: {e}") from None
    return None if content is None else content.decode("utf-8")


async def load_package_file(uri: str) -> str | tuple[str, str]:
    """pytexl's file loader, with `~` resolved, packed packages read as
    folders, and a folder or a packed package read as its `index.texl`
    (S25), as the server's redirects do. A path that resolves elsewhere
    gives the real file as the document's final URL (Texl 0.8): its
    identity, so imports of one document by different paths share it,
    relative imports resolve from its folder, and a cycle through `~` ends."""
    path = file_path(uri)
    final_url = None
    if has_home(path):
        path = resolve_file(uri)
        final_url = path.as_uri()
    if ARCHIVES.is_folder(path):
        path = path / INDEX
        final_url = path.as_uri()
    text = read_archived(path)
    if text is None:
        text = await load_file(final_url or uri)
    return text if final_url is None else (final_url, text)


def create_engine() -> pytexl.Engine:
    """The engine of every CLI command that renders."""
    engine = pytexl.Engine()
    engine.add_loader("file", load_package_file)
    engine.set_default_loader(load_package_file)
    return engine


def swan_text(value: str) -> str:
    """`value` made safe for a Swan text literal in a tag: Swan strings have
    no escapes, so it loses any `"` and `%>`."""
    return re.sub(r'"|%>', "", value).strip()


def manifest(name: str) -> str:
    """The text of a new `package.texl`."""
    name = swan_text(name) or "package"
    return f"""# {name}

This folder is a Stilo package. This file marks its home folder: in an
import, `~` stands for it, as in `~/references/stilo.texlz/index.texl`. The values below
configure the package.

<% package_name = "{name}" %>
<% stilo_version = "{stilo_version()}" %>
"""
