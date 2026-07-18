/** Custom-event name constants + typed `detail` payloads for UI components.
 * See DESIGN.md §8 — components dispatch these (bubbles+composed), controllers
 * listen. Added incrementally per phase; knip flags unused exports, so only
 * add an entry once a component/controller pair actually uses it. */
import type { BuildType } from './gm-catalog';

export const GM_BUILD_TOGGLE = 'gm-build-toggle';
export const GM_BUILD_SELECT = 'gm-build-select';
export const GM_SPAWN_ENEMY = 'gm-spawn-enemy';
export const GM_SPAWN_BOSS = 'gm-spawn-boss';
export const GM_CLEAR_ENEMIES = 'gm-clear-enemies';
export const GM_RESPAWN = 'gm-respawn';
export const GM_PLACED_DELETE = 'gm-placed-delete';
export const GM_TAB_CHANGE = 'gm-tab-change';
export const PANEL_CLOSE = 'panel-close';
export const RADIO_TOGGLE = 'radio-toggle';
export const RADIO_NEXT = 'radio-next';
export const RADIO_PREV = 'radio-prev';
export const VOLUME_CHANGE = 'volume-change';
export const GM_BYPASS_TOGGLE = 'gm-bypass-toggle';
export const GM_HUB_PERMISSION_TOGGLE = 'gm-hub-permission-toggle';
export const GM_START_MUTIRAO = 'gm-start-mutirao';
export const GM_FORCE_MUTIRAO = 'gm-force-mutirao';

export const GUESTBOOK_SUBMIT = 'guestbook-submit';
export const GUESTBOOK_REACT = 'guestbook-react';
export const GUESTBOOK_ALLOW_TOGGLE = 'guestbook-allow-toggle';
export const POST_SUBMIT = 'post-submit';
export const JOIN_SUBMIT = 'join-submit';
export const RESUME_CLICK = 'resume-click';

export const NPC_ACTION = 'npc-action';
export const NPC_CLAIM_STICKER = 'npc-claim-sticker';
export const NPC_SHOP_BUY = 'npc-shop-buy';

export type EnemyKind = 'mosquito' | 'barata' | 'pombo';
export type RespawnTarget = 'npcs' | 'trees' | 'canopies' | 'lake' | 'all';
export type GmTab = 'builder' | 'shortcuts' | 'sound' | 'permissions';
export type VolumeChannel = 'master' | 'sfx' | 'radio';

export interface GmBuildSelectDetail {
  type: BuildType;
}
export interface GmSpawnEnemyDetail {
  kind: EnemyKind;
}
export interface GmRespawnDetail {
  target: RespawnTarget;
}
export interface GmPlacedDeleteDetail {
  id: string;
}
export interface GmTabChangeDetail {
  tab: GmTab;
}
export interface VolumeChangeDetail {
  channel: VolumeChannel;
  value: number;
}
export interface GmBypassToggleDetail {
  enabled: boolean;
}
export interface GmHubPermissionToggleDetail {
  owner: string;
  allowed: boolean;
}
export interface GuestbookSubmitDetail {
  message: string;
}
export interface GuestbookReactDetail {
  postId: string;
  emoji: string;
}
export interface GuestbookAllowToggleDetail {
  allowed: boolean;
}
export interface PostSubmitDetail {
  title: string;
  body: string;
}
export interface JoinSubmitDetail {
  name: string;
}
export interface NpcShopBuyDetail {
  item: string;
}
