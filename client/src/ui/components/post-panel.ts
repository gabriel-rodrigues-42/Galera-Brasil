import { sharedStyles } from '../shared-styles';
import { PANEL_CLOSE } from '../events';
import { escapeHtml } from '../escape';
import type { HubPost } from '../../hub-types';
import '../components/ui-modal';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host([hidden]) {
    display: none;
  }

  .post-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    text-align: center;
  }

  .post-content h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    color: var(--color-brand-primary);
  }

  .post-content p {
    margin: 0;
    line-height: 1.5;
  }

  .post-content a {
    color: #7fd8e8;
    font-size: var(--text-sm);
    word-break: break-all;
    text-decoration: none;
  }

  .post-content a:hover {
    text-decoration: underline;
  }

  .panel-photo {
    width: 100%;
    max-width: 420px;
    aspect-ratio: 4 / 3;
    border-radius: var(--border-radius-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    background-size: cover;
    background-position: center;
  }

  .panel-caption {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
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
`);

export class PostPanel extends HTMLElement {
  private modalEl!: HTMLElement;
  private contentEl!: HTMLDivElement;
  private closeBtnEl!: HTMLButtonElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <ui-modal title="Post" id="post-modal">
        <div class="post-content"></div>
        <div class="actions">
          <button type="button" class="close-btn">Fechar</button>
        </div>
        <p class="panel-hint">Esc para fechar</p>
      </ui-modal>
    `;

    this.modalEl = this.shadowRoot!.querySelector('#post-modal')!;
    this.contentEl = this.shadowRoot!.querySelector('.post-content')!;
    this.closeBtnEl = this.shadowRoot!.querySelector('.close-btn')!;

    this.closeBtnEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(PANEL_CLOSE, { bubbles: true, composed: true }));
    });
  }

  show(post: HubPost) {
    if (!this.contentEl) return;

    let html = '';
    let title = 'Post';

    if (post.type === 'image') {
      title = 'Foto';
      html = `
        <div class="panel-photo" style="background: linear-gradient(135deg, ${escapeHtml(post.accentColor)}, #1c1c22)"></div>
        <p class="panel-caption">${escapeHtml(post.caption)}</p>
      `;
    } else if (post.type === 'text') {
      title = 'Texto';
      html = `
        <h2>${escapeHtml(post.title)}</h2>
        <p>${escapeHtml(post.body)}</p>
      `;
    } else if (post.type === 'link') {
      title = 'Link';
      html = `
        <h2>${escapeHtml(post.label)}</h2>
        <p>${escapeHtml(post.description)}</p>
        <a href="${encodeURI(post.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.url)}</a>
      `;
    }

    this.modalEl.setAttribute('title', title);
    this.contentEl.innerHTML = html;
  }
}
