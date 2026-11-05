"""`stilo render` and the undefined values a document returns."""

import pytest

from stilo.cli import main


@pytest.fixture
def write(tmp_path, monkeypatch):
    """Writes a document in a temporary folder, the current folder of the test."""
    monkeypatch.chdir(tmp_path)

    def write_document(source, name="doc.texl"):
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source, encoding="utf-8")
        return name

    return write_document


def render(capsys, *args):
    status = main(["render", *args])
    captured = capsys.readouterr()
    return status, captured.out, captured.err


def test_no_errors_no_report(write, capsys):
    assert render(capsys, write("<% 1 + 1 %>\n"), "--strict") == (0, "2\n", "")


def test_default_output_is_unchanged_with_a_summary(write, capsys):
    status, out, err = render(capsys, write('A <% 1 + "a" %>\n'))
    assert status == 0
    assert out == "A [[Undefined]]\n"
    assert err == "stilo: doc.texl: 1 undefined value (use --debug to list them)\n"


def test_counts_returned_values_and_tuple_items(write, capsys):
    source = '<% 1 + "z" %> <% (1, 1 + "a", "abc", 1 + "b", {}) %>\n'
    _, _, err = render(capsys, write(source))
    assert "3 undefined values" in err


@pytest.mark.parametrize("source", [
    'x <% y = 1 + "z" %>\n',           # assigned, not returned
    'x <% [1 + "c"] %>\n',             # inside a list
    'x <% {a: 1 + "d"} %>\n',          # inside a namespace
    "x <% zzz %>\n",                   # Nothing
    "x <% {a: 1}.b %>\n",              # Nothing
    'x <% "[[Undefined]]" %>\n',       # a text
])
def test_other_values_are_not_errors(write, capsys, source):
    status, _, err = render(capsys, write(source), "--strict")
    assert (status, err) == (0, "")


def test_strict_exits_1_and_still_writes_the_output(write, capsys, tmp_path):
    status, out, err = render(capsys, write('<% 1 + "a" %>\n'), "--strict", "-o", "out.md")
    assert status == 1
    assert out == ""
    assert "1 undefined value" in err
    assert (tmp_path / "out.md").read_text() == "[[Undefined]]\n"


def test_debug_numbers_the_output_and_reports_on_standard_error(write, capsys):
    status, out, err = render(capsys, write('A <% 1 + "a" %>\n'), "-d")
    assert status == 0
    assert out == "A [[Undefined #1]]\n"
    assert "--debug" not in err
    assert err == (
        "stilo: doc.texl: 1 undefined value\n\n"
        '#1 doc.texl:1:8  cannot add the number `1` and the text `"a"`\n'
        '     A <% 1 + "a" %>\n'
        "            ^\n"
    )


def test_same_value_keeps_its_number_and_lists_where_it_shows(write, capsys):
    source = '<% y = 1 + "a" %>\n<% y %>\n<% y %>\n<% 2 + "b" %>\n'
    _, out, err = render(capsys, write(source), "--debug")
    assert out == "\n[[Undefined #1]]\n[[Undefined #1]]\n[[Undefined #2]]\n"
    assert "3 undefined values" in err
    assert "shown at doc.texl lines 2, 3" in err


def test_debug_numbers_tuple_items_past_a_literal(write, capsys):
    _, out, _ = render(capsys, write('<% ("[[Undefined]]", 1 + "a") %>\n'), "-d")
    assert out == "[[Undefined]], [[Undefined #1]]\n"


def test_chain_of_causes(write, capsys):
    _, _, err = render(capsys, write('<% (1 + "a") * 2 %>\n'), "-d")
    assert "#1 doc.texl:1:14  cannot multiply an undefined value" in err
    assert 'caused by doc.texl:1:7: cannot add the number `1` and the text `"a"`' in err


def test_error_in_an_imported_document_points_into_it(write, capsys):
    write('Acciaio µ\n<% half = x -> x / "two" %>\n', "lib/steel.texl")
    source = '<% texl.import("lib/steel.texl") ~> (l -> bind "lib" l.data) %>\n<% lib.half 3 %>\n'
    _, _, err = render(capsys, write(source), "-d")
    assert 'lib/steel.texl:2:18  cannot divide the number `3` by the text `"two"`' in err
    assert '<% half = x -> x / "two" %>\n' in err
    assert "shown at doc.texl line 2" in err


def test_failed_import_is_an_error_with_its_reason(write, capsys):
    _, _, err = render(capsys, write('<% texl.import("nope.texl") ~> (d -> d.text) %>\n'), "-d")
    assert "cannot look up names in an undefined value" in err
    assert "caused by doc.texl:1:" in err
    assert "cannot load" in err


def test_value_without_position_points_at_its_tag(write, capsys):
    _, _, err = render(capsys, write('Text\nA <% undef.from "x" %>\n'), "-d")
    assert '#1 doc.texl:2:3  Custom undefined value: "x"' in err
    assert '     A <% undef.from "x" %>\n       ^\n' in err


def test_values_without_position_stay_apart_per_tag(write, capsys):
    _, out, _ = render(capsys, write('<% undef.from "x" %> <% undef.from "x" %>\n'), "-d")
    assert out == "[[Undefined #1]] [[Undefined #2]]\n"


def test_columns_count_characters(write, capsys):
    _, _, err = render(capsys, write('è µ <% 1 + "a" %>\n'), "-d")
    assert "doc.texl:1:10 " in err


def test_long_line_is_cut_around_the_error(write, capsys):
    source = "x" * 300 + ' <% 1 + "a" %> ' + "y" * 300 + "\n"
    _, _, err = render(capsys, write(source), "-d")
    excerpt = err.splitlines()[3]
    assert len(excerpt) == 5 + 100
    assert '1 + "a"' in excerpt


def test_error_in_parsed_code_shows_that_code(write, capsys):
    _, _, err = render(capsys, write('<% (parse "8 - []") {} %>\n'), "-d")
    assert "(parsed code):1:3  cannot subtract" in err
    assert "     8 - []\n" in err
    assert "shown at doc.texl line 1" in err
