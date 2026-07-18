import { sharedStyles } from '../shared-styles';
import { escapeHtml } from '../escape';

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
    background: rgba(11, 15, 18, 0.9);
    backdrop-filter: blur(8px);
    font-family: var(--font-body);
    color: var(--color-text-primary);
  }

  :host([hidden]) {
    display: none !important;
  }

  .card {
    width: min(640px, 100%);
    background: var(--color-bg-surface);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--border-ui-glow);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: var(--border-ui-stroke);
    padding-bottom: var(--space-3);
  }

  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    color: var(--color-brand-primary);
  }

  .timer {
    font-family: var(--font-display);
    font-size: var(--text-md);
    font-weight: bold;
    color: var(--color-danger);
    background: rgba(224, 122, 95, 0.1);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--border-radius-sm);
    font-variant-numeric: tabular-nums;
  }

  .prompt {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: var(--space-2);
    max-height: 280px;
    overflow-y: auto;
    padding: var(--space-1);
  }

  .player-card {
    background: var(--color-bg-elevated);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-md);
    padding: var(--space-3) var(--space-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    transition: transform var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
    position: relative;
    user-select: none;
  }

  .player-card:hover:not(.disabled) {
    transform: translateY(-2px);
    border-color: var(--color-brand-primary);
    background: var(--color-bg-surface);
  }

  .player-card.selected {
    border-color: var(--color-brand-green);
    background: rgba(129, 178, 154, 0.15);
  }

  .player-card.disabled {
    cursor: default;
    opacity: 0.6;
  }

  .player-card.ghost {
    background: rgba(255, 255, 255, 0.05);
    border-style: dashed;
  }

  .avatar-icon {
    font-size: var(--text-xl);
  }

  .player-name {
    font-size: var(--text-xs);
    font-weight: bold;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }

  .voted-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: 10px;
    color: var(--color-brand-green);
    display: none;
  }

  .player-card.voted .voted-badge {
    display: block;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-2);
    border-top: var(--border-ui-stroke);
    padding-top: var(--space-3);
  }

  .skip-btn {
    font-size: var(--text-xs);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--border-radius-md);
  }
`);

export class GameAssemblyOverlay extends HTMLElement {
  private titleEl!: HTMLHeadingElement;
  private timerEl!: HTMLSpanElement;
  private promptEl!: HTMLParagraphElement;
  private gridEl!: HTMLDivElement;
  private skipBtnEl!: HTMLButtonElement;

  private selectedId: string | null = null;
  private isVotingPhase = false;
  private isGhost = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <div class="card">
        <div class="header">
          <h2 class="title">Assembleia de Bairro</h2>
          <span class="timer">00:00</span>
        </div>
        <p class="prompt">Debatam no chat quem é o sabotador que está estragando o mutirão.</p>
        <div class="players-grid"></div>
        <div class="actions">
          <button type="button" class="skip-btn secondary">Pular Voto (Skip)</button>
        </div>
      </div>
    `;

    this.titleEl = this.shadowRoot!.querySelector('.title')!;
    this.timerEl = this.shadowRoot!.querySelector('.timer')!;
    this.promptEl = this.shadowRoot!.querySelector('.prompt')!;
    this.gridEl = this.shadowRoot!.querySelector('.players-grid')!;
    this.skipBtnEl = this.shadowRoot!.querySelector('.skip-btn')!;

    this.skipBtnEl.addEventListener('click', () => {
      if (this.isGhost || !this.isVotingPhase || this.selectedId !== null) return;
      this.selectVote('skip');
    });
  }

  setup(isGhost: boolean) {
    this.isGhost = isGhost;
  }

  setTimer(seconds: number, phase: 'discussion' | 'voting') {
    if (!this.timerEl) return;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    this.timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const prevPhase = this.isVotingPhase;
    this.isVotingPhase = phase === 'voting';

    if (this.isVotingPhase !== prevPhase) {
      if (this.isVotingPhase) {
        this.titleEl.textContent = '🗳️ Assembleia: Votação';
        this.promptEl.textContent = this.isGhost
          ? 'Você é um fantasma e não pode votar, mas assista à votação.'
          : 'Selecione quem você suspeita ser o sabotador, ou pule o voto.';
        this.skipBtnEl.disabled = this.isGhost;
      } else {
        this.titleEl.textContent = '📢 Assembleia: Discussão';
        this.promptEl.textContent =
          'Debatam no chat quem é o sabotador que está estragando o mutirão.';
        this.skipBtnEl.disabled = true;
        this.selectedId = null;
      }
    }
  }

  setPlayers(
    playersList: { sessionId: string; name: string; isGhost: boolean; hasVoted: boolean }[]
  ) {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';

    playersList.forEach((player) => {
      const card = document.createElement('div');
      card.className = `player-card`;
      if (player.isGhost) card.classList.add('ghost');
      if (player.hasVoted) card.classList.add('voted');
      if (player.sessionId === this.selectedId) card.classList.add('selected');
      if (this.isGhost || !this.isVotingPhase || player.isGhost || this.selectedId !== null) {
        card.classList.add('disabled');
      }

      card.innerHTML = `
        <span class="avatar-icon">${player.isGhost ? '👻' : '👤'}</span>
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="voted-badge">✅</span>
      `;

      if (!this.isGhost && this.isVotingPhase && !player.isGhost && this.selectedId === null) {
        card.addEventListener('click', () => {
          this.selectVote(player.sessionId);
        });
      }

      this.gridEl.appendChild(card);
    });
  }

  private selectVote(targetId: string) {
    this.selectedId = targetId;
    this.dispatchEvent(
      new CustomEvent('cast-vote', {
        bubbles: true,
        composed: true,
        detail: { targetId },
      })
    );
    this.skipBtnEl.disabled = true;

    // Highlight local cards
    const cards = this.gridEl.querySelectorAll('.player-card');
    cards.forEach((c) => c.classList.add('disabled'));
  }
}
