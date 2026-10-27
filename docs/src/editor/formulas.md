# Formulas

A formula computes a value inside the text. It is written between `<%` and
`%>`:

```texl
Area: <% 3 * 4 %>
```

```text
Area: 12
```

In the editor, a line shows the result of its formulas. Press **Enter** on
the line to see the formulas themselves; **Escape** leaves it unchanged.

## Write a formula

1. Select a line and press **Alt+Enter**: an empty line appears below.
2. Press **Enter** to edit it, and type `Area: `.
3. Press **Ctrl+Space**: the editor inserts the brackets of a formula,
   `<%  %>`, with the cursor between them.
4. Type `3 * 4`, and press **Ctrl+Enter**. The line shows *Area: 12*.

## Names

A formula can give a value a name, and later formulas can use it. A formula
that only gives names shows nothing. Several names in one formula are
separated by commas:

```texl
<% L = 6, q = 12.5 %>
Span L = <% L %> m, load q = <% q %> kN/m.
The midspan moment is **<% q * L ^ 2 / 8 %> kNm**.
```

```text

Span L = 6 m, load q = 12.5 kN/m.
The midspan moment is **56.25 kNm**.
```

A name is known **on its own line and on every line below it**, as in a
calculation on paper. Change `L = 6` to `L = 8` and press **Ctrl+Enter**:
every line below that uses `L` follows.

> A name that is used before it is given, or misspelled, shows **nothing**:
> it is not an error. If a value is missing from a line, check the name, and
> check that it is given on a line above.

A formula can span several lines. `#` starts a note that runs to the end of
the line:

```texl
<%
L = 6,       # span in m
q = 12.5     # load in kN/m
%>
```

## Numbers

| Formula                            | Result |
|------------------------------------|--------|
| `7 + 3 * 2`                        | 13     |
| `(7 + 3) * 2`                      | 20     |
| `10 / 4`                           | 2.5    |
| `2 ^ 3`                            | 8      |
| `math.sqrt 16`                     | 4      |
| `math.round 2.567`                 | 3      |
| `math.round (2.567 * 100) / 100`   | 2.57   |
| `math.max (3, 8)`                  | 8      |

`math.round` rounds to a whole number. To keep two decimals, multiply by
100, round, and divide by 100, as in the table. The
[Texl manual](https://www.onlabs.org/texl/book/swan/builtins/math.html)
lists all the functions of `math`.

## Text and choices

A formula can also give text, between double quotes, and choose between two
values with `condition ? "if true" ; "if false"`:

```texl
<% section = "IPE 300", u = 0.85 %>
The section is <% section %>, utilization <% u * 100 %> %: **<% u <= 1 ? "adequate" ; "not adequate" %>**.
```

```text

The section is IPE 300, utilization 85 %: **adequate**.
```

The comparisons are `<`, `<=`, `>`, `>=`, `==` (equal) and `!=` (not
equal).

## When a formula is wrong

A formula that cannot be computed shows **`[[Undefined]]`**, and the rest of
the document still works:

```texl
Result: <% "a" - 1 %>
```

```text
Result: [[Undefined]]
```

Here, the formula subtracts a number from a word. Edit the line and fix the
formula.

## Learn more

The language of formulas is called Swan. The
[Texl manual](https://www.onlabs.org/texl/book/) describes all of it:
lists, functions, namespaces and the built-in library.
