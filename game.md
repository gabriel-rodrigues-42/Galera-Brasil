# **Game Design Document & Technical Specification: Galera Brasil**

**Project Name:** Galera Brasil  
**Concept:** A decentralized MMORPG / Social Media Hybrid powered by a Peer-to-Peer (P2P) network with a real-world integrated economy.  
**Line Spacing:** 1.15

## **1\. Executive Summary & Core Game Idea**

Galera Brasil bridges the gap between spatial exploration and digital social interaction. Instead of browsing a traditional vertical, algorithmic text feed, players physically navigate a dynamic, 3D world where content, user profiles, and storefronts are physicalized structures. The game utilizes a fully decentralized, serverless architecture where the community's own hardware hosts the data, world geometry, and economy, eliminating ongoing hosting costs for the creator.

### **Core Gameplay Loops**

- **The Content Garden (The Profile):** Every user owns a customizable personal hub (a home, shop, or plot of land). Traditional social media posts (videos, text, art, or portfolios) manifest as physical, interactive elements within their hub (e.g., photos displayed as a gallery wall, music as a public jukebox).
- **Walking the Feed (Exploration):** Content discovery happens through spatial exploration. Users walk down virtual streets organized by interest tags (such as \#WebDev, \#AppSec, or \#Skateboarding) to discover relevant hubs. Highly active hubs dynamically shift closer to high-traffic avenues via automated community peer sorting.
- **Social Raids:** Groups of players can form a "party" or "crew" to explore trending hubs together, interact with creator content, and leave persistent comments represented as floating notes or digital graffiti.

## **2\. Visual Aesthetic & Philosophy**

Departing from standard corporate metaverse aesthetics or dystopian sci-fi themes, Galera Brasil embraces a vibrant, solar-minimalist and solarpunk design philosophy tailored to Brazilian culture. The world is visualized as an open-air digital plaza (praça) blending advanced, clean technology with organic nature, lush greenery, and sustainable architectural elements. Virtual marketplaces operate as modern, high-tech open-air markets (feiras) under solar canopies.

## **3\. The Real-World Economy (The Marketplace)**

The economy directly supports real-life commerce, allowing freelancers, physical businesses, and creators to monetize skills and goods without a central middleman taking hefty platform cuts.

| Economic Component          | In-Game Mechanism                                                                            | Real-World Bridge                                                                                       |
| :-------------------------- | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| **Gig Economy Storefronts** | Professionals set up localized shops to showcase portfolios or list active service items.    | Players can hire developers, artists, or contractors for actual physical or remote work.                |
| **Physical E-Commerce**     | Integrated storefront layouts for physical items (e.g., merch, specialized gear).            | Purchasing a digital asset triggers the packaging and physical shipment of the real item.               |
| **Decentralized Escrow**    | Funds are held in a secure, multi-party cryptographic lock state within the local peer mesh. | Funds release automatically to the seller only once physical delivery or service tracking is validated. |

_Economic Security:_ To achieve security without a centralized database server, the network relies on a P2P mutual credit system using signed cryptographic receipts (similar to Git commit verifications). Forged assets or currencies fail validation rules enforced by surrounding neighbor peers, causing immediate client isolation and banning of the cheating node.

## **4\. Technical Stack (Pure P2P / Serverless Architecture)**

The technical architecture distributes all compute, storage, and synchronization over user machines to maintain $0 infrastructure costs for the core project developer.

- **Game Engine:** Godot Engine (Open-source, highly lightweight, exceptional for custom networking overhead) or web-based WebGPU/Three.js implementations for direct browser accessibility.
- **Networking Protocol:** libp2p and WebRTC for high-performance, real-time peer-to-peer data channels, player positional syncing, and proximity voice streaming.
- **Distributed Storage:** IPFS (InterPlanetary File System) or custom Distributed Hash Tables (DHT). Social feeds, 3D hub assets, and user data profiles are stored locally and seeded to the network; trending content is automatically cached by visiting peers to ensure high availability.
- **Network State & Bootstrap:** Decentralized, open-source tracker lists and lightweight bootstrap nodes (hosted via zero-cost public repositories or community-run micro-nodes) to distribute active peer directories to booting clients.
- **Cheating Mitigations:** Peer Validation algorithms. Surrounding local clients in a shared zone act as the "authoritative server." Positional discrepancies (e.g., speed-hacking) are flagged when a client's reported state deviates from the consensus of neighboring peers.

## **5\. MVP Development Roadmap**

### **Phase 1: Foundations & P2P Data Mesh (Months 1-3)**

- Implement fundamental local asset loading inside the selected engine framework.
- Integrate libp2p / IPFS data layer to allow a user to host a basic profile locally and let a second user retrieve it via cryptographic hash.
- Establish basic textual/image post formatting that populates a localized 3D room placeholder.

### **Phase 2: Spatial Navigation & Networking (Months 4-6)**

- Build real-time player synchronization using WebRTC data channels.
- Develop the basic "District" instance prototype, where one user computer hosts the physical terrain data for a specific interest tag (\#WebDev) and handles incoming guest player connections.
- Implement proximity player movement and basic text chat within a shared spatial boundary.

### **Phase 3: The Cryptographic Marketplace & Security (Months 7-9)**

- Develop the signed cryptographic receipt system for secure peer-to-peer transaction logs.
- Create the interface for setting up a virtual booth/shop layout to display real-world portfolio samples or physical item listings.
- Incorporate Peer Validation mechanics to cross-verify movement and asset transfer logs across neighboring clients.

### **Phase 4: Optimization, Aesthetic Polish, and Open Source Launch (Months 10-12)**

- Apply the comprehensive solar-minimalist visual kit, styling default hubs with organic textures, foliage systems, and optimized lighting setups.
- Perform stressful scalability testing over distributed local home setups (including low-power home servers and Mini PCs).
- Publish the project repositories under an open-source license, providing the community with headless node templates to run perpetual interest districts.
