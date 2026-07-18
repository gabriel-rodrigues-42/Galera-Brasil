import { sharedStyles } from '../shared-styles';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
    z-index: var(--z-hud);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: var(--color-bg-surface);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-md);
    box-shadow: var(--border-ui-glow);
    color: var(--color-text-primary);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    cursor: pointer;
    user-select: none;
  }

  :host([hidden]) {
    display: none;
  }

  :host(:hover) {
    filter: brightness(1.1);
  }
`);

/** Fixed-position badge that opens/closes the GM panel — replaces
 * `#gm-help-badge`. Purely presentational: the controller listens for
 * `click` on the element itself (no custom event needed). */
export class GmBadge extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <span>🛠️</span>
      <span>Game Master (B)</span>
    `;
  }
}
