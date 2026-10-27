/*
 * Adds the site navigation to mdBook's menu bar: the Stilo wordmark, linking
 * to the landing page, and links to the main parts of the documentation.
 * `path_to_root` is defined by mdBook on every page.
 */
(function () {
    "use strict";

    /* global path_to_root */
    var book = typeof path_to_root === "string" ? path_to_root : "";
    var site = book + "../";

    var title = document.querySelector("#menu-bar .menu-title");
    if (title) {
        title.innerHTML =
            '<a class="tx-wordmark" href="' + site + 'index.html" title="Stilo home">' +
            '<span class="tx-delim">&para;</span>stilo</a>';
    }

    var right = document.querySelector("#menu-bar .right-buttons");
    if (right) {
        var links = document.createElement("nav");
        links.className = "tx-book-links";
        links.setAttribute("aria-label", "Site");
        links.innerHTML =
            '<a class="tx-optional" href="' + book + 'cli/index.html">Command</a>' +
            '<a class="tx-optional" href="' + book + 'editor/index.html">Editor</a>' +
            '<a class="tx-optional" href="' + book + 'protocol.html">Protocol</a>' +
            '<a href="' + book + 'dev/index.html">Develop</a>';
        right.insertBefore(links, right.firstChild);
    }
})();
