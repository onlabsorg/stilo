"""Storage of Texl documents (protocol v1, see docs/protocol.md).

`Storage` is the interface the HTTP layer (`create_app`) uses: any object
with its methods can hold the documents. `FolderStorage` is the default, a
folder on disk; `StorageWrapper` passes every call to another storage, so a
wrapper overrides only what it changes (e.g. reacting to every write).

Paths are relative to the storage root, with "/" separators. Every method
validates its path and raises a StorageError subclass that the HTTP layer
maps to a status code.

`FolderStorage` reads packed packages (`archive.py`, S23) as read-only
folders: a path through a `.texlz` file names an entry inside it, while the
path of the archive names the file, which moves and deletes as one.
"""

from __future__ import annotations

import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from .archive import ARCHIVE_SUFFIX, Archive, ArchiveError, Archives, is_archive
from .files import DOCUMENT_SUFFIX, INDEX, etag, is_document  # noqa: F401 (is_document: also from here)
from .home import HOME, HomeCycle, expand_home, has_home

TRASH = ".trash"

# Why the items in a packed package cannot be changed (tree: `readOnly`)
IN_ARCHIVE = "It is in a packed package, which cannot be changed"


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
        """A file's new content (a document or another file), if it still
        has the ETag `if_match`; returns the new ETag."""
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

    def read_target(self, path: str) -> str:
        """The path a read of `path` leads to: `~` expanded, then a folder
        or a packed package replaced by its `index.texl` (S25)."""
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

    def read_target(self, path: str) -> str:
        return self.inner.read_target(path)


class FolderStorage:
    """The default storage: the documents in a folder on disk, packed
    packages (`.texlz` files) read as read-only folders."""

    def __init__(self, root: Path | str):
        self.root = Path(root).resolve()
        if not self.root.is_dir():
            raise ValueError(f"storage root is not a folder: {self.root}")
        # The packed packages opened, kept until their file changes
        self.archives = Archives(self.root)

    # -- paths ---------------------------------------------------------------

    @staticmethod
    def _segments(path: str) -> list[str]:
        segments = path.strip("/").split("/") if path.strip("/") else []
        for segment in segments:
            if segment in ("", ".", "..") or segment.startswith("."):
                raise BadRequest(f"invalid path: {path!r}")
        return segments

    def expand_home(self, path: str) -> str:
        """`path` with its `~` segments replaced by the package home they
        stand for (home.py); the search never leaves the root. Only reads
        expand `~`: as a name it is refused."""
        if not has_home(path):
            return path
        try:
            target = expand_home(self.root, self._segments(path), lambda folder: self.root,
                                 self.archives.is_package)
        except HomeCycle as e:
            raise BadRequest(f"{e}: {path!r}") from None
        return target.relative_to(self.root).as_posix() if target != self.root else ""

    def read_target(self, path: str) -> str:
        """The path a read of `path` leads to (S25): `~` expanded, then, if
        that is a folder or a packed package (on disk or in an archive), its
        `index.texl`, whether it exists or not. Otherwise the expanded path."""
        real = self.expand_home(path).strip("/")
        if self.archives.is_folder(self.resolve(real)):
            return f"{real}/{INDEX}" if real else INDEX
        return real

    def resolve(self, path: str) -> Path:
        """The absolute file-system path of `path`, refusing paths that are
        malformed, hidden, reserved or outside the root."""
        segments = self._segments(path)
        if HOME in segments:
            raise BadRequest(f"{HOME} stands for the package home and cannot be a name: {path!r}")
        if segments and segments[0].startswith("_"):
            raise BadRequest(f"reserved path: {path!r}")
        target = self.root.joinpath(*segments).resolve()
        if not target.is_relative_to(self.root):
            raise BadRequest(f"path outside the root: {path!r}")
        return target

    def relative(self, target: Path) -> str:
        return target.relative_to(self.root).as_posix() if target != self.root else ""

    # -- packed packages -----------------------------------------------------

    def _archive_of(self, path: str) -> tuple[str, list[str]] | None:
        """The path of the archive file `path` goes through, and the segments
        after it; None if it goes through none. The path of an archive itself
        goes through none: it names the file."""
        segments = self._segments(path)
        for i in range(len(segments) - 1):
            if segments[i].endswith(ARCHIVE_SUFFIX):
                prefix = "/".join(segments[:i + 1])
                if self.resolve(prefix).is_file():
                    return prefix, segments[i + 1:]
        return None

    def _inside(self, path: str) -> tuple[Archive, str, str] | None:
        """For a path through an archive: the archive that holds it (nested
        ones followed), its path in there, and the path of the archive file
        on disk; None for a path through none."""
        found = self._archive_of(path)
        if found is None:
            return None
        prefix, rest = found
        try:
            archive, inner = self.archives.open(self.resolve(prefix)).locate(rest)
        except ArchiveError as e:
            raise BadRequest(f"not a valid packed package: {e}") from None
        return archive, inner, prefix

    def _check_not_inside(self, path: str) -> None:
        """Refuse a change inside a packed package."""
        if found := self._archive_of(path):
            raise Forbidden(f"{found[0]} is a packed package: what is in it cannot be changed")

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
        real = self.expand_home(path)
        if inside := self._inside(real):
            archive, inner, _ = inside
            kind = archive.kind(inner)
            if kind == "folder":
                raise BadRequest(f"not a file: {path!r}")
            if kind is None:
                raise NotFound(f"no such file: {path!r}")
            try:
                content = archive.read(inner)
            except ArchiveError as e:
                raise BadRequest(f"not a valid packed package: {e}") from None
            return content, etag(content)
        target = self.resolve(real)
        if target.is_dir():
            raise BadRequest(f"not a file: {path!r}")
        if not target.is_file():
            raise NotFound(f"no such file: {path!r}")
        content = target.read_bytes()
        return content, etag(content)

    def create(self, path: str, content: bytes) -> str:
        """Create a file, a document or any other, and its missing folders."""
        target = self._item(path)
        self._check_not_inside(path)
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
        self._check_not_inside(path)
        if target.is_dir():
            raise BadRequest(f"is a folder: {path!r}")
        if not target.is_file():
            raise NotFound(f"no such file: {path!r}")
        if if_match is not None and if_match != etag(target.read_bytes()):
            raise PreconditionFailed(f"changed since it was read: {path!r}")
        self._check_writable(target)
        # Write a sibling and rename it over the target, so readers never see
        # a half-written file.
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
        stays a document, a packed package stays a packed package and another
        file stays another file."""
        source = self._item(path)
        target = self._item(to)
        self._check_not_inside(path)
        self._check_not_inside(to)
        if not os.path.lexists(source):
            raise NotFound(f"no such item: {path!r}")
        if source.is_dir():
            if target.suffix in (DOCUMENT_SUFFIX, ARCHIVE_SUFFIX):
                raise BadRequest(f"a folder's name cannot end in {target.suffix}: {to!r}")
            if target.resolve().is_relative_to(source.resolve()) and target != source:
                raise BadRequest(f"a folder cannot go inside itself: {to!r}")
        else:
            for suffix in (DOCUMENT_SUFFIX, ARCHIVE_SUFFIX):
                if (source.suffix == suffix) != (target.suffix == suffix):
                    raise BadRequest(f"a file cannot gain or lose the {suffix} extension: {path!r} to {to!r}")
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
        self._check_not_inside(path)
        if not os.path.lexists(source):
            raise NotFound(f"no such file: {path!r}")
        if source.is_dir():
            raise BadRequest(f"is a folder: {path!r}")
        self._check_writable(source)
        self._to_trash(source, self._new_trash())

    def delete_folder(self, path: str) -> dict:
        """Move a folder to the trash with everything in it: documents, other
        files and hidden entries; links go as links. `deleted` is the number of
        files in it, at any depth. A folder with no files at all is removed.
        A packed package, which the tree shows as a folder, goes to the trash
        as the file it is; `deleted` is then the number of files in it."""
        folder = self._item(path)
        self._check_not_inside(path)
        if not os.path.lexists(folder):
            raise NotFound(f"no such folder: {path!r}")
        if is_archive(path) and folder.is_file():
            self._check_writable(folder)
            try:
                count = len(self.archives.open(folder).files)
            except ArchiveError:
                count = 1
            self._to_trash(folder, self._new_trash())
            return {"deleted": count}
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
        self._check_not_inside(path)
        if os.path.lexists(target):
            raise Conflict(f"already exists: {path!r}")
        if target.suffix in (DOCUMENT_SUFFIX, ARCHIVE_SUFFIX):
            raise BadRequest(f"a folder's name cannot end in {target.suffix}: {path!r}")
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
        path stands for the package home."""
        return name.startswith(".") or name == HOME

    def tree(self, path: str, depth: int | None = None) -> dict:
        if inside := self._inside(path):
            archive, inner, prefix = inside
            modified = self._modified(self.resolve(prefix))
            kind = archive.kind(inner)
            if kind == "file" and archive.is_nested_archive(inner):
                return self._archive_root(archive.nested(inner), path, depth,
                                          archive.size(inner), modified, IN_ARCHIVE)
            if kind == "file":
                raise BadRequest(f"not a folder: {path!r}")
            if kind is None:
                raise NotFound(f"no such folder: {path!r}")
            node = {"name": path.strip("/").rsplit("/", 1)[-1], "path": path.strip("/"),
                    "type": "folder", "readOnly": IN_ARCHIVE}
            return self._archive_folder(node, archive, inner, depth, modified)
        target = self.resolve(path)
        if target.is_file() and is_archive(target.name):
            try:
                archive = self.archives.open(target)
            except ArchiveError as e:
                raise BadRequest(f"not a valid packed package: {e}") from None
            return self._archive_root(archive, self.relative(target), depth, target.stat().st_size,
                                      self._modified(target), self.read_only(target))
        if target.is_file():
            raise BadRequest(f"not a folder: {path!r}")
        if not target.is_dir():
            raise NotFound(f"no such folder: {path!r}")
        return self._folder(target, depth)

    @staticmethod
    def _modified(target: Path) -> str:
        modified = datetime.fromtimestamp(target.stat().st_mtime, timezone.utc)
        return modified.strftime("%Y-%m-%dT%H:%M:%SZ")

    def _folder(self, folder: Path, depth: int | None) -> dict:
        node = {"name": folder.name if folder != self.root else "",
                "path": self.relative(folder), "type": "folder"}
        if reason := self.read_only(folder):
            node["readOnly"] = reason
        if depth is not None and depth <= 0:
            return node
        below = None if depth is None else depth - 1
        folders, files = [], []
        for entry in sorted(folder.iterdir(), key=lambda e: e.name):
            if self._hidden(entry.name) or (folder == self.root and entry.name.startswith("_")):
                continue
            if not entry.resolve().is_relative_to(self.root):
                continue
            if entry.is_dir():
                folders.append(self._folder(entry, below))
            elif entry.is_file():
                if is_archive(entry.name):
                    try:
                        archive = self.archives.open(entry)
                    except ArchiveError:
                        pass  # not a packed package: listed as the file it is
                    else:
                        folders.append(self._archive_root(
                            archive, self.relative(entry), below, entry.stat().st_size,
                            self._modified(entry), self.read_only(entry)))
                        continue
                item = {"name": entry.name, "path": self.relative(entry), "type": "file",
                        "size": entry.stat().st_size, "modified": self._modified(entry)}
                if reason := self.read_only(entry):
                    item["readOnly"] = reason
                files.append(item)
        node["children"] = folders + files
        return node

    def _archive_root(self, archive: Archive, path: str, depth: int | None, size: int,
                      modified: str, read_only: str | None) -> dict:
        """The node of a packed package: a folder marked `archive`, with the
        size and time of its file. Its items are read-only; the archive
        itself only if its file is (or if it is in another archive)."""
        node = {"name": path.rsplit("/", 1)[-1], "path": path, "type": "folder",
                "archive": True, "size": size, "modified": modified}
        if read_only:
            node["readOnly"] = read_only
        return self._archive_folder(node, archive, "", depth, modified)

    def _archive_folder(self, node: dict, archive: Archive, inner: str, depth: int | None,
                        modified: str) -> dict:
        """`node`, a folder in an archive (`inner`, "" its root), with its
        children down to `depth`. Its files take the time of the archive
        file, `modified`: their own in the zip mean nothing (S23)."""
        if depth is not None and depth <= 0:
            return node
        below = None if depth is None else depth - 1
        names, files = archive.children(inner)
        join = lambda name: f"{inner}/{name}" if inner else name  # noqa: E731
        children = []
        for name in names:
            child = {"name": name, "path": f"{node['path']}/{name}", "type": "folder",
                     "readOnly": IN_ARCHIVE}
            children.append(self._archive_folder(child, archive, join(name), below, modified))
        nested, plain = [], []
        for name in files:
            entry = join(name)
            path = f"{node['path']}/{name}"
            if archive.is_nested_archive(entry):
                nested.append(self._archive_root(archive.nested(entry), path, below,
                                                 archive.size(entry), modified, IN_ARCHIVE))
            else:
                plain.append({"name": name, "path": path, "type": "file",
                              "size": archive.size(entry), "modified": modified,
                              "readOnly": IN_ARCHIVE})
        node["children"] = sorted(children + nested, key=lambda child: child["name"]) + plain
        return node
