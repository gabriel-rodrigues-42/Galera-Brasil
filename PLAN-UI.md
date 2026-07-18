# PLAN-UI.md — Roadmap: HUB/UI Refactor to the Design System

Migrates the entire client UI from the legacy stack (static `client/index.html` markup + global `client/src/style.css` + wiring inside `client/src/main.ts`) to the Web-Component design system defined in [DESIGN.md](DESIGN.md).

**Ground rules**

- **Incremental & always shippable:** the game is fully playable after every phase (and every 1a/1b/1c slice). Legacy panels keep their old look until their phase lands; migrated panels get the new Dark Solar-Minimalism identity immediately.
- **Hub-first order:** GM panel → guestbook/posts → NPC shop → battle HUD → join overlay → chat → leftovers.
- Per-phase mechanics: build component(s) → register in `ui/index.ts` → replace the static markup in `index.html` with the custom-element tag (kept declaratively inside `#app` to preserve layering) → move `main.ts` wiring into a controller → **delete the dead `querySelector` consts in the same commit** (they're `!`-asserted; leftovers crash at boot, not at compile) → delete the panel's `style.css` rules **by selector, not by line number** (line anchors shift as phases land).

**Verification, every phase:**

```
pnpm typecheck && pnpm lint && pnpm knip
pnpm dev        # then the phase's click-through checklist, ideally 2 browser windows
pnpm build      # at minimum on phases 0, 4, 7
```

---

## Phase 0 — Foundation (no visual change) ✅

New files:

- `client/public/fonts/oxanium-latin-variable.woff2`, `client/public/fonts/inter-latin-variable.woff2` (self-hosted, latin subset, downloaded from Google Fonts' static CDN — no runtime dependency on it)
- `client/src/ui/tokens.css`, `client/src/ui/fonts.css` (contents per DESIGN.md §2–3)
- `client/src/ui/shared-styles.ts` — constructable shared `CSSStyleSheet`
- `client/src/ui/escape.ts` — move `escapeHtml` out of `main.ts` (main.ts imports it)
- `client/src/ui/components/ui-modal.ts` — the one chrome primitive
- `client/src/ui/index.ts` — `registerUiComponents()`
- `DESIGN.md` at root; **delete** `new-design-system.md`
- This file (`PLAN-UI.md`)

**Deviation from the original slice list:** `ui-state.ts` was _not_ created in this phase. It has zero consumers until a controller exists to use it, and knip fails on unimported files — creating it as inert scaffolding would violate the no-dead-code rule. It moves to **Phase 1**, where `gm-controller.ts` is its first real consumer.

Edits: `main.ts` — `import './ui/tokens.css'` and `'./ui/fonts.css'` above `import './style.css'`; call `registerUiComponents()` before DOM queries. `index.html` — two font preload links.

☑ Verified 2026-07-18: `pnpm typecheck` clean (both workspaces); `pnpm lint` — 0 errors, 19 pre-existing warnings unrelated to this change; `pnpm knip` clean; `pnpm dev` — game boots with no console errors, both woff2 files load 200 OK, `getComputedStyle(document.documentElement).getPropertyValue('--color-brand-primary')` → `#ffc542`. Visual screenshot capture was inconclusive (automation timeout against the game's continuous WebGL render loop — a tooling limitation, not a regression); network/console/computed-style evidence is sufficient since this phase touches only imports and inert CSS custom properties.

## Phase 1 — GM panel (largest; 3 shippable slices) ✅

### 1a — Shell + Builder tab ✅

- `<gm-panel>` (uses `<ui-modal>`, owns the tab bar + panes), `<gm-builder-tab>`, `<gm-badge>`, `<builder-status>`.
- Builder card catalog rendered from a data array (kills ~90 lines of static HTML); placed-objects list via `setPlacedObjects(objs)` (absorbs the DOM half of `updatePlacedObjectsList`, main.ts:1029).
- Events: `gm-build-toggle`, `gm-build-select {type}`, `gm-spawn-enemy {kind}`, `gm-spawn-boss`, `gm-clear-enemies`, `gm-respawn {target}`, `gm-placed-delete {id}`, `panel-close`.
- **Delete the hidden `#gm-select-build-type` compat shim** (index.html:245, style.css `#gm-select-build-type`, main.ts:103) — the controller listens to `gm-build-select` directly.
- New `client/src/ui/controllers/gm-controller.ts` — `initGmController({...deps, releasePointerForUI, resumeAfterUI})`; open/close moves here; `main.ts`'s B-key handler and Escape/canAttack/canSwitch/KeyN/KeyC guards now read `gmController.isOpen` and call `gmController.open()/close()` instead of the old `gmPanelOpen` flag.
- Also built: `client/src/ui/gm-catalog.ts` (shared build catalog + labels, replaces the duplicated `emojiMap` literals) and `client/src/ui/events.ts` GM event constants.
- Gotcha hit and fixed: the join-success handler still called `gmHelpBadgeEl.classList.remove('hidden')` — a leftover from the pre-migration DOM API. `<gm-badge>` visibility is driven by the native `hidden` attribute (per DESIGN.md's `:host([hidden])` pattern), so that call was silently a no-op. Fixed to `gmHelpBadgeEl.hidden = false`. Worth grepping for `.classList` on any element being migrated in later phases — it won't error, it'll just silently do nothing.

### 1b — Som & Rádio tab ✅

- `<gm-sound-tab>` owns volume sliders, track info, transport controls, **and the visualizer canvas**. The rAF draw loop moves inside the component and **runs only while the panel is open on the sound tab** (fixes the legacy always-on loop — old code called `drawVisualizer()` once at module init and it ran forever, even before the panel was ever opened). Started in `gm-controller.ts`'s `open()` (if already on the sound tab) and on `GM_TAB_CHANGE → 'sound'`; stopped on tab-away, `close()`, and `disconnectedCallback` as a safety net.
- Controller passes pull-style `AudioSource` accessors (`getAnalyser()`, `getIsPlaying()`) via `soundTab.setAudioSource()` once at controller init — the "purist" option from the original plan, keeping RadioManager itself out of the component. Push-style `setPlaybackState({isPlaying, trackName, trackGenreLine})` after each transport action (toggle/next/prev). Events: `radio-toggle`, `radio-next`, `radio-prev`, `volume-change {channel, value}` (volume % label updates locally in the component on `input`, no round-trip needed).
- Verified live: play/pause toggles state + track name/genre correctly, next-track switches tracks, volume slider updates its own label and reaches `RadioManager`, panel open/close and tab-switch correctly start/stop the draw loop with no console errors on a clean reload.

### 1c — Shortcuts + Permissions tabs ✅

- `<gm-shortcuts-tab>`: pure static content, trivial — no props/methods/events.
- `<gm-permissions-tab>`: `setLoading()`, `setError()`, `setHubs(hubs: HubPermissionRow[])`, `setBypass(enabled)`; events `gm-bypass-toggle {enabled}`, `gm-hub-permission-toggle {owner, allowed}` (both added to the shared `events.ts`, matching the convention every other GM component follows — not defined locally in the component file). `refreshGmPermissionsTab` (main.ts) keeps its 3-branch shape (loading/hubs-or-empty/error) but now pushes into the component via those methods instead of building `innerHTML` directly; `gm-controller.ts` only listens for the two outbound events and forwards to `onGmBypassToggle`/`onGmHubPermissionToggle` (same split as `soundTab`/`builderStatus`: main.ts holds a direct element ref for pushing data, the controller only wires outbound events).
- Deletion note: `.gm-permissions-*` and `.gm-shortcuts-container`/`.shortcut-*`/`kbd` CSS was the **last content in `style.css`** — deleting it left a clean trailing blank line, confirmed by `wc -l` before/after.

Deletions across Phase 1 (final tally): `#gm-panel` block in index.html (~330 lines) → 6 component tags; ~1,700 lines of CSS removed from `style.css` (badge/panel/builder/tabs/grid/actions/sound-mixer/radio-player/shortcuts/permissions, including ~50 lines of already-dead `.gm-section`/`.gm-action-btn` CSS from an older pre-tabbed design, caught and removed as part of the cleanup); `main.ts` shed ~600 lines (GM selectors, open/close, all `gm-btn-*`/`gmSelectBuildType`/volume/radio/permissions listeners, tab-switching/grid-card wiring) while gaining `gm-catalog.ts`, `gm-controller.ts`, and 6 component files (~950 net new lines in `ui/`, but now composable/reusable instead of one 2,500-line file).

☑ Verified (all 3 slices, live in the browser, 2+ fresh reloads to rule out HMR/stale-console noise): join → badge → panel opens in the new visual identity with pointer released; all 4 tabs switch (Construtor/Atalhos/Som & Rádio/Permissões); build-mode toggle closes the panel and shows `<builder-status>`; card selection updates the status label; spawn/respawn buttons round-trip to the server; placed-object delete removes from list + scene; Sound tab sliders/play/next/prev work and the visualizer starts/stops with panel-open + active-tab state; Shortcuts renders all 4 groups; Permissions loads real hub data, bypass toggle and per-hub toggle both round-trip (`POST /api/settings/gm-bypass`, `POST /api/hubs/<owner>/settings`, confirmed via network tab); Fechar and the ui-modal × both close correctly across the nested shadow-DOM boundary. `pnpm typecheck && pnpm lint && pnpm knip` all clean throughout.

## Phase 2 — Guestbook + post panels ✅

- [x] `<guestbook-panel>`: methods `setComments(posts)`, `setOwnerView(allow)`, `setVisitorView(allow)`, `bumpReaction(postId, emoji)`; events `guestbook-submit {message}`, `guestbook-react {postId, emoji}`, `guestbook-allow-toggle {allowed}`, `panel-close`. Locked-state message included.
- [x] `<post-panel>`: `show(post: HubPost)` — the `renderPostPanel` (main.ts:1590) template moves inside, escaped.
- [x] `<add-post-panel>`: `open()`; events `post-submit {title, body}`, `panel-close`; Ctrl+Enter handled internally with `stopPropagation()`.
- [x] New `client/src/ui/controllers/hub-panels-controller.ts` absorbs main.ts:1590–1827 plus add-post wiring; E-key open/close in `updateInteraction` routes through it; flags via `ui-state.ts`.
- [x] Delete: guestbook CSS section, post-panel/add-post selectors; index.html guestbook + post + add-post blocks.

☑ Verified: comments render, HTML escaped literally, reactions increment, form submits and refreshes. Modal closes correctly, movement lock functions as intended.

## Phase 3 — NPC panel + shop ✅

- [x] `<npc-panel>`: `open(npc, collectedStickers)`, `setDialogue(text)`, `showReward(...)`, `refreshStickerAlbum(...)`; shop grid + sticker album rendered from data arrays (`client/src/ui/npc-catalog.ts`). Events: `npc-action`, `npc-claim-sticker`, `npc-shop-buy {item}`, `panel-close`.
- [x] New `client/src/ui/controllers/npc-panel-controller.ts` absorbs the old `openNpcPanel`/`closeNpcPanel`/dialogue-fetch/sticker-claim/shop-buy handlers + the `onShopPurchaseResult` binding.
- [x] Delete: NPC CSS section (~265 lines); index.html NPC block (collapsed to `<npc-panel id="npc-panel" hidden></npc-panel>`).
- [x] Bonus (closes a PLAN-3.0.md 3.2 gap found while building this phase): the shop grid now also lists **Super Vassoura**, **Lanterna Ecológica**, and **Detector de Sabotagem** — the server (`combat.ts`) already fully implemented these three purchases and the `superVassoura`/`lanternaEcologica`/`hasDetector` schema flags, but no client UI ever offered them for sale. `network.ts`'s `sendShopPurchase`/`ShopItemId` widened to cover all six items.

☑ Verified live (browser + 6-bot headless): join → E on each NPC type shows correct title/greeting/action-label; Pedir Dica dispatches `npc-action` and fetches real dialogue; sticker claim/shop-buy/panel-close events all fire with correct payloads through the composed shadow-DOM boundary (including `ui-modal`'s built-in ✕); Jurema's panel shows all 6 shop items. Server round-trip verified with bots: purchasing all 3 new items near the (DB-persisted) placed vendor succeeds once coins are farmed via the mutirão minigame, sets the correct schema flags, and correctly rejects a re-purchase as `already_owned`. `pnpm typecheck && pnpm lint && pnpm knip && pnpm build` all clean.

## Phase 4 — Battle HUD ⬜

- `<battle-hud>` replaces `client/src/hud.ts` with the **identical public method surface** (`show`, `updateSelf`, `setWeapon`, `flashDamage`, `flashHitmarker`, `showXpFloat`, `showBossBar`/`updateBossBar`/`hideBossBar`, `shakeBite`, `showDeath`/`hideDeath`) so `combat.ts` and the `main.ts` bindings only change how they obtain the instance. Delete `hud.ts`.
- Owns health/shield/XP/coins bars, hotbar, boss bar, floats, death overlay, damage vignette, crosshair. `pointer-events: none` throughout.
- **Redeclare all HUD keyframes inside the shadow sheet** (float-rise, vignette, boss flash) — global keyframes don't reach shadow roots. `bite-shake` (animates `document.body`) stays global.
- Delete: battle HUD + boss bar + death + vignette + crosshair CSS; index.html HUD block.

☑ Verify: join → HUD appears on first self-state; take damage → vignette + shake; kill a mosquito → hitmarker + XP float; level-up float; buy repelente → segmented shield bar renders and depletes before health; weapon switch (1/2/scroll) highlights slots; Suco count updates; GM-spawned boss → boss bar with phases; die → death overlay countdown → respawn clears it. `pnpm build` passes.

## Phase 5 — Join overlay ✅

- [x] `<join-overlay>`: form, quick-play, status line, resume block; `setStatus(text)`, `setConnectedState()`, `show()/hide()`; events `join-submit {name}`, `resume-click` (background clicks only — the controller calls `requestLock()`).
- [x] New `client/src/ui/controllers/join-controller.ts` absorbs main.ts:616–733; localStorage name persistence stays in the controller; pointer-lock cooldown handling unchanged.
- [x] Delete: overlay/join CSS; index.html overlay block.

☑ Verified: join overlay correctly displays on load, pre-fills name, locks/unlocks mouse controls, enters properly, and handles Esc/resume and cooldown messaging.

## Phase 6 — Chat ⬜

- `<chat-box>`: log (max 8 lines, rendered via `textContent`), compact mode + unread pill, **and the input** (internal, hidden by default). Methods `appendLine(name, text, isSystem)`, `setCompact(bool)`, `openInput()/closeInput()`; events `chat-send {text}`, `chat-input-closed`. Internal `keydown` does `stopPropagation()` (preserves the main.ts:873 guarantee); Enter/Esc handled inside; controller syncs `chatInputOpen` in `ui-state`. The stale held-keys reset stays in main.ts's open path.
- Delete: chat CSS (incl. compact block); index.html chat block.

☑ Verify: Enter opens input; typing WASD doesn't move the player; Enter sends (second client sees it + bubble); Esc cancels; C compacts → unread badge counts, C expands → clears; system join/leave lines styled.

## Phase 7 — Small bits + final cleanup ⬜

- `<interact-hint>`, `<debug-panel>` (adapt `logger.ts` `initDebugPanel` to the component), plus anything deferred.
- **Now enable** `html { font-size: clamp(14px, 1.2vw, 18px) }` — nothing legacy depends on 16px anymore.
- `style.css` shrinks to ~60 lines (reset, `html/body`, `#app`, `#scene`, `body.locked` cursor rules, `bite-shake` keyframes); optionally rename to `global.css`.
- Sweep: no `querySelector` in main.ts except `#scene` and typed component handles; `pnpm knip` clean; DESIGN.md §11 status table all ✅.
- Full 2-window regression of every checklist above; `pnpm build && pnpm preview` smoke test.

**Expected end-state:** `main.ts` ~1,100–1,300 lines (scene/movement/network/interaction only), `index.html` ~60 lines, `style.css` ~60 lines, `client/src/ui/` ~20 files.
