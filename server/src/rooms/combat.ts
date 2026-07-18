import { Client } from 'colyseus';
import { Schema, type } from '@colyseus/schema';
import {
  getOrCreatePlayerStats,
  getOrCreatePlayerUpgrades,
  savePlayerStats,
  savePlayerUpgrades,
  listPlacedObjects,
} from '../db';
import type { PlazaRoom, PlayerState } from './PlazaRoom';
import { BossController, BOSS_ID, BOSS_KIND } from './boss';

export class EnemyState extends Schema {
  @type('string') kind = 'mosquito';
  @type('number') x = 0;
  @type('number') y = 1.5;
  @type('number') z = -35;
  @type('number') hp = 20;
  @type('number') maxHp = 20;
  /** Session id of the player this enemy is chasing; empty while wandering. */
  @type('string') targetSessionId = '';
  /** Boss fight phase (1–3); 0 for regular enemies. */
  @type('number') phase = 0;
}

export class PickupState extends Schema {
  @type('string') kind = 'coin';
  @type('number') x = 0;
  @type('number') y = 0.35;
  @type('number') z = 0;
  @type('number') value = 1;
}

export type WeaponId = 'vassoura' | 'chinelo';
export type EnemyKind = 'mosquito' | 'barata' | 'pombo';
type ShopItemId = 'chinelo_reforcado' | 'repelente' | 'suco_laranja';

export interface AttackMessage {
  weapon?: string;
  ox?: number;
  oy?: number;
  oz?: number;
  dx?: number;
  dy?: number;
  dz?: number;
}

export interface ShopPurchaseMessage {
  item?: string;
}

export interface UseItemMessage {
  item?: string;
}

// --- Tuning ---------------------------------------------------------------------
// The lake (spawnLake in client/src/main.ts) is a circle of radius 7 at (0, -35).
const LAKE_CENTER = { x: 0, z: -35 };
const SPAWN_RING_MIN = 3;
const SPAWN_RING_MAX = 10;
const HOVER_MIN = 1.0;
const HOVER_MAX = 2.2;
const MAX_MOSQUITOS = 8;
const GM_MAX_MOSQUITOS = 16;
const SPAWN_INTERVAL_MS = 5000;
const VENDOR_POS = { x: 6, z: -1.5 };
const VENDOR_INTERACT_RADIUS = 5;
/** Players closer than this to the plaza center are never targeted. */
const SAFE_RADIUS = 16;
const AGGRO_ENTER = 5;
const AGGRO_EXIT = 9;
const AGGRO_MIN_MS = 2000;
const LEASH_RADIUS = 18;
const WANDER_SPEED = 1.5;
// Below the player's MAX_SPEED (5 m/s) so running away is always possible.
const CHASE_SPEED = 3.5;
const RETURN_SPEED = 4;
const BITE_RANGE = 1.2;
const BITE_INTERVAL_MS = 1500;
// Positions are client-authoritative and only 15 Hz fresh, so every range
// check below is deliberately generous.
const MELEE_RANGE = 3.0;
const MELEE_COS = Math.cos(Math.PI / 4);
const MAX_ORIGIN_DRIFT = 3.0;
const COOLDOWN_MS: Record<WeaponId, number> = { vassoura: 400, chinelo: 700 };
// NOTE: mirrored by hand in client/src/combat.ts — keep the values in sync.
const PROJECTILE_SPEED = 16;
const PROJECTILE_GRAVITY = 6;
const PROJECTILE_TTL = 2.0;
const PROJECTILE_HIT_RADIUS = 0.7;
const RESPAWN_MS = 3000;
const LEVEL_CAP = 10;
const COIN_PICKUP_RADIUS = 1.1;
const MAX_PICKUPS = 64;

const REPELENTE_SHIELD = 60;
const SUCO_HEAL_AMOUNT = 35;
const CHINELO_REFORCADO_BONUS = 8;

const ENEMY_DEFS: Record<
  EnemyKind,
  { hp: number; xp: number; speed: number; bite: number; hoverY: number }
> = {
  mosquito: { hp: 20, xp: 10, speed: CHASE_SPEED, bite: 5, hoverY: 1.5 },
  barata: { hp: 34, xp: 18, speed: 4.2, bite: 7, hoverY: 0.55 },
  pombo: { hp: 26, xp: 14, speed: 4.8, bite: 6, hoverY: 2.8 },
};

const SHOP_PRICES: Record<ShopItemId, number> = {
  chinelo_reforcado: 45,
  repelente: 20,
  suco_laranja: 12,
};

// NOTE: mirrored by hand in client/src/hud.ts — keep the curve in sync.
function xpNeeded(level: number): number {
  return 40 * level;
}

function maxHpForLevel(level: number): number {
  return 80 + 20 * level;
}

function meleeDamage(level: number): number {
  return 8 + 2 * level;
}

function projectileDamage(level: number, reinforced: boolean): number {
  const base = 12 + 3 * level;
  return reinforced ? base + CHINELO_REFORCADO_BONUS : base;
}

interface EnemyBrain {
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  state: 'wander' | 'chase' | 'return';
  aggroUntil: number;
  lastBiteAt: number;
  wanderSeed: number;
}

interface Projectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  by: string;
  level: number;
  reinforced: boolean;
  ttl: number;
}

function dist2d(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

function segmentPointDistance(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  px: number,
  py: number,
  pz: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const abLen2 = abx * abx + aby * aby + abz * abz;
  const t = abLen2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLen2)) : 0;
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t), pz - (az + abz * t));
}

function toEnemyKind(value: string | undefined): EnemyKind | null {
  if (value === 'mosquito' || value === 'barata' || value === 'pombo') return value;
  return null;
}

function toShopItem(value: string | undefined): ShopItemId | null {
  if (value === 'chinelo_reforcado' || value === 'repelente' || value === 'suco_laranja') {
    return value;
  }
  return null;
}

/** Server-authoritative battle logic: enemy AI/spawn, hit validation,
 * damage, XP/levels, and the death/respawn cycle. */
export class CombatSystem {
  private brains = new Map<string, EnemyBrain>();
  private projectiles: Projectile[] = [];
  private lastAttackAt = new Map<string, Record<WeaponId, number>>();
  private nextEnemyId = 1;
  private nextPickupId = 1;
  private spawnAccumulatorMs = 0;
  private elapsed = 0;
  readonly boss: BossController;
  private persistentSpawns = new Map<string, { kind: string; x: number; z: number }>();
  private pendingRespawns: { id: string; kind: string; x: number; z: number; respawnAt: number }[] =
    [];

  constructor(readonly room: PlazaRoom) {
    this.boss = new BossController(this);

    // Load persistent monster spawns from DB
    try {
      const allPlaced = listPlacedObjects();
      allPlaced.forEach((obj) => {
        if (obj.type.startsWith('monster:')) {
          const kind = obj.type.split(':')[1];
          this.persistentSpawns.set(obj.id, { kind, x: obj.x, z: obj.z });
        }
      });
      console.log(
        `[CombatSystem] Loaded ${this.persistentSpawns.size} persistent monster spawns from DB.`
      );

      // Spawn them
      for (const [id, spawn] of this.persistentSpawns.entries()) {
        this.spawnPersistentEnemy(id, spawn.kind, spawn.x, spawn.z);
      }
    } catch (e) {
      console.error('[CombatSystem] Failed to load persistent spawns:', e);
    }
  }

  spawnPersistentEnemy(id: string, kind: string, x: number, z: number) {
    const enemyKind = kind as EnemyKind;
    const def = ENEMY_DEFS[enemyKind];
    if (!def) return;

    const enemy = new EnemyState();
    enemy.kind = enemyKind;
    enemy.x = x;
    enemy.z = z;
    enemy.y = def.hoverY;
    enemy.hp = def.hp;
    enemy.maxHp = def.hp;

    this.room.state.enemies.set(id, enemy);
    this.brains.set(id, {
      anchorX: x,
      anchorY: def.hoverY,
      anchorZ: z,
      state: 'wander',
      aggroUntil: 0,
      lastBiteAt: 0,
      wanderSeed: Math.random() * 100,
    });
    console.log(`[Combat] spawned persistent enemy ${id} of kind ${kind} at (${x}, ${z})`);
  }

  addPersistentSpawn(id: string, type: string, x: number, z: number) {
    if (!type.startsWith('monster:')) return;
    const kind = type.split(':')[1];
    this.persistentSpawns.set(id, { kind, x, z });
    this.pendingRespawns = this.pendingRespawns.filter((p) => p.id !== id);
    this.spawnPersistentEnemy(id, kind, x, z);
  }

  removePersistentSpawn(id: string) {
    this.persistentSpawns.delete(id);
    this.pendingRespawns = this.pendingRespawns.filter((p) => p.id !== id);
    if (this.room.state.enemies.has(id)) {
      this.room.state.enemies.delete(id);
      this.brains.delete(id);
      console.log(`[CombatSystem] Persistent enemy ${id} despawned (spawn point deleted)`);
    }
  }

  // --- Player lifecycle -----------------------------------------------------

  loadPlayerStats(player: PlayerState) {
    const stats = getOrCreatePlayerStats(player.name);
    player.level = Math.min(LEVEL_CAP, Math.max(1, stats.level));
    player.xp = Math.max(0, stats.xp);
    player.coins = Math.max(0, stats.coins);
    player.maxHp = maxHpForLevel(player.level);
    player.hp = player.maxHp;
  }

  onPlayerJoin(sessionId: string, player: PlayerState) {
    const upgrades = getOrCreatePlayerUpgrades(player.name);
    player.reinforcedChinelo = upgrades.reinforcedChinelo;
    player.sucos = upgrades.sucoCount;
    player.shield = 0;
    player.maxShield = 0;
  }

  onPlayerLeave(sessionId: string, player: PlayerState | undefined) {
    this.lastAttackAt.delete(sessionId);
    if (player) {
      savePlayerStats(player.name, player.level, player.xp, player.coins);
      savePlayerUpgrades(player.name, {
        reinforcedChinelo: player.reinforcedChinelo,
        sucoCount: player.sucos,
      });
    }
    this.clearTargetsOn(sessionId);
  }

  // --- Tick -----------------------------------------------------------------

  update(dtMs: number) {
    const dt = Math.min(dtMs, 250) / 1000;
    this.elapsed += dt;
    this.updateSpawner(dtMs);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updatePickups();
    this.boss.update(dt, dtMs);

    // Process pending respawns for persistent monsters
    const now = Date.now();
    for (let i = this.pendingRespawns.length - 1; i >= 0; i--) {
      const respawn = this.pendingRespawns[i];
      if (now >= respawn.respawnAt) {
        if (this.persistentSpawns.has(respawn.id)) {
          this.spawnPersistentEnemy(respawn.id, respawn.kind, respawn.x, respawn.z);
        }
        this.pendingRespawns.splice(i, 1);
      }
    }
  }

  private updateSpawner(dtMs: number) {
    this.spawnAccumulatorMs += dtMs;
    if (this.spawnAccumulatorMs < SPAWN_INTERVAL_MS) return;
    this.spawnAccumulatorMs = 0;
    // During the boss fight the queen's scripted summons own the pacing —
    // no random extra spawns diluting the choreography.
    if (this.boss.isActive) return;
    if (this.room.state.enemies.size >= MAX_MOSQUITOS) return;
    const anyPlazaPlayer = [...this.room.state.players.values()].some(
      (p) => p.mode === 'plaza' && !p.dead
    );
    if (!anyPlazaPlayer) return;

    const anyReinforced = [...this.room.state.players.values()].some((p) => p.reinforcedChinelo);
    const roll = Math.random();
    const kind: EnemyKind = !anyReinforced
      ? 'mosquito'
      : roll < 0.45
        ? 'barata'
        : roll < 0.7
          ? 'pombo'
          : 'mosquito';
    this.spawnEnemy(kind);
  }

  spawnMosquito(): boolean {
    return this.spawnEnemy('mosquito');
  }

  spawnEnemy(kind: EnemyKind, at?: { x: number; z: number }): boolean {
    if (this.room.state.enemies.size >= GM_MAX_MOSQUITOS) return false;
    const def = ENEMY_DEFS[kind];
    const angle = Math.random() * Math.PI * 2;
    const radius = SPAWN_RING_MIN + Math.random() * (SPAWN_RING_MAX - SPAWN_RING_MIN);
    const enemy = new EnemyState();
    enemy.kind = kind;
    enemy.x = at ? at.x : LAKE_CENTER.x + Math.cos(angle) * radius;
    enemy.z = at ? at.z : LAKE_CENTER.z + Math.sin(angle) * radius;
    enemy.y =
      kind === 'mosquito' ? HOVER_MIN + Math.random() * (HOVER_MAX - HOVER_MIN) : def.hoverY;
    enemy.hp = def.hp;
    enemy.maxHp = def.hp;
    const id = `${kind}_${this.nextEnemyId++}`;
    this.room.state.enemies.set(id, enemy);
    this.brains.set(id, {
      anchorX: enemy.x,
      anchorY: enemy.y,
      anchorZ: enemy.z,
      state: 'wander',
      aggroUntil: 0,
      lastBiteAt: 0,
      wanderSeed: Math.random() * 100,
    });
    console.log(`[Combat] spawned ${id} (${this.room.state.enemies.size} alive)`);
    return true;
  }

  clearEnemies() {
    for (const id of [...this.room.state.enemies.keys()]) this.room.state.enemies.delete(id);
    this.brains.clear();
    this.boss.notifyCleared();
    console.log('[Combat] all enemies cleared');
  }

  clearPersistentSpawns() {
    for (const id of this.persistentSpawns.keys()) {
      if (this.room.state.enemies.has(id)) {
        this.room.state.enemies.delete(id);
        this.brains.delete(id);
      }
    }
    this.persistentSpawns.clear();
    this.pendingRespawns = [];
    console.log('[CombatSystem] All persistent monster spawn points cleared');
  }

  // --- Boss support (called by BossController) ------------------------------

  /** Registers a schema enemy WITHOUT an AI brain — the caller scripts every
   * movement itself (updateEnemies skips entries that have no brain). */
  addScriptedEnemy(
    id: string,
    kind: string,
    x: number,
    y: number,
    z: number,
    hp: number
  ): EnemyState {
    const enemy = new EnemyState();
    enemy.kind = kind;
    enemy.x = x;
    enemy.y = y;
    enemy.z = z;
    enemy.hp = hp;
    enemy.maxHp = hp;
    this.room.state.enemies.set(id, enemy);
    return enemy;
  }

  removeEnemyEntry(id: string) {
    this.room.state.enemies.delete(id);
    this.brains.delete(id);
  }

  spawnCoinBurst(x: number, z: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 0.5 + Math.random() * 1.6;
      this.spawnCoinPickup(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius);
    }
  }

  hurtPlayer(sessionId: string, damage: number, byKind: string) {
    const player = this.room.state.players.get(sessionId);
    if (player) this.damagePlayer(sessionId, player, damage, byKind);
  }

  awardXpTo(sessionId: string, amount: number) {
    const player = this.room.state.players.get(sessionId);
    if (player) this.awardXp(player, amount);
  }

  isInSafeZone(x: number, z: number): boolean {
    return Math.hypot(x, z) < SAFE_RADIUS;
  }

  announce(text: string) {
    this.room.broadcast('system', { text });
  }

  // --- Shop -----------------------------------------------------------------

  handleShopPurchase(client: Client, message: ShopPurchaseMessage) {
    const player = this.room.state.players.get(client.sessionId);
    if (!player || player.mode !== 'plaza') return;
    const item = toShopItem(message?.item);
    if (!item) {
      client.send('shop_purchase_result', {
        success: false,
        item: message?.item ?? '',
        reason: 'invalid_item',
        message: 'Item desconhecido.',
      });
      return;
    }

    // Find all placed vendors to support custom GM placements
    const vendorPositions: { x: number; z: number }[] = [];
    try {
      const placed = listPlacedObjects();
      placed.forEach((obj) => {
        if (obj.type === 'npc:vendor') {
          vendorPositions.push({ x: obj.x, z: obj.z });
        }
      });
    } catch (e) {
      console.error('[CombatSystem] Failed to load placed vendors for purchase check:', e);
    }

    if (vendorPositions.length === 0) {
      vendorPositions.push({ x: VENDOR_POS.x, z: VENDOR_POS.z });
    }

    const isNearAnyVendor = vendorPositions.some((pos) => {
      return dist2d(player.x, player.z, pos.x, pos.z) <= VENDOR_INTERACT_RADIUS;
    });

    if (!isNearAnyVendor) {
      client.send('shop_purchase_result', {
        success: false,
        item,
        reason: 'too_far',
        message: 'Chegue perto da feirante para comprar.',
      });
      return;
    }

    const price = SHOP_PRICES[item];
    if (player.coins < price) {
      client.send('shop_purchase_result', {
        success: false,
        item,
        reason: 'not_enough_coins',
        message: 'Moedas insuficientes.',
      });
      return;
    }

    if (item === 'chinelo_reforcado') {
      if (player.reinforcedChinelo) {
        client.send('shop_purchase_result', {
          success: false,
          item,
          reason: 'already_owned',
          message: 'Voce ja possui o Chinelo Reforcado.',
        });
        return;
      }
      player.coins -= price;
      player.reinforcedChinelo = true;
      savePlayerStats(player.name, player.level, player.xp, player.coins);
      savePlayerUpgrades(player.name, {
        reinforcedChinelo: true,
        sucoCount: player.sucos,
      });
      client.send('shop_purchase_result', {
        success: true,
        item,
        message: 'Chinelo Reforcado equipado! +dano no arremesso.',
      });
      return;
    }

    if (item === 'repelente') {
      if (player.shield > 0) {
        client.send('shop_purchase_result', {
          success: false,
          item,
          reason: 'already_active',
          message: 'Você já possui um repelente ativo!',
        });
        return;
      }
      player.coins -= price;
      player.maxShield = Math.max(player.maxShield, REPELENTE_SHIELD);
      player.shield = Math.min(player.maxShield, player.shield + REPELENTE_SHIELD);
      savePlayerStats(player.name, player.level, player.xp, player.coins);
      client.send('shop_purchase_result', {
        success: true,
        item,
        message: `Repelente aplicado: +${REPELENTE_SHIELD} de shield.`,
      });
      return;
    }

    player.coins -= price;
    player.sucos += 1;
    savePlayerStats(player.name, player.level, player.xp, player.coins);
    savePlayerUpgrades(player.name, {
      reinforcedChinelo: player.reinforcedChinelo,
      sucoCount: player.sucos,
    });
    client.send('shop_purchase_result', {
      success: true,
      item,
      message: `Suco de Laranja guardado. Total: ${player.sucos}. Use na tecla 3.`,
    });
  }

  handleUseItem(client: Client, message: UseItemMessage) {
    const player = this.room.state.players.get(client.sessionId);
    if (!player || player.dead || player.mode !== 'plaza') return;
    if (message?.item !== 'suco_laranja') return;
    if (player.sucos <= 0) return;
    if (player.hp >= player.maxHp) return;

    player.sucos -= 1;
    player.hp = Math.min(player.maxHp, player.hp + SUCO_HEAL_AMOUNT);
    savePlayerUpgrades(player.name, {
      reinforcedChinelo: player.reinforcedChinelo,
      sucoCount: player.sucos,
    });
  }

  // --- Pickups -----------------------------------------------------------------

  private spawnCoinPickup(x: number, z: number) {
    if (this.room.state.pickups.size >= MAX_PICKUPS) return;
    const pickup = new PickupState();
    pickup.kind = 'coin';
    pickup.x = x + (Math.random() * 2 - 1) * 0.35;
    pickup.z = z + (Math.random() * 2 - 1) * 0.35;
    pickup.y = 0.35;
    pickup.value = 1 + Math.floor(Math.random() * 3);
    const id = `coin_${this.nextPickupId++}`;
    this.room.state.pickups.set(id, pickup);
  }

  private updatePickups() {
    if (this.room.state.pickups.size === 0) return;
    const collected: Array<{ pickupId: string; sessionId: string; value: number }> = [];

    this.room.state.pickups.forEach((pickup, pickupId) => {
      let collectorSessionId = '';
      this.room.state.players.forEach((player, sessionId) => {
        if (collectorSessionId || player.mode !== 'plaza' || player.dead) return;
        const d = Math.hypot(player.x - pickup.x, player.z - pickup.z);
        if (d <= COIN_PICKUP_RADIUS) collectorSessionId = sessionId;
      });

      if (collectorSessionId) {
        collected.push({ pickupId, sessionId: collectorSessionId, value: pickup.value });
      }
    });

    for (const hit of collected) {
      this.room.state.pickups.delete(hit.pickupId);
      const player = this.room.state.players.get(hit.sessionId);
      if (!player) continue;
      player.coins += hit.value;
      savePlayerStats(player.name, player.level, player.xp, player.coins);
    }
  }

  // --- Enemy AI ----------------------------------------------------------------

  private updateEnemies(dt: number) {
    const now = Date.now();
    this.room.state.enemies.forEach((enemy, id) => {
      const brain = this.brains.get(id);
      if (!brain) return;

      if (
        brain.state !== 'return' &&
        dist2d(enemy.x, enemy.z, brain.anchorX, brain.anchorZ) > LEASH_RADIUS
      ) {
        brain.state = 'return';
        enemy.targetSessionId = '';
      }

      if (brain.state === 'chase') this.tickChase(enemy, brain, dt, now);
      if (brain.state === 'wander') this.tickWander(enemy, brain, dt, now);
      if (brain.state === 'return') this.tickReturn(enemy, brain, dt);
    });
  }

  private findTarget(
    enemy: EnemyState,
    maxRange: number
  ): { sessionId: string; player: PlayerState } | null {
    let best: { sessionId: string; player: PlayerState } | null = null;
    let bestDist = maxRange;
    this.room.state.players.forEach((player, sessionId) => {
      if (player.mode !== 'plaza' || player.dead) return;
      if (Math.hypot(player.x, player.z) < SAFE_RADIUS) return;
      const d = Math.hypot(player.x - enemy.x, player.z - enemy.z);
      if (d < bestDist) {
        bestDist = d;
        best = { sessionId, player };
      }
    });
    return best;
  }

  private tickWander(enemy: EnemyState, brain: EnemyBrain, dt: number, now: number) {
    const def = ENEMY_DEFS[toEnemyKind(enemy.kind) ?? 'mosquito'];
    const target = this.findTarget(enemy, AGGRO_ENTER + (enemy.kind === 'barata' ? 1.5 : 0));
    if (target) {
      brain.state = 'chase';
      brain.aggroUntil = now + AGGRO_MIN_MS;
      enemy.targetSessionId = target.sessionId;
      return;
    }

    const t = this.elapsed;
    const amp = enemy.kind === 'barata' ? 1.5 : 2.5;
    const wx = brain.anchorX + Math.sin(t * 0.5 + brain.wanderSeed) * amp;
    const wz = brain.anchorZ + Math.cos(t * 0.35 + brain.wanderSeed * 1.7) * amp;
    const wy =
      def.hoverY + (enemy.kind === 'mosquito' ? Math.sin(t * 0.8 + brain.wanderSeed) * 0.4 : 0);
    this.moveToward(enemy, wx, wy, wz, WANDER_SPEED * dt);
  }

  private tickChase(enemy: EnemyState, brain: EnemyBrain, dt: number, now: number) {
    const def = ENEMY_DEFS[toEnemyKind(enemy.kind) ?? 'mosquito'];
    const player = this.room.state.players.get(enemy.targetSessionId);
    const targetGone =
      !player ||
      player.mode !== 'plaza' ||
      player.dead ||
      Math.hypot(player.x, player.z) < SAFE_RADIUS;
    if (targetGone) {
      brain.state = 'wander';
      enemy.targetSessionId = '';
      return;
    }

    const d = Math.hypot(player.x - enemy.x, player.z - enemy.z);
    if (d <= AGGRO_ENTER) brain.aggroUntil = now + AGGRO_MIN_MS;
    if (d >= AGGRO_EXIT && now > brain.aggroUntil) {
      brain.state = 'wander';
      enemy.targetSessionId = '';
      return;
    }

    const chaseY = enemy.kind === 'pombo' ? Math.max(1.5, player.y + 0.8) : def.hoverY;
    this.moveToward(enemy, player.x, chaseY, player.z, def.speed * dt);

    if (d <= BITE_RANGE && now - brain.lastBiteAt > BITE_INTERVAL_MS) {
      brain.lastBiteAt = now;
      this.damagePlayer(
        enemy.targetSessionId,
        player,
        def.bite,
        toEnemyKind(enemy.kind) ?? 'mosquito'
      );
      if (enemy.kind === 'pombo') {
        brain.state = 'return';
        enemy.targetSessionId = '';
      }
    }
  }

  private tickReturn(enemy: EnemyState, brain: EnemyBrain, dt: number) {
    this.moveToward(enemy, brain.anchorX, brain.anchorY, brain.anchorZ, RETURN_SPEED * dt);
    if (
      dist2d(enemy.x, enemy.z, brain.anchorX, brain.anchorZ) < 1 &&
      Math.abs(enemy.y - brain.anchorY) < 0.5
    ) {
      brain.state = 'wander';
      enemy.hp = enemy.maxHp;
    }
  }

  private moveToward(enemy: EnemyState, tx: number, ty: number, tz: number, maxStep: number) {
    const dx = tx - enemy.x;
    const dy = ty - enemy.y;
    const dz = tz - enemy.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-4) return;
    const step = Math.min(1, maxStep / d);
    enemy.x += dx * step;
    enemy.y += dy * step;
    enemy.z += dz * step;
  }

  // --- Attacks --------------------------------------------------------------

  handleAttack(client: Client, message: AttackMessage) {
    const player = this.room.state.players.get(client.sessionId);
    if (!player || player.dead || player.mode !== 'plaza') return;

    const weapon: WeaponId | null =
      message?.weapon === 'vassoura' || message?.weapon === 'chinelo' ? message.weapon : null;
    if (!weapon) return;

    const { ox, oy, oz, dx, dy, dz } = message;
    if (![ox, oy, oz, dx, dy, dz].every((v) => Number.isFinite(v))) return;

    const now = Date.now();
    let cooldowns = this.lastAttackAt.get(client.sessionId);
    if (!cooldowns) {
      cooldowns = { vassoura: 0, chinelo: 0 };
      this.lastAttackAt.set(client.sessionId, cooldowns);
    }
    if (now - cooldowns[weapon] < COOLDOWN_MS[weapon]) return;
    cooldowns[weapon] = now;

    if (Math.hypot(ox! - player.x, oz! - player.z) > MAX_ORIGIN_DRIFT) return;

    const dirLen = Math.hypot(dx!, dy!, dz!);
    if (dirLen < 1e-4) return;
    const ndx = dx! / dirLen;
    const ndy = dy! / dirLen;
    const ndz = dz! / dirLen;

    this.room.broadcast(
      'attack_visual',
      {
        sessionId: client.sessionId,
        weapon,
        reinforced: weapon === 'chinelo' && player.reinforcedChinelo,
        ox,
        oy,
        oz,
        dx: ndx,
        dy: ndy,
        dz: ndz,
      },
      { except: client }
    );

    if (weapon === 'vassoura') {
      this.resolveMelee(client, player, ox!, oy!, oz!, ndx, ndy, ndz);
    } else {
      this.projectiles.push({
        x: ox!,
        y: oy!,
        z: oz!,
        vx: ndx * PROJECTILE_SPEED,
        vy: ndy * PROJECTILE_SPEED,
        vz: ndz * PROJECTILE_SPEED,
        by: client.sessionId,
        level: player.level,
        reinforced: player.reinforcedChinelo,
        ttl: PROJECTILE_TTL,
      });
    }
  }

  private resolveMelee(
    client: Client,
    attacker: PlayerState,
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number
  ) {
    let bestId = '';
    let bestDist = MELEE_RANGE;
    this.room.state.enemies.forEach((enemy, id) => {
      const ex = enemy.x - ox;
      const ey = enemy.y - oy;
      const ez = enemy.z - oz;
      const d = Math.hypot(ex, ey, ez);
      if (d > bestDist || d < 1e-4) return;
      if ((ex * dx + ey * dy + ez * dz) / d < MELEE_COS) return;
      bestDist = d;
      bestId = id;
    });
    if (bestId) this.damageEnemy(bestId, client.sessionId, meleeDamage(attacker.level));

    this.room.state.players.forEach((other, sessionId) => {
      if (sessionId === client.sessionId || other.mode !== 'plaza' || other.dead) return;
      const px = other.x - ox;
      const py = other.y - 0.5 - oy;
      const pz = other.z - oz;
      const d = Math.hypot(px, py, pz);
      if (d > MELEE_RANGE || d < 1e-4) return;
      if ((px * dx + py * dy + pz * dz) / d < MELEE_COS) return;
      this.bonk(sessionId, client.sessionId, dx, dz);
    });
  }

  private updateProjectiles(dt: number) {
    const SUBSTEPS = 3;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.ttl -= dt;
      let dead = p.ttl <= 0;

      for (let s = 0; s < SUBSTEPS && !dead; s++) {
        const sdt = dt / SUBSTEPS;
        const px = p.x;
        const py = p.y;
        const pz = p.z;
        p.vy -= PROJECTILE_GRAVITY * sdt;
        p.x += p.vx * sdt;
        p.y += p.vy * sdt;
        p.z += p.vz * sdt;

        let hitEnemyId = '';
        this.room.state.enemies.forEach((enemy, id) => {
          if (hitEnemyId) return;
          const d = segmentPointDistance(px, py, pz, p.x, p.y, p.z, enemy.x, enemy.y, enemy.z);
          // The queen's body is ~3x a mosquito's — match the visual size.
          const hitRadius = enemy.kind === BOSS_KIND ? 1.6 : PROJECTILE_HIT_RADIUS;
          if (d <= hitRadius) hitEnemyId = id;
        });
        if (hitEnemyId) {
          this.damageEnemy(hitEnemyId, p.by, projectileDamage(p.level, p.reinforced));
          dead = true;
          break;
        }

        let bonked = false;
        this.room.state.players.forEach((other, sessionId) => {
          if (bonked || sessionId === p.by || other.mode !== 'plaza' || other.dead) return;
          const d = segmentPointDistance(
            px,
            py,
            pz,
            p.x,
            p.y,
            p.z,
            other.x,
            other.y - 0.5,
            other.z
          );
          if (d <= 0.8) {
            const len = Math.hypot(p.vx, p.vz) || 1;
            this.bonk(sessionId, p.by, p.vx / len, p.vz / len);
            bonked = true;
          }
        });
        if (bonked || p.y < 0) {
          dead = true;
          break;
        }
      }

      if (dead) this.projectiles.splice(i, 1);
    }
  }

  // --- Damage / XP / death --------------------------------------------------

  private damageEnemy(enemyId: string, bySessionId: string, damage: number) {
    const enemy = this.room.state.enemies.get(enemyId);
    if (!enemy) return;
    if (enemyId === BOSS_ID) {
      // The queen owns her HP, phases, damage tally, and shared-XP payout.
      this.boss.onDamaged(bySessionId, damage);
      return;
    }
    enemy.hp -= damage;
    if (enemy.hp > 0) {
      this.room.broadcast('enemy_hit', { enemyId, by: bySessionId, damage });
      return;
    }

    this.room.state.enemies.delete(enemyId);
    this.brains.delete(enemyId);

    // If it was a persistent spawn, schedule respawn
    if (this.persistentSpawns.has(enemyId)) {
      const spawn = this.persistentSpawns.get(enemyId)!;
      this.pendingRespawns.push({
        id: enemyId,
        kind: spawn.kind,
        x: spawn.x,
        z: spawn.z,
        respawnAt: Date.now() + 10000, // 10 seconds cooldown
      });
      console.log(`[Combat] Scheduled respawn for persistent enemy ${enemyId} in 10s`);
    }

    this.spawnCoinPickup(enemy.x, enemy.z);
    const kind = toEnemyKind(enemy.kind) ?? 'mosquito';
    const xp = ENEMY_DEFS[kind].xp;
    this.room.broadcast('enemy_died', { enemyId, by: bySessionId, xp });
    console.log(`[Combat] ${enemyId} killed by ${bySessionId}`);
    const killer = this.room.state.players.get(bySessionId);
    if (killer) this.awardXp(killer, xp);
  }

  private awardXp(player: PlayerState, amount: number) {
    if (player.level >= LEVEL_CAP) {
      savePlayerStats(player.name, player.level, player.xp, player.coins);
      return;
    }
    player.xp += amount;
    while (player.level < LEVEL_CAP && player.xp >= xpNeeded(player.level)) {
      player.xp -= xpNeeded(player.level);
      player.level += 1;
      player.maxHp = maxHpForLevel(player.level);
      player.hp = player.maxHp;
      console.log(`[Combat] ${player.name} reached level ${player.level}`);
    }
    savePlayerStats(player.name, player.level, player.xp, player.coins);
  }

  private damagePlayer(sessionId: string, player: PlayerState, damage: number, by: string) {
    if (player.dead) return;

    if (player.shield > 0) {
      const absorbed = Math.min(player.shield, damage);
      player.shield -= absorbed;
      damage -= absorbed;
      if (player.shield <= 0) {
        player.shield = 0;
        player.maxShield = 0;
      }
      if (damage <= 0) {
        this.room.broadcast('player_hit', { sessionId, by, damage: 0 });
        return;
      }
    }

    player.hp = Math.max(0, player.hp - damage);
    this.room.broadcast('player_hit', { sessionId, by, damage });
    if (player.hp > 0) return;

    player.dead = true;
    this.clearTargetsOn(sessionId);
    const client = this.room.clients.find((c) => c.sessionId === sessionId);
    client?.send('died', { respawnInMs: RESPAWN_MS });
    console.log(`[Combat] ${player.name} fainted`);

    this.room.clock.setTimeout(() => {
      const p = this.room.state.players.get(sessionId);
      if (!p) return;
      p.dead = false;
      p.hp = p.maxHp;
      const c = this.room.clients.find((cl) => cl.sessionId === sessionId);
      c?.send('respawned', {});
    }, RESPAWN_MS);
  }

  private bonk(targetSessionId: string, attackerSessionId: string, dx: number, dz: number) {
    this.room.broadcast('bonk', { targetSessionId, attackerSessionId, dx, dz });
  }

  private clearTargetsOn(sessionId: string) {
    this.room.state.enemies.forEach((enemy, id) => {
      if (enemy.targetSessionId !== sessionId) return;
      enemy.targetSessionId = '';
      const brain = this.brains.get(id);
      if (brain) brain.state = 'wander';
    });
  }
}
