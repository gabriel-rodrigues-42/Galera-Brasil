/**
 * <minigame-ph> — Lily pH Calibration Game
 *
 * Three sliders controlling pH factors. Each has a highlighted target zone.
 * Player must move all three into the green zone simultaneously.
 * Fires 'minigame-success' when all are in range for 1.5s.
 */

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 100%;
    user-select: none;
  }

  .instructions {
    text-align: center;
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .slider-label {
    width: 90px;
    font-size: 12px;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .slider-wrap {
    flex: 1;
    position: relative;
    height: 28px;
    display: flex;
    align-items: center;
  }

  .track {
    position: absolute;
    left: 0; right: 0;
    height: 8px;
    border-radius: 4px;
    background: var(--color-bg-elevated);
    overflow: visible;
  }

  .target-zone {
    position: absolute;
    height: 100%;
    background: rgba(129, 178, 154, 0.35);
    border-radius: 4px;
    border: 1px solid rgba(129, 178, 154, 0.7);
    transition: background 0.3s;
  }

  .target-zone.in-range {
    background: rgba(129, 178, 154, 0.7);
    box-shadow: 0 0 8px rgba(129, 178, 154, 0.5);
  }

  input[type='range'] {
    position: relative;
    z-index: 1;
    width: 100%;
    margin: 0;
    cursor: pointer;
    accent-color: var(--color-brand-primary);
  }

  .value-badge {
    width: 40px;
    text-align: right;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-secondary);
  }

  .value-badge.in-range { color: var(--color-brand-green); font-weight: bold; }

  .lock-indicator {
    text-align: center;
    font-size: 13px;
    color: var(--color-text-secondary);
    height: 20px;
  }

  .lock-indicator.locking { color: var(--color-brand-green); font-weight: bold; }
`);

interface SliderDef {
  label: string;
  value: number;
  targetMin: number;
  targetMax: number;
}

function makeSliders(): SliderDef[] {
  return [
    {
      label: '💧 Acidez (pH)',
      value: Math.random() * 100,
      targetMin: 55 + Math.random() * 15,
      targetMax: 0,
    },
    {
      label: '🌡️ Temperatura',
      value: Math.random() * 100,
      targetMin: 40 + Math.random() * 20,
      targetMax: 0,
    },
    {
      label: '🧪 Oxidação',
      value: Math.random() * 100,
      targetMin: 45 + Math.random() * 15,
      targetMax: 0,
    },
  ].map((s) => ({ ...s, targetMax: Math.min(100, s.targetMin + 18) }));
}

export class MinigamePh extends HTMLElement {
  private shadow!: ShadowRoot;
  private sliders: SliderDef[] = [];
  private inRangeSince: number | null = null;
  private rafId: number | null = null;
  private done = false;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadow.adoptedStyleSheets = [sheet];
    this.sliders = makeSliders();
    this.done = false;
    this.inRangeSince = null;
    this.render();
    this.startLoop();
  }

  disconnectedCallback() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  private render() {
    this.shadow.innerHTML = `
      <p class="instructions">Ajuste os três controles para dentro da faixa verde simultaneamente!</p>
      <div class="slider-group">
        ${this.sliders
          .map(
            (s, i) => `
          <div class="slider-row">
            <span class="slider-label">${s.label}</span>
            <div class="slider-wrap">
              <div class="track">
                <div class="target-zone" data-i="${i}"
                  style="left:${s.targetMin}%;width:${s.targetMax - s.targetMin}%"></div>
              </div>
              <input type="range" min="0" max="100" value="${Math.round(s.value)}" data-i="${i}">
            </div>
            <span class="value-badge" data-i="${i}">${Math.round(s.value)}</span>
          </div>
        `
          )
          .join('')}
      </div>
      <div class="lock-indicator">Posicione todos na zona verde...</div>
    `;

    this.shadow.querySelectorAll('input[type="range"]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const i = Number((inp as HTMLElement).dataset.i);
        this.sliders[i].value = Number((e.target as HTMLInputElement).value);
        this.updateUI();
      });
    });
  }

  private isInRange(i: number) {
    const s = this.sliders[i];
    return s.value >= s.targetMin && s.value <= s.targetMax;
  }

  private updateUI() {
    this.sliders.forEach((_, i) => {
      const inRange = this.isInRange(i);
      const zone = this.shadow.querySelector(`.target-zone[data-i="${i}"]`) as HTMLElement;
      const badge = this.shadow.querySelector(`.value-badge[data-i="${i}"]`) as HTMLElement;
      if (zone) zone.classList.toggle('in-range', inRange);
      if (badge) {
        badge.textContent = Math.round(this.sliders[i].value).toString();
        badge.classList.toggle('in-range', inRange);
      }
    });

    const allIn = this.sliders.every((_, i) => this.isInRange(i));
    const lockEl = this.shadow.querySelector('.lock-indicator') as HTMLElement;
    if (allIn) {
      if (!this.inRangeSince) this.inRangeSince = performance.now();
      const elapsed = performance.now() - this.inRangeSince;
      const pct = Math.min(100, (elapsed / 1500) * 100);
      if (lockEl) {
        lockEl.classList.add('locking');
        lockEl.textContent = `✅ Mantendo... ${Math.round(pct)}%`;
      }
    } else {
      this.inRangeSince = null;
      if (lockEl) {
        lockEl.classList.remove('locking');
        lockEl.textContent = 'Posicione todos na zona verde...';
      }
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.done) return;
      this.updateUI();
      if (this.inRangeSince && performance.now() - this.inRangeSince >= 1500) {
        this.done = true;
        this.dispatchEvent(new CustomEvent('minigame-success', { bubbles: true, composed: true }));
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
