# Protocol v0 — documents over HTTP

*The contract between the web app and the server, as of 2026-11-07. Plain
HTTP, close to how the web already serves files, so that `texl.import` can
fetch documents by URL with no special client. Version 0: no accounts, no
permissions, no versions; everything under the server root is readable and
writable.*

## URL space

The server answers three kinds of paths. Names starting with `_` are
reserved at the root; document folders and files cannot use them there.

| Path                  | What                                             |
|-----------------------|--------------------------------------------------|
| `/_api/files/<path>`  | Document content: read, create, update, delete   |
| `/_api/tree/<path>`   | Folder structure, as JSON; create and delete folders |
| `/_api/move/<path>`   | Move or rename a document or a folder            |
| `/_app/...`           | The web app's static assets (built bundle)       |
| `/<path>`             | Any other path: the document's **public URL** (GET, HEAD) |

`<path>` is a path relative to the server root, with `/` separators.
Segments must not be empty, `.`, `..`, or start with `.` (no hidden files).
Paths that leave the root (also through symbolic links) are refused.

A document's **public URL** is `/<path>`, one URL for people and for
Texl, by content negotiation on `Accept`:

- a browser (`Accept` includes `text/html`) gets the web app, which opens
  the file at the path in the editor; the navigation tree shows the server
  root, or the folder given as `?root=<path>` (see `web/src/route.js`);
- any other client gets the file itself, as `GET /_api/files/<path>` would.
  This is what `texl.import("/library/steel.texl")` fetches.

Responses carry `Vary: Accept`. The `/_api/files/` form is the explicit API
used by the web app for reading and writing.

**Imports:** the editor renders a document as the document at its public
URL, so a relative import resolves from the document's folder
(`texl.import("steel.texl")` in `/library/beam.texl` fetches
`/library/steel.texl`). Imports are fetched again on every rendering, so file
responses carry `Cache-Control: no-cache`: the browser never reuses a stored
copy without asking the server.

## Interactions

### GET a resource

```
GET /_api/files/projects/beam/beam-check.texl
→ 200 OK
  Content-Type: text/plain; charset=utf-8
  ETag: "<sha256 of the content>"
  Cache-Control: no-cache
  <document text>
```

Any regular file under the root can be read (Texl documents import other
files too). `404` if it does not exist, `400` if the path is a folder.

### CREATE a new file

```
POST /_api/files/projects/beam/new-check.texl
  Content-Type: text/plain; charset=utf-8
  <initial text, may be empty>
→ 201 Created
  Location: /_api/files/projects/beam/new-check.texl
  ETag: "<sha256>"
```

Missing parent folders are created. `409 Conflict` if the file already
exists (create never overwrites). Only `.texl` files can be written (`400`
otherwise).

### UPDATE an existing file

```
PUT /_api/files/projects/beam/beam-check.texl
  If-Match: "<ETag from the last GET or write>"
  Content-Type: text/plain; charset=utf-8
  <full new text>
→ 200 OK
  ETag: "<new sha256>"
```

The body replaces the whole file. `404` if the file does not exist (update
never creates). With `If-Match`, the server refuses the write with
`412 Precondition Failed` if the file changed since the client read it, so
two people saving the same document do not silently overwrite each other.
Without `If-Match` the write is unconditional; the web app always sends it.

### QUERY the tree of a folder

```
GET /_api/tree/projects?depth=2
→ 200 OK
  Content-Type: application/json
  {
    "name": "projects", "path": "projects", "type": "folder",
    "children": [
      { "name": "beam", "path": "projects/beam", "type": "folder",
        "children": [
          { "name": "beam-check.texl", "path": "projects/beam/beam-check.texl",
            "type": "file", "size": 1834, "modified": "2026-10-24T09:12:03Z" }
        ] }
    ]
  }
```

`/_api/tree/` (empty path) is the root, whose `name` and `path` are `""`.
Children are folders first, then files, each sorted by name. Only folders
and `.texl` files are listed; hidden entries are skipped. `depth` limits
recursion (`depth=1`: direct children only; default: unlimited); a folder
beyond the depth has no `children` key. `404` if the folder does not exist;
`400` if the path is a file.

### CREATE a folder

```
POST /_api/tree/projects/bridge
→ 201 Created
  Location: /_api/tree/projects/bridge
```

Missing parent folders are created. `409 Conflict` if the path already exists,
as a folder or a file. A folder's name cannot end in `.texl` (`400`).

### MOVE a document or a folder

```
POST /_api/move/projects/beam/check.texl
  Content-Type: application/json
  {"to": "projects/beam/bending-check.texl"}
→ 200 OK
  {"path": "projects/beam/bending-check.texl"}
```

Moving and renaming are one operation: `to` is the item's whole new path.
Missing parent folders are created. A folder moves with everything in it, other
files too, so that its documents keep what they link to. Links in other
documents are not updated.

`404` if the item does not exist. `409 Conflict` if `to` exists (move never
overwrites). `400` if `to` is not a valid path, if a document's new name does not
end in `.texl`, if a folder's does, if the item is a file other than a document,
if a folder would go inside itself, or for the root. A move to the path the item
already has changes nothing.

### DELETE a document

```
DELETE /_api/files/projects/beam/check.texl
→ 204 No Content
```

The document is gone from the tree and from its URL. Its folder stays, even if
this leaves it empty. `404` if it does not exist; `400` if the path is a folder
or a file other than a document.

### DELETE a folder

```
DELETE /_api/tree/projects/beam
→ 200 OK
  {"deleted": 3, "removed": true}
```

Deletes every document in the folder, at any depth. Other files and hidden
entries stay. Each folder left with nothing in it is removed, the given one
included; one that still holds something stays. `deleted` is how many documents
were deleted, `removed` whether the given folder is gone. `404` if the folder
does not exist; `400` if the path is a file, a link or the root.

**What deleting means is up to the server.** To a client the item is gone; the
protocol has no way to list or restore what was deleted. Stilo's server moves
documents to `.trash/<time of the deletion>/<their path>` under its root, so a
user can get them back from the file system (S8). As a hidden folder, `.trash`
cannot be reached through the protocol.

## Errors

Error responses have a JSON body `{"error": "<message>"}` and the status
codes above.

## Why plain HTTP (and not something else)

- **`texl.import` already speaks HTTP.** Documents link to each other by
  URL; serving content as plain GET means a document renders the same in
  the web app, the CLI and `pytexl`, with no client library.
- **Standard semantics for free:** ETags and `If-Match` give safe
  concurrent saves; caching, proxies and browser tools work unchanged.
- **Alternatives considered:** WebDAV has the same verbs plus `PROPFIND`
  for trees, but is awkward from browsers and has more than we need;
  JSON-RPC or GraphQL would hide documents behind a custom client.
  Real-time co-editing (WebSocket/CRDT) is out of MVP scope.
- **What will change:** Stilo's server stays a single-user file server.
  Papiro, the collaboration platform, is meant to speak the same protocol
  so that the web app works against either, and to add its own endpoints
  under `/_api/` (accounts, repositories, release and accept) without
  breaking these.
