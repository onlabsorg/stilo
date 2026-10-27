from pathlib import Path

from stilo.cli import main

EXAMPLES = Path(__file__).resolve().parents[2] / "examples"


def test_render_resolves_relative_imports(capsys):
    assert main(["render", str(EXAMPLES / "projects/beam/beam-check.texl")]) == 0
    out = capsys.readouterr().out
    assert "IPE" in out
    assert "<%" not in out


def test_render_to_file(tmp_path):
    out = tmp_path / "out.md"
    assert main(["render", str(EXAMPLES / "library/steel.texl"), "-o", str(out)]) == 0
    assert out.read_text()


def test_render_missing_file(capsys):
    assert main(["render", "does-not-exist.texl"]) == 1
    assert "could not be loaded" in capsys.readouterr().err
