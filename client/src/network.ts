import { Client, Room, getStateCallbacks } from 'colyseus.js';
import { log } from './logger';

export interface RemotePlayerState {
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  mode: string;
}

export interface ChatEvent {
  name: string;
  text: string;
  sessionId: string;
}

export class Network {
  private client: Client;
  private room: Room | null = null;
  sessionId = '';

  onPlayerAdd: (sessionId: string, state: RemotePlayerState) => void = () => {};
  onPlayerChange: (sessionId: string, state: RemotePlayerState) => void = () => {};
  onPlayerRemove: (sessionId: string) => void = () => {};
  onChat: (event: ChatEvent) => void = () => {};
  onSystem: (text: string) => void = () => {};
  onDisconnected: (reason: string) => void = () => {};

  constructor(serverUrl: string) {
    this.client = new Client(serverUrl);
  }

  async connect(name: string): Promise<void> {
    log('info', `connecting to multiplayer server as "${name}"`);
    this.room = await this.client.joinOrCreate('plaza', { name });
    this.sessionId = this.room.sessionId;
    log('info', `connected — sessionId=${this.sessionId} room=${this.room.roomId}`);

    const $ = getStateCallbacks(this.room);
    const state = this.room.state as any;

    $(state).players.onAdd((player: any, sessionId: string) => {
      if (sessionId === this.sessionId) return;
      log('info', `player joined: ${player.name} (${sessionId})`);
      this.onPlayerAdd(sessionId, toState(player));
      $(player).onChange(() => {
        this.onPlayerChange(sessionId, toState(player));
      });
    });

    $(state).players.onRemove((player: any, sessionId: string) => {
      if (sessionId === this.sessionId) return;
      log('info', `player left: ${player?.name ?? sessionId}`);
      this.onPlayerRemove(sessionId);
    });

    this.room.onMessage('chat', (data: ChatEvent) => this.onChat(data));
    this.room.onMessage('system', (data: { text: string }) => this.onSystem(data.text));

    this.room.onLeave((code: number) => {
      log('warn', `disconnected from server (code=${code})`);
      this.onDisconnected(`code ${code}`);
    });

    this.room.onError((code: number, message?: string) => {
      log('error', `room error (code=${code}): ${message ?? 'unknown'}`);
    });
  }

  sendMove(x: number, y: number, z: number, rotY: number, mode: string) {
    this.room?.send('move', { x, y, z, rotY, mode });
  }

  sendChat(text: string) {
    this.room?.send('chat', { text });
  }
}

function toState(player: any): RemotePlayerState {
  return { name: player.name, x: player.x, y: player.y, z: player.z, rotY: player.rotY, mode: player.mode };
}
