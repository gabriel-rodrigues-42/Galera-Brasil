import { sharedStyles } from '../shared-styles';
import { escapeHtml } from '../escape';
import { NPC_ACTION, NPC_CLAIM_STICKER, NPC_SHOP_BUY, PANEL_CLOSE } from '../events';
import {
  STICKERS,
  SHOP_ITEMS,
  NPC_DIALOGUE_ACTION_LABEL,
  NPC_GREETING,
  type NpcId,
} from '../npc-catalog';
import '../components/ui-modal';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host([hidden]) {
    display: none;
  }

  .dialogue {
    max-width: 100%;
    background: var(--color-bg-elevated);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-md);
    padding: var(--space-4);
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dialogue-text {
    margin: 0;
    font-size: var(--text-md);
    line-height: 1.6;
    color: var(--color-text-primary);
  }

  .reward-banner {
    max-width: 100%;
    background: linear-gradient(135deg, rgba(255, 197, 66, 0.18), rgba(224, 122, 95, 0.18));
    border: 2px dashed var(--color-brand-primary);
    border-radius: var(--border-radius-sm);
    padding: var(--space-3) var(--space-4);
    margin-top: var(--space-3);
    font-size: var(--text-sm);
    text-align: center;
  }

  .reward-banner.hidden {
    display: none;
  }

  .actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    justify-content: center;
    margin-top: var(--space-4);
  }

  .actions button.hidden {
    display: none;
  }

  .shop-section {
    width: 100%;
    border-top: var(--border-ui-stroke);
    padding-top: var(--space-4);
    margin-top: var(--space-4);
  }

  .shop-section.hidden {
    display: none;
  }

  .shop-section h3 {
    margin: 0 0 var(--space-3);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-brand-primary);
    text-align: left;
  }

  .shop-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }

  .shop-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
    padding: var(--space-3);
    font: inherit;
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .shop-item:hover {
    border-color: var(--color-brand-primary);
    transform: translateY(-1px);
  }

  .shop-item-title {
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .shop-item-desc {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .shop-item-price {
    font-size: var(--text-xs);
    color: var(--color-brand-primary);
    font-weight: 700;
  }

  .stickers-section {
    width: 100%;
    border-top: var(--border-ui-stroke);
    padding-top: var(--space-4);
    margin-top: var(--space-4);
    text-align: left;
  }

  .stickers-section h3 {
    margin: 0 0 var(--space-3);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
  }

  .stickers-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }

  .sticker-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--color-bg-elevated);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-sm);
    padding: var(--space-2);
    text-align: center;
    transition: all var(--transition-fast);
  }

  .sticker-item.locked {
    opacity: 0.25;
    filter: grayscale(1);
  }

  .sticker-item.unlocked {
    background: rgba(255, 197, 66, 0.08);
    border-color: rgba(255, 197, 66, 0.35);
    transform: translateY(-2px);
  }

  .sticker-emoji {
    font-size: 28px;
    margin-bottom: var(--space-1);
  }

  .sticker-name {
    font-size: var(--text-xs);
    font-weight: 700;
    margin-bottom: 2px;
  }

  .sticker-desc {
    font-size: 10px;
    color: var(--color-text-secondary);
    line-height: 1.3;
  }

  .panel-hint {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    text-align: right;
    width: 100%;
  }
`);

export class NpcPanel extends HTMLElement {
  private npcId: NpcId | null = null;
  private dialogueTextEl!: HTMLParagraphElement;
  private rewardBannerEl!: HTMLDivElement;
  private actionBtnEl!: HTMLButtonElement;
  private stickerBtnEl!: HTMLButtonElement;
  private closeBtnEl!: HTMLButtonElement;
  private shopSectionEl!: HTMLDivElement;
  private shopGridEl!: HTMLDivElement;
  private stickersSectionEl!: HTMLDivElement;
  private stickersGridEl!: HTMLDivElement;
  private titleEl!: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <ui-modal title="NPC">
        <div class="dialogue">
          <p class="dialogue-text">Carregando...</p>
        </div>
        <div class="reward-banner hidden"></div>

        <div class="actions">
          <button type="button" class="action-btn primary">Interagir</button>
          <button type="button" class="sticker-btn">Reivindicar Sticker</button>
          <button type="button" class="close-btn">Fechar</button>
        </div>

        <div class="shop-section hidden">
          <h3>Loja da Feira</h3>
          <div class="shop-grid"></div>
        </div>

        <div class="stickers-section">
          <h3>Seus Stickers</h3>
          <div class="stickers-grid"></div>
        </div>
        <p class="panel-hint">Esc para fechar</p>
      </ui-modal>
    `;

    this.titleEl = this.shadowRoot!.querySelector('ui-modal')!;
    this.dialogueTextEl = this.shadowRoot!.querySelector('.dialogue-text')!;
    this.rewardBannerEl = this.shadowRoot!.querySelector('.reward-banner')!;
    this.actionBtnEl = this.shadowRoot!.querySelector('.action-btn')!;
    this.stickerBtnEl = this.shadowRoot!.querySelector('.sticker-btn')!;
    this.closeBtnEl = this.shadowRoot!.querySelector('.close-btn')!;
    this.shopSectionEl = this.shadowRoot!.querySelector('.shop-section')!;
    this.shopGridEl = this.shadowRoot!.querySelector('.shop-grid')!;
    this.stickersSectionEl = this.shadowRoot!.querySelector('.stickers-section')!;
    this.stickersGridEl = this.shadowRoot!.querySelector('.stickers-grid')!;

    this.shopGridEl.innerHTML = SHOP_ITEMS.map(
      (item) => `
        <button type="button" class="shop-item" data-item="${item.id}">
          <span class="shop-item-title">${item.emoji} ${escapeHtml(item.title)}</span>
          <span class="shop-item-desc">${escapeHtml(item.desc)}</span>
          <span class="shop-item-price">${item.price} moedas</span>
        </button>
      `
    ).join('');

    this.actionBtnEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(NPC_ACTION, { bubbles: true, composed: true }));
    });

    this.stickerBtnEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(NPC_CLAIM_STICKER, { bubbles: true, composed: true }));
    });

    this.shopGridEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.shop-item');
      if (!btn) return;
      const item = btn.getAttribute('data-item');
      if (!item) return;
      this.dispatchEvent(
        new CustomEvent(NPC_SHOP_BUY, { bubbles: true, composed: true, detail: { item } })
      );
    });

    this.closeBtnEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent(PANEL_CLOSE, { bubbles: true, composed: true }));
    });
  }

  open(npc: { id: NpcId; displayName: string }, collectedStickers: string[]) {
    this.npcId = npc.id;
    this.titleEl.setAttribute('title', npc.displayName);
    this.actionBtnEl.textContent = NPC_DIALOGUE_ACTION_LABEL[npc.id];
    this.dialogueTextEl.textContent = NPC_GREETING[npc.id];
    this.rewardBannerEl.classList.add('hidden');
    this.rewardBannerEl.textContent = '';
    this.shopSectionEl.classList.toggle('hidden', npc.id !== 'vendor');
    this.renderStickerAlbum(npc.id, collectedStickers);
  }

  setDialogue(text: string) {
    this.dialogueTextEl.textContent = text;
  }

  showReward(html: string) {
    this.rewardBannerEl.innerHTML = html;
    this.rewardBannerEl.classList.remove('hidden');
  }

  private renderStickerAlbum(npcId: NpcId, collected: string[]) {
    const npcStickers = STICKERS.filter((s) => s.npcType === npcId);
    this.stickersSectionEl.classList.toggle('hidden', npcStickers.length === 0);
    this.stickersGridEl.innerHTML = npcStickers
      .map((sticker) => {
        const isUnlocked = collected.includes(sticker.id);
        const klass = isUnlocked ? 'sticker-item unlocked' : 'sticker-item locked';
        return `
          <div class="${klass}" title="${escapeHtml(sticker.description)}">
            <div class="sticker-emoji">${sticker.emoji}</div>
            <div class="sticker-name">${escapeHtml(sticker.name)}</div>
            <div class="sticker-desc">${escapeHtml(sticker.description)}</div>
          </div>
        `;
      })
      .join('');
  }

  refreshStickerAlbum(collected: string[]) {
    if (!this.npcId) return;
    this.renderStickerAlbum(this.npcId, collected);
  }
}
