# Writing text

Lines are written in **Markdown**: a simple way to format text with
ordinary characters. You write the characters on the left; when you leave
the line, the editor shows the formatted text.

| You write                          | The editor shows                     |
|------------------------------------|--------------------------------------|
| `# Beam check`                     | a heading                            |
| `## Input`, `### Loads`            | smaller headings                     |
| `*italic*`                         | *italic*                             |
| `**bold**`                         | **bold**                             |
| `- a bullet`                       | a bulleted list                      |
| `1. a step`                        | a numbered list                      |
| `[Texl](https://www.onlabs.org/texl/)` | a link: [Texl](https://www.onlabs.org/texl/) |
| `` `code` ``                       | `code`                               |
| `> a note`                         | an indented note                     |

## Lists

```markdown
- A line that starts with a dash is a bullet.
- Another bullet.

1. A line that starts with a number is a numbered step.
2. The next step.
```

Leave an empty line between a paragraph and a list.

## Tables

```markdown
| Section | Height (mm) | Mass (kg/m) |
|---------|------------:|------------:|
| IPE 200 |         200 |        22.4 |
| IPE 300 |         300 |        42.2 |
```

shows:

| Section | Height (mm) | Mass (kg/m) |
|---------|------------:|------------:|
| IPE 200 |         200 |        22.4 |
| IPE 300 |         300 |        42.2 |

The columns are separated by `|`. The second row, with dashes, divides the
header from the rows; a colon on the right aligns a column to the right.
The columns do not need to line up in what you write.

## Links

A link is written as `[text](address)`. A link to another document of the
folder, as `[steel](../../library/steel.texl)`, opens it in the editor. A
short address like this one starts from the folder of the open document.

## Special characters

Subscripts and superscripts are written with HTML: `f<sub>ck</sub>` shows
f<sub>ck</sub>, and `m<sup>2</sup>` shows m<sup>2</sup>. Characters such as
², σ or γ can be typed or pasted as they are.
