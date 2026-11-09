"""HTTP layer: protocol v0 (docs/protocol.md) and the web app's files."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

from .home import has_home
from .storage import BadRequest, Storage, StorageError

TEXT = "text/plain; charset=utf-8"

# Document contents change and the editor fetches imports on every rendering:
# browsers must not reuse a stored copy without asking the server again.
NO_CACHE = {"Cache-Control": "no-cache"}

# Python's own table of types, not the machine's, so that every installation
# answers the same. WebP is missing from the table of Python 3.11.
FILE_TYPES = mimetypes.MimeTypes()
FILE_TYPES.add_type("image/webp", ".webp")

NO_BUILD = """<!doctype html><meta charset="utf-8"><title>Stilo</title>
<p>The web app is not built. Run <code>npm run build</code> in <code>web/</code>
of the Stilo checkout, or use the Vite dev server (<code>npm run dev</code>).</p>"""


def other_file_response(path: str, content: bytes, tag: str) -> Response:
    """A file that is not a Texl document, by its public URL. Files are
    untrusted: one opened by its URL must not run scripts on this origin, which
    can write to every document (docs/protocol.md)."""
    media_type, encoding = FILE_TYPES.guess_type(path)
    if media_type is None or encoding is not None:
        media_type = "application/octet-stream"
    headers = {"ETag": tag, "X-Content-Type-Options": "nosniff", **NO_CACHE, "Vary": "Accept"}
    if media_type.endswith(("/html", "/xml", "+xml")):
        headers["Content-Security-Policy"] = "sandbox"
    return Response(content, media_type=media_type, headers=headers)


def create_app(root: Path | str, web_dist: Path | str | None = None) -> FastAPI:
    """The server app for the documents under `root`. `web_dist` is the built
    web app (`stilo/web` in the CLI); without it, app pages show a notice."""
    storage = Storage(root)
    app = FastAPI(title="Stilo server", version="0.3.0")

    @app.exception_handler(StorageError)
    async def storage_error(request: Request, error: StorageError):
        return JSONResponse({"error": str(error)}, status_code=error.status)

    def home_redirect(prefix: str, path: str, request: Request) -> Response | None:
        """A read whose path has `~` segments is redirected to the real path
        (docs/protocol.md): the document is the one at the URL a redirect
        leads to, its identity for Texl (final URLs, Texl 0.8), so imports of
        one library by different paths share it, and a cycle through `~`
        ends. Temporary, since the home depends on manifests that can change."""
        if not has_home(path):
            return None
        url = prefix + quote(storage.expand_home(path), safe="/")
        if request.url.query:
            url += "?" + request.url.query
        return RedirectResponse(url, status_code=307, headers=NO_CACHE)

    @app.api_route("/_api/files/{path:path}", methods=["GET", "HEAD"])
    async def get_file(path: str, request: Request):
        if redirect := home_redirect("/_api/files/", path, request):
            return redirect
        content, tag = storage.read(path)
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

    @app.api_route("/_api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def unknown_api(path: str):
        return JSONResponse({"error": f"unknown endpoint: /_api/{path}"}, status_code=404)

    dist = Path(web_dist) if web_dist else None
    if dist and (dist / "index.html").is_file():
        # The bundle is built with base "/_app/" (web/vite.config.js).
        app.mount("/_app", StaticFiles(directory=dist), name="app")

    # Every other path is a public URL. A file that is not a document is served
    # as itself to everyone. For the rest, browsers asking for HTML get the web
    # app, which reads the open document from the URL path (and the navigation
    # root from ?root=); any other client (texl.import) gets the file itself.
    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def page(path: str, request: Request):
        if redirect := home_redirect("/", path, request):
            return redirect
        vary = {"Vary": "Accept"}
        if storage.is_other_file(path):
            return other_file_response(path, *storage.read(path))
        if "text/html" not in request.headers.get("accept", ""):
            content, tag = storage.read(path)
            return Response(content, media_type=TEXT,
                            headers={"ETag": tag, **NO_CACHE, **vary})
        if dist and (dist / "index.html").is_file():
            return FileResponse(dist / "index.html", media_type="text/html", headers=vary)
        return HTMLResponse(NO_BUILD, headers=vary)

    return app
