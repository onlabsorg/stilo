# Linking documents

A document can use the values of another one: a library of materials, the
loads from a colleague's calculation, the rates of a price list. When the
other document changes, yours follows.

The sample documents show how. `examples/library/steel.texl` is a library of
steel sections:

```texl
# Steel sections
<%
grade = {name: "S355", fy: 355},   # yield strength in N/mm²
IPE = {
    IPE270: {name: "IPE 270", h: 270, W: 429000, mass: 36.1},
    IPE300: {name: "IPE 300", h: 300, W: 557000, mass: 42.2}
}
%>
```

`examples/projects/beam/beam-check.texl` imports it, on its first line, and
uses its values below:

```texl
<% texl.import("../../library/steel.texl") ~> (lib -> bind "steel" lib.data) %>
```

```texl
<% section = steel.IPE.IPE300 %>
- Section: <% section.name %>, steel <% steel.grade.name %>
```

```text

- Section: IPE 300, steel S355
```

## How it works

- `texl.import("...")` reads the document at an address.
- A short address starts from the folder of the document that imports:
  `../../library/steel.texl` goes two folders up from
  `projects/beam/`, then into `library/`.
- The values that the library gives names to, as `grade` and `IPE`, are
  the members of `lib.data`. `bind "steel" lib.data` gives them, together,
  the name `steel` in this document: `steel.grade.name` is `"S355"`.
- The import must be on a line above the lines that use it.

Copy the import line and change the address and the name to use another
document.

## The library changes, the document follows

The imported document is read again every time the editor computes yours:
after every change you make. Open the library, change the mass of the
IPE 300, save, and open the beam check again: the self-weight and the
check use the new value.

An address can also be a full web address, `https://...`, of a document on
another server that allows it.

## Links to read

A Markdown link to another document, as `[steel.texl](../../library/steel.texl)`,
does not import anything: it opens the other document in the editor when you
click it.
