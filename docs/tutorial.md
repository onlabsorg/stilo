# The tutorial

*How the tutorial that `stilo tutor` serves is built, how its lessons check
exercises, and how to change it. Decision: [S14](../DECISIONS.md). The
command itself is in [The CLI](cli.md#tutor).*

## What it is

`tutorial/`, at the root of the repository, is a folder of Texl documents
in the Stilo file format: a guided tutorial for new users, which teaches by
doing. The OnLabs.org manual stays the reference; lessons link to its pages
(`https://www.onlabs.org/manual/…`) instead of repeating them.

```text
tutorial/
├─ index.texl                  the table of lessons, with each one's progress
├─ 01-welcome.texl … 12-…      the core path, about 30–45 minutes
├─ 13-…, 14-…                  advanced lessons
├─ files/                      what lessons link to: beam.svg, beam-drawing.pdf,
│                              report.texl (lesson 11, one error on purpose)
└─ lib/
   ├─ tutorial/index.texl      the checks: `tutorial.check`, `.progress`, `.tag`
   └─ steel/sections.texl      the library lesson 8 imports
```

The user never edits this folder: `stilo tutor` copies it and makes the copy
a project (`project.texl`, `lib/stilo/`), so `~` and data tables work. The
source alone is not a project: open lessons through a copy
(`uv run stilo tutor --dir /tmp/t`), not with `stilo serve tutorial`.

## Lessons

Each lesson starts with a hidden formula cell that imports the tutorial
library:

```text
<!--{ fo00 : formula | hidden }-->
<% texl.import "~/lib/tutorial/index.texl" ~> (lib -> bind "tutorial" lib.data) %>
```

then a heading `# N. Title`, short sections, and at the end a line
`Next: [N+1. Title](….texl) · Back to the [index](index.texl)`. Cell names
are four characters, a two-letter prefix per lesson and a number (`fo05`).
Prose cells are `rich` when they can be (no tags, tables or HTML), otherwise
`markdown`.

- **An exercise Texl can see** (a name, a value, a data table, an import, a
  file of the copy) ends with an empty `rich` cell, where the user works,
  followed by a check: a `formula` cell `<% tutorial.check (condition) %>`,
  which shows "✓ Done" or "○ Not yet". The condition must be false, not an
  error, before the exercise (an unknown name is nothing; an undefined value
  is false). A check on another file imports it, as
  `texl.import "practice/notes.texl" ~> (notes -> tutorial.check (…))`.
- **A step Texl cannot see** (formatting, a pane, hiding a line in the
  lesson) is a "try it" step, without a check.
- A value shown before its exercise is done gets a default, `<% area ; "…" %>`,
  so that it does not leave an empty `** **` in the text.
- The brackets of a formula cannot be written as text: show an example
  formula with `<% tutorial.tag "3 * 4" %>`, or without its brackets. Swan
  texts have no escapes, so an example with quotes is written as code,
  without brackets.
- A lesson that has errors on purpose binds `expected_errors` in a hidden
  formula cell (lesson 9, `files/report.texl`).
- Do not write the path of the Stilo library in a lesson that has no data
  table yet: the editor adds its import only when no cell mentions it.

`index.texl` imports every lesson in a hidden cell, one tag each (a tag
waits only for the promise it returns), and `tutorial.progress` counts the
tags of each that showed "✓ Done" or "○ Not yet". A lesson without checks
shows "try it".

## Tests

- `tests/tutorial/test_lessons.py`, on a fresh copy made by `create_copy`:
  every `.texl` renders with `stilo render --strict`, or with exactly
  `expected_errors` errors; the index lists every lesson; each lesson links
  to the next; and each lesson, with its solutions applied, shows ✓ Done in
  every check, and the index counts them all.
- `tests/tutorial/solutions.json`: what a user does in each lesson, as
  replacements in the lesson (`replace`) and in other files (`replace_in`),
  new files (`files`) and `stilo` commands (`run`). A lesson with a new
  check needs its solution here.
- `web/test/tutorial.test.js`: every cell of every document fits its type
  (`accepts`), names are unique, and the file round-trips, so a `rich`
  cell really opens as rich text.
- `tests/cli/test_tutor.py`: the command (see [The CLI](cli.md#tutor)).

## Keeping it current

A change visible to users (a key, a command, a pane, a cell type, a `stilo`
option) updates the lesson that teaches it, in the same commit, together
with its solution if a check changes. `CLAUDE.md` and the `/commit-changes`
skill say so. Lessons that change for an existing user show up only after
`stilo tutor --reset`; `stilo tutor` proposes it when the copy was made by
an older Stilo.
