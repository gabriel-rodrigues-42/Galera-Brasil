import * as THREE from 'three';
import type {
  Network,
  WeaponId,
  SelfState,
  AttackVisualEvent,
  EnemyHitEvent,
  EnemyDiedEvent,
  PlayerHitEvent,
  BonkEvent,
  BossEvent,
} from './network';
import type { EnemyManager } from './enemy-manager';
import type { AvatarManager } from './avatars';
import type { Hud } from './hud';
import { RadioManager } from './radio-manager';
import { log } from './logger';

// Client-side cooldowns mirror the server's (server/src/rooms/combat.ts) so a
// spam-click never sends attacks the server would reject anyway.
const COOLDOWN_MS: Record<WeaponId, number> = { vassoura: 400, chinelo: 700 };
// Projectile physics constants MUST match the server so the predicted chinelo
// lands where the server says it lands.
const PROJECTILE_SPEED = 16;
const PROJECTILE_GRAVITY = 6;
const PROJECTILE_TTL = 2.0;
const PROJECTILE_HIT_RADIUS = 0.7;
const SWING_DURATION = 0.25;
const THROW_HIDE_DURATION = 0.45;
const BONK_IMPULSE = 6;
const BONK_STAR_TTL = 0.7;
const HIT_PARTICLE_TTL = 0.24;
const DAMAGE_FLOAT_TTL = 0.6;

interface FlyingChinelo {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  ttl: number;
  /** Locally predicted (own throw) — vanishes on visual contact with an enemy;
   * damage still only comes from the server's simulation. */
  predicted: boolean;
}

interface BonkStar {
  sprite: THREE.Sprite;
  ttl: number;
}

interface HitParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  ttl: number;
}

interface DamageFloat {
  sprite: THREE.Sprite;
  texture: THREE.Texture;
  ttl: number;
}

interface CombatDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  network: Network;
  hud: Hud;
  enemyManager: EnemyManager;
  avatarManager: AvatarManager;
  /** Gate for firing attacks: locked pointer, plaza mode, no builder/panels. */
  canAttack: () => boolean;
  /** Gate for weapon switching (looser: allowed even near panels-closed edge cases). */
  canSwitch: () => boolean;
  /** main.ts movement velocity (camera-local axes) — bonk knockback pushes it. */
  velocity: THREE.Vector3;
  /** Teleport the local player back to the plaza spawn after respawning. */
  onRespawn: () => void;
}

function disposeMeshTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) material.dispose();
    }
  });
}

function makeChineloMeshVariant(reinforced: boolean): THREE.Mesh {
  const sole = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.03, 0.3),
    new THREE.MeshStandardMaterial({ color: reinforced ? 0x2450a8 : 0x2a6bd4, roughness: 0.8 })
  );
  const strap = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.015, 0.03),
    new THREE.MeshStandardMaterial({ color: reinforced ? 0xffcf5c : 0xf4f1e8, roughness: 0.8 })
  );
  strap.position.set(0, 0.03, -0.05);
  strap.rotation.x = 0.4;
  sole.add(strap);
  if (reinforced) {
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.01, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xffcf5c, emissive: 0x6b4d00, roughness: 0.4 })
    );
    badge.position.set(0, 0.022, 0.07);
    sole.add(badge);
  }
  sole.castShadow = true;
  return sole;
}

function makeVassouraModel(): THREE.Group {
  const group = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.85, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a5a2f, roughness: 0.9 })
  );
  handle.position.y = 0.3;
  group.add(handle);
  const bristles = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.2, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xd9b24a, roughness: 1 })
  );
  bristles.position.y = -0.2;
  group.add(bristles);
  return group;
}

function makeBonkStarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💥', 32, 36);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeDamageTextTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.strokeText(text, 110, 50);
  ctx.fillStyle = color;
  ctx.fillText(text, 110, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Client half of the battle system: weapon hotbar + first-person viewmodel,
 * attack input (crosshair action-aim), the predicted chinelo projectile,
 * remote players' projectiles, and all hit/death/bonk feedback. Every damage
 * number and HP value comes from the server — this class only renders. */
export class CombatManager {
  private currentWeapon: WeaponId = 'vassoura';
  private lastAttackAt: Record<WeaponId, number> = { vassoura: 0, chinelo: 0 };
  private _dead = false;

  private viewmodel = new THREE.Group();
  private vassouraModel: THREE.Group;
  private chineloModel: THREE.Mesh;
  private reinforcedChinelo = false;
  private swingT = -1; // -1 = idle, otherwise seconds into the swing
  private throwHideT = -1;

  private projectiles: FlyingChinelo[] = [];
  private bonkStars: BonkStar[] = [];
  private hitParticles: HitParticle[] = [];
  private damageFloats: DamageFloat[] = [];
  private bonkStarTexture: THREE.CanvasTexture | null = null;
  private lastKnownLevel = 0;

  private audioCtx: AudioContext | null = null;
  private audioOut: GainNode | null = null;
  private buzzOsc: OscillatorNode | null = null;
  private buzzGain: GainNode | null = null;

  private tmpOrigin = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();
  private deps: CombatDeps;

  constructor(deps: CombatDeps) {
    this.deps = deps;
    // First-person viewmodel: held weapon attached to the camera, bottom-right
    // like a classic FPS. The camera is already part of the scene graph
    // (scene.add(controls.object)), so children of it render normally.
    this.viewmodel.position.set(0.35, -0.32, -0.55);
    this.vassouraModel = makeVassouraModel();
    this.vassouraModel.rotation.set(0.5, 0.15, -0.3);
    this.chineloModel = makeChineloMeshVariant(false);
    this.chineloModel.rotation.set(0.9, 0.2, 0);
    this.chineloModel.visible = false;
    this.viewmodel.add(this.vassouraModel, this.chineloModel);
    deps.camera.add(this.viewmodel);

    window.addEventListener('mousedown', (e) => {
      if (!this.deps.canAttack()) return;
      if (e.button === 0) this.attack(this.currentWeapon);
      else if (e.button === 2) this.attack('chinelo'); // quick-throw, always
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Digit3') {
        if (!this.deps.canAttack()) return;
        this.deps.network.sendUseItem('suco_laranja');
        return;
      }
      if (!this.deps.canSwitch()) return;
      if (e.code === 'Digit1') this.setWeapon('vassoura');
      if (e.code === 'Digit2') this.setWeapon('chinelo');
    });

    window.addEventListener('wheel', (e) => {
      if (!this.deps.canSwitch()) return;
      if (e.deltaY === 0) return;
      this.setWeapon(this.currentWeapon === 'vassoura' ? 'chinelo' : 'vassoura');
    });

    this.deps.hud.setWeapon(this.currentWeapon);
  }

  get isDead(): boolean {
    return this._dead;
  }

  setWeapon(weapon: WeaponId) {
    if (weapon === this.currentWeapon) return;
    this.currentWeapon = weapon;
    this.vassouraModel.visible = weapon === 'vassoura';
    this.chineloModel.visible = weapon === 'chinelo' && this.throwHideT < 0;
    this.deps.hud.setWeapon(weapon);
  }

  private ensureAudio() {
    const radio = RadioManager.getInstance();
    radio.init();
    radio.resume();
    this.audioCtx = radio.audioCtx;
    this.audioOut = radio.sfxGain;

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    if (!this.buzzOsc && this.audioCtx && this.audioOut) {
      this.buzzOsc = this.audioCtx.createOscillator();
      this.buzzGain = this.audioCtx.createGain();
      this.buzzOsc.type = 'sawtooth';
      this.buzzOsc.frequency.value = 165;
      this.buzzGain.gain.value = 0;
      this.buzzOsc.connect(this.buzzGain);
      this.buzzGain.connect(this.audioOut);
      this.buzzOsc.start();
    }
  }

  private playTone(
    type: OscillatorType,
    fromHz: number,
    toHz: number,
    duration: number,
    volume: number
  ) {
    this.ensureAudio();
    if (!this.audioCtx || !this.audioOut) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const t = this.audioCtx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, fromHz), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.audioOut);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private playSwoosh() {
    this.playTone('triangle', 420, 170, 0.09, 0.07);
  }

  private playThrowWhoosh() {
    this.playTone('sawtooth', 300, 120, 0.12, 0.055);
  }

  private playSlap() {
    this.playTone('square', 180, 90, 0.065, 0.09);
  }

  private playBite() {
    this.playTone('sawtooth', 720, 340, 0.08, 0.08);
  }

  private playBonk() {
    this.playTone('square', 160, 75, 0.11, 0.08);
  }

  private playLevelUp() {
    this.playTone('triangle', 520, 660, 0.08, 0.07);
    window.setTimeout(() => this.playTone('triangle', 660, 860, 0.12, 0.08), 70);
  }

  private playBossRoar() {
    // Deep double drone — the queen announcing herself (or a new phase).
    this.playTone('sawtooth', 120, 55, 0.5, 0.11);
    window.setTimeout(() => this.playTone('sawtooth', 95, 50, 0.4, 0.09), 180);
  }

  private playBossImpact() {
    this.playTone('square', 90, 45, 0.18, 0.12);
  }

  private updateBuzzAudio(time: number) {
    if (!this.audioCtx || !this.buzzOsc || !this.buzzGain) return;
    let nearest = Infinity;
    this.deps.enemyManager.forEachPosition((pos) => {
      nearest = Math.min(nearest, this.deps.camera.position.distanceTo(pos));
    });
    const intensity = Number.isFinite(nearest)
      ? Math.max(0, Math.min(1, 1 - (nearest - 2.5) / 23))
      : 0;
    const targetGain = intensity * 0.06;
    this.buzzGain.gain.value += (targetGain - this.buzzGain.gain.value) * 0.12;
    this.buzzOsc.frequency.setValueAtTime(
      150 + Math.sin(time * 22) * 18 + intensity * 35,
      this.audioCtx.currentTime
    );
  }

  private attack(weapon: WeaponId) {
    const now = performance.now();
    if (now - this.lastAttackAt[weapon] < COOLDOWN_MS[weapon]) return;
    this.lastAttackAt[weapon] = now;

    this.deps.camera.getWorldPosition(this.tmpOrigin);
    this.deps.camera.getWorldDirection(this.tmpDir);
    this.deps.network.sendAttack(
      weapon,
      this.tmpOrigin.x,
      this.tmpOrigin.y,
      this.tmpOrigin.z,
      this.tmpDir.x,
      this.tmpDir.y,
      this.tmpDir.z
    );

    if (weapon === 'vassoura') {
      this.swingT = 0;
      this.playSwoosh();
    } else {
      // Predicted local chinelo: flies immediately at 60fps; the server's
      // 10 Hz sim decides the actual hit.
      this.spawnProjectile(this.tmpOrigin, this.tmpDir, true, this.reinforcedChinelo);
      if (this.currentWeapon === 'chinelo') {
        this.throwHideT = 0;
        this.chineloModel.visible = false;
      }
      this.playThrowWhoosh();
    }
  }

  private spawnProjectile(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    predicted: boolean,
    reinforced: boolean
  ) {
    const mesh = makeChineloMeshVariant(reinforced);
    // Start slightly ahead so the mesh doesn't clip through the camera.
    mesh.position.copy(origin).addScaledVector(dir, 0.5);
    this.deps.scene.add(mesh);
    this.projectiles.push({
      mesh,
      velocity: dir.clone().multiplyScalar(PROJECTILE_SPEED),
      ttl: PROJECTILE_TTL,
      predicted,
    });
  }

  private spawnHitParticles(worldPos: THREE.Vector3, color: number) {
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 })
      );
      mesh.position.copy(worldPos).add(new THREE.Vector3(0, 0.2, 0));
      this.deps.scene.add(mesh);
      const velocity = new THREE.Vector3(
        (Math.random() * 2 - 1) * 2.8,
        1.2 + Math.random() * 2.2,
        (Math.random() * 2 - 1) * 2.8
      );
      this.hitParticles.push({ mesh, velocity, ttl: HIT_PARTICLE_TTL + Math.random() * 0.06 });
    }
  }

  private showDamageFloat(worldPos: THREE.Vector3, amount: number, color: string) {
    const texture = makeDamageTextTexture(`-${amount}`, color);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        transparent: true,
      })
    );
    sprite.scale.set(0.92, 0.4, 1);
    sprite.position.copy(worldPos).add(new THREE.Vector3(0, 1.15, 0));
    sprite.renderOrder = 11;
    this.deps.scene.add(sprite);
    this.damageFloats.push({ sprite, texture, ttl: DAMAGE_FLOAT_TTL });
  }

  // --- Server event handlers (wired from main.ts) ---------------------------

  handleSelfState(state: SelfState) {
    if (this.lastKnownLevel > 0 && state.level > this.lastKnownLevel) {
      this.playLevelUp();
    }
    if (this.reinforcedChinelo !== state.reinforcedChinelo) {
      this.reinforcedChinelo = state.reinforcedChinelo;
      const next = makeChineloMeshVariant(state.reinforcedChinelo);
      next.rotation.copy(this.chineloModel.rotation);
      next.visible = this.chineloModel.visible;
      next.scale.copy(this.chineloModel.scale);
      this.viewmodel.remove(this.chineloModel);
      disposeMeshTree(this.chineloModel);
      this.chineloModel = next;
      this.viewmodel.add(this.chineloModel);
    }
    this.lastKnownLevel = state.level;
  }

  handleAttackVisual(event: AttackVisualEvent) {
    this.deps.avatarManager.playAttack(event.sessionId, event.weapon, event.reinforced);
    if (event.weapon === 'chinelo') {
      this.tmpOrigin.set(event.ox, event.oy, event.oz);
      this.tmpDir.set(event.dx, event.dy, event.dz);
      this.spawnProjectile(this.tmpOrigin, this.tmpDir, false, event.reinforced);
    }
  }

  handleEnemyHit(event: EnemyHitEvent, time: number) {
    this.deps.enemyManager.flash(event.enemyId, time);
    const pos = this.deps.enemyManager.getPosition(event.enemyId);
    if (pos) {
      const p = pos.clone();
      const local = event.by === this.deps.network.sessionId;
      this.spawnHitParticles(p, local ? 0xffcf5c : 0xe0524d);
      this.showDamageFloat(p, event.damage, local ? '#ffcf5c' : '#ffd6d0');
    }
    if (event.by === this.deps.network.sessionId) {
      this.deps.hud.flashHitmarker();
      this.playSlap();
    }
  }

  handleEnemyDied(event: EnemyDiedEvent) {
    // The schema onRemove also triggers the death animation; calling remove
    // twice is a harmless no-op, but this message carries who earned the XP.
    this.deps.enemyManager.remove(event.enemyId);
    if (event.by === this.deps.network.sessionId) {
      this.deps.hud.flashHitmarker();
      // Boss kills carry xp=0 here — the shared payout arrives via boss_event.
      if (event.xp > 0) this.deps.hud.showXpFloat(event.xp);
    }
  }

  handlePlayerHit(event: PlayerHitEvent) {
    if (event.sessionId !== this.deps.network.sessionId) return;
    this.deps.hud.flashDamage();
    if (
      event.by === 'mosquito' ||
      event.by === 'barata' ||
      event.by === 'pombo' ||
      event.by === 'muricoca_rainha'
    ) {
      this.deps.hud.shakeBite();
      this.playBite();
    }
  }

  handleBossEvent(event: BossEvent) {
    switch (event.type) {
      case 'spawn':
        this.playBossRoar();
        break;
      case 'phase':
        this.playBossRoar();
        this.deps.hud.shakeBite();
        break;
      case 'impact': {
        // Shake only if the slam landed near the local player.
        const dx = (event.x ?? 0) - this.deps.camera.position.x;
        const dz = (event.z ?? 0) - this.deps.camera.position.z;
        if (Math.hypot(dx, dz) < 12) {
          this.playBossImpact();
          this.deps.hud.shakeBite();
        }
        break;
      }
      case 'defeated':
        this.playLevelUp();
        if (event.contributors?.includes(this.deps.network.sessionId) && event.xp) {
          this.deps.hud.showXpFloat(event.xp);
        }
        break;
      case 'despawn':
        break;
    }
  }

  handleBonk(event: BonkEvent) {
    if (event.targetSessionId === this.deps.network.sessionId) {
      // Knockback: convert the world-space push into the camera-local axes
      // main.ts's velocity uses (x = strafe right, z = backward).
      const yaw = this.deps.camera.rotation.y;
      const right = event.dx * Math.cos(yaw) - event.dz * Math.sin(yaw);
      const forward = -event.dx * Math.sin(yaw) - event.dz * Math.cos(yaw);
      this.deps.velocity.x += right * BONK_IMPULSE;
      this.deps.velocity.z += -forward * BONK_IMPULSE;
      this.playBonk();
      log('info', 'bonk! levou uma chinelada');
      return;
    }
    const pos = this.deps.avatarManager.getPosition(event.targetSessionId);
    if (pos) this.showBonkStar(pos);
  }

  handleDied(respawnInMs: number) {
    this._dead = true;
    this.deps.hud.showDeath(respawnInMs);
    log('info', `player fainted — respawn in ${respawnInMs}ms`);
  }

  handleRespawned() {
    this._dead = false;
    this.deps.hud.hideDeath();
    this.deps.onRespawn();
    log('info', 'player respawned at plaza');
  }

  private showBonkStar(worldPos: THREE.Vector3) {
    this.bonkStarTexture ??= makeBonkStarTexture();
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.bonkStarTexture, depthTest: false, transparent: true })
    );
    sprite.scale.setScalar(0.7);
    sprite.position.copy(worldPos).add(new THREE.Vector3(0, 1.7, 0));
    sprite.renderOrder = 12;
    this.deps.scene.add(sprite);
    this.bonkStars.push({ sprite, ttl: BONK_STAR_TTL });
  }

  update(delta: number, time: number) {
    this.updateBuzzAudio(time);

    // Viewmodel idle bob + swing/throw animations
    this.viewmodel.position.y = -0.32 + Math.sin(time * 2.2) * 0.008;

    if (this.swingT >= 0) {
      this.swingT += delta;
      const p = Math.min(1, this.swingT / SWING_DURATION);
      this.vassouraModel.rotation.x = 0.5 - Math.sin(p * Math.PI) * 1.3;
      if (p >= 1) {
        this.swingT = -1;
        this.vassouraModel.rotation.x = 0.5;
      }
    }

    if (this.throwHideT >= 0) {
      this.throwHideT += delta;
      if (this.throwHideT >= THROW_HIDE_DURATION) {
        this.throwHideT = -1;
        if (this.currentWeapon === 'chinelo') {
          this.chineloModel.visible = true;
          this.chineloModel.scale.setScalar(0.01);
        }
      }
    } else if (this.chineloModel.visible && this.chineloModel.scale.x < 1) {
      // scale-in after the "new chinelo" reappears
      const s = Math.min(1, this.chineloModel.scale.x + delta * 5);
      this.chineloModel.scale.setScalar(s);
    }

    // Flying chinelos (both predicted-own and remote-visual)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.ttl -= delta;
      p.velocity.y -= PROJECTILE_GRAVITY * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.mesh.rotation.x += delta * 12; // tumbling flip-flop

      let gone = p.ttl <= 0 || p.mesh.position.y < 0;
      if (!gone && p.predicted) {
        // Vanish on visual contact so the prediction doesn't fly through a
        // mosquito the server is about to kill.
        this.deps.enemyManager.forEachPosition((enemyPos, kind) => {
          const radius = kind === 'muricoca_rainha' ? 1.6 : PROJECTILE_HIT_RADIUS;
          if (!gone && p.mesh.position.distanceTo(enemyPos) <= radius) gone = true;
        });
      }
      if (gone) {
        this.deps.scene.remove(p.mesh);
        disposeMeshTree(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // Bonk stars fade out
    for (let i = this.bonkStars.length - 1; i >= 0; i--) {
      const star = this.bonkStars[i];
      star.ttl -= delta;
      star.sprite.position.y += delta * 0.6;
      star.sprite.material.opacity = Math.max(0, star.ttl / BONK_STAR_TTL);
      if (star.ttl <= 0) {
        this.deps.scene.remove(star.sprite);
        star.sprite.material.dispose();
        this.bonkStars.splice(i, 1);
      }
    }

    // Hit particles burst and quickly fade.
    for (let i = this.hitParticles.length - 1; i >= 0; i--) {
      const part = this.hitParticles[i];
      part.ttl -= delta;
      part.velocity.y -= 8.5 * delta;
      part.mesh.position.addScaledVector(part.velocity, delta);
      const mat = part.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, part.ttl / HIT_PARTICLE_TTL);
      if (part.ttl <= 0) {
        this.deps.scene.remove(part.mesh);
        part.mesh.geometry.dispose();
        mat.dispose();
        this.hitParticles.splice(i, 1);
      }
    }

    // Floating damage numbers above enemies.
    for (let i = this.damageFloats.length - 1; i >= 0; i--) {
      const float = this.damageFloats[i];
      float.ttl -= delta;
      float.sprite.position.y += delta * 1.2;
      (float.sprite.material as THREE.SpriteMaterial).opacity = Math.max(
        0,
        float.ttl / DAMAGE_FLOAT_TTL
      );
      if (float.ttl <= 0) {
        this.deps.scene.remove(float.sprite);
        float.sprite.material.dispose();
        float.texture.dispose();
        this.damageFloats.splice(i, 1);
      }
    }
  }
}
