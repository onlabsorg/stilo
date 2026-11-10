"""The functions of the Stilo Texl library, on the Python engine.

The cases are in `*-cases.json`, one file per function (`dataframe`,
`charts`), shared with the browser engine's test
(`web/test/texl-lib.test.js`): each renders as a document of `texl-lib/`,
after the import of `index.texl`, and must give `text`, if the case has
one, contain each of `contains` and none of `excludes`.
"""

import asyncio
import json
from pathlib import Path

import pytest

from stilo.cli.project import TEXL_LIB, create_engine

CASES = [
    (path.name.removesuffix("-cases.json"), data["import"], case)
    for path in sorted(Path(__file__).parent.glob("*-cases.json"))
    for data in [json.loads(path.read_text(encoding="utf-8"))]
    for case in data["cases"]
]


@pytest.mark.parametrize("function, prefix, case", CASES, ids=lambda item: item["name"] if isinstance(item, dict) else None)
def test_library_case(function, prefix, case):
    doc = asyncio.run(create_engine().render((TEXL_LIB / "case.texl").as_uri(), prefix + case["source"]))
    if "text" in case:
        assert doc.text == case["text"]
    for part in case.get("contains", []):
        assert part in doc.text
    for part in case.get("excludes", []):
        assert part not in doc.text


def test_the_library_binds_only_stilo():
    doc = asyncio.run(create_engine().load((TEXL_LIB / "index.texl").as_uri()))
    assert set(doc.data) - {"texl"} == {"stilo"}  # `texl` is in every document's data
    assert set(doc.data["stilo"]) == {"dataframe", "charts"}
    assert set(doc.data["stilo"]["charts"]) == {"line"}


def test_the_example_project_has_the_current_library():
    """examples/projects/beam holds a copy of the library, as `stilo init`
    makes one: copy texl-lib/ there again when the library changes."""
    copy = Path(__file__).resolve().parents[2] / "examples" / "projects" / "beam" / "lib" / "stilo"
    names = sorted(path.name for path in TEXL_LIB.iterdir())
    assert sorted(path.name for path in copy.iterdir()) == names
    for name in names:
        assert (copy / name).read_text(encoding="utf-8") == (TEXL_LIB / name).read_text(encoding="utf-8"), name
