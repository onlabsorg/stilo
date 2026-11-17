# @onlabsorg/stilo-web

The web app of [Stilo](https://github.com/onlabsorg/stilo), the editor of
[Texl](https://github.com/onlabsorg/texl) documents, and its `<texl-editor>`
component, as plain ES modules (Lit web components). Most people want the
`stilo` command instead (`pip install stilo-cli`), which includes this web app
already built; this package is for developers who build their own front end
or embed the editor.

```sh
npm install @onlabsorg/stilo-web
npm install --save-dev vite
```

| Import                             | Gives                                            |
|------------------------------------|--------------------------------------------------|
| `@onlabsorg/stilo-web`             | The whole app: fonts, theme, `<stilo-app>`; `startStilo({target, extensions, transport})`, which starts it with extensions, and `API_VERSION`; `createStilo`, `StiloProvider`, `StiloController`, `stiloContext` for front ends composed differently. It talks to a server that speaks Stilo's protocol, at the page's origin |
| `@onlabsorg/stilo-web/editor`      | `<texl-editor>`, the built-in cells, `TexlCell`, `registerCell`, the document functions |
| `@onlabsorg/stilo-web/theme.css`   | The design tokens, light and dark                |

Only these imports are the package's interface; other files may change
without notice. Before 1.0, any version may change it.

Build with [Vite](https://vite.dev/) (or a bundler that handles
`?inline` stylesheets and assets loaded by `new URL(…, import.meta.url)`),
and exclude Texl from dependency pre-bundling, since its WebAssembly glue
loads the `.wasm` file by a URL relative to itself:

```js
// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
    optimizeDeps: { exclude: ["@onlabsorg/texl"] },
});
```

Writing extensions:
[docs/extensions.md](https://github.com/onlabsorg/stilo/blob/main/docs/extensions.md).
Guide and API reference:
[embedding the editor](https://github.com/onlabsorg/stilo/blob/main/docs/component/README.md).
License: MIT.
