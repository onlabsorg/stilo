# The server

*`src/stilo/server/`, the module `stilo.server`: serves one folder of
documents over HTTP, as the [protocol](protocol.md) describes, and the
built web app. FastAPI and uvicorn.*

| Module                          | Role                                           |
|---------------------------------|------------------------------------------------|
| `stilo/server/storage.py`       | `Storage`, the interface of a storage; `FolderStorage`, the default, the folder on disk (path validation, read, create, update, move, delete, tree, ETags); `StorageWrapper`. No HTTP. |
| `stilo/server/app.py`           | `create_app()`: the HTTP routes, mapped onto a `Storage`, and the extensions' |
| `stilo/server/extensions.py`    | `ServerExtension`, `get_storage`: server extensions (S17, phase 5) |
| `stilo/server/__init__.py`      | Exports `create_app`, `ServerExtension`, `get_storage`, `Storage`, `FolderStorage`, `StorageWrapper` |

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
```

What `create_app()` needs from a storage, and nothing more: a
`typing.Protocol`, so an object needs the methods, not a base class. Each
method does what the method of the same name of `FolderStorage` does
(below), with the same arguments and results; a storage refuses a request
by raising one of the [errors](#errors), whose status the HTTP layer
answers. `tree` returns the protocol's QUERY body; `expand_home` returns
its argument unchanged if the storage has no project homes. Whether a
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
root, `"projects/beam/check.texl"` a file. Every public method validates
its path first.

### `resolve`

```python
def resolve(self, path: str) -> Path
```

Returns the absolute file-system path of `path`, or raises `BadRequest` if
the path is malformed or not allowed:

- a segment that is empty, `.` or `..`, or starts with `.` (hidden);
- a first segment that starts with `_` (reserved for `/_api` and `/_app`);
- a path that leads out of the root, also through a symbolic link;
- a segment `~`, which stands for the project home and is never a name.

### `expand_home`

```python
def expand_home(self, path: str) -> str
```

Returns `path` with each `~` segment, from the left, replaced by the
project home of the folder before it: the nearest folder holding a
`project.texl`, or the root (protocol: [URL space](protocol.md#url-space)).
Raises `BadRequest` for malformed segments and for more than 16 `~`
segments. The app calls it to redirect a read with `~` to the real path
(`home_redirect` in `app.py`); `read` calls it too, for other callers. A write never expands `~`. The rule itself is in `home.py` (`expand_home`, `home_of`), shared
with the CLI, which imports it from there.

### `read`

```python
def read(self, path: str) -> tuple[bytes, str]
```

Returns the content of a file and its ETag, after `expand_home`. Any
regular file can be read, not only `.texl` files. Raises `NotFound` if there is no such file, and
`BadRequest` if the path is a folder.

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

Replaces the content of an existing `.texl` file and returns the new ETag.
With `if_match`, raises `PreconditionFailed` if the current ETag differs:
the file changed since the client read it. Raises `NotFound` if there is no
such file (update never creates).

The new content is written to a hidden sibling file and renamed over the
target, so a reader never sees a half-written document.

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
Raises `NotFound` and `BadRequest` as `read` does.

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
or a file is in the way, and `BadRequest` for a name ending in `.texl` or the
root.

### `move`

```python
def move(self, path: str, to: str) -> str
```

Moves or renames a file or a folder and returns its new path, creating
missing parents of `to`. A folder takes everything in it. A file keeps its
kind: a document's new name ends in `.texl`, another file's does not. Raises `Conflict` if
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
depth, is removed and makes no trash folder (S15).

### `etag`, `is_document`

```python
def etag(content: bytes) -> str
def is_document(path: str) -> bool
```

`etag` returns the strong ETag of a content: its SHA-256, in quotes as HTTP
requires. `is_document` says whether a path names a Texl document, by its
suffix (`.texl`).

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

uvicorn.run(create_app("examples", "src/stilo/web"), port=8000)
```

The routes, in the order they match:

| Route                              | Methods      | Does                                     |
|------------------------------------|--------------|------------------------------------------|
| `/_api/files/{path}`               | GET, HEAD    | `Storage.read`; `ETag` and `Cache-Control: no-cache`. A path with `~`: `307` to the real path (`home_redirect`) |
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
| `/{path}`                          | GET, HEAD    | The public address. A path with `~`: `307` to the real path, for every client (`home_redirect`). A file that is not a document: itself, for every client, with its real type and the safety headers of the protocol (`other_file_response`). Otherwise the web app for a browser (`Accept` includes `text/html`), the file for anything else. `Vary: Accept` |

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

## Tests

`tests/server/test_api.py` tests the app through FastAPI's `TestClient`,
on a temporary folder: every interaction of the protocol, the errors, path
validation, content negotiation on public addresses, `/_api/info`,
`/_api/x/`, and read-only items (with real file permissions; skipped when
run as root or on Windows, where they do not apply).
`tests/server/test_home.py` covers the project home: nearest manifest,
fallback to the root, several `~`, libraries with and without their own
manifest, cycles, and `~` refused as a name. A change to the protocol starts
with a test there.
`tests/server/test_storage_interface.py` covers the storage interface: the
app on a storage held in memory (the interface is enough), a
`StorageWrapper` that sees every write, `create_app()` given a path.
`tests/server/test_extensions.py` covers server extensions: routers under
`/_api/x/<id>/`, errors, unknown extensions and endpoints, entries in
`/_api/info`, storage wrappers and their order, refused ids, and
middleware in front of everything.

```sh
uv run pytest tests/server
```
