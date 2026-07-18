import { UiModal } from './components/ui-modal';
import { GmPanel } from './components/gm-panel';
import { GmBuilderTab } from './components/gm-builder-tab';
import { GmSoundTab } from './components/gm-sound-tab';
import { GmShortcutsTab } from './components/gm-shortcuts-tab';
import { GmPermissionsTab } from './components/gm-permissions-tab';
import { GmBadge } from './components/gm-badge';
import { BuilderStatus } from './components/builder-status';

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
}
