# Galera Brasil — Development Plan (v1)

**Builder:** Solo, beginner game developer
**Platform:** Browser (zero-install, shareable by link)
**Architecture:** Hybrid — one small server for identity/signaling/pinning; P2P where it pays off
**Economy:** Deferred — MVP is a showcase/discovery layer, no money flows through the platform
**Companion doc:** `game.md` holds the vision/GDD; this file holds the _how and in what order_.

---

## 1. Guiding principles (why this plan looks different from the GDD)

1. **The fun core doesn't need the hard tech.** "Walking the feed" — exploring a 3D praça
   where people's content is physical — is the product. It works with a plain WebSocket
   server. P2P, escrow, and peer-validated anti-cheat are all _optimizations or values_,
   not prerequisites, so they come last (or never, if the game finds fun without them).
2. **Every phase ends with something you can put in someone's hands.** As a solo beginner,
   the biggest risk is a year of infrastructure with nothing playable. Each phase below has
   a demo you can send as a link to a friend.
3. **Real money is out of scope until there's a community.** Storefronts in the MVP are
   portfolios with contact/hire links (WhatsApp, e-mail, PIX arranged between the parties —
   the OLX model). This eliminates the Banco Central / escrow / fraud problem entirely
   until the game has earned the right to solve it.
4. **Hybrid, not pure P2P.** One cheap VPS (~R$30–50/month, or free tiers to start) does
   what P2P genuinely can't: WebRTC signaling, peer bootstrap, identity, and keeping
   content online when its owner is offline (pinning). Real-time gameplay data and heavy
   asset distribution can move to P2P in a later phase to keep costs flat.

## 2. Tech stack (chosen for a solo beginner shipping to browser)

| Layer              | Choice                                                                                              | Why                                                                                                 |
| :----------------- | :-------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| Language           | **TypeScript**                                                                                      | One language for client and server; the types catch beginner mistakes early                         |
| 3D engine          | **Three.js**                                                                                        | Runs everywhere a browser runs, enormous tutorial ecosystem, no install/export step                 |
| Build tool         | **Vite**                                                                                            | Instant dev server, zero config                                                                     |
| Multiplayer server | **Node.js + Colyseus**                                                                              | Colyseus handles rooms, state sync, and interpolation — the hardest multiplayer plumbing — for free |
| Data               | **SQLite** (server-side) to start                                                                   | One file, no database server to administer; migrate later only if needed                            |
| Hosting            | Free tiers first (e.g. static hosting for the client + one small VPS/render service for the server) | Keeps the R$0 spirit while being honest about what needs a server                                   |
| P2P (later)        | **WebRTC data channels** (signaled by our server); evaluate libp2p/IPFS only in Phase 6             | WebRTC is the standard browser P2P primitive; IPFS in-browser is heavy and can wait                 |

**Deliberately not in the stack (for now):** Godot (install/export friction for a social
product), libp2p/IPFS (Phase 6 experiment, not foundation), blockchain/crypto anything.

## 3. Roadmap

Phases are ordered by dependency, not calendar. Time estimates assume a hobby pace of
roughly 8–10 focused hours/week; adjust proportionally. **Do not start a phase until the
previous phase's demo works.**

### Phase 0 — Foundations (2–6 weeks, depends on your starting point)

Goal: comfortable enough with the tools to not fight them constantly.

- [ ] JavaScript/TypeScript fundamentals (skip if you already program)
- [ ] Three.js journey: render a scene, move a camera, load a texture, load a glTF model
- [ ] Ship a toy: a first-person walk around a static plaza scene, deployed as a public link
- **Demo:** a link where anyone can walk around an empty praça in their browser.

### Phase 1 — The Content Garden, single-player (4–8 weeks)

Goal: one hub that physicalizes a profile. This is the heart of the whole idea —
prove it's charming before building anything multiplayer.

- [ ] Define a simple JSON "hub description" format: owner name, bio, list of posts
      (image / text / link), layout slots
- [ ] Render a hub from that JSON: images as framed pictures on walls, text posts as
      placas/plaquinhas, links as interactive objects
- [ ] Basic interaction: walk up to a post, press E, see it full-screen with caption
- [ ] A minimal in-game hub editor OR hand-edited JSON (editor can wait)
- **Demo:** _your own_ profile as a walkable 3D hub, live at a link.
- **Checkpoint:** show it to 5 people. If nobody says "I want one," iterate here —
  do not proceed to multiplayer on an unproven core.

### Phase 2 — Accounts and many hubs (3–5 weeks)

Goal: other people can have hubs too.

- [ ] Node/Express server with SQLite: sign-up, login (email + password, standard library —
      never hand-roll crypto), hub JSON storage, image upload
- [ ] "Street" scene: a row of hub facades generated from the database; enter one to load it
- [ ] Interest tags on hubs; one street per tag (#WebDev street, #Skate street)
- **Demo:** a friend creates an account, builds a hub, and you visit it.

### Phase 3 — Multiplayer presence (4–8 weeks)

Goal: see other people. This is where it becomes a _social_ space.

- [ ] Colyseus room per street/hub; avatar position sync with interpolation
- [ ] Simple avatars (capsule + name tag is fine; cosmetics are polish)
- [ ] Proximity text chat bubble + a persistent-comment object ("digital graffiti" note
      you can leave in a hub — the GDD's floating notes)
- [ ] Server is authoritative for anything that persists (comments, hub edits) —
      this is the anti-cheat model for now, and it's enough
- **Demo:** you and two friends walking the same street, chatting, leaving notes.

### Phase 4 — Discovery & the living city (4–6 weeks)

Goal: the "walking the feed" loop actually loops.

- [ ] Hub activity metrics (visits, comments) → active hubs placed nearer the street
      entrance (the GDD's community peer sorting, server-computed)
- [ ] Central praça as the spawn/social hub linking to tag streets
- [ ] Crews/parties: a simple group system + "visit together" (the GDD's Social Raids)
- [ ] First moderation tools: report button, hide/remove content, block user.
      **Non-negotiable before inviting strangers** — Brazilian platform liability
      (Marco Civil as interpreted post-2025) makes unmoderatable content a personal risk.
- **Demo:** a stranger can join, explore by interest, find a person, leave a comment.

### Phase 5 — Showcase storefronts (3–4 weeks)

Goal: the economy's _discovery_ half, with zero money handling.

- [ ] Storefront hub template: portfolio display, service list with prices as _information_
- [ ] "Hire / Contact" actions: deep-link to WhatsApp/e-mail chosen by the owner
- [ ] Clear ToS: transactions happen off-platform between the parties
- **Demo:** a real freelancer friend lists services and receives a real contact through the game.

### Phase 6 — Aesthetic pass + P2P where it pays (ongoing)

Goal: make it beautiful, make it cheap to run, open it up.

- [ ] Solar-minimalist art kit: consistent palette, foliage, lighting, feira canopies
      (consider commissioning or buying assets — solo beginner time is better spent on code)
- [ ] Measure server costs. _If and only if_ bandwidth hurts: move avatar position sync
      to WebRTC data channels (server keeps signaling + authority over persistent state),
      and/or peer-assisted asset distribution for hub content
- [ ] Open-source release + self-hostable server docs (the community-node vision, made real)
- **Demo:** the public launch.

### Explicitly deferred (revisit only with real traction)

- Real-money escrow / integrated payments → would use a licensed payment partner with
  split payments (Mercado Pago, Pagar.me), never custom cryptographic escrow, and needs
  legal counsel first
- Physical e-commerce fulfillment integration
- Peer-consensus anti-cheat (server authority covers the MVP)
- IPFS/libp2p storage layer, proximity voice chat, mobile apps

## 4. Risks & honest expectations

| Risk                                          | Mitigation in this plan                                                                                     |
| :-------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| Solo beginner burnout / abandonment           | Every phase ships a visible demo; Phase 1 checkpoint kills or confirms the concept early                    |
| "P2P purity" rabbit hole                      | P2P demoted to a Phase 6 cost optimization with a measurable trigger                                        |
| Illegal content liability                     | Moderation tooling is a Phase 4 gate before strangers join                                                  |
| Money/fraud/regulation                        | No money touches the platform until a deliberate, legally-advised future phase                              |
| 3D content is expensive to make               | JSON-driven hubs + bought/commissioned art kit instead of hand-modeling everything                          |
| Empty-world problem (social apps need people) | Launch praça-first to a niche community (e.g. one tag: Brazilian dev/skate/art scene) instead of "everyone" |

## 5. Immediate next steps

1. Rename `game.md.md` → `game.md` (double extension typo)
2. Set up the project: Vite + TypeScript + Three.js skeleton, git repository
3. Start Phase 0: first walkable scene
