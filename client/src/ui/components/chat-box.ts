import { sharedStyles } from '../shared-styles';
import { CHAT_SEND, CHAT_INPUT_CLOSED } from '../events';

const MAX_CHAT_LINES = 8;

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    position: fixed;
    inset: 0;
    z-index: var(--z-chat);
    pointer-events: none;
  }

  .chat-card {
    position: absolute;
    left: 10px;
    bottom: 12px;
    width: min(420px, 60vw);
    border-radius: 10px;
    background: rgba(10, 20, 15, 0.55);
    border: 1px solid rgba(244, 241, 232, 0.18);
    backdrop-filter: blur(4px);
    overflow: hidden;
  }

  /* Compact mode: just the header pill; unread messages pile up in the badge. */
  .chat-card.compact {
    width: auto;
    min-width: 220px;
  }

  .chat-card.compact .log {
    display: none;
  }

  .unread {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    margin-left: 4px;
    border-radius: 999px;
    background: #e0524d;
    color: #fff;
    font-size: 0.68rem;
  }

  .unread.hidden {
    display: none;
  }

  .chat-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 10px;
    background: rgba(10, 20, 15, 0.55);
    border-bottom: 1px solid rgba(244, 241, 232, 0.12);
    font-size: 0.72rem;
    font-weight: 700;
    color: #ffcf5c;
  }

  .hint {
    color: #f4f1e8;
    font-weight: 600;
    opacity: 0.65;
  }

  .log {
    padding: 8px 10px;
    max-height: 26vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.9rem;
    color: #f4f1e8;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }

  .log .chat-line .chat-name {
    color: #ffcf5c;
    font-weight: 700;
  }

  .log .chat-line.system {
    opacity: 0.7;
    font-style: italic;
  }

  .chat-input {
    position: absolute;
    left: 50%;
    bottom: 18%;
    transform: translateX(-50%);
    width: min(480px, 70vw);
    font: inherit;
    font-size: 1rem;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(244, 241, 232, 0.5);
    background: rgba(0, 0, 0, 0.75);
    color: #f4f1e8;
    outline: none;
    pointer-events: auto;
  }

  .chat-input.hidden {
    display: none;
  }
`);

/** Proximity/plaza chat: an always-visible log card (full or compact) plus
 * an internal text input, hidden by default. Migrated off main.ts:948-993
 * in PLAN-UI Phase 6 — same behavior, now self-contained. */
export class ChatBox extends HTMLElement {
  private logEl!: HTMLDivElement;
  private cardEl!: HTMLDivElement;
  private hintEl!: HTMLSpanElement;
  private unreadEl!: HTMLSpanElement;
  private inputEl!: HTMLInputElement;

  private isCompact = false;
  private unreadCount = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <div class="chat-card">
        <div class="chat-card-header">
          <span>💬 Chat da Praça <span class="unread hidden">0</span></span>
          <span class="hint">C para compactar</span>
        </div>
        <div class="log"></div>
      </div>
      <input
        class="chat-input hidden"
        type="text"
        maxlength="200"
        autocomplete="off"
        placeholder="Digite sua mensagem — Enter para enviar, Esc para cancelar"
      />
    `;

    this.cardEl = this.shadowRoot!.querySelector('.chat-card')!;
    this.hintEl = this.shadowRoot!.querySelector('.hint')!;
    this.unreadEl = this.shadowRoot!.querySelector('.unread')!;
    this.logEl = this.shadowRoot!.querySelector('.log')!;
    this.inputEl = this.shadowRoot!.querySelector('.chat-input')!;

    // stopPropagation keeps every keystroke typed here from also reaching the
    // window-level game-input listener (movement keys, E-to-interact, etc).
    this.inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter') {
        const text = this.inputEl.value.trim();
        if (text) {
          this.dispatchEvent(
            new CustomEvent(CHAT_SEND, { bubbles: true, composed: true, detail: { text } })
          );
        }
        this.closeInput();
      } else if (e.code === 'Escape') {
        this.closeInput();
      }
    });
  }

  appendLine(name: string, text: string, isSystem = false) {
    if (!this.logEl) return;
    const line = document.createElement('div');
    line.className = isSystem ? 'chat-line system' : 'chat-line';
    if (isSystem) {
      line.textContent = text;
    } else {
      const nameSpan = document.createElement('span');
      nameSpan.className = 'chat-name';
      nameSpan.textContent = `${name}: `;
      line.appendChild(nameSpan);
      line.appendChild(document.createTextNode(text));
    }
    this.logEl.appendChild(line);
    while (this.logEl.children.length > MAX_CHAT_LINES) {
      this.logEl.removeChild(this.logEl.firstChild!);
    }
    if (this.isCompact) {
      this.unreadCount += 1;
      this.unreadEl.textContent = String(this.unreadCount);
      this.unreadEl.classList.remove('hidden');
    }
  }

  /** C toggles the chat card between full and a compact header-only pill —
   * never fully hidden, so announcements always have somewhere to land. */
  setCompact(compact: boolean) {
    this.isCompact = compact;
    this.cardEl.classList.toggle('compact', compact);
    this.hintEl.textContent = compact ? 'C para abrir' : 'C para compactar';
    if (!compact) {
      this.unreadCount = 0;
      this.unreadEl.classList.add('hidden');
    }
  }

  openInput() {
    if (this.isCompact) this.setCompact(false);
    this.inputEl.classList.remove('hidden');
    this.inputEl.value = '';
    this.inputEl.focus();
  }

  closeInput() {
    this.inputEl.classList.add('hidden');
    this.inputEl.blur();
    this.dispatchEvent(new CustomEvent(CHAT_INPUT_CLOSED, { bubbles: true, composed: true }));
  }
}
