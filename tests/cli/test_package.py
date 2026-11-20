"""`stilo init` and `~` in `stilo render` (DECISIONS.md S10, S24)."""

import shutil
import subprocess
import zipfile
from pathlib import Path

import pytest

from stilo.cli import main
from stilo.cli import package as package_module
from stilo.cli.package import TEXL_LIB, resolve_file

IMPORT = '<% texl.import "~/references/stilo.texlz/index.texl" ~> (lib -> bind "stilo" lib.data.stilo) %>'


@pytest.fixture
def home(tmp_path, monkeypatch):
    """A user's home directory, in the temporary folder."""
    user = tmp_path / "home"
    user.mkdir()
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: user))
    return user


def test_bundled_library_exists():
    assert (TEXL_LIB / "index.texl").is_file()
    assert (TEXL_LIB / "dataframe.texl").is_file()


def test_init(home, capsys):
    package = home / "beam"
    assert main(["init", str(package)]) == 0
    manifest = (package / "package.texl").read_text()
    assert 'package_name = "beam"' in manifest
    assert "stilo_version" in manifest
    # The library, packed (S24)
    assert not (package / "references" / "stilo").exists()
    with zipfile.ZipFile(package / "references" / "stilo.texlz") as library:
        for name in ("package.texl", "index.texl", "dataframe.texl", "charts.texl"):
            assert library.read(name) == (TEXL_LIB / name).read_bytes()


def test_init_name_cannot_break_the_manifest(home, capsys):
    assert main(["init", str(home / "p"), "--name", 'A "quoted" %> name']) == 0
    assert 'package_name = "A quoted  name"' in (home / "p" / "package.texl").read_text()
    assert main(["render", "--strict", str(home / "p" / "package.texl")]) == 0


def test_init_adds_the_library_to_an_existing_package(home, capsys):
    """A package made before S24, with the library as a folder: init adds
    stilo.texlz, and leaves package.texl and the old folder as they are."""
    (home / "package.texl").write_text("mine")
    (home / "references" / "stilo").mkdir(parents=True)
    (home / "references" / "stilo" / "index.texl").write_text("old copy")
    assert main(["init", str(home), "--name", "other"]) == 0
    out = capsys.readouterr().out
    assert "added references/stilo.texlz" in out
    assert "--name ignored" in out
    assert "change ~/references/stilo/ to ~/references/stilo.texlz/" in out
    assert (home / "package.texl").read_text() == "mine"
    assert (home / "references" / "stilo" / "index.texl").read_text() == "old copy"
    with zipfile.ZipFile(home / "references" / "stilo.texlz") as library:
        assert library.read("index.texl") == (TEXL_LIB / "index.texl").read_bytes()


def test_init_in_a_complete_package_does_nothing(home, capsys):
    assert main(["init", str(home)]) == 0
    library = (home / "references" / "stilo.texlz").read_bytes()
    manifest = (home / "package.texl").read_text()
    capsys.readouterr()
    assert main(["init", str(home)]) == 0
    assert "nothing to do" in capsys.readouterr().out
    assert (home / "references" / "stilo.texlz").read_bytes() == library
    assert (home / "package.texl").read_text() == manifest


def test_init_keeps_an_existing_library(home, capsys):
    (home / "references").mkdir()
    (home / "references" / "stilo.texlz").write_bytes(b"my copy")
    assert main(["init", str(home)]) == 0
    assert (home / "references" / "stilo.texlz").read_bytes() == b"my copy"
    assert "references/stilo.texlz already exists: left as it is" in capsys.readouterr().out


def test_the_library_is_packed_the_same_every_time(home):
    main(["init", str(home / "a")])
    main(["init", str(home / "b")])
    library = Path("references") / "stilo.texlz"
    assert (home / "a" / library).read_bytes() == (home / "b" / library).read_bytes()


@pytest.mark.skipif(shutil.which("git") is None, reason="git is not installed")
def test_the_library_is_packed_in_full_inside_a_git_ignored_folder(home, tmp_path, monkeypatch):
    """Stilo installed in a git-ignored virtual environment of a project:
    the project's rules do not apply to the library."""
    main(["init", str(home / "elsewhere")])
    project = tmp_path / "project"
    venv_lib = project / ".venv" / "site-packages" / "stilo" / "texl-lib"
    shutil.copytree(TEXL_LIB, venv_lib)
    subprocess.run(["git", "init", "-q"], cwd=project, check=True)
    (project / ".gitignore").write_text(".venv/\n")
    monkeypatch.setattr(package_module, "TEXL_LIB", venv_lib)
    main(["init", str(home / "here")])
    library = Path("references") / "stilo.texlz"
    assert (home / "here" / library).read_bytes() == (home / "elsewhere" / library).read_bytes()


def test_render_imports_the_library(home, capsys):
    main(["init", str(home / "p")])
    doc = home / "p" / "docs" / "deep" / "a.texl"
    doc.parent.mkdir(parents=True)
    doc.write_text(IMPORT + '\n<% stilo.dataframe {columns: ["a"], rows: [[42]]} %>\n')
    assert main(["render", "--strict", str(doc)]) == 0
    assert "| 42 |" in capsys.readouterr().out


def test_render_without_library_is_an_undefined_value(home, capsys):
    (home / "a.texl").write_text(IMPORT + '\n<% stilo.dataframe {columns: ["a"], rows: [[42]]} %>\n')
    assert main(["render", "--strict", str(home / "a.texl")]) == 1


def test_home_falls_back_to_the_user_home(home):
    doc = home / "docs" / "~" / "references" / "x.texl"
    assert resolve_file(doc.as_uri()) == home / "references" / "x.texl"


def test_home_falls_back_to_the_root_outside_the_user_home(home, tmp_path):
    outside = tmp_path / "elsewhere" / "~" / "references" / "x.texl"
    assert resolve_file(outside.as_uri()) == Path("/references/x.texl")


def test_nearest_manifest_and_several_homes(home):
    (home / "p" / "references" / "own").mkdir(parents=True)
    (home / "p" / "package.texl").write_text("")
    path = home / "p" / "docs" / "~" / "references" / "plain" / "~" / "references" / "x.texl"
    assert resolve_file(str(path)) == home / "p" / "references" / "x.texl"
    (home / "p" / "references" / "own" / "package.texl").write_text("")
    path = home / "p" / "docs" / "~" / "references" / "own" / "~" / "references" / "x.texl"
    assert resolve_file(str(path)) == home / "p" / "references" / "own" / "references" / "x.texl"


def test_a_library_importing_itself_through_home_ends(home, capsys):
    main(["init", str(home / "p")])
    loop = '<% texl.import "~/references/loop/index.texl" ~> (d -> d) %>'
    (home / "p" / "references" / "loop").mkdir()
    (home / "p" / "references" / "loop" / "index.texl").write_text(loop + "\n<% x = 1 %>\n")
    (home / "p" / "a.texl").write_text(loop + "\ndone\n")
    assert main(["render", str(home / "p" / "a.texl")]) == 0
    assert "done" in capsys.readouterr().out


def test_a_document_through_home_is_the_real_file(home, capsys):
    (home / "p" / "references").mkdir(parents=True)
    (home / "p" / "package.texl").write_text("")
    (home / "p" / "references" / "x.texl").write_text("x")
    doc = home / "p" / "docs" / "a.texl"
    doc.parent.mkdir()
    doc.write_text('<% texl.import "~/references/x.texl" ~> (d -> d.uri) %>\n')
    assert main(["render", str(doc)]) == 0
    assert (home / "p" / "references" / "x.texl").as_uri() in capsys.readouterr().out
