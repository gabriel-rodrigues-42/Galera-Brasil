import { sharedStyles } from '../shared-styles';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    position: fixed;
    left: 50%;
    /* Above the hotbar (bottom 110px + ~70px slots) so prompts never hide
     * behind the weapon slots. */
    bottom: 196px;
    transform: translateX(-50%);
    z-index: var(--z-hud);
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(10, 20, 15, 0.65);
    color: #f4f1e8;
    font-size: 0.95rem;
    white-space: nowrap;
    pointer-events: none;
    transition: opacity 0.15s ease;
    opacity: 0;
  }

  :host(.visible) {
    opacity: 1;
  }
`);

/** Bottom-center contextual prompt ("Pressione E — ..."), driven entirely
 * by main.ts's updateInteraction() each frame. */
export class InteractHint extends HTMLElement {
  private textEl!: HTMLSpanElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `<span class="text"></span>`;
    this.textEl = this.shadowRoot!.querySelector('.text')!;
  }

  setText(text: string) {
    if (!this.textEl) return;
    this.textEl.textContent = text;
    this.classList.toggle('visible', text !== '');
  }
}
