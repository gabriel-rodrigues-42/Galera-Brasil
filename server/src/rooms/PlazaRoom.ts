import { Room, Client } from 'colyseus';
import { Schema, MapSchema, type } from '@colyseus/schema';
import { getHub, getOrCreateHub } from '../db';
import {
  CombatSystem,
  EnemyState,
  PickupState,
  AttackMessage,
  ShopPurchaseMessage,
  UseItemMessage,
} from './combat';

export class PlayerState extends Schema {
  @type('string') name = 'Visitante';
  @type('number') x = 0;
  @type('number') y = 1.7;
  @type('number') z = 8;
  @type('number') rotY = 0;
  @type('string') mode: 'plaza' | 'hub' = 'plaza';
  /** Owner name of the hub this player is currently inside; empty in plaza. */
  @type('string') hubId = '';
  // Battle stats — owned by the server (CombatSystem); clients only read them.
  @type('number') hp = 100;
  @type('number') maxHp = 100;
  @type('number') level = 1;
  @type('number') xp = 0;
  @type('number') coins = 0;
  @type('number') shield = 0;
  @type('number') maxShield = 0;
  @type('number') sucos = 0;
  @type('boolean') reinforcedChinelo = false;
  @type('boolean') dead = false;
}

export class PlazaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: EnemyState }) enemies = new MapSchema<EnemyState>();
  @type({ map: PickupState }) pickups = new MapSchema<PickupState>();
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
  private combat!: CombatSystem;

  onCreate() {
    this.setState(new PlazaState());
    this.combat = new CombatSystem(this);
    // 10 Hz server tick: enemy AI, projectile physics, bites. Clients smooth
    // between updates, so this stays cheap on the wire.
    this.setSimulationInterval((dtMs) => this.combat.update(dtMs), 100);

    this.onMessage('attack', (client, message: AttackMessage) => {
      this.combat.handleAttack(client, message);
    });

    this.onMessage('shop_purchase', (client, message: ShopPurchaseMessage) => {
      this.combat.handleShopPurchase(client, message);
    });

    this.onMessage('use_item', (client, message: UseItemMessage) => {
      this.combat.handleUseItem(client, message);
    });

    // Same trust model as the rest of the GM tools: no auth, friends server.
    this.onMessage('gm_spawn_enemy', (_client, message: { kind?: string }) => {
      const kind = message?.kind;
      if (kind === 'barata' || kind === 'pombo' || kind === 'mosquito') {
        this.combat.spawnEnemy(kind);
        return;
      }
      this.combat.spawnMosquito();
    });

    this.onMessage('gm_clear_enemies', () => {
      this.combat.clearEnemies();
    });

    this.onMessage('gm_spawn_boss', () => {
      this.combat.boss.gmSummon();
    });

    this.onMessage('move', (client, message: MoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (Number.isFinite(message?.x)) player.x = message.x!;
      if (Number.isFinite(message?.y)) player.y = message.y!;
      if (Number.isFinite(message?.z)) player.z = message.z!;
      if (Number.isFinite(message?.rotY)) player.rotY = message.rotY!;
      if (message?.mode === 'plaza' || message?.mode === 'hub') player.mode = message.mode;
      if (typeof message?.hubId === 'string')
        player.hubId = message.hubId.slice(0, MAX_NAME_LENGTH);
    });

    this.onMessage('chat', (client, message: ChatMessage) => {
      const player = this.state.players.get(client.sessionId);
      const text =
        typeof message?.text === 'string' ? message.text.trim().slice(0, MAX_CHAT_LENGTH) : '';
      if (!text) return;
      this.broadcast('chat', {
        name: player?.name ?? 'Visitante',
        text,
        sessionId: client.sessionId,
      });
    });

    this.onMessage(
      'object_placed',
      (client, message: { id: string; type: string; x: number; y: number; z: number }) => {
        if (message.type && message.type.startsWith('monster:')) {
          this.combat.addPersistentSpawn(message.id, message.type, message.x, message.z);
        }
        this.broadcast('object_placed', message, { except: client });
      }
    );

    this.onMessage('object_removed', (client, message: { id: string }) => {
      if (message.id) {
        this.combat.removePersistentSpawn(message.id);
      }
      this.broadcast('object_removed', message, { except: client });
    });

    this.onMessage('objects_cleared', (client) => {
      this.combat.clearPersistentSpawns();
      this.broadcast('objects_cleared', {}, { except: client });
    });

    console.log(`[PlazaRoom] created (${this.roomId})`);
  }

  onJoin(client: Client, options: JoinOptions) {
    const player = new PlayerState();
    player.name = sanitizeName(options?.name);
    this.combat.loadPlayerStats(player);
    this.state.players.set(client.sessionId, player);
    this.combat.onPlayerJoin(client.sessionId, player);

    // First-time visitors get a hub of their own — broadcast it so everyone
    // already in the praça sees the new facade appear without reloading.
    const isNewHub = !getHub(player.name);
    const hub = getOrCreateHub(player.name);
    if (isNewHub) {
      this.broadcast('hub_added', { owner: hub.owner, tag: hub.tag, slot: hub.slot });
    }

    this.broadcast('system', { text: `${player.name} entrou na praça` }, { except: client });
    console.log(
      `[PlazaRoom] ${client.sessionId} joined as "${player.name}" (${this.state.players.size} online)`
    );
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    this.combat.onPlayerLeave(client.sessionId, player);
    this.state.players.delete(client.sessionId);
    if (player) this.broadcast('system', { text: `${player.name} saiu da praça` });
    console.log(`[PlazaRoom] ${client.sessionId} left (${this.state.players.size} online)`);
  }
}
