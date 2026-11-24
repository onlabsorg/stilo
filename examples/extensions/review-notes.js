// Review notes: an example extension of Stilo's web app (docs/extensions.md,
// "Notes on a packed package"). A single user reviews a packed package (a
// release, read-only) and leaves notes on its cells, each a short rich text
// with a status, open or closed. A small version of what Papiro's Threads
// panel does (OnLabs D25, Stilo S29), on the same hooks:
//
// - `tree.archiveOf` and `transport.sha256`: the release the open document
//   belongs to, identified by the SHA-256 of its `.texlz`; an unpacked
//   folder cannot be noted;
// - `commands` and `menus.add("editor/cell", …)`: "New note…" on the cell a
//   menu opened on (or the selected one), read-only documents included;
// - `ui.write`: the note, written with the rich text editor, as Markdown;
// - `editor.decorate` and `mark-click`: a count of notes in the margin of
//   the cells that have them, which opens the panel;
// - `panels`: the notes of the release, each rendered by
//   `editor.renderHtml` and linking to its cell with `editor.goTo`.
//
// The notes are kept in the browser (`settings`), by release; a real
// extension keeps them on a server (Papiro: beside the package). It
// imports nothing from Stilo: everything comes on the `stilo` object.

/** The marker of the marks this extension puts on cells. */
const MARK = "review-notes";

export default {
    id: "review-notes",
    apiVersion: "1.0",
    activate(stilo) {
        const { html, css, LitElement } = stilo;

        /** The release of the open document, and its notes. */
        const state = {
            /** The packed package the open document is in, or null. */
            archive: null,
            /** Its SHA-256, once known. */
            release: null,
            /** The notes of the release: `{id, path, cell, text, status, created}`,
             * `path` inside the package. */
            notes: [],
            /** The cell whose notes are pointed out, or null. */
            current: null,
        };

        /** The open document's path inside its package. */
        const inside = (path) => path.slice(state.archive.length + 1);

        const save = () => stilo.settings.set(state.release, state.notes);

        /** Show what changed: marks, panel, badge. */
        const changed = () => {
            stilo.editor.invalidate();
            stilo.panels.changed();
            const open = state.notes.filter((note) => note.status === "open").length;
            stilo.panels.setBadge("review-notes.panel", open ? { text: String(open), label: `${open} open notes` } : null);
        };

        /** Find the release of the open document and read its notes. */
        const load = async () => {
            const path = stilo.document.path;
            const archive = stilo.tree.archiveOf(path);
            if (archive !== state.archive) Object.assign(state, { archive, release: null, notes: [], current: null });
            if (archive && !state.release) {
                try {
                    const release = await stilo.transport.sha256(archive);
                    if (archive !== state.archive) return; // another document meanwhile
                    state.release = release;
                    state.notes = stilo.settings.get(release, []) ?? [];
                } catch (error) {
                    stilo.ui.notify(`Review notes: ${error.message}`, { level: "warning" });
                }
            }
            changed();
        };
        stilo.document.on("open", load);

        // "New note…": on the cell a menu opened on, or the selected one
        stilo.commands.register({
            id: "review-notes.new",
            label: "New note…",
            group: "Review notes",
            enabled: (s, context = {}) => {
                if (!stilo.document.path) return "no document is open";
                if (!state.archive) return "only a packed package (a release) can be noted";
                if (!state.release) return "the release is not identified yet";
                const cell = context.cell ?? stilo.editor.selection?.cell;
                return cell ? true : "this line has no cell name";
            },
            run: async (s, context = {}) => {
                const cell = context.cell ?? stilo.editor.selection.cell;
                const text = await stilo.ui.write("New note on this cell", "", { ok: "Add note" });
                if (!text?.trim()) return;
                const path = inside(stilo.document.path);
                state.notes = [
                    ...state.notes,
                    { id: crypto.randomUUID(), path, cell, text, status: "open", created: new Date().toISOString() },
                ];
                state.current = cell;
                save();
                changed();
                stilo.ui.openPane("review-notes.panel");
            },
        });
        stilo.menus.add("editor/cell", "review-notes.new", { group: "review" });

        // A count of notes in the margin of the cells that have them
        stilo.editor.decorate(({ path }) => {
            if (!state.archive || stilo.tree.archiveOf(path) !== state.archive) return [];
            const counts = new Map();
            for (const note of state.notes) if (note.path === inside(path)) counts.set(note.cell, (counts.get(note.cell) ?? 0) + 1);
            return [...counts].map(([cell, count]) => ({
                cell,
                text: `✎ ${count}`,
                tone: "accent",
                title: count === 1 ? "1 note" : `${count} notes`,
                [MARK]: true,
            }));
        });
        stilo.editor.on("mark-click", ({ cell, mark }) => {
            if (!mark?.[MARK]) return;
            state.current = cell;
            stilo.ui.openPane("review-notes.panel");
            stilo.panels.changed();
        });

        // A note's text, rendered as Stilo renders a rich cell
        class NoteText extends LitElement {
            static properties = { markdown: { type: String } };
            static styles = css`
                :host {
                    display: block;
                    line-height: 1.5;
                }
                :host > :first-child > :first-child {
                    margin-top: 0;
                }
            `;
            constructor() {
                super();
                this.markdown = "";
            }
            async updated(changed) {
                if (!changed.has("markdown")) return;
                const markdown = this.markdown;
                const rendered = await stilo.editor.renderHtml(`<!--{ note : rich }-->\n${markdown}\n`);
                // Sanitised by Stilo: documents are untrusted
                if (markdown === this.markdown) this.renderRoot.innerHTML = rendered;
            }
        }
        if (!customElements.get("review-note-text")) customElements.define("review-note-text", NoteText);

        const setStatus = (note, status) => {
            state.notes = state.notes.map((n) => (n.id === note.id ? { ...n, status } : n));
            save();
            changed();
        };

        const renderNote = (note) => html`<li class="note ${note.status} ${note.cell === state.current ? "current" : ""}" data-note=${note.id}>
            <div class="where">
                <a
                    href="#"
                    title="Go to the cell"
                    @click=${(e) => {
                        e.preventDefault();
                        state.current = note.cell;
                        stilo.editor.goTo({ path: `${state.archive}/${note.path}`, cell: note.cell }).then((found) => {
                            if (!found) stilo.ui.notify("The cell of this note is not in the document", { level: "warning" });
                        });
                    }}
                    >${note.path} · ${note.cell}</a
                >
                <span class="status">${note.status === "open" ? "Open" : "Closed"}</span>
            </div>
            <review-note-text .markdown=${note.text}></review-note-text>
            <button class="toggle" @click=${() => setStatus(note, note.status === "open" ? "closed" : "open")}>
                ${note.status === "open" ? "Close" : "Reopen"}
            </button>
        </li>`;

        stilo.panels.register({
            id: "review-notes.panel",
            label: "Review notes",
            icon: html`<svg class="icon" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></svg>`,
            order: 40,
            render: () => html`<style>
                    .review-notes { margin: 0; padding: 0 0.75rem; list-style: none; }
                    .review-notes .note { margin: 0 0 0.75rem; padding: 0.5rem 0.625rem; border: 1px solid var(--border); border-radius: var(--radius); }
                    .review-notes .note.current { border-color: var(--accent); }
                    .review-notes .note.closed review-note-text { color: var(--text-muted); }
                    .review-notes .where { display: flex; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.25rem; font-size: 12px; }
                    .review-notes .where a { color: var(--accent); }
                    .review-notes .status { color: var(--text-muted); }
                    .review-notes .toggle { margin-top: 0.375rem; font: inherit; font-size: 12px; }
                    .review-notes-empty { padding: 0 0.75rem; color: var(--text-muted); }
                </style>
                <div class="pane-header">Review notes</div>
                ${!state.archive
                    ? html`<p class="review-notes-empty">Open a document of a packed package (a release) to review it.</p>`
                    : !state.notes.length
                      ? html`<p class="review-notes-empty">No notes on this release. Right-click a cell: New note….</p>`
                      : html`<ul class="review-notes">
                            ${state.notes.map(renderNote)}
                        </ul>`}`,
        });

        // A document may be open already
        if (stilo.document.path) load();
    },
};
