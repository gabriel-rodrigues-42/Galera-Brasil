import { sharedStyles } from '../shared-styles';
import { GM_TAB_CHANGE, PANEL_CLOSE, type GmTab } from '../events';
import '../components/ui-modal';

const TABS: { id: GmTab; label: string }[] = [
  { id: 'builder', label: '🛠️ Construtor' },
  { id: 'shortcuts', label: '⌨️ Atalhos' },
  { id: 'sound', label: '🎵 Som & Rádio' },
  { id: 'permissions', label: '🔐 Permissões' },
];

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host([hidden]) {
    display: none;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    border-bottom: var(--border-ui-stroke);
    padding-bottom: var(--space-3);
  }

  .tab-btn {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
  }

  .tab-btn.active {
    color: var(--color-bg-base);
    background: var(--color-brand-primary);
  }

  .tab-pane {
    display: none;
  }

  .tab-pane.active {
    display: block;
  }

  .panel-actions {
    margin-top: var(--space-5);
    display: flex;
    justify-content: flex-end;
  }

  .panel-hint {
    margin-top: var(--space-2);
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
    text-align: right;
  }
`);

/** GM panel shell: tab bar + 4 named slots (builder/shortcuts/sound/permissions)
 * wrapping <ui-modal>. Slotted content owns its own presentation — sound and
 * permissions tabs are still legacy light-DOM markup until their own phase
 * (see PLAN-UI.md Phase 1b/1c). Visibility via the native `hidden` attribute. */
export class GmPanel extends HTMLElement {
  private activeTab: GmTab = 'builder';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <ui-modal title="Painel do Game Master" wide>
        <div class="tabs">
          ${TABS.map(
            (tab) =>
              `<button type="button" class="tab-btn${tab.id === this.activeTab ? ' active' : ''}" data-tab="${tab.id}">${tab.label}</button>`
          ).join('')}
        </div>
        ${TABS.map(
          (tab) => `
          <div class="tab-pane${tab.id === this.activeTab ? ' active' : ''}" data-pane="${tab.id}">
            <slot name="${tab.id}"></slot>
          </div>
        `
        ).join('')}
        <div class="panel-actions">
          <button type="button" class="close-btn">Fechar</button>
        </div>
        <p class="panel-hint">Atalho: Pressione <strong>B</strong> para abrir/fechar · Esc para fechar</p>
      </ui-modal>
    `;

    this.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.setActiveTab(btn.dataset.tab as GmTab));
    });

    this.shadowRoot!.querySelector('.close-btn')!.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(PANEL_CLOSE, { bubbles: true, composed: true }));
    });
  }

  setActiveTab(tab: GmTab) {
    this.activeTab = tab;
    this.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    this.shadowRoot!.querySelectorAll<HTMLDivElement>('.tab-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.dataset.pane === tab);
    });
    this.dispatchEvent(
      new CustomEvent(GM_TAB_CHANGE, { bubbles: true, composed: true, detail: { tab } })
    );
  }

  getActiveTab(): GmTab {
    return this.activeTab;
  }
}
