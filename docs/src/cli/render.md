# stilo render

```text
stilo render file [-o OUTPUT]
```

Renders a Texl document: prints its text with every `<% %>` formula
replaced by its value.

Given `beam.texl`:

```texl
<!--{ bek4 : markdown }-->
# Beam check
<% L = 6, q = 12.5 %>
Span <% L %> m, load <% q %> kN/m.
<!--{ mom3 : markdown }-->
Midspan moment: **<% q * L ^ 2 / 8 %> kNm**
```

```sh
stilo render beam.texl
```

```text
<!--{ bek4 : markdown }-->
# Beam check

Span 6 m, load 12.5 kN/m.
<!--{ mom3 : markdown }-->
Midspan moment: **56.25 kNm**
```

The cell markers, `<!--{ ... }-->`, stay in the output. They are HTML
comments, so they do not show when the output is read as Markdown or HTML.

## Arguments and options

| Argument            | Meaning                                              |
|---------------------|------------------------------------------------------|
| `file`              | The document to render.                              |
| `-o`, `--output OUTPUT` | Writes the rendering to this file instead of the terminal. An existing file is replaced. |

```sh
stilo render beam.texl -o beam.md
```

## Imports

Relative imports resolve from the document's own folder, as in the editor.
If `projects/beam.texl` contains:

```texl
<% texl.import("../library/steel.texl") ~> (lib -> bind "steel" lib.data) %>
```

then `stilo render projects/beam.texl` reads `library/steel.texl`, wherever
you run the command from.

## Errors

A formula that cannot be computed does not stop the rendering: it shows as
`[[Undefined]]`, and the rest of the document renders. `stilo render` fails
(with exit status 1) only when the file itself cannot be read, or the output
cannot be written.
