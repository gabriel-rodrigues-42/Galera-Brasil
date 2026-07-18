import { sharedStyles } from '../shared-styles';
import { escapeHtml } from '../escape';
import { GUESTBOOK_SUBMIT, GUESTBOOK_REACT, GUESTBOOK_ALLOW_TOGGLE, PANEL_CLOSE } from '../events';
import type { HubPost } from '../../hub-types';
import '../components/ui-modal';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host([hidden]) {
    display: none;
  }

  .guestbook-comments-list {
    width: 100%;
    max-height: 280px;
    overflow-y: auto;
    margin-bottom: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-right: var(--space-2);
  }

  .guestbook-comment-card {
    background: var(--color-bg-elevated);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-sm);
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-align: left;
  }

  .guestbook-comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--text-xs);
    font-weight: bold;
  }

  .guestbook-comment-author {
    color: var(--color-brand-green);
  }

  .guestbook-comment-body {
    font-size: var(--text-sm);
    line-height: 1.45;
    word-break: break-word;
    color: var(--color-text-primary);
  }

  .guestbook-comment-reactions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .guestbook-reaction-btn {
    background: var(--color-bg-base);
    border: var(--border-ui-stroke);
    border-radius: 20px;
    padding: var(--space-1) var(--space-3);
    color: var(--color-text-primary);
    font-size: var(--text-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    transition: all var(--transition-fast);
    text-transform: none;
    letter-spacing: normal;
  }

  .guestbook-reaction-btn:hover {
    background: var(--color-bg-elevated);
    transform: scale(1.04);
  }

  .guestbook-reaction-btn:active {
    transform: scale(0.96);
  }

  .form-section {
    width: 100%;
    margin-top: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-align: left;
  }

  .form-section h3 {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
    color: var(--color-brand-primary);
  }

  .guestbook-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .message-input {
    width: 100%;
    height: 72px;
    resize: none;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .locked-msg {
    color: var(--color-danger);
    font-size: var(--text-sm);
    text-align: center;
    margin: var(--space-3) 0;
  }

  .settings-section {
    margin: var(--space-3) 0;
    width: 100%;
    text-align: left;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .actions {
    margin-top: var(--space-4);
    display: flex;
    justify-content: flex-end;
  }

  .panel-hint {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    text-align: right;
  }

  .empty-hint {
    text-align: center;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: var(--space-5) 0;
  }
`);

export class GuestbookPanel extends HTMLElement {
  private commentsEl!: HTMLDivElement;
  private emptyHintEl!: HTMLParagraphElement;
  private formSectionEl!: HTMLDivElement;
  private formEl!: HTMLFormElement;
  private messageInputEl!: HTMLTextAreaElement;
  private lockedMsgEl!: HTMLParagraphElement;
  private settingsSectionEl!: HTMLDivElement;
  private allowToggleEl!: HTMLInputElement;
  private closeBtnEl!: HTMLButtonElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <ui-modal title="Mural de Visitantes">
        <div class="comments-list"></div>
        <p class="empty-hint hidden">
          Nenhum recado ainda. Seja o primeiro a escrever!
        </p>

        <div class="form-section hidden">
          <h3>Deixe um recado</h3>
          <form class="guestbook-form" autocomplete="off">
            <textarea
              class="message-input"
              placeholder="Escreva sua mensagem aqui..."
              maxlength="300"
              required
            ></textarea>
            <div class="form-actions">
              <button type="submit" class="primary">Enviar Recado</button>
            </div>
          </form>
        </div>
        <p class="locked-msg hidden">
          🔒 O proprietário desativou novas postagens de visitantes.
        </p>

        <div class="settings-section hidden">
          <label class="checkbox-label">
            <input type="checkbox" class="allow-toggle" />
            <span>Permitir posts de visitantes</span>
          </label>
        </div>

        <div class="actions">
          <button type="button" class="close-btn">Fechar</button>
        </div>
        <p class="panel-hint">Esc para fechar</p>
      </ui-modal>
    `;

    this.commentsEl = this.shadowRoot!.querySelector('.comments-list')!;
    this.emptyHintEl = this.shadowRoot!.querySelector('.empty-hint')!;
    this.formSectionEl = this.shadowRoot!.querySelector('.form-section')!;
    this.formEl = this.shadowRoot!.querySelector('.guestbook-form')!;
    this.messageInputEl = this.shadowRoot!.querySelector('.message-input')!;
    this.lockedMsgEl = this.shadowRoot!.querySelector('.locked-msg')!;
    this.settingsSectionEl = this.shadowRoot!.querySelector('.settings-section')!;
    this.allowToggleEl = this.shadowRoot!.querySelector('.allow-toggle')!;
    this.closeBtnEl = this.shadowRoot!.querySelector('.close-btn')!;

    // Prevent typing keys from leaking to movement control
    this.messageInputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Escape') {
        this.dispatchEvent(new CustomEvent(PANEL_CLOSE, { bubbles: true, composed: true }));
      }
    });

    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = this.messageInputEl.value.trim();
      if (!message) return;
      this.dispatchEvent(
        new CustomEvent(GUESTBOOK_SUBMIT, {
          bubbles: true,
          composed: true,
          detail: { message },
        })
      );
    });

    this.allowToggleEl.addEventListener('change', () => {
      this.dispatchEvent(
        new CustomEvent(GUESTBOOK_ALLOW_TOGGLE, {
          bubbles: true,
          composed: true,
          detail: { allowed: this.allowToggleEl.checked },
        })
      );
    });

    this.commentsEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.guestbook-reaction-btn');
      if (!btn) return;
      const card = btn.closest('.guestbook-comment-card');
      if (!card) return;
      const postId = card.getAttribute('data-post-id');
      const emoji = btn.getAttribute('data-emoji');
      if (!postId || !emoji) return;
      this.dispatchEvent(
        new CustomEvent(GUESTBOOK_REACT, {
          bubbles: true,
          composed: true,
          detail: { postId, emoji },
        })
      );
    });

    this.closeBtnEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(PANEL_CLOSE, { bubbles: true, composed: true }));
    });
  }

  setComments(posts: Extract<HubPost, { type: 'guestbook' }>[]) {
    if (!this.commentsEl) return;

    if (posts.length === 0) {
      this.emptyHintEl.classList.remove('hidden');
      this.commentsEl.innerHTML = '';
      return;
    }
    this.emptyHintEl.classList.add('hidden');

    this.commentsEl.innerHTML = posts
      .slice()
      .reverse() // newest on top
      .map((post) => {
        const reactions = post.reactions || { thumbs: 0, heart: 0, orange: 0 };
        return `
          <div class="guestbook-comment-card" data-post-id="${post.id}">
            <div class="guestbook-comment-header">
              <span class="guestbook-comment-author">✏️ ${escapeHtml(post.author)}</span>
            </div>
            <div class="guestbook-comment-body">${escapeHtml(post.message)}</div>
            <div class="guestbook-comment-reactions">
              <button type="button" class="guestbook-reaction-btn" data-emoji="thumbs">
                👍 <span class="reaction-count">${reactions.thumbs || 0}</span>
              </button>
              <button type="button" class="guestbook-reaction-btn" data-emoji="heart">
                ❤️ <span class="reaction-count">${reactions.heart || 0}</span>
              </button>
              <button type="button" class="guestbook-reaction-btn" data-emoji="orange">
                🍊 <span class="reaction-count">${reactions.orange || 0}</span>
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  setOwnerView(show: boolean, allowed?: boolean) {
    if (!this.settingsSectionEl) return;
    this.settingsSectionEl.classList.toggle('hidden', !show);
    if (show && allowed !== undefined) {
      this.allowToggleEl.checked = allowed;
    }
  }

  setVisitorView(show: boolean, allowed?: boolean) {
    if (!this.formSectionEl) return;
    if (!show) {
      this.formSectionEl.classList.add('hidden');
      this.lockedMsgEl.classList.add('hidden');
    } else {
      const isAllowed = allowed ?? false;
      this.formSectionEl.classList.toggle('hidden', !isAllowed);
      this.lockedMsgEl.classList.toggle('hidden', isAllowed);
    }
  }

  clearInput() {
    if (this.messageInputEl) {
      this.messageInputEl.value = '';
    }
  }

  bumpReaction(postId: string, emoji: string) {
    if (!this.commentsEl) return;
    const card = this.commentsEl.querySelector(`.guestbook-comment-card[data-post-id="${postId}"]`);
    if (!card) return;
    const btn = card.querySelector(`.guestbook-reaction-btn[data-emoji="${emoji}"]`);
    if (!btn) return;
    const countSpan = btn.querySelector('.reaction-count');
    if (countSpan) {
      countSpan.textContent = String(Number(countSpan.textContent) + 1);
    }
  }
}
