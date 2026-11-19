"""The storage interface: `create_app()` works with any object that has the
methods of `Storage`, and `StorageWrapper` lets a wrapper see every call."""

import pytest
from fastapi.testclient import TestClient

from stilo.server import create_app
from stilo.server.storage import (BadRequest, Conflict, FolderStorage, NotFound,
                                  PreconditionFailed, StorageWrapper, etag, is_document)

DOC = "<!--{ bek4 : markdown }-->\n# Title\n"


class MemoryStorage:
    """A storage of files in a dict, not a folder: no `~`, no trash. Only the
    methods of the interface."""

    def __init__(self, files: dict[str, bytes]):
        self.files = dict(files)
        self.folders = {"/".join(p.split("/")[:i]) for p in files for i in range(1, p.count("/") + 1)}

    @staticmethod
    def _check(path):
        if any(s in ("", ".", "..") or s.startswith(".") for s in path.split("/")):
            raise BadRequest(f"invalid path: {path!r}")

    def read(self, path):
        self._check(path)
        if path in self.folders:
            raise BadRequest(f"not a file: {path!r}")
        if path not in self.files:
            raise NotFound(f"no such file: {path!r}")
        return self.files[path], etag(self.files[path])

    def create(self, path, content):
        self._check(path)
        if path in self.files or path in self.folders:
            raise Conflict(f"already exists: {path!r}")
        self.files[path] = content
        return etag(content)

    def update(self, path, content, if_match=None):
        self.read(path)
        if if_match is not None and if_match != etag(self.files[path]):
            raise PreconditionFailed(f"changed since it was read: {path!r}")
        self.files[path] = content
        return etag(content)

    def delete_file(self, path):
        self.read(path)
        del self.files[path]

    def delete_folder(self, path):
        gone = [p for p in self.files if p.startswith(path + "/")]
        for p in gone:
            del self.files[p]
        self.folders = {f for f in self.folders if f != path and not f.startswith(path + "/")}
        return {"deleted": len(gone)}

    def move(self, path, to):
        self.files[to] = self.files.pop(path)
        return to

    def create_folder(self, path):
        self.folders.add(path)

    def tree(self, path, depth=None):
        return {"name": "", "path": "", "type": "folder",
                "children": [{"name": p, "path": p, "type": "file"} for p in sorted(self.files)]}

    def expand_home(self, path):
        return path.replace("~/", "")

    def read_target(self, path):
        path = self.expand_home(path).strip("/")
        return f"{path}/index.texl" if path in self.folders else path


@pytest.fixture
def memory():
    return MemoryStorage({"report.texl": DOC.encode(), "images/logo.svg": b"<svg/>"})


@pytest.fixture
def client(memory):
    return TestClient(create_app(memory))


def test_read_update_create_through_any_storage(client, memory):
    response = client.get("/_api/files/report.texl")
    assert response.text == DOC
    tag = response.headers["etag"]
    assert client.put("/_api/files/report.texl", content=b"new", headers={"If-Match": tag}).status_code == 200
    assert memory.files["report.texl"] == b"new"
    assert client.put("/_api/files/report.texl", content=b"x", headers={"If-Match": tag}).status_code == 412
    assert client.post("/_api/files/notes.texl", content=b"n").status_code == 201
    assert client.post("/_api/files/notes.texl", content=b"n").status_code == 409
    assert client.get("/_api/files/missing.texl").status_code == 404


def test_tree_move_delete_through_any_storage(client, memory):
    assert [c["path"] for c in client.get("/_api/tree/").json()["children"]] == ["images/logo.svg", "report.texl"]
    assert client.post("/_api/move/report.texl", json={"to": "final.texl"}).json() == {"path": "final.texl"}
    assert client.delete("/_api/files/final.texl").status_code == 204
    assert client.post("/_api/tree/empty").status_code == 201
    assert "empty" in memory.folders
    assert client.delete("/_api/tree/images").json() == {"deleted": 1}


def test_public_addresses_through_any_storage(client):
    other = client.get("/images/logo.svg", headers={"Accept": "text/html"})
    assert other.headers["content-type"] == "image/svg+xml"
    assert other.headers["content-security-policy"] == "sandbox"
    assert client.get("/report.texl").text == DOC
    page = client.get("/report.texl", headers={"Accept": "text/html"})
    assert "text/html" in page.headers["content-type"]
    # A folder, or a missing file, is not another file: browsers get the app
    assert "text/html" in client.get("/images", headers={"Accept": "text/html"}).headers["content-type"]
    assert "text/html" in client.get("/nothing.png", headers={"Accept": "text/html"}).headers["content-type"]


def test_home_redirect_uses_the_storage(client):
    response = client.get("/_api/files/docs/~/report.texl", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/_api/files/docs/report.texl"


def test_storage_errors_keep_their_status(client):
    assert client.get("/_api/files/.hidden").status_code == 400
    assert client.get("/_api/files/images?download").status_code == 400


class Recorder(StorageWrapper):
    """A wrapper that records every write after it is done."""

    def __init__(self, inner):
        super().__init__(inner)
        self.writes = []

    def create(self, path, content):
        tag = super().create(path, content)
        self.writes.append(("create", path))
        return tag

    def update(self, path, content, if_match=None):
        tag = super().update(path, content, if_match)
        self.writes.append(("update", path))
        return tag

    def move(self, path, to):
        new = super().move(path, to)
        self.writes.append(("move", path, new))
        return new

    def delete_file(self, path):
        super().delete_file(path)
        self.writes.append(("delete", path))


def test_wrapper_sees_every_write(tmp_path):
    (tmp_path / "a.texl").write_text(DOC)
    storage = Recorder(FolderStorage(tmp_path))
    client = TestClient(create_app(storage))
    tag = client.get("/_api/files/a.texl").headers["etag"]
    client.put("/_api/files/a.texl", content=b"new", headers={"If-Match": tag})
    client.post("/_api/files/b.texl", content=b"b")
    client.post("/_api/move/b.texl", json={"to": "c.texl"})
    client.delete("/_api/files/c.texl")
    # A refused write raises before the wrapper records it
    assert client.put("/_api/files/a.texl", content=b"x", headers={"If-Match": tag}).status_code == 412
    assert storage.writes == [("update", "a.texl"), ("create", "b.texl"),
                              ("move", "b.texl", "c.texl"), ("delete", "c.texl")]
    # Reads and the tree pass through untouched
    assert client.get("/_api/files/a.texl").text == "new"
    assert [c["name"] for c in client.get("/_api/tree/").json()["children"]] == ["a.texl"]


def test_wrapper_passes_other_attributes(tmp_path):
    folder = FolderStorage(tmp_path)
    wrapper = StorageWrapper(StorageWrapper(folder))
    assert wrapper.root == folder.root
    assert wrapper.read_only(folder.root) is None
    with pytest.raises(AttributeError):
        wrapper.nothing


def test_create_app_takes_a_path_or_a_string(tmp_path):
    (tmp_path / "a.texl").write_text(DOC)
    for root in (tmp_path, str(tmp_path)):
        app = create_app(root)
        assert isinstance(app.state.storage, FolderStorage)
        assert TestClient(app).get("/_api/files/a.texl").text == DOC


def test_is_document():
    assert is_document("a/b.texl")
    assert not is_document("a/b.texl.bak")
    assert not is_document("a/b.txt")
    assert not is_document("")
    assert not is_document("folder/")
