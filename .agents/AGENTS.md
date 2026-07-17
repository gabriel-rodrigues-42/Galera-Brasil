# Galera Brasil - Codebase Rules & Style Guidelines

This file outlines the rules, architectural decisions, and coding style for developers and agents working on the Galera Brasil codebase.

## 1. Project Overview & Architecture
Galera Brasil is a lightweight, browser-based, spatial social media MMO. It is structured into two main workspaces:
- `client/`: A Vite + TypeScript + Three.js client application.
- `server/`: A Node.js + Colyseus + Express + SQLite backend.

## 2. Coding Principles & Guidelines

### TypeScript & Types
- Use strict TypeScript typing where possible. Avoid `any` unless absolutely necessary (e.g., interfacing with dynamic untyped third-party data).
- Keep types centralized, e.g. in `client/src/hub-types.ts` or close to the domain.

### Memory & Three.js Performance
- **Critical Memory Safety:** When removing meshes, groups, or lights from the scene, always traverse them and call `.dispose()` on all geometries and materials. If materials have textures, call `.dispose()` on their `.map` as well. Refer to `disposeObject3D` in `client/src/hub-manager.ts` and `remove` in `client/src/avatars.ts` for reference implementations.
- Keep polygon counts low (e.g. low-poly trees, canopies, capsules). Minimize draw calls by reusing materials and geometries when creating multiple instances of procedural objects.

### Networking & State Management
- Real-time multiplayer synchronization is handled by Colyseus.
- Positional sync operates at roughly 15Hz (`SEND_INTERVAL = 1/15` in `main.ts`).
- Server states are defined using Colyseus Schema annotations (`@type`). Keep state structures clear and optimize broadcast messages.

### Aesthetics & Styling
- Follow a **Solar-Minimalist / Solarpunk** daytime visual design inspired by Brazilian culture (lush greens, warm wood, solar canopies, high-tech open-air markets, clean textures).
- Keep colors harmonious. Use HSL or hex values matching this palette:
  - Grass green: `0x4a8a4f`
  - Plaza sand/terracotta: `0xe8d9b5`
  - Solar panels: `0x274a63`
  - Facade base tones: `[0xe07a5f, 0x81b29a, 0xf2cc8f, 0x3d405b]`
- Avoid Tailwind CSS or arbitrary external styling libraries. Style using pure CSS in `client/src/style.css`.
