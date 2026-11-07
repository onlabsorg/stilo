"""File-system storage of Texl documents (protocol v0, see docs/protocol.md).

Paths are relative to the storage root, with "/" separators. Every public
method validates its path and raises a StorageError subclass that the HTTP
layer maps to a status code.
"""

from __future__ import annotations

import hashlib
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

DOCUMENT_SUFFIX = ".texl"
TRASH = ".trash"


class StorageError(Exception):
    status = 500


class BadRequest(StorageError):
    status = 400


class NotFound(StorageError):
    status = 404


class Conflict(StorageError):
    status = 409


class PreconditionFailed(StorageError):
    status = 412


def etag(content: bytes) -> str:
    """Strong ETag of a file's content, quoted as HTTP requires."""
    return '"' + hashlib.sha256(content).hexdigest() + '"'


class Storage:
    def __init__(self, root: Path | str):
        self.root = Path(root).resolve()
        if not self.root.is_dir():
            raise ValueError(f"storage root is not a folder: {self.root}")

    # -- paths ---------------------------------------------------------------

    def resolve(self, path: str) -> Path:
        """The absolute file-system path of `path`, refusing paths that are
        malformed, hidden, reserved or outside the root."""
        segments = path.strip("/").split("/") if path.strip("/") else []
        for segment in segments:
            if segment in ("", ".", "..") or segment.startswith("."):
                raise BadRequest(f"invalid path: {path!r}")
        if segments and segments[0].startswith("_"):
            raise BadRequest(f"reserved path: {path!r}")
        target = self.root.joinpath(*segments).resolve()
        if not target.is_relative_to(self.root):
            raise BadRequest(f"path outside the root: {path!r}")
        return target

    def relative(self, target: Path) -> str:
        return target.relative_to(self.root).as_posix() if target != self.root else ""

    # -- files ---------------------------------------------------------------

    def read(self, path: str) -> tuple[bytes, str]:
        target = self.resolve(path)
        if target.is_dir():
            raise BadRequest(f"not a file: {path!r}")
        if not target.is_file():
            raise NotFound(f"no such file: {path!r}")
        content = target.read_bytes()
        return content, etag(content)

    def is_other_file(self, path: str) -> bool:
        """Whether `path` is an existing file that is not a Texl document. A
        path the protocol refuses is not one."""
        try:
            target = self.resolve(path)
        except BadRequest:
            return False
        return target.is_file() and target.suffix != DOCUMENT_SUFFIX

    def create(self, path: str, content: bytes) -> str:
        target = self._writable(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(target, "xb") as file:
                file.write(content)
        except FileExistsError:
            raise Conflict(f"already exists: {path!r}") from None
        return etag(content)

    def update(self, path: str, content: bytes, if_match: str | None = None) -> str:
        target = self._writable(path)
        if not target.is_file():
            raise NotFound(f"no such file: {path!r}")
        if if_match is not None and if_match != etag(target.read_bytes()):
            raise PreconditionFailed(f"changed since it was read: {path!r}")
        # Write a sibling and rename it over the target, so readers never see
        # a half-written document.
        temp = target.with_name(f".{target.name}.tmp")
        temp.write_bytes(content)
        os.replace(temp, target)
        return etag(content)

    def _writable(self, path: str) -> Path:
        target = self.resolve(path)
        if target.suffix != DOCUMENT_SUFFIX:
            raise BadRequest(f"only {DOCUMENT_SUFFIX} files can be written: {path!r}")
        if target.is_dir():
            raise BadRequest(f"is a folder: {path!r}")
        return target

    def _item(self, path: str) -> Path:
        """The file-system path of an item to move or delete, validated as
        `resolve` does. A symbolic link stays itself: the item is the link, not
        what it points to."""
        self.resolve(path)
        relative = path.strip("/")
        if not relative:
            raise BadRequest("the root folder cannot be moved or deleted")
        return self.root.joinpath(*relative.split("/"))

    # -- move ----------------------------------------------------------------

    def move(self, path: str, to: str) -> str:
        """Move or rename a document or a folder; returns its new path."""
        source = self._item(path)
        target = self._item(to)
        if not os.path.lexists(source):
            raise NotFound(f"no such item: {path!r}")
        if source.is_dir():
            if target.suffix == DOCUMENT_SUFFIX:
                raise BadRequest(f"a folder's name cannot end in {DOCUMENT_SUFFIX}: {to!r}")
            if target.resolve().is_relative_to(source.resolve()) and target != source:
                raise BadRequest(f"a folder cannot go inside itself: {to!r}")
        elif source.suffix != DOCUMENT_SUFFIX or target.suffix != DOCUMENT_SUFFIX:
            raise BadRequest(f"only {DOCUMENT_SUFFIX} files can be moved, to a {DOCUMENT_SUFFIX} name: {path!r} to {to!r}")
        if target == source:
            return self.relative(target)
        # On a file system that ignores case, a new case of the name is the same item
        if os.path.lexists(target) and not os.path.samefile(source, target):
            raise Conflict(f"already exists: {to!r}")
        self._make_folder(target.parent, to)
        shutil.move(source, target)
        return self.relative(target)

    # -- delete --------------------------------------------------------------

    def delete_file(self, path: str) -> None:
        """Move a document to the trash. Its folder stays, even if left empty."""
        source = self._item(path)
        if not os.path.lexists(source):
            raise NotFound(f"no such file: {path!r}")
        if source.is_dir():
            raise BadRequest(f"is a folder: {path!r}")
        if source.suffix != DOCUMENT_SUFFIX:
            raise BadRequest(f"only {DOCUMENT_SUFFIX} files can be deleted: {path!r}")
        self._to_trash(source, self._new_trash())

    def delete_folder(self, path: str) -> dict:
        """Move every document in a folder to the trash, at any depth, and remove
        the folders this leaves with nothing in them. Other files, hidden entries
        and links to folders stay, and so do the folders that hold them."""
        folder = self._item(path)
        if not os.path.lexists(folder):
            raise NotFound(f"no such folder: {path!r}")
        if folder.is_symlink() or not folder.is_dir():
            raise BadRequest(f"not a folder: {path!r}")
        documents: list[Path] = []
        folders: list[Path] = []
        self._collect(folder, documents, folders)
        trash = self._new_trash() if documents else None
        for document in documents:
            self._to_trash(document, trash)
        for each in folders:  # the deepest first
            try:
                each.rmdir()
            except OSError:
                pass  # still holds something
        return {"deleted": len(documents), "removed": not folder.exists()}

    def _collect(self, folder: Path, documents: list[Path], folders: list[Path]) -> None:
        """Add the documents under `folder`, and its folders with the deepest
        first. What the tree does not list as a document or a folder is left."""
        for entry in folder.iterdir():
            if entry.name.startswith("."):
                continue
            if entry.is_dir():
                if not entry.is_symlink():
                    self._collect(entry, documents, folders)
            elif entry.is_file() and entry.suffix == DOCUMENT_SUFFIX:
                documents.append(entry)
        folders.append(folder)

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
        shutil.move(source, target)

    # -- tree ----------------------------------------------------------------

    def create_folder(self, path: str) -> None:
        """Create a folder, and its missing parents."""
        target = self._item(path)
        if os.path.lexists(target):
            raise Conflict(f"already exists: {path!r}")
        if target.suffix == DOCUMENT_SUFFIX:
            raise BadRequest(f"a folder's name cannot end in {DOCUMENT_SUFFIX}: {path!r}")
        self._make_folder(target, path)

    def _make_folder(self, folder: Path, path: str) -> None:
        try:
            folder.mkdir(parents=True, exist_ok=True)
        except (FileExistsError, NotADirectoryError):
            raise Conflict(f"a file is in the way: {path!r}") from None


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
        if depth is not None and depth <= 0:
            return node
        folders, files = [], []
        for entry in sorted(folder.iterdir(), key=lambda e: e.name):
            if entry.name.startswith(".") or (folder == self.root and entry.name.startswith("_")):
                continue
            if not entry.resolve().is_relative_to(self.root):
                continue
            if entry.is_dir():
                folders.append(self._folder(entry, None if depth is None else depth - 1))
            elif entry.is_file() and entry.suffix == DOCUMENT_SUFFIX:
                stat = entry.stat()
                modified = datetime.fromtimestamp(stat.st_mtime, timezone.utc)
                files.append({"name": entry.name, "path": self.relative(entry), "type": "file",
                              "size": stat.st_size,
                              "modified": modified.strftime("%Y-%m-%dT%H:%M:%SZ")})
        node["children"] = folders + files
        return node
