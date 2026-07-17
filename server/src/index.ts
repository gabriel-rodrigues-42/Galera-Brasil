import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { PlazaRoom } from './rooms/PlazaRoom';
import { listHubs, getHub, getOrCreateHub, addPost, getRandomNpcDialogue, getPlayerStickers, claimNpcSticker } from './db';

const app = express();
app.use(cors());
app.use(express.json());

// --- Hub directory API (Phase 2: accounts + many hubs, no login — a hub is
// just a name-keyed record, trusted within a small group of friends) --------

app.get('/api/hubs', (_req, res) => {
  res.json(listHubs());
});

app.get('/api/hubs/:owner', (req, res) => {
  const hub = getHub(req.params.owner);
  if (!hub) return res.status(404).json({ error: 'not found' });
  res.json(hub);
});

app.post('/api/hubs/:owner/claim', (req, res) => {
  res.json(getOrCreateHub(req.params.owner));
});

app.post('/api/hubs/:owner/posts', (req, res) => {
  const post = addPost(req.params.owner, req.body);
  if (!post) return res.status(400).json({ error: 'invalid post or unknown owner' });
  res.json(post);
});

// --- NPC & Stickers API --------------------------------------------------------

app.get('/api/npcs/dialogue/:npcType', (req, res) => {
  const dialogue = getRandomNpcDialogue(req.params.npcType);
  if (!dialogue) return res.status(404).json({ error: 'npc type not found or no content' });
  res.json(dialogue);
});

app.get('/api/players/:playerName/stickers', (req, res) => {
  res.json(getPlayerStickers(req.params.playerName));
});

app.post('/api/players/:playerName/stickers/claim/:npcType', (req, res) => {
  const result = claimNpcSticker(req.params.playerName, req.params.npcType as any);
  res.json(result);
});

// Serve the built client (Phase 2+: this becomes a CDN/static host instead,
// but for the MVP one process serving both keeps deployment/sharing simple).
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('plaza', PlazaRoom);

const port = Number(process.env.PORT) || 2567;
httpServer.listen(port, () => {
  console.log(`Galera Brasil server listening on http://localhost:${port}`);
  console.log(`Serving client from ${clientDist}`);
});
