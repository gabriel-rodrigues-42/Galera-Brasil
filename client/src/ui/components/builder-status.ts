import { sharedStyles } from '../shared-styles';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    position: fixed;
    bottom: var(--space-4);
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-hud);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    background: var(--color-bg-surface);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-md);
    box-shadow: var(--border-ui-glow);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  :host([hidden]) {
    display: none;
  }

  .item {
    font-family: var(--font-display);
  }

  .hint {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }
`);

/** Overlay shown while builder mode is active — replaces `#builder-status`. */
export class BuilderStatus extends HTMLElement {
  private itemEl!: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <span>Modo Construção: <strong class="item">🌳 Árvore</strong></span>
      <span class="hint">· [Botão Esquerdo] Colocar · [Botão Direito] Apagar · [B] Menu</span>
    `;
    this.itemEl = this.shadowRoot!.querySelector('.item')!;
  }

  setItem(label: string) {
    this.itemEl.textContent = label;
  }
}
