"""`stilo pack` and `pack_package` (S23): a deterministic `.texlz` of a
package folder; and `stilo render` reading inside packed packages."""

import hashlib
import io
import os
import shutil
import subprocess
import zipfile

import pytest

from stilo.cli import main
from stilo.server import ArchiveError, pack_package


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


@pytest.fixture
def package(tmp_path):
    folder = tmp_path / "lib"
    write(folder / "package.texl", '<% name = "lib" %>\n')
    write(folder / "index.texl", '<% texl.import "docs/data.texl" ~> (d -> bind "d" d.data) %>'
          '<% texl.import "~/package.texl" ~> (h -> bind "h" h.data) %>value <% d.x %> of <% h.name %>\n')
    write(folder / "docs/data.texl", "<% x = 42 %>\n")
    write(folder / "files/b.txt", "b")
    return folder


def names(content):
    return [info.filename for info in zipfile.ZipFile(io.BytesIO(content)).infolist()]


# -- pack_package ----------------------------------------------------------------

def test_the_same_files_give_the_same_bytes(package, tmp_path):
    first = pack_package(package)
    copy = tmp_path / "copy"
    shutil.copytree(package, copy)
    for path in copy.rglob("*"):
        os.utime(path, (1_000_000, 2_000_000))
        if path.is_file():
            path.chmod(0o600)
    assert pack_package(copy) == first
    assert hashlib.sha256(pack_package(package)).digest() == hashlib.sha256(first).digest()


def test_entries_are_sorted_with_fixed_dates_and_permissions(package):
    infos = zipfile.ZipFile(io.BytesIO(pack_package(package))).infolist()
    assert [i.filename for i in infos] == ["docs/data.texl", "files/b.txt", "index.texl", "package.texl"]
    for info in infos:
        assert info.date_time == (1980, 1, 1, 0, 0, 0)
        assert info.external_attr >> 16 == 0o100644
        assert info.compress_type == zipfile.ZIP_DEFLATED


def test_hidden_entries_and_links_are_left_out(package, tmp_path):
    write(package / ".git/config", "x")
    write(package / ".trash/2026/old.texl", "x")
    write(package / "docs/.notes", "x")
    write(tmp_path / "secret.txt", "secret")
    (package / "secret.txt").symlink_to(tmp_path / "secret.txt")
    (package / "docs-link").symlink_to(package / "docs")
    (package / "index-link.texl").symlink_to(package / "index.texl")
    assert names(pack_package(package)) == ["docs/data.texl", "files/b.txt", "index.texl", "package.texl"]


@pytest.mark.skipif(shutil.which("git") is None, reason="git is not installed")
def test_git_ignored_files_are_left_out(package):
    subprocess.run(["git", "init", "-q"], cwd=package, check=True)
    write(package / ".gitignore", "files/\n*.log\n")
    write(package / "docs/run.log", "x")
    assert names(pack_package(package)) == ["docs/data.texl", "index.texl", "package.texl"]


@pytest.mark.skipif(shutil.which("git") is None, reason="git is not installed")
def test_the_rules_of_the_repository_the_package_is_in_count(package):
    """A package in a subfolder of a repository: the repository's rules count,
    those above the package too (S23, amended)."""
    project = package.parent
    subprocess.run(["git", "init", "-q"], cwd=project, check=True)
    write(project / ".gitignore", "*.log\n")
    write(package / ".gitignore", "files/\n")
    write(package / "docs/run.log", "x")
    assert names(pack_package(package)) == ["docs/data.texl", "index.texl", "package.texl"]


@pytest.mark.skipif(shutil.which("git") is None, reason="git is not installed")
def test_a_repository_that_ignores_the_package_folder_does_not_count(package, tmp_path):
    """A package in a git-ignored folder of another repository: only the
    .gitignore files inside the package count."""
    project = tmp_path / "project"
    inside = project / "build" / "lib"
    shutil.move(package, inside)
    subprocess.run(["git", "init", "-q"], cwd=project, check=True)
    write(project / ".gitignore", "build/\n*.txt\n")
    write(inside / "docs/.gitignore", "*.log\n")
    write(inside / "docs/run.log", "x")
    assert names(pack_package(inside)) == ["docs/data.texl", "files/b.txt", "index.texl", "package.texl"]


@pytest.mark.skipif(shutil.which("git") is None, reason="git is not installed")
def test_a_gitignore_counts_outside_a_repository(package):
    write(package / ".gitignore", "files/\n")
    assert names(pack_package(package)) == ["docs/data.texl", "index.texl", "package.texl"]


@pytest.mark.skipif(shutil.which("git") is None, reason="git is not installed")
def test_gitignore_false_packs_ignored_files(package):
    write(package / ".gitignore", "files/\n")
    assert "files/b.txt" in names(pack_package(package, gitignore=False))


@pytest.mark.skipif(shutil.which("git") is None, reason="git is not installed")
def test_an_ignored_manifest_is_refused(package):
    write(package / ".gitignore", "*.texl\n")
    with pytest.raises(ArchiveError, match="package.texl would be left out"):
        pack_package(package)


def test_an_excluded_manifest_is_refused(package):
    with pytest.raises(ArchiveError, match="package.texl would be left out"):
        pack_package(package, exclude=[package / "package.texl"])


def test_a_folder_without_a_manifest_is_not_a_package(tmp_path):
    with pytest.raises(ArchiveError, match="not a package"):
        pack_package(tmp_path)


def test_packed_packages_inside_are_stored(package, tmp_path):
    inner = tmp_path / "inner"
    write(inner / "package.texl", "x")
    (package / "references").mkdir()
    (package / "references/inner.texlz").write_bytes(pack_package(inner))
    info = zipfile.ZipFile(io.BytesIO(pack_package(package))).getinfo("references/inner.texlz")
    assert info.compress_type == zipfile.ZIP_STORED


# -- stilo pack ------------------------------------------------------------------

def test_pack_writes_next_to_the_folder(package, capsys):
    assert main(["pack", str(package)]) == 0
    output = package.parent / "lib.texlz"
    assert output.read_bytes() == pack_package(package)
    out = capsys.readouterr().out
    assert "packed 4 files" in out
    assert hashlib.sha256(output.read_bytes()).hexdigest() in out


def test_pack_leaves_out_its_output_inside_the_folder(package):
    output = package / "lib.texlz"
    assert main(["pack", str(package), "-o", str(output)]) == 0
    assert main(["pack", str(package), "-o", str(output)]) == 0  # once more, over it
    assert "lib.texlz" not in names(output.read_bytes())


def test_pack_refuses_a_folder_that_is_not_a_package(tmp_path, capsys):
    assert main(["pack", str(tmp_path)]) == 1
    assert "not a package" in capsys.readouterr().err


# -- stilo render through packed packages ----------------------------------------

def test_render_reads_inside_a_packed_package(package, tmp_path, capsys):
    main_package = tmp_path / "main"
    write(main_package / "package.texl", '<% name = "main" %>\n')
    write(main_package / "docs/report.texl",
          '<% texl.import "~/references/lib.texlz/index.texl" ~> (l -> bind "l" l) %>Got: <% l.text %>')
    (main_package / "references").mkdir()
    (main_package / "references/lib.texlz").write_bytes(pack_package(package))
    capsys.readouterr()
    assert main(["render", "--strict", str(main_package / "docs/report.texl")]) == 0
    assert capsys.readouterr().out == "Got: value 42 of lib\n"
    # A document inside, rendered by its path through the archive
    assert main(["render", "--strict", str(main_package / "references/lib.texlz/index.texl")]) == 0
    assert capsys.readouterr().out == "value 42 of lib\n"


def test_render_reads_nested_packed_packages(package, tmp_path, capsys):
    inner = tmp_path / "inner"
    write(inner / "package.texl", '<% name = "inner" %>\n')
    write(inner / "index.texl", '<% texl.import "~/package.texl" ~> (h -> bind "h" h.data) %>in <% h.name %>')
    (package / "references").mkdir()
    (package / "references/inner.texlz").write_bytes(pack_package(inner))
    write(package / "uses.texl",
          '<% texl.import "~/references/inner.texlz/index.texl" ~> (i -> bind "i" i) %><% i.text %>')
    outer = tmp_path / "lib.texlz"
    outer.write_bytes(pack_package(package))
    capsys.readouterr()
    assert main(["render", "--strict", str(outer / "uses.texl")]) == 0
    assert capsys.readouterr().out == "in inner"


def test_render_reads_a_folder_or_an_archive_as_its_index(package, tmp_path, capsys):
    """S25: importing `x.texlz` or `folder/` imports its index.texl, whose
    relative imports resolve from inside it."""
    main_package = tmp_path / "main"
    write(main_package / "package.texl", "")
    (main_package / "references").mkdir()
    (main_package / "references/lib.texlz").write_bytes(pack_package(package))
    shutil.copytree(package, main_package / "references/plain")
    write(main_package / "a.texl", '<% texl.import "~/references/lib.texlz" ~> (l -> bind "l" l) %>'
          '<% texl.import "references/plain/" ~> (p -> bind "p" p) %><% l.text %>/<% p.text %>')
    capsys.readouterr()
    assert main(["render", "--strict", str(main_package / "a.texl")]) == 0
    assert capsys.readouterr().out == "value 42 of lib\n/value 42 of lib\n"
    # The document itself can be named by its folder
    assert main(["render", "--strict", str(main_package / "references/lib.texlz")]) == 0
    assert capsys.readouterr().out == "value 42 of lib\n"


def test_render_reports_a_missing_entry(package, tmp_path, capsys):
    archive = tmp_path / "lib.texlz"
    archive.write_bytes(pack_package(package))
    assert main(["render", str(archive / "nope.texl")]) == 1
    assert "no such file in the packed package" in capsys.readouterr().err
