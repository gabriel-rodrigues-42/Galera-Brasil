# 🇧🇷 Galera Brasil

Galera Brasil is a lightweight, browser-based, spatial social media MMO hybrid with light MMORPG combat elements, inspired by Brazilian culture.

Players can walk around a 3D plaza (**praça**), customize their own personal profile hubs (**Content Gardens**), leave digital graffiti notes on others' hubs, chat in real-time, and battle pests around the local lake using national-heritage weapons like **vassouras** (brooms) and **chinelos** (flip-flops).

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: Version **22.5.0 or higher** is required (uses the native `node:sqlite` module).
- **pnpm**: Monorepo workspace package manager.

### Installation

1. Install dependencies from the root directory:
   ```bash
   pnpm install
   ```

### Running the Application

To run both the Vite client dev server and the Colyseus game server concurrently:

```bash
pnpm dev
```

- **Client**: `http://localhost:5173`
- **Server**: `http://localhost:2567` (Colyseus WebSocket port)

---

## 🏛️ Project Architecture

The codebase is structured as a **pnpm workspace** with two main projects:

```
├── client/                   # Vite + TypeScript + Three.js client
│   ├── public/               # Static assets & textures
│   └── src/                  # Client source code
│       ├── main.ts           # Game loop, Three.js setup, interaction logic
│       ├── combat.ts         # Client combat predicting, swing/projectile views
│       ├── enemy-manager.ts  # Enemy rendering, HP bars, animations
│       ├── network.ts        # Colyseus network state & client handlers
│       ├── hud.ts            # DOM-based UI overlay & menus
│       └── style.css         # Custom Solarpunk theme stylesheet
│
├── server/                   # Node.js + Colyseus + Express backend
│   └── src/                  # Server source code
│       ├── index.ts          # Server entry point & CORS configuration
│       ├── db.ts             # SQLite persistence using Node.js's DatabaseSync
│       └── rooms/            # Colyseus network rooms
│           ├── PlazaRoom.ts  # Core room schema & network messages
│           ├── combat.ts     # Enemy spawner, state sync, hit validations
│           └── boss.ts       # Muriçoca Rainha boss fight script
│
├── game.md                   # Game Design Document (GDD)
├── PLAN.md                   # Phase 0–6 roadmap & project v1 plan
├── PLAN-2.0.md               # Combat expansion v2 plan
└── package.json              # Monorepo task runner & scripts
```

---

## 🎮 Core Features

### 1. Spatial Social Feed

- **Exploration**: Walk down virtual streets organized by interest tags (e.g. `#WebDev`, `#Skateboarding`). Highly active hubs dynamically bubble up closer to the plaza.
- **Content Gardens**: Customize a personal hub where posts (images, text, links) are physicalized as gallery pictures, interactive plaques, or jukeboxes.
- **Social Interaction**: Proximity-based text chat bubbles and persistent comments represented as floating notes or digital graffiti.

### 2. "Batalha na Praça" (Combat Mode)

- **Safe Zone**: The main plaza is a safe zone. Combat is concentrated around the lake.
- **Arsenal**:
  - 🧹 **Vassoura (Broom)**: Melee sweep weapon (3m range, 45° cone, server-validated).
  - 🩴 **Chinelo (Flip-flop)**: Thrown projectile weapon (client-predicted trajectory, server-simulated arc and collision).
- **Enemies**:
  - 🦟 **Mosquito**: Erratic flyers that chase and bite.
  - 🪳 **Barata (Cockroach)**: Fast-scuttling land pests with more health.
  - 🐦 **Pombo (Pigeon)**: Airborne dive-bombers.
- **Boss Fight**: The **Muriçoca Rainha** (Queen Mosquito) spawns periodically at the lake with multi-phase scripts, AoE attacks, minion summoning, and high shared XP/coin rewards.

### 3. Economy & Progression

- **Upgrades**: Earn coins from defeating enemies and buy items at the _feira_ vendor (e.g., _Chinelo Reforçado_ for +damage, _Repelente_ for temporary immunity, or _Suco de Laranja_ to heal).
- **Stats Persistence**: Player levels, XP, coins, and equipment are persisted in the local SQLite database.

---

## 🎨 Visual Style & Guidelines

We follow a **Solar-Minimalist / Solarpunk** daytime visual design inspired by Brazilian culture:

- Lush greenery, plaza sand/terracotta tilework, solar canopies, high-tech open-air markets (_feiras_).
- Colors are curated to match this palette (e.g., Grass Green `0x4a8a4f`, Terracotta Plaza `0xe8d9b5`, Solar Panel Blue `0x274a63`).
- **Memory Safety (Three.js)**: Always traverse and call `.dispose()` on geometries, materials, and maps/textures when removing meshes or lights to prevent browser memory leaks.

---

## 🛠️ Monorepo Scripts

- `pnpm dev`: Runs both backend and frontend concurrently in development mode.
- `pnpm build`: Compiles the server TypeScript and builds Vite client static assets.
- `pnpm typecheck`: Typechecks client and server TypeScript without emitting files.
- `pnpm lint`: Lints both workspaces with ESLint.
- `pnpm format`: Formats all code, CSS, JSON, and Markdown files using Prettier.
