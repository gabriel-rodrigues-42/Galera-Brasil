/**
 * <minigame-sort> — Garbage Sorting Game
 *
 * Displays 6 items. Player clicks an item then clicks the correct bin to sort it.
 * All sorted correctly fires 'minigame-success'.
 */

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    user-select: none;
  }

  .instructions {
    text-align: center;
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .items-row {
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .item {
    width: 54px;
    height: 54px;
    border-radius: var(--border-radius-md);
    background: var(--color-bg-elevated);
    border: 2px solid var(--color-bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  }

  .item:hover { transform: scale(1.1); }
  .item.selected {
    border-color: var(--color-brand-primary);
    box-shadow: 0 0 10px rgba(74,138,79,0.5);
    transform: scale(1.12);
  }
  .item.sorted { opacity: 0; pointer-events: none; transition: opacity 0.4s; }

  .bins-row {
    display: flex;
    justify-content: center;
    gap: 14px;
  }

  .bin {
    flex: 1;
    max-width: 120px;
    min-height: 80px;
    border-radius: var(--border-radius-md);
    border: 2px dashed var(--color-bg-elevated);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: var(--space-2);
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    font-size: 20px;
  }

  .bin .label {
    font-size: 11px;
    color: var(--color-text-secondary);
    text-align: center;
  }

  .bin[data-kind="plastico"] { border-color: rgba(255, 193, 7, 0.4); }
  .bin[data-kind="papel"]    { border-color: rgba(33, 150, 243, 0.4); }
  .bin[data-kind="organico"] { border-color: rgba(139, 195, 74, 0.4); }

  .bin[data-kind="plastico"]:hover { background: rgba(255, 193, 7, 0.1); border-color: rgba(255, 193, 7, 0.8); }
  .bin[data-kind="papel"]:hover    { background: rgba(33, 150, 243, 0.1); border-color: rgba(33, 150, 243, 0.8); }
  .bin[data-kind="organico"]:hover { background: rgba(139, 195, 74, 0.1); border-color: rgba(139, 195, 74, 0.8); }

  .bin.wrong-flash { animation: flash-red 0.4s; }
  .bin.right-flash { animation: flash-green 0.4s; }

  @keyframes flash-red {
    0%,100% { background: transparent; }
    50%      { background: rgba(224, 122, 95, 0.3); }
  }
  @keyframes flash-green {
    0%,100% { background: transparent; }
    50%      { background: rgba(129, 178, 154, 0.3); }
  }
`);

type BinKind = 'plastico' | 'papel' | 'organico';

const WASTE_ITEMS: { emoji: string; bin: BinKind }[] = [
  { emoji: '🍌', bin: 'organico' },
  { emoji: '📄', bin: 'papel' },
  { emoji: '🧴', bin: 'plastico' },
  { emoji: '🥫', bin: 'organico' },
  { emoji: '📰', bin: 'papel' },
  { emoji: '🛍️', bin: 'plastico' },
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const a = [...arr].sort(() => Math.random() - 0.5);
  return a.slice(0, n);
}

export class MinigameSort extends HTMLElement {
  private shadow!: ShadowRoot;
  private items: { emoji: string; bin: BinKind }[] = [];
  private selectedIdx: number | null = null;
  private sortedCount = 0;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadow.adoptedStyleSheets = [sheet];
    this.items = pickRandom(WASTE_ITEMS, 6);
    this.sortedCount = 0;
    this.selectedIdx = null;
    this.render();
  }

  private render() {
    this.shadow.innerHTML = `
      <p class="instructions">Clique num item e depois no lixão correto para reciclar!</p>
      <div class="items-row">
        ${this.items.map((it, i) => `<div class="item" data-i="${i}">${it.emoji}</div>`).join('')}
      </div>
      <div class="bins-row">
        <div class="bin" data-kind="plastico">🟡<span class="label">Plástico</span></div>
        <div class="bin" data-kind="papel">🔵<span class="label">Papel</span></div>
        <div class="bin" data-kind="organico">🟤<span class="label">Orgânico</span></div>
      </div>
    `;

    this.shadow.querySelectorAll('.item').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number((el as HTMLElement).dataset.i);
        if ((el as HTMLElement).classList.contains('sorted')) return;
        this.shadow.querySelectorAll('.item').forEach((e) => e.classList.remove('selected'));
        (el as HTMLElement).classList.add('selected');
        this.selectedIdx = i;
      });
    });

    this.shadow.querySelectorAll('.bin').forEach((bin) => {
      bin.addEventListener('click', () => {
        if (this.selectedIdx === null) return;
        const chosen = (bin as HTMLElement).dataset.kind as BinKind;
        const correct = this.items[this.selectedIdx].bin;
        const itemEl = this.shadow.querySelector(
          `.item[data-i="${this.selectedIdx}"]`
        ) as HTMLElement;

        if (chosen === correct) {
          itemEl.classList.add('sorted');
          itemEl.classList.remove('selected');
          bin.classList.add('right-flash');
          setTimeout(() => bin.classList.remove('right-flash'), 450);
          this.sortedCount++;
          this.selectedIdx = null;
          if (this.sortedCount >= this.items.length) {
            setTimeout(() => {
              this.dispatchEvent(
                new CustomEvent('minigame-success', { bubbles: true, composed: true })
              );
            }, 350);
          }
        } else {
          bin.classList.add('wrong-flash');
          itemEl.classList.add('wrong-flash');
          setTimeout(() => {
            bin.classList.remove('wrong-flash');
            itemEl.classList.remove('wrong-flash');
          }, 450);
        }
      });
    });
  }
}
