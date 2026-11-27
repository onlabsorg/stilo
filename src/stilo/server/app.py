"""HTTP layer: protocol v1 (docs/protocol.md) and the web app's files."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Sequence
from urllib.parse import quote

from fastapi import FastAPI, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware import Middleware

from .extensions import ServerExtension, check_extensions
from .archive import is_archive
from .files import NO_CACHE, download_response, is_document, other_file_response
from .storage import BadRequest, FolderStorage, NotFound, Storage, StorageError

TEXT = "text/plain; charset=utf-8"

# The server's version, as published (bumped with pyproject.toml).
VERSION = "0.11.0"

# The version of the protocol it speaks, and what it can do (GET /_api/info).
PROTOCOL = 1
CAPABILITIES = ["files", "tree", "folders", "move", "upload", "rewrite", "trash", "home", "archives",
                "index"]

NO_BUILD = """<!doctype html><meta charset="utf-8"><title>Stilo</title>
<p>The web app is not built. Run <code>npm run build</code> in <code>web/</code>
of the Stilo checkout, or use the Vite dev server (<code>npm run dev</code>).</p>"""


def create_app(storage: Storage | Path | str, web_dist: Path | str | None = None, *,
               extensions: Sequence[ServerExtension] = (),
               middleware: Sequence[Middleware] = ()) -> FastAPI:
    """The server app for the documents in `storage`: any object with the
    methods of `Storage`, or the path of a folder (a `FolderStorage`).
    `web_dist` is the built web app (`stilo/web` in the CLI); without it, app
    pages show a notice. `extensions` are server extensions, in order: each
    one's storage wrapper wraps the storage (the last outermost), its router
    is mounted under `/_api/x/<id>/`, and `/_api/info` lists it.
    `middleware` (Starlette's `Middleware` entries) wraps the whole app."""
    extensions = list(extensions)
    check_extensions(extensions)
    if isinstance(storage, (str, os.PathLike)):
        storage = FolderStorage(storage)
    for extension in extensions:
        if extension.wrap_storage is not None:
            storage = extension.wrap_storage(storage)
    app = FastAPI(title="Stilo server", version=VERSION, middleware=list(middleware))
    app.state.storage = storage
    app.state.extensions = extensions
    extension_ids = {extension.id for extension in extensions}

    @app.exception_handler(StorageError)
    async def storage_error(request: Request, error: StorageError):
        return JSONResponse({"error": str(error)}, status_code=error.status)

    def read_redirect(prefix: str, path: str, request: Request, *, index: bool = True) -> Response | None:
        """A read is redirected to the path it leads to (docs/protocol.md):
        `~` segments expanded to the real path, and a folder or a packed
        package to its `index.texl` (`storage.read_target`; S25), unless
        `index` is false or the request asks for `?download`. The document is
        the one at the URL a redirect leads to, its identity for Texl (final
        URLs, Texl 0.8), so imports of one document by different paths share
        it, relative imports resolve from its folder, and a cycle through `~`
        ends. Temporary, since manifests and folders can change."""
        if index and "download" not in request.query_params:
            target = storage.read_target(path)
        else:
            target = storage.expand_home(path).strip("/")
        if target == path:
            return None
        url = prefix + quote(target, safe="/")
        if request.url.query:
            url += "?" + request.url.query
        return RedirectResponse(url, status_code=307, headers=NO_CACHE)

    @app.api_route("/_api/files/{path:path}", methods=["GET", "HEAD"])
    async def get_file(path: str, request: Request):
        if redirect := read_redirect("/_api/files/", path, request):
            return redirect
        content, tag = storage.read(path)
        if "download" in request.query_params:
            return download_response(path, content, tag)
        return Response(content, media_type=TEXT, headers={"ETag": tag, **NO_CACHE})

    @app.post("/_api/files/{path:path}", status_code=201)
    async def create_file(path: str, request: Request):
        tag = storage.create(path, await request.body())
        return Response(status_code=201,
                        headers={"ETag": tag, "Location": f"/_api/files/{path}"})

    @app.put("/_api/files/{path:path}")
    async def update_file(path: str, request: Request):
        tag = storage.update(path, await request.body(), request.headers.get("if-match"))
        return Response(status_code=200, headers={"ETag": tag})

    @app.delete("/_api/files/{path:path}", status_code=204)
    async def delete_file(path: str):
        storage.delete_file(path)
        return Response(status_code=204)

    @app.post("/_api/move/{path:path}")
    async def move(path: str, request: Request):
        try:
            to = (await request.json())["to"]
        except (ValueError, KeyError, TypeError):
            raise BadRequest('expected a JSON body {"to": "<new path>"}') from None
        if not isinstance(to, str):
            raise BadRequest('expected a JSON body {"to": "<new path>"}')
        return {"path": storage.move(path, to)}

    @app.post("/_api/tree/{path:path}", status_code=201)
    async def create_folder(path: str):
        storage.create_folder(path)
        return Response(status_code=201, headers={"Location": f"/_api/tree/{path}"})

    @app.delete("/_api/tree/{path:path}")
    async def delete_folder(path: str):
        return storage.delete_folder(path)

    @app.get("/_api/tree/{path:path}")
    async def get_tree(path: str, depth: int | None = Query(None, ge=1)):
        return storage.tree(path, depth)

    @app.get("/_api/info")
    async def info():
        """What the server is and can do (docs/protocol.md)."""
        return {"protocol": PROTOCOL, "server": {"name": "stilo", "version": VERSION},
                "capabilities": CAPABILITIES,
                "extensions": [extension.info() for extension in extensions]}

    # The extensions' endpoints, before the catch-all routes below
    for extension in extensions:
        if extension.router is not None:
            app.include_router(extension.router, prefix=f"/_api/x/{extension.id}")

    @app.api_route("/_api/x/{extension}/{path:path}", methods=["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH"])
    @app.api_route("/_api/x/{extension}", methods=["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH"])
    async def no_extension(extension: str, path: str = ""):
        """The space of server extensions (docs/protocol.md): an extension
        this server does not have, or an endpoint its extension lacks."""
        if extension in extension_ids:
            return JSONResponse({"error": f"unknown endpoint of extension {extension}: /{path}"},
                                status_code=404)
        return JSONResponse({"error": f"no extension {extension}"}, status_code=404)

    @app.api_route("/_api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def unknown_api(path: str):
        return JSONResponse({"error": f"unknown endpoint: /_api/{path}"}, status_code=404)

    dist = Path(web_dist) if web_dist else None
    if dist and (dist / "index.html").is_file():
        # The bundle is built with base "/_app/" (web/vite.config.js).
        app.mount("/_app", StaticFiles(directory=dist), name="app")

    def other_file(path: str) -> tuple[bytes, str] | None:
        """The content and ETag of `path` if it is a file that is not a
        document; None for a document, a folder, a missing file or a path the
        protocol refuses. A packed package is a folder here: its file is
        fetched with `?download` (S25)."""
        if is_document(path) or is_archive(path):
            return None
        try:
            return storage.read(path)
        except (NotFound, BadRequest):
            return None

    # Every other path is a public URL. A file that is not a document is served
    # as itself to everyone. For the rest, browsers asking for HTML get the web
    # app, which reads the open document from the URL path (and the navigation
    # root from ?root=); any other client (texl.import) gets the file itself.
    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def page(path: str, request: Request):
        browser = "text/html" in request.headers.get("accept", "")
        # A browser asking for a folder gets the app, any other client its index
        if redirect := read_redirect("/", path, request, index=not browser):
            return redirect
        if "download" in request.query_params:
            return download_response(path, *storage.read(path))
        vary = {"Vary": "Accept"}
        if file := other_file(path):
            return other_file_response(path, *file)
        if not browser:
            content, tag = storage.read(path)
            return Response(content, media_type=TEXT,
                            headers={"ETag": tag, **NO_CACHE, **vary})
        if dist and (dist / "index.html").is_file():
            return FileResponse(dist / "index.html", media_type="text/html", headers=vary)
        return HTMLResponse(NO_BUILD, headers=vary)

    return app
