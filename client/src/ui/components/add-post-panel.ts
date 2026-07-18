import { sharedStyles } from '../shared-styles';
import { PANEL_CLOSE, POST_SUBMIT } from '../events';
import '../components/ui-modal';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host([hidden]) {
    display: none;
  }

  .add-post-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: 100%;
  }

  .field {
    display: flex;
    flex-direction: column;
  }

  .field input,
  .field textarea {
    width: 100%;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }

  .panel-hint {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    text-align: right;
  }
`);

export class AddPostPanel extends HTMLElement {
  private formEl!: HTMLFormElement;
  private titleInputEl!: HTMLInputElement;
  private bodyInputEl!: HTMLTextAreaElement;
  private cancelBtnEl!: HTMLButtonElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <ui-modal title="Novo Post">
        <form class="add-post-form">
          <div class="field">
            <input
              type="text"
              class="post-title-input"
              placeholder="Título"
              maxlength="60"
              autocomplete="off"
              required
            />
          </div>
          <div class="field">
            <textarea
              class="post-body-input"
              placeholder="Texto do post"
              maxlength="400"
              rows="4"
              required
            ></textarea>
          </div>
          <div class="actions">
            <button type="submit" class="primary">Publicar</button>
            <button type="button" class="cancel-btn">Cancelar</button>
          </div>
          <p class="panel-hint">Ctrl+Enter para publicar · Esc para cancelar</p>
        </form>
      </ui-modal>
    `;

    this.formEl = this.shadowRoot!.querySelector('.add-post-form')!;
    this.titleInputEl = this.shadowRoot!.querySelector('.post-title-input')!;
    this.bodyInputEl = this.shadowRoot!.querySelector('.post-body-input')!;
    this.cancelBtnEl = this.shadowRoot!.querySelector('.cancel-btn')!;

    this.formEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Escape') {
        this.dispatchEvent(new CustomEvent(PANEL_CLOSE, { bubbles: true, composed: true }));
      } else if (e.code === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.formEl.requestSubmit();
      }
    });

    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = this.titleInputEl.value.trim();
      const body = this.bodyInputEl.value.trim();
      if (!title || !body) return;
      this.dispatchEvent(
        new CustomEvent(POST_SUBMIT, {
          bubbles: true,
          composed: true,
          detail: { title, body },
        })
      );
    });

    this.cancelBtnEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(PANEL_CLOSE, { bubbles: true, composed: true }));
    });
  }

  open() {
    if (this.titleInputEl) {
      this.titleInputEl.value = '';
      this.bodyInputEl.value = '';
      this.titleInputEl.focus();
    }
  }
}
