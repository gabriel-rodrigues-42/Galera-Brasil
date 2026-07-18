import { sharedStyles } from '../shared-styles';

const modalSheet = new CSSStyleSheet();
modalSheet.replaceSync(`
  :host {
    position: fixed;
    inset: 0;
    z-index: var(--z-panel);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :host([hidden]) {
    display: none;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
  }

  .frame {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(92vw, 540px);
    max-height: 86dvh;
    background: var(--color-bg-surface);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--border-ui-glow);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    overflow: hidden;
  }

  :host([wide]) .frame {
    width: min(94vw, 760px);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    border-bottom: var(--border-ui-stroke);
  }

  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .close {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    font-size: var(--text-lg);
    line-height: 1;
    padding: var(--space-1) var(--space-2);
  }

  .close:hover {
    color: var(--color-text-primary);
    filter: none;
  }

  .body {
    padding: var(--space-5);
    overflow-y: auto;
  }
`);

/** Shared modal chrome: backdrop + frame + title + close button, content
 * slotted. See DESIGN.md §4 — the only chrome primitive; everything else is
 * a panel-level component. Attributes: `title`, `wide`. Fires `panel-close`
 * on backdrop click or close-button click. */
export class UiModal extends HTMLElement {
  static get observedAttributes() {
    return ['title'];
  }

  private titleEl!: HTMLHeadingElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, modalSheet];
    this.shadowRoot!.innerHTML = `
      <div class="backdrop" part="backdrop"></div>
      <div class="frame" part="frame">
        <header>
          <h2></h2>
          <button type="button" class="close" aria-label="Fechar">✕</button>
        </header>
        <div class="body">
          <slot></slot>
        </div>
      </div>
    `;
    this.titleEl = this.shadowRoot!.querySelector('h2')!;
    this.titleEl.textContent = this.getAttribute('title') ?? '';

    this.shadowRoot!.querySelector('.backdrop')!.addEventListener('click', () =>
      this.requestClose()
    );
    this.shadowRoot!.querySelector('.close')!.addEventListener('click', () => this.requestClose());
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (name === 'title' && this.titleEl) {
      this.titleEl.textContent = value ?? '';
    }
  }

  private requestClose() {
    this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true, composed: true }));
  }
}
