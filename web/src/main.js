// The document fonts, bundled so that Stilo works offline
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css";
import "./theme.css";
import "./editor/index.js";
import "./components/stilo-app.js";

export { startStilo } from "./start.js";
export { API_VERSION } from "./core/extensions.js";
