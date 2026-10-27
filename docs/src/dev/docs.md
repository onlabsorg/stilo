# The documentation

*How this site is built, and the rules for writing it.*

`docs/build.sh` builds the site into `target/site`, and the workflow
`.github/workflows/docs.yml` publishes it on GitHub Pages at every push to
`main`:

| Published         | Source                        | Built with             |
|-------------------|-------------------------------|------------------------|
| `index.html`      | `docs/site/index.html`    | copied                 |
| `assets/`         | `docs/assets/`            | copied                 |
| `book/`           | `docs/src/` (with `docs/book.toml`) | mdBook 0.4 |

```sh
docs/build.sh                         # builds target/site
python3 -m http.server -d target/site # preview at http://localhost:8000/
```

`build.sh` needs mdBook on the `PATH` (or in `MDBOOK`). It deletes
`target/site` and builds it again. Nothing built is committed.

`CONTRIBUTING.md` and `CHANGELOG.md` at the repository root are included in
the manual, so they read well both on GitHub and here.

{{#include ../../STYLE.md:3:}}
