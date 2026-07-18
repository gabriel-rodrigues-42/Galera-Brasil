import { log } from '../../logger';
import * as api from '../../api';
import type { Network, ShopPurchaseResultEvent, ShopItemId } from '../../network';
import type { NpcPanel } from '../components/npc-panel';
import type { NpcDef } from '../../npc-manager';
import {
  NPC_ACTION,
  NPC_CLAIM_STICKER,
  NPC_SHOP_BUY,
  PANEL_CLOSE,
  type NpcShopBuyDetail,
} from '../events';

export interface NpcPanelControllerDeps {
  npcPanel: NpcPanel;
  network: Network;

  getMyName(): string | null;
  getCollectedStickers(): string[];
  addCollectedSticker(id: string): void;

  resetVelocity(): void;
  releasePointerForUI(): void;
  resumeAfterUI(): void;
}

export interface NpcPanelController {
  readonly isOpen: boolean;
  readonly openNpc: NpcDef | null;
  open(npc: NpcDef): void;
  close(): void;
}

export function initNpcPanelController(deps: NpcPanelControllerDeps): NpcPanelController {
  let currentNpc: NpcDef | null = null;

  function open(npc: NpcDef) {
    currentNpc = npc;
    deps.npcPanel.open(npc, deps.getCollectedStickers());
    deps.npcPanel.hidden = false;
    deps.resetVelocity();
    deps.releasePointerForUI();
    log('info', `NPC panel opened: ${npc.id}`);
  }

  function close() {
    currentNpc = null;
    deps.npcPanel.hidden = true;
    log('info', 'NPC panel closed');
  }

  deps.npcPanel.addEventListener(NPC_ACTION, () => {
    if (!currentNpc) return;
    const npcId = currentNpc.id;
    api
      .getRandomNpcDialogue(npcId)
      .then((res) => {
        deps.npcPanel.setDialogue(res.content);
        log('info', `Fetched dialogue for ${npcId}: ${res.content}`);
      })
      .catch((err) => {
        log('error', `Failed to fetch NPC dialogue: ${err}`);
        deps.npcPanel.setDialogue('Ops, deu um erro de conexão ao falar com o NPC!');
      });
  });

  deps.npcPanel.addEventListener(NPC_CLAIM_STICKER, () => {
    const myName = deps.getMyName();
    if (!currentNpc || !myName) return;
    const npcId = currentNpc.id;

    api
      .claimNpcSticker(myName, npcId)
      .then((res) => {
        if (res.success && res.sticker) {
          deps.addCollectedSticker(res.sticker.id);
          deps.npcPanel.refreshStickerAlbum(deps.getCollectedStickers());
          deps.npcPanel.showReward(
            `🎉 <strong>Sticker Desbloqueado!</strong> Você ganhou o sticker <strong>${res.sticker.emoji} ${res.sticker.name}</strong>!<br><span style="font-size:0.85rem">${res.sticker.description}</span>`
          );
          log('info', `Claimed sticker ${res.sticker.id}`);
        } else if (res.error === 'cooldown') {
          const secs = Math.ceil((res.remainingTimeMs ?? 0) / 1000);
          deps.npcPanel.showReward(
            `⏳ <strong>Calma lá!</strong> O NPC está descansando. Tente novamente em <strong>${secs}s</strong>.`
          );
        } else if (res.error === 'already_all') {
          deps.npcPanel.showReward(
            `🏆 <strong>Álbum Cheio!</strong> Você já coletou todos os stickers de ${currentNpc?.displayName}!`
          );
        } else {
          deps.npcPanel.showReward(`❌ Erro ao reivindicar: ${res.error}`);
        }
      })
      .catch((err) => {
        log('error', `Failed to claim sticker: ${err}`);
        deps.npcPanel.showReward('❌ Erro de conexão com o servidor.');
      });
  });

  deps.npcPanel.addEventListener(NPC_SHOP_BUY, ((e: CustomEvent<NpcShopBuyDetail>) => {
    if (!currentNpc || currentNpc.id !== 'vendor') return;
    deps.network.sendShopPurchase(e.detail.item as ShopItemId);
  }) as EventListener);

  deps.npcPanel.addEventListener(PANEL_CLOSE, () => {
    close();
    deps.resumeAfterUI();
  });

  function handleShopPurchaseResult(event: ShopPurchaseResultEvent) {
    if (!currentNpc || currentNpc.id !== 'vendor') return;
    deps.npcPanel.showReward(`${event.success ? '✅' : '❌'} ${event.message}`);
  }
  deps.network.onShopPurchaseResult = handleShopPurchaseResult;

  return {
    get isOpen() {
      return currentNpc !== null;
    },
    get openNpc() {
      return currentNpc;
    },
    open,
    close,
  };
}
