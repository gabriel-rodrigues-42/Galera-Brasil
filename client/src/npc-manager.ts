import * as THREE from 'three';
import { makeNameTagTexture } from './textures';

export interface NpcDef {
  id: 'robot' | 'joker' | 'romance';
  displayName: string;
  position: THREE.Vector3;
}

export const NPCS: NpcDef[] = [
  { id: 'robot', displayName: 'Robô da Net', position: new THREE.Vector3(-4, 0, 2) },
  { id: 'joker', displayName: 'Coringa do Feirão', position: new THREE.Vector3(4, 0, -1.5) },
  { id: 'romance', displayName: 'Cupido Solarpunk', position: new THREE.Vector3(0, 0, 4.5) },
];

export interface NpcInstance {
  def: NpcDef;
  group: THREE.Group;
  interactObject: THREE.Object3D;
  animate: (delta: number, time: number) => void;
}

export class NpcManager {
  private scene: THREE.Scene;
  private npcInstances: NpcInstance[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.init();
  }

  private init() {
    NPCS.forEach((def) => {
      const group = new THREE.Group();
      let interactObject: THREE.Object3D;
      let animateFn: (delta: number, time: number) => void = () => {};

      if (def.id === 'robot') {
        // --- Robot NPC visuals ---
        // Base Stand
        const stand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.35, 0.7, 12),
          new THREE.MeshStandardMaterial({ color: 0x3d405b, roughness: 0.5, metalness: 0.6 })
        );
        stand.position.y = 0.35;
        stand.castShadow = true;
        stand.receiveShadow = true;
        group.add(stand);

        // Hovering head group
        const headGroup = new THREE.Group();
        headGroup.position.y = 1.2;

        const body = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.3, metalness: 0.8 })
        );
        body.castShadow = true;
        headGroup.add(body);

        // Visor
        const visor = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.08, 0.2),
          new THREE.MeshStandardMaterial({
            color: 0x023e8a,
            emissive: 0x00d2ff,
            emissiveIntensity: 1.2,
            roughness: 0.1,
          })
        );
        visor.position.set(0, 0.05, 0.22);
        headGroup.add(visor);

        // Antenna
        const antPole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6),
          new THREE.MeshStandardMaterial({ color: 0x3d405b, roughness: 0.5 })
        );
        antPole.position.y = 0.42;
        headGroup.add(antPole);

        const antTip = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshStandardMaterial({
            color: 0xffcf5c,
            emissive: 0xffcf5c,
            emissiveIntensity: 0.8,
          })
        );
        antTip.position.y = 0.55;
        headGroup.add(antTip);

        group.add(headGroup);
        interactObject = body; // Raycast hits the sphere head

        animateFn = (_delta, time) => {
          // Gentle floating and subtle rotation
          headGroup.position.y = 1.2 + Math.sin(time * 2.5) * 0.08;
          headGroup.rotation.y = Math.sin(time * 0.8) * 0.15;
          // Pulsing visor intensity
          (visor.material as THREE.MeshStandardMaterial).emissiveIntensity =
            1.0 + Math.sin(time * 5.0) * 0.3;
        };
      } else if (def.id === 'joker') {
        // --- Joker NPC visuals ---
        // Toy box base
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.55, 0.55),
          new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.8 })
        );
        box.position.y = 0.275;
        box.castShadow = true;
        box.receiveShadow = true;
        group.add(box);

        // Floating/Spring head group
        const jokerHeadGroup = new THREE.Group();
        jokerHeadGroup.position.y = 1.0;

        // Spiral neck spring
        const neck = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8),
          new THREE.MeshStandardMaterial({ color: 0xd8d2c2, metalness: 0.7, roughness: 0.3 })
        );
        neck.position.y = -0.175;
        jokerHeadGroup.add(neck);

        // Head sphere
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xf2cc8f, roughness: 0.7 })
        );
        head.castShadow = true;
        jokerHeadGroup.add(head);

        // Jester hat
        const hat = new THREE.Mesh(
          new THREE.ConeGeometry(0.24, 0.45, 4),
          new THREE.MeshStandardMaterial({ color: 0x81b29a, roughness: 0.8 })
        );
        hat.position.y = 0.38;
        hat.rotation.x = 0.1;
        hat.rotation.z = -0.15;
        hat.castShadow = true;
        jokerHeadGroup.add(hat);

        // Funny red nose
        const nose = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.4 })
        );
        nose.position.set(0, 0, 0.24);
        jokerHeadGroup.add(nose);

        group.add(jokerHeadGroup);
        interactObject = head;

        animateFn = (_delta, time) => {
          // Funny bounce and rotation
          const bounce = Math.sin(time * 3.5);
          jokerHeadGroup.position.y = 0.95 + Math.abs(bounce) * 0.12;
          jokerHeadGroup.scale.y = 1.0 - Math.abs(bounce) * 0.06;
          jokerHeadGroup.rotation.y = time * 1.5;
        };
      } else {
        // --- Romance NPC visuals ---
        // Terracotta planter base
        const planter = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.28, 0.7, 10),
          new THREE.MeshStandardMaterial({ color: 0xf2cc8f, roughness: 0.9 })
        );
        planter.position.y = 0.35;
        planter.castShadow = true;
        planter.receiveShadow = true;
        group.add(planter);

        // Foliage visual inside planter
        const bush = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0x4a8a4f, roughness: 0.9 })
        );
        bush.position.y = 0.7;
        bush.castShadow = true;
        group.add(bush);

        // Floating glowing heart (Double Cone / Octahedron)
        const heart = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28, 0),
          new THREE.MeshStandardMaterial({
            color: 0xff4b72,
            emissive: 0xff4b72,
            emissiveIntensity: 0.8,
            roughness: 0.4,
            metalness: 0.2,
          })
        );
        heart.position.y = 1.35;
        heart.castShadow = true;
        group.add(heart);
        interactObject = heart;

        animateFn = (_delta, time) => {
          // Slow romantic float and rotation
          heart.position.y = 1.35 + Math.sin(time * 1.8) * 0.06;
          heart.rotation.y = time * 0.8;
          heart.rotation.x = Math.sin(time * 0.5) * 0.2;
        };
      }

      // Add Name Tag
      const nameColor = def.id === 'robot' ? '#00d2ff' : def.id === 'joker' ? '#ffb997' : '#ff4b72';
      const nameTexture = makeNameTagTexture(def.displayName, nameColor);
      const nameSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: nameTexture, depthTest: false })
      );
      nameSprite.scale.set(1.1, 0.275, 1);
      nameSprite.position.y = 1.95;
      nameSprite.renderOrder = 10;
      group.add(nameSprite);

      group.position.copy(def.position);
      // Turn them slightly towards the center of the plaza
      group.lookAt(new THREE.Vector3(0, def.position.y, 0));

      this.scene.add(group);
      this.npcInstances.push({
        def,
        group,
        interactObject,
        animate: animateFn,
      });
    });
  }

  update(delta: number, time: number) {
    this.npcInstances.forEach((inst) => inst.animate(delta, time));
  }

  getInteractables(): THREE.Object3D[] {
    return this.npcInstances.map((inst) => inst.interactObject);
  }

  getNpcByObject(obj: THREE.Object3D): NpcDef | null {
    const inst = this.npcInstances.find((i) => {
      let current: THREE.Object3D | null = obj;
      while (current) {
        if (current === i.interactObject) return true;
        current = current.parent;
      }
      return false;
    });
    return inst ? inst.def : null;
  }

  destroy() {
    this.npcInstances.forEach((inst) => {
      this.scene.remove(inst.group);
      inst.group.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
          child.geometry?.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => {
                mat.map?.dispose();
                mat.dispose();
              });
            } else {
              child.material.map?.dispose();
              child.material.dispose();
            }
          }
        }
      });
    });
    this.npcInstances = [];
  }

  respawn() {
    this.destroy();
    this.init();
  }
}
