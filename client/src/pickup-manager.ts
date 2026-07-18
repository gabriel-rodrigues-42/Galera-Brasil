import * as THREE from 'three';
import type { PickupNetState } from './network';
import { disposeObject3D } from './hub-manager';

interface PickupRecord {
  group: THREE.Group;
  targetPos: THREE.Vector3;
  spinPhase: number;
}

function buildCoin(): THREE.Group {
  const group = new THREE.Group();

  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18),
    new THREE.MeshStandardMaterial({
      color: 0xffcf5c,
      emissive: 0x5a3a00,
      emissiveIntensity: 0.5,
      metalness: 0.75,
      roughness: 0.25,
    })
  );
  coin.rotation.z = Math.PI / 2;
  coin.castShadow = true;
  group.add(coin);

  const center = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 16),
    new THREE.MeshStandardMaterial({ color: 0xffefb2, roughness: 0.4 })
  );
  center.rotation.y = Math.PI / 2;
  group.add(center);

  return group;
}

/** Renders server-owned pickup drops (coins) and keeps their visuals lively. */
export class PickupManager {
  private pickups = new Map<string, PickupRecord>();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  add(pickupId: string, state: PickupNetState) {
    if (this.pickups.has(pickupId)) return;
    const group = buildCoin();
    group.position.set(state.x, state.y, state.z);
    this.scene.add(group);
    this.pickups.set(pickupId, {
      group,
      targetPos: new THREE.Vector3(state.x, state.y, state.z),
      spinPhase: Math.random() * Math.PI * 2,
    });
  }

  updateTarget(pickupId: string, state: PickupNetState) {
    const pickup = this.pickups.get(pickupId);
    if (!pickup) return;
    pickup.targetPos.set(state.x, state.y, state.z);
  }

  remove(pickupId: string) {
    const pickup = this.pickups.get(pickupId);
    if (!pickup) return;
    this.pickups.delete(pickupId);
    this.scene.remove(pickup.group);
    disposeObject3D(pickup.group);
  }

  update(delta: number, time: number) {
    const t = 1 - Math.pow(0.001, delta);
    for (const pickup of this.pickups.values()) {
      pickup.group.position.lerp(pickup.targetPos, t);
      pickup.group.rotation.y += delta * 4.8;
      pickup.group.position.y = pickup.targetPos.y + Math.sin(time * 3.2 + pickup.spinPhase) * 0.08;
    }
  }

  get count(): number {
    return this.pickups.size;
  }
}
