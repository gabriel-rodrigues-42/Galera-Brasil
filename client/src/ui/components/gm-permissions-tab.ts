import { sharedStyles } from '../shared-styles';
import { escapeHtml } from '../escape';
import { GM_BYPASS_TOGGLE, GM_HUB_PERMISSION_TOGGLE } from '../events';

export interface HubPermissionRow {
  owner: string;
  tag: string;
  slot: number;
  allowVisitorPosts: boolean;
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
    margin: var(--space-4) 0 var(--space-3);
    font-size: var(--text-sm);
  }

  .bypass-row {
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-elevated);
    border-radius: var(--border-radius-md);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 280px;
    overflow-y: auto;
  }

  .empty {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-elevated);
    border-radius: var(--border-radius-sm);
  }

  .row-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .row-owner {
    font-size: var(--text-sm);
  }

  .row-slot {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }
`);

/** Permissions tab of the GM panel — global bypass toggle + per-hub guestbook
 * permission list. HTML is built from escaped data only (DESIGN.md §9); no
 * raw hub-supplied strings ever reach innerHTML unescaped. */
export class GmPermissionsTab extends HTMLElement {
  private bypassCheckboxEl!: HTMLInputElement;
  private listEl!: HTMLDivElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <div class="bypass-row">
        <label class="checkbox-label">
          <input type="checkbox" class="bypass-checkbox" />
          <span><strong>Bypass Global:</strong> GMs ignoram restrições de mural</span>
        </label>
      </div>
      <h3>Permissões de Mural por Hub</h3>
      <div class="list"><p class="empty">Carregando...</p></div>
    `;

    this.bypassCheckboxEl = this.shadowRoot!.querySelector('.bypass-checkbox')!;
    this.listEl = this.shadowRoot!.querySelector('.list')!;

    this.bypassCheckboxEl.addEventListener('change', () => {
      this.dispatchEvent(
        new CustomEvent(GM_BYPASS_TOGGLE, {
          bubbles: true,
          composed: true,
          detail: { enabled: this.bypassCheckboxEl.checked },
        })
      );
    });

    this.listEl.addEventListener('change', (e) => {
      const checkbox = e.target as HTMLInputElement;
      if (!checkbox.classList.contains('hub-allow-toggle')) return;
      const owner = checkbox.dataset.owner;
      if (!owner) return;
      this.dispatchEvent(
        new CustomEvent(GM_HUB_PERMISSION_TOGGLE, {
          bubbles: true,
          composed: true,
          detail: { owner, allowed: checkbox.checked },
        })
      );
    });
  }

  setBypass(enabled: boolean) {
    this.bypassCheckboxEl.checked = enabled;
  }

  setLoading() {
    this.listEl.innerHTML = '<p class="empty">Carregando...</p>';
  }

  setError() {
    this.listEl.innerHTML = '<p class="empty">Erro ao carregar permissões.</p>';
  }

  setHubs(hubs: HubPermissionRow[]) {
    if (hubs.length === 0) {
      this.listEl.innerHTML = '<p class="empty">Nenhum hub registrado.</p>';
      return;
    }

    this.listEl.innerHTML = hubs
      .map(
        (hub) => `
          <div class="row">
            <div class="row-info">
              <span class="row-owner">🏡 Hub de ${escapeHtml(hub.owner)}</span>
              <span class="row-slot">Slot: ${hub.slot} · Tag: ${escapeHtml(hub.tag)}</span>
            </div>
            <label class="checkbox-label">
              <input
                type="checkbox"
                class="hub-allow-toggle"
                data-owner="${escapeHtml(hub.owner)}"
                ${hub.allowVisitorPosts ? 'checked' : ''}
              />
              <span>Permitir recados</span>
            </label>
          </div>
        `
      )
      .join('');
  }
}
