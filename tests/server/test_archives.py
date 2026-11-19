"""Packed packages (`.texlz`, S23) in the server: read as read-only folders,
the archive file itself a file; `~` and nested archives; the cache; and the
safety checks on untrusted archives."""

import asyncio
import io
import os
import stat
import zipfile

import pytest
from fastapi.testclient import TestClient

import pytexl
from stilo.server import create_app, pack_package
from stilo.server import archive as archive_module
from stilo.server.archive import Archive, ArchiveError
from stilo.server.storage import IN_ARCHIVE, FolderStorage

INNER_INDEX = '<% texl.import "~/package.texl" ~> (h -> bind "h" h.data) %>inner of <% h.name %>\n'
LIB_INDEX = ('<% texl.import "docs/data.texl" ~> (d -> bind "d" d.data) %>'
             '<% texl.import "~/package.texl" ~> (h -> bind "h" h.data) %>'
             '<% texl.import "~/references/inner.texlz/" ~> (i -> bind "i" i) %>'
             'value <% d.x %> of <% h.name %>; <% i.text %>')
REPORT = ('<% texl.import "~/package.texl" ~> (p -> bind "p" p.data) %>'
          '<% texl.import "~/references/lib.texlz" ~> (l -> bind "l" l) %>'
          'Report of <% p.package_name %>: <% l.text %>')


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def zip_bytes(entries, *, mode=None):
    """A zip of `entries` ({name: text}), written as given (for bad ones)."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            info = zipfile.ZipInfo(name)
            if mode is not None:
                info.create_system = 3
                info.external_attr = mode << 16
            archive.writestr(info, content)
    return buffer.getvalue()


@pytest.fixture
def root(tmp_path):
    """main/ is a package whose reference lib.texlz carries its own
    reference, inner.texlz: a packed package nested in another."""
    sources = tmp_path / "sources"
    write(sources / "inner/package.texl", '<% name = "inner" %>\n')
    write(sources / "inner/index.texl", INNER_INDEX)
    write(sources / "lib/package.texl", '<% name = "lib" %>\n')
    write(sources / "lib/docs/data.texl", "<% x = 42 %>\n")
    write(sources / "lib/index.texl", LIB_INDEX)
    write(sources / "lib/img.svg", "<svg xmlns='http://www.w3.org/2000/svg'/>")
    (sources / "lib/references").mkdir()
    (sources / "lib/references/inner.texlz").write_bytes(pack_package(sources / "inner"))
    served = tmp_path / "served"
    write(served / "main/package.texl", '<% package_name = "main" %>\n')
    write(served / "main/docs/report.texl", REPORT)
    (served / "main/references").mkdir()
    (served / "main/references/lib.texlz").write_bytes(pack_package(sources / "lib"))
    return served


@pytest.fixture
def client(root):
    return TestClient(create_app(root))


LIB = "main/references/lib.texlz"


# -- reading -------------------------------------------------------------------

def test_reads_an_entry(client):
    for prefix in ("/_api/files/", "/"):
        response = client.get(f"{prefix}{LIB}/docs/data.texl")
        assert response.status_code == 200
        assert response.text == "<% x = 42 %>\n"


def test_reading_an_archive_leads_to_its_index(client):
    """S25: an archive reads as its index.texl, as a folder does."""
    for prefix in ("/_api/files/", "/"):
        response = client.get(f"{prefix}{LIB}", follow_redirects=False)
        assert response.headers["location"] == f"{prefix}{LIB}/index.texl"
    assert client.get(f"/{LIB}").text == LIB_INDEX
    nested = f"{LIB}/references/inner.texlz"
    assert client.get(f"/_api/files/{nested}").text == INNER_INDEX


def test_the_archive_file_is_a_download(client, root):
    content = (root / LIB).read_bytes()
    for prefix in ("/_api/files/", "/"):
        response = client.get(f"{prefix}{LIB}?download", headers={"Accept": "text/html"})
        assert response.content == content
        assert response.headers["content-type"] == "application/octet-stream"
        assert response.headers["content-disposition"].startswith('attachment; filename="lib.texlz"')
    # Through `~`, the query kept
    response = client.get(f"/main/docs/~/references/lib.texlz?download")
    assert response.content == content


def test_a_browser_asking_for_an_archive_gets_the_app(client):
    response = client.get(f"/{LIB}", headers={"Accept": "text/html"})
    assert response.headers["content-type"].startswith("text/html")


def test_other_files_inside_keep_their_type_and_sandbox(client):
    response = client.get(f"/{LIB}/img.svg", headers={"Accept": "text/html"})
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert response.headers["content-security-policy"] == "sandbox"


def test_missing_entries_and_folders(client):
    assert client.get(f"/_api/files/{LIB}/nope.texl").status_code == 404
    response = client.get(f"/_api/files/{LIB}/docs", follow_redirects=False)
    assert response.headers["location"] == f"/_api/files/{LIB}/docs/index.texl"
    assert client.get(f"/_api/files/{LIB}/docs").status_code == 404


def test_a_browser_gets_the_app_for_a_document_inside(client):
    response = client.get(f"/{LIB}/index.texl", headers={"Accept": "text/html"})
    assert response.headers["content-type"].startswith("text/html")


def test_info_lists_the_capability(client):
    assert "archives" in client.get("/_api/info").json()["capabilities"]


# -- the tree ------------------------------------------------------------------

def test_tree_shows_an_archive_as_a_read_only_folder(client, root):
    tree = client.get("/_api/tree/main/references").json()
    [lib] = tree["children"]
    assert lib["type"] == "folder" and lib["archive"] is True
    assert lib["path"] == LIB and lib["size"] == (root / LIB).stat().st_size
    assert "readOnly" not in lib  # the file itself can be moved and deleted
    names = [child["name"] for child in lib["children"]]
    assert names == ["docs", "references", "img.svg", "index.texl", "package.texl"]
    assert all(child["readOnly"] == IN_ARCHIVE for child in lib["children"])
    docs = lib["children"][0]
    assert docs["children"][0] == {
        "name": "data.texl", "path": f"{LIB}/docs/data.texl", "type": "file", "size": 13,
        "modified": lib["modified"], "readOnly": IN_ARCHIVE}


def test_tree_shows_nested_archives(client):
    tree = client.get(f"/_api/tree/{LIB}/references").json()
    [inner] = tree["children"]
    assert inner["archive"] is True and inner["readOnly"] == IN_ARCHIVE
    assert [c["name"] for c in inner["children"]] == ["index.texl", "package.texl"]


def test_tree_respects_depth(client):
    tree = client.get("/_api/tree/main?depth=2").json()
    references = next(c for c in tree["children"] if c["name"] == "references")
    [lib] = references["children"]
    assert lib["archive"] is True and "children" not in lib
    lib = client.get(f"/_api/tree/{LIB}?depth=1").json()
    assert lib["archive"] is True
    assert all("children" not in child for child in lib["children"])


def test_tree_of_paths_inside(client):
    assert client.get(f"/_api/tree/{LIB}").json()["archive"] is True
    docs = client.get(f"/_api/tree/{LIB}/docs").json()
    assert docs["readOnly"] == IN_ARCHIVE and docs["children"][0]["name"] == "data.texl"
    inner = client.get(f"/_api/tree/{LIB}/references/inner.texlz").json()
    assert inner["archive"] is True and inner["path"] == f"{LIB}/references/inner.texlz"
    assert client.get(f"/_api/tree/{LIB}/index.texl").status_code == 400
    assert client.get(f"/_api/tree/{LIB}/nope").status_code == 404


def test_a_file_that_is_not_a_packed_package_is_a_file(client, root):
    (root / "broken.texlz").write_bytes(b"not a zip")
    (root / "nomanifest.texlz").write_bytes(zip_bytes({"a.texl": "a"}))
    files = {c["name"]: c for c in client.get("/_api/tree/").json()["children"]}
    assert files["broken.texlz"]["type"] == "file"
    assert files["nomanifest.texlz"]["type"] == "file"
    response = client.get("/_api/files/broken.texlz/a.texl")
    assert response.status_code == 400 and "not a valid packed package" in response.json()["error"]
    assert "no package.texl" in client.get("/_api/files/nomanifest.texlz/a.texl").json()["error"]
    assert client.get("/_api/tree/broken.texlz").status_code == 400


# -- writing -------------------------------------------------------------------

@pytest.mark.parametrize("method, url, body", [
    ("post", f"/_api/files/{LIB}/new.texl", b""),
    ("post", f"/_api/files/{LIB}/docs/new/deep.texl", b""),
    ("put", f"/_api/files/{LIB}/index.texl", b"changed"),
    ("delete", f"/_api/files/{LIB}/index.texl", None),
    ("post", f"/_api/tree/{LIB}/folder", None),
    ("delete", f"/_api/tree/{LIB}/docs", None),
    ("post", f"/_api/move/{LIB}/index.texl", {"to": "main/index.texl"}),
    ("post", "/_api/move/main/docs/report.texl", {"to": f"{LIB}/report.texl"}),
    ("delete", f"/_api/tree/{LIB}/references/inner.texlz", None),
])
def test_writes_inside_are_forbidden(client, root, method, url, body):
    before = (root / LIB).read_bytes()
    kwargs = {"json": body} if isinstance(body, dict) else {"content": body} if body is not None else {}
    response = client.request(method.upper(), url, **kwargs)
    assert response.status_code == 403
    assert response.json()["error"] == f"{LIB} is a packed package: what is in it cannot be changed"
    assert (root / LIB).read_bytes() == before
    assert (root / "main/docs/report.texl").exists()


def test_the_archive_file_moves_and_renames(client, root):
    response = client.post(f"/_api/move/{LIB}", json={"to": "main/references/lib-revB.texlz"})
    assert response.status_code == 200
    assert (root / "main/references/lib-revB.texlz").is_file()
    assert client.get("/_api/files/main/references/lib-revB.texlz/docs/data.texl").status_code == 200


def test_an_archive_keeps_its_extension(client):
    response = client.post(f"/_api/move/{LIB}", json={"to": "main/references/lib.zip"})
    assert response.status_code == 400 and ".texlz" in response.json()["error"]
    client.post("/_api/files/main/notes.txt", content=b"x")
    assert client.post("/_api/move/main/notes.txt", json={"to": "main/notes.texlz"}).status_code == 400


def test_a_folder_cannot_be_named_like_an_archive(client):
    assert client.post("/_api/tree/main/x.texlz").status_code == 400
    assert client.post("/_api/move/main/docs", json={"to": "main/docs.texlz"}).status_code == 400


def test_the_archive_file_deletes_as_a_file(client, root):
    assert client.delete(f"/_api/files/{LIB}").status_code == 204
    assert not (root / LIB).exists()
    assert list((root / ".trash").glob(f"*/{LIB}"))


def test_deleting_an_archive_as_a_folder_deletes_the_file(client, root):
    response = client.delete(f"/_api/tree/{LIB}")
    assert response.status_code == 200 and response.json() == {"deleted": 5}
    assert not (root / LIB).exists()


def test_an_archive_can_be_uploaded(client, root):
    content = (root / LIB).read_bytes()
    assert client.post("/_api/files/copy.texlz", content=content).status_code == 201
    assert client.get("/_api/files/copy.texlz/docs/data.texl").text == "<% x = 42 %>\n"


# -- the package home ----------------------------------------------------------

def test_home_inside_an_archive_is_its_root(client):
    response = client.get(f"/_api/files/{LIB}/docs/~/package.texl", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == f"/_api/files/{LIB}/package.texl"


def test_imports_from_outside_reach_into_an_archive(client):
    response = client.get("/main/docs/~/references/lib.texlz/index.texl", follow_redirects=False)
    assert response.headers["location"] == f"/{LIB}/index.texl"


def test_home_in_a_nested_archive_is_its_root(client):
    nested = f"{LIB}/references/inner.texlz"
    response = client.get(f"/_api/files/{LIB}/references/~/references/inner.texlz/~/index.texl",
                          follow_redirects=False)
    assert response.headers["location"] == f"/_api/files/{nested}/index.texl"
    assert client.get(f"/_api/files/{nested}/index.texl").text == INNER_INDEX


def test_a_document_renders_through_the_server_as_on_the_command_line(client, root):
    """The server's answers (redirects followed, as a browser does) give
    the same rendering as the CLI's loader reading the files: relative
    imports, `~` and a nested archive all resolve inside."""
    def load(uri):
        response = client.get(uri)
        assert response.status_code == 200, uri
        return str(response.url), response.text

    engine = pytexl.Engine()
    engine.add_loader("http", load)
    served = asyncio.run(engine.load("http://testserver/main/docs/report.texl")).text
    from stilo.cli.package import create_engine
    local = asyncio.run(create_engine().load((root / "main/docs/report.texl").as_uri())).text
    assert served == local == "Report of main: value 42 of lib; inner of inner\n"


# -- the cache -----------------------------------------------------------------

def test_an_archive_is_opened_once_until_it_changes(root):
    storage = FolderStorage(root)
    first = storage.archives.open(root / LIB)
    assert storage.archives.open(root / LIB) is first
    stats = (root / LIB).stat()
    os.utime(root / LIB, ns=(stats.st_atime_ns, stats.st_mtime_ns + 1_000_000_000))
    assert storage.archives.open(root / LIB) is not first


def test_reading_does_not_reopen(root, monkeypatch):
    storage = FolderStorage(root)
    storage.read(f"{LIB}/index.texl")
    storage.tree(LIB)
    opened = []
    real = archive_module.Archive.__init__
    monkeypatch.setattr(archive_module.Archive, "__init__",
                        lambda self, *a, **k: (opened.append(a), real(self, *a, **k))[1])
    storage.read(f"{LIB}/docs/data.texl")
    storage.read(f"{LIB}/references/inner.texlz/index.texl")
    storage.tree(LIB)
    assert opened == []


# -- safety --------------------------------------------------------------------

MANIFEST = {"package.texl": "x"}


@pytest.mark.parametrize("name, problem", [
    ("/etc/passwd", "absolute path"),
    ("C:/x.texl", "absolute path"),
    ("a\\b.texl", "absolute path"),
    ("../up.texl", "invalid path"),
    ("a/../../up.texl", "invalid path"),
    ("a//b.texl", "invalid path"),
])
def test_refuses_bad_names(name, problem):
    with pytest.raises(ArchiveError, match=problem):
        Archive(zip_bytes({**MANIFEST, name: "x"}))


def test_refuses_links():
    data = zip_bytes({**MANIFEST, "link": "/etc/passwd"}, mode=stat.S_IFLNK | 0o777)
    with pytest.raises(ArchiveError, match="is a link"):
        Archive(data)


def test_refuses_duplicates():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("package.texl", "x")
        with pytest.warns(UserWarning):
            archive.writestr("package.texl", "y")
    with pytest.raises(ArchiveError, match="twice"):
        Archive(buffer.getvalue())


def test_refuses_a_file_that_is_also_a_folder():
    with pytest.raises(ArchiveError, match="both a file and a folder"):
        Archive(zip_bytes({**MANIFEST, "a": "x", "a/b.texl": "y"}))


def test_refuses_encrypted_entries():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("package.texl", "x")
    data = bytearray(buffer.getvalue())
    # Set the "encrypted" flag in the local header and the central directory
    data[6] |= 1
    central = data.rfind(b"PK\x01\x02")
    data[central + 8] |= 1
    with pytest.raises(ArchiveError, match="encrypted"):
        Archive(bytes(data))


def test_refuses_too_many_entries(monkeypatch):
    monkeypatch.setattr(archive_module, "MAX_ENTRIES", 3)
    Archive(zip_bytes({**MANIFEST, "a": "", "b": ""}))
    with pytest.raises(ArchiveError, match="more than 3 entries"):
        Archive(zip_bytes({**MANIFEST, "a": "", "b": "", "c": ""}))


def test_refuses_too_much_once_unpacked(monkeypatch):
    """A zip bomb: little to read, much once unpacked."""
    monkeypatch.setattr(archive_module, "MAX_UNPACKED", 1_000_000)
    with pytest.raises(ArchiveError, match="once unpacked"):
        Archive(zip_bytes({**MANIFEST, "bomb.txt": "0" * 2_000_000}))


def test_a_lying_size_is_not_believed():
    """An entry declaring less than it holds unpacks to no more than it
    declares, and fails its check."""
    data = bytearray(zip_bytes({**MANIFEST, "bomb.txt": "0" * 100_000}))
    central = data.rfind(b"PK\x01\x02", 0, data.rfind(b"bomb.txt"))
    data[central + 24:central + 28] = (10).to_bytes(4, "little")  # its unpacked size
    archive = Archive(bytes(data))
    with pytest.raises(ArchiveError, match="cannot be read"):
        archive.read("bomb.txt")


def test_refuses_deep_nesting(monkeypatch):
    monkeypatch.setattr(archive_module, "MAX_NESTING", 1)
    level2 = zip_bytes(MANIFEST)
    level1 = zip_bytes({**MANIFEST, "n.texlz": level2})
    level0 = Archive(zip_bytes({**MANIFEST, "n.texlz": level1}))
    level0.nested("n.texlz")
    with pytest.raises(ArchiveError, match="nested more than 1 deep"):
        level0.nested("n.texlz").nested("n.texlz")


def test_hidden_entries_are_left_out():
    archive = Archive(zip_bytes({**MANIFEST, ".git/config": "x", "a/.secret": "y", "~/x": "z"}))
    assert archive.kind(".git/config") is None and archive.kind("a/.secret") is None
    assert archive.kind("~/x") is None


def test_an_archive_linked_from_outside_the_root_is_not_opened(tmp_path, root):
    outside = tmp_path / "outside.texlz"
    outside.write_bytes((root / LIB).read_bytes())
    (root / "link.texlz").symlink_to(outside)
    storage = FolderStorage(root)
    with pytest.raises(Exception) as error:
        storage.read("link.texlz/index.texl")
    assert getattr(error.value, "status", None) == 400
