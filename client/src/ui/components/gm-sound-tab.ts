import { sharedStyles } from '../shared-styles';
import { RADIO_TOGGLE, RADIO_NEXT, RADIO_PREV, VOLUME_CHANGE, type VolumeChannel } from '../events';

export interface AudioSource {
  getAnalyser(): AnalyserNode | null;
  getIsPlaying(): boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  trackName: string;
  trackGenreLine: string;
}

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: block;
    font-family: var(--font-body);
    color: var(--color-text-primary);
  }

  h3 {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }

  .sliders-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    background: var(--color-bg-elevated);
    border-radius: var(--border-radius-md);
    padding: var(--space-4);
    margin-bottom: var(--space-5);
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }

  .slider-icon {
    font-size: var(--text-lg);
  }

  .slider-row label {
    width: 6rem;
    color: var(--color-text-secondary);
  }

  .slider-row input[type='range'] {
    flex: 1;
  }

  .slider-val {
    width: 2.6rem;
    text-align: right;
    font-family: var(--font-display);
  }

  .radio-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: var(--border-radius-md);
    background: var(--color-bg-elevated);
  }

  .visualizer-container {
    width: 100%;
    background: var(--color-bg-base);
    border-radius: var(--border-radius-sm);
    display: flex;
    justify-content: center;
    padding: var(--space-1) 0;
  }

  canvas {
    display: block;
    width: 100%;
    max-width: 340px;
    height: 60px;
  }

  .track-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 2px;
  }

  .track-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-md);
    color: var(--color-brand-primary);
  }

  .track-genre {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .radio-controls {
    display: flex;
    gap: var(--space-2);
  }

  .play-btn.active {
    background: var(--color-brand-green);
    color: var(--color-bg-base);
    border: none;
  }
`);

/** Sound & Rádio tab of the GM panel — volume mixer + generative radio player
 * with its own live audio visualizer. Pure presentation: the controller
 * injects pull-style audio accessors (see `setAudioSource`) since the
 * visualizer needs per-frame data, and pushes playback state after each
 * transport action. See DESIGN.md §8 and PLAN-UI.md Phase 1b. */
export class GmSoundTab extends HTMLElement {
  private canvasEl!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private playBtnEl!: HTMLButtonElement;
  private trackNameEl!: HTMLElement;
  private trackGenreEl!: HTMLElement;
  private audioSource: AudioSource | null = null;
  private rafHandle = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <div class="sliders-group">
        <h3>🎛️ Mixer de Som</h3>
        ${this.sliderRow('master', '🔊', 'Geral:', 50)}
        ${this.sliderRow('sfx', '⚔️', 'Efeitos (SFX):', 60)}
        ${this.sliderRow('radio', '📻', 'Música Rádio:', 40)}
      </div>

      <div class="radio-card">
        <h3>📻 Rádio Solarpunk</h3>
        <div class="visualizer-container">
          <canvas class="visualizer" width="340" height="70"></canvas>
        </div>
        <div class="track-info">
          <span class="track-name">Rádio Desativada</span>
          <span class="track-genre">Ligue para começar a relaxar</span>
        </div>
        <div class="radio-controls">
          <button type="button" class="radio-prev">⏮️</button>
          <button type="button" class="play-btn">▶️ Ligar</button>
          <button type="button" class="radio-next">⏭️</button>
        </div>
      </div>
    `;

    this.canvasEl = this.shadowRoot!.querySelector('canvas')!;
    this.ctx = this.canvasEl.getContext('2d')!;
    this.playBtnEl = this.shadowRoot!.querySelector('.play-btn')!;
    this.trackNameEl = this.shadowRoot!.querySelector('.track-name')!;
    this.trackGenreEl = this.shadowRoot!.querySelector('.track-genre')!;

    (['master', 'sfx', 'radio'] as VolumeChannel[]).forEach((channel) => {
      const input = this.shadowRoot!.querySelector<HTMLInputElement>(
        `[data-channel="${channel}"]`
      )!;
      const valEl = this.shadowRoot!.querySelector(`[data-channel-val="${channel}"]`)!;
      input.addEventListener('input', () => {
        valEl.textContent = `${input.value}%`;
        this.dispatchEvent(
          new CustomEvent(VOLUME_CHANGE, {
            bubbles: true,
            composed: true,
            detail: { channel, value: parseInt(input.value, 10) / 100 },
          })
        );
      });
    });

    this.playBtnEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(RADIO_TOGGLE, { bubbles: true, composed: true }));
    });
    this.shadowRoot!.querySelector('.radio-next')!.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(RADIO_NEXT, { bubbles: true, composed: true }));
    });
    this.shadowRoot!.querySelector('.radio-prev')!.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(RADIO_PREV, { bubbles: true, composed: true }));
    });
  }

  disconnectedCallback() {
    this.stopVisualizer();
  }

  private sliderRow(channel: VolumeChannel, icon: string, label: string, defaultPercent: number) {
    return `
      <div class="slider-row">
        <span class="slider-icon">${icon}</span>
        <label>${label}</label>
        <input type="range" min="0" max="100" value="${defaultPercent}" data-channel="${channel}" />
        <span class="slider-val" data-channel-val="${channel}">${defaultPercent}%</span>
      </div>
    `;
  }

  setAudioSource(source: AudioSource) {
    this.audioSource = source;
  }

  setPlaybackState(state: PlaybackState) {
    this.playBtnEl.textContent = state.isPlaying ? '⏸️ Pausar' : '▶️ Ligar';
    this.playBtnEl.classList.toggle('active', state.isPlaying);
    this.trackNameEl.textContent = state.trackName;
    this.trackGenreEl.textContent = state.trackGenreLine;
  }

  startVisualizer() {
    if (this.rafHandle) return;
    const draw = () => {
      this.rafHandle = requestAnimationFrame(draw);
      this.drawFrame();
    };
    draw();
  }

  stopVisualizer() {
    if (this.rafHandle) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = 0;
    }
  }

  private drawFrame() {
    const { ctx, canvasEl } = this;
    ctx.fillStyle = '#060907';
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

    const analyser = this.audioSource?.getAnalyser() ?? null;
    const isPlaying = this.audioSource?.getIsPlaying() ?? false;

    if (!isPlaying || !analyser) {
      ctx.strokeStyle = 'rgba(129, 178, 154, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvasEl.height / 2);
      for (let i = 0; i < canvasEl.width; i++) {
        const y = canvasEl.height / 2 + Math.sin(i * 0.05 + performance.now() * 0.003) * 2;
        ctx.lineTo(i, y);
      }
      ctx.stroke();
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const barWidth = (canvasEl.width / bufferLength) * 1.6;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] * 0.22;

      const grad = ctx.createLinearGradient(0, canvasEl.height, 0, 0);
      grad.addColorStop(0, '#4a8a4f');
      grad.addColorStop(0.5, '#81b29a');
      grad.addColorStop(1, '#ffcf5c');

      ctx.fillStyle = grad;
      ctx.fillRect(canvasEl.width / 2 + x, canvasEl.height - barHeight, barWidth - 2, barHeight);
      ctx.fillRect(
        canvasEl.width / 2 - x - barWidth,
        canvasEl.height - barHeight,
        barWidth - 2,
        barHeight
      );

      x += barWidth;
    }
  }
}
