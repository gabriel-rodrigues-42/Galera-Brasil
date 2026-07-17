import * as THREE from 'three';
import { buildHub, ROOM_HALF, type BuiltHub } from './hub-builder';
import type { HubDescription } from './hub-types';
import * as api from './api';
import { log } from './logger';

const RING_BASE_RADIUS = 20;
const RING_RADIUS_STEP = 15;
const HUBS_PER_RING = 16;
const INTERIOR_SPACING = 40; // world-units between each hub's private interior pocket
const INTERIOR_Z = 300; // far beyond the plaza's fog draw distance
const ENTRANCE_RADIUS = 2;

const FACADE_COLORS = [
  0xe07a5f, 0x81b29a, 0xf2cc8f, 0x3d405b, 0xe8a798, 0xffb997, 0x8ecae6, 0xc9ada7,
];

// Shared geometries to minimize draw calls and conserve memory
const facadeBodyGeometry = new THREE.BoxGeometry(3, 2.4, 3);
const facadeRoofGeometry = new THREE.ConeGeometry(2.4, 1.1, 4);
const doorFrameGeometry = new THREE.BoxGeometry(0.9, 1.55, 0.08);
const doorPanelGeometry = new THREE.BoxGeometry(0.8, 1.5, 0.05);
const doorknobGeometry = new THREE.SphereGeometry(0.04, 8, 8);

// Shared materials to minimize draw calls and conserve memory
const facadeRoofMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.8 });
const doorFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });
const doorPanelMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
const doorknobMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.8,
  roughness: 0.2,
});

export interface HubFacade {
  owner: string;
  tag: string;
  slot: number;
  entrancePoint: { x: number; z: number };
  interiorOrigin: THREE.Vector3;
  built: BuiltHub | null;
}

export { ROOM_HALF };

export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh & THREE.Sprite;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const mat of materials) {
      const map = (mat as THREE.MeshStandardMaterial).map;
      map?.dispose();
      mat.dispose();
    }
  });
}

/** Each registered friend gets a facade in the praça's outer ring and a
 * private interior "pocket" far away in world-space (so many hubs can exist
 * without their 9x9 rooms overlapping) — the multi-hub heart of Phase 2. */
export class HubManager {
  private scene: THREE.Scene;
  private hubs = new Map<string, HubFacade>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private ringPosition(slot: number): { x: number; z: number; angle: number } {
    const ring = RING_BASE_RADIUS + Math.floor(slot / HUBS_PER_RING) * RING_RADIUS_STEP;
    const angle = ((slot % HUBS_PER_RING) / HUBS_PER_RING) * Math.PI * 2;
    return { x: Math.sin(angle) * ring, z: Math.cos(angle) * ring, angle };
  }

  private interiorOriginFor(slot: number): THREE.Vector3 {
    return new THREE.Vector3(slot * INTERIOR_SPACING, 0, INTERIOR_Z);
  }

  private makeFacade(color: number, rotation: number): THREE.Group {
    const group = new THREE.Group();

    // House Body
    const body = new THREE.Mesh(
      facadeBodyGeometry,
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    );
    body.position.y = 1.2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Roof
    const roof = new THREE.Mesh(facadeRoofGeometry, facadeRoofMaterial);
    roof.position.y = 2.95;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // Door Frame
    const doorFrame = new THREE.Mesh(doorFrameGeometry, doorFrameMaterial);
    doorFrame.position.set(0, 0.775, 1.51);
    doorFrame.castShadow = true;
    doorFrame.receiveShadow = true;
    group.add(doorFrame);

    // Door Panel
    const doorPanel = new THREE.Mesh(doorPanelGeometry, doorPanelMaterial);
    doorPanel.position.set(0, 0.75, 1.52);
    doorPanel.castShadow = true;
    doorPanel.receiveShadow = true;
    group.add(doorPanel);

    // Doorknob
    const doorknob = new THREE.Mesh(doorknobGeometry, doorknobMaterial);
    doorknob.position.set(0.25, 0.75, 1.55);
    doorknob.castShadow = true;
    group.add(doorknob);

    group.rotation.y = rotation;
    return group;
  }

  private makeBeacon(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshStandardMaterial({
        color: 0xffcf5c,
        emissive: 0xffcf5c,
        emissiveIntensity: 0.8,
        roughness: 0.3,
      })
    );
  }

  addFacade(summary: api.HubSummary) {
    if (this.hubs.has(summary.owner)) return;

    const { x, z, angle } = this.ringPosition(summary.slot);
    const color = FACADE_COLORS[summary.slot % FACADE_COLORS.length];

    const facade = this.makeFacade(color, angle + Math.PI);
    facade.position.set(x, 0, z);
    this.scene.add(facade);

    const beacon = this.makeBeacon();
    beacon.position.set(x, 3.6, z);
    this.scene.add(beacon);

    this.hubs.set(summary.owner, {
      owner: summary.owner,
      tag: summary.tag,
      slot: summary.slot,
      entrancePoint: { x, z: z - 2.5 },
      interiorOrigin: this.interiorOriginFor(summary.slot),
      built: null,
    });
    log('info', `hub facade added: "${summary.owner}" at slot ${summary.slot}`);
  }

  async refreshList(): Promise<void> {
    const list = await api.listHubs();
    for (const summary of list) this.addFacade(summary);
  }

  /** Idempotent — creates the hub server-side on first call for a name,
   * returns the existing one otherwise. Called right after a successful
   * room join so a brand-new friend's facade appears immediately. */
  async ensureOwnHub(owner: string): Promise<void> {
    const record = await api.claimHub(owner);
    this.addFacade(record);
  }

  findNearestEntrance(playerX: number, playerZ: number): HubFacade | null {
    for (const hub of this.hubs.values()) {
      const dx = playerX - hub.entrancePoint.x;
      const dz = playerZ - hub.entrancePoint.z;
      if (Math.hypot(dx, dz) < ENTRANCE_RADIUS) return hub;
    }
    return null;
  }

  originFor(owner: string): THREE.Vector3 | null {
    return this.hubs.get(owner)?.interiorOrigin ?? null;
  }

  getBuilt(owner: string): BuiltHub | null {
    return this.hubs.get(owner)?.built ?? null;
  }

  /** Fetches and builds a hub's interior on first visit, then caches it. */
  async enter(owner: string): Promise<BuiltHub | null> {
    const hub = this.hubs.get(owner);
    if (!hub) return null;
    if (!hub.built) {
      const record = await api.getHub(owner);
      const description: HubDescription = {
        owner: record.owner,
        bio: record.bio,
        tag: record.tag,
        posts: record.posts,
      };
      hub.built = buildHub(description);
      hub.built.group.position.copy(hub.interiorOrigin);
      this.scene.add(hub.built.group);
      log('info', `hub interior built: "${owner}" (${record.posts.length} posts)`);
    }
    return hub.built;
  }

  /** Tears down and refetches a hub's interior — used after adding a post so
   * the owner sees it appear without needing to leave and re-enter. */
  async rebuild(owner: string): Promise<BuiltHub | null> {
    const hub = this.hubs.get(owner);
    if (!hub) return null;
    if (hub.built) {
      this.scene.remove(hub.built.group);
      disposeObject3D(hub.built.group);
      hub.built = null;
    }
    return this.enter(owner);
  }
}
