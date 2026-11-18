"""The package home and the `~` segment of import paths (DECISIONS.md S10, S21).

A package is a folder holding a manifest, `package.texl`. The home of a
folder is the nearest folder at or above it that holds one, or, without
one, the top: the highest folder the caller lets the search reach (the
served folder for the server; the user's home directory, or the file-system
root, for the CLI).

In a path, a segment `~` stands for the home of the folder before it. Texl
gives `~` no meaning, so an import of `~/references/x.texl` from
`/p/docs/a.texl` asks for `/p/docs/~/references/x.texl`; `expand_home`
turns that into the real path, one `~` at a time from the left. Several `~`
occur naturally: a reference loaded as `.../~/references/a/a.texl` that imports
`~/references/b/b.texl` asks for `.../~/references/a/~/references/b/b.texl`,
whose second `~` is the home of `references/a` (the reference's own, if it
has a manifest, else the package's).

Hosts give Texl the real path as the document's final URL (Texl 0.8): the
server redirects, the CLI's loader returns it. So a reference is the
document at its real path, and a document importing itself through `~` asks
again for that path, an import cycle Texl ends. A path with more than
`MAX_HOMES` `~` segments is still refused, a safeguard for clients that keep
the `~` URL (`a/~/references/x/~/references/x/...` would grow at every turn).

Used by the server (`storage.py`) and by the CLI's file loader, so that
both resolve the same way. It reads the file system only to look for
manifests; validating the result is the caller's job.
"""

from __future__ import annotations

from pathlib import Path, PurePath
from typing import Callable, Iterable

MANIFEST = "package.texl"
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
