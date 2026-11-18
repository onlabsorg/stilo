"""The package home `~` (DECISIONS.md S10, docs/protocol.md)."""

import pytest
from fastapi.testclient import TestClient

from stilo.server import create_app
from stilo.server.storage import BadRequest, FolderStorage


@pytest.fixture
def root(tmp_path):
    """
    root/
      references/x.texl                      "root references"
      proj/package.texl
      proj/references/x.texl                 "proj references"
      proj/references/own/package.texl       a reference with its own home
      proj/references/own/references/x.texl  "own references"
      proj/references/plain/plain.texl       a reference without one
      proj/docs/sub/a.texl
    """
    files = {
        "references/x.texl": "root references",
        "proj/package.texl": "<% package_name = \"proj\" %>",
        "proj/references/x.texl": "proj references",
        "proj/references/own/package.texl": "",
        "proj/references/own/references/x.texl": "own references",
        "proj/references/plain/plain.texl": "plain",
        "proj/docs/sub/a.texl": "a",
    }
    for path, text in files.items():
        (tmp_path / path).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / path).write_text(text)
    return tmp_path


@pytest.fixture
def storage(root):
    return FolderStorage(root)


@pytest.fixture
def client(root):
    return TestClient(create_app(root))


@pytest.mark.parametrize("path, expanded", [
    ("proj/docs/sub/~/references/x.texl", "proj/references/x.texl"),          # nearest manifest above
    ("proj/~/references/x.texl", "proj/references/x.texl"),                   # in the folder itself
    ("~/references/x.texl", "references/x.texl"),                             # no manifest: the root
    ("other/~/references/x.texl", "references/x.texl"),
    ("proj/docs/~/references/plain/~/references/x.texl", "proj/references/x.texl"),  # library without a home
    ("proj/docs/~/references/own/~/references/x.texl", "proj/references/own/references/x.texl"),  # with its own
    ("proj/docs/a.texl", "proj/docs/a.texl"),                   # no ~: unchanged
])
def test_expand_home(storage, path, expanded):
    assert storage.expand_home(path) == expanded


def test_expand_home_refuses_bad_segments(storage):
    with pytest.raises(BadRequest):
        storage.expand_home("../~/references/x.texl")


def test_get_by_public_url(client):
    assert client.get("/proj/docs/sub/~/references/x.texl").text == "proj references"
    assert client.get("/proj/docs/~/references/own/~/references/x.texl").text == "own references"


def test_get_by_protocol(client):
    response = client.get("/_api/files/proj/docs/sub/~/references/x.texl")
    assert response.status_code == 200
    assert response.text == "proj references"


def test_missing_library_is_not_found(client):
    assert client.get("/proj/docs/~/references/none/none.texl").status_code == 404


def test_tilde_is_not_a_name(client):
    assert client.post("/_api/files/proj/~/new.texl", content="x").status_code == 400
    assert client.put("/_api/files/proj/~/references/x.texl", content="x").status_code == 400
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
    path = "proj/docs/" + "~/references/plain/" * 17 + "plain.texl"
    assert client.get("/" + path).status_code == 400
    path = "proj/docs/" + "~/references/plain/" * 16 + "plain.texl"
    assert client.get("/" + path).text == "plain"


def test_a_read_through_home_redirects_to_the_real_path(client):
    response = client.get("/proj/docs/sub/~/references/x.texl?v=1", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/proj/references/x.texl?v=1"
    response = client.get("/_api/files/proj/docs/~/references/own/~/references/x.texl", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/_api/files/proj/references/own/references/x.texl"


def test_the_redirect_is_percent_encoded(root, client):
    (root / "proj" / "references" / "my lib.texl").write_text("spaced")
    response = client.get("/proj/docs/~/references/my%20lib.texl", follow_redirects=False)
    assert response.headers["location"] == "/proj/references/my%20lib.texl"
    assert client.get("/proj/docs/~/references/my%20lib.texl").text == "spaced"


def test_a_browser_page_through_home_redirects_too(client):
    response = client.get("/proj/docs/~/references/x.texl", headers={"Accept": "text/html"},
                          follow_redirects=False)
    assert response.headers["location"] == "/proj/references/x.texl"
