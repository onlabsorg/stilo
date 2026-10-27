# The server

*`src/stilo/server/`, the module `stilo.server`: serves one folder of
documents over HTTP, as the [protocol](../protocol.md) describes, and the
built web app. FastAPI and uvicorn.*

| Module                          | Role                                           |
|---------------------------------|------------------------------------------------|
| `stilo/server/storage.py`       | `Storage`: the folder on disk. Path validation, read, create, update, tree, ETags. No HTTP. |
| `stilo/server/app.py`           | `create_app()`: the HTTP routes, mapped onto `Storage` |
| `stilo/server/__init__.py`      | Exports `create_app` |

The server imports nothing from the rest of the package (the CLI starts it
with `stilo serve`); `tests/test_layout.py` checks it.

The two layers are separate on purpose: `Storage` knows nothing about HTTP,
and `app.py` contains no file-system logic. A server in another language
replaces both, and passes the same tests.

## `Storage`

```python
class Storage:
    def __init__(self, root: Path | str)
```

Gives access to the documents under `root`, a folder. Raises `ValueError`
if `root` is not a folder.

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
- a path that leads out of the root, also through a symbolic link.

### `read`

```python
def read(self, path: str) -> tuple[bytes, str]
```

Returns the content of a file and its ETag. Any regular file can be read,
not only `.texl` files. Raises `NotFound` if there is no such file, and
`BadRequest` if the path is a folder.

### `create`

```python
def create(self, path: str, content: bytes) -> str
```

Creates a new `.texl` file, with its missing parent folders, and returns its
ETag. Raises `Conflict` if the file exists (create never overwrites), and
`BadRequest` for a path that is not a `.texl` file.

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
only folders and `.texl` files are listed, without hidden entries or
reserved names at the root. `depth` limits the recursion. Raises
`NotFound` and `BadRequest` as `read` does.

### `etag`

```python
def etag(content: bytes) -> str
```

Returns the strong ETag of a content: its SHA-256, in quotes as HTTP
requires.

### Errors

```text
StorageError (500)
 ├─ BadRequest (400)
 ├─ NotFound (404)
 ├─ Conflict (409)
 └─ PreconditionFailed (412)
```

Each `StorageError` subclass carries the HTTP status in its `status`
attribute. The HTTP layer turns any of them into a response with that status
and the body `{"error": "<message>"}`.

## `create_app`

```python
def create_app(root: Path | str, web_dist: Path | str | None = None) -> FastAPI
```

Creates the server app for the documents under `root`. `web_dist` is the
built web app (`src/stilo/web` in a checkout); without it, or if it is not built, pages show a
notice that says how to build it.

```python
import uvicorn
from stilo.server import create_app

uvicorn.run(create_app("examples", "src/stilo/web"), port=8000)
```

The routes, in the order they match:

| Route                              | Methods      | Does                                     |
|------------------------------------|--------------|------------------------------------------|
| `/_api/files/{path}`               | GET, HEAD    | `Storage.read`; `ETag` and `Cache-Control: no-cache` |
| `/_api/files/{path}`               | POST         | `Storage.create`; `201`, `ETag`, `Location` |
| `/_api/files/{path}`               | PUT          | `Storage.update` with the `If-Match` header |
| `/_api/tree/{path}`                | GET          | `Storage.tree`, with `?depth=` (1 or more) |
| `/_api/{path}`                     | any          | `404`: unknown endpoint                  |
| `/_app/...`                        | GET          | The web app's static files (`web_dist`)  |
| `/{path}`                          | GET, HEAD    | The public address: the web app for a browser (`Accept` includes `text/html`), the file for anything else; `Vary: Accept` |

`create_app()` is the server's extension point: new endpoints go under
`/_api/`, added here, without changing the existing ones.

## Tests

`tests/server/test_api.py` tests the app through FastAPI's `TestClient`,
on a temporary folder: every interaction of the protocol, the errors, path
validation, and content negotiation on public addresses. A change to the
protocol starts with a test there.

```sh
uv run pytest tests/server
```
