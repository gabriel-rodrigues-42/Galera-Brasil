import { sharedStyles } from '../shared-styles';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    position: fixed;
    top: var(--space-4);
    left: var(--space-4);
    z-index: var(--z-hud);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 260px;
    padding: var(--space-3) var(--space-4);
    background: rgba(19, 26, 31, 0.85);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-md);
    box-shadow: var(--border-ui-glow);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    backdrop-filter: blur(4px);
    pointer-events: none;
  }

  :host([hidden]) {
    display: none;
  }

  .header {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: bold;
    color: var(--color-brand-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .task-desc {
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--color-text-primary);
    margin: 0;
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-top: var(--space-1);
  }

  .progress-label {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .progress-bar-bg {
    width: 100%;
    height: 8px;
    background: var(--color-bg-elevated);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    width: 0%;
    background: var(--color-brand-green);
    border-radius: 4px;
    transition: width 0.3s ease;
  }
`);

export class GameQuestGuide extends HTMLElement {
  private descEl!: HTMLParagraphElement;
  private fillEl!: HTMLDivElement;
  private textEl!: HTMLSpanElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <p class="header">Objetivo do Mutirão</p>
      <p class="task-desc">Carregando tarefas...</p>
      <div class="progress-section">
        <div class="progress-label">
          <span>Progresso de Limpeza</span>
          <span class="progress-text">0/0 (0%)</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill"></div>
        </div>
      </div>
    `;
    this.descEl = this.shadowRoot!.querySelector('.task-desc')!;
    this.fillEl = this.shadowRoot!.querySelector('.progress-bar-fill')!;
    this.textEl = this.shadowRoot!.querySelector('.progress-text')!;
  }

  updateProgress(cleared: number, total: number, description: string) {
    if (!this.descEl) return;
    this.descEl.textContent = description;

    const pct = total > 0 ? Math.max(0, Math.min(100, (cleared / total) * 100)) : 0;
    this.fillEl.style.width = `${pct}%`;
    this.textEl.textContent = `${cleared}/${total} (${Math.round(pct)}%)`;
  }
}
