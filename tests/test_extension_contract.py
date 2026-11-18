"""The contract of Stilo's Python side (S17, phase 5): two of the Validation
extensions of docs/extensions.md, written as they would be in packages of
their own, with the public API alone.

- **Version history** (3): a storage wrapper that keeps a copy of every
  document after each write, endpoints that list and read the versions, and
  a CLI command `history` that lists them.
- **Export to PDF** (7): an endpoint that turns the HTML the web app sends
  into a file to download, and a CLI command `pdf` that renders a document
  and does the same.

Everything Stilo-specific in this file comes from `stilo.server.__all__` and
`stilo.cli.__all__`, which `test_uses_the_public_api_alone` checks from the
file's own source. The one exception is test plumbing: `stilo.cli`'s
`entry_points` is replaced to stand for the two packages being installed.
A change that breaks one of these hooks breaks this test.
"""

import ast
import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from fastapi.testclient import TestClient

import stilo.cli
import stilo.server
from stilo.cli import Command, create_engine, main
from stilo.server import (NotFound, ServerExtension, Storage, StorageWrapper, create_app, etag,
                          get_storage, is_document)

# -- Version history (package "stilo-history") --------------------------------

HISTORY = ".history"  # hidden: never served, never in the tree


class History:
    """The versions of the documents of one folder, kept in `.history/`:
    `<path>/<n>` for the n-th version, from 1."""

    def __init__(self, root: Path):
        self.folder = Path(root) / HISTORY

    def record(self, path: str, content: bytes) -> int:
        versions = self.folder / path
        versions.mkdir(parents=True, exist_ok=True)
        number = len(list(versions.iterdir())) + 1
        (versions / str(number)).write_bytes(content)
        return number

    def versions(self, path: str) -> list[dict]:
        versions = self.folder / path
        if not versions.is_dir():
            return []
        return [{"version": int(v.name), "etag": etag(v.read_bytes())}
                for v in sorted(versions.iterdir(), key=lambda v: int(v.name))]

    def read(self, path: str, number: int) -> bytes:
        version = self.folder / path / str(number)
        if not version.is_file():
            raise NotFound(f"no version {number} of {path!r}")
        return version.read_bytes()


class HistoryStorage(StorageWrapper):
    """Records a version of a document after every write that succeeded."""

    def __init__(self, inner: Storage, history: History):
        super().__init__(inner)
        self.history = history

    def create(self, path, content):
        tag = super().create(path, content)
        if is_document(path):
            self.history.record(path, content)
        return tag

    def update(self, path, content, if_match=None):
        tag = super().update(path, content, if_match)
        self.history.record(path, content)
        return tag


def history_extension(root: Path) -> ServerExtension:
    history = History(root)
    router = APIRouter()

    @router.get("/versions/{path:path}")
    async def versions(path: str, storage: Storage = Depends(get_storage)):
        storage.read(path)  # 404 for a document that does not exist
        return {"path": path, "versions": history.versions(path)}

    @router.get("/version/{number}/{path:path}")
    async def version(number: int, path: str):
        return Response(history.read(path, number), media_type="text/plain; charset=utf-8")

    return ServerExtension("history", router=router,
                           wrap_storage=lambda storage: HistoryStorage(storage, history),
                           capabilities=["versions"], version="0.1.0")


def history_arguments(parser):
    parser.add_argument("folder", type=Path)
    parser.add_argument("document")


def history_run(args) -> int:
    for entry in History(args.folder).versions(args.document):
        print(entry["version"], entry["etag"])
    return 0


history_command = Command("history", "list the versions of a document", history_arguments, history_run)


# -- Export to PDF (package "stilo-pdf") ---------------------------------------

def to_pdf(html: str) -> bytes:
    """Stands for a real converter."""
    return b"%PDF-1.7\n" + html.encode()


pdf_router = APIRouter()


@pdf_router.post("/{path:path}")
async def export(path: str, request: Request, storage: Storage = Depends(get_storage)):
    """The web app posts the rendered HTML of the document at `path`; the
    server never runs a document itself."""
    storage.read(path)  # only documents that exist
    name = Path(path).with_suffix(".pdf").name
    return Response(to_pdf((await request.body()).decode()), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


pdf_extension = ServerExtension("pdf", router=pdf_router, version="0.1.0")


def pdf_arguments(parser):
    parser.add_argument("file", type=Path)
    parser.add_argument("-o", "--output", type=Path)


def pdf_run(args) -> int:
    doc = asyncio.run(create_engine().load(args.file.resolve().as_uri()))
    output = args.output or args.file.with_suffix(".pdf")
    output.write_bytes(to_pdf(doc.text))
    return 0


pdf_command = Command("pdf", "export a Texl document to PDF", pdf_arguments, pdf_run)


# -- The tests -----------------------------------------------------------------

DOC = "<!--{ bek4 : markdown }-->\n# Beam\n\nSpan: <% 2 * 3 %> m\n"


@pytest.fixture
def root(tmp_path):
    folder = tmp_path / "docs"
    folder.mkdir()
    (folder / "beam.texl").write_text(DOC)
    return folder


@pytest.fixture
def client(root):
    return TestClient(create_app(root, extensions=[history_extension(root), pdf_extension]))


@pytest.fixture
def installed(monkeypatch):
    """The two packages installed: their commands in `stilo.commands`."""
    points = [SimpleNamespace(name="history", dist=SimpleNamespace(name="stilo-history"),
                              load=lambda: history_command),
              SimpleNamespace(name="pdf", dist=SimpleNamespace(name="stilo-pdf"),
                              load=lambda: pdf_command)]
    monkeypatch.setattr(stilo.cli, "entry_points", lambda group: points)


def test_info_lists_both_extensions(client):
    assert client.get("/_api/info").json()["extensions"] == [
        {"id": "history", "capabilities": ["versions"], "version": "0.1.0"},
        {"id": "pdf", "capabilities": [], "version": "0.1.0"},
    ]


def test_history_records_every_save_and_serves_the_versions(client, root):
    tag = client.get("/_api/files/beam.texl").headers["etag"]
    first = client.put("/_api/files/beam.texl", content=b"one", headers={"If-Match": tag})
    client.put("/_api/files/beam.texl", content=b"two", headers={"If-Match": first.headers["etag"]})
    client.post("/_api/files/notes.texl", content=b"notes")
    client.post("/_api/files/logo.svg", content=b"<svg/>")  # not a document: no version
    # A refused save records nothing
    assert client.put("/_api/files/beam.texl", content=b"x", headers={"If-Match": tag}).status_code == 412

    versions = client.get("/_api/x/history/versions/beam.texl").json()["versions"]
    assert [v["version"] for v in versions] == [1, 2]
    assert client.get("/_api/x/history/version/1/beam.texl").text == "one"
    assert client.get("/_api/x/history/version/9/beam.texl").json() == {"error": "no version 9 of 'beam.texl'"}
    assert client.get("/_api/x/history/versions/missing.texl").status_code == 404
    assert [v["version"] for v in client.get("/_api/x/history/versions/notes.texl").json()["versions"]] == [1]
    assert not (root / HISTORY / "logo.svg").exists()
    # The history stays out of the protocol: hidden, as every dot name
    assert HISTORY not in [c["name"] for c in client.get("/_api/tree/").json()["children"]]
    assert client.get(f"/_api/files/{HISTORY}/beam.texl/1").status_code == 400


def test_pdf_endpoint_returns_a_file(client):
    response = client.post("/_api/x/pdf/beam.texl", content="<h1>Beam</h1>")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == 'attachment; filename="beam.pdf"'
    assert response.content == b"%PDF-1.7\n<h1>Beam</h1>"
    assert client.post("/_api/x/pdf/missing.texl", content="x").status_code == 404


def test_cli_commands_of_both_packages(installed, client, root, capsys):
    tag = client.get("/_api/files/beam.texl").headers["etag"]
    client.put("/_api/files/beam.texl", content=DOC.encode(), headers={"If-Match": tag})
    assert main(["history", str(root), "beam.texl"]) == 0
    assert capsys.readouterr().out == f"1 {etag(DOC.encode())}\n"

    assert main(["pdf", str(root / "beam.texl")]) == 0
    assert (root / "beam.pdf").read_bytes().startswith(b"%PDF-1.7\n")
    assert b"Span: 6 m" in (root / "beam.pdf").read_bytes()


def test_cli_help_lists_them(installed, capsys):
    with pytest.raises(SystemExit):
        main(["--help"])
    out = capsys.readouterr().out
    assert "list the versions of a document" in out
    assert "export a Texl document to PDF" in out


def test_uses_the_public_api_alone():
    public = {"stilo.server": set(stilo.server.__all__), "stilo.cli": set(stilo.cli.__all__)}
    tree = ast.parse(Path(__file__).read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.module.split(".")[0] == "stilo":
            assert node.module in public, f"imports from {node.module}"
            for alias in node.names:
                assert alias.name in public[node.module], f"{alias.name} is not public in {node.module}"
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.split(".")[0] == "stilo":
                    assert alias.name in public, f"imports {alias.name}"
        elif (isinstance(node, ast.Attribute) and isinstance(node.value, ast.Attribute)
              and isinstance(node.value.value, ast.Name) and node.value.value.id == "stilo"):
            module = f"stilo.{node.value.attr}"
            # stilo.cli.entry_points: the test plumbing named in the docstring
            allowed = public[module] | {"__all__"} | ({"entry_points"} if module == "stilo.cli" else set())
            assert node.attr in allowed, f"{module}.{node.attr} is not public"
