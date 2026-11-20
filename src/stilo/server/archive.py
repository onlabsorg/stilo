"""Packed packages (DECISIONS.md S23): a package stored as one zip file.

A *packed package* is a zip file with the extension `ARCHIVE_SUFFIX`
(`.texlz`) whose root holds a `package.texl`. Stilo shows and reads it as a
read-only folder: a path that goes through one, `refs/lib.texlz/docs/x.texl`,
names an entry inside it, and archives nested in archives work the same way.
The path of the archive itself names the file.

Archives are untrusted, like documents. `Archive` reads one in memory and
never extracts it to disk; it refuses entries with absolute paths, `..`,
backslashes, links, duplicate names, encryption or an unknown compression,
and archives over `MAX_ENTRIES` entries, `MAX_UNPACKED` bytes once
unpacked (by the sizes the archive declares, which reading enforces) or
nested deeper than `MAX_NESTING`. Hidden entries and entries named `~` are
left out, as the protocol never shows them.

`Archives` finds and reads paths that go through archives, keeping opened
archives in a small cache keyed by path, modification time and size. The
server's `FolderStorage` and the CLI's file loader use it, so that both read
the same way. `pack_package` makes a deterministic `.texlz` from a package
folder (`stilo pack`, and Papiro's releases).

Used by the server only through `storage.py`; it must not import the rest of
the package (tests/test_layout.py).
"""

from __future__ import annotations

import io
import os
import stat
import subprocess
import tempfile
import threading
import zipfile
import zlib
from collections import OrderedDict
from pathlib import Path, PurePosixPath
from typing import Iterable

from .home import HOME, MANIFEST

ARCHIVE_SUFFIX = ".texlz"

# Safeguards against zip bombs and absurd archives (an archive is untrusted)
MAX_ARCHIVE_BYTES = 256 * 1024 * 1024   # the zip file itself
MAX_UNPACKED = 256 * 1024 * 1024        # the sum of its entries, unpacked
MAX_ENTRIES = 10_000
MAX_NESTING = 8                         # archives in archives

# What a packed package is written with: fixed, so that the same files always
# give the same bytes (pack_package)
PACK_DATE = (1980, 1, 1, 0, 0, 0)
PACK_MODE = 0o100644                    # a regular file, rw-r--r--
PACK_LEVEL = 9

_COMPRESSIONS = (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)


class ArchiveError(ValueError):
    """An archive that cannot be read as a packed package, or a package that
    cannot be packed. The message says why, in words a user can read."""


def is_archive(path: str | PurePosixPath) -> bool:
    """Whether `path` names a packed package, by its suffix."""
    return PurePosixPath(str(path).strip("/") or "/").suffix == ARCHIVE_SUFFIX


def _hidden(segment: str) -> bool:
    return segment.startswith(".") or segment == HOME


class Archive:
    """A packed package read in memory: its entries by path, checked when it
    is opened, and read when asked for. `name` names it in messages."""

    def __init__(self, data: bytes, name: str = "archive", depth: int = 0):
        self.name = name
        self.depth = depth
        if depth > MAX_NESTING:
            raise ArchiveError(f"{name}: packed packages nested more than {MAX_NESTING} deep")
        if len(data) > MAX_ARCHIVE_BYTES:
            raise ArchiveError(f"{name}: larger than {MAX_ARCHIVE_BYTES} bytes")
        try:
            self._zip = zipfile.ZipFile(io.BytesIO(data))
        except (zipfile.BadZipFile, zipfile.LargeZipFile, ValueError, EOFError) as e:
            raise ArchiveError(f"{name}: not a zip file ({e})") from None
        self._lock = threading.Lock()
        self._nested: dict[str, Archive] = {}
        self.files: dict[str, zipfile.ZipInfo] = {}
        self.folders: set[str] = {""}
        self._index()

    def _index(self) -> None:
        infos = self._zip.infolist()
        if len(infos) > MAX_ENTRIES:
            raise ArchiveError(f"{self.name}: more than {MAX_ENTRIES} entries")
        seen: set[str] = set()
        unpacked = 0
        for info in infos:
            raw = info.filename
            if raw in seen:
                raise ArchiveError(f"{self.name}: the entry {raw!r} is there twice")
            seen.add(raw)
            if raw.startswith("/") or "\\" in raw or (len(raw) > 1 and raw[1] == ":"):
                raise ArchiveError(f"{self.name}: the entry {raw!r} has an absolute path")
            name = raw[:-1] if info.is_dir() else raw
            segments = name.split("/")
            if any(segment in ("", ".", "..") for segment in segments):
                raise ArchiveError(f"{self.name}: the entry {raw!r} has an invalid path")
            if stat.S_ISLNK(info.external_attr >> 16):
                raise ArchiveError(f"{self.name}: the entry {raw!r} is a link")
            if info.flag_bits & 0x1:
                raise ArchiveError(f"{self.name}: the entry {raw!r} is encrypted")
            if info.compress_type not in _COMPRESSIONS:
                raise ArchiveError(f"{self.name}: the entry {raw!r} uses an unknown compression")
            unpacked += info.file_size
            if unpacked > MAX_UNPACKED:
                raise ArchiveError(f"{self.name}: more than {MAX_UNPACKED} bytes once unpacked")
            if any(_hidden(segment) for segment in segments):
                continue  # never reachable through the protocol
            parents = ["/".join(segments[:i]) for i in range(1, len(segments))]
            if info.is_dir():
                parents.append(name)
            for folder in parents:
                if folder in self.files:
                    raise ArchiveError(f"{self.name}: {folder!r} is both a file and a folder")
                self.folders.add(folder)
            if not info.is_dir():
                if name in self.folders:
                    raise ArchiveError(f"{self.name}: {name!r} is both a file and a folder")
                self.files[name] = info
        if MANIFEST not in self.files:
            raise ArchiveError(f"{self.name}: not a packed package (no {MANIFEST} at its root)")

    # -- entries ---------------------------------------------------------------

    def kind(self, inner: str) -> str | None:
        """`"file"`, `"folder"` or None for the entry at `inner` ("" the root)."""
        if inner in self.files:
            return "file"
        return "folder" if inner in self.folders else None

    def size(self, inner: str) -> int:
        return self.files[inner].file_size

    def read(self, inner: str) -> bytes:
        """The content of the file at `inner`. Raises `KeyError` if there is
        no such file, `ArchiveError` if it cannot be read."""
        info = self.files[inner]
        try:
            with self._lock, self._zip.open(info) as entry:
                # The reader stops at the declared size, which _index limited
                return entry.read()
        except (zipfile.BadZipFile, zlib.error, EOFError, ValueError) as e:
            raise ArchiveError(f"{self.name}: {inner!r} cannot be read ({e})") from None

    def children(self, folder: str) -> tuple[list[str], list[str]]:
        """The names of the folders and of the files directly in `folder`,
        each sorted."""
        prefix = f"{folder}/" if folder else ""
        def direct(paths):
            return sorted(path[len(prefix):] for path in paths
                          if path.startswith(prefix) and path != folder and "/" not in path[len(prefix):])
        return direct(self.folders), direct(self.files)

    def nested(self, inner: str) -> Archive:
        """The packed package in the file at `inner`, opened once."""
        if inner not in self._nested:
            self._nested[inner] = Archive(self.read(inner), f"{self.name}/{inner}", self.depth + 1)
        return self._nested[inner]

    def is_nested_archive(self, inner: str) -> bool:
        """Whether the file at `inner` is a packed package that opens."""
        if not (is_archive(inner) and inner in self.files):
            return False
        try:
            self.nested(inner)
            return True
        except ArchiveError:
            return False

    def locate(self, segments: list[str]) -> tuple[Archive, str]:
        """The archive, this one or one nested in it, that holds the entry at
        `segments`, and the entry's path in it. A segment naming a nested
        archive, followed by more, goes into it."""
        for i in range(len(segments) - 1):
            inner = "/".join(segments[:i + 1])
            if is_archive(inner) and inner in self.files:
                return self.nested(inner).locate(segments[i + 1:])
        return self, "/".join(segments)


class Archives:
    """Finds and reads paths that go through packed packages, with a cache of
    the archives opened: an archive is read and checked again only when its
    file changes (path, modification time, size). `root`, if given, is the
    folder archives must be in: one reached through a link that leaves it is
    not opened."""

    def __init__(self, root: Path | None = None, size: int = 16):
        self.root = root
        self._size = size
        self._cache: OrderedDict[tuple, Archive | ArchiveError] = OrderedDict()
        self._lock = threading.Lock()

    def open(self, file: Path) -> Archive:
        """The packed package in `file`, an archive file on disk. Raises
        `ArchiveError` if it is not one (also cached, until the file changes)."""
        real = file.resolve()
        if self.root is not None and not real.is_relative_to(self.root):
            raise ArchiveError(f"{file.name}: outside the served folder")
        info = real.stat()
        key = (str(real), info.st_mtime_ns, info.st_size)
        with self._lock:
            found = self._cache.get(key)
            if found is not None:
                self._cache.move_to_end(key)
        if found is None:
            try:
                if info.st_size > MAX_ARCHIVE_BYTES:
                    raise ArchiveError(f"{file.name}: larger than {MAX_ARCHIVE_BYTES} bytes")
                found = Archive(real.read_bytes(), file.name)
            except ArchiveError as e:
                found = e
            with self._lock:
                # Older versions of the same file go
                for old in [k for k in self._cache if k[0] == key[0]]:
                    del self._cache[old]
                self._cache[key] = found
                while len(self._cache) > self._size:
                    self._cache.popitem(last=False)
        if isinstance(found, ArchiveError):
            raise found
        return found

    @staticmethod
    def archive_file(path: Path) -> tuple[Path, list[str]] | None:
        """The archive file on disk that `path` goes through, and the segments
        after it; None if `path` goes through none (the path of an archive
        itself goes through none: it is the file)."""
        parts = path.parts
        for i in range(1, len(parts) - 1):
            if parts[i].endswith(ARCHIVE_SUFFIX):
                candidate = Path(*parts[:i + 1])
                if candidate.is_file():
                    return candidate, list(parts[i + 1:])
        return None

    def locate(self, path: Path) -> tuple[Archive, str] | None:
        """The archive that holds `path` and the entry's path in it, nested
        archives followed; None if `path` goes through no archive. Raises
        `ArchiveError` if an archive on the way cannot be read."""
        found = self.archive_file(path)
        if found is None:
            return None
        file, segments = found
        return self.open(file).locate(segments)

    def is_package(self, folder: Path) -> bool:
        """Whether `folder`, on disk or in an archive, holds a manifest: the
        check `expand_home` makes, archives included."""
        try:
            found = self.locate(folder / MANIFEST)
        except ArchiveError:
            return False
        if found is None:
            return (folder / MANIFEST).is_file()
        archive, inner = found
        return archive.kind(inner) == "file"

    def is_folder(self, path: Path) -> bool:
        """Whether `path` is a folder, on disk or in an archive, or a packed
        package (an archive file that opens, on disk or nested): what a read
        leads to the `index.texl` of (S25)."""
        try:
            found = self.locate(path)
            if found is None:
                if path.is_dir():
                    return True
                if is_archive(path.name) and path.is_file():
                    self.open(path)
                    return True
                return False
        except ArchiveError:
            return False
        archive, inner = found
        return archive.kind(inner) == "folder" or archive.is_nested_archive(inner)

    def read(self, path: Path) -> bytes | None:
        """The content of `path` if it goes through an archive, None if it
        does not. Raises `FileNotFoundError` or `IsADirectoryError` for an
        entry that is missing or a folder, `ArchiveError` for an archive that
        cannot be read."""
        found = self.locate(path)
        if found is None:
            return None
        archive, inner = found
        kind = archive.kind(inner)
        if kind == "folder":
            raise IsADirectoryError(f"{path}: a folder in the packed package {archive.name}")
        if kind is None:
            raise FileNotFoundError(f"{path}: no such file in the packed package {archive.name}")
        return archive.read(inner)


# -- packing -----------------------------------------------------------------------

def _git(folder: Path, *args: str, stdin: bytes | None = None,
         git_dir: Path | None = None) -> subprocess.CompletedProcess | None:
    """Runs git in `folder` without the user's global excludes, so that the
    result depends on the files alone; with `git_dir`, as the top of the
    working tree of that repository. None if git cannot run."""
    command = ["git", "-c", f"core.excludesFile={os.devnull}"]
    if git_dir is not None:
        command += [f"--git-dir={git_dir}", f"--work-tree={folder}"]
    try:
        return subprocess.run(command + list(args), cwd=folder, input=stdin,
                              capture_output=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None


def _check_ignore(folder: Path, paths: list[str], git_dir: Path | None = None) -> set[str] | None:
    """Those of `paths` (relative to `folder`) that git ignores; None if
    `folder` is not in a working tree or git cannot run."""
    result = _git(folder, "check-ignore", "-z", "--stdin",
                  stdin="\0".join(paths).encode() + b"\0", git_dir=git_dir)
    if result is None or result.returncode not in (0, 1):  # 128: not a repository
        return None
    return {path for path in result.stdout.decode().split("\0") if path}


def _in_repository(folder: Path) -> bool:
    """Whether `folder` belongs to the git working tree it is in: it is in
    one, and that repository does not ignore it (or a folder above it)."""
    result = _git(folder, "rev-parse", "--show-toplevel")
    if result is None or result.returncode != 0:
        return False
    top = Path(result.stdout.decode().strip()).resolve()
    if top == folder:
        return True
    if not folder.is_relative_to(top):  # e.g. a submodule's top, or a link
        return False
    ignored = _check_ignore(top, [folder.relative_to(top).as_posix()])
    return ignored is not None and not ignored


def _git_ignored(folder: Path, paths: list[str]) -> set[str]:
    """Those of `paths` (relative to `folder`) that git ignores (S23, as
    amended 2026-11-20). If `folder` belongs to a working tree (one that
    does not ignore it), that repository's rules count (its `.gitignore`
    files, `.git/info/exclude`). Otherwise, outside a repository or in one
    that ignores the folder, the folder counts as the top of a repository
    of its own: only the `.gitignore` files inside it count. Never the
    user's global excludes. None ignored if git is not installed."""
    if not paths:
        return set()
    if _in_repository(folder):
        return _check_ignore(folder, paths) or set()
    with tempfile.TemporaryDirectory() as empty:
        if (result := _git(Path(empty), "init", "-q")) is None or result.returncode != 0:
            return set()
        return _check_ignore(folder, paths, git_dir=Path(empty) / ".git") or set()


def package_files(folder: Path | str, exclude: Iterable[Path | str] = (), *,
                  gitignore: bool = True) -> list[str]:
    """The files `pack_package` packs from `folder`, as sorted "/" paths:
    every regular file under it, except hidden entries (`.git/`, `.trash/`,
    `.gitignore`…), entries named `~`, symbolic links (whatever they point
    to: nothing outside the folder goes in), files git ignores (unless
    `gitignore` is false; `_git_ignored` says which rules count), and the
    files in `exclude`."""
    folder = Path(folder).resolve()
    excluded = {Path(path).resolve() for path in exclude}
    found = []
    for here, dirs, files in os.walk(folder):
        here_path = Path(here)
        dirs[:] = [d for d in dirs if not _hidden(d) and not (here_path / d).is_symlink()]
        for name in files:
            path = here_path / name
            if _hidden(name) or path.is_symlink() or not path.is_file() or path in excluded:
                continue
            found.append(path.relative_to(folder).as_posix())
    ignored = _git_ignored(folder, found) if gitignore else set()
    return sorted(path for path in found if path not in ignored)


def pack_package(folder: Path | str, exclude: Iterable[Path | str] = (), *,
                 gitignore: bool = True) -> bytes:
    """A packed package (`.texlz`) of the package in `folder`, as bytes.

    Deterministic: the same files give the same bytes, and so the same hash.
    The entries (`package_files`) are sorted by path, with a fixed date
    (1980-01-01), fixed permissions (rw-r--r--), no folder entries and no
    comment; they are compressed with deflate at level 9, except packed
    packages, stored as they are. With `gitignore` false, files git ignores
    go in too (Stilo's own library, whose files are never private). Raises
    `ArchiveError` if `folder` is not a package, if its `package.texl` would
    be left out (ignored or excluded: the result could not be read as a
    package), or the result would be refused when read (`MAX_ENTRIES`,
    `MAX_UNPACKED`)."""
    folder = Path(folder).resolve()
    if not (folder / MANIFEST).is_file():
        raise ArchiveError(f"{folder}: not a package (no {MANIFEST})")
    paths = package_files(folder, exclude, gitignore=gitignore)
    if MANIFEST not in paths:
        raise ArchiveError(f"{folder}: its {MANIFEST} would be left out (ignored or excluded)")
    if len(paths) > MAX_ENTRIES:
        raise ArchiveError(f"{folder}: more than {MAX_ENTRIES} files to pack")
    buffer = io.BytesIO()
    unpacked = 0
    with zipfile.ZipFile(buffer, "w") as archive:
        for path in paths:
            content = (folder / path).read_bytes()
            unpacked += len(content)
            if unpacked > MAX_UNPACKED:
                raise ArchiveError(f"{folder}: more than {MAX_UNPACKED} bytes to pack")
            info = zipfile.ZipInfo(path, date_time=PACK_DATE)
            info.create_system = 3  # Unix, so that the permissions are read
            info.external_attr = PACK_MODE << 16
            if is_archive(path):
                info.compress_type = zipfile.ZIP_STORED
                archive.writestr(info, content)
            else:
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, content, compresslevel=PACK_LEVEL)
    return buffer.getvalue()
