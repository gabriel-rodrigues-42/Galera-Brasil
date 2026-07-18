import { sharedStyles } from '../shared-styles';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    position: fixed;
    top: var(--space-4);
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-hud);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    min-width: 220px;
    padding: var(--space-2) var(--space-5);
    background: rgba(19, 26, 31, 0.85);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-md);
    box-shadow: var(--border-ui-glow);
    color: var(--color-text-primary);
    font-family: var(--font-display);
    text-align: center;
    backdrop-filter: blur(4px);
    pointer-events: none;
  }

  :host([hidden]) {
    display: none;
  }

  .title {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0;
  }

  .time {
    font-size: var(--text-xl);
    font-weight: 800;
    color: var(--color-brand-primary);
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .progress-bg {
    width: 100%;
    height: 4px;
    background: var(--color-bg-elevated);
    border-radius: 2px;
    overflow: hidden;
    margin-top: var(--space-1);
  }

  .progress-fill {
    height: 100%;
    width: 100%;
    background: var(--color-brand-primary);
    transition: width 0.2s linear;
  }

  :host(.warn) .time {
    color: var(--color-danger);
    animation: flash 1s infinite alternate;
  }

  :host(.warn) .progress-fill {
    background: var(--color-danger);
  }

  @keyframes flash {
    0% { opacity: 1; }
    100% { opacity: 0.5; }
  }
`);

export class GameTimerHud extends HTMLElement {
  private timeEl!: HTMLParagraphElement;
  private fillEl!: HTMLDivElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <p class="title">Mutirão da Praça</p>
      <p class="time">03:00</p>
      <div class="progress-bg">
        <div class="progress-fill"></div>
      </div>
    `;
    this.timeEl = this.shadowRoot!.querySelector('.time')!;
    this.fillEl = this.shadowRoot!.querySelector('.progress-fill')!;
  }

  setTime(seconds: number, maxSeconds = 180) {
    if (!this.timeEl) return;

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    this.timeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const pct = Math.max(0, Math.min(100, (seconds / maxSeconds) * 100));
    this.fillEl.style.width = `${pct}%`;

    if (seconds <= 30 && seconds > 0) {
      this.classList.add('warn');
    } else {
      this.classList.remove('warn');
    }
  }
}
