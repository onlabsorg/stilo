// The entry point of the app and of the package `@onlabsorg/stilo-web`: the
// document fonts, the theme, the editor and `<stilo-app>`, and the API for
// extensions and front ends (S16, S17; docs/extensions.md).

// The document fonts, bundled so that Stilo works offline
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css";
import "./theme.css";
import "./editor/index.js";
import "./components/stilo-app.js";

export { startStilo } from "./start.js";
export { API_VERSION } from "./core/extensions.js";
// For front ends composed of Stilo's parts, and extensions bundled with one
export { createStilo, stiloContext, StiloController, StiloProvider } from "./core/index.js";
