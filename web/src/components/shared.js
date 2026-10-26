import { css } from "lit";

// Styles shared by the app's components.
export const base = css`
    :host {
        box-sizing: border-box;
    }
    *,
    *::before,
    *::after {
        box-sizing: inherit;
    }
    .icon {
        width: 18px;
        height: 18px;
        flex: none;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.75;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    button.icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        border: 0;
        border-radius: var(--radius);
        background: none;
        color: var(--text-muted);
        cursor: pointer;
        transition: background var(--transition), color var(--transition);
    }
    button.icon-button:hover {
        background: var(--hover);
        color: var(--text);
    }
    button.icon-button[aria-pressed="true"] {
        background: var(--active);
        color: var(--accent);
    }
    button:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
    }
    .pane-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        height: 2.5rem;
        padding: 0 0.5rem 0 1rem;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
    }
    .pane-header .spacer {
        flex: 1;
    }
    .empty {
        padding: 0.5rem 1rem;
        color: var(--text-muted);
    }
`;
