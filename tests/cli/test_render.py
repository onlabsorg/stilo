import io
import zipfile
from pathlib import Path

from stilo.cli import main
from stilo.server import pack_package

EXAMPLES = Path(__file__).resolve().parents[2] / "examples"


def test_render_resolves_relative_imports(capsys):
    assert main(["render", str(EXAMPLES / "packages/beam/beam-check.texl")]) == 0
    out = capsys.readouterr().out
    assert "IPE" in out
    assert "<%" not in out


def test_render_to_file(tmp_path):
    out = tmp_path / "out.md"
    assert main(["render", str(EXAMPLES / "library/steel.texl"), "-o", str(out)]) == 0
    assert out.read_text()


def test_render_missing_file(capsys):
    assert main(["render", "does-not-exist.texl"]) == 1
    err = capsys.readouterr().err
    assert "could not be loaded" in err
    assert "FileNotFoundError" in err  # says why


def test_render_examples_without_errors(capsys):
    """Every example document renders, and its imports resolve, with no
    undefined value."""
    for path in sorted(EXAMPLES.rglob("*.texl")):
        assert main(["render", "--strict", str(path)]) == 0, path
    assert "<%" not in capsys.readouterr().out


def test_the_beam_package_has_the_current_steel_reference():
    """examples/packages/beam/references/steel-revA.texlz is
    examples/packages/steel packed (S25). When the steel package changes,
    pack it again: `uv run stilo pack examples/packages/steel -o
    examples/packages/beam/references/steel-revA.texlz`. The entries are
    compared, not the bytes, which another zlib build could compress
    differently."""
    packed = EXAMPLES / "packages/beam/references/steel-revA.texlz"
    with zipfile.ZipFile(packed) as archive:
        entries = {info.filename: archive.read(info) for info in archive.infolist()}
    with zipfile.ZipFile(io.BytesIO(pack_package(EXAMPLES / "packages/steel"))) as archive:
        expected = {info.filename: archive.read(info) for info in archive.infolist()}
    assert entries == expected
