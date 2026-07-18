import { sharedStyles } from '../shared-styles';

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
    background: rgba(8, 12, 16, 0.88);
    backdrop-filter: blur(12px);
    font-family: var(--font-body);
    color: var(--color-text-primary);
  }

  :host([hidden]) {
    display: none !important;
  }

  .shell {
    width: min(700px, 100%);
    background: var(--color-bg-surface);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--border-ui-glow), 0 32px 64px rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-ui-stroke);
    background: var(--color-bg-elevated);
  }

  .title {
    font-family: var(--font-display);
    font-size: var(--text-md);
    color: var(--color-brand-primary);
    margin: 0;
  }

  .timer-bar-wrap {
    height: 4px;
    background: var(--color-bg-elevated);
    overflow: hidden;
  }

  .timer-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--color-brand-green), var(--color-brand-primary));
    transition: width 0.25s linear, background 0.5s;
    width: 100%;
  }

  .timer-bar.warning {
    background: linear-gradient(90deg, #e07a5f, #cc3a1b);
  }

  .body {
    padding: var(--space-4);
    min-height: 260px;
    display: flex;
    align-items: stretch;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: var(--border-ui-stroke);
    background: var(--color-bg-elevated);
  }

  .result-banner {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(8, 12, 16, 0.92);
    border-radius: var(--border-radius-lg);
    font-family: var(--font-display);
    font-size: var(--text-xl);
    gap: var(--space-3);
    animation: pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .result-banner.hidden { display: none; }

  .result-banner.success { color: var(--color-brand-green); }
  .result-banner.fail { color: #e07a5f; }

  .result-sub { font-size: var(--text-sm); color: var(--color-text-secondary); }

  @keyframes pop-in {
    from { transform: scale(0.75); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }
`);

const TITLES: Record<string, string> = {
  placa: '🔧 Placa Solar — Missão de Reparo',
  lixo: '🗑️ Coleta Seletiva — Recicle o Lixo',
  vitoria_regia: '🌿 Vitória-Régia — Calibrar pH da Água',
  mato: '🌾 Mato Seco — Capinação no Ritmo',
};

export class MinigameHost extends HTMLElement {
  private titleEl!: HTMLHeadingElement;
  private timerBarEl!: HTMLDivElement;
  private bodyEl!: HTMLDivElement;
  private resultEl!: HTMLDivElement;
  private cancelBtn!: HTMLButtonElement;

  private debrisId = '';
  private kind = '';
  private maxTime = 25;
  private timeLeft = 25;
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private succeeded = false;

  onSuccess: ((debrisId: string, kind: string) => void) | null = null;
  onCancel: (() => void) | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.render();
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <div class="shell" style="position:relative">
        <div class="header">
          <h2 class="title">Mini-jogo</h2>
        </div>
        <div class="timer-bar-wrap">
          <div class="timer-bar"></div>
        </div>
        <div class="body"></div>
        <div class="footer">
          <button type="button" class="cancel-btn">Cancelar (Esc)</button>
        </div>
        <div class="result-banner hidden"></div>
      </div>
    `;

    this.titleEl = this.shadowRoot!.querySelector('.title')!;
    this.timerBarEl = this.shadowRoot!.querySelector('.timer-bar')!;
    this.bodyEl = this.shadowRoot!.querySelector('.body')!;
    this.resultEl = this.shadowRoot!.querySelector('.result-banner')!;
    this.cancelBtn = this.shadowRoot!.querySelector('.cancel-btn')!;

    this.cancelBtn.addEventListener('click', () => this.cancel());
  }

  open(debrisId: string, kind: string) {
    this.debrisId = debrisId;
    this.kind = kind;
    this.succeeded = false;
    this.hidden = false;
    this.resultEl.classList.add('hidden');
    this.titleEl.textContent = TITLES[kind] ?? 'Mini-jogo de Reparo';
    this.maxTime = kind === 'mato' ? 20 : 25;
    this.timeLeft = this.maxTime;
    this.updateTimerBar();
    this.spawnMinigame(kind);
    this.startTimer();
  }

  private spawnMinigame(kind: string) {
    this.bodyEl.innerHTML = '';
    let tag = '';
    if (kind === 'placa') tag = 'minigame-wire';
    else if (kind === 'lixo') tag = 'minigame-sort';
    else if (kind === 'vitoria_regia') tag = 'minigame-ph';
    else if (kind === 'mato') tag = 'minigame-rhythm';
    if (!tag) return;
    const el = document.createElement(tag);
    el.style.flex = '1';
    this.bodyEl.appendChild(el);

    el.addEventListener('minigame-success', () => this.succeed());
  }

  private startTimer() {
    this.clearTimer();
    this.timerHandle = setInterval(() => {
      this.timeLeft -= 0.25;
      this.updateTimerBar();
      if (this.timeLeft <= 0 && !this.succeeded) {
        this.fail();
      }
    }, 250);
  }

  private updateTimerBar() {
    const pct = Math.max(0, this.timeLeft / this.maxTime) * 100;
    this.timerBarEl.style.width = `${pct}%`;
    this.timerBarEl.classList.toggle('warning', pct < 30);
  }

  private succeed() {
    if (this.succeeded) return;
    this.succeeded = true;
    this.clearTimer();
    this.showResult(true);
    this.onSuccess?.(this.debrisId, this.kind);
    setTimeout(() => this.close(), 1800);
  }

  private fail() {
    this.clearTimer();
    this.showResult(false);
    setTimeout(() => this.cancel(), 1800);
  }

  private showResult(success: boolean) {
    this.resultEl.classList.remove('hidden', 'success', 'fail');
    this.resultEl.classList.add(success ? 'success' : 'fail');
    this.resultEl.innerHTML = success
      ? `<span>✅ Missão Cumprida!</span><span class="result-sub">Trabalho excelente, companheiro!</span>`
      : `<span>⏰ Tempo Esgotado!</span><span class="result-sub">Tente novamente.</span>`;
  }

  private cancel() {
    this.clearTimer();
    this.close();
    this.onCancel?.();
  }

  private close() {
    this.hidden = true;
    this.bodyEl.innerHTML = '';
  }

  private clearTimer() {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
