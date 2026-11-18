"""Storage of Texl documents (protocol v1, see docs/protocol.md).

`Storage` is the interface the HTTP layer (`create_app`) uses: any object
with its methods can hold the documents. `FolderStorage` is the default, a
folder on disk; `StorageWrapper` passes every call to another storage, so a
wrapper overrides only what it changes (e.g. reacting to every write).

Paths are relative to the storage root, with "/" separators. Every method
validates its path and raises a StorageError subclass that the HTTP layer
maps to a status code.
"""

from __future__ import annotations

import hashlib
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Protocol

from .home import HOME, HomeCycle, expand_home, has_home

DOCUMENT_SUFFIX = ".texl"
TRASH = ".trash"


class StorageError(Exception):
    status = 500


class BadRequest(StorageError):
    status = 400


class Forbidden(StorageError):
    """A write to an item the server cannot write (a read-only item)."""

    status = 403


class NotFound(StorageError):
    status = 404


class Conflict(StorageError):
    status = 409


class PreconditionFailed(StorageError):
    status = 412


def etag(content: bytes) -> str:
    """Strong ETag of a file's content, quoted as HTTP requires."""
    return '"' + hashlib.sha256(content).hexdigest() + '"'


def is_document(path: str) -> bool:
    """Whether `path` names a Texl document (by its suffix, `.texl`)."""
    return PurePosixPath(path.strip("/") or "/").suffix == DOCUMENT_SUFFIX


class Storage(Protocol):
    """What `create_app()` needs from a storage (docs/server.md). Paths are
    relative to the root, "/"-separated, `""` the root. Failures are raised
    as `StorageError` subclasses, which carry the HTTP status."""

    def read(self, path: str) -> tuple[bytes, str]:
        """A file's content and its ETag; `~` segments expanded."""
        ...

    def create(self, path: str, content: bytes) -> str:
        """A new file, with its missing folders; returns its ETag."""
        ...

    def update(self, path: str, content: bytes, if_match: str | None = None) -> str:
        """A document's new content, if it still has the ETag `if_match`;
        returns the new ETag."""
        ...

    def delete_file(self, path: str) -> None:
        """Delete a file."""
        ...

    def delete_folder(self, path: str) -> dict:
        """Delete a folder with all it holds; returns `{"deleted": <files>}`."""
        ...

    def move(self, path: str, to: str) -> str:
        """Move or rename a file or a folder; returns its new path."""
        ...

    def create_folder(self, path: str) -> None:
        """Create a folder, and its missing parents."""
        ...

    def tree(self, path: str, depth: int | None = None) -> dict:
        """The tree of a folder, as the protocol's QUERY answers it."""
        ...

    def expand_home(self, path: str) -> str:
        """`path` with its `~` segments replaced by the real path."""
        ...


class StorageWrapper:
    """A storage that passes every call to `inner`. Subclass it and override
    what changes, calling `super()` for the rest; any other attribute (e.g.
    `root` of a `FolderStorage`) is read from `inner` too."""

    def __init__(self, inner: Storage):
        self.inner = inner

    def __getattr__(self, name):
        if name == "inner":  # not set yet: no recursion through __getattr__
            raise AttributeError(name)
        return getattr(self.inner, name)

    def read(self, path: str) -> tuple[bytes, str]:
        return self.inner.read(path)

    def create(self, path: str, content: bytes) -> str:
        return self.inner.create(path, content)

    def update(self, path: str, content: bytes, if_match: str | None = None) -> str:
        return self.inner.update(path, content, if_match)

    def delete_file(self, path: str) -> None:
        return self.inner.delete_file(path)

    def delete_folder(self, path: str) -> dict:
        return self.inner.delete_folder(path)

    def move(self, path: str, to: str) -> str:
        return self.inner.move(path, to)

    def create_folder(self, path: str) -> None:
        return self.inner.create_folder(path)

    def tree(self, path: str, depth: int | None = None) -> dict:
        return self.inner.tree(path, depth)

    def expand_home(self, path: str) -> str:
        return self.inner.expand_home(path)


class FolderStorage:
    """The default storage: the documents in a folder on disk."""

    def __init__(self, root: Path | str):
        self.root = Path(root).resolve()
        if not self.root.is_dir():
            raise ValueError(f"storage root is not a folder: {self.root}")

    # -- paths ---------------------------------------------------------------

    @staticmethod
    def _segments(path: str) -> list[str]:
        segments = path.strip("/").split("/") if path.strip("/") else []
        for segment in segments:
            if segment in ("", ".", "..") or segment.startswith("."):
                raise BadRequest(f"invalid path: {path!r}")
        return segments

    def expand_home(self, path: str) -> str:
        """`path` with its `~` segments replaced by the project home they
        stand for (home.py); the search never leaves the root. Only reads
        expand `~`: as a name it is refused."""
        if not has_home(path):
            return path
        try:
            target = expand_home(self.root, self._segments(path), lambda folder: self.root)
        except HomeCycle as e:
            raise BadRequest(f"{e}: {path!r}") from None
        return target.relative_to(self.root).as_posix() if target != self.root else ""

    def resolve(self, path: str) -> Path:
        """The absolute file-system path of `path`, refusing paths that are
        malformed, hidden, reserved or outside the root."""
        segments = self._segments(path)
        if HOME in segments:
            raise BadRequest(f"{HOME} stands for the project home and cannot be a name: {path!r}")
        if segments and segments[0].startswith("_"):
            raise BadRequest(f"reserved path: {path!r}")
        target = self.root.joinpath(*segments).resolve()
        if not target.is_relative_to(self.root):
            raise BadRequest(f"path outside the root: {path!r}")
        return target

    def relative(self, target: Path) -> str:
        return target.relative_to(self.root).as_posix() if target != self.root else ""

    # -- read-only items -----------------------------------------------------

    @staticmethod
    def _writable(target: Path) -> bool:
        return os.access(target, os.W_OK) if os.path.lexists(target) else True

    def read_only(self, target: Path) -> str | None:
        """Why the item at `target` cannot be changed, or None: a folder the
        server cannot write, a file it cannot write, or a file in such a folder
        (a document is saved by writing a sibling and renaming it)."""
        if target.is_dir() and not target.is_symlink():
            return None if self._writable(target) else "The folder cannot be written on the server"
        if not self._writable(target):
            return "The file cannot be written on the server"
        if not self._writable(target.parent):
            return "Its folder cannot be written on the server"
        return None

    def _check_writable(self, target: Path) -> None:
        """Refuse a change to a read-only item."""
        if reason := self.read_only(target):
            raise Forbidden(reason)

    def _check_room(self, target: Path) -> None:
        """Refuse a new item at `target` if the nearest existing folder above
        it cannot be written."""
        folder = target.parent
        while not os.path.lexists(folder) and folder != self.root:
            folder = folder.parent
        if folder.is_dir() and not self._writable(folder):
            raise Forbidden("The folder cannot be written on the server")

    def _check_inside(self, folder: Path) -> None:
        """Refuse moving or deleting a folder that holds read-only items."""
        for here, dirs, files in os.walk(folder):
            for name in dirs + files:
                if self.read_only(Path(here) / name):
                    raise Forbidden("It holds items that cannot be written on the server")

    # -- files ---------------------------------------------------------------

    def read(self, path: str) -> tuple[bytes, str]:
        target = self.resolve(self.expand_home(path))
        if target.is_dir():
            raise BadRequest(f"not a file: {path!r}")
        if not target.is_file():
            raise NotFound(f"no such file: {path!r}")
        content = target.read_bytes()
        return content, etag(content)

    def create(self, path: str, content: bytes) -> str:
        """Create a file, a document or any other, and its missing folders."""
        target = self._item(path)
        if target.is_dir():
            raise Conflict(f"already exists, as a folder: {path!r}")
        self._check_room(target)
        self._make_folder(target.parent, path)
        try:
            with open(target, "xb") as file:
                file.write(content)
        except FileExistsError:
            raise Conflict(f"already exists: {path!r}") from None
        except PermissionError:
            raise Forbidden("The folder cannot be written on the server") from None
        return etag(content)

    def update(self, path: str, content: bytes, if_match: str | None = None) -> str:
        target = self.resolve(path)
        if target.suffix != DOCUMENT_SUFFIX:
            raise BadRequest(f"only {DOCUMENT_SUFFIX} files can be updated: {path!r}")
        if target.is_dir():
            raise BadRequest(f"is a folder: {path!r}")
        if not target.is_file():
            raise NotFound(f"no such file: {path!r}")
        if if_match is not None and if_match != etag(target.read_bytes()):
            raise PreconditionFailed(f"changed since it was read: {path!r}")
        self._check_writable(target)
        # Write a sibling and rename it over the target, so readers never see
        # a half-written document.
        temp = target.with_name(f".{target.name}.tmp")
        try:
            temp.write_bytes(content)
            os.replace(temp, target)
        except PermissionError:
            raise Forbidden("The file cannot be written on the server") from None
        return etag(content)

    def _item(self, path: str) -> Path:
        """The file-system path of an item to create, move or delete, validated as
        `resolve` does. A symbolic link stays itself: the item is the link, not
        what it points to."""
        self.resolve(path)
        relative = path.strip("/")
        if not relative:
            raise BadRequest("not allowed on the root folder")
        return self.root.joinpath(*relative.split("/"))

    # -- move ----------------------------------------------------------------

    def move(self, path: str, to: str) -> str:
        """Move or rename a file or a folder; returns its new path. A document
        stays a document and another file stays another file."""
        source = self._item(path)
        target = self._item(to)
        if not os.path.lexists(source):
            raise NotFound(f"no such item: {path!r}")
        if source.is_dir():
            if target.suffix == DOCUMENT_SUFFIX:
                raise BadRequest(f"a folder's name cannot end in {DOCUMENT_SUFFIX}: {to!r}")
            if target.resolve().is_relative_to(source.resolve()) and target != source:
                raise BadRequest(f"a folder cannot go inside itself: {to!r}")
        elif (source.suffix == DOCUMENT_SUFFIX) != (target.suffix == DOCUMENT_SUFFIX):
            raise BadRequest(f"a file cannot gain or lose the {DOCUMENT_SUFFIX} extension: {path!r} to {to!r}")
        if target == source:
            return self.relative(target)
        # On a file system that ignores case, a new case of the name is the same item
        if os.path.lexists(target) and not os.path.samefile(source, target):
            raise Conflict(f"already exists: {to!r}")
        self._check_writable(source)
        if source.is_dir() and not source.is_symlink():
            self._check_inside(source)
        self._check_room(target)
        self._make_folder(target.parent, to)
        try:
            shutil.move(source, target)
        except PermissionError:
            raise Forbidden("The item cannot be moved on the server") from None
        return self.relative(target)

    # -- delete --------------------------------------------------------------

    def delete_file(self, path: str) -> None:
        """Move a file to the trash. Its folder stays, even if left empty."""
        source = self._item(path)
        if not os.path.lexists(source):
            raise NotFound(f"no such file: {path!r}")
        if source.is_dir():
            raise BadRequest(f"is a folder: {path!r}")
        self._check_writable(source)
        self._to_trash(source, self._new_trash())

    def delete_folder(self, path: str) -> dict:
        """Move a folder to the trash with everything in it: documents, other
        files and hidden entries; links go as links. `deleted` is the number of
        files in it, at any depth. A folder with no files at all is removed."""
        folder = self._item(path)
        if not os.path.lexists(folder):
            raise NotFound(f"no such folder: {path!r}")
        if folder.is_symlink() or not folder.is_dir():
            raise BadRequest(f"not a folder: {path!r}")
        self._check_writable(folder)
        if not self._writable(folder.parent):
            raise Forbidden("Its folder cannot be written on the server")
        self._check_inside(folder)
        count = self._count_files(folder)
        if count:
            self._to_trash(folder, self._new_trash())
        else:
            shutil.rmtree(folder)
        return {"deleted": count}

    @staticmethod
    def _count_files(folder: Path) -> int:
        """The files under `folder`, at any depth, hidden ones and links
        included; a link to a folder counts as a file and is not followed."""
        count = 0
        for here, dirs, files in os.walk(folder):
            links = [d for d in dirs if (Path(here) / d).is_symlink()]
            count += len(files) + len(links)
        return count

    def _new_trash(self) -> Path:
        """A new folder in the trash for one deletion, named after its time."""
        while True:
            name = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S-%f")
            trash = self.root / TRASH / name
            try:
                trash.mkdir(parents=True)
                return trash
            except FileExistsError:
                continue

    def _to_trash(self, source: Path, trash: Path) -> None:
        """Move an item into the trash folder, under its path from the root."""
        target = trash / source.relative_to(self.root)
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.move(source, target)
        except PermissionError:
            raise Forbidden("The item cannot be deleted on the server") from None

    # -- tree ----------------------------------------------------------------

    def create_folder(self, path: str) -> None:
        """Create a folder, and its missing parents."""
        target = self._item(path)
        if os.path.lexists(target):
            raise Conflict(f"already exists: {path!r}")
        if target.suffix == DOCUMENT_SUFFIX:
            raise BadRequest(f"a folder's name cannot end in {DOCUMENT_SUFFIX}: {path!r}")
        self._check_room(target)
        self._make_folder(target, path)

    def _make_folder(self, folder: Path, path: str) -> None:
        try:
            folder.mkdir(parents=True, exist_ok=True)
        except (FileExistsError, NotADirectoryError):
            raise Conflict(f"a file is in the way: {path!r}") from None
        except PermissionError:
            raise Forbidden("The folder cannot be written on the server") from None


    @staticmethod
    def _hidden(name: str) -> bool:
        """Entries the protocol never shows: hidden ones, and `~`, which in a
        path stands for the project home."""
        return name.startswith(".") or name == HOME

    def tree(self, path: str, depth: int | None = None) -> dict:
        target = self.resolve(path)
        if target.is_file():
            raise BadRequest(f"not a folder: {path!r}")
        if not target.is_dir():
            raise NotFound(f"no such folder: {path!r}")
        return self._folder(target, depth)

    def _folder(self, folder: Path, depth: int | None) -> dict:
        node = {"name": folder.name if folder != self.root else "",
                "path": self.relative(folder), "type": "folder"}
        if reason := self.read_only(folder):
            node["readOnly"] = reason
        if depth is not None and depth <= 0:
            return node
        folders, files = [], []
        for entry in sorted(folder.iterdir(), key=lambda e: e.name):
            if self._hidden(entry.name) or (folder == self.root and entry.name.startswith("_")):
                continue
            if not entry.resolve().is_relative_to(self.root):
                continue
            if entry.is_dir():
                folders.append(self._folder(entry, None if depth is None else depth - 1))
            elif entry.is_file():
                stat = entry.stat()
                modified = datetime.fromtimestamp(stat.st_mtime, timezone.utc)
                item = {"name": entry.name, "path": self.relative(entry), "type": "file",
                        "size": stat.st_size,
                        "modified": modified.strftime("%Y-%m-%dT%H:%M:%SZ")}
                if reason := self.read_only(entry):
                    item["readOnly"] = reason
                files.append(item)
        node["children"] = folders + files
        return node
