import pytest
from fastapi.testclient import TestClient

from stilo.server import create_app
from stilo.server.storage import etag

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


# -- CREATE a folder -----------------------------------------------------------

def test_create_folder(client, root):
    response = client.post("/_api/tree/projects/bridge")
    assert response.status_code == 201
    assert response.headers["location"] == "/_api/tree/projects/bridge"
    assert (root / "projects" / "bridge").is_dir()


def test_create_folder_makes_parents(client, root):
    assert client.post("/_api/tree/a/b/c").status_code == 201
    assert (root / "a" / "b" / "c").is_dir()


@pytest.mark.parametrize("path", ["library", "library/steel.texl"])
def test_create_folder_refuses_what_exists(client, path):
    assert client.post(f"/_api/tree/{path}").status_code == 409


def test_create_folder_refuses_a_file_in_the_way(client):
    assert client.post("/_api/tree/projects/beam/notes.txt/inner").status_code == 409


@pytest.mark.parametrize("path", ["new.texl", ".hidden", "_reserved", ""])
def test_create_folder_refuses_bad_names(client, path):
    assert client.post(f"/_api/tree/{path}").status_code == 400


# -- MOVE ----------------------------------------------------------------------

def move(client, path, to):
    return client.post(f"/_api/move/{path}", json={"to": to})


def test_rename_document(client, root):
    response = move(client, "library/steel.texl", "library/metal.texl")
    assert response.status_code == 200
    assert response.json() == {"path": "library/metal.texl"}
    assert (root / "library" / "metal.texl").read_text() == "steel"
    assert not (root / "library" / "steel.texl").exists()


def test_move_document_makes_parents(client, root):
    assert move(client, "library/steel.texl", "new/place/steel.texl").status_code == 200
    assert (root / "new" / "place" / "steel.texl").is_file()


def test_move_folder_takes_everything(client, root):
    assert move(client, "projects/beam", "library/beam").status_code == 200
    assert (root / "library" / "beam" / "check.texl").is_file()
    assert (root / "library" / "beam" / "notes.txt").is_file()
    assert not (root / "projects" / "beam").exists()


@pytest.mark.parametrize("to", ["library/steel.texl", "projects/beam/check.texl"])
def test_move_never_overwrites(client, root, to):
    (root / "library" / "other.texl").write_text("other")
    assert move(client, "library/other.texl", to).status_code == 409
    assert (root / "library" / "other.texl").read_text() == "other"


def test_move_folder_never_overwrites(client):
    assert move(client, "library", "projects").status_code == 409


def test_move_to_the_same_path_changes_nothing(client, root):
    assert move(client, "library", "library").status_code == 200
    assert move(client, "library/steel.texl", "library/steel.texl").status_code == 200
    assert (root / "library" / "steel.texl").is_file()


def test_move_missing(client):
    assert move(client, "library/none.texl", "library/x.texl").status_code == 404


@pytest.mark.parametrize("path, to", [
    ("projects", "projects/beam/inner"),            # inside itself
    ("library/steel.texl", "library/steel.txt"),    # no longer a document
    ("projects/beam/notes.txt", "library/n.texl"),  # not a document
    ("library", "library.texl"),                    # a folder named as a document
    ("library/steel.texl", ".trash/steel.texl"),    # hidden
    ("library/steel.texl", "_app/steel.texl"),      # reserved
    ("library/steel.texl", "../steel.texl"),        # outside the root
    ("library", ""),                                # the root
])
def test_move_refuses(client, path, to):
    assert move(client, path, to).status_code == 400


def test_move_refuses_the_root(client):
    assert client.post("/_api/move/", json={"to": "x"}).status_code == 400


@pytest.mark.parametrize("body", ["not json", "[]", '{"other": 1}', '{"to": 1}'])
def test_move_refuses_a_bad_body(client, body):
    assert client.post("/_api/move/library", content=body).status_code == 400


# -- DELETE --------------------------------------------------------------------

def trashed(root):
    """The paths in the trash, without the folder of each deletion."""
    trash = root / ".trash"
    if not trash.exists():
        return []
    return sorted(
        "/".join(file.relative_to(trash).parts[1:])
        for file in trash.rglob("*") if file.is_file()
    )


def test_delete_document_goes_to_the_trash(client, root):
    assert client.delete("/_api/files/library/steel.texl").status_code == 204
    assert not (root / "library" / "steel.texl").exists()
    assert trashed(root) == ["library/steel.texl"]


def test_delete_document_leaves_its_folder(client, root):
    client.delete("/_api/files/library/steel.texl")
    assert (root / "library").is_dir()
    tree = client.get("/_api/tree/library").json()
    assert tree["children"] == []


def test_delete_document_twice_keeps_both(client, root):
    client.delete("/_api/files/library/steel.texl")
    (root / "library" / "steel.texl").write_text("again")
    client.delete("/_api/files/library/steel.texl")
    assert trashed(root) == ["library/steel.texl", "library/steel.texl"]


def test_delete_document_missing(client):
    assert client.delete("/_api/files/library/none.texl").status_code == 404


@pytest.mark.parametrize("path", ["library", "projects/beam/notes.txt", "", ".trash/x.texl"])
def test_delete_document_refuses(client, path):
    assert client.delete(f"/_api/files/{path}").status_code == 400


def test_delete_folder_removes_it_when_nothing_is_left(client, root):
    (root / "library" / "sub" / "empty").mkdir(parents=True)
    (root / "library" / "sub" / "deep.texl").write_text("deep")
    response = client.delete("/_api/tree/library")
    assert response.status_code == 200
    assert response.json() == {"deleted": 2, "removed": True}
    assert not (root / "library").exists()
    assert trashed(root) == ["library/steel.texl", "library/sub/deep.texl"]


def test_delete_folder_keeps_other_files(client, root):
    response = client.delete("/_api/tree/projects/beam")
    assert response.json() == {"deleted": 1, "removed": False}
    assert (root / "projects" / "beam" / "notes.txt").is_file()
    assert not (root / "projects" / "beam" / "check.texl").exists()


def test_delete_folder_removes_only_the_subfolders_left_empty(client, root):
    response = client.delete("/_api/tree/projects")
    assert response.json() == {"deleted": 1, "removed": False}
    assert (root / "projects" / "beam" / "notes.txt").is_file()
    assert (root / "projects" / ".hidden").is_dir()


def test_delete_folder_without_documents_makes_no_trash(client, root):
    (root / "empty").mkdir()
    assert client.delete("/_api/tree/empty").json() == {"deleted": 0, "removed": True}
    assert not (root / ".trash").exists()


def test_delete_folder_does_not_follow_links(client, root):
    (root / "links").mkdir()
    (root / "links" / "to-library").symlink_to(root / "library")
    assert client.delete("/_api/tree/links").json() == {"deleted": 0, "removed": False}
    assert (root / "library" / "steel.texl").is_file()
    assert client.delete("/_api/tree/links/to-library").status_code == 400


def test_delete_folder_missing(client):
    assert client.delete("/_api/tree/none").status_code == 404


@pytest.mark.parametrize("path", ["", "library/steel.texl", ".trash"])
def test_delete_folder_refuses(client, path):
    assert client.delete(f"/_api/tree/{path}").status_code == 400


def test_trash_is_out_of_reach(client, root):
    client.delete("/_api/files/library/steel.texl")
    assert client.get("/_api/tree/.trash").status_code == 400
    assert all(child["name"] != ".trash" for child in client.get("/_api/tree/").json()["children"])
