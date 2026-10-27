"""File-system storage of Texl documents (protocol v0, see docs/src/protocol.md).

Paths are relative to the storage root, with "/" separators. Every public
method validates its path and raises a StorageError subclass that the HTTP
layer maps to a status code.
"""

from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path

DOCUMENT_SUFFIX = ".texl"


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

    # -- tree ----------------------------------------------------------------

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
