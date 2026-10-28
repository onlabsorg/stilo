// Stroke icons, 24×24, drawn with currentColor.
import { svg, html } from "lit";

const icon = (paths) => html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

export const menuIcon = icon(svg`<path d="M4 7h16M4 12h16M4 17h16" />`);
export const commandsIcon = icon(
    svg`<circle cx="12" cy="5" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="19" r="1.5" fill="currentColor" />`,
);
export const commentsIcon = icon(svg`<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />`);
export const folderIcon = icon(svg`<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />`);
export const fileIcon = icon(svg`<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M14 3v5h5" />`);
export const chevronIcon = icon(svg`<path d="M9 6l6 6-6 6" />`);
export const upIcon = icon(svg`<path d="M12 19V5M6 11l6-6 6 6" />`);
export const closeIcon = icon(svg`<path d="M6 6l12 12M18 6L6 18" />`);
