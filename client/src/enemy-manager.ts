import * as THREE from 'three';
import { disposeObject3D } from './hub-manager';
import type { EnemyNetState } from './network';

const DEATH_ANIM_DURATION = 0.6; // seconds — spiral-fall + shrink before dispose
const FLASH_DURATION = 0.12; // seconds of white hit-flash
const BUZZ_AMPLITUDE = 0.12; // client-only erratic jitter layered over server pos

interface EnemyRecord {
  group: THREE.Group;
  /** Inner group carrying the visible body — jitter/orientation happen here so
   * `group.position` stays the clean lerped network position. */
  body: THREE.Group;
  kind: string;
  bodyMaterial: THREE.MeshStandardMaterial;
  wingLeft: THREE.Mesh | null;
  wingRight: THREE.Mesh | null;
  hpSprite: THREE.Sprite;
  hpCanvas: HTMLCanvasElement;
  hpTexture: THREE.CanvasTexture;
  targetPos: THREE.Vector3;
  lastHpFraction: number;
  buzzPhase: number;
  flashUntil: number;
}

interface DyingRecord {
  group: THREE.Group;
  t: number;
}

function drawHpBar(canvas: HTMLCanvasElement, texture: THREE.CanvasTexture, fraction: number) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 6);
  ctx.fill();
  ctx.fillStyle = fraction > 0.5 ? '#7ed957' : fraction > 0.25 ? '#ffcf5c' : '#e0524d';
  ctx.beginPath();
  ctx.roundRect(2, 2, Math.max(0, (canvas.width - 4) * fraction), canvas.height - 4, 4);
  ctx.fill();
  texture.needsUpdate = true;
}

function buildMosquito(): {
  body: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  wingLeft: THREE.Mesh | null;
  wingRight: THREE.Mesh | null;
} {
  const body = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.7 });
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bodyMaterial);
  abdomen.scale.set(1, 0.75, 1.4);
  body.add(abdomen);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), bodyMaterial);
  head.position.set(0, 0.02, -0.16);
  body.add(head);

  // Proboscis — the pointy bit every Brazilian knows too well.
  const proboscis = new THREE.Mesh(
    new THREE.ConeGeometry(0.015, 0.22, 6),
    new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.5 })
  );
  proboscis.rotation.x = -Math.PI / 2;
  proboscis.position.set(0, 0, -0.3);
  body.add(proboscis);

  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xdfeaf2,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.3,
  });
  const wingGeo = new THREE.PlaneGeometry(0.2, 0.09);
  // translate so the wing rotates around its root (attached to the body)
  wingGeo.translate(0.1, 0, 0);

  const wingLeft = new THREE.Mesh(wingGeo, wingMaterial);
  wingLeft.position.set(-0.04, 0.09, 0);
  wingLeft.rotation.z = Math.PI; // mirror to the left side
  body.add(wingLeft);

  const wingRight = new THREE.Mesh(wingGeo, wingMaterial);
  wingRight.position.set(0.04, 0.09, 0);
  body.add(wingRight);

  return { body, bodyMaterial, wingLeft, wingRight };
}

function buildBarata(): {
  body: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  wingLeft: THREE.Mesh | null;
  wingRight: THREE.Mesh | null;
} {
  const body = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), bodyMaterial);
  shell.scale.set(1.2, 0.55, 1.5);
  body.add(shell);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), bodyMaterial);
  head.position.set(0, 0.02, -0.23);
  body.add(head);

  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.9 })
    );
    const z = -0.14 + i * 0.14;
    leg.position.set(0.15, -0.05, z);
    leg.rotation.z = -0.9;
    body.add(leg);

    const legR = leg.clone();
    legR.position.x = -0.15;
    legR.rotation.z = 0.9;
    body.add(legR);
  }

  return { body, bodyMaterial, wingLeft: null, wingRight: null };
}

function buildPombo(): {
  body: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  wingLeft: THREE.Mesh | null;
  wingRight: THREE.Mesh | null;
} {
  const body = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x79808c, roughness: 0.7 });
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), bodyMaterial);
  chest.scale.set(1.1, 1, 1.35);
  body.add(chest);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a7480, roughness: 0.6 })
  );
  neck.position.set(0, 0.08, -0.14);
  neck.rotation.x = Math.PI / 2;
  body.add(neck);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.11, 8),
    new THREE.MeshStandardMaterial({ color: 0xd9a03a, roughness: 0.7 })
  );
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.08, -0.26);
  body.add(beak);

  const wingGeo = new THREE.BoxGeometry(0.25, 0.03, 0.18);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x667080, roughness: 0.75 });
  const wingLeft = new THREE.Mesh(wingGeo, wingMat);
  wingLeft.position.set(-0.2, 0.02, 0);
  wingLeft.rotation.z = 0.35;
  body.add(wingLeft);

  const wingRight = new THREE.Mesh(wingGeo, wingMat);
  wingRight.position.set(0.2, 0.02, 0);
  wingRight.rotation.z = -0.35;
  body.add(wingRight);

  return { body, bodyMaterial, wingLeft, wingRight };
}

function buildMuricocaRainha(): {
  body: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  wingLeft: THREE.Mesh | null;
  wingRight: THREE.Mesh | null;
} {
  // A mosquito scaled to royalty: ~3x the body, dark crimson, golden crown.
  const base = buildMosquito();
  base.body.scale.setScalar(3.1);
  base.bodyMaterial.color.setHex(0x5a2330);
  base.bodyMaterial.roughness = 0.6;

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.095, 0.07, 8, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xffcf5c,
      emissive: 0x6b4d00,
      roughness: 0.35,
      side: THREE.DoubleSide,
    })
  );
  crown.position.set(0, 0.1, -0.16); // atop the head, before the group scale
  base.body.add(crown);

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe0524d,
    emissive: 0x8a1a1a,
    roughness: 0.3,
  });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeMaterial);
    eye.position.set(side * 0.035, 0.045, -0.2);
    base.body.add(eye);
  }

  return base;
}

function buildEnemyByKind(kind: string) {
  if (kind === 'barata') return buildBarata();
  if (kind === 'pombo') return buildPombo();
  if (kind === 'muricoca_rainha') return buildMuricocaRainha();
  return buildMosquito();
}

/** Renders and animates the server-owned enemies (mosquitos): smoothing toward
 * network positions plus a purely cosmetic erratic buzz, flapping wings,
 * floating HP bars, hit flashes, and a spiral-fall death animation. Mirrors
 * the AvatarManager/NpcManager patterns. */
export class EnemyManager {
  private enemies = new Map<string, EnemyRecord>();
  private dying: DyingRecord[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  add(enemyId: string, state: EnemyNetState) {
    const group = new THREE.Group();
    const { body, bodyMaterial, wingLeft, wingRight } = buildEnemyByKind(state.kind);
    group.add(body);

    const hpCanvas = document.createElement('canvas');
    hpCanvas.width = 64;
    hpCanvas.height = 10;
    const hpTexture = new THREE.CanvasTexture(hpCanvas);
    drawHpBar(hpCanvas, hpTexture, 1);
    const hpSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: hpTexture, depthTest: false })
    );
    if (state.kind === 'muricoca_rainha') {
      hpSprite.scale.set(1.5, 0.16, 1);
      hpSprite.position.y = 1.35;
      hpSprite.visible = true; // the queen's bar is always on display
    } else {
      hpSprite.scale.set(0.55, 0.09, 1);
      hpSprite.position.y = 0.38;
      hpSprite.visible = false; // only shown once damaged
    }
    hpSprite.renderOrder = 10;
    group.add(hpSprite);

    group.position.set(state.x, state.y, state.z);
    this.scene.add(group);

    this.enemies.set(enemyId, {
      group,
      body,
      kind: state.kind,
      bodyMaterial,
      wingLeft,
      wingRight,
      hpSprite,
      hpCanvas,
      hpTexture,
      targetPos: new THREE.Vector3(state.x, state.y, state.z),
      lastHpFraction: 1,
      buzzPhase: Math.random() * Math.PI * 2,
      flashUntil: 0,
    });
  }

  updateTarget(enemyId: string, state: EnemyNetState) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return;
    enemy.targetPos.set(state.x, state.y, state.z);

    const fraction = state.maxHp > 0 ? state.hp / state.maxHp : 0;
    if (fraction !== enemy.lastHpFraction) {
      enemy.lastHpFraction = fraction;
      enemy.hpSprite.visible = enemy.kind === 'muricoca_rainha' || fraction < 1;
      drawHpBar(enemy.hpCanvas, enemy.hpTexture, Math.max(0, fraction));
    }
  }

  /** Removes the enemy from live tracking and plays the death animation
   * before disposing — used for both kills and GM clears. */
  remove(enemyId: string) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return;
    this.enemies.delete(enemyId);
    enemy.hpSprite.visible = false;
    this.dying.push({ group: enemy.group, t: 0 });
  }

  /** Brief white flash when a hit lands — driven by the server's enemy_hit. */
  flash(enemyId: string, now: number) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return;
    enemy.flashUntil = now + FLASH_DURATION;
    enemy.bodyMaterial.emissive.setHex(0xffffff);
    enemy.bodyMaterial.emissiveIntensity = 0.9;
  }

  getPosition(enemyId: string): THREE.Vector3 | null {
    return this.enemies.get(enemyId)?.group.position ?? null;
  }

  /** World positions of all live enemies — used by the predicted projectile
   * to disappear on contact instead of flying through a mosquito. */
  forEachPosition(fn: (pos: THREE.Vector3, kind: string) => void) {
    for (const enemy of this.enemies.values()) fn(enemy.group.position, enemy.kind);
  }

  update(delta: number, time: number) {
    const t = 1 - Math.pow(0.001, delta); // framerate-independent smoothing

    for (const enemy of this.enemies.values()) {
      const prevX = enemy.group.position.x;
      const prevZ = enemy.group.position.z;
      enemy.group.position.lerp(enemy.targetPos, t);

      // Fast erratic movement, stronger for mosquitos and softer for heavier kinds.
      const p = enemy.buzzPhase;
      const buzz =
        enemy.kind === 'mosquito'
          ? BUZZ_AMPLITUDE
          : enemy.kind === 'pombo'
            ? 0.08
            : enemy.kind === 'muricoca_rainha'
              ? 0.06
              : 0.04;
      enemy.body.position.set(
        Math.sin(time * 9 + p) * buzz,
        Math.sin(time * 13 + p * 2) * buzz,
        Math.cos(time * 11 + p) * buzz
      );

      if (enemy.wingRight && enemy.wingLeft) {
        const base = enemy.kind === 'pombo' ? 0.2 : 0.4;
        const speed = enemy.kind === 'pombo' ? 16 : 40;
        const amp = enemy.kind === 'pombo' ? 0.45 : 0.9;
        const flap = base + Math.abs(Math.sin(time * speed + p)) * amp;
        if (enemy.kind === 'pombo') {
          enemy.wingRight.rotation.z = -flap;
          enemy.wingLeft.rotation.z = flap;
        } else {
          enemy.wingRight.rotation.z = flap;
          enemy.wingLeft.rotation.z = Math.PI - flap;
        }
      }

      // Face the direction of travel (the -Z proboscis leads the way).
      const moveX = enemy.group.position.x - prevX;
      const moveZ = enemy.group.position.z - prevZ;
      if (Math.hypot(moveX, moveZ) > 0.0005) {
        enemy.body.rotation.y = Math.atan2(-moveX, -moveZ);
      }

      if (enemy.flashUntil > 0 && time > enemy.flashUntil) {
        enemy.flashUntil = 0;
        enemy.bodyMaterial.emissive.setHex(0x000000);
        enemy.bodyMaterial.emissiveIntensity = 1;
      }
    }

    // Death animations: spiral down, shrink, then dispose.
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.t += delta;
      const progress = Math.min(1, d.t / DEATH_ANIM_DURATION);
      d.group.rotation.y += delta * 14;
      d.group.rotation.z = progress * Math.PI * 0.5;
      d.group.position.y = Math.max(0.05, d.group.position.y - delta * 2.5);
      d.group.scale.setScalar(1 - progress * 0.8);
      if (progress >= 1) {
        this.scene.remove(d.group);
        disposeObject3D(d.group);
        this.dying.splice(i, 1);
      }
    }
  }

  get count(): number {
    return this.enemies.size;
  }
}
