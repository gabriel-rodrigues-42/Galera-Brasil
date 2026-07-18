# Galera Brasil — Development Plan (v3.x): "Mutirão e Sabotagem"

**Builder:** Solo, beginner game developer  
**Theme:** Evolve the social/battle praça with a cooperative community cleanup game mode (Mutirão) that can trigger a social deduction (Sabotador/Mafia) mode.  
**Inspiration:** Cozy solarpunk ecology combined with lighthearted, non-violent social deduction ("Who spilled the broth?").

---

## 1. Guiding Principles

1. **Solarpunk Community Cleanup:** All tasks align with ecological restoration (sweeping organic waste, repairing solar canopies, purifying lake water, weeding planters).
2. **Cooperation First:** The game must be highly satisfying and playable as a pure cooperative speedrun. The social deduction mechanics layer on top of a solid, fun cooperative base.
3. **No Violent Ejections:** Ejected players are "reassigned" (remanejados) and become helpful **ghosts** (semi-transparent, can fly/spectate, but cannot interact or chat/vote normally) rather than dying or being kicked.
4. **Combat Strategy:** Mosquitos and other monsters become defensive hazards. Clearing them is vital because they target workers, but killing them requires coordinated planning since they do **not** respawn during active game sessions.

---

## 2. Release Roadmap

### Release 3.0 — The Mutirão (Cooperative Cleanup)

The cooperative foundation: cleanup tasks, quest guide, session timer, and modified monster respawn rules.

- **Game State Machine:** Introduce room-wide state machine in the Colyseus schema (`gameState: 'idle' | 'lobby' | 'playing' | 'victory' | 'defeat'`).
- **Lobby & Match Start:** A match can be initiated when a minimum of 6 players are present. A central lobby countdown starts before transitioning to `playing`.
- **Dynamic Debris Spawns:** Server spawns random "debris" objects across the praça (garbage piles, broken solar panels, polluted water lilies, overgrown weeds).
- **Repair/Cleanup Interactions:**
  - Walking up to debris and holding `E` triggers the cleanup.
  - Server validates repair ticks and increases debris health. Debris is cleared when progress hits 100%.
- **No Monster Respawns:**
  - Monsters (mosquitos, baratas, pombos) that exist at start or are spawned by GM will **not** respawn once killed if `gameState === 'playing'`.
  - Disables the `pendingRespawns` queue in `CombatSystem` during active match.
- **HUD Timer & Quest Guide:**
  - Timer bar/countdown at the top center of the HUD.
  - **Quest Guide Widget:** Positioned on the screen showing:
    1. A clear textual description of the active objective (e.g., "Conserte as placas solares da ala Leste").
    2. A progress bar showing the percentage of overall cleanup completed (`totalClearedDebris / totalSpawnedDebris`).
- **End States:** If the timer reaches 0 before all debris is fixed, transition to `defeat`. If all debris is fixed, transition to `victory`.

### Release 3.1 — O Sabotador (Social Deduction / Mafia Mode)

Adding secret roles, sabotage events, and the neighborhood assembly ("Assembleia de Bairro").

- **Secret Role Assignment:**
  - When the game starts with 6+ players, the server secretly assigns roles: **Trabalhadores** (Workers) and **Sabotadores** (Saboteurs/Mafia).
  - Default layout for 6 players: 5 Workers, 1 Saboteur. Scaled for larger numbers (e.g., 2 Saboteurs for 8+ players).
- **Saboteur Sabotages:**
  - Saboteurs get a dedicated action hotbar or keys to trigger dynamic crises:
    - **Apagão Solar (Solar Blackout):** Temporarily dims lighting and limits worker visibility.
    - **Infestação (Infestation):** Spawns a temporary aggressive mosquito swarm.
    - **Quebra (Breakage):** Breaks an already repaired debris node, stalling overall progress.
- **Assembleia de Bairro (Meetings):**
  - A meeting can be called by interacting with the central assembly megaphone/bell in the plaza, or by reporting a "severely sabotaged" node.
  - Teleports all players to the center ring, locks movement, and pauses the match timer.
  - Opens the **Voting Assembly Overlay** showing cards for all players.
- **Discussion & Voting:**
  - 60s discussion timer (using standard chat, dead/ghost players are muted).
  - 30s voting timer. Players click on cards to cast votes.
  - Most voted player is ejected.
- **Ghost State:**
  - Ejected players transition into a **Ghost**.
  - Client makes their avatar semi-transparent.
  - Ghosts can fly (disable collision constraints) to spectate, but cannot interact with debris, vote, or participate in assembly chats.
- **Win Conditions:**
  - **Workers win:** Clear all debris before time runs out.
  - **Saboteurs win:** Timer runs out, or number of active Workers equals or falls below the number of active Saboteurs.

### Release 3.2 — Task Puzzles & Upgrades

Goal: add minigames for repairs and upgrades to spend earned coins.

- **Repair Minigames:** Walking up to specific debris opens a specialized interactive overlay instead of just holding `E`:
  - **Solar Panel:** Wire-matching circuit board puzzle.
  - **Garbage Pile:** Sort recyclable materials (Metal, Plastic, Organic) into bins.
  - **Lily Purifier:** Adjust water pH sliders.
- **Dona Jurema's Mutirão Upgrades:**
  - **Super Vassoura (Super Broom):** Speeds up cleanup/repair ticks by 25%.
  - **Lanterna Ecológica (Solar Flashlight):** Pierces the Solar Blackout sabotage.
  - **Detector de Sabotagem (Radar):** Temporary item indicating the sector where a sabotage was recently triggered.

---

## 3. Architecture Notes (Where things live)

| Component / File                                                                                                             | Responsibility                                                                                                                                                 |
| :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server Room State**<br>[PlazaRoom.ts](file:///d:/Jogos/Galera%20Brasil/server/src/rooms/PlazaRoom.ts)                      | Hold `gameState`, `gameTimer`, `debris` map, and player roles. Handle client game messages (`start_game`, `repair_progress`, `cast_vote`, `trigger_sabotage`). |
| **Server State Machine & Tick**<br>[combat.ts](file:///d:/Jogos/Galera%20Brasil/server/src/rooms/combat.ts)                  | Tick down game timer, handle task completion conditions, assign secret roles, bypass `pendingRespawns` if match is active.                                     |
| **Client Main Hookup**<br>[main.ts](file:///d:/Jogos/Galera%20Brasil/client/src/main.ts)                                     | Render debris meshes, handle raycast selections for repairs, block input keys/movement during voting or ghost modes.                                           |
| **Client Controller**<br>[game-controller.ts](file:///d:/Jogos/Galera%20Brasil/client/src/ui/controllers/game-controller.ts) | Synchronize room state changes with client elements, manage transitions into voting screens, trigger transparent avatar visuals.                               |
| **Client HUD Overlay**<br>`client/src/ui/components/`                                                                        | Custom Web Components for timer, voting panel, and quest progress/text description.                                                                            |
