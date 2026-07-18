# DESIGN.md — Galera Brasil UI/UX Design System

Single source of truth for all **DOM UI** in `client/`. Every panel, overlay, and HUD element listed in the Component Inventory (§8) must follow this document. Out of scope: the Three.js scene, avatars, 3D nametags/textures (`textures.ts`, `hub-manager.ts`), and everything in `server/`.

The migration from the legacy UI (static `index.html` + global `style.css` + wiring in `main.ts`) to this system is tracked phase-by-phase in [PLAN-UI.md](PLAN-UI.md).

---

## 1. Design Language & Visual Philosophy

- **Core theme:** Dark Solar-Minimalism / Premium Solarpunk.
- **Mood:** High-fidelity, clean, immersive, dark-mode oriented.
- **Palette concept:** Deep, moody, tropical-night tones derived from a desaturated Brazilian-flag palette. Sharp borders, smooth glowing states, organic rounded profiles — no corporate flat aesthetics.

## 2. Design Tokens

Tokens live in `client/src/ui/tokens.css`, declared on `:root` and imported once from `main.ts` (before `style.css`). CSS custom properties **inherit into shadow roots**, so components consume tokens directly and never redeclare them.

```css
:root {
  /* Color palette: dark moody Brazilian spectrum */
  --color-bg-base: #0b0f12; /* Ultra-dark deep teal-grey (canvas background) */
  --color-bg-surface: #131a1f; /* Dark forest-teal (card/panel background) */
  --color-bg-elevated: #1c262e; /* Medium forest-teal (hovered/active containers) */

  --color-brand-primary: #ffc542; /* Solar Gold (accent, CTAs, active states) */
  --color-brand-green: #10b981; /* Solarpunk Emerald (success/active/selection) */
  --color-brand-blue: #3b82f6; /* Deep Coastal Blue (informational, shield) */

  --color-text-primary: #f3f4f6;
  --color-text-secondary: #9ca3af;
  --color-text-disabled: #4b5563;

  /* Semantic states */
  --color-danger: #ef4444; /* Errors, damage, destructive actions */
  --color-warning: #f59e0b; /* Cooldowns, caution */
  --color-hud-health: #10b981; /* Health bar fill */
  --color-hud-shield: #3b82f6; /* Shield bar fill */
  --color-hud-xp: #ffc542; /* XP bar fill */

  /* Borders & glows */
  --border-radius-sm: 6px;
  --border-radius-md: 12px;
  --border-radius-lg: 20px;
  --border-ui-glow: 0px 0px 12px rgba(255, 197, 66, 0.15);
  --border-ui-stroke: 1px solid rgba(255, 255, 255, 0.08);
  --focus-ring: 0 0 0 2px rgba(255, 197, 66, 0.55);

  /* Typography */
  --font-display: 'Oxanium', 'Inter', sans-serif; /* Headings, buttons, HUD numerals, tabs */
  --font-body: 'Inter', system-ui, sans-serif; /* Prose, chat, inputs, descriptions */

  /* Fluid type scale — fluidity lives HERE, not in the root font-size (§6) */
  --text-xs: clamp(0.68rem, 0.62rem + 0.25vw, 0.78rem);
  --text-sm: clamp(0.8rem, 0.74rem + 0.3vw, 0.92rem);
  --text-md: clamp(0.95rem, 0.88rem + 0.35vw, 1.1rem);
  --text-lg: clamp(1.15rem, 1.05rem + 0.5vw, 1.4rem);
  --text-xl: clamp(1.4rem, 1.25rem + 0.8vw, 1.9rem);
  --text-2xl: clamp(1.8rem, 1.55rem + 1.2vw, 2.6rem);

  /* Spacing scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;

  /* Motion */
  --transition-fast: 0.15s ease;

  /* Layering (§7) */
  --z-hud: 10;
  --z-chat: 50;
  --z-panel: 100;
  --z-overlay: 500;
  --z-debug: 1000;
}
```

**Strict token adherence:** no hardcoded hex colors, radii, z-indexes, or transition timings inside component styles. If a value is missing, add a token first. (Legacy `style.css` is exempt until each section is migrated and deleted.)

## 3. Typography & Fonts

Self-hosted variable fonts — no CDN, no third-party requests (preserves the $0-infra target and offline dev):

- `client/public/fonts/oxanium-latin-variable.woff2` (wght 200–800)
- `client/public/fonts/inter-latin-variable.woff2` (wght 100–900)

Declared in `client/src/ui/fonts.css`:

```css
@font-face {
  font-family: 'Oxanium';
  src: url('/fonts/oxanium-latin-variable.woff2') format('woff2');
  font-weight: 200 800;
  font-display: swap;
}
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin-variable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}
```

Both are preloaded in `index.html` (`<link rel="preload" as="font" type="font/woff2" crossorigin>`).

**Usage rules:**

- `--font-display` (Oxanium): headings, button labels (uppercase + letter-spacing), tab labels, HUD numerals, badges.
- `--font-body` (Inter): everything else — chat, guestbook messages, descriptions, form inputs.
- Note: Oxanium is a geometric **sans**, so its fallback chain is `'Inter', sans-serif` — never `monospace`.

## 4. Component Architecture

All UI components are **Vanilla TypeScript Web Components**: zero dependencies (nothing added next to Three.js + Colyseus), native Shadow DOM encapsulation (styles can't bleed in or out), framework-agnostic forever.

### Rules

- `extends HTMLElement`, `this.attachShadow({ mode: 'open' })` in the constructor.
- Render in `connectedCallback()`; clean up **everything** (rAF loops, intervals, document/window listeners) in `disconnectedCallback()`.
- **Panel-level components are the unit.** Do not build a primitive zoo (`<ui-button>`, `<ui-tabs>`, …) — shared chrome is CSS in `shared-styles.ts`, and the only chrome component is `<ui-modal>` (backdrop + panel frame + title + close button + slotted content).
- All interactive elements declare `:hover`, `:focus-visible` (use `--focus-ring`), and `[disabled]` states.

### TypeScript constraints (this repo)

- `verbatimModuleSyntax` → type-only imports **must** use `import type { SelfState } from '../../network'`.
- `erasableSyntaxOnly` → **no decorators, no enums**. Use `as const` objects and string-literal unions.
- `noUnusedLocals` / `noUnusedParameters` are errors.
- Relative imports are extensionless (repo convention).

### Registration (knip-safe)

Every component file exports its class. `client/src/ui/index.ts` imports them all and defines them in one place:

```typescript
import { UiModal } from './components/ui-modal';
// ...one import per component

export function registerUiComponents(): void {
  customElements.define('ui-modal', UiModal);
  // ...one define per component
}
```

`main.ts` calls `registerUiComponents()` once, before any DOM query. This keeps every component on the import graph (knip passes) and centralizes tag names. Never call `customElements.define` anywhere else.

### Shared styles

`client/src/ui/shared-styles.ts` exports a constructable `CSSStyleSheet` with the cross-component basics: button styles (idle = `--color-bg-elevated` + stroke; primary = `--color-brand-primary` bg with `--color-bg-base` text; hover = `filter: brightness(1.1)` over `--transition-fast`), input/textarea styles, range-slider vendor pseudo-elements, scrollbar styling, `.hidden`, focus states.

Components adopt it plus their own sheet:

```typescript
this.shadowRoot!.adoptedStyleSheets = [sharedStyles, ownSheet];
```

### Template

```typescript
import { sharedStyles } from '../shared-styles';

export class ExamplePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, exampleSheet];
    this.shadowRoot!.innerHTML = `<div class="panel">…</div>`;
    // wire internal listeners
  }

  disconnectedCallback() {
    // cancel rAF/intervals, remove document-level listeners
  }
}
```

## 5. File Layout

```
client/src/ui/
  tokens.css          # design tokens (§2)
  fonts.css           # @font-face (§3)
  shared-styles.ts    # constructable shared CSSStyleSheet
  escape.ts           # escapeHtml (§9)
  events.ts           # event name constants + typed detail interfaces
  ui-state.ts         # shared open/close flags + anyModalOpen() (added Phase 1)
  index.ts            # registerUiComponents()
  components/         # one file per component, pure presentation
    ui-modal.ts
    gm-panel.ts …
  controllers/        # glue: network/api ↔ components (§8)
    gm-controller.ts …
```

## 6. Layout & Responsiveness

- **No fixed `px` for layout sizing** in components — use `rem`/`em`/`vw`/`dvh`/percentages and the token scales. Exception: **HUD game-feel elements** (crosshair, bar heights, hotbar slot size, vignette) may use fixed px.
- **Modals:** `width: min(92vw, 540px)`; wide panels (GM panel) `width: min(94vw, 760px)`. Centered overlay; full-height surfaces use `dvh`, not `vh`.
- **One breakpoint:** 768px. Below it, panels expand toward full width and dense text sizes step down (the fluid type tokens handle most of this automatically).
- **Root font-size:** the fluid root sizing `html { font-size: clamp(14px, 1.2vw, 18px) }` is **deferred to the final migration phase** — legacy `style.css` sizes fonts in `rem`, so changing the root rescales unmigrated panels. Until then, fluidity comes exclusively from the `--text-*` tokens.

## 7. Layering

All `z-index` values come from the token scale — never invent a number:

| Token         | Value | Used by                                                                                |
| ------------- | ----- | -------------------------------------------------------------------------------------- |
| `--z-hud`     | 10    | Crosshair, HUD bars, hotbar, boss bar, floats, interact hint, builder status, GM badge |
| `--z-chat`    | 50    | Chat card + input                                                                      |
| `--z-panel`   | 100   | Post, guestbook, add-post, NPC, GM panels                                              |
| `--z-overlay` | 500   | Join overlay, death overlay                                                            |
| `--z-debug`   | 1000  | Debug panel                                                                            |

**One modal at a time** — the ui-state guards (§8) enforce this; components never assume stacking among panels.

## 8. Data Flow & Colyseus Hookup

The layering is strict: **server state → `Network` callbacks / `api.ts` → controller → component**, and **component events → controller → `Network`/`api.ts`**.

### Components are pure presentation

`ui/components/*` must **never** import `network.ts`, `api.ts`, or any manager (`hub-manager`, `radio-manager`, `npc-manager`, …). They receive data and emit events. This is what makes them safe to restyle and extend without breaking game logic.

### Data in

- Typed **properties/methods**: `battleHud.updateSelf(state)`, `guestbookPanel.setComments(posts)`, `gmPanel.setPlacedObjects(objs)`.
- **Attributes** only for boolean/string flags (`open`, `variant`, `compact`) — never JSON-in-attributes.

### Events out

`CustomEvent` with `{ bubbles: true, composed: true }` (`composed` so events cross the shadow boundary). Names are kebab-case `<domain>-<action>`:

- `gm-build-select`, `gm-spawn-enemy`, `gm-respawn`, `gm-placed-delete`, `gm-bypass-toggle`
- `guestbook-submit`, `guestbook-react`, `guestbook-allow-toggle`
- `npc-shop-buy`, `npc-claim-sticker`, `post-submit`, `join-submit`, `chat-send`
- generic `panel-close`

Event name constants and typed `detail` interfaces live in `client/src/ui/events.ts`. Add them **per-phase as they're used** — knip flags speculative unused exports.

### Controllers

`client/src/ui/controllers/*-controller.ts` is where the old `main.ts` panel logic lives: subscribe to `Network` callbacks, call `api.ts`, push data into components, listen for component events, and manage open/close + pointer lock through the injected context (`releasePointerForUI` / `resumeAfterUI`). `main.ts` keeps only the global key bindings that call into controllers (e.g. B → `gmController.toggle()`).

### Shared UI state

`client/src/ui/ui-state.ts` holds the open/close flags (`chatInputOpen`, `gmPanelOpen`, `guestbookOpen`, `addPostOpen`, `openPost`, `openNpc`, …) plus `anyModalOpen()`. It replaces the loose `let` flags in `main.ts` and **must replicate the existing one-modal-at-a-time guard behavior exactly** — the movement/attack/interaction gates (`canAttack`, `updateMovement`, E/B/Enter/C key routing) all consult it. Note: in the legacy code `openPost` is `HubPost | null` and `openNpc` is `NpcDef | null` (not booleans) — when porting, either keep `uiState` as booleans derived from the real payload state (`openPost: post !== null`) or store the payload itself and treat non-null as "open"; pick one convention in Phase 1 and use it consistently across all controllers.

## 9. Security & Content Rules

- Any **user-authored string** — chat messages, guestbook author/message, hub owner/tag, post title/body/caption, player names — is rendered via `textContent` or passed through `escapeHtml` (`client/src/ui/escape.ts`).
- `innerHTML` is allowed only for **static component templates** and template literals whose interpolations are all pre-escaped.
- Link posts keep `encodeURI(url)` + `target="_blank" rel="noopener noreferrer"`.

## 10. Keyboard, Focus & Pointer Lock

- **Global key routing stays out of components.** WASD/E/B/C/Enter/Esc/`~` handling lives in `main.ts` and controllers; components only handle keys for their own internal inputs.
- Text inputs inside shadow DOM call `event.stopPropagation()` on `keydown` so keystrokes never reach the game's window listener (this mirrors the legacy `#chat-input` guarantee).
- `document.activeElement` returns the **host element** when focus is inside a shadow root — do not use it for "is the user typing?" checks; use the `ui-state` flags.
- Panels never touch pointer lock directly. Controllers pair every open with `releasePointerForUI()` and every close with `resumeAfterUI()`.
- Esc handling stays centralized in `main.ts`: the browser reserves Esc for exiting pointer lock, and Chrome enforces a ~1.3s re-lock cooldown (the existing `requestLock()` catch handles rejection — don't bypass it).

## 11. Migration Status

See [PLAN-UI.md](PLAN-UI.md) for the phase definitions. Status of each inventory row:

| Legacy (index.html id)                                                                      | Target component                                                                               | Phase | Status  |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- | ------- |
| `#gm-panel` (4 tabs)                                                                        | `<gm-panel>` + `<gm-builder-tab>` `<gm-shortcuts-tab>` `<gm-sound-tab>` `<gm-permissions-tab>` | 1     | ✅ done |
| `#gm-help-badge`, `#builder-status`                                                         | `<gm-badge>`, `<builder-status>`                                                               | 1     | ✅ done |
| `#guestbook-panel`                                                                          | `<guestbook-panel>`                                                                            | 2     | ✅ done |
| `#post-panel`, `#add-post-panel`                                                            | `<post-panel>`, `<add-post-panel>`                                                             | 2     | ✅ done |
| `#npc-panel` + shop + stickers                                                              | `<npc-panel>`                                                                                  | 3     | ✅ done |
| `#hud` `#hotbar` `#boss-bar` `#hud-floats` `#death-overlay` `#damage-vignette` `#crosshair` | `<battle-hud>` (replaces `hud.ts`)                                                             | 4     | ✅ done |
| `#overlay` (join)                                                                           | `<join-overlay>`                                                                               | 5     | ✅ done |
| `#chat-card` + `#chat-input`                                                                | `<chat-box>`                                                                                   | 6     | ✅ done |
| `#interact-hint`, `#debug-panel`                                                            | `<interact-hint>`, `<debug-panel>`                                                             | 7     | ✅ done |

## Appendix — Gotchas Register

1. **`!`-asserted querySelectors crash at runtime, not compile time.** When migrating a panel, delete its markup, its `main.ts` element consts, and its wiring **in the same commit**, and smoke-boot the game before committing — typecheck won't catch a missing element.
2. **Global `@keyframes` don't pierce shadow roots.** Every animation a component uses must be declared inside its own sheet (or `shared-styles.ts`). Exception: `bite-shake` animates `document.body` and stays in the global stylesheet.
3. **Root font-size change is a final-phase-only move** (legacy `rem` usage, §6).
4. **Range sliders in shadow DOM** need the vendor pseudo-element styling (`::-webkit-slider-thumb`, `::-moz-range-thumb`) inside the component/shared sheet; `input` events work normally.
5. **Canvas inside shadow DOM** (radio visualizer): size via `width`/`height` attributes, not CSS; `getContext('2d')` works identically; the rAF loop must stop when the panel closes and in `disconnectedCallback` (fixes the legacy always-on loop).
6. **knip**: unimported component files and unused exports fail pre-commit. The `ui/index.ts` registry is mandatory; add `events.ts` constants only when used.
7. **`verbatimModuleSyntax`**: `import type` for `SelfState`, `HubPost`, `NpcDef`, etc. — the most common new-component compile error.
8. **Prettier** doesn't format inside TS template strings — keep shadow templates readably indented by hand.
9. **One-modal-at-a-time invariant**: no shared `ui-state.ts` module exists (planned in Phase 1, never needed) — each controller (`hub-panels-controller`, `npc-panel-controller`, `gm-controller`, `chat-controller`) tracks its own open/closed state via a local closure exposed as a getter, and every B/Enter/C/E key-routing guard in main.ts checks all of them individually (`!hubPanelsController.isPostOpen && !npcPanelController.isOpen && !gmController.isOpen && ...`). If a new panel skips being added to those guard lists, key routing starts colliding.
