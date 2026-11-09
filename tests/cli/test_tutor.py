"""`stilo tutor` (DECISIONS.md S14): the working copy, reset, the version
check, and serving the copy."""

import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest

from stilo.cli import main
from stilo.cli import tutor as tutor_module
from stilo.cli.tutor import TUTORIAL, copy_version, default_folder, is_copy, is_older, prepare


@pytest.fixture
def served(monkeypatch):
    """Runs `stilo tutor` without serving: the folder it would serve, or None."""
    calls = []
    monkeypatch.setattr(tutor_module, "run_server",
                        lambda folder, host, port, web, open_url: calls.append((folder, port, open_url)))
    return calls


def test_default_folder_is_in_the_user_data_folder():
    assert default_folder().name == "tutorial"
    assert default_folder().parent.name == "stilo"


def test_tutor_makes_a_project_copy(tmp_path, served, capsys):
    folder = tmp_path / "copy"
    assert main(["tutor", "--dir", str(folder), "--no-browser", "--port", "8123"]) == 0
    assert (folder / "index.texl").read_text() == (TUTORIAL / "index.texl").read_text()
    assert (folder / "lib" / "stilo" / "index.texl").is_file()  # as stilo init
    assert (folder / "lib" / "tutorial" / "index.texl").is_file()
    manifest = (folder / "project.texl").read_text()
    assert 'project_name = "Stilo tutorial"' in manifest
    assert f'tutorial_folder = "{folder}"' in manifest
    assert is_copy(folder)
    assert served == [(folder, 8123, None)]
    assert "a new copy" in capsys.readouterr().out


def test_tutor_opens_the_index_in_the_browser(tmp_path, served, capsys):
    assert main(["tutor", "--dir", str(tmp_path / "copy")]) == 0
    assert served[0][2] == "http://127.0.0.1:8000/index.texl"


def test_tutor_reuses_a_copy(tmp_path, served, capsys):
    folder = tmp_path / "copy"
    main(["tutor", "--dir", str(folder), "--no-browser"])
    (folder / "01-welcome.texl").write_text("my progress")
    assert main(["tutor", "--dir", str(folder), "--no-browser"]) == 0
    assert (folder / "01-welcome.texl").read_text() == "my progress"
    out = capsys.readouterr().out
    assert "your copy of the tutorial is in" in out
    assert "--reset" not in out  # same version


def test_reset_moves_the_old_copy_aside(tmp_path, served, capsys):
    folder = tmp_path / "copy"
    main(["tutor", "--dir", str(folder), "--no-browser"])
    (folder / "01-welcome.texl").write_text("my progress")
    assert main(["tutor", "--dir", str(folder), "--no-browser", "--reset"]) == 0
    assert (folder / "01-welcome.texl").read_text() == (TUTORIAL / "01-welcome.texl").read_text()
    [old] = [path for path in tmp_path.iterdir() if path.name.startswith("copy-old-")]
    assert (old / "01-welcome.texl").read_text() == "my progress"
    assert str(old) in capsys.readouterr().out
    # A second reset in the same second finds another name
    assert main(["tutor", "--dir", str(folder), "--no-browser", "--reset"]) == 0
    assert len([path for path in tmp_path.iterdir() if path.name.startswith("copy-old-")]) == 2


def test_tutor_uses_an_empty_folder(tmp_path, served, capsys):
    assert main(["tutor", "--dir", str(tmp_path), "--no-browser"]) == 0
    assert is_copy(tmp_path)


@pytest.mark.parametrize("reset", [False, True])
def test_tutor_refuses_another_folder(tmp_path, served, capsys, reset):
    (tmp_path / "mine.texl").write_text("mine")
    argv = ["tutor", "--dir", str(tmp_path), "--no-browser"] + (["--reset"] if reset else [])
    assert main(argv) == 1
    assert "not a copy of the tutorial" in capsys.readouterr().err
    assert [path.name for path in tmp_path.iterdir()] == ["mine.texl"]
    assert served == []


def test_tutor_refuses_a_file(tmp_path, served, capsys):
    (tmp_path / "file").write_text("x")
    assert main(["tutor", "--dir", str(tmp_path / "file"), "--no-browser"]) == 1
    assert "not a folder" in capsys.readouterr().err


def test_an_older_copy_proposes_reset(tmp_path, served, capsys, monkeypatch):
    folder = tmp_path / "copy"
    main(["tutor", "--dir", str(folder), "--no-browser"])
    manifest = folder / "project.texl"
    version = copy_version(folder)
    manifest.write_text(manifest.read_text().replace(f'"{version}"', '"0.1.0"'))
    (folder / "01-welcome.texl").write_text("my progress")
    monkeypatch.setattr(tutor_module, "stilo_version", lambda: "0.4.0")
    assert main(["tutor", "--dir", str(folder), "--no-browser"]) == 0
    out = capsys.readouterr().out
    assert "Stilo 0.1.0" in out and "stilo tutor --reset" in out
    assert (folder / "01-welcome.texl").read_text() == "my progress"  # never overwritten
    assert served


@pytest.mark.parametrize("version, installed, older", [
    ("0.3.0", "0.3.0", False),
    ("0.3.0", "0.3.1", True),
    ("0.3.0", "0.10.0", True),
    ("0.4.0", "0.3.9", False),
    ("0.3.0rc1", "0.3.0", False),
    (None, "0.3.0", True),
])
def test_is_older(version, installed, older):
    assert is_older(version, installed) == older


def test_prepare_reports_errors_without_raising(tmp_path, monkeypatch):
    def fail(folder):
        raise PermissionError("denied")
    monkeypatch.setattr(tutor_module, "create_copy", fail)
    out, err = [], []

    class Sink:
        def __init__(self, lines):
            self.write = lines.append
    assert not prepare(tmp_path / "copy", False, out=Sink(out), err=Sink(err))
    assert "denied" in "".join(err)


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_tutor_serves_the_index(tmp_path):
    """The real command, in its own process: it serves the copy's index."""
    port = free_port()
    process = subprocess.Popen(
        [sys.executable, "-m", "stilo", "tutor", "--dir", str(tmp_path / "copy"),
         "--no-browser", "--port", str(port)],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        deadline = time.monotonic() + 30
        while True:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/index.texl") as response:
                    body = response.read().decode("utf-8")
                break
            except OSError:
                assert process.poll() is None, process.stdout.read()
                assert time.monotonic() < deadline, "the server did not start"
                time.sleep(0.2)
        assert body == (TUTORIAL / "index.texl").read_text(encoding="utf-8")
    finally:
        process.terminate()
        output, _ = process.communicate(timeout=10)
    assert "a new copy of the tutorial is in" in output
    assert f"http://127.0.0.1:{port}/index.texl" in output
