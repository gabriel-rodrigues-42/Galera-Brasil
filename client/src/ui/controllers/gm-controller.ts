import { log } from '../../logger';
import type { GmBadge } from '../components/gm-badge';
import type { GmPanel } from '../components/gm-panel';
import type { GmBuilderTab, PlacedItemView } from '../components/gm-builder-tab';
import type { GmSoundTab, AudioSource, PlaybackState } from '../components/gm-sound-tab';
import type { GmPermissionsTab } from '../components/gm-permissions-tab';
import type { BuilderStatus } from '../components/builder-status';
import { BUILD_TYPE_LABELS, type BuildType } from '../gm-catalog';
import {
  GM_BUILD_TOGGLE,
  GM_BUILD_SELECT,
  GM_SPAWN_ENEMY,
  GM_SPAWN_BOSS,
  GM_CLEAR_ENEMIES,
  GM_RESPAWN,
  GM_PLACED_DELETE,
  GM_TAB_CHANGE,
  PANEL_CLOSE,
  RADIO_TOGGLE,
  RADIO_NEXT,
  RADIO_PREV,
  VOLUME_CHANGE,
  GM_BYPASS_TOGGLE,
  GM_HUB_PERMISSION_TOGGLE,
  type GmBuildSelectDetail,
  type GmSpawnEnemyDetail,
  type GmRespawnDetail,
  type GmPlacedDeleteDetail,
  type GmTabChangeDetail,
  type VolumeChangeDetail,
  type GmBypassToggleDetail,
  type GmHubPermissionToggleDetail,
  type EnemyKind,
  type RespawnTarget,
  type GmTab,
  type VolumeChannel,
} from '../events';

export interface GmControllerDeps {
  badge: GmBadge;
  panel: GmPanel;
  builderTab: GmBuilderTab;
  soundTab: GmSoundTab;
  permissionsTab: GmPermissionsTab;
  builderStatus: BuilderStatus;

  isConnected(): boolean;
  isChatInputOpen(): boolean;
  isAddPostOpen(): boolean;
  hasOpenPost(): boolean;
  hasOpenNpc(): boolean;

  resetKeys(): void;
  resetVelocity(): void;
  releasePointerForUI(): void;
  resumeAfterUI(): void;

  isBuilderModeActive(): boolean;
  setBuilderModeActive(active: boolean): void;
  updateGhostVisual(): void;
  hideGhost(): void;
  clearGhost(): void;

  /** Recomputes the placed-objects view model and pushes it to the controller
   * via `GmController.setPlacedObjects` — see main.ts's `updatePlacedObjectsList`. */
  refreshPlacedList(): void;
  onPlacedDelete(id: string): void;

  onSpawnEnemy(kind: EnemyKind): void;
  onSpawnBoss(): void;
  onClearEnemies(): void;
  onRespawn(target: RespawnTarget): void;

  resumeRadio(): void;
  refreshPermissions(): void;

  audioSource: AudioSource;
  getPlaybackState(): PlaybackState;
  onRadioToggle(): void;
  onRadioNext(): void;
  onRadioPrev(): void;
  onVolumeChange(channel: VolumeChannel, value: number): void;

  onBypassToggle(enabled: boolean): void;
  onHubPermissionToggle(owner: string, allowed: boolean): void;

  setBuildType(type: BuildType): void;
}

export interface GmController {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  setPlacedObjects(items: PlacedItemView[]): void;
}

/** Wires the GM badge + panel + builder tab to game/network callbacks. See
 * DESIGN.md §8 — this is where the old openGmPanel/closeGmPanel/build-toggle/
 * card-select/spawn/respawn/tab-switch wiring from main.ts now lives. */
export function initGmController(deps: GmControllerDeps): GmController {
  let panelOpen = false;
  let activeTab: GmTab = 'builder';

  deps.soundTab.setAudioSource(deps.audioSource);

  function open() {
    panelOpen = true;
    deps.resetKeys();
    deps.resetVelocity();
    deps.releasePointerForUI();
    deps.hideGhost();
    deps.refreshPlacedList();
    deps.panel.hidden = false;
    if (activeTab === 'sound') deps.soundTab.startVisualizer();
    if (activeTab === 'permissions') deps.refreshPermissions();
    log('info', 'GM builder panel opened');
  }

  function close() {
    panelOpen = false;
    deps.panel.hidden = true;
    deps.soundTab.stopVisualizer();
    log('info', 'GM builder panel closed');
  }

  deps.badge.addEventListener('click', () => {
    if (
      !deps.isConnected() ||
      deps.isChatInputOpen() ||
      deps.isAddPostOpen() ||
      deps.hasOpenPost() ||
      deps.hasOpenNpc()
    )
      return;
    if (panelOpen) {
      close();
      deps.resumeAfterUI();
    } else {
      open();
    }
  });

  deps.panel.addEventListener(PANEL_CLOSE, () => {
    close();
    deps.resumeAfterUI();
  });

  deps.panel.addEventListener(GM_TAB_CHANGE, ((e: CustomEvent<GmTabChangeDetail>) => {
    activeTab = e.detail.tab;
    if (activeTab === 'sound') {
      deps.resumeRadio();
      deps.soundTab.startVisualizer();
    } else {
      deps.soundTab.stopVisualizer();
    }
    if (activeTab === 'permissions') deps.refreshPermissions();
  }) as EventListener);

  deps.soundTab.addEventListener(RADIO_TOGGLE, () => {
    deps.onRadioToggle();
    deps.soundTab.setPlaybackState(deps.getPlaybackState());
  });
  deps.soundTab.addEventListener(RADIO_NEXT, () => {
    deps.onRadioNext();
    deps.soundTab.setPlaybackState(deps.getPlaybackState());
  });
  deps.soundTab.addEventListener(RADIO_PREV, () => {
    deps.onRadioPrev();
    deps.soundTab.setPlaybackState(deps.getPlaybackState());
  });
  deps.soundTab.addEventListener(VOLUME_CHANGE, ((e: CustomEvent<VolumeChangeDetail>) => {
    deps.onVolumeChange(e.detail.channel, e.detail.value);
  }) as EventListener);

  deps.builderTab.addEventListener(GM_BUILD_TOGGLE, () => {
    const active = !deps.isBuilderModeActive();
    deps.setBuilderModeActive(active);
    deps.builderTab.setActive(active);
    if (active) {
      deps.builderStatus.hidden = false;
      deps.updateGhostVisual();
      close();
      deps.resumeAfterUI();
    } else {
      deps.builderStatus.hidden = true;
      deps.clearGhost();
    }
  });

  deps.builderTab.addEventListener(GM_BUILD_SELECT, ((e: CustomEvent<GmBuildSelectDetail>) => {
    const { type } = e.detail;
    deps.setBuildType(type);
    deps.builderStatus.setItem(BUILD_TYPE_LABELS[type]);
    if (deps.isBuilderModeActive()) deps.updateGhostVisual();
  }) as EventListener);

  deps.builderTab.addEventListener(GM_SPAWN_ENEMY, ((e: CustomEvent<GmSpawnEnemyDetail>) => {
    deps.onSpawnEnemy(e.detail.kind);
  }) as EventListener);

  deps.builderTab.addEventListener(GM_SPAWN_BOSS, () => deps.onSpawnBoss());
  deps.builderTab.addEventListener(GM_CLEAR_ENEMIES, () => deps.onClearEnemies());

  deps.builderTab.addEventListener(GM_RESPAWN, ((e: CustomEvent<GmRespawnDetail>) => {
    deps.onRespawn(e.detail.target);
  }) as EventListener);

  deps.builderTab.addEventListener(GM_PLACED_DELETE, ((e: CustomEvent<GmPlacedDeleteDetail>) => {
    deps.onPlacedDelete(e.detail.id);
  }) as EventListener);

  deps.permissionsTab.addEventListener(GM_BYPASS_TOGGLE, ((
    e: CustomEvent<GmBypassToggleDetail>
  ) => {
    deps.onBypassToggle(e.detail.enabled);
  }) as EventListener);

  deps.permissionsTab.addEventListener(GM_HUB_PERMISSION_TOGGLE, ((
    e: CustomEvent<GmHubPermissionToggleDetail>
  ) => {
    deps.onHubPermissionToggle(e.detail.owner, e.detail.allowed);
  }) as EventListener);

  return {
    get isOpen() {
      return panelOpen;
    },
    open,
    close,
    setPlacedObjects: (items) => deps.builderTab.setPlacedObjects(items),
  };
}
