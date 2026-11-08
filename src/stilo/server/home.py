"""The project home and the `~` segment of import paths (DECISIONS.md S10).

A project is a folder holding a manifest, `project.texl`. The home of a
folder is the nearest folder at or above it that holds one, or, without
one, the top: the highest folder the caller lets the search reach (the
served folder for the server; the user's home directory, or the file-system
root, for the CLI).

In a path, a segment `~` stands for the home of the folder before it. Texl
gives `~` no meaning, so an import of `~/lib/x.texl` from `/p/docs/a.texl`
asks for `/p/docs/~/lib/x.texl`; `expand_home` turns that into the real
path, one `~` at a time from the left. Several `~` occur naturally: a
library loaded as `.../~/lib/a/a.texl` that imports `~/lib/b/b.texl` asks
for `.../~/lib/a/~/lib/b/b.texl`, whose second `~` is the home of `lib/a`
(the library's own, if it has a manifest, else the project's).

Texl tells an import cycle by its URLs, and the URLs of a cycle through `~`
differ at every turn (`a/~/lib/x/~/lib/x/...`): it would never end. So a
path with more than `MAX_HOMES` `~` segments is refused, as a cycle.

Used by the server (`storage.py`) and by the CLI's file loader, so that
both resolve the same way. It reads the file system only to look for
manifests; validating the result is the caller's job.
"""

from __future__ import annotations

from pathlib import Path, PurePath
from typing import Callable, Iterable

MANIFEST = "project.texl"
HOME = "~"
MAX_HOMES = 16


class HomeCycle(ValueError):
    """A path with more `~` segments than any real chain of imports needs."""


def home_of(folder: Path, top: Path) -> Path:
    """The nearest folder at or above `folder`, up to `top`, that holds a
    manifest; `top` if none does. `folder` is expected inside `top`."""
    for candidate in (folder, *folder.parents):
        if (candidate / MANIFEST).is_file():
            return candidate
        if candidate == top:
            break
    return top


def expand_home(base: Path, segments: Iterable[str],
                top_of: Callable[[Path], Path]) -> Path:
    """The path of `segments` under `base`, with every `~` segment replaced,
    from the left, by the home of the folder built so far. `top_of(folder)`
    gives the highest folder the search for that folder's home may reach.
    Raises `HomeCycle` beyond `MAX_HOMES` `~` segments."""
    segments = list(segments)
    if segments.count(HOME) > MAX_HOMES:
        raise HomeCycle(f"more than {MAX_HOMES} {HOME} segments: an import cycle through {HOME}?")
    current = base
    for segment in segments:
        current = home_of(current, top_of(current)) if segment == HOME else current / segment
    return current


def has_home(path: str | PurePath) -> bool:
    """Whether a path (a "/"-separated string or a path object) has a `~` segment."""
    parts = path.parts if isinstance(path, PurePath) else str(path).split("/")
    return HOME in parts
