import { sharedStyles } from '../shared-styles';
import { BUILD_CATALOG, DEFAULT_BUILD_TYPE, type BuildType } from '../gm-catalog';
import {
  GM_BUILD_TOGGLE,
  GM_BUILD_SELECT,
  GM_SPAWN_ENEMY,
  GM_SPAWN_BOSS,
  GM_CLEAR_ENEMIES,
  GM_RESPAWN,
  GM_PLACED_DELETE,
  GM_START_MUTIRAO,
  GM_FORCE_MUTIRAO,
  type EnemyKind,
  type RespawnTarget,
} from '../events';

export interface PlacedItemView {
  id: string;
  label: string;
  coordsStr: string;
  distStr: string;
}

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: block;
    font-family: var(--font-body);
    color: var(--color-text-primary);
  }

  h3, h4 {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
    margin: var(--space-4) 0 var(--space-2);
    font-size: var(--text-sm);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .toggle-btn.active {
    background: var(--color-brand-green);
    color: var(--color-bg-base);
    border: none;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2);
    aspect-ratio: 1;
    justify-content: center;
    background: var(--color-bg-elevated);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-md);
    cursor: pointer;
    transition: filter var(--transition-fast), outline var(--transition-fast);
  }

  .card:hover {
    filter: brightness(1.1);
  }

  .card.active {
    outline: 2px solid var(--color-brand-green);
    outline-offset: -2px;
  }

  .card-emoji {
    font-size: var(--text-lg);
  }

  .card-name {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    text-align: center;
  }

  .section-row {
    margin-top: var(--space-5);
  }

  .buttons-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .action-btn-mini {
    flex: 1 1 auto;
    font-size: var(--text-xs);
    padding: var(--space-2) var(--space-3);
  }

  .action-btn-mini.primary {
    background: var(--color-brand-primary);
    color: var(--color-bg-base);
    border: none;
  }

  .action-btn-mini.danger {
    background: var(--color-danger);
    color: var(--color-text-primary);
    border: none;
  }

  .placed-list-section {
    margin-top: var(--space-5);
  }

  .placed-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 220px;
    overflow-y: auto;
  }

  .empty-list-text {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .placed-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-elevated);
    border-radius: var(--border-radius-sm);
    font-size: var(--text-sm);
  }

  .placed-item-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .placed-item-coords {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .placed-item-delete {
    flex-shrink: 0;
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
  }
`);

/** Builder tab of the GM panel — build-mode toggle, card catalog, quick
 * battle/respawn actions, and the placed-objects list. Pure presentation:
 * emits events for a controller to act on. See DESIGN.md §8. */
export class GmBuilderTab extends HTMLElement {
  private toggleBtnEl!: HTMLButtonElement;
  private placedListEl!: HTMLDivElement;
  private activeType: BuildType = DEFAULT_BUILD_TYPE;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <div class="toggle-row">
        <label>Construção Ativa:</label>
        <button type="button" class="toggle-btn">Desativado</button>
      </div>

      <div class="grid-section">
        ${BUILD_CATALOG.map(
          (group) => `
          <h4>${group.title}</h4>
          <div class="card-grid">
            ${group.items
              .map(
                (item) => `
              <div class="card${item.type === this.activeType ? ' active' : ''}" data-build="${item.type}">
                <span class="card-emoji">${item.emoji}</span>
                <span class="card-name">${item.cardName}</span>
              </div>
            `
              )
              .join('')}
          </div>
        `
        ).join('')}
      </div>

      <div class="section-row">
        <h3>Batalha Rápida</h3>
        <div class="buttons-row">
          <button type="button" class="action-btn-mini" data-spawn="mosquito">🦟 +1</button>
          <button type="button" class="action-btn-mini" data-spawn="barata">🪳 +1</button>
          <button type="button" class="action-btn-mini" data-spawn="pombo">🕊️ +1</button>
          <button type="button" class="action-btn-mini primary" data-spawn-boss>👑 Rainha</button>
          <button type="button" class="action-btn-mini danger" data-clear-enemies>🧹 Limpar</button>
        </div>
      </div>

      <div class="section-row">
        <h3>Mutirão da Praça</h3>
        <div class="buttons-row">
          <button type="button" class="action-btn-mini primary" data-start-mutirao>🏁 Iniciar</button>
          <button type="button" class="action-btn-mini danger" data-force-mutirao>⚡ Forçar (Dev)</button>
        </div>
      </div>

      <div class="section-row">
        <h3>Respawnadores Globais</h3>
        <div class="buttons-row">
          <button type="button" class="action-btn-mini" data-respawn="npcs">🤖 NPCs</button>
          <button type="button" class="action-btn-mini" data-respawn="trees">🌳 Árvores</button>
          <button type="button" class="action-btn-mini" data-respawn="canopies">☀️ Tendas</button>
          <button type="button" class="action-btn-mini" data-respawn="lake">💧 Lago</button>
          <button type="button" class="action-btn-mini primary" data-respawn="all">🔄 Reset Tudo</button>
        </div>
      </div>

      <div class="placed-list-section">
        <h3>Elementos Posicionados</h3>
        <div class="placed-list">
          <p class="empty-list-text">Nenhum objeto colocado ainda.</p>
        </div>
      </div>
    `;

    this.toggleBtnEl = this.shadowRoot!.querySelector('.toggle-btn')!;
    this.placedListEl = this.shadowRoot!.querySelector('.placed-list')!;

    this.toggleBtnEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(GM_BUILD_TOGGLE, { bubbles: true, composed: true }));
    });

    this.shadowRoot!.querySelectorAll<HTMLDivElement>('.card').forEach((card) => {
      card.addEventListener('click', () => {
        const type = card.dataset.build as BuildType;
        this.setActiveBuildType(type);
        this.dispatchEvent(
          new CustomEvent(GM_BUILD_SELECT, {
            bubbles: true,
            composed: true,
            detail: { type },
          })
        );
      });
    });

    this.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-spawn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.spawn as EnemyKind;
        this.dispatchEvent(
          new CustomEvent(GM_SPAWN_ENEMY, { bubbles: true, composed: true, detail: { kind } })
        );
      });
    });

    this.shadowRoot!.querySelector('[data-spawn-boss]')!.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(GM_SPAWN_BOSS, { bubbles: true, composed: true }));
    });

    this.shadowRoot!.querySelector('[data-clear-enemies]')!.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(GM_CLEAR_ENEMIES, { bubbles: true, composed: true }));
    });

    this.shadowRoot!.querySelector('[data-start-mutirao]')!.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(GM_START_MUTIRAO, { bubbles: true, composed: true }));
    });

    this.shadowRoot!.querySelector('[data-force-mutirao]')!.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(GM_FORCE_MUTIRAO, { bubbles: true, composed: true }));
    });

    this.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-respawn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.respawn as RespawnTarget;
        this.dispatchEvent(
          new CustomEvent(GM_RESPAWN, { bubbles: true, composed: true, detail: { target } })
        );
      });
    });
  }

  setActive(active: boolean) {
    this.toggleBtnEl.textContent = active ? 'Ativado' : 'Desativado';
    this.toggleBtnEl.classList.toggle('active', active);
  }

  setActiveBuildType(type: BuildType) {
    this.activeType = type;
    this.shadowRoot!.querySelectorAll<HTMLDivElement>('.card').forEach((card) => {
      card.classList.toggle('active', card.dataset.build === type);
    });
  }

  setPlacedObjects(items: PlacedItemView[]) {
    this.placedListEl.innerHTML = '';

    if (items.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.className = 'empty-list-text';
      emptyEl.textContent = 'Nenhum objeto colocado ainda.';
      this.placedListEl.appendChild(emptyEl);
      return;
    }

    items.forEach((item) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'placed-item';

      const detailsEl = document.createElement('div');
      detailsEl.className = 'placed-item-details';

      const labelEl = document.createElement('span');
      labelEl.textContent = item.label;
      detailsEl.appendChild(labelEl);

      const coordsEl = document.createElement('span');
      coordsEl.className = 'placed-item-coords';
      coordsEl.textContent = `${item.coordsStr} · dist: ${item.distStr}`;
      detailsEl.appendChild(coordsEl);

      itemEl.appendChild(detailsEl);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'placed-item-delete';
      deleteBtn.textContent = 'Remover';
      deleteBtn.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent(GM_PLACED_DELETE, {
            bubbles: true,
            composed: true,
            detail: { id: item.id },
          })
        );
      });
      itemEl.appendChild(deleteBtn);

      this.placedListEl.appendChild(itemEl);
    });
  }
}
