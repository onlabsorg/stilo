"""`stilo init` and `~` in `stilo render` (DECISIONS.md S10)."""

from pathlib import Path

import pytest

from stilo.cli import main
from stilo.cli.project import TEXL_LIB, resolve_file

IMPORT = '<% texl.import "~/lib/stilo/stilo.texl" ~> (lib -> bind "stilo" lib.data.stilo) %>'


@pytest.fixture
def home(tmp_path, monkeypatch):
    """A user's home directory, in the temporary folder."""
    user = tmp_path / "home"
    user.mkdir()
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: user))
    return user


def test_bundled_library_exists():
    assert (TEXL_LIB / "stilo.texl").is_file()


def test_init(home, capsys):
    project = home / "beam"
    assert main(["init", str(project)]) == 0
    manifest = (project / "project.texl").read_text()
    assert 'project_name = "beam"' in manifest
    assert "stilo_version" in manifest
    assert (project / "lib" / "stilo" / "stilo.texl").read_text() == (TEXL_LIB / "stilo.texl").read_text()


def test_init_name_cannot_break_the_manifest(home, capsys):
    assert main(["init", str(home / "p"), "--name", 'A "quoted" %> name']) == 0
    assert 'project_name = "A quoted  name"' in (home / "p" / "project.texl").read_text()
    assert main(["render", "--strict", str(home / "p" / "project.texl")]) == 0


def test_init_refuses_an_existing_project(home, capsys):
    (home / "project.texl").write_text("mine")
    assert main(["init", str(home)]) == 1
    assert "already a project" in capsys.readouterr().err
    assert (home / "project.texl").read_text() == "mine"


def test_init_keeps_an_existing_library(home, capsys):
    (home / "lib" / "stilo").mkdir(parents=True)
    (home / "lib" / "stilo" / "stilo.texl").write_text("my copy")
    assert main(["init", str(home)]) == 0
    assert (home / "lib" / "stilo" / "stilo.texl").read_text() == "my copy"
    assert "left as it is" in capsys.readouterr().out


def test_render_imports_the_library(home, capsys):
    main(["init", str(home / "p")])
    doc = home / "p" / "docs" / "deep" / "a.texl"
    doc.parent.mkdir(parents=True)
    doc.write_text(IMPORT + '\n<% stilo.greet "world" %>\n')
    assert main(["render", "--strict", str(doc)]) == 0
    assert "Hello, world!" in capsys.readouterr().out


def test_render_without_library_is_an_undefined_value(home, capsys):
    (home / "a.texl").write_text(IMPORT + '\n<% stilo.greet "world" %>\n')
    assert main(["render", "--strict", str(home / "a.texl")]) == 1


def test_home_falls_back_to_the_user_home(home):
    doc = home / "docs" / "~" / "lib" / "x.texl"
    assert resolve_file(doc.as_uri()) == home / "lib" / "x.texl"


def test_home_falls_back_to_the_root_outside_the_user_home(home, tmp_path):
    outside = tmp_path / "elsewhere" / "~" / "lib" / "x.texl"
    assert resolve_file(outside.as_uri()) == Path("/lib/x.texl")


def test_nearest_manifest_and_several_homes(home):
    (home / "p" / "lib" / "own").mkdir(parents=True)
    (home / "p" / "project.texl").write_text("")
    path = home / "p" / "docs" / "~" / "lib" / "plain" / "~" / "lib" / "x.texl"
    assert resolve_file(str(path)) == home / "p" / "lib" / "x.texl"
    (home / "p" / "lib" / "own" / "project.texl").write_text("")
    path = home / "p" / "docs" / "~" / "lib" / "own" / "~" / "lib" / "x.texl"
    assert resolve_file(str(path)) == home / "p" / "lib" / "own" / "lib" / "x.texl"


def test_a_library_importing_itself_through_home_ends(home, capsys):
    main(["init", str(home / "p")])
    (home / "p" / "lib" / "stilo" / "stilo.texl").write_text(IMPORT + "\n<% stilo = {} %>\n")
    (home / "p" / "a.texl").write_text(IMPORT + "\ndone\n")
    assert main(["render", str(home / "p" / "a.texl")]) == 0
    assert "done" in capsys.readouterr().out
