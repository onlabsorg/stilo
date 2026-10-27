# Introduction

Stilo is the editor for [Texl](https://www.onlabs.org/texl/) documents. It
edits a folder of `.texl` files, the way Word edits `.docx` files, and
renders them from the command line.

A Texl document is text that computes part of its own content. A report can
hold a calculation, and the numbers in the text follow when an input
changes. A document can also import other documents, so a project can use
the data that a library of materials or a colleague's calculation provides.

Stilo shows a document as a sheet of lined paper. Each line is a cell, as
in a spreadsheet: you select it, press Enter to edit it, and see its result
when you leave it.

```texl
<!--{ bek4 : markdown }-->
# Beam check
<% L = 6, q = 12.5 %>
Span <% L %> m, load <% q %> kN/m.
<!--{ mom3 : markdown }-->
Midspan moment: **<% q * L ^ 2 / 8 %> kNm**
```

In the editor, this file is two lines of a sheet:

```text
1   Beam check
    Span 6 m, load 12.5 kN/m.
2   Midspan moment: 56.25 kNm
```

## What Stilo is made of

| Part        | What it does                                                  |
|-------------|---------------------------------------------------------------|
| Web editor  | The user interface, in the browser: a navigation pane with the folder's documents, the editor, and panes for commands and comments. |
| Server      | Serves one folder of documents, and the web editor, over HTTP. |
| `stilo`     | The command line: `stilo serve` starts the server on a folder, `stilo render` prints a rendered document. |

Stilo is **single-user**: it reads and writes one folder, on your computer
or on a server you run. It has no accounts and no permissions. Stilo is
free software, released under the MIT license.

## How to read this manual

- New to Stilo? Start with [Getting started](getting-started.md).
- [The web editor](editor/index.md) teaches the editor, one topic per
  page: read it with Stilo open beside it, and try each step.
- [The stilo command](cli/index.md) describes the command line.
- [Protocol](protocol.md) and [The editor component](component/index.md)
  are for people who connect other programs to Stilo.
- The [developer guide](dev/index.md) explains how Stilo is built, for
  people who want to change it.
