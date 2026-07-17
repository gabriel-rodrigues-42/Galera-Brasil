import { Room, Client } from 'colyseus';
import { Schema, MapSchema, type } from '@colyseus/schema';
import { getHub, getOrCreateHub } from '../db';

export class PlayerState extends Schema {
  @type('string') name = 'Visitante';
  @type('number') x = 0;
  @type('number') y = 1.7;
  @type('number') z = 8;
  @type('number') rotY = 0;
  @type('string') mode: 'plaza' | 'hub' = 'plaza';
  /** Owner name of the hub this player is currently inside; empty in plaza. */
  @type('string') hubId = '';
}

export class PlazaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}

interface JoinOptions {
  name?: string;
}

interface MoveMessage {
  x?: number;
  y?: number;
  z?: number;
  rotY?: number;
  mode?: string;
  hubId?: string;
}

interface ChatMessage {
  text?: string;
}

const MAX_NAME_LENGTH = 24;
const MAX_CHAT_LENGTH = 200;

function sanitizeName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, MAX_NAME_LENGTH) : '';
  return name || 'Visitante';
}

export class PlazaRoom extends Room<PlazaState> {
  maxClients = 60;

  onCreate() {
    this.setState(new PlazaState());

    this.onMessage('move', (client, message: MoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (Number.isFinite(message?.x)) player.x = message.x!;
      if (Number.isFinite(message?.y)) player.y = message.y!;
      if (Number.isFinite(message?.z)) player.z = message.z!;
      if (Number.isFinite(message?.rotY)) player.rotY = message.rotY!;
      if (message?.mode === 'plaza' || message?.mode === 'hub') player.mode = message.mode;
      if (typeof message?.hubId === 'string') player.hubId = message.hubId.slice(0, MAX_NAME_LENGTH);
    });

    this.onMessage('chat', (client, message: ChatMessage) => {
      const player = this.state.players.get(client.sessionId);
      const text = typeof message?.text === 'string' ? message.text.trim().slice(0, MAX_CHAT_LENGTH) : '';
      if (!text) return;
      this.broadcast('chat', { name: player?.name ?? 'Visitante', text, sessionId: client.sessionId });
    });

    console.log(`[PlazaRoom] created (${this.roomId})`);
  }

  onJoin(client: Client, options: JoinOptions) {
    const player = new PlayerState();
    player.name = sanitizeName(options?.name);
    this.state.players.set(client.sessionId, player);

    // First-time visitors get a hub of their own — broadcast it so everyone
    // already in the praça sees the new facade appear without reloading.
    const isNewHub = !getHub(player.name);
    const hub = getOrCreateHub(player.name);
    if (isNewHub) {
      this.broadcast('hub_added', { owner: hub.owner, tag: hub.tag, slot: hub.slot });
    }

    this.broadcast('system', { text: `${player.name} entrou na praça` }, { except: client });
    console.log(`[PlazaRoom] ${client.sessionId} joined as "${player.name}" (${this.state.players.size} online)`);
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    if (player) this.broadcast('system', { text: `${player.name} saiu da praça` });
    console.log(`[PlazaRoom] ${client.sessionId} left (${this.state.players.size} online)`);
  }
}
