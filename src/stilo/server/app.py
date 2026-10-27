"""HTTP layer: protocol v0 (docs/src/protocol.md) and the web app's files."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .storage import Storage, StorageError

TEXT = "text/plain; charset=utf-8"

# Document contents change and the editor fetches imports on every rendering:
# browsers must not reuse a stored copy without asking the server again.
NO_CACHE = {"Cache-Control": "no-cache"}

NO_BUILD = """<!doctype html><meta charset="utf-8"><title>Stilo</title>
<p>The web app is not built. Run <code>npm run build</code> in <code>web/</code>
of the Stilo checkout, or use the Vite dev server (<code>npm run dev</code>).</p>"""


def create_app(root: Path | str, web_dist: Path | str | None = None) -> FastAPI:
    """The server app for the documents under `root`. `web_dist` is the built
    web app (`stilo/web` in the CLI); without it, app pages show a notice."""
    storage = Storage(root)
    app = FastAPI(title="Stilo server", version="0.1.0")

    @app.exception_handler(StorageError)
    async def storage_error(request: Request, error: StorageError):
        return JSONResponse({"error": str(error)}, status_code=error.status)

    @app.api_route("/_api/files/{path:path}", methods=["GET", "HEAD"])
    async def get_file(path: str):
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

    # Every other path is a document's public URL. Browsers asking for HTML
    # get the web app, which reads the open document from the URL path (and
    # the navigation root from ?root=); any other client (texl.import) gets
    # the file itself.
    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def page(path: str, request: Request):
        vary = {"Vary": "Accept"}
        if "text/html" not in request.headers.get("accept", ""):
            content, tag = storage.read(path)
            return Response(content, media_type=TEXT,
                            headers={"ETag": tag, **NO_CACHE, **vary})
        if dist and (dist / "index.html").is_file():
            return FileResponse(dist / "index.html", media_type="text/html", headers=vary)
        return HTMLResponse(NO_BUILD, headers=vary)

    return app
