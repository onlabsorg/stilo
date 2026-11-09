# Editor design

*The editing model and architecture of the editor. Status: draft,
2026-10-18. Items marked **(open)** are still to be decided here.*

## Who it is for

Engineers, finance people and other knowledge workers who do their work in
Word and Excel, not programmers. The editor must be as approachable as Word
and Excel. Writing raw Texl with `<% %>` tags stays possible for power users,
but nobody has to.

## Editing model: a stack of cells

A document is a **vertical stack of cells**, the way an Excel sheet is a grid
of cells. It looks like lined paper: each line is a cell, ruled below by a
soft gray line (`--texl-line`), at least one line high and taller when its
content needs it.

- The sheet has a fixed number of lines (`rows`, 100 by default), or more if
  the document has more cells. Lines below the last cell are empty and not
  stored. Writing in one adds it to the document as a `rich` cell,
  together with empty `rich` cells for the empty lines above it, so it
  stays where it was written. Inserted cells are `rich` too (S9). Later, a
  configuration file may let the user choose this default type.

- Two vertical blue lines (`--texl-margin-line`) rule a **margin** on each
  side of the cells, as on legal paper. The cells fill the middle column.
  - The **left margin** is for the editor's own objects about each line.
    It shows the line number and, before it, a discreet icon of the cell's
    type (on the empty lines only under the mouse or when selected). A
    click on the icon opens the menu of cell types; a click elsewhere in
    the margin selects the line.
  - The **right margin** is for the comments of a cell. They live in the
    document: every cell comment (`<!--[ ... ]-->`) in a cell's source is
    a comment of that cell, so comments follow the cell when it moves.
    Other HTML comments are ignored. To the editor a comment is just a string; a host
    may give it a structure (author, date, thread) with a syntax of its
    own. The right margin shows a comment icon with their number; a click
    on it fires `comments-click` with the line number and the comments as
    a list of strings; Shift+F2 does the same for the selected line, also
    when it has none. Showing them is up to the page (the demo lists them
    beside the sheet until another line is selected: the editor fires
    `selection-change` with the selected line). In the text editors,
    comments are written as `<!--[ ... ]-->`; Shift+F2 inserts one. In a
    `rich` cell Shift+F2 opens a field and adds the comment at the end of the
    cell. **(open)** Editing a comment outside the source.
  - Both margins are `--texl-margin` wide (6rem); they are the CSS parts
    `left-margin` and `right-margin`.
    **(open)** The layout on narrow screens.

- The user moves between cells with the keyboard (or mouse) and presses
  Enter to edit one, as in Excel. A click elsewhere in the sheet commits the cell
  being edited and then does what it does (decided 2026-11-07). If the cell refuses
  its edit it stays in edit mode, says why, and the click does nothing. A selection
  dragged out of the cell, or the scrollbar, does not commit. Clicks outside the
  sheet (panes, top bar) leave the edit open.
- Each cell has a **type**, which decides how it is edited and shown.
- People know cells by their **line number** (each cell also has a name
  in the file, not shown: see File format), shown in
  the left margin as in Excel: 1, 2, 3, …, 10, 11, …, 100, …, on every
  line of the sheet, the empty ones below the document included. People
  talk about "line 25". The number is a position: it changes when cells
  are inserted, deleted or moved above it.
- Each cell has two modes:
  - **edit mode**: the cell's own widget takes the user's input;
  - **render mode**: the cell shows its rendered output.
- A cell turns its input into **plain Texl source**. That source is what is
  stored, and it is the single source of truth: there is no separate widget
  data. To edit again, the cell reads its input back from its source.
- Cells see the names (variables, functions) defined by the cells **above**
  them, because Texl evaluates a document top to bottom in one scope. Edit
  mode should help the user reference those names (autocompletion).

Revisions, releases and permissions belong to Papiro (the platform), not
to Stilo. Comments are stored in the document (see above); how they are
shown, and any structure they have, is up to the platform.

### Cell types

| Type        | Edit mode                                    | Status        |
|-------------|----------------------------------------------|---------------|
| `text`      | Texl template shown as HTML; Swan highlighted in `<% %>` tags, Mod+E inserts one | Boilerplate |
| `markdown`  | `text` with Markdown: highlighted in the editor, turned into HTML for display | Boilerplate |
| `table`     | A grid where each table cell's Texl source is edited in its own field; shown as the rendered table | Ready for the MVP (2026-10-31): a Markdown pipe table (O5) edited as a grid of fields |
| `formula`   | One tag, edited as its expression without the `<% %>`, shown as its output | First version |
| `data`      | "Data table": a table of values (`stilo.dataframe`), edited as a name and a grid of Swan expressions, shown as the table the library renders | First version (2026-11-09); replaces the dropped `spreadsheet` idea |
| `chart`     | Shows a chart; edits as a table of values    | Planned       |
| `figure`    | A parametric figure                          | Idea          |
| `ai`        | A prompt from which AI writes the cell's Texl | Idea         |
| `rich`      | WYSIWYG, with a toolbar; formulas as chips that show their value (see Rich text below) | Default type of new cells; first version |

Other formats for raw templates (e.g. LaTeX) are possible later as cell
types built on `text`, as `markdown` is.

**Formulas** are `<% %>` tags inside a `text` or `markdown` cell, inserted
with Mod+E, as fields in Word (parent D11). A cell that is one tag and
nothing else can also be a `formula` cell (2026-10-30): its source stays
that plain tag, edited without the delimiters. The reasons D11
dropped the older `expression` cell are answered by the shape rule (see
Editing model): the type is offered only for a source that is one tag, and
an expression containing `%>`, which would split the tag, is not
committed. Files with `<!--% expression %-->` still open, as `text` with
their type kept, like any unknown type.

## Rich text

*Decided 2026-11-07 (S9).* The `rich` cell is what a Word user expects: bold is
bold, a title is a title. It shows its output as a `markdown` cell does, and in
edit mode a ProseMirror editor takes CodeMirror's place, with the same typography.

- **Source:** the same Markdown as a `markdown` cell, so changing between the two
  types converts nothing. Underline, sub- and superscripts are inline HTML (`<u>`,
  `<sub>`, `<sup>`); `<strong>`, `<em>` and `<del>` are written where Markdown's
  delimiters would not work (`x<strong>"q"</strong>y`).
- **What it holds:** titles, paragraphs, lists, quotes, code blocks, rules, links,
  images, equations, formulas. Not colours, fonts, alignment or tables in the text
  (the `table` cell does that). Repeated empty paragraphs collapse: Markdown has
  none, and empty lines of the sheet make the room.
- **Formulas are chips.** Tags are found first, as Texl does, so Swan is never read
  as Markdown. A chip shows the tag's value from the last rendering, with the
  expression on hover; a tag with no output, such as `<% L = 6 %>`, shows a small
  ƒ; a new or changed one shows its expression until the cell is committed. A
  click, or Enter when it is selected, opens a field for the expression; Mod+E or
  typing `<%` inserts one. A tag whose output is Markdown shows as one chip.
- **Equations** are typeset, with the values of the tags in them. A click opens a
  field for the LaTeX, with a preview; typing a closing `$` makes one.
- **Nothing is lost.** The type accepts a source only if what it would write shows
  the same as the source; otherwise the menu greys it out with the reason, and a
  `rich` cell with such a source (edited by hand) is edited as Markdown and must be
  accepted to commit. Text the user types cannot become a tag or a marker: `<%` is
  written `&lt;%`.
- **Small diffs.** An unchanged cell keeps its source exactly, and in a changed one
  each unchanged block keeps its text. Comments go to the end of a changed cell.
- **Keys** follow Word: Mod+B/I/U, Mod+= and Mod+Shift+= for sub- and superscript,
  Mod+K for a link, Mod+Alt+0 to 3 for the style, Tab and Shift+Tab to indent a
  list, Shift+Enter for a line break; `# `, `- `, `1. `, `> ` and three backticks
  format the line. Arrow keys stay in the cell; Mod+Enter commits, Escape discards.
- **Paste** keeps the supported formatting of HTML and drops the rest. Tags in plain
  text become formulas. Pasted HTML cannot put anything else into the source.
- **Tried in browsers (2026-11-07):** inside two shadow roots ProseMirror passes
  focus, typing, mouse and keyboard selection, chips, undo and clipboard in Chrome
  and Firefox and in Playwright's WebKit on Linux, and IME input in Chrome. Not yet
  tried on Safari on a Mac. ProseMirror calls `preventDefault` on Escape and
  Enter, so the cell handles the keys that leave edit mode itself.

## Typography

The rendered document reads like a well-set engineering report
(2026-10-30, chosen among six options): **Literata** for the text, a serif
designed for reading on screens, at 16 px with line height 1.65; **Source
Sans 3**, a humanist sans close to Calibri and Segoe UI, for headings and
table headers. Tables span the full width with equal columns, and are
ruled as in print (heavier rules at top and bottom and under the header,
light rules between rows) with tabular figures, so numbers line up; sub- and superscripts do not open up the line.
The styles are the cells' (`.view` in `TexlCell`), so every cell type
shares them; a host changes the fonts with `--texl-font`,
`--texl-heading-font` and `--texl-font-size`, and loads the font files
itself (Stilo bundles them, so it works offline). Edit mode keeps the
monospace font (`--texl-mono`).

## File format

A document is still **one Texl text file**. Each cell starts with a marker
line, an HTML comment that the editor recognises:

```texl
<!--{ bek4 : markdown }-->
# Beam check
<% L = 6, q = 12.5 %>
<!--{ mom3 : markdown }-->
<% q * L ^ 2 / 8 %>
<!--[ Anna: check the load combination. ]-->
```

- Marker: `<!--{ name : type }-->` on its own line. The cell body is
  everything up to the next marker line.
- **(decided 2026-11-07)** A marker line inside a tag is not a marker: to Texl
  it is part of the tag, so a tag belongs to the cell it opens in and never
  spans cells. Stilo finds tags by the engine's rule, from `<%` to the first
  `%>`; a `<%` with no `%>` after it is text. A line that a tag touches at all
  is not a marker either. So a `<%` left open in a file merges the cells down
  to the first `%>`: the file is unchanged, the types of the merged cells do
  not apply until the tag is closed, and the source shows where the problem
  is. Before this, the marker still started a cell whose output went missing.
- The cells on screen always read the same when the document is opened again:
  - A change that would make a tag run into a later cell is refused, with a
    message naming both lines: a commit stays in edit mode, as for an invalid
    formula; a paste or a move does nothing and shows a notice. This covers a
    `<%` left open above a `%>`, and a new `%>` below a lone `<%`. A lone `<%`
    with no `%>` below it stays valid text.
  - A commit whose source has marker lines outside tags becomes those cells,
    in one undo step: this splits a merged cell once its tag is closed, and a
    cell where a marker line was typed or pasted. A cell split off with a name
    in use gets a new one. A source that starts with a marker takes that
    marker's name and type.
- The **name** identifies the cell, e.g. as a fragment identifier
  (`#bek4`): four lowercase letters and digits, compared without case. The
  editor gives one to every cell with a marker that has none (new cells,
  markers written as `<!--{ type }-->`), unique in the document: a
  syllable and a digit (`bek4`), easy to remember, without the look-alikes
  `l`, `0` and `1`. Pasted cells whose names are in use get new ones, so a
  copy never clashes, while a cut and paste keeps them. The name is not
  shown in the editor.
- Names edited by hand may clash. The editor leaves them as they are and
  fires `name-conflict` with the clashing names and their lines.
- Text before the first marker is a `text` cell without marker, so any plain
  Texl file opens in the editor. It has no name until it gets a marker
  (when its type changes or a cell is inserted above it).
- Cell comments, `<!--[ ... ]-->`, are the comments of the cell they are
  in. Other HTML comments (`<!-- ... -->`) are neither markers nor
  comments: they are part of the source like any other text.
- Unknown cell types are shown as `text` and their type is kept on save.
- The file renders with any Texl host (CLI, Python, `texl.import`) without
  the editor. The markers pass through rendering as HTML comments: invisible
  in Markdown/HTML output, visible in other output formats.
- Older markers, `<!--% type %-->` (or `<!--% name | type %-->`), open
  too: they are saved in the new form with a new name.
- **Marker options** follow the type, each after a bar:
  `<!--{ bek4 : formula | hidden }-->`. `hidden` is the first (2026-11-09,
  S13); options the editor does not know are kept as written.
- **Hidden cells** (2026-11-09, S13), as hidden rows in Excel: a hidden
  cell is out of sight, but keeps its line number and still renders in
  its place, so its names work below it. The line numbers skip it (1, 3,
  4) and a double rule above the next line shows where hidden lines are.
  Commands (in the commands pane, no keys: Excel's Ctrl+9 switches browser
  tabs): Hide hides the selected cells; Unhide reveals the hidden cells
  inside the selection, so the user selects the lines around them; "Show
  hidden" switches them into sight, greyed out, a view setting that is not
  saved. The arrow keys skip hidden lines; selecting one from outside (the
  errors pane, a comment) shows the hidden cells. Hiding a first cell
  without marker gives it one. The import of the Stilo library that the
  editor adds for a data table is hidden.
- **(open)** More marker options (e.g. `<!--{ bek4 : table | header=1 }-->`).

## Rendering

After every committed edit the editor renders the whole document, as the
document at its URL (`url`), with one `engine.render(url, source)`: exactly
what any other Texl host renders, imports included. Imports resolve against
the document URL and are fetched again on every rendering, so a changed
library shows on the next one. The names of earlier cells are in scope,
since Texl evaluates the document top to bottom in one scope.

The rendering is then split into the cells' outputs at the places of the
cells' markers, which render to themselves (HTML comments without tags):

- **(decided 2026-11-07)** The places come from the tags' positions, not from
  a search of the text. Text outside tags renders to itself, so a marker's
  place in the rendering is its place in the source plus the change in size
  of the tags before it. Marker-like text in a tag's output is content,
  whatever its name, e.g. that of an imported editor document rendered with
  `texl.import(...) ~> (lib -> lib.text)`. Searching for the marker went wrong
  when that output held the marker of a later cell. Options considered:
  replacing the markers with random tags of the same length before rendering
  (works, but the rendered source then differs from the document, which errors
  had to undo, and short markers leave little room for randomness).
- The leading cell without marker gets the text before the first marker.
- A marker inside a tag cannot come from a file or the editor (see File
  format). `outputSpans` still handles one, for pages that pass their own
  cells: the text goes to the last cell whose marker is outside a tag, and the
  swallowed cells show no output.
- The line break that serialisation adds to a cell body without one is not
  part of the cell's output.
- If the URL cannot be resolved, the cells show no output.
- Cell output is HTML, sanitised with DOMPurify (documents may come from
  other parties). `markdown` output is first turned into HTML with `marked`.
- **Equations** in `markdown` and `table` cells (2026-11-07): LaTeX between
  `$...$` in the text, or `$$...$$` on lines of their own, typeset with
  KaTeX (HTML output, `web/src/editor/math.js`). They are read after Texl
  has rendered, so a tag inside one shows its value:
  `$\sigma = <% M / W %>$`. In the UI they are "equations": "formula" means a
  `<% %>` tag. Choices:
  - Dollars follow Pandoc's rule so that money stays text: the opening `$`
    has no white space after it, the closing one none before it and no
    digit after it; `\$` is a plain dollar. An equation has no blank line.
  - An equation holding an undefined value stays source text, so that the
    value is highlighted and clickable like any other. Bad LaTeX shows in
    red with the reason on hover; it is not a document error (S7).
  - KaTeX's trust stays off: LaTeX cannot make links, classes or images.
  - In a table, a `|` inside an equation still ends the table cell; write
    `\vert`.
  - `stilo render` and imports see the LaTeX as text: the file format does
    not change.
- **(open)** Names for autocompletion. One rendering gives only `doc.data`,
  the names at the end of the document, not the names visible to each cell.
  Options: the names of `doc.data` filtered by the cell where they are first
  bound; a separate context render of the cells above the edited one (no
  imports there); a Texl API for the names at each tag.
- Links in rendered HTML (e.g. `[lib](lib.texl)`) resolve from the folder of
  the document showing them, because the app's page address is the document's
  public address. Text from an imported document is part of the document
  showing it, so its relative links resolve from there too. The `uri` that
  `texl.import` returns lets an author build the right address.
- A link to a document on the same server opens in the app; a link to anything
  else, another file or another site, opens in a new tab, so the document stays
  open.
- **(open)** A page embedding `<texl-editor>` at an address other than its
  `url` gets links resolved against the page. The fix, when an embedder needs
  it, is to resolve them against `url` in `sanitizeOutput`.
- **(open)** Every rendering fetches and renders all imports again (the
  browser HTTP cache absorbs repeated fetches). If it gets slow: debounce,
  and later cache sources at loader level (a Texl feature).
- **(open)** Incremental rendering (only the edited cell and those below), if
  full re-rendering gets slow.

## Architecture

Plain JavaScript (ES modules, JSDoc types) and [Lit](https://lit.dev) web
components.
The [architecture](editor.md) page describes the modules in detail;
this section keeps the outline.

```
<texl-editor>                     the app: document, navigation, rendering
  ├─ <texl-cell-text>             one element per cell, by type
  ├─ <texl-cell-markdown>
  └─ <texl-cell-…>                custom cells from third parties
        all extend TexlCell       base: modes, layout, commit protocol
```

- `TexlCell` (`web/src/editor/texl-cell.js`): base class. Switches between edit and
  render mode, provides the common layout, and reports a committed edit with
  a `cell-change` event carrying the new Texl source. Subclasses implement
  `fromTexl()`, `toTexl()` and `renderEditor()` (the base only shows a
  "no editor" notice). `renderView()` rarely needs overriding: the base
  renders `output` as HTML, sanitised with DOMPurify.
- `TextCell` provides the text editor, a CodeMirror 6 view that exists only
  in edit mode and keeps `input` up to date (without the line break that
  ends the cell body, which belongs to the file format and is added back).
  Its `languageExtensions()` give the editor its language: Swan
  highlighting inside `<% %>` tags, Mod+E to insert a tag and
  Shift+F2 to insert a comment (`web/src/editor/swan.js`). `MarkdownCell` extends it with Markdown highlighting
  (tags stay Swan, Markdown does not look inside them) and renders its
  output as Markdown.
- Swan highlighting is a layer of decorations over the editor's language,
  as Texl finds its tags before Markdown is read: a tag is highlighted
  wherever it is, also in a code block.
- Registry (`web/src/editor/registry.js`): `registerCell(CellClass)` maps the type in the
  marker to a custom element (`texl-cell-<type>`). This is the extension
  point for developers' own cells.
- `<texl-editor>` (`web/src/editor/texl-editor.js`): parses the file into cells
  (`web/src/editor/document.js`), renders the document and splits the
  rendering into cell outputs, handles navigation and
  edit mode, and serialises the cells back. It is a web component itself, so
  it can be embedded in other apps and later in the OnLabs platform.
- The editor owns the document; cells are stateless views of their source.

## Open points

- Key map: ↑/↓ select a cell; Enter, Ctrl+Enter or F2 edits it, as does a
  double click. Enter is the familiar key; Ctrl+Enter works too because it is
  the key that commits, so it opens and closes a cell; F2 is Excel's edit
  key. In edit mode, Ctrl+Enter (Cmd+Enter on macOS) commits and leaves,
  Escape discards the changes and leaves, as in Excel. Enter stays inside the
  cell (a new line in text). Cells must leave these keys to the editor.
- Typing on a selected cell does not start editing it, unlike Excel, until
  it is clear how that would work for other cell types (e.g. tables).
  The exception is the type keys (2026-10-31): `=` (formula), `t` (text),
  `m` (Markdown), `T` (table) and `d` (data table, 2026-11-09) change the selected line to that type and
  edit it, as `=` starts a formula in Excel. On a line of that type
  already, the key edits it, as Enter does; if the type does not accept
  the line's source, nothing changes and the line shows the reason the
  type menu shows ("Needs a table"). The key itself is not typed into the
  cell. With several lines selected, it acts on the active line alone.
  A cell class sets its key (`key`, not inherited); the type menu shows
  it next to each type.
- Cell keys, outside edit mode (Mod is Ctrl, or Cmd on macOS). They are
  chosen to exist on every keyboard (Mac and laptops have no Insert key,
  Mac's ⌫ is Backspace) and not to clash with the browser or the OS:
  - Shift+↑/↓ (or Shift+click) selects several cells, from the anchor to
    the active line. The actions below work on all selected cells; Enter
    edits only the active one.
  - Alt+↑/↓ moves the selected cells one line up or down, as in VS Code.
    A cell moved below the document leaves empty cells behind it.
  - Alt+Enter inserts an empty cell below the selection, Alt+Shift+Enter
    above it (Shift reverses the direction, as Shift+Tab). Insert also
    inserts below, for keyboards that have it.
  - Delete or Backspace deletes the selected cells; Mod+Z brings them back.
  - Mod+C/X/V copy, cut and paste the selected cells: the clipboard holds
    their marker lines and source, so pasted cells keep their type, and
    other text pastes as a `text` cell. Paste replaces the
    selected cells, as in Excel, and selects the pasted ones. The editor
    handles the browser's clipboard events rather than the keys, so the old
    Ctrl+Insert, Shift+Insert and Shift+Delete copy, paste and cut too, and
    text selected with the mouse is copied as usual.
  - Mod+Z undoes the last change to the cells (inserts, deletes, moves,
    pastes, committed edits) and restores the selection, Mod+Shift+Z or
    Mod+Y redoes it; setting `value` clears the history. While editing,
    these keys undo inside the cell.
  - Only the first cell may go without marker: a cell without one that is
    no longer first gets one. Empty `markdown` or `text` cells at the end of
    the document are dropped, as they look like the empty lines below it.
- Changing a cell's type: the icon in the left margin, or Mod+/ (as in
  Notion), opens a small menu of the registered types, with the current one
  checked. ↑/↓ (or a type's first letter) pick a type, Enter or a click
  changes all selected cells to it, Escape or a click outside closes the
  menu. The cell keeps its Texl source: only how it is edited and shown
  changes, so the change is lossless and Mod+Z undoes it. Types that do
  not accept the source of every selected cell are greyed out, with the
  reason ("Needs a table"), and the keys skip them (see the shape rule
  below). A first cell
  without marker gets one; empty lines below the document that change type
  are added to it, unless they stay empty `markdown` or `text` lines. Cell
  classes give the menu their `label` and `icon`.
- **(open)** Formulas: the `formula` cell (one tag, edited without the delimiters) is a
  first version, started with `=` (see the type keys above); still open:
  Mathcad-style display ("M = 56.25"), units.
  Any of these must keep the formula a plain tag in the source.
- Tables (ready for the MVP, 2026-10-31): the `table` cell stores a
  Markdown pipe table and edits it as a grid of plain fields, one per
  table cell, each showing that cell's Texl source (Tab, Shift+Tab, ↑/↓;
  Tab in the last field adds a row; buttons insert and delete rows and
  columns). Outside edit mode it shows the rendered table. Three buttons,
  as in Word, align the column of the current field left, centred or
  right (`:--`, `:-:`, `--:` in the delimiter row); the pressed one shows
  the column's alignment, and a column without alignment (`---`) counts as
  left and keeps its delimiter when set to left. A source that is not a
  table is edited as Markdown text, and an unchanged table keeps its
  source as written. Decided 2026-10-31 (O5): the table stays a Markdown
  pipe table, and each table cell is ordinary Texl template, with
  expressions between `<% %>` (no `=`); there are no references to table
  cells (no column formulas, no A1 references): a value needed elsewhere
  is labelled in its expression. So no renderer helper functions are
  needed. Syntax highlighting in table cells is a nice to have, after the
  MVP.
- Data tables (first version, 2026-11-09; S10, S12): the `data` cell
  stores one formula, `<% loads: stilo.dataframe {columns: [...], rows:
  [[...], ...]} %>`, written one row per line, and shows the Markdown
  table that the Stilo library's `stilo.dataframe` renders through its
  `__text__` hook. In edit mode: an optional name (a Swan name; without it
  the cell writes no label, shows the table, and cannot be referred to),
  and a grid (shared with `table`: `GridCell`) whose header row holds the
  column names as plain text and whose other fields each hold one value
  as a Swan expression: `120`, `"ULS-1"`, `1.35 * Fx_k`. An empty field is
  `""`. No `=`: every field is an expression, so text needs its quotes.
  Rows and columns can be inserted and deleted anywhere: the values do
  not refer to each other (no A1 references), which is what made the
  `spreadsheet` idea messy. Why row by row: Swan enumerates namespace
  members sorted (column order would be lost), lists drop `()` (an empty
  value would shift the values after it), and headers must be free text.
  **Checking values:** a syntax error inside a Swan list drops the item
  silently (and the rest of the row with it), so each value is checked as
  it is typed: by its text (no `%>`, no comma outside brackets: write a
  tuple as `(a, b)`) and by the browser's Texl engine, in an empty
  context, as the member of a throwaway namespace beside another member
  (`nspace.size {x__: (value), y__: 1}` must be 2). A wrong field is
  outlined, with the reason as its tooltip, and the cell refuses to commit
  until it is corrected (a commit waits for checks still running). A value
  that is merely undefined, such as `1 + "a"`, passes and shows as
  `[[Undefined]]` in its table cell; such values are not listed in the
  errors pane (S7: they are not returned by the tag). A column name
  cannot contain `"` or `%>` (Swan texts have no escapes); nor can a text
  value. A source of another shape (edited by hand: comments inside the
  tag, other members) is edited as text. **The import:** when a data
  table is first written with content and no cell mentions
  `~/lib/stilo/index.texl`, the editor adds a hidden formula cell with the
  import at the top (S12, S13).
- **Shape rule** for changing type (decided 2026-10-30, O2 + O3 below). A
  structured type accepts only sources of a certain shape: `table` a
  Markdown pipe table, `formula` one tag; `text` and `markdown` accept any
  source. Each type has `accepts(source)`; white space and HTML comments
  (cell comments among them) around the content never make it refuse a
  source, and an empty source (only those) is accepted by every type, so a
  new or empty cell can take any type. The menu offers a type only if it
  accepts every selected cell; the others are greyed out with the reason.
  So a type change never converts content (D11 stands on that point).
  A structured cell refuses to commit a changed source that fails the
  round-trip check (e.g. `%>` in a formula, also inside a string): it
  stays in edit mode with a message, as Excel does; Escape discards. A
  cell whose source lacks its type's shape (edited by hand) is edited as
  text, and commits only unchanged or once it has the shape.
  Options considered (2026-10-30): O1 no type change, or only on empty
  cells; O2 change to text or Markdown always allowed; O3 change allowed
  only if the target type can parse the source (chosen, with O2 as its
  case for types that accept everything); O4 no formula type, a cell that
  is one tag shown as `= expr` (not chosen: a `formula` type under O3
  instead); O5 tables as Markdown pipe tables (the current prototype,
  decided with the table storage); O6 explicit "Convert to…" commands that
  transform the source (e.g. a list into a table), undoable but not
  lossless: later, per type, when a real case asks for it.
  A cell cannot keep a stray marker line outside a tag: the commit splits it
  (see File format).
- **(open)** The cells use CodeMirror 6, with Swan highlighting. Still to
  do: autocompletion (see Rendering), and a look that suits
  non-programmers.
- **(decided 2026-11-06)** Mod+E (Ctrl+E, or Cmd+E on macOS) inserts a `<%  %>`
  tag, E for expression. It replaces Ctrl+Space, which switches the input
  source on macOS and is the usual autocompletion key, kept free for that.
  Mod+E is two keys on every keyboard layout; while editing a cell it
  overrides the browser's search shortcut.
- **(decided 2026-11-05)** Undefined values: a value a tag returned shows as a
  highlighted `[[Undefined]]`, and the right margin counts them per line. A
  click opens it in an Errors pane: description, source line, causes and where
  it shows, as "Cell 3, line 12": in this pane a row is a cell, and a line is a
  line of text within it (left out when the cell has only one). A double click still edits. What counts as an error: S7 in
  `DECISIONS.md`. Underlining the failing position in the source while editing
  is still to do: formula and table cells need their positions mapped, and
  `pos` is a single point.
