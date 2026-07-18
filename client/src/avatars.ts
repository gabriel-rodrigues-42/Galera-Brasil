import * as THREE from 'three';
import { makeNameTagTexture, makeChatBubbleTexture } from './textures';
import type { RemotePlayerState } from './network';

const BUBBLE_DURATION = 4.5; // seconds

function shortestAngleLerp(from: number, to: number, t: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

interface RemoteAvatar {
  group: THREE.Group;
  nameSprite: THREE.Sprite;
  bubbleSprite: THREE.Sprite | null;
  bubbleExpiresAt: number;
  targetPos: THREE.Vector3;
  targetRotY: number;
  /** Held weapon prop (created lazily on the first attack we see). */
  prop: THREE.Group | null;
  propWeapon: 'vassoura' | 'chinelo' | null;
  propReinforced: boolean;
  /** Seconds into the swing animation; -1 while idle. */
  attackT: number;
}

const ATTACK_SWING_DURATION = 0.35;

function buildWeaponProp(weapon: 'vassoura' | 'chinelo', reinforced = false): THREE.Group {
  const group = new THREE.Group();
  if (weapon === 'vassoura') {
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
  } else {
    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.03, 0.3),
      new THREE.MeshStandardMaterial({ color: reinforced ? 0x2450a8 : 0x2a6bd4, roughness: 0.8 })
    );
    group.add(sole);
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.015, 0.03),
      new THREE.MeshStandardMaterial({ color: reinforced ? 0xffcf5c : 0xf4f1e8, roughness: 0.8 })
    );
    strap.position.set(0, 0.03, -0.05);
    strap.rotation.x = 0.4;
    sole.add(strap);
  }
  // Held at the avatar's right "hand", pointing forward-ish.
  group.position.set(0.42, 1.05, 0.1);
  group.rotation.set(0.4, 0, -0.3);
  return group;
}

function disposeProp(prop: THREE.Group) {
  prop.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      (obj.material as THREE.Material)?.dispose?.();
    }
  });
}

/** Deterministic pastel-ish color per session so each friend reads as a
 * distinct avatar without needing a color picker in the UI. */
function colorForSession(sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) hash = (hash * 31 + sessionId.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

export class AvatarManager {
  private avatars = new Map<string, RemoteAvatar>();
  private scene: THREE.Scene;
  private getHubOrigin: (hubId: string) => THREE.Vector3 | null;

  /** `getHubOrigin` resolves a hub owner's name to that hub's private
   * interior world-offset — a remote player's rendered position depends on
   * their *own* reported mode and, in hub mode, *which* friend's hub they're
   * in, since every hub is a separate pocket of the same world. */
  constructor(scene: THREE.Scene, getHubOrigin: (hubId: string) => THREE.Vector3 | null) {
    this.scene = scene;
    this.getHubOrigin = getHubOrigin;
  }

  private resolveWorldPos(state: RemotePlayerState, out: THREE.Vector3): THREE.Vector3 {
    if (state.mode === 'hub') {
      const origin = this.getHubOrigin(state.hubId);
      if (origin) return out.set(origin.x + state.x, state.y, origin.z + state.z);
      // Hub not known to this client yet (e.g. a brand-new friend who just
      // joined) — park far away rather than misplacing them in the plaza.
      return out.set(state.x, state.y, 10_000);
    }
    return out.set(state.x, state.y, state.z);
  }

  add(sessionId: string, state: RemotePlayerState) {
    const color = colorForSession(sessionId);
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.9, 6, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    );
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);

    const nameTexture = makeNameTagTexture(state.name, color);
    const nameSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: nameTexture, depthTest: false })
    );
    nameSprite.scale.set(1.1, 0.275, 1);
    nameSprite.position.y = 2.05;
    nameSprite.renderOrder = 10;
    group.add(nameSprite);

    const worldPos = this.resolveWorldPos(state, new THREE.Vector3());
    group.position.copy(worldPos);
    group.rotation.y = state.rotY;
    this.scene.add(group);

    if (state.isGhost) {
      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mat = mesh.material as THREE.Material;
          mat.transparent = true;
          mat.opacity = 0.35;
          mat.needsUpdate = true;
        }
      });
    }

    this.avatars.set(sessionId, {
      group,
      nameSprite,
      bubbleSprite: null,
      bubbleExpiresAt: 0,
      targetPos: worldPos.clone(),
      targetRotY: state.rotY,
      prop: null,
      propWeapon: null,
      propReinforced: false,
      attackT: -1,
    });
  }

  /** Show this avatar swinging/throwing — triggered by the server's
   * attack_visual broadcast. The weapon prop stays in hand afterwards. */
  playAttack(sessionId: string, weapon: 'vassoura' | 'chinelo', reinforced = false) {
    const avatar = this.avatars.get(sessionId);
    if (!avatar) return;
    if (
      avatar.propWeapon !== weapon ||
      (weapon === 'chinelo' && avatar.propReinforced !== reinforced)
    ) {
      if (avatar.prop) {
        avatar.group.remove(avatar.prop);
        disposeProp(avatar.prop);
      }
      avatar.prop = buildWeaponProp(weapon, reinforced);
      avatar.group.add(avatar.prop);
      avatar.propWeapon = weapon;
      avatar.propReinforced = reinforced;
    }
    avatar.attackT = 0;
  }

  getPosition(sessionId: string): THREE.Vector3 | null {
    return this.avatars.get(sessionId)?.group.position ?? null;
  }

  updateTarget(sessionId: string, state: RemotePlayerState) {
    const avatar = this.avatars.get(sessionId);
    if (!avatar) return;
    this.resolveWorldPos(state, avatar.targetPos);
    avatar.targetRotY = state.rotY;

    // Apply ghost transparency
    avatar.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = mesh.material as THREE.Material;
        mat.transparent = !!state.isGhost;
        mat.opacity = state.isGhost ? 0.35 : 1.0;
        mat.needsUpdate = true;
      }
    });
  }

  remove(sessionId: string) {
    const avatar = this.avatars.get(sessionId);
    if (!avatar) return;
    this.scene.remove(avatar.group);
    avatar.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        obj.material?.dispose?.();
        (obj as THREE.Mesh).geometry?.dispose?.();
      }
    });
    this.avatars.delete(sessionId);
  }

  showChatBubble(sessionId: string, text: string, now: number) {
    const avatar = this.avatars.get(sessionId);
    if (!avatar) return;
    if (avatar.bubbleSprite) {
      avatar.group.remove(avatar.bubbleSprite);
      avatar.bubbleSprite.material.map?.dispose();
      avatar.bubbleSprite.material.dispose();
    }
    const texture = makeChatBubbleTexture(text);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.set(1.4, 0.35, 1);
    sprite.position.y = 2.45;
    sprite.renderOrder = 11;
    avatar.group.add(sprite);
    avatar.bubbleSprite = sprite;
    avatar.bubbleExpiresAt = now + BUBBLE_DURATION;
  }

  /** Smoothly interpolate every remote avatar toward its latest known
   * transform and expire chat bubbles — call once per frame. */
  update(delta: number, now: number) {
    const t = 1 - Math.pow(0.001, delta); // framerate-independent smoothing factor
    for (const avatar of this.avatars.values()) {
      avatar.group.position.lerp(avatar.targetPos, t);
      avatar.group.rotation.y = shortestAngleLerp(avatar.group.rotation.y, avatar.targetRotY, t);

      if (avatar.bubbleSprite && now > avatar.bubbleExpiresAt) {
        avatar.group.remove(avatar.bubbleSprite);
        avatar.bubbleSprite.material.map?.dispose();
        avatar.bubbleSprite.material.dispose();
        avatar.bubbleSprite = null;
      }

      if (avatar.attackT >= 0 && avatar.prop) {
        avatar.attackT += delta;
        const p = Math.min(1, avatar.attackT / ATTACK_SWING_DURATION);
        avatar.prop.rotation.x = 0.4 - Math.sin(p * Math.PI) * 1.4;
        if (p >= 1) {
          avatar.attackT = -1;
          avatar.prop.rotation.x = 0.4;
        }
      }
    }
  }

  get count(): number {
    return this.avatars.size;
  }
}
