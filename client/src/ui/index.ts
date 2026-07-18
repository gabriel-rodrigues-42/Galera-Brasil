import { UiModal } from './components/ui-modal';
import { GmPanel } from './components/gm-panel';
import { GmBuilderTab } from './components/gm-builder-tab';
import { GmSoundTab } from './components/gm-sound-tab';
import { GmShortcutsTab } from './components/gm-shortcuts-tab';
import { GmPermissionsTab } from './components/gm-permissions-tab';
import { GmBadge } from './components/gm-badge';
import { BuilderStatus } from './components/builder-status';
import { GuestbookPanel } from './components/guestbook-panel';
import { NpcPanel } from './components/npc-panel';
import { PostPanel } from './components/post-panel';
import { AddPostPanel } from './components/add-post-panel';
import { JoinOverlay } from './components/join-overlay';
import { GameTimerHud } from './components/game-timer-hud';
import { GameQuestGuide } from './components/game-quest-guide';
import { GameAssemblyOverlay } from './components/game-assembly-overlay';
import { MinigameHost } from './components/minigame-host';
import { MinigameWire } from './components/minigame-wire';
import { MinigameSort } from './components/minigame-sort';
import { MinigamePh } from './components/minigame-ph';
import { MinigameRhythm } from './components/minigame-rhythm';

/** Defines every UI custom element in one place. Call once from main.ts
 * before any DOM query. See DESIGN.md §4 — keeps every component on the
 * import graph (knip) and centralizes tag names. */
export function registerUiComponents(): void {
  customElements.define('ui-modal', UiModal);
  customElements.define('gm-panel', GmPanel);
  customElements.define('gm-builder-tab', GmBuilderTab);
  customElements.define('gm-sound-tab', GmSoundTab);
  customElements.define('gm-shortcuts-tab', GmShortcutsTab);
  customElements.define('gm-permissions-tab', GmPermissionsTab);
  customElements.define('gm-badge', GmBadge);
  customElements.define('builder-status', BuilderStatus);
  customElements.define('guestbook-panel', GuestbookPanel);
  customElements.define('npc-panel', NpcPanel);
  customElements.define('post-panel', PostPanel);
  customElements.define('add-post-panel', AddPostPanel);
  customElements.define('join-overlay', JoinOverlay);
  customElements.define('game-timer-hud', GameTimerHud);
  customElements.define('game-quest-guide', GameQuestGuide);
  customElements.define('game-assembly-overlay', GameAssemblyOverlay);
  customElements.define('minigame-host', MinigameHost);
  customElements.define('minigame-wire', MinigameWire);
  customElements.define('minigame-sort', MinigameSort);
  customElements.define('minigame-ph', MinigamePh);
  customElements.define('minigame-rhythm', MinigameRhythm);
}
