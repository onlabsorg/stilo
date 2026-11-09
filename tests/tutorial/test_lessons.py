"""The tutorial's documents (tutorial/, DECISIONS.md S14), in a fresh copy
made as `stilo tutor` makes it.

- Every document renders with `stilo render --strict`, except those that
  have errors on purpose: they bind `expected_errors`, and must have exactly
  that many.
- Each lesson, with the solutions of `solutions.json` applied, shows ✓ Done
  in every check, and the index counts them all.
"""

import asyncio
import json
import re
from pathlib import Path

import pytest

from stilo.cli import main
from stilo.cli.errors import count_returned, find_errors
from stilo.cli.project import create_engine
from stilo.cli.tutor import TUTORIAL, create_copy

SOLUTIONS = json.loads((Path(__file__).parent / "solutions.json").read_text(encoding="utf-8"))
DONE, NOT_YET = "✓ Done", "○ Not yet"

DOCUMENTS = sorted(str(path.relative_to(TUTORIAL)) for path in TUTORIAL.rglob("*.texl"))
LESSONS = sorted(path.name for path in TUTORIAL.glob("[0-9][0-9]-*.texl"))


@pytest.fixture
def copy(tmp_path, monkeypatch):
    folder = tmp_path / "tutorial"
    create_copy(folder)
    monkeypatch.chdir(folder)
    return folder


def load(path: Path):
    return asyncio.run(create_engine().load(path.resolve().as_uri()))


def checks(doc) -> list[str]:
    """The values of the lesson's check tags, in order."""
    return [tag.value for tag in doc.tags if tag.value in (DONE, NOT_YET)]


def expected_errors(doc) -> int:
    value = doc.data.get("expected_errors", 0)
    return int(value) if isinstance(value, (int, float)) else 0


def test_there_are_lessons():
    assert len(LESSONS) >= 12
    assert "index.texl" in DOCUMENTS


@pytest.mark.parametrize("name", DOCUMENTS)
def test_document_renders(copy, name, capsys):
    doc = load(copy / name)
    expected = expected_errors(doc)
    assert count_returned(find_errors(doc)) == expected
    assert main(["render", "--strict", name]) == (1 if expected else 0)


def test_index_lists_every_lesson():
    index = (TUTORIAL / "index.texl").read_text(encoding="utf-8")
    assert sorted(set(re.findall(r'texl.import "(\d\d-[a-z-]+\.texl)"', index))) == LESSONS
    assert sorted(set(re.findall(r"\]\((\d\d-[a-z-]+\.texl)\)", index))) == LESSONS


@pytest.mark.parametrize("name", LESSONS)
def test_lesson_links_to_the_next(name):
    """Every lesson but the last ends with a link to the next one."""
    source = (TUTORIAL / name).read_text(encoding="utf-8")
    later = LESSONS[LESSONS.index(name) + 1:]
    if later:
        assert f"]({later[0]})" in source
    assert "](index.texl)" in source


def solve(folder: Path, name: str, capsys=None):
    """Applies the solutions of lesson `name` to the copy in `folder`."""
    solution = SOLUTIONS.get(name, {})
    edits = {name: solution.get("replace", []), **solution.get("replace_in", {})}
    for file, pairs in edits.items():
        path = folder / file
        text = path.read_text(encoding="utf-8")
        for old, new in pairs:
            assert text.count(old) == 1, f"{file}: {old!r}"
            text = text.replace(old, new)
        path.write_text(text, encoding="utf-8")
    for file, text in solution.get("files", {}).items():
        (folder / file).parent.mkdir(parents=True, exist_ok=True)
        (folder / file).write_text(text, encoding="utf-8")
    for argv in solution.get("run", []):
        assert main(argv) == 0, argv
    return solution


@pytest.mark.parametrize("name", LESSONS)
def test_lesson_checks_turn_done(copy, name, capsys):
    before = checks(load(copy / name))
    assert DONE not in before, "a check is done before the exercise"
    solution = solve(copy, name)
    doc = load(copy / name)
    after = checks(doc)
    assert len(after) == len(before)
    assert after == [DONE] * len(after)
    assert count_returned(find_errors(doc)) == solution.get("expected_errors", 0)
    if name in SOLUTIONS:
        assert after, "the solutions solve no check"


def test_index_counts_the_checks(copy, capsys):
    text = load(copy / "index.texl").text
    assert "Welcome!" in text and "0 of 2" in text and "try it" in text
    for name in LESSONS:
        solve(copy, name)
    text = load(copy / "index.texl").text
    assert "Welcome back, Ada!" in text
    rows = re.findall(r"^\| (\d+) +\|.*\| ([^|]+) \|$", text, re.M)
    assert len(rows) == len(LESSONS)
    for number, progress in rows:
        assert progress == "try it" or re.fullmatch(r"✓ (\d+) of \1", progress), (number, progress)
