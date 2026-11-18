# Protocol v1 — documents over HTTP

*The contract between the web app and the server, as of 2026-11-18. Plain
HTTP, close to how the web already serves files, so that `texl.import` can
fetch documents by URL with no special client. Version 1: no accounts and no
versions in Stilo's own server; a server can describe itself
([`/_api/info`](#get-the-servers-info)), mark items read-only, and ask for a
login or refuse a request in a way every client understands
([Login and refusals](#login-and-refusals)). What changed from version 0 is
[at the end](#changes-from-version-0).*

## URL space

The server answers three kinds of paths: the API (`/_api/`), the web app's
assets (`/_app/`) and public URLs. Names starting with `_` are reserved at the
root; document folders and files cannot use them there.

| Path                  | What                                             |
|-----------------------|--------------------------------------------------|
| `/_api/files/<path>`  | File content: read, create, delete; update for documents |
| `/_api/tree/<path>`   | Folder structure, as JSON; create and delete folders |
| `/_api/move/<path>`   | Move or rename a file or a folder                |
| `/_api/info`          | What the server is and can do, as JSON           |
| `/_api/x/<id>/...`    | Reserved for the endpoints of server extensions, by extension id |
| `/_app/...`           | The web app's static assets (built bundle)       |
| `/<path>`             | Any other path: the **public URL** of a document or other file (GET, HEAD) |

`<path>` is a path relative to the server root, with `/` separators.
Segments must not be empty, `.`, `..`, or start with `.` (no hidden files).
Paths that leave the root (also through symbolic links) are refused. A
segment `~` is never a name: it stands for the package home (below), so no
file or folder can be created or moved under that name, and a folder named
`~` on disk is hidden like a hidden one.

**Package home (`~`).** A folder that holds a file named `package.texl` is
a *package*. The *home* of a folder is the nearest folder at or above it
that holds one; without one, the server root. In the path of a read (`GET`
and `HEAD`, public URL or `/_api/files/`), each `~` segment, from the left,
stands for the home of the folder before it, and the server answers with a
redirect to the real path, `307 Temporary Redirect` (the query kept,
`Cache-Control: no-cache`):

```
package.texl in /packages/beam/

GET /packages/beam/docs/~/references/stilo/index.texl
→ 307 Temporary Redirect
  Location: /packages/beam/references/stilo/index.texl
GET /packages/beam/docs/~/references/a/~/references/b/b.texl
  → /packages/beam/references/a/ has no package.texl:
    /packages/beam/references/b/b.texl
```

This is how a document imports from its package's references wherever it
is in the package: Texl gives `~` no meaning, so
`texl.import "~/references/x.texl"` in `/packages/beam/docs/a.texl` asks
for `/packages/beam/docs/~/references/x.texl`, and the server redirects it
to `/packages/beam/references/x.texl`. A redirect, not the file itself,
because Texl takes a document's identity from the URL it was finally
fetched from (its *final URL*, Texl 0.8): the imported document is the one
at its real path, its relative imports resolve from there, imports of it by
different paths share one document, and a document importing itself
through `~` is an import cycle. A reference importing `~/...`, from its
real path, asks for a path with one `~`, which resolves from the
reference's folder: to the reference's own home if it has a
`package.texl`, else to the
package's. The search for a home never leaves the server root, and the
server never reads the manifest, it only checks that it exists; nor does
it check that the target exists before redirecting (the target answers
`404`). The redirect is temporary because the home depends on manifests
that can change. Paths with more than 16 `~` segments get `400`, a
safeguard for clients that do not follow redirects. A `..` right after `~`
cancels it, as URL resolution removes both (`~/../x.texl` is a plain
relative path).

A document's **public URL** is `/<path>`, one URL for people and for
Texl, by content negotiation on `Accept`:

- a browser (`Accept` includes `text/html`) gets the web app, which opens
  the file at the path in the editor; the navigation tree shows the server
  root, or the folder given as `?root=<path>` (see `web/src/route.js`);
- any other client gets the file itself, as `GET /_api/files/<path>` would.
  This is what `texl.import("/library/steel.texl")` fetches.

Responses carry `Vary: Accept`. The `/_api/files/` form is the explicit API
used by the web app for reading and writing.

Any **other file** under the root, such as an image or a PDF, has a public
URL too, so a document can link to it. Every client gets the file itself,
also a browser asking for HTML, with `ETag` and `Cache-Control: no-cache` as
above and these headers:

| Header                    | Value                                          |
|---------------------------|------------------------------------------------|
| `Content-Type`            | The type of the file's extension; `application/octet-stream` if it has no known type, or a compressed one, which a browser downloads |
| `X-Content-Type-Options`  | `nosniff`: clients must keep to that type      |
| `Content-Security-Policy` | `sandbox`, only for HTML and XML types, SVG included |

Files are untrusted, and the server's origin can write to every document. So
a file opened by its URL must not run scripts there: HTML, XML and SVG are
sandboxed, while an SVG shown in an `<img>` runs no scripts and still shows.
The `/_api/files/` form always answers `text/plain`, so it never runs
anything either.

A browser asking for a path that is not a file gets the web app, which
opens no document unless the path ends in `.texl`.

**Imports:** the editor renders a document as the document at its public
URL, so a relative import resolves from the document's folder
(`texl.import("steel.texl")` in `/library/beam.texl` fetches
`/library/steel.texl`). Imports are fetched again on every rendering, so file
responses carry `Cache-Control: no-cache`: the browser never reuses a stored
copy without asking the server.

**Links:** a relative link or image in rendered text resolves from the folder
of the document showing it. Text from an imported document is part of the
document showing it, so its relative links resolve from there too, not from
the imported document's folder. A document stores links as written: the
server and the web app do not rewrite them.

**Extensions.** `/_api/x/<id>/` is reserved for the endpoints a server
extension adds, under the extension's id (lowercase letters, digits and
dashes); `/_api/info` lists the extensions a server has. Stilo's own
endpoints never use it. A request for an extension the server does not have
gets `404`. What an extension's endpoints do is up to the extension, but
they answer errors as the rest of the API does ([Errors](#errors)).

## Interactions

### GET the server's info

```
GET /_api/info
→ 200 OK
  Content-Type: application/json
  {
    "protocol": 1,
    "server": { "name": "stilo", "version": "0.4.0" },
    "capabilities": ["files", "tree", "folders", "move", "upload", "trash", "home"],
    "extensions": []
  }
```

`protocol` is the version of this protocol the server speaks. `server` names
the software. `capabilities` lists what it can do:

| Capability | Means |
|------------|-------|
| `files`    | GET, CREATE, UPDATE and DELETE files |
| `tree`     | QUERY the tree |
| `folders`  | CREATE and DELETE folders |
| `move`     | MOVE files and folders |
| `upload`   | CREATE files that are not documents |
| `trash`    | A deleted item can be got back on the server (not through the protocol) |
| `home`     | The package home, `~` in paths |

A request for something the server cannot do gets `501 Not Implemented`;
a client hides what the server lacks. `extensions` lists the server's
extensions, one entry each, with their endpoints under `/_api/x/<id>/`:

```json
{ "id": "history", "version": "1.2.0", "capabilities": ["versions"] }
```

`id` is always there; `version` (the extension's own) and `capabilities`
(what the extension can do, in names of its own) are optional, an empty
list when missing. An extension's capabilities belong to its entry, never
to the top-level `capabilities`, so their names cannot collide with the
protocol's.
A client ignores members, capabilities and fields it does not know.

A server that answers `404` here speaks version 0: a client treats it as
having every capability above but `trash` (which version 0 does not
promise), and no extensions.

### GET a resource

```
GET /_api/files/packages/beam/beam-check.texl
→ 200 OK
  Content-Type: text/plain; charset=utf-8
  ETag: "<sha256 of the content>"
  Cache-Control: no-cache
  <document text>
```

Any regular file under the root can be read (Texl documents import other
files too). `404` if it does not exist, `400` if the path is a folder. `HEAD`
answers the same, without the body. A path with `~` segments is redirected
to the real path first (see [URL space](#url-space)).

### CREATE a new file

```
POST /_api/files/packages/beam/new-check.texl
  Content-Type: text/plain; charset=utf-8
  <initial text, may be empty>
→ 201 Created
  Location: /_api/files/packages/beam/new-check.texl
  ETag: "<sha256>"
```

Any file can be created, a document or another file (an image, a PDF: the
web app's Upload sends its bytes as they are). Missing parent folders are
created. `409 Conflict` if the file already exists (create never
overwrites), as a file or a folder, or if a file is in the way of a parent
folder. `400` for a path the protocol refuses, and for the root.

### UPDATE an existing file

```
PUT /_api/files/packages/beam/beam-check.texl
  If-Match: "<ETag from the last GET or write>"
  Content-Type: text/plain; charset=utf-8
  <full new text>
→ 200 OK
  ETag: "<new sha256>"
```

The body replaces the whole file. `404` if the file does not exist (update
never creates). Only `.texl` files can be updated (`400` otherwise, whether or
not the file exists). With `If-Match`, the server refuses the write with
`412 Precondition Failed` if the file changed since the client read it, so
two people saving the same document do not silently overwrite each other.
Without `If-Match` the write is unconditional; the web app always sends it.

### QUERY the tree of a folder

```
GET /_api/tree/packages?depth=2
→ 200 OK
  Content-Type: application/json
  {
    "name": "packages", "path": "packages", "type": "folder",
    "children": [
      { "name": "beam", "path": "packages/beam", "type": "folder",
        "children": [
          { "name": "beam-check.texl", "path": "packages/beam/beam-check.texl",
            "type": "file", "size": 1834, "modified": "2026-10-24T09:12:03Z" }
        ] }
    ]
  }
```

`/_api/tree/` (empty path) is the root, whose `name` and `path` are `""`.
A node may carry `"readOnly": "<reason>"`: the item cannot be changed (see
[Read-only items](#read-only-items)).
Children are folders first, then files, each sorted by name. Every file is
listed, documents and other files alike (a client tells them apart by the
`.texl` extension); hidden entries are skipped. `depth` limits
recursion (`depth=1`: direct children only; default: unlimited); a folder
beyond the depth has no `children` key. `404` if the folder does not exist;
`400` if the path is a file.

### CREATE a folder

```
POST /_api/tree/packages/bridge
→ 201 Created
  Location: /_api/tree/packages/bridge
```

Missing parent folders are created. `409 Conflict` if the path already exists,
as a folder or a file. A folder's name cannot end in `.texl` (`400`).

### MOVE a file or a folder

```
POST /_api/move/packages/beam/check.texl
  Content-Type: application/json
  {"to": "packages/beam/bending-check.texl"}
→ 200 OK
  {"path": "packages/beam/bending-check.texl"}
```

Moving and renaming are one operation: `to` is the item's whole new path.
Missing parent folders are created. A folder moves with everything in it, other
files too, so that its documents keep what they link to. Links in other
documents are not updated.

`404` if the item does not exist. `409 Conflict` if `to` exists (move never
overwrites). `400` if `to` is not a valid path, if a document's new name does not
end in `.texl`, if another file's does (a file never becomes or stops being a
document), if a folder's does, if a folder would go inside itself, or for the
root. A move to the path the item
already has changes nothing.

### DELETE a file

```
DELETE /_api/files/packages/beam/check.texl
→ 204 No Content
```

The file, a document or any other, is gone from the tree and from its URL. Its
folder stays, even if this leaves it empty. `404` if it does not exist; `400`
if the path is a folder.

### DELETE a folder

```
DELETE /_api/tree/packages/beam
→ 200 OK
  {"deleted": 3}
```

Deletes the folder with everything in it: documents, other files, hidden
entries and subfolders; a link inside goes as a link, what it points to stays.
`deleted` is how many files were in it, at any depth. `404` if the folder does
not exist; `400` if the path is a file, a link or the root.

**What deleting means is up to the server.** To a client the item is gone; the
protocol has no way to list or restore what was deleted. Stilo's server moves
the file or folder to `.trash/<time of the deletion>/<its path>` under its root
(a folder with no files at all is simply removed), so a
user can get it back from the file system (S8, S15). As a hidden folder, `.trash`
cannot be reached through the protocol.

## Read-only items

A server can refuse changes to some items: files it cannot write, a reference
that must not be edited, items the user may only read. It marks them in the
tree, with the reason, which a client shows:

```
{ "name": "steel.texl", "path": "references/steel.texl", "type": "file",
  "readOnly": "The file cannot be written on the server" }
```

A read-only file cannot be updated, moved or deleted; a read-only folder
cannot be moved or deleted, and nothing can be created in it, moved into or
out of it, or deleted from it. Such a request gets `403 Forbidden` with the
reason as its `error`. A server may refuse a write with `403` also for an
item it did not mark; a client shows the reason.

Stilo's own server marks the files and folders it cannot write on its file
system ("The file cannot be written on the server", "The folder cannot be
written on the server").

## Login and refusals

A server may need to know who the user is (Stilo's own never does; a
platform in front of it may). The answers are the same for every request,
the public URLs included:

```
GET /_api/tree/
→ 401 Unauthorized
  Content-Type: application/json
  { "error": "Sign in to continue", "login": "https://example.com/login" }
```

`401` means that the request needs a signed-in user. `login`, if given, is
the address of the page where the user signs in: a client sends the user
there, adding `next=<the address to come back to>` to its query string, and
does not repeat the request on its own. How the user is then recognized
(a cookie, a header) is up to the server and the client's transport.

```
PUT /_api/files/references/steel.texl
→ 403 Forbidden
  { "error": "References are read-only" }
```

`403` means that the user may not do this; `error` says why, in words a
user can read.

## Errors

Error responses have a JSON body `{"error": "<message>"}` and the status
codes above: `400` for a request the protocol refuses, `401` and `403` (see
[Login and refusals](#login-and-refusals)), `404` for an item that does not
exist, `409` for an item in the way, `412` for a document changed since it
was read, `501` for something the server cannot do. The endpoints of server
extensions (`/_api/x/<id>/`) answer errors the same way.

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

## Changes from version 0

Version 1 (2026-11-17) adds to version 0 and changes none of it, so a
version 0 client still works with a version 1 server:

- `GET /_api/info`: the protocol version, the server, its capabilities and
  extensions; `501` for what a server cannot do.
- `/_api/x/<id>/`, reserved for server extensions; each listed in `info`
  with its id and, optionally, its version and capabilities.
- Read-only items: `readOnly` in the tree, `403` on writing them.
- `401` with `login`, and `403` with a reason, for servers that need a
  signed-in user or refuse a request.
