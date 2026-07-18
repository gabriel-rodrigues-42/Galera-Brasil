# Galera Brasil — Development Plan (v2.x): "Batalha na Praça"

**Builder:** Solo, beginner game developer
**Predecessor:** `PLAN.md` (v1 — the social praça, hubs, multiplayer presence, builder mode)
**Theme:** Evolve the social praça into a light MMORPG — without losing the cozy social heart.

---

## 1. Guiding principles

1. **The plaza stays a safe zone.** Combat lives around the lake (standing water = mosquitos,
   naturally). The social core — hubs, chat, NPCs, feira — is never interrupted by a bite.
2. **Server-authoritative combat.** Enemies live in the Colyseus room state; the server runs
   the AI tick, validates every hit, and owns all HP/XP. What the v1 relay model was to
   builder blocks, the schema is to battle: everyone sees the same fight.
3. **Every release is playable and shippable.** Same rule as v1: do not start a release
   until the previous one's demo works in two browser windows.
4. **Brazilian weapons only.** The starter arsenal is a chinelo (thrown, arcs, can miss)
   and a vassoura (melee swing). This is non-negotiable national heritage.

## 2. Release roadmap

### Release 2.0 — Core battle (SHIPPED with this branch)

The foundation: health, enemies, weapons, progression.

- [x] Player HP + server-owned battle stats (`hp/maxHp/level/xp/dead` in the room schema)
- [x] HUD: health bar, XP bar ("Nível X — Y/Z XP"), weapon hotbar `[1] 🧹 / [2] 🩴`
- [x] Mosquitos spawn around the lake (max 8, ring 3–10 m from center), buzz erratically,
      aggro within 5 m (with hysteresis so they don't flicker), chase at 3.5 m/s
      (slower than a running player), bite for 5 damage every 1.5 s
- [x] Safe zone: players within 16 m of the plaza center are never targeted
- [x] Vassoura: crosshair melee swing (3 m range, 45° cone, server-validated)
- [x] Chinelo: thrown projectile — client-predicted visual, server-simulated hit,
      gentle gravity arc, generous 0.7 m hit radius
- [x] XP + levels persisted in SQLite by player name (`xpNeeded = 40×level`, cap 10,
      level-up = +20 max HP + full heal)
- [x] Death = soft respawn: fade to "Você desmaiou!", 3 s, back at the plaza spawn, no loss
- [x] PvP bonk: hitting a friend deals 0 damage but knocks them back with a 💥
- [x] Floating enemy HP bars, hit flashes, crosshair hit-marker, "+10 XP" floats
- [x] Remote players visibly swing/throw (weapon prop stays in their hand)
- [x] GM panel "Batalha" section: 🦟 Invocar Mosquito / 🧹 Limpar Mosquitos
- **Demo:** two friends fight the same mosquito swarm at the lake and see the same fight.

### Release 2.1 — Juice + coins (SHIPPED with this branch)

Goal: make every hit _feel_ good, and start the economy loop.

- [x] Mosquito buzz audio, distance-attenuated (WebAudio) — hear them before you see them
- [x] SFX: vassoura swoosh, chinelo whoosh + slap, bite, bonk, level-up ding
- [x] Particle splats on hit; floating damage numbers; small screen shake on being bitten
- [x] Coin drops from kills (server-spawned pickups, walk over to collect;
      `coins` column added to `player_stats`)
- **Demo:** a fight you can hear with your eyes closed, and a coin counter going up.

### Release 2.2 — Shop + new enemy types

Goal: something to spend coins on, and variety to earn them from.

- [x] Vendor NPC at the feira (reuses the NpcManager pattern + dialogue panel UI)
- [x] Server-validated purchases: Chinelo Reforçado (+damage), Repelente (temporary
      bite immunity), Suco de Laranja (heal potion)
- [x] New enemies via the existing `kind` field: **barata** (ground scuttler, faster,
      more HP) and **pombo** (dive-bombs from above, then retreats)
- **Demo:** farm mosquitos → buy an upgrade → handle the baratas it unlocks.

### Release 2.3 — Boss: a Muriçoca Rainha (SHIPPED with this branch)

Goal: the first group fight.

- [x] Big queen mosquito spawns at the lake on a timer (every 10 min, announced in chat;
      GM button "👑 Invocar Muriçoca Rainha" for on-demand fights). She flies away after
      4 min if not defeated.
- [x] **Scripted fight, not AI**: the queen never uses the wander/aggro `EnemyBrain` — she
      runs a deterministic per-phase attack script (`server/src/rooms/boss.ts`): circle the
      lake → telegraph (rise 0.7 s) → dive-bomb the snapshotted position of the nearest
      player → AoE impact (12 dmg, 2.5 m) → recover. Dives can be dodged by moving.
- [x] Phases at HP thresholds (66% / 33%): phase 2 summons 3 minions and quickens the
      script; phase 3 is a 1.6× fúria. Phase rides a new `phase` field on `EnemyState`.
- [x] Shared XP: per-player damage tally on the server; every contributor still online
      gets a flat +120 XP on defeat, plus a 12-coin burst at the corpse.
- [x] Client: crowned 3× crimson mosquito model, big top-of-screen boss HP bar,
      `boss_event` juice (roar on spawn/phase, shake near impacts, victory fanfare).
- **Demo:** three friends coordinating to take her down before she despawns.
  (Verified headlessly: 2 bots → spawn, both phases, minions, defeat, shared XP, coins.)

### Backlog (2.4+, revisit with real usage)

- Touch controls: virtual joystick + attack buttons (design already keeps input in one
  gated module — `client/src/combat.ts` — for this reason)
- Cone-hits-all melee upgrade, more hotbar weapons
- Enemy knockback on hit, dodge roll
- Day/night cycle (mosquitos get bolder at night)

## 3. Architecture notes (where things live)

| Concern                                            | File                                                      |
| :------------------------------------------------- | :-------------------------------------------------------- |
| Enemy AI, hit validation, XP, death/respawn        | `server/src/rooms/combat.ts` (`CombatSystem`, 10 Hz tick) |
| Boss fight script (phases, dives, shared XP)       | `server/src/rooms/boss.ts` (`BossController`)             |
| Room schema (players + enemies)                    | `server/src/rooms/PlazaRoom.ts`                           |
| Stats persistence                                  | `server/src/db.ts` (`player_stats` table)                 |
| Client combat input/viewmodel/projectiles/feedback | `client/src/combat.ts`                                    |
| Enemy rendering (buzz, HP bars, death anim)        | `client/src/enemy-manager.ts`                             |
| Coin pickup rendering                              | `client/src/pickup-manager.ts`                            |
| Battle HUD DOM                                     | `client/src/hud.ts` + `index.html` + `style.css`          |
| Combat message protocol                            | `client/src/network.ts` (types + callbacks)               |

Known accepted trade-offs (fine for a friends server, revisit before strangers join):
positions are client-authoritative and 15 Hz fresh, so all server hit checks use generous
tolerances; GM battle buttons have no auth, like the rest of the GM tools.
