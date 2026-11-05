"""The errors of a rendered document, and how `stilo render` reports them.

An error is an undefined value that a tag returned, directly or as an item of
a returned tuple: the Swan counterpart of an exception that was thrown. An
undefined value that was only assigned, or that sits inside a list or a
namespace, is not one, and neither is `Nothing`.
"""

import os
from dataclasses import dataclass, field
from urllib.parse import urlparse
from urllib.request import url2pathname

import pytexl

# How Texl renders an undefined value
UNDEFINED_TEXT = "[[Undefined]]"

# The longest source line shown in a report; longer ones are cut around the error
MAX_EXCERPT = 100


@dataclass
class Place:
    """Where a document returned an error: the tag, and the span of its text."""

    tag: pytexl.Tag
    out_start: int
    out_end: int


@dataclass
class DocumentError:
    """One error, with every place where the document returned it."""

    number: int
    value: pytexl.Undefined
    places: list[Place] = field(default_factory=list)


def find_errors(doc: pytexl.Document) -> list[DocumentError]:
    """The errors of `doc`, numbered in order of first appearance.

    The same value returned by several tags is one error with several places.
    """
    errors: dict[tuple, DocumentError] = {}
    for tag in doc.tags:
        for value, out_start, out_end in _returned(doc, tag):
            # A value with no position can only be told apart by its tag
            where = (value.uri, value.pos) if value.pos is not None else tag.start
            key = (where, value.description)
            if key not in errors:
                errors[key] = DocumentError(len(errors) + 1, value)
            errors[key].places.append(Place(tag, out_start, out_end))
    return list(errors.values())


def _returned(doc, tag):
    """The undefined values `tag` returned, each with the span of its text."""
    if isinstance(tag.value, pytexl.Undefined):
        yield tag.value, tag.out_start, tag.out_end
    elif isinstance(tag.value, tuple):
        # A tuple shows its items in order. A text item may itself read
        # "[[Undefined]]", so the search moves past each text item too.
        cursor = tag.out_start
        for item in tag.value:
            if isinstance(item, pytexl.Undefined):
                start = doc.text.index(UNDEFINED_TEXT, cursor, tag.out_end)
                cursor = start + len(UNDEFINED_TEXT)
                yield item, start, cursor
            elif isinstance(item, str):
                found = doc.text.find(item, cursor, tag.out_end)
                cursor = found + len(item) if found >= 0 else cursor


def count_returned(errors: list[DocumentError]) -> int:
    """How many undefined values the document returned, repeats included."""
    return sum(len(error.places) for error in errors)


def numbered_text(doc: pytexl.Document, errors: list[DocumentError]) -> str:
    """The text of `doc`, with each error shown as `[[Undefined #n]]`."""
    spans = [(place.out_start, place.out_end, error.number)
             for error in errors for place in error.places]
    text = doc.text
    for start, end, number in sorted(spans, reverse=True):
        text = f"{text[:start]}[[Undefined #{number}]]{text[end:]}"
    return text


def format_report(doc: pytexl.Document, errors: list[DocumentError]) -> str:
    """The errors of `doc` in plain words: where, what, and what caused them."""
    return "\n\n".join(_format_error(doc, error) for error in errors)


def _format_error(doc, error):
    value = error.value
    if value.pos is not None:
        uri, source, pos = value.uri, value.source, value.pos
    else:
        # No position of its own: point at the tag that returned it
        uri, source, pos = doc.uri, doc.source, error.places[0].tag.start
    lines = [f"#{error.number} {_location(uri, source, pos)}  {value.description}"]
    lines += [f"     {line}" for line in _excerpt(source, pos)]

    cause = value.cause
    while cause is not None:  # not `while cause`: an undefined value is falsy
        where = f" {_location(cause.uri, cause.source, cause.pos)}:" if cause.pos is not None else ":"
        lines.append(f"     caused by{where} {cause.description}")
        cause = cause.cause

    shown = sorted({_line_number(doc.source, place.tag.start) for place in error.places})
    if shown != [_line_number(source, pos)] or uri != doc.uri:
        label = "line" if len(shown) == 1 else "lines"
        numbers = ", ".join(str(n) for n in shown)
        lines.append(f"     shown at {_document_name(doc.uri)} {label} {numbers}")
    return "\n".join(lines)


def _location(uri, source, pos):
    """`file:line:column`, counted from 1."""
    start = source.rfind("\n", 0, pos) + 1
    return f"{_document_name(uri)}:{_line_number(source, pos)}:{pos - start + 1}"


def _line_number(source, pos):
    return source.count("\n", 0, pos) + 1


def _document_name(uri):
    """A file's path relative to the current folder; any other URI as it is."""
    if uri is None:
        return "(parsed code)"  # code run by Swan's `parse` has no document
    parsed = urlparse(uri)
    if parsed.scheme != "file":
        return uri
    path = url2pathname(parsed.path)
    try:
        return os.path.relpath(path)
    except ValueError:  # another drive, on Windows
        return path


def _excerpt(source, pos):
    """The source line holding `pos`, and a caret under `pos`."""
    start = source.rfind("\n", 0, pos) + 1
    end = source.find("\n", pos)
    line = source[start:end if end >= 0 else len(source)].rstrip("\r")
    column = pos - start
    if len(line) > MAX_EXCERPT:
        first = max(0, min(column - MAX_EXCERPT // 2, len(line) - MAX_EXCERPT))
        line, column = line[first:first + MAX_EXCERPT], column - first
    # Tabs stay tabs, so the caret lines up however wide they are
    padding = "".join("\t" if c == "\t" else " " for c in line[:column])
    return [line, f"{padding}^"]
