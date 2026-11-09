"""The project home `~` (DECISIONS.md S10, docs/protocol.md)."""

import pytest
from fastapi.testclient import TestClient

from stilo.server import create_app
from stilo.server.storage import BadRequest, Storage


@pytest.fixture
def root(tmp_path):
    """
    root/
      lib/x.texl                      "root lib"
      proj/project.texl
      proj/lib/x.texl                 "proj lib"
      proj/lib/own/project.texl       a library with its own home
      proj/lib/own/lib/x.texl         "own lib"
      proj/lib/plain/plain.texl       a library without one
      proj/docs/sub/a.texl
    """
    files = {
        "lib/x.texl": "root lib",
        "proj/project.texl": "<% project_name = \"proj\" %>",
        "proj/lib/x.texl": "proj lib",
        "proj/lib/own/project.texl": "",
        "proj/lib/own/lib/x.texl": "own lib",
        "proj/lib/plain/plain.texl": "plain",
        "proj/docs/sub/a.texl": "a",
    }
    for path, text in files.items():
        (tmp_path / path).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / path).write_text(text)
    return tmp_path


@pytest.fixture
def storage(root):
    return Storage(root)


@pytest.fixture
def client(root):
    return TestClient(create_app(root))


@pytest.mark.parametrize("path, expanded", [
    ("proj/docs/sub/~/lib/x.texl", "proj/lib/x.texl"),          # nearest manifest above
    ("proj/~/lib/x.texl", "proj/lib/x.texl"),                   # in the folder itself
    ("~/lib/x.texl", "lib/x.texl"),                             # no manifest: the root
    ("other/~/lib/x.texl", "lib/x.texl"),
    ("proj/docs/~/lib/plain/~/lib/x.texl", "proj/lib/x.texl"),  # library without a home
    ("proj/docs/~/lib/own/~/lib/x.texl", "proj/lib/own/lib/x.texl"),  # with its own
    ("proj/docs/a.texl", "proj/docs/a.texl"),                   # no ~: unchanged
])
def test_expand_home(storage, path, expanded):
    assert storage.expand_home(path) == expanded


def test_expand_home_refuses_bad_segments(storage):
    with pytest.raises(BadRequest):
        storage.expand_home("../~/lib/x.texl")


def test_get_by_public_url(client):
    assert client.get("/proj/docs/sub/~/lib/x.texl").text == "proj lib"
    assert client.get("/proj/docs/~/lib/own/~/lib/x.texl").text == "own lib"


def test_get_by_protocol(client):
    response = client.get("/_api/files/proj/docs/sub/~/lib/x.texl")
    assert response.status_code == 200
    assert response.text == "proj lib"


def test_missing_library_is_not_found(client):
    assert client.get("/proj/docs/~/lib/none/none.texl").status_code == 404


def test_tilde_is_not_a_name(client):
    assert client.post("/_api/files/proj/~/new.texl", content="x").status_code == 400
    assert client.put("/_api/files/proj/~/lib/x.texl", content="x").status_code == 400
    assert client.post("/_api/tree/proj/~").status_code == 400
    response = client.post("/_api/move/proj/docs/sub/a.texl", json={"to": "proj/~/a.texl"})
    assert response.status_code == 400


def test_tilde_folders_are_hidden(root, client):
    (root / "proj" / "~").mkdir()
    (root / "proj" / "~" / "hidden.texl").write_text("hidden")
    names = [child["name"] for child in client.get("/_api/tree/proj").json()["children"]]
    assert "~" not in names
    # and a path through it means the home, not the folder
    assert client.get("/proj/~/hidden.texl").status_code == 404


def test_a_cycle_through_home_ends(client):
    path = "proj/docs/" + "~/lib/plain/" * 17 + "plain.texl"
    assert client.get("/" + path).status_code == 400
    path = "proj/docs/" + "~/lib/plain/" * 16 + "plain.texl"
    assert client.get("/" + path).text == "plain"


def test_a_read_through_home_redirects_to_the_real_path(client):
    response = client.get("/proj/docs/sub/~/lib/x.texl?v=1", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/proj/lib/x.texl?v=1"
    response = client.get("/_api/files/proj/docs/~/lib/own/~/lib/x.texl", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/_api/files/proj/lib/own/lib/x.texl"


def test_the_redirect_is_percent_encoded(root, client):
    (root / "proj" / "lib" / "my lib.texl").write_text("spaced")
    response = client.get("/proj/docs/~/lib/my%20lib.texl", follow_redirects=False)
    assert response.headers["location"] == "/proj/lib/my%20lib.texl"
    assert client.get("/proj/docs/~/lib/my%20lib.texl").text == "spaced"


def test_a_browser_page_through_home_redirects_too(client):
    response = client.get("/proj/docs/~/lib/x.texl", headers={"Accept": "text/html"},
                          follow_redirects=False)
    assert response.headers["location"] == "/proj/lib/x.texl"
