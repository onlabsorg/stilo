# The document format

A Stilo document is one Texl text file, with the extension `.texl`. You
can open it in any text editor, keep it in git, and render it with any Texl
tool, without Stilo. This page describes what the editor adds to a plain
Texl file: cell markers and cell comments.

```texl
<!--{ bek4 : markdown }-->
# Beam check
<% L = 6, q = 12.5 %>
<!--{ mom3 : markdown }-->
Midspan moment: <% q * L ^ 2 / 8 %> kNm
<!--[ Anna: check the load combination. ]-->
```

## Cells

Each cell starts with a **marker line**, `<!--{ name : type }-->`, on a line
of its own. The cell's content is everything up to the next marker line.

- The **type** says how the editor edits and shows the cell: `markdown` or
  `text`. A type that the editor does not know is edited as `text`, and
  kept when the file is saved.
- The **name** identifies the cell: four lowercase letters and digits, such
  as `bek4`. The editor gives one to every new cell, and to every marker
  written without a name, such as `<!--{ markdown }-->`. Names are unique
  in a document; the editor does not show them, people refer to lines by
  their number.
- Text before the first marker is a `text` cell without marker. So any Texl
  file opens in the editor, also one written without it.

The markers are HTML comments: they stay in the rendering of the document,
where Markdown and HTML do not show them.

Older documents may use markers of the form `<!--% type %-->`. The editor
reads them, and writes them in the new form, with a name, when it saves.

## Formulas and names

Formulas are Texl tags, `<% ... %>`, anywhere in a cell. Texl computes a
document from top to bottom, so a name defined in a cell (`L` and `q`
above) is known in every cell below it, and not above it. The
[Texl manual](https://www.onlabs.org/texl/book/) describes the tags and
the Swan language inside them.

## Comments

`<!--[ ... ]-->` is a **cell comment**: a note about the cell it is in. It
moves with the cell, and the editor counts the comments of each cell in the
right margin. The text of a comment is free; a common habit is to start it
with your name.

Other HTML comments, `<!-- ... -->`, are neither markers nor cell
comments: they are text of the cell, like any other.

## Rules for editing by hand

- Keep every marker on a line of its own.
- Keep cell names unique (compared without case). If two cells share a
  name, the editor leaves them as they are and reports the clash to the
  program that embeds it.
- A formula must open and close in the same cell. A tag that starts in one
  cell and ends in a later one hides the output of the cells in between.
