import { sharedStyles } from '../shared-styles';
import type { DebugPanelSink } from '../../logger';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    position: fixed;
    right: 10px;
    bottom: 10px;
    z-index: var(--z-hud);
    max-width: min(540px, 72vw);
    max-height: 62vh;
    overflow-y: auto;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.7);
    color: #7fffb0;
    font:
      12px/1.4 ui-monospace,
      Consolas,
      monospace;
  }

  :host(.collapsed) {
    max-width: none;
    max-height: none;
    overflow: visible;
    padding: 0;
    background: transparent;
    border-radius: 0;
  }

  .badge {
    border: 1px solid rgba(255, 207, 92, 0.45);
    border-radius: 999px;
    background: rgba(12, 16, 22, 0.92);
    color: #ffcf5c;
    font:
      11px/1 ui-monospace,
      Consolas,
      monospace;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 7px 10px;
    cursor: pointer;
  }

  :host(:not(.collapsed)) .badge {
    position: sticky;
    top: 0;
    float: right;
  }

  :host(.collapsed) .title,
  :host(.collapsed) .stats,
  :host(.collapsed) .log {
    display: none;
  }

  .title {
    color: #ffcf5c;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .stats {
    margin: 0 0 6px;
    white-space: pre-wrap;
    color: #f4f1e8;
  }

  .log {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: #7fffb0;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 4px;
  }
`);

/** Dev-only stats/log overlay, toggled with `~` and copied with
 * Ctrl+Shift+D (both bound in main.ts). Implements logger.ts's
 * DebugPanelSink so `log()`/`updateStats()` write here without main.ts
 * touching this component's internals directly. Collapsed by default. */
export class DebugPanel extends HTMLElement implements DebugPanelSink {
  private badgeEl!: HTMLButtonElement;
  private statsEl!: HTMLPreElement;
  private logEl!: HTMLPreElement;
  private collapsed = true;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <button type="button" class="badge" title="Atalho: ~ para abrir/fechar · Ctrl+Shift+D para copiar log">DEBUG (~)</button>
      <div class="title">DEBUG (~ para esconder)</div>
      <pre class="stats"></pre>
      <pre class="log"></pre>
    `;
    this.badgeEl = this.shadowRoot!.querySelector('.badge')!;
    this.statsEl = this.shadowRoot!.querySelector('.stats')!;
    this.logEl = this.shadowRoot!.querySelector('.log')!;

    this.classList.toggle('collapsed', this.collapsed);

    this.badgeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapsed();
    });
  }

  setLog(text: string) {
    if (!this.logEl) return;
    this.logEl.textContent = text;
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  setStats(text: string) {
    if (this.statsEl) this.statsEl.textContent = text;
  }

  getLogText(): string {
    return this.logEl?.textContent?.trim() || '';
  }

  setCollapsed(collapsed: boolean) {
    this.collapsed = collapsed;
    this.classList.toggle('collapsed', collapsed);
  }

  toggleCollapsed() {
    this.setCollapsed(!this.collapsed);
  }

  expand() {
    this.setCollapsed(false);
  }
}
