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
  private hubOrigin: THREE.Vector3;

  /** `hubOrigin` is the world-space offset of the shared hub interior — a
   * remote player's rendered position depends on their *own* reported mode,
   * since "plaza" and "hub" are different regions of the same world. */
  constructor(scene: THREE.Scene, hubOrigin: THREE.Vector3) {
    this.scene = scene;
    this.hubOrigin = hubOrigin;
  }

  private resolveWorldPos(state: RemotePlayerState, out: THREE.Vector3): THREE.Vector3 {
    if (state.mode === 'hub') {
      return out.set(this.hubOrigin.x + state.x, state.y, this.hubOrigin.z + state.z);
    }
    return out.set(state.x, state.y, state.z);
  }

  add(sessionId: string, state: RemotePlayerState) {
    const color = colorForSession(sessionId);
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.9, 6, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);

    const nameTexture = makeNameTagTexture(state.name, color);
    const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTexture, depthTest: false }));
    nameSprite.scale.set(1.1, 0.275, 1);
    nameSprite.position.y = 2.05;
    nameSprite.renderOrder = 10;
    group.add(nameSprite);

    const worldPos = this.resolveWorldPos(state, new THREE.Vector3());
    group.position.copy(worldPos);
    group.rotation.y = state.rotY;
    this.scene.add(group);

    this.avatars.set(sessionId, {
      group,
      nameSprite,
      bubbleSprite: null,
      bubbleExpiresAt: 0,
      targetPos: worldPos.clone(),
      targetRotY: state.rotY,
    });
  }

  updateTarget(sessionId: string, state: RemotePlayerState) {
    const avatar = this.avatars.get(sessionId);
    if (!avatar) return;
    this.resolveWorldPos(state, avatar.targetPos);
    avatar.targetRotY = state.rotY;
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
    }
  }

  get count(): number {
    return this.avatars.size;
  }
}
