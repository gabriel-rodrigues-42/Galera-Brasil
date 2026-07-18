import { sharedStyles } from '../shared-styles';
import { JOIN_SUBMIT, RESUME_CLICK } from '../events';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background: radial-gradient(circle at 50% 18%, rgba(255, 197, 66, 0.08), transparent 35%), rgba(11, 15, 18, 0.88);
    backdrop-filter: blur(8px);
    transition: opacity var(--transition-fast);
  }

  :host([hidden]) {
    display: none;
    opacity: 0;
    pointer-events: none;
  }

  .card {
    position: relative;
    width: min(560px, 100%);
    background: var(--color-bg-surface);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--border-ui-glow);
    padding: var(--space-6) var(--space-5);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    text-align: center;
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    color: var(--color-brand-primary);
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .join-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .input-group {
    display: flex;
    gap: var(--space-2);
    width: 100%;
  }

  .name-input {
    flex: 1;
    font-size: var(--text-md);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--border-radius-md);
  }

  .enter-btn {
    font-size: var(--text-md);
    padding: var(--space-3) var(--space-5);
    border-radius: var(--border-radius-md);
    min-width: 110px;
  }

  .status-msg {
    min-height: 1.5em;
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .resume-btn {
    width: 100%;
    font-size: var(--text-md);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--border-radius-md);
  }

  .tips-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2);
    width: 100%;
    margin-top: var(--space-4);
    border-top: var(--border-ui-stroke);
    padding-top: var(--space-4);
  }

  @media (max-width: 500px) {
    .tips-grid {
      grid-template-columns: 1fr;
    }
  }

  .tip-card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-elevated);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-md);
    text-align: left;
  }

  .tip-icon {
    font-size: var(--text-lg);
  }

  .tip-content {
    display: flex;
    flex-direction: column;
  }

  .tip-content h4 {
    margin: 0 0 2px;
    font-family: var(--font-display);
    font-size: var(--text-xs);
    color: var(--color-brand-primary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .tip-content p {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.3;
  }
`);

export class JoinOverlay extends HTMLElement {
  private formEl!: HTMLFormElement;
  private nameInputEl!: HTMLInputElement;
  private enterBtnEl!: HTMLButtonElement;
  private statusEl!: HTMLParagraphElement;
  private resumeBtnEl!: HTMLButtonElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <div class="card">
        <h1>Galera Brasil</h1>
        <form class="join-form">
          <div class="input-group">
            <input
              type="text"
              class="name-input"
              placeholder="Seu apelido..."
              maxlength="24"
              autocomplete="off"
              required
            />
            <button type="submit" class="primary enter-btn">Entrar</button>
          </div>
        </form>
        <button type="button" class="resume-btn primary hidden">Entrar na praça</button>
        <p class="status-msg"></p>
        
        <div class="tips-grid">
          <div class="tip-card">
            <div class="tip-icon">🚶</div>
            <div class="tip-content">
              <h4>Movimentação</h4>
              <p><strong>WASD</strong> para andar<br/><strong>Mouse</strong> para olhar</p>
            </div>
          </div>
          <div class="tip-card">
            <div class="tip-icon">💬</div>
            <div class="tip-content">
              <h4>Comunicação</h4>
              <p><strong>Enter</strong> abre o chat<br/><strong>C</strong> compacta o chat</p>
            </div>
          </div>
          <div class="tip-card">
            <div class="tip-icon">⚡</div>
            <div class="tip-content">
              <h4>Interação</h4>
              <p><strong>E</strong> interage<br/><strong>N</strong> adiciona posts</p>
            </div>
          </div>
          <div class="tip-card">
            <div class="tip-icon">⚔️</div>
            <div class="tip-content">
              <h4>Combate</h4>
              <p><strong>Click</strong> ataca<br/><strong>1 / 2</strong> armas · <strong>3</strong> suco</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.formEl = this.shadowRoot!.querySelector('.join-form')!;
    this.nameInputEl = this.shadowRoot!.querySelector('.name-input')!;
    this.enterBtnEl = this.shadowRoot!.querySelector('.enter-btn')!;
    this.statusEl = this.shadowRoot!.querySelector('.status-msg')!;
    this.resumeBtnEl = this.shadowRoot!.querySelector('.resume-btn')!;

    // Block keystrokes from leaking to game
    this.nameInputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.nameInputEl.value.trim().slice(0, 24);
      if (!name) return;
      this.dispatchEvent(
        new CustomEvent(JOIN_SUBMIT, {
          bubbles: true,
          composed: true,
          detail: { name },
        })
      );
    });

    this.resumeBtnEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(RESUME_CLICK, { bubbles: true, composed: true }));
    });
  }

  setName(name: string) {
    if (this.nameInputEl) {
      this.nameInputEl.value = name;
    }
  }

  setStatus(text: string) {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }

  setConnected(connected: boolean) {
    if (!this.formEl) return;
    if (connected) {
      this.formEl.classList.add('hidden');
      this.resumeBtnEl.classList.remove('hidden');
    } else {
      this.formEl.classList.remove('hidden');
      this.resumeBtnEl.classList.add('hidden');
    }
  }

  setLoading(loading: boolean) {
    if (!this.nameInputEl) return;
    this.nameInputEl.disabled = loading;
    this.enterBtnEl.disabled = loading;
  }
}
