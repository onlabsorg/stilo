# The server

*`src/stilo/server/`, the module `stilo.server`: serves one folder of
documents over HTTP, as the [protocol](protocol.md) describes, and the
built web app. FastAPI and uvicorn.*

| Module                          | Role                                           |
|---------------------------------|------------------------------------------------|
| `stilo/server/storage.py`       | `Storage`, the interface of a storage; `FolderStorage`, the default, the folder on disk (path validation, read, create, update, move, delete, tree, ETags); `StorageWrapper`. No HTTP. |
| `stilo/server/app.py`           | `create_app()`: the HTTP routes, mapped onto a `Storage`, and the extensions' |
| `stilo/server/extensions.py`    | `ServerExtension`, `get_storage`: server extensions (S17, phase 5) |
| `stilo/server/files.py`         | Files by their public URL: `is_document`, `etag`, `media_type`, `other_file_response` (types and safety headers), `download_response`, `INDEX`, `NO_CACHE` |
| `stilo/server/home.py`          | The package home rule, `~` in paths; shared with the CLI |
| `stilo/server/archive.py`       | Packed packages (`.texlz`): `Archive` (read and checked in memory), `Archives` (the cache, paths through archives), `pack_package`; shared with the CLI |
| `stilo/server/__init__.py`      | The [public API](#the-public-api), `__all__` |

The server imports nothing from the rest of the package (the CLI starts it
with `stilo serve`); `tests/test_layout.py` checks it.

The two layers are separate on purpose: a storage knows nothing about
HTTP, and `app.py` contains no file-system logic. `create_app()` takes any
object with the methods of `Storage`, so the documents can live elsewhere
than in a folder, and a wrapper can add behaviour to the folder (S17). A
server in another language replaces both, and passes the same tests.

## `Storage`, the interface

```python
class Storage(Protocol):
    def read(self, path: str) -> tuple[bytes, str]
    def create(self, path: str, content: bytes) -> str
    def update(self, path: str, content: bytes, if_match: str | None = None) -> str
    def delete_file(self, path: str) -> None
    def delete_folder(self, path: str) -> dict
    def move(self, path: str, to: str) -> str
    def create_folder(self, path: str) -> None
    def tree(self, path: str, depth: int | None = None) -> dict
    def expand_home(self, path: str) -> str
    def read_target(self, path: str) -> str
```

What `create_app()` needs from a storage, and nothing more: a
`typing.Protocol`, so an object needs the methods, not a base class. Each
method does what the method of the same name of `FolderStorage` does
(below), with the same arguments and results; a storage refuses a request
by raising one of the [errors](#errors), whose status the HTTP layer
answers. `tree` returns the protocol's QUERY body; `expand_home` returns
its argument unchanged if the storage has no package homes; `read_target`
returns where a read leads (`~` expanded, a folder to its `index.texl`),
its argument without slashes at its ends if nowhere else. Whether a
public address is a document or another file, `create_app()` decides from
the suffix (`is_document`) and a `read`, so a storage needs no method for
it. `tests/server/test_storage_interface.py` runs the app on a storage
held in memory.

## `StorageWrapper`

```python
class StorageWrapper:
    def __init__(self, inner: Storage)
```

A storage that passes every call to `inner`. A wrapper subclasses it,
overrides what it changes and calls `super()` for the rest; any other
attribute (`root`, `read_only` of a `FolderStorage`) is read from `inner`.
For example, a wrapper that acts after every save:

```python
class Committing(StorageWrapper):
    def update(self, path, content, if_match=None):
        tag = super().update(path, content, if_match)
        commit(path)          # only after the write succeeded
        return tag

app = create_app(Committing(FolderStorage("docs")), web_dist)
```

A write that is refused raises before the code after `super()` runs.

## `FolderStorage`

```python
class FolderStorage:
    def __init__(self, root: Path | str)
```

The default storage: gives access to the documents under `root`, a folder.
Raises `ValueError` if `root` is not a folder.

Paths are strings relative to the root, with `/` separators: `""` is the
root, `"packages/beam/check.texl"` a file. Every public method validates
its path first.

It reads packed packages (`.texlz` files) as read-only folders: a path that
goes through one names an entry inside it; see
[Packed packages](#packed-packages-archivepy) below. `self.archives` is
the cache of the archives it opened.

### `resolve`

```python
def resolve(self, path: str) -> Path
```

Returns the absolute file-system path of `path`, or raises `BadRequest` if
the path is malformed or not allowed:

- a segment that is empty, `.` or `..`, or starts with `.` (hidden);
- a first segment that starts with `_` (reserved for `/_api` and `/_app`);
- a path that leads out of the root, also through a symbolic link;
- a segment `~`, which stands for the package home and is never a name.

### `expand_home`

```python
def expand_home(self, path: str) -> str
```

Returns `path` with each `~` segment, from the left, replaced by the
package home of the folder before it: the nearest folder holding a
`package.texl`, or the root (protocol: [URL space](protocol.md#url-space));
inside a packed package, its root or a package nested in it.
Raises `BadRequest` for malformed segments and for more than 16 `~`
segments. The app calls it to redirect a read with `~` to the real path
(through `read_target`, below); `read` calls it too, for other callers. A write never expands `~`. The rule itself is in `home.py` (`expand_home`, `home_of`), shared
with the CLI, which imports it from there.

### `read_target`

```python
def read_target(self, path: str) -> str
```

The path a read of `path` leads to (S25): `expand_home`, then, if that is
a folder or a packed package, on disk or in an archive, its `index.texl`
(`INDEX`), whether it exists or not (`Archives.is_folder`); otherwise the
expanded path, without slashes at its ends. The app redirects a read to
it when it differs from the path asked for (`read_redirect` in `app.py`).
Raises `BadRequest` as `resolve` and `expand_home` do.

### `read`

```python
def read(self, path: str) -> tuple[bytes, str]
```

Returns the content of a file and its ETag, after `expand_home`. Any
regular file can be read, not only `.texl` files, also an entry of a
packed package (`refs/lib.texlz/docs/x.texl`); the path of the archive
itself reads the file. Raises `NotFound` if there is no such file,
`BadRequest` if the path is a folder or goes through a `.texlz` file that
is not a valid packed package.

### `create`

```python
def create(self, path: str, content: bytes) -> str
```

Creates a new file of any kind, a document or another file (an upload), with
its missing parent folders, and returns its ETag. Raises `Conflict` if the
path exists (create never overwrites) or a file is in the way of a parent,
and `BadRequest` for a path the protocol refuses or the root.

### `update`

```python
def update(self, path: str, content: bytes, if_match: str | None = None) -> str
```

Replaces the content of an existing file, a document or another file, and
returns the new ETag (protocol capability `rewrite`, S27).
With `if_match`, raises `PreconditionFailed` if the current ETag differs:
the file changed since the client read it. Raises `NotFound` if there is no
such file (update never creates).

The new content is written to a hidden sibling file and renamed over the
target, so a reader never sees a half-written file.

### `tree`

```python
def tree(self, path: str, depth: int | None = None) -> dict
```

Returns the folder at `path` as a nested dictionary, the JSON body of the
protocol's QUERY: folders with `children`, files with `size` and
`modified`. Children are folders first, then files, each sorted by name;
every file is listed, without hidden entries, folders named `~`, or
reserved names at the root. `depth` limits the recursion. A node the
server cannot change carries `readOnly`, the reason (`read_only`, below).
A packed package is a folder node with `"archive": true` and the `size`
and `modified` of its file, listed among the folders; its items carry
`readOnly` ("It is in a packed package, which cannot be changed") and the
time of the archive file. A `.texlz` file that is not a valid packed
package is listed as a file. `path` may be an archive, or a folder or an
archive inside one. Raises `NotFound` and `BadRequest` as `read` does.

### `read_only`

```python
def read_only(self, target: Path) -> str | None
```

Why the item at `target` cannot be changed, or `None` (protocol v1,
read-only items): a folder the server cannot write ("The folder cannot be
written on the server"), a file it cannot write ("The file cannot be
written on the server"), or a file in such a folder ("Its folder cannot be
written on the server"; a document is saved by writing a sibling and
renaming it, which needs the folder). It asks the operating system
(`os.access`), so it follows the file system's permissions; a server run
as root can write everything.

The writing methods refuse a read-only item with `Forbidden`: `update`
and `delete_file` the item, `move` the item and the folder it goes to,
`create` and `create_folder` the nearest existing folder above the new
item, `move` and `delete_folder` a folder holding a read-only item ("It
holds items that cannot be written on the server"). A permission error of
the file system they meet anyway becomes `Forbidden` too, never a server
error.

### `create_folder`

```python
def create_folder(self, path: str) -> None
```

Creates a folder and its missing parents. Raises `Conflict` if the path exists
or a file is in the way, and `BadRequest` for a name ending in `.texl` or
`.texlz`, or the root.

### `move`

```python
def move(self, path: str, to: str) -> str
```

Moves or renames a file or a folder and returns its new path, creating
missing parents of `to`. A folder takes everything in it. A file keeps its
kind: a document's new name ends in `.texl`, a packed package's in
`.texlz`, another file's in neither. Raises `Conflict` if
`to` exists (move never overwrites), `NotFound` if the item does not, and
`BadRequest` for anything else the protocol refuses. A symbolic link moves as
the link, not what it points to.

### `delete_file`, `delete_folder`

```python
def delete_file(self, path: str) -> None
def delete_folder(self, path: str) -> dict
```

Nothing is erased. Each deletion gets its own folder in the trash,
`.trash/<UTC time>/`, and items keep their path from the root inside it, so a
user can find them and deleting twice loses nothing.

`delete_file` moves one file, a document or any other; its folder stays, even
if left empty. `delete_folder` moves the whole folder, with documents, other
files, hidden entries and links (as links, not followed), and returns
`{"deleted": <number of files in it>}`. A folder with no files at all, at any
depth, is removed and makes no trash folder (S15). Given a packed package,
which the tree shows as a folder, `delete_folder` moves its file to the
trash and returns the number of files in it.

`etag` and `is_document` are in `files.py` (below).

### Packed packages (`archive.py`)

A packed package (S23) is a zip file named `*.texlz` (`ARCHIVE_SUFFIX`)
with a `package.texl` at its root. `FolderStorage` reads it as a folder
that cannot be changed:

- **Reads go inside.** A path is walked from the root; the first segment
  that ends in `.texlz`, is a regular file and has more segments after it
  is an archive, and the rest of the path is an entry in it. A segment of
  that rest naming a `.texlz` entry, with more after it, goes into that
  archive in turn (nested archives). The path of an archive itself is the
  file: `read` gives its bytes, `tree` its contents, and `read_target`
  its `index.texl`. On the HTTP side a read of it is redirected to its
  index, as for a folder; `?download` gives the file (S25); `/_api/tree/`
  lists it.
- **Writes inside are refused** with `Forbidden` ("refs/lib.texlz is a
  packed package: what is in it cannot be changed"), before any other
  check: `create`, `update`, `delete_file`, `delete_folder`,
  `create_folder`, and `move` from or into one. The archive file itself is
  an ordinary file: it is uploaded with `create`, moved, renamed and
  deleted.
- **`~`** (`expand_home`) uses `Archives.is_package`, which looks for
  `package.texl` inside archives too (`home.py` takes it as `is_package`).
  As every archive holds one at its root, `~` inside one stands for its
  root, or for a package nested in it; the search still never leaves the
  storage root.

`Archive` reads one archive in memory, from its bytes, and never extracts
it. On opening it checks every entry and raises `ArchiveError` for an
absolute path (also `C:` or a backslash), an empty, `.` or `..` segment, a
symbolic link, a duplicate name, a name that is both a file and a folder,
encryption, a compression other than stored or deflate, a missing
`package.texl`, more than `MAX_ENTRIES` (10 000) entries, more than
`MAX_UNPACKED` (256 MiB) unpacked, by the sizes the entries declare, and a
file over `MAX_ARCHIVE_BYTES` (256 MiB). Reading an entry stops at its
declared size, so an entry that lies about it fails its CRC check rather
than unpacking more. Nested archives are opened when first reached, up to
`MAX_NESTING` (8) deep. Hidden entries and entries named `~` are left out,
as elsewhere.

`Archives.is_folder` tells a folder or a packed package from a file, on
disk or in an archive: what `read_target` and the CLI's loader lead to the
`index.texl` of.

`Archives` is the cache: an archive file is read and checked once, and
again only when its path, modification time or size changes; the 16 most
recently used are kept, failures included. Given a root, it refuses an
archive whose real path (through links) leaves it. The CLI's file loader
uses the same class (docs/cli.md), so the browser and `stilo render` read
archives the same way.

`pack_package(folder, exclude=(), *, gitignore=True)` returns the bytes of a packed package
of the package in `folder`, deterministically: `package_files` lists every
regular file under it except hidden entries (`.git/`, `.trash/`, …), `~`,
symbolic links (nothing outside the folder goes in) and files git ignores
(`git check-ignore`, when git is installed; S26). If the folder belongs to
a working tree (one that does not ignore the folder or a folder above it),
that repository's rules count; otherwise, outside a repository or in one
that ignores the folder, only the `.gitignore` files inside the folder
count, as if it were the top of its own repository. The user's global
excludes are never used, so the result depends on the files alone.
`gitignore=False` (keyword) packs ignored files too: `library_archive()`
uses it, so the library is packed in full wherever Stilo is installed. The entries are sorted by path, dated
1980-01-01, with permissions `rw-r--r--`, no folder entries and no
comment, compressed with deflate at level 9, except `.texlz` entries,
stored. The same files give the same bytes with the same zlib; the
compressed bytes could differ with another zlib build. It raises
`ArchiveError` for a folder without `package.texl`, one whose
`package.texl` would be left out (ignored or excluded), or one that would
give an archive `Archive` refuses. `stilo pack` calls it, and Papiro will for
releases.

### Errors

```text
StorageError (500)
 ├─ BadRequest (400)
 ├─ Forbidden (403)
 ├─ NotFound (404)
 ├─ Conflict (409)
 └─ PreconditionFailed (412)
```

Each `StorageError` subclass carries the HTTP status in its `status`
attribute. The HTTP layer turns any of them into a response with that status
and the body `{"error": "<message>"}`.

## Files by their public URL (`files.py`)

```python
DOCUMENT_SUFFIX = ".texl"
INDEX = "index.texl"
NO_CACHE = {"Cache-Control": "no-cache"}
FILE_TYPES: mimetypes.MimeTypes
def is_document(path: str) -> bool
def etag(content: bytes) -> str
def media_type(path: str) -> str
def other_file_response(path: str, content: bytes, tag: str) -> Response
def download_response(path: str, content: bytes, tag: str) -> Response
```

The rules of the protocol for files, kept apart from the routes so that a
server extension, or another Python server that speaks the protocol,
answers the same:

- `is_document` says whether a path names a Texl document, by its suffix.
- `etag` returns the strong ETag of a content: its SHA-256, in quotes as
  HTTP requires.
- `media_type` is the type a file that is not a document is served with,
  from Python's own table (`FILE_TYPES`, not the machine's, so every
  installation answers the same; WebP added), and
  `application/octet-stream` when unknown or compressed.
- `other_file_response` answers such a file by its public URL: its type,
  `ETag`, `X-Content-Type-Options: nosniff`, `NO_CACHE`, `Vary: Accept`,
  and `Content-Security-Policy: sandbox` for HTML and XML, so it cannot
  run scripts on the server's origin (protocol: [URL space](protocol.md#url-space)).
- `download_response` answers `?download`: the file with its type (a
  document as text), `ETag`, `nosniff`, `NO_CACHE` and
  `Content-Disposition: attachment` with its name (plain ASCII, and
  encoded as `filename*`).
- `INDEX` is the document a read of a folder leads to (S25).
- `NO_CACHE` is the header every document and file is served with.

## `create_app`

```python
def create_app(storage: Storage | Path | str, web_dist: Path | str | None = None, *,
               extensions: Sequence[ServerExtension] = (),
               middleware: Sequence[Middleware] = ()) -> FastAPI
```

Creates the server app for the documents in `storage`: any object with the
methods of [`Storage`](#storage-the-interface), or the path of a folder,
for a `FolderStorage`. `web_dist` is the
built web app (`src/stilo/web` in a checkout); without it, or if it is not built, pages show a
notice that says how to build it.

- `extensions`: [server extensions](#serverextension), in order. Each
  one's `wrap_storage` wraps the storage, the last one outermost; the
  result is the storage of every route, Stilo's and the extensions', kept
  as `app.state.storage`. Each one's router is mounted under
  `/_api/x/<id>/`, and `/_api/info` lists it. A bad or repeated id, or
  capabilities that are not a list of strings, raise at once
  (`ValueError`), before anything is served.
- `middleware`: Starlette `Middleware` entries, wrapping the whole app,
  Stilo's routes included: for example a login in front of everything,
  answering `401` with a `login` address (protocol: Login and refusals).

```python
import uvicorn
from stilo.server import create_app

uvicorn.run(create_app("examples", "src/stilo/web"), port=8010)
```

The routes, in the order they match:

| Route                              | Methods      | Does                                     |
|------------------------------------|--------------|------------------------------------------|
| `/_api/files/{path}`               | GET, HEAD    | `Storage.read`; `ETag` and `Cache-Control: no-cache`. A path with `~`, a folder or a packed package: `307` to `Storage.read_target` (`read_redirect`). `?download`: no index, the file as an attachment (`download_response`) |
| `/_api/files/{path}`               | POST         | `Storage.create`; `201`, `ETag`, `Location` |
| `/_api/files/{path}`               | PUT          | `Storage.update` with the `If-Match` header |
| `/_api/files/{path}`               | DELETE       | `Storage.delete_file`; `204`             |
| `/_api/move/{path}`                | POST         | `Storage.move`, with the JSON body `{"to": ...}` |
| `/_api/tree/{path}`                | POST         | `Storage.create_folder`; `201`, `Location` |
| `/_api/tree/{path}`                | DELETE       | `Storage.delete_folder`; `{deleted, removed}` |
| `/_api/tree/{path}`                | GET          | `Storage.tree`, with `?depth=` (1 or more) |
| `/_api/info`                       | GET          | `{protocol, server, capabilities, extensions}`: `PROTOCOL` (1), `VERSION`, `CAPABILITIES`, and an entry per extension (`id`, `capabilities`, `version` if given) |
| `/_api/x/{id}/...`                 | as the router says | The endpoints of the extension `id`, from its router |
| `/_api/x/{extension}/{path}`       | any          | `404`: "no extension …" for an extension the server does not have, "unknown endpoint of extension …" for a path its router lacks |
| `/_api/{path}`                     | any          | `404`: unknown endpoint                  |
| `/_app/...`                        | GET          | The web app's static files (`web_dist`)  |
| `/{path}`                          | GET, HEAD    | The public address. A path with `~`: `307` to the real path, for every client; a folder or a packed package: `307` to its `index.texl` for every client but a browser asking for HTML, which gets the web app (`read_redirect`). `?download`: the file as an attachment. A file that is not a document: itself, for every client, with its real type and the safety headers of the protocol (`other_file_response`). Otherwise the web app for a browser (`Accept` includes `text/html`), the file for anything else. `Vary: Accept` |

`create_app()` is the server's extension point: Stilo's own new endpoints
go under `/_api/`, added here, without changing the existing ones; those of
server extensions go under `/_api/x/<id>/`, given as `ServerExtension`s.

## `ServerExtension`

```python
@dataclass(frozen=True)
class ServerExtension:
    id: str
    router: APIRouter | None = None
    wrap_storage: Callable[[Storage], Storage] | None = None
    capabilities: Sequence[str] = ()
    version: str | None = None

def get_storage(request: Request) -> Storage
```

What a package adds to the server, as one value (`extensions.py`):

- `id`: lowercase letters, digits and dashes; the space of its endpoints,
  `/_api/x/<id>/`, and its entry in `/_api/info`. The same id as its web
  extension, if it has one, so the web part can ask
  `info.hasExtension(id)`.
- `router`: a FastAPI `APIRouter` with its endpoints, paths relative to
  its space (`@router.get("/versions/{path:path}")` answers
  `/_api/x/<id>/versions/...`). A `StorageError` raised in an endpoint
  gets the same JSON answer as in Stilo's own routes.
- `wrap_storage`: given the storage, returns the one to use instead,
  usually a [`StorageWrapper`](#storagewrapper).
- `capabilities`, `version`: listed in its entry of `/_api/info`.

An endpoint reaches the storage, as wrapped by all the extensions, with
the dependency `get_storage`:

```python
from fastapi import APIRouter, Depends
from stilo.server import ServerExtension, Storage, get_storage

router = APIRouter()

@router.get("/size/{path:path}")
async def size(path: str, storage: Storage = Depends(get_storage)):
    content, _ = storage.read(path)
    return {"size": len(content)}

app = create_app("docs", web_dist, extensions=[
    ServerExtension("sizes", router=router, capabilities=["size"], version="0.1.0"),
])
```

A later loader of installed packages (S17, phase 6) is meant to take
`ServerExtension`s from an entry point as they are.
`VERSION` in `app.py` is the server's version, bumped with
`pyproject.toml`.

## The public API

`stilo.server.__all__` lists what a server extension, a storage of
another kind or another server that speaks the protocol may use:

| Group | Names |
|-------|-------|
| The app | `create_app`, `PROTOCOL`, `VERSION`, `CAPABILITIES` |
| Server extensions | `ServerExtension`, `get_storage` |
| Storages | `Storage`, `FolderStorage`, `StorageWrapper` |
| Errors | `StorageError`, `BadRequest`, `Forbidden`, `NotFound`, `Conflict`, `PreconditionFailed` |
| Files | `DOCUMENT_SUFFIX`, `is_document`, `etag`, `FILE_TYPES`, `media_type`, `other_file_response`, `download_response`, `INDEX`, `NO_CACHE` |
| The package home | `MANIFEST`, `HOME`, `MAX_HOMES`, `HomeCycle`, `home_of`, `expand_home`, `has_home` |
| Packed packages | `ARCHIVE_SUFFIX`, `is_archive`, `ArchiveError`, `pack_package` |

Anything else in the modules may change without notice.
`tests/server/test_public_api.py` pins the list: a change to it is
deliberate, made with this table and the changelog, as the `exports` map
of the npm package is on the web side (S16).

## Tests

`tests/server/test_api.py` tests the app through FastAPI's `TestClient`,
on a temporary folder: every interaction of the protocol, the errors, path
validation, content negotiation on public addresses, `/_api/info`,
`/_api/x/`, and read-only items (with real file permissions; skipped when
run as root or on Windows, where they do not apply).
`tests/server/test_home.py` covers the package home: nearest manifest,
fallback to the root, several `~`, references with and without their own
manifest, cycles, and `~` refused as a name. A change to the protocol starts
with a test there.
`tests/server/test_storage_interface.py` covers the storage interface: the
app on a storage held in memory (the interface is enough), a
`StorageWrapper` that sees every write, `create_app()` given a path.
`tests/server/test_extensions.py` covers server extensions: routers under
`/_api/x/<id>/`, errors, unknown extensions and endpoints, entries in
`/_api/info`, storage wrappers and their order, refused ids, and
middleware in front of everything. `tests/server/test_public_api.py`
pins the public API and checks that the helpers answer as the server does.
`tests/server/test_archives.py` covers packed packages: reading entries
and the file itself, the tree (`archive`, `readOnly`, `depth`), every
write inside refused, the archive file moved, renamed, deleted and
uploaded, `~` and nested archives, a rendering through the server equal to
the CLI's, the cache, and the safety checks on bad archives.

```sh
uv run pytest tests/server
```
