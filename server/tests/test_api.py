import pytest
from fastapi.testclient import TestClient

from stilo_server import create_app
from stilo_server.storage import etag

DOC = "<!--{ bek4 : markdown }-->\n# Title\n"


@pytest.fixture
def root(tmp_path):
    (tmp_path / "projects" / "beam").mkdir(parents=True)
    (tmp_path / "projects" / "beam" / "check.texl").write_text(DOC)
    (tmp_path / "projects" / "beam" / "notes.txt").write_text("not listed")
    (tmp_path / "projects" / ".hidden").mkdir()
    (tmp_path / "library").mkdir()
    (tmp_path / "library" / "steel.texl").write_text("steel")
    return tmp_path


@pytest.fixture
def client(root):
    return TestClient(create_app(root))


# -- GET -----------------------------------------------------------------------

def test_get_file(client):
    response = client.get("/_api/files/projects/beam/check.texl")
    assert response.status_code == 200
    assert response.text == DOC
    assert response.headers["etag"] == etag(DOC.encode())
    assert response.headers["content-type"].startswith("text/plain")
    assert response.headers["cache-control"] == "no-cache"


def test_get_any_file(client):
    assert client.get("/_api/files/projects/beam/notes.txt").text == "not listed"


def test_get_missing(client):
    response = client.get("/_api/files/projects/nope.texl")
    assert response.status_code == 404
    assert "error" in response.json()


def test_get_folder_is_bad_request(client):
    assert client.get("/_api/files/projects").status_code == 400


@pytest.mark.parametrize("path", ["projects/.hidden/x.texl", "_api/x.texl", "projects//x.texl"])
def test_invalid_paths(client, path):
    assert client.get(f"/_api/files/{path}").status_code == 400


def test_traversal_refused(client):
    # Encoded so the HTTP client does not normalise the dots away.
    assert client.get("/_api/files/projects/%2E%2E/%2E%2E/etc/passwd").status_code in (400, 404)


def test_symlink_outside_root_refused(client, root, tmp_path_factory):
    outside = tmp_path_factory.mktemp("outside")
    (outside / "secret.texl").write_text("secret")
    (root / "link").symlink_to(outside)
    assert client.get("/_api/files/link/secret.texl").status_code == 400


# -- CREATE --------------------------------------------------------------------

def test_create(client, root):
    response = client.post("/_api/files/new/sub/doc.texl", content="hello")
    assert response.status_code == 201
    assert response.headers["location"] == "/_api/files/new/sub/doc.texl"
    assert response.headers["etag"] == etag(b"hello")
    assert (root / "new" / "sub" / "doc.texl").read_text() == "hello"


def test_create_existing_conflicts(client, root):
    response = client.post("/_api/files/projects/beam/check.texl", content="x")
    assert response.status_code == 409
    assert (root / "projects" / "beam" / "check.texl").read_text() == DOC


def test_create_only_texl(client):
    assert client.post("/_api/files/projects/evil.py", content="x").status_code == 400


# -- UPDATE --------------------------------------------------------------------

def test_update_with_matching_etag(client, root):
    tag = client.get("/_api/files/projects/beam/check.texl").headers["etag"]
    response = client.put("/_api/files/projects/beam/check.texl", content="new",
                          headers={"If-Match": tag})
    assert response.status_code == 200
    assert response.headers["etag"] == etag(b"new")
    assert (root / "projects" / "beam" / "check.texl").read_text() == "new"


def test_update_with_stale_etag(client, root):
    response = client.put("/_api/files/projects/beam/check.texl", content="new",
                          headers={"If-Match": etag(b"something else")})
    assert response.status_code == 412
    assert (root / "projects" / "beam" / "check.texl").read_text() == DOC


def test_update_without_etag(client, root):
    assert client.put("/_api/files/projects/beam/check.texl", content="new").status_code == 200


def test_update_missing(client, root):
    assert client.put("/_api/files/projects/nope.texl", content="x").status_code == 404
    assert not (root / "projects" / "nope.texl").exists()


# -- QUERY tree ----------------------------------------------------------------

def test_tree_root(client):
    tree = client.get("/_api/tree/").json()
    assert tree["path"] == "" and tree["type"] == "folder"
    assert [c["name"] for c in tree["children"]] == ["library", "projects"]
    beam = tree["children"][1]["children"][0]
    assert beam["path"] == "projects/beam"
    # Only .texl files; hidden folders skipped.
    assert [c["name"] for c in beam["children"]] == ["check.texl"]
    assert beam["children"][0]["type"] == "file"


def test_tree_subfolder_and_depth(client):
    tree = client.get("/_api/tree/projects?depth=1").json()
    assert tree["name"] == "projects"
    assert tree["children"][0]["name"] == "beam"
    assert "children" not in tree["children"][0]


def test_tree_missing_and_file(client):
    assert client.get("/_api/tree/nope").status_code == 404
    assert client.get("/_api/tree/library/steel.texl").status_code == 400


# -- pages ---------------------------------------------------------------------

def test_unknown_api(client):
    assert client.get("/_api/nothing").status_code == 404


HTML = {"Accept": "text/html,application/xhtml+xml,*/*;q=0.8"}


def test_pages_without_build(client):
    response = client.get("/projects/beam", headers=HTML)
    assert response.status_code == 200
    assert "not built" in response.text


def test_pages_with_build(root, tmp_path_factory):
    dist = tmp_path_factory.mktemp("dist")
    (dist / "index.html").write_text("<html>app</html>")
    (dist / "assets").mkdir()
    (dist / "assets" / "main.js").write_text("console.log(1)")
    client = TestClient(create_app(root, dist))
    response = client.get("/projects/beam/check.texl", headers=HTML)
    assert response.text == "<html>app</html>"
    assert response.headers["vary"] == "Accept"
    assert client.get("/projects/beam", headers=HTML).text == "<html>app</html>"
    assert client.get("/_app/assets/main.js").text == "console.log(1)"


def test_public_url_serves_the_file_to_other_clients(client):
    # What texl.import does: fetch without asking for HTML.
    response = client.get("/library/steel.texl")
    assert response.status_code == 200
    assert response.text == "steel"
    assert response.headers["etag"] == etag(b"steel")
    assert response.headers["vary"] == "Accept"
    # Fetched again on every rendering: never served stale from the cache.
    assert response.headers["cache-control"] == "no-cache"
    assert client.get("/library/nope.texl").status_code == 404
