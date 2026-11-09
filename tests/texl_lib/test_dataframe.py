"""`stilo.dataframe` of the Stilo Texl library, on the Python engine.

The cases are in `dataframe-cases.json`, shared with the browser engine's
test (`web/test/texl-lib.test.js`): each renders as a document of
`texl-lib/`, after the import of `index.texl`, and must give `text`.
"""

import asyncio
import json
from pathlib import Path

import pytest

from stilo.cli.project import TEXL_LIB, create_engine

CASES = json.loads((Path(__file__).parent / "dataframe-cases.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES["cases"], ids=lambda case: case["name"])
def test_dataframe(case):
    source = CASES["import"] + case["source"]
    doc = asyncio.run(create_engine().render((TEXL_LIB / "case.texl").as_uri(), source))
    assert doc.text == case["text"]


def test_the_library_binds_only_stilo():
    doc = asyncio.run(create_engine().load((TEXL_LIB / "index.texl").as_uri()))
    assert set(doc.data) - {"texl"} == {"stilo"}  # `texl` is in every document's data
    assert set(doc.data["stilo"]) == {"dataframe"}


def test_the_example_project_has_the_current_library():
    """examples/projects/beam holds a copy of the library, as `stilo init`
    makes one: copy texl-lib/ there again when the library changes."""
    copy = Path(__file__).resolve().parents[2] / "examples" / "projects" / "beam" / "lib" / "stilo"
    names = sorted(path.name for path in TEXL_LIB.iterdir())
    assert sorted(path.name for path in copy.iterdir()) == names
    for name in names:
        assert (copy / name).read_text(encoding="utf-8") == (TEXL_LIB / name).read_text(encoding="utf-8"), name
