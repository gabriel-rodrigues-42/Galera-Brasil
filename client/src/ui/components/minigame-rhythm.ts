/**
 * <minigame-rhythm> — Weed Clearing Rhythm Tap
 *
 * Beat indicators scroll rightward toward a hit zone.
 * Player clicks the HIT zone (or presses a key via parent) when an indicator aligns.
 * 5 successful hits fires 'minigame-success'. Misses don't reset but reduce combo.
 */

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    user-select: none;
  }

  .instructions {
    text-align: center;
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .track-wrap {
    position: relative;
    height: 72px;
    background: var(--color-bg-elevated);
    border-radius: var(--border-radius-md);
    overflow: hidden;
  }

  .hit-zone {
    position: absolute;
    right: 70px;
    top: 0; bottom: 0;
    width: 56px;
    background: rgba(74, 138, 79, 0.15);
    border-left: 2px solid rgba(74, 138, 79, 0.5);
    border-right: 2px solid rgba(74, 138, 79, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .hit-zone:hover { background: rgba(74, 138, 79, 0.25); }
  .hit-zone.flash-success { background: rgba(74, 138, 79, 0.6); }
  .hit-zone.flash-miss    { background: rgba(224, 122, 95, 0.4); }

  canvas.beats { display: block; width: 100%; height: 100%; }

  .progress-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .progress-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    white-space: nowrap;
    width: 100px;
  }

  .progress-bar-bg {
    flex: 1;
    height: 8px;
    background: var(--color-bg-elevated);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-brand-green), var(--color-brand-primary));
    border-radius: 4px;
    transition: width 0.2s;
  }

  .hit-btn {
    display: block;
    margin: 0 auto;
    padding: 12px 32px;
    font-size: 16px;
    cursor: pointer;
    background: var(--color-brand-primary);
    color: var(--color-bg-base);
    border: none;
    border-radius: var(--border-radius-md);
    font-family: var(--font-display);
    letter-spacing: 0.05em;
    transition: transform 0.1s, filter 0.1s;
  }

  .hit-btn:hover { filter: brightness(1.1); }
  .hit-btn:active { transform: scale(0.95); }
`);

const BEAT_INTERVAL_MS = 900;
const NEEDED_HITS = 5;

interface Beat {
  x: number;
  hit: boolean;
  missed: boolean;
}

export class MinigameRhythm extends HTMLElement {
  private shadow!: ShadowRoot;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private hitZoneEl!: HTMLElement;
  private fillEl!: HTMLElement;
  private labelEl!: HTMLElement;

  private beats: Beat[] = [];
  private hits = 0;
  private done = false;
  private lastBeatAt = 0;
  private rafId: number | null = null;
  private lastTimestamp = 0;

  // Track width in px (set dynamically)
  private trackW = 600;
  private readonly HIT_ZONE_RIGHT = 70;
  private readonly HIT_ZONE_W = 56;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadow.adoptedStyleSheets = [sheet];
    this.done = false;
    this.hits = 0;
    this.beats = [];
    this.lastBeatAt = performance.now();
    this.render();
    this.startLoop();
  }

  disconnectedCallback() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  private render() {
    this.shadow.innerHTML = `
      <p class="instructions">Clique em "✂️ CORTAR" quando o símbolo entrar na zona verde!</p>
      <div class="track-wrap">
        <canvas class="beats"></canvas>
        <div class="hit-zone">🌾</div>
      </div>
      <div class="progress-row">
        <span class="progress-label">Cortados: ${this.hits}/${NEEDED_HITS}</span>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:0%"></div>
        </div>
      </div>
      <button class="hit-btn" type="button">✂️ CORTAR</button>
    `;

    this.canvas = this.shadow.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.hitZoneEl = this.shadow.querySelector('.hit-zone')!;
    this.fillEl = this.shadow.querySelector('.progress-bar-fill')!;
    this.labelEl = this.shadow.querySelector('.progress-label')!;

    const btn = this.shadow.querySelector('.hit-btn') as HTMLButtonElement;
    btn.addEventListener('click', () => this.onHit());

    // Also listen to keydown forwarded from parent
    this.addEventListener('keydown', (e: Event) => {
      if ((e as KeyboardEvent).code === 'KeyE') this.onHit();
    });
  }

  private startLoop() {
    const tick = (ts: number) => {
      if (this.done) return;
      const dt = ts - (this.lastTimestamp || ts);
      this.lastTimestamp = ts;
      this.update(dt);
      this.draw();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number) {
    const speed = 140; // px per second
    const now = performance.now();

    // Spawn new beats on interval
    if (now - this.lastBeatAt >= BEAT_INTERVAL_MS) {
      this.lastBeatAt = now;
      this.beats.push({ x: -30, hit: false, missed: false });
    }

    // Move beats
    for (const b of this.beats) {
      b.x += (speed * dt) / 1000;
    }

    // Mark missed beats that passed the hit zone
    const hitRight = this.trackW - this.HIT_ZONE_RIGHT;
    for (const b of this.beats) {
      if (!b.hit && !b.missed && b.x > hitRight + 20) {
        b.missed = true;
      }
    }

    // Remove old beats
    this.beats = this.beats.filter((b) => b.x < this.trackW + 40);

    // Resize canvas to match container
    const wrap = this.shadow.querySelector('.track-wrap') as HTMLElement;
    if (wrap) {
      const w = wrap.clientWidth || 600;
      const h = wrap.clientHeight || 72;
      this.canvas.width = w;
      this.canvas.height = h;
      this.trackW = w;
    }

    // Update progress bar
    const pct = (this.hits / NEEDED_HITS) * 100;
    this.fillEl.style.width = `${pct}%`;
    this.labelEl.textContent = `Cortados: ${this.hits}/${NEEDED_HITS}`;
  }

  private draw() {
    const ctx = this.ctx;
    const { width: w, height: h } = this.canvas;
    ctx.clearRect(0, 0, w, h);

    // Draw beats
    for (const b of this.beats) {
      if (b.hit) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#81b29a';
      } else if (b.missed) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#e07a5f';
      } else {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f2cc8f';
      }
      ctx.beginPath();
      ctx.arc(b.x, h / 2, 18, 0, Math.PI * 2);
      ctx.fill();

      // Inner icon
      ctx.globalAlpha = b.hit || b.missed ? 0.4 : 1;
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌾', b.x, h / 2);
    }
    ctx.globalAlpha = 1;
  }

  private onHit() {
    if (this.done) return;
    const hitLeft = this.trackW - this.HIT_ZONE_RIGHT - this.HIT_ZONE_W;
    const hitRight = this.trackW - this.HIT_ZONE_RIGHT;

    const beatInZone = this.beats.find(
      (b) => !b.hit && !b.missed && b.x >= hitLeft - 10 && b.x <= hitRight + 10
    );

    if (beatInZone) {
      beatInZone.hit = true;
      this.hits++;
      this.flash(true);
      if (this.hits >= NEEDED_HITS) {
        this.done = true;
        setTimeout(() => {
          this.dispatchEvent(
            new CustomEvent('minigame-success', { bubbles: true, composed: true })
          );
        }, 300);
      }
    } else {
      this.flash(false);
    }
  }

  private flash(success: boolean) {
    const cls = success ? 'flash-success' : 'flash-miss';
    this.hitZoneEl.classList.add(cls);
    setTimeout(() => this.hitZoneEl.classList.remove(cls), 200);
  }
}
