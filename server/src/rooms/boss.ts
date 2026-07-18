import type { CombatSystem, EnemyState } from './combat';
import type { PlayerState } from './PlazaRoom';

export const BOSS_ID = 'boss_rainha';
export const BOSS_KIND = 'muricoca_rainha';

// --- Tuning ---------------------------------------------------------------------
const BOSS_HP = 600;
const PHASE2_FRACTION = 0.66;
const PHASE3_FRACTION = 0.33;
const SPAWN_INTERVAL_MS = 10 * 60_000;
const FIGHT_DURATION_MS = 4 * 60_000;
const LAKE_CENTER = { x: 0, z: -35 };
const CIRCLE_RADIUS = 6;
const CIRCLE_HEIGHT = 3.4;
const CIRCLE_ANGULAR_SPEED = 0.55; // rad/s around the lake center
const FLY_SPEED = 7;
const DIVE_TELEGRAPH_S = 0.7; // hover rise before the dash — the player's dodge window
const DIVE_SPEED = 11;
const DIVE_TIMEOUT_S = 1.6;
const DIVE_DAMAGE = 12;
const DIVE_RADIUS = 2.5; // generous AoE at the impact point (positions are 15 Hz fresh)
const RECOVER_S = 0.9;
const SUMMON_COUNT = 3;
const SUMMON_AT_S = 1.0;
const SUMMON_TOTAL_S = 2.2;
const SHARED_XP = 120;
const COIN_BURST = 12;
const PHASE_SPEED_MULT: Record<number, number> = { 1: 1, 2: 1.25, 3: 1.6 };

type Move = { kind: 'circle'; seconds: number } | { kind: 'dive' } | { kind: 'summon' };

// Fixed, repeating attack scripts per phase — the fight is fully choreographed
// rather than driven by the wander/aggro brain the small enemies use.
const PHASE_SCRIPTS: Record<number, Move[]> = {
  1: [{ kind: 'circle', seconds: 5 }, { kind: 'dive' }],
  2: [{ kind: 'circle', seconds: 3.5 }, { kind: 'dive' }, { kind: 'dive' }],
  3: [{ kind: 'circle', seconds: 2.5 }, { kind: 'dive' }, { kind: 'dive' }, { kind: 'dive' }],
};

/** The Muriçoca Rainha boss fight. Unlike the regular enemies (EnemyBrain in
 * combat.ts), the queen never wanders or aggros: she runs a deterministic
 * script — circle the lake, telegraph, dive-bomb a snapshotted player position,
 * recover — with phase changes at HP thresholds and shared XP on defeat. */
export class BossController {
  private enemy: EnemyState | null = null;
  private spawnTimerMs = 0;
  private fightMs = 0;
  private phase = 1;
  private angle = 0;
  private scriptIndex = 0;
  private move: Move = { kind: 'circle', seconds: 5 };
  private moveT = 0;
  private diveStage: 'telegraph' | 'dash' | 'recover' = 'telegraph';
  private diveTarget = { x: 0, z: 0 };
  private summoned = false;
  private pendingSummon = false;
  /** Per-player damage tally — everyone on it gets the shared XP on defeat. */
  private tally = new Map<string, { name: string; damage: number }>();

  constructor(private combat: CombatSystem) {}

  get isActive(): boolean {
    return this.enemy !== null;
  }

  // --- Tick -----------------------------------------------------------------

  update(dt: number, dtMs: number) {
    if (!this.enemy) {
      const anyone = [...this.combat.room.state.players.values()].some(
        (p) => p.mode === 'plaza' && !p.dead
      );
      if (anyone) this.spawnTimerMs += dtMs;
      if (this.spawnTimerMs >= SPAWN_INTERVAL_MS) this.spawn();
      return;
    }

    this.fightMs += dtMs;
    if (this.fightMs >= FIGHT_DURATION_MS) {
      this.flyAway();
      return;
    }

    this.moveT += dt;
    if (this.move.kind === 'circle') this.tickCircle(dt, this.move.seconds);
    else if (this.move.kind === 'dive') this.tickDive(dt);
    else this.tickSummon(dt);
  }

  // --- Spawn / despawn ------------------------------------------------------

  gmSummon(): boolean {
    if (this.enemy) return false;
    this.spawn();
    return true;
  }

  private spawn() {
    this.phase = 1;
    this.angle = 0;
    this.fightMs = 0;
    this.scriptIndex = 0;
    this.move = PHASE_SCRIPTS[1][0];
    this.moveT = 0;
    this.pendingSummon = false;
    this.tally.clear();

    const enemy = this.combat.addScriptedEnemy(
      BOSS_ID,
      BOSS_KIND,
      LAKE_CENTER.x + CIRCLE_RADIUS,
      CIRCLE_HEIGHT,
      LAKE_CENTER.z,
      BOSS_HP
    );
    enemy.phase = 1;
    this.enemy = enemy;

    this.combat.announce(
      '👑 A Muriçoca Rainha apareceu no lago! Derrotem-na antes que ela fuja (4 min)!'
    );
    this.combat.room.broadcast('boss_event', { type: 'spawn' });
    console.log('[Boss] Muriçoca Rainha spawned');
  }

  private flyAway() {
    this.combat.removeEnemyEntry(BOSS_ID);
    this.combat.announce('👑 A Muriçoca Rainha se cansou e voou embora... por enquanto.');
    this.combat.room.broadcast('boss_event', { type: 'despawn' });
    console.log('[Boss] Muriçoca Rainha despawned (timeout)');
    this.resetAfterFight();
  }

  /** GM "Limpar Inimigos" removed every enemy including the queen. */
  notifyCleared() {
    if (!this.enemy) return;
    console.log('[Boss] Muriçoca Rainha cleared by GM');
    this.resetAfterFight();
  }

  private resetAfterFight() {
    this.enemy = null;
    this.tally.clear();
    this.spawnTimerMs = 0;
    this.fightMs = 0;
  }

  // --- Moves ----------------------------------------------------------------

  private tickCircle(dt: number, seconds: number) {
    const enemy = this.enemy!;
    const mult = PHASE_SPEED_MULT[this.phase];
    this.angle += CIRCLE_ANGULAR_SPEED * mult * dt;
    const tx = LAKE_CENTER.x + Math.cos(this.angle) * CIRCLE_RADIUS;
    const tz = LAKE_CENTER.z + Math.sin(this.angle) * CIRCLE_RADIUS;
    this.moveToward(enemy, tx, CIRCLE_HEIGHT, tz, FLY_SPEED * mult * dt);
    if (this.moveT >= seconds) this.nextMove();
  }

  private tickDive(dt: number) {
    const enemy = this.enemy!;
    const mult = PHASE_SPEED_MULT[this.phase];

    if (this.diveStage === 'telegraph') {
      // Rise above the circle height — readable wind-up before the dash.
      this.moveToward(enemy, enemy.x, CIRCLE_HEIGHT + 1.2, enemy.z, FLY_SPEED * dt);
      if (this.moveT >= DIVE_TELEGRAPH_S) {
        this.diveStage = 'dash';
        this.moveT = 0;
      }
      return;
    }

    if (this.diveStage === 'dash') {
      // The dash goes to where the target WAS when the dive began — a scripted
      // strike the player can outrun, not a homing chase.
      this.moveToward(enemy, this.diveTarget.x, 1.0, this.diveTarget.z, DIVE_SPEED * mult * dt);
      const arrived =
        Math.hypot(enemy.x - this.diveTarget.x, enemy.y - 1.0, enemy.z - this.diveTarget.z) < 0.6;
      if (arrived || this.moveT >= DIVE_TIMEOUT_S) {
        this.impact();
        this.diveStage = 'recover';
        this.moveT = 0;
      }
      return;
    }

    this.moveToward(enemy, enemy.x, CIRCLE_HEIGHT, enemy.z, FLY_SPEED * dt);
    if (this.moveT >= RECOVER_S) this.nextMove();
  }

  private impact() {
    const enemy = this.enemy!;
    this.combat.room.state.players.forEach((player, sessionId) => {
      if (player.mode !== 'plaza' || player.dead) return;
      if (this.combat.isInSafeZone(player.x, player.z)) return;
      if (Math.hypot(player.x - enemy.x, player.z - enemy.z) > DIVE_RADIUS) return;
      this.combat.hurtPlayer(sessionId, DIVE_DAMAGE, BOSS_KIND);
    });
    this.combat.room.broadcast('boss_event', { type: 'impact', x: enemy.x, z: enemy.z });
  }

  private tickSummon(dt: number) {
    const enemy = this.enemy!;
    this.moveToward(enemy, LAKE_CENTER.x, CIRCLE_HEIGHT + 0.8, LAKE_CENTER.z, FLY_SPEED * dt);
    if (!this.summoned && this.moveT >= SUMMON_AT_S) {
      this.summoned = true;
      for (let i = 0; i < SUMMON_COUNT; i++) {
        const a = (i / SUMMON_COUNT) * Math.PI * 2;
        this.combat.spawnEnemy('mosquito', {
          x: enemy.x + Math.cos(a) * 1.5,
          z: enemy.z + Math.sin(a) * 1.5,
        });
      }
      console.log('[Boss] queen summoned minions');
    }
    if (this.moveT >= SUMMON_TOTAL_S) this.nextMove();
  }

  private nextMove() {
    if (this.pendingSummon) {
      this.pendingSummon = false;
      this.summoned = false;
      this.move = { kind: 'summon' };
      this.moveT = 0;
      return;
    }
    const script = PHASE_SCRIPTS[this.phase];
    this.scriptIndex = (this.scriptIndex + 1) % script.length;
    this.move = script[this.scriptIndex];
    this.moveT = 0;
    if (this.move.kind === 'dive') {
      const target = this.pickDiveTarget();
      if (!target) {
        // Nobody in reach of a dive — keep circling instead of stalling.
        this.move = { kind: 'circle', seconds: 1.5 };
        return;
      }
      this.diveTarget = { x: target.x, z: target.z };
      this.diveStage = 'telegraph';
    }
  }

  private pickDiveTarget(): PlayerState | null {
    const enemy = this.enemy!;
    let best: PlayerState | null = null;
    let bestDist = Infinity;
    this.combat.room.state.players.forEach((player) => {
      if (player.mode !== 'plaza' || player.dead) return;
      if (this.combat.isInSafeZone(player.x, player.z)) return;
      const d = Math.hypot(player.x - enemy.x, player.z - enemy.z);
      if (d < bestDist) {
        bestDist = d;
        best = player;
      }
    });
    return best;
  }

  // --- Damage / phases / defeat ---------------------------------------------

  onDamaged(bySessionId: string, damage: number) {
    const enemy = this.enemy;
    if (!enemy) return;
    enemy.hp = Math.max(0, enemy.hp - damage);
    this.combat.room.broadcast('enemy_hit', { enemyId: BOSS_ID, by: bySessionId, damage });

    const attacker = this.combat.room.state.players.get(bySessionId);
    if (attacker) {
      const entry = this.tally.get(bySessionId) ?? { name: attacker.name, damage: 0 };
      entry.damage += damage;
      this.tally.set(bySessionId, entry);
    }

    if (enemy.hp <= 0) {
      this.defeat(bySessionId);
      return;
    }

    const fraction = enemy.hp / enemy.maxHp;
    const newPhase = fraction <= PHASE3_FRACTION ? 3 : fraction <= PHASE2_FRACTION ? 2 : 1;
    if (newPhase <= this.phase) return;
    if (this.phase < 2 && newPhase >= 2) this.pendingSummon = true;
    this.phase = newPhase;
    enemy.phase = newPhase;
    this.combat.announce(
      newPhase === 2
        ? '👑 A Rainha está furiosa e chama suas filhas!'
        : '👑 A Rainha entrou em fúria total!'
    );
    this.combat.room.broadcast('boss_event', { type: 'phase', phase: newPhase });
    console.log(`[Boss] queen entered phase ${newPhase}`);
  }

  private defeat(bySessionId: string) {
    const enemy = this.enemy!;
    this.combat.removeEnemyEntry(BOSS_ID);
    this.combat.room.broadcast('enemy_died', { enemyId: BOSS_ID, by: bySessionId, xp: 0 });
    this.combat.spawnCoinBurst(enemy.x, enemy.z, COIN_BURST);

    const contributors: string[] = [];
    const names: string[] = [];
    this.tally.forEach((entry, sessionId) => {
      if (!this.combat.room.state.players.has(sessionId)) return;
      this.combat.awardXpTo(sessionId, SHARED_XP);
      contributors.push(sessionId);
      names.push(entry.name);
    });

    this.combat.announce(
      `👑 A Muriçoca Rainha foi derrotada por ${names.join(', ') || 'ninguém?!'} — +${SHARED_XP} XP para quem lutou!`
    );
    this.combat.room.broadcast('boss_event', {
      type: 'defeated',
      xp: SHARED_XP,
      contributors,
    });
    console.log(`[Boss] Muriçoca Rainha defeated (${contributors.length} contributors)`);
    this.resetAfterFight();
  }

  // --- Helpers --------------------------------------------------------------

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
}
