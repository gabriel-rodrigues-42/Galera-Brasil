import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { PlazaRoom } from './rooms/PlazaRoom';

const app = express();
app.use(cors());

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
