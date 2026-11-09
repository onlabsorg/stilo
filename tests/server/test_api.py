import pytest
from fastapi.testclient import TestClient

from stilo.server import create_app
from stilo.server.storage import etag

DOC = "<!--{ bek4 : markdown }-->\n# Title\n"


@pytest.fixture
def root(tmp_path):
    (tmp_path / "projects" / "beam").mkdir(parents=True)
    (tmp_path / "projects" / "beam" / "check.texl").write_text(DOC)
    (tmp_path / "projects" / "beam" / "notes.txt").write_text("notes")
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
    assert client.get("/_api/files/projects/beam/notes.txt").text == "notes"


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


def test_create_any_file(client, root):
    data = bytes(range(256))
    response = client.post("/_api/files/projects/photo.png", content=data)
    assert response.status_code == 201
    assert (root / "projects" / "photo.png").read_bytes() == data


@pytest.mark.parametrize("path", ["projects", "projects/beam"])
def test_create_refuses_a_folder(client, path):
    assert client.post(f"/_api/files/{path}", content="x").status_code == 409


@pytest.mark.parametrize("path", ["", ".hidden.png", "_app/x.png", "a/~/x.png"])
def test_create_refuses_bad_paths(client, path):
    assert client.post(f"/_api/files/{path}", content="x").status_code == 400


def test_create_refuses_a_file_in_the_way(client):
    assert client.post("/_api/files/library/steel.texl/x.png", content="x").status_code == 409


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


def test_update_only_documents(client, root):
    response = client.put("/_api/files/projects/beam/notes.txt", content="new")
    assert response.status_code == 400
    assert (root / "projects" / "beam" / "notes.txt").read_text() == "notes"


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
    # Every file; hidden folders skipped.
    assert [c["name"] for c in beam["children"]] == ["check.texl", "notes.txt"]
    assert [c["type"] for c in beam["children"]] == ["file", "file"]


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


@pytest.mark.parametrize("name, media_type", [
    ("photo.png", "image/png"),
    ("photo.webp", "image/webp"),
    ("report.pdf", "application/pdf"),
    ("data.csv", "text/csv; charset=utf-8"),
    ("blob.unknownext", "application/octet-stream"),
    ("no-extension", "application/octet-stream"),
    ("page.xhtml", "application/octet-stream"),  # not in the table: downloads, never runs
    ("archive.tar.gz", "application/octet-stream"),
])
@pytest.mark.parametrize("headers", [HTML, {"Accept": "*/*"}])
def test_public_url_serves_other_files_as_themselves(client, root, name, media_type, headers):
    (root / "library" / name).write_bytes(b"content")
    response = client.get(f"/library/{name}", headers=headers)
    assert response.status_code == 200
    assert response.content == b"content"
    assert response.headers["content-type"] == media_type
    assert response.headers["etag"] == etag(b"content")
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "content-security-policy" not in response.headers


@pytest.mark.parametrize("name", ["page.html", "page.htm", "picture.svg", "data.xml", "style.xsl"])
def test_public_url_sandboxes_files_that_can_run_scripts(client, root, name):
    (root / "library" / name).write_text("<script>alert(1)</script>")
    response = client.get(f"/library/{name}", headers=HTML)
    assert response.headers["content-security-policy"] == "sandbox"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_public_url_head_of_another_file(client, root):
    (root / "library" / "report.pdf").write_bytes(b"content")
    response = client.head("/library/report.pdf", headers=HTML)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content == b""


def test_public_url_of_a_refused_path_serves_no_file(client, root):
    (root / "projects" / ".hidden" / "secret.pdf").write_bytes(b"secret")
    (root / "library" / "outside.pdf").symlink_to(root.parent / "outside.pdf")
    (root.parent / "outside.pdf").write_bytes(b"secret")
    for path in ("/projects/.hidden/secret.pdf", "/library/outside.pdf"):
        assert b"secret" not in client.get(path, headers=HTML).content
        assert client.get(path).status_code == 400


def test_public_url_of_a_missing_file(client):
    assert "not built" in client.get("/library/nope.pdf", headers=HTML).text
    assert client.get("/library/nope.pdf").status_code == 404


def test_api_serves_other_files_as_plain_text(client, root):
    (root / "library" / "page.html").write_text("<script>alert(1)</script>")
    response = client.get("/_api/files/library/page.html")
    assert response.headers["content-type"] == "text/plain; charset=utf-8"


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


def test_rename_other_file(client, root):
    assert move(client, "projects/beam/notes.txt", "library/notes.md").status_code == 200
    assert (root / "library" / "notes.md").read_text() == "notes"


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
    ("projects/beam/notes.txt", "library/n.texl"),  # becomes a document
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


def test_delete_other_file(client, root):
    assert client.delete("/_api/files/projects/beam/notes.txt").status_code == 204
    assert trashed(root) == ["projects/beam/notes.txt"]


@pytest.mark.parametrize("path", ["library", "", ".trash/x.texl"])
def test_delete_document_refuses(client, path):
    assert client.delete(f"/_api/files/{path}").status_code == 400


def test_delete_folder_takes_everything(client, root):
    (root / "projects" / "beam" / "sub" / "empty").mkdir(parents=True)
    (root / "projects" / "beam" / "sub" / "deep.texl").write_text("deep")
    (root / "projects" / "beam" / ".gitkeep").write_text("")
    response = client.delete("/_api/tree/projects")
    assert response.status_code == 200
    assert response.json() == {"deleted": 4}
    assert not (root / "projects").exists()
    assert trashed(root) == ["projects/beam/.gitkeep", "projects/beam/check.texl",
                             "projects/beam/notes.txt", "projects/beam/sub/deep.texl"]


def test_delete_folder_without_files_makes_no_trash(client, root):
    (root / "empty" / "inner").mkdir(parents=True)
    assert client.delete("/_api/tree/empty").json() == {"deleted": 0}
    assert not (root / "empty").exists()
    assert not (root / ".trash").exists()


def test_delete_folder_does_not_follow_links(client, root):
    (root / "links").mkdir()
    (root / "links" / "to-library").symlink_to(root / "library")
    assert client.delete("/_api/tree/links/to-library").status_code == 400
    assert client.delete("/_api/tree/links").json() == {"deleted": 1}
    assert not (root / "links").exists()
    assert (root / "library" / "steel.texl").is_file()


def test_delete_folder_missing(client):
    assert client.delete("/_api/tree/none").status_code == 404


@pytest.mark.parametrize("path", ["", "library/steel.texl", ".trash"])
def test_delete_folder_refuses(client, path):
    assert client.delete(f"/_api/tree/{path}").status_code == 400


def test_trash_is_out_of_reach(client, root):
    client.delete("/_api/files/library/steel.texl")
    assert client.get("/_api/tree/.trash").status_code == 400
    assert all(child["name"] != ".trash" for child in client.get("/_api/tree/").json()["children"])
