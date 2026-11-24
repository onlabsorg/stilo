// Going to a place a pane points to: a line of the open document, or of
// another document (errors made in an imported one).

/** Go to `{line}` in the open document, or `{uri, line}` in the document at
 * that address, opening it first (`editor.goTo`). */
export function goTo(stilo, place) {
    return stilo.editor.goTo(place);
}

/** Follow the `go-to` events of the errors and comments services. */
export function activate(stilo) {
    const stops = [stilo.errors, stilo.comments].map((service) => service.on("go-to", (place) => goTo(stilo, place)));
    return () => stops.forEach((stop) => stop());
}
