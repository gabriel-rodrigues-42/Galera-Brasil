import { Client, Room, getStateCallbacks } from 'colyseus.js';
import { log } from './logger';
import type { PlacedObjectRecord } from './api';

export interface RemotePlayerState {
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  mode: string;
  hubId: string;
  role: string;
  isGhost: boolean;
  voteTarget: string;
}

export interface ChatEvent {
  name: string;
  text: string;
  sessionId: string;
}

export interface HubAddedEvent {
  owner: string;
  tag: string;
  slot: number;
}

// --- Battle system (2.0) --------------------------------------------------------

export type WeaponId = 'vassoura' | 'chinelo';

export interface EnemyNetState {
  kind: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  targetSessionId: string;
  /** Boss fight phase (1–3); 0 for regular enemies. */
  phase: number;
}

/** The local player's server-owned battle stats (hp/xp live on the server). */
export interface SelfState {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  level: number;
  xp: number;
  coins: number;
  sucos: number;
  reinforcedChinelo: boolean;
  dead: boolean;
  role: string;
  isGhost: boolean;
  superVassoura: boolean;
  lanternaEcologica: boolean;
  hasDetector: boolean;
}

export interface PickupNetState {
  kind: string;
  x: number;
  y: number;
  z: number;
  value: number;
}

export interface DebrisNetState {
  id: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  progress: number;
  status: string;
}

export interface AttackVisualEvent {
  sessionId: string;
  weapon: WeaponId;
  reinforced: boolean;
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dy: number;
  dz: number;
}

export interface EnemyHitEvent {
  enemyId: string;
  by: string;
  damage: number;
}

export interface EnemyDiedEvent {
  enemyId: string;
  by: string;
  xp: number;
}

export interface PlayerHitEvent {
  sessionId: string;
  by: string;
  damage: number;
}

export interface BonkEvent {
  targetSessionId: string;
  attackerSessionId: string;
  dx: number;
  dz: number;
}

export interface ShopPurchaseResultEvent {
  success: boolean;
  item: string;
  reason?: string;
  message: string;
}

/** Boss fight beats (2.3) — juice cues; the queen's HP/position ride the
 * regular enemies schema map like any other enemy. */
export interface BossEvent {
  type: 'spawn' | 'phase' | 'impact' | 'defeated' | 'despawn';
  phase?: number;
  x?: number;
  z?: number;
  xp?: number;
  contributors?: string[];
}

export class Network {
  private client: Client;
  private _room: Room | null = null;
  /** Read-only access to the underlying Colyseus room (state, sessionId). */
  get room(): Room | null {
    return this._room;
  }
  sessionId = '';

  onPlayerAdd: (sessionId: string, state: RemotePlayerState) => void = () => {};
  onPlayerChange: (sessionId: string, state: RemotePlayerState) => void = () => {};
  onPlayerRemove: (sessionId: string) => void = () => {};
  onChat: (event: ChatEvent) => void = () => {};
  onSystem: (text: string) => void = () => {};
  onHubAdded: (event: HubAddedEvent) => void = () => {};
  onDisconnected: (reason: string) => void = () => {};
  onObjectPlaced: (event: PlacedObjectRecord) => void = () => {};
  onObjectRemoved: (id: string) => void = () => {};
  onObjectsCleared: () => void = () => {};
  onEnemyAdd: (enemyId: string, state: EnemyNetState) => void = () => {};
  onEnemyChange: (enemyId: string, state: EnemyNetState) => void = () => {};
  onEnemyRemove: (enemyId: string) => void = () => {};
  onPickupAdd: (pickupId: string, state: PickupNetState) => void = () => {};
  onPickupChange: (pickupId: string, state: PickupNetState) => void = () => {};
  onPickupRemove: (pickupId: string) => void = () => {};
  onDebrisAdd: (debrisId: string, state: DebrisNetState) => void = () => {};
  onDebrisChange: (debrisId: string, state: DebrisNetState) => void = () => {};
  onDebrisRemove: (debrisId: string) => void = () => {};
  onGameStateChange: (gameState: string) => void = () => {};
  onGameTimerChange: (gameTimer: number) => void = () => {};
  onSelfChange: (state: SelfState) => void = () => {};
  onMeetingStateChange: (meetingState: string) => void = () => {};
  onMeetingTimerChange: (meetingTimer: number) => void = () => {};
  onBlackoutTimerChange: (blackoutTimer: number) => void = () => {};
  onTeleport: (pos: { x: number; y: number; z: number }) => void = () => {};
  onRoleAssignment: (role: string) => void = () => {};
  onDetectorResult: (sector: string) => void = () => {};
  onAttackVisual: (event: AttackVisualEvent) => void = () => {};
  onEnemyHit: (event: EnemyHitEvent) => void = () => {};
  onEnemyDied: (event: EnemyDiedEvent) => void = () => {};
  onPlayerHit: (event: PlayerHitEvent) => void = () => {};
  onBonk: (event: BonkEvent) => void = () => {};
  onDied: (respawnInMs: number) => void = () => {};
  onRespawned: () => void = () => {};
  onShopPurchaseResult: (event: ShopPurchaseResultEvent) => void = () => {};
  onBossEvent: (event: BossEvent) => void = () => {};

  constructor(serverUrl: string) {
    this.client = new Client(serverUrl);
  }

  async connect(name: string): Promise<void> {
    log('info', `connecting to multiplayer server as "${name}"`);
    this._room = await this.client.joinOrCreate('plaza', { name });
    this.sessionId = this._room.sessionId;
    log('info', `connected — sessionId=${this.sessionId} room=${this._room.roomId}`);

    const $ = getStateCallbacks(this._room);
    const state = this._room.state as any;

    // NOTE: the browser build of colyseus.js does not fire onAdd for entries
    // that already existed in the room state before we joined (the Node build
    // does) — so after registering, we manually replay the current entries.
    // The seen-sets make the handlers idempotent either way.
    const seenPlayers = new Set<string>();
    const handlePlayerAdd = (player: any, sessionId: string) => {
      if (seenPlayers.has(sessionId)) return;
      seenPlayers.add(sessionId);
      if (sessionId === this.sessionId) {
        // Own avatar isn't rendered, but the server owns our battle stats
        // (hp/xp/level/dead) — watch them separately to drive the HUD.
        this.onSelfChange(toSelfState(player));
        $(player).onChange(() => {
          this.onSelfChange(toSelfState(player));
        });
        return;
      }
      log('info', `player joined: ${player.name} (${sessionId})`);
      this.onPlayerAdd(sessionId, toState(player));
      $(player).onChange(() => {
        this.onPlayerChange(sessionId, toState(player));
      });
    };

    $(state).players.onAdd(handlePlayerAdd);

    $(state).players.onRemove((player: any, sessionId: string) => {
      seenPlayers.delete(sessionId);
      if (sessionId === this.sessionId) return;
      log('info', `player left: ${player?.name ?? sessionId}`);
      this.onPlayerRemove(sessionId);
    });

    const seenEnemies = new Set<string>();
    const handleEnemyAdd = (enemy: any, enemyId: string) => {
      if (seenEnemies.has(enemyId)) return;
      seenEnemies.add(enemyId);
      log('info', `enemy spawned: ${enemyId}`);
      this.onEnemyAdd(enemyId, toEnemyState(enemy));
      $(enemy).onChange(() => {
        this.onEnemyChange(enemyId, toEnemyState(enemy));
      });
    };

    $(state).enemies.onAdd(handleEnemyAdd);

    $(state).enemies.onRemove((_enemy: any, enemyId: string) => {
      seenEnemies.delete(enemyId);
      this.onEnemyRemove(enemyId);
    });

    const seenPickups = new Set<string>();
    const handlePickupAdd = (pickup: any, pickupId: string) => {
      if (seenPickups.has(pickupId)) return;
      seenPickups.add(pickupId);
      this.onPickupAdd(pickupId, toPickupState(pickup));
      $(pickup).onChange(() => {
        this.onPickupChange(pickupId, toPickupState(pickup));
      });
    };

    $(state).pickups.onAdd(handlePickupAdd);

    $(state).pickups.onRemove((_pickup: any, pickupId: string) => {
      seenPickups.delete(pickupId);
      this.onPickupRemove(pickupId);
    });

    const seenDebris = new Set<string>();
    const handleDebrisAdd = (debris: any, debrisId: string) => {
      if (seenDebris.has(debrisId)) return;
      seenDebris.add(debrisId);
      this.onDebrisAdd(debrisId, toDebrisState(debris));
      $(debris).onChange(() => {
        this.onDebrisChange(debrisId, toDebrisState(debris));
      });
    };

    $(state).debris.onAdd(handleDebrisAdd);

    $(state).debris.onRemove((_debris: any, debrisId: string) => {
      seenDebris.delete(debrisId);
      this.onDebrisRemove(debrisId);
    });

    this._room.onStateChange((s: any) => {
      if (s.gameState !== undefined) this.onGameStateChange(s.gameState);
      if (s.gameTimer !== undefined) this.onGameTimerChange(s.gameTimer);
      if (s.meetingState !== undefined) this.onMeetingStateChange(s.meetingState);
      if (s.meetingTimer !== undefined) this.onMeetingTimerChange(s.meetingTimer);
      if (s.blackoutTimer !== undefined) this.onBlackoutTimerChange(s.blackoutTimer);
    });

    // Replay whatever was already in the plaza when we arrived. The initial
    // full state isn't guaranteed to be decoded yet at the instant join()
    // resolves (nested maps can still be undefined for a tick), so wait for
    // the first onStateChange rather than reading state.players/.enemies
    // synchronously here — reading too early is what was crashing connect().
    this._room.onStateChange.once((s: any) => {
      s.players?.forEach((player: any, sessionId: string) => handlePlayerAdd(player, sessionId));
      s.enemies?.forEach((enemy: any, enemyId: string) => handleEnemyAdd(enemy, enemyId));
      s.pickups?.forEach((pickup: any, pickupId: string) => handlePickupAdd(pickup, pickupId));
      s.debris?.forEach((debris: any, debrisId: string) => handleDebrisAdd(debris, debrisId));
    });

    this._room.onMessage('attack_visual', (data: AttackVisualEvent) => this.onAttackVisual(data));
    this._room.onMessage('enemy_hit', (data: EnemyHitEvent) => this.onEnemyHit(data));
    this._room.onMessage('enemy_died', (data: EnemyDiedEvent) => this.onEnemyDied(data));
    this._room.onMessage('player_hit', (data: PlayerHitEvent) => this.onPlayerHit(data));
    this._room.onMessage('bonk', (data: BonkEvent) => this.onBonk(data));
    this._room.onMessage('died', (data: { respawnInMs: number }) =>
      this.onDied(data.respawnInMs ?? 3000)
    );
    this._room.onMessage('respawned', () => this.onRespawned());
    this._room.onMessage('teleport', (pos: { x: number; y: number; z: number }) =>
      this.onTeleport(pos)
    );
    this._room.onMessage('role_assignment', (data: { role: string }) =>
      this.onRoleAssignment(data.role)
    );
    this._room.onMessage('shop_purchase_result', (data: ShopPurchaseResultEvent) =>
      this.onShopPurchaseResult(data)
    );
    this._room.onMessage('boss_event', (data: BossEvent) => this.onBossEvent(data));

    this._room.onMessage('chat', (data: ChatEvent) => this.onChat(data));
    this._room.onMessage('system', (data: { text: string }) => this.onSystem(data.text));
    this._room.onMessage('hub_added', (data: HubAddedEvent) => this.onHubAdded(data));
    this._room.onMessage('object_placed', (data: PlacedObjectRecord) => this.onObjectPlaced(data));
    this._room.onMessage('object_removed', (data: { id: string }) => this.onObjectRemoved(data.id));
    this._room.onMessage('objects_cleared', () => this.onObjectsCleared());
    this._room.onMessage('detector_result', (data: { sector: string }) =>
      this.onDetectorResult(data.sector)
    );

    this._room.onLeave((code: number) => {
      log('warn', `disconnected from server (code=${code})`);
      this.onDisconnected(`code ${code}`);
    });

    this._room.onError((code: number, message?: string) => {
      log('error', `room error (code=${code}): ${message ?? 'unknown'}`);
    });
  }

  sendMove(x: number, y: number, z: number, rotY: number, mode: string, hubId: string) {
    this._room?.send('move', { x, y, z, rotY, mode, hubId });
  }

  sendChat(text: string) {
    this._room?.send('chat', { text });
  }

  sendObjectPlaced(obj: PlacedObjectRecord) {
    this._room?.send('object_placed', obj);
  }

  sendObjectRemoved(id: string) {
    this._room?.send('object_removed', { id });
  }

  sendObjectsCleared() {
    this._room?.send('objects_cleared');
  }

  sendAttack(
    weapon: WeaponId,
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number
  ) {
    this._room?.send('attack', { weapon, ox, oy, oz, dx, dy, dz });
  }

  sendGmSpawnEnemy(kind: 'mosquito' | 'barata' | 'pombo' = 'mosquito') {
    this._room?.send('gm_spawn_enemy', { kind });
  }

  sendGmClearEnemies() {
    this._room?.send('gm_clear_enemies');
  }

  sendGmSpawnBoss() {
    this._room?.send('gm_spawn_boss');
  }

  sendShopPurchase(item: 'chinelo_reforcado' | 'repelente' | 'suco_laranja') {
    this._room?.send('shop_purchase', { item });
  }

  sendUseItem(item: 'suco_laranja') {
    this._room?.send('use_item', { item });
  }

  sendStartGame() {
    this._room?.send('start_game');
  }

  sendRepairTick(id: string) {
    this._room?.send('repair_tick', { id });
  }

  sendGmForceStart() {
    this._room?.send('gm_force_start');
  }

  sendCallMeeting() {
    this._room?.send('call_meeting');
  }

  sendCastVote(targetId: string) {
    this._room?.send('cast_vote', { targetId });
  }

  sendSabotage(type: string) {
    this._room?.send('sabotage', { type });
  }

  sendMinigameComplete(debrisId: string, kind: string) {
    this._room?.send('minigame_complete', { id: debrisId, kind });
  }

  sendUseDetector() {
    this._room?.send('use_detector');
  }
}

function toState(player: any): RemotePlayerState {
  return {
    name: player.name,
    x: player.x,
    y: player.y,
    z: player.z,
    rotY: player.rotY,
    mode: player.mode,
    hubId: player.hubId,
    role: player.role,
    isGhost: player.isGhost,
    voteTarget: player.voteTarget,
  };
}

function toSelfState(player: any): SelfState {
  return {
    hp: player.hp,
    maxHp: player.maxHp,
    shield: player.shield,
    maxShield: player.maxShield,
    level: player.level,
    xp: player.xp,
    coins: player.coins,
    sucos: player.sucos,
    reinforcedChinelo: player.reinforcedChinelo,
    dead: player.dead,
    role: player.role,
    isGhost: player.isGhost,
    superVassoura: player.superVassoura,
    lanternaEcologica: player.lanternaEcologica,
    hasDetector: player.hasDetector,
  };
}

function toEnemyState(enemy: any): EnemyNetState {
  return {
    kind: enemy.kind,
    x: enemy.x,
    y: enemy.y,
    z: enemy.z,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    targetSessionId: enemy.targetSessionId,
    phase: enemy.phase ?? 0,
  };
}

function toPickupState(pickup: any): PickupNetState {
  return {
    kind: pickup.kind,
    x: pickup.x,
    y: pickup.y,
    z: pickup.z,
    value: pickup.value,
  };
}

function toDebrisState(debris: any): DebrisNetState {
  return {
    id: debris.id,
    kind: debris.kind,
    x: debris.x,
    y: debris.y,
    z: debris.z,
    progress: debris.progress,
    status: debris.status,
  };
}
