// Going to a place a pane points to: a line of the open document, or of
// another document (errors made in an imported one).

/** Go to `{line}` in the open document, or `{uri, line}` in the document at
 * that address, opening it first. */
export async function goTo(stilo, { uri, line }) {
    const { router, document, transport, editor } = stilo;
    const path = uri ? transport.documentPath(new URL(uri)) : document.path;
    if (!path) return;
    if (path !== document.path) await router.go({ root: router.root, doc: path });
    if (path !== document.path) return; // the user kept the unsaved changes
    await editor.reveal(line);
}

/** Follow the `go-to` events of the errors and comments services. */
export function activate(stilo) {
    const stops = [stilo.errors, stilo.comments].map((service) => service.on("go-to", (place) => goTo(stilo, place)));
    return () => stops.forEach((stop) => stop());
}
