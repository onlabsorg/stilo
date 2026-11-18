"""The server's public API is `stilo.server.__all__`: a server extension,
another storage or another server that speaks the protocol uses these names
alone. A change to the list is deliberate: update this test, docs/server.md
and the changelog with it."""

import stilo.server
from fastapi.testclient import TestClient

PUBLIC = {
    "create_app", "PROTOCOL", "VERSION", "CAPABILITIES",
    "ServerExtension", "get_storage",
    "Storage", "FolderStorage", "StorageWrapper",
    "StorageError", "BadRequest", "Forbidden", "NotFound", "Conflict", "PreconditionFailed",
    "DOCUMENT_SUFFIX", "is_document", "etag", "FILE_TYPES", "media_type",
    "other_file_response", "NO_CACHE",
    "MANIFEST", "HOME", "MAX_HOMES", "HomeCycle", "home_of", "expand_home", "has_home",
}


def test_the_public_names():
    assert set(stilo.server.__all__) == PUBLIC
    assert len(stilo.server.__all__) == len(PUBLIC)
    for name in PUBLIC:
        assert hasattr(stilo.server, name), name


def test_errors_carry_their_status():
    from stilo.server import BadRequest, Conflict, Forbidden, NotFound, PreconditionFailed, StorageError
    statuses = {error: error.status for error in (BadRequest, Forbidden, NotFound, Conflict, PreconditionFailed)}
    assert statuses == {BadRequest: 400, Forbidden: 403, NotFound: 404, Conflict: 409, PreconditionFailed: 412}
    assert all(issubclass(error, StorageError) for error in statuses)


def test_file_helpers_answer_as_the_server(tmp_path):
    from stilo.server import create_app, etag, media_type, other_file_response
    (tmp_path / "page.html").write_bytes(b"<p>hi</p>")
    served = TestClient(create_app(tmp_path)).get("/page.html")
    own = other_file_response("page.html", b"<p>hi</p>", etag(b"<p>hi</p>"))
    for header in ("content-type", "etag", "content-security-policy", "x-content-type-options",
                   "cache-control", "vary"):
        assert own.headers[header] == served.headers[header], header
    assert media_type("a.webp") == "image/webp"
    assert media_type("data.csv.gz") == "application/octet-stream"
    assert media_type("noname") == "application/octet-stream"


def test_home_rule(tmp_path):
    from stilo.server import MANIFEST, expand_home, has_home, home_of
    (tmp_path / "p" / "docs").mkdir(parents=True)
    (tmp_path / "p" / MANIFEST).write_text("")
    assert home_of(tmp_path / "p" / "docs", tmp_path) == tmp_path / "p"
    assert expand_home(tmp_path, ["p", "docs", "~", "lib"], lambda f: tmp_path) == tmp_path / "p" / "lib"
    assert has_home("a/~/b") and not has_home("a/b")
