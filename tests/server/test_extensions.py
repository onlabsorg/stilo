"""Server extensions: routers under /_api/x/<id>/, storage wrappers, their
entries in /_api/info, and middleware for the whole app."""

import pytest
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, Response
from fastapi.testclient import TestClient
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware

from stilo.server import FolderStorage, ServerExtension, Storage, StorageWrapper, create_app, get_storage
from stilo.server.storage import NotFound

DOC = "<!--{ bek4 : markdown }-->\n# Title\n"


@pytest.fixture
def root(tmp_path):
    (tmp_path / "a.texl").write_text(DOC)
    return tmp_path


class Tagged(StorageWrapper):
    """A wrapper that records its name on every read, to see the order."""

    def __init__(self, inner, name, log):
        super().__init__(inner)
        self.name, self.log = name, log

    def read(self, path):
        self.log.append(self.name)
        return super().read(path)


def echo_router():
    router = APIRouter()

    @router.get("/size/{path:path}")
    async def size(path: str, storage: Storage = Depends(get_storage)):
        content, _ = storage.read(path)
        return {"path": path, "size": len(content)}

    @router.get("/")
    async def index():
        return {"hello": "echo"}

    @router.post("/missing")
    async def missing():
        raise NotFound("nothing here")

    @router.get("/file.pdf")
    async def pdf():
        return Response(b"%PDF-1.7", media_type="application/pdf",
                        headers={"Content-Disposition": 'attachment; filename="a.pdf"'})

    return router


def test_router_mounted_under_its_id(root):
    client = TestClient(create_app(root, extensions=[ServerExtension("echo", router=echo_router())]))
    assert client.get("/_api/x/echo/").json() == {"hello": "echo"}
    assert client.get("/_api/x/echo/size/a.texl").json() == {"path": "a.texl", "size": len(DOC)}
    pdf = client.get("/_api/x/echo/file.pdf")
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content == b"%PDF-1.7"


def test_storage_errors_in_extensions_answer_as_the_api(root):
    client = TestClient(create_app(root, extensions=[ServerExtension("echo", router=echo_router())]))
    assert client.post("/_api/x/echo/missing").status_code == 404
    assert client.post("/_api/x/echo/missing").json() == {"error": "nothing here"}
    response = client.get("/_api/x/echo/size/none.texl")
    assert response.status_code == 404
    assert "error" in response.json()
    assert client.get("/_api/x/echo/size/.hidden").status_code == 400


def test_unknown_extension_and_unknown_endpoint(root):
    client = TestClient(create_app(root, extensions=[ServerExtension("echo", router=echo_router())]))
    assert client.get("/_api/x/other/size/a.texl").json() == {"error": "no extension other"}
    response = client.get("/_api/x/echo/nothing")
    assert response.status_code == 404
    assert response.json() == {"error": "unknown endpoint of extension echo: /nothing"}
    assert client.get("/_api/x/echo").status_code == 404


def test_info_lists_the_extensions(root):
    app = create_app(root, extensions=[
        ServerExtension("history", router=echo_router(), capabilities=["versions"], version="1.2.0"),
        ServerExtension("pdf"),
    ])
    assert TestClient(app).get("/_api/info").json()["extensions"] == [
        {"id": "history", "capabilities": ["versions"], "version": "1.2.0"},
        {"id": "pdf", "capabilities": []},
    ]


def test_info_without_extensions(root):
    assert TestClient(create_app(root)).get("/_api/info").json()["extensions"] == []


def test_storage_wrappers_in_order(root):
    log = []
    app = create_app(root, extensions=[
        ServerExtension("one", wrap_storage=lambda s: Tagged(s, "one", log)),
        ServerExtension("two", wrap_storage=lambda s: Tagged(s, "two", log),
                        router=echo_router()),
    ])
    client = TestClient(app)
    # Stilo's own routes and the extensions' use the same, wrapped storage
    client.get("/_api/files/a.texl")
    assert log == ["two", "one"]
    log.clear()
    client.get("/_api/x/two/size/a.texl")
    assert log == ["two", "one"]
    assert isinstance(app.state.storage.inner.inner, FolderStorage)


def test_wrapping_a_given_storage(root):
    log = []
    folder = FolderStorage(root)
    app = create_app(folder, extensions=[ServerExtension("one", wrap_storage=lambda s: Tagged(s, "one", log))])
    assert app.state.storage.inner is folder
    assert TestClient(app).get("/a.texl").text == DOC
    assert log == ["one"]


@pytest.mark.parametrize("bad", ["", "Echo", "-echo", "e_cho", "e.cho", "e/cho", 3])
def test_bad_ids_are_refused(root, bad):
    with pytest.raises(ValueError):
        create_app(root, extensions=[ServerExtension(bad)])


def test_repeated_ids_are_refused(root):
    with pytest.raises(ValueError, match="two extensions"):
        create_app(root, extensions=[ServerExtension("echo"), ServerExtension("echo")])


def test_bad_capabilities_and_values_are_refused(root):
    with pytest.raises(ValueError):
        create_app(root, extensions=[ServerExtension("echo", capabilities="versions")])
    with pytest.raises(ValueError):
        create_app(root, extensions=[ServerExtension("echo", capabilities=[1])])
    with pytest.raises(TypeError):
        create_app(root, extensions=[{"id": "echo"}])


def test_good_ids(root):
    create_app(root, extensions=[ServerExtension("a"), ServerExtension("git-history-2")])


class Login(BaseHTTPMiddleware):
    """A login in front of everything: without the cookie, 401 with a login
    address (docs/protocol.md)."""

    async def dispatch(self, request, call_next):
        if request.cookies.get("user") != "ann":
            return JSONResponse({"error": "sign in", "login": "/login"}, status_code=401)
        return await call_next(request)


def test_middleware_wraps_the_whole_app(root):
    app = create_app(root, middleware=[Middleware(Login)],
                     extensions=[ServerExtension("echo", router=echo_router())])
    client = TestClient(app)
    for url in ("/_api/files/a.texl", "/_api/info", "/_api/x/echo/", "/a.texl"):
        response = client.get(url)
        assert response.status_code == 401, url
        assert response.json()["login"] == "/login"
    client.cookies.set("user", "ann")
    assert client.get("/_api/files/a.texl").text == DOC
    assert client.get("/_api/x/echo/").json() == {"hello": "echo"}
