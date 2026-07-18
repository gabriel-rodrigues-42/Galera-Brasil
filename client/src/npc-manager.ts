import * as THREE from 'three';
import { makeNameTagTexture } from './textures';

export interface NpcDef {
  id: 'robot' | 'joker' | 'romance' | 'vendor';
  displayName: string;
  position: THREE.Vector3;
}

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
  }

  addNpc(id: string, type: 'robot' | 'joker' | 'romance' | 'vendor', position: THREE.Vector3) {
    // Avoid double spawning
    if (this.npcInstances.some((inst) => inst.group.name === id)) return;

    const displayName =
      type === 'robot'
        ? 'Robô da Net'
        : type === 'joker'
          ? 'Coringa do Feirão'
          : type === 'romance'
            ? 'Cupido Solarpunk'
            : 'Dona Jurema da Feira';

    const def: NpcDef = {
      id: type,
      displayName,
      position: position.clone(),
    };

    const group = new THREE.Group();
    group.name = id; // Store DB id in group name for reference
    group.position.copy(position);

    let interactObject: THREE.Object3D;
    let animateFn: (delta: number, time: number) => void = () => {};

    if (type === 'robot') {
      // --- Robot NPC visuals ---
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.35, 0.7, 12),
        new THREE.MeshStandardMaterial({ color: 0x3d405b, roughness: 0.5, metalness: 0.6 })
      );
      stand.position.y = 0.35;
      stand.castShadow = true;
      stand.receiveShadow = true;
      group.add(stand);

      const headGroup = new THREE.Group();
      headGroup.position.y = 1.2;

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.3, metalness: 0.8 })
      );
      body.castShadow = true;
      headGroup.add(body);

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
      interactObject = body;

      animateFn = (_delta, time) => {
        headGroup.position.y = 1.2 + Math.sin(time * 2.5) * 0.08;
        headGroup.rotation.y = Math.sin(time * 0.8) * 0.15;
        (visor.material as THREE.MeshStandardMaterial).emissiveIntensity =
          1.0 + Math.sin(time * 5.0) * 0.3;
      };
    } else if (type === 'joker') {
      // --- Joker NPC visuals ---
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.55, 0.55),
        new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.8 })
      );
      box.position.y = 0.275;
      box.castShadow = true;
      box.receiveShadow = true;
      group.add(box);

      const jokerHeadGroup = new THREE.Group();
      jokerHeadGroup.position.y = 1.0;

      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8),
        new THREE.MeshStandardMaterial({ color: 0xd8d2c2, metalness: 0.7, roughness: 0.3 })
      );
      neck.position.y = -0.175;
      jokerHeadGroup.add(neck);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xf2cc8f, roughness: 0.7 })
      );
      head.castShadow = true;
      jokerHeadGroup.add(head);

      const hat = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.45, 4),
        new THREE.MeshStandardMaterial({ color: 0x81b29a, roughness: 0.8 })
      );
      hat.position.y = 0.38;
      hat.rotation.x = 0.1;
      hat.rotation.z = -0.15;
      hat.castShadow = true;
      jokerHeadGroup.add(hat);

      const nose = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.4 })
      );
      nose.position.set(0, 0, 0.24);
      jokerHeadGroup.add(nose);

      group.add(jokerHeadGroup);
      interactObject = head;

      animateFn = (_delta, time) => {
        const bounce = Math.sin(time * 3.5);
        jokerHeadGroup.position.y = 0.95 + Math.abs(bounce) * 0.12;
        jokerHeadGroup.scale.y = 1.0 - Math.abs(bounce) * 0.06;
        jokerHeadGroup.rotation.y = time * 1.5;
      };
    } else if (type === 'romance') {
      // --- Romance NPC visuals ---
      const planter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.28, 0.7, 10),
        new THREE.MeshStandardMaterial({ color: 0xf2cc8f, roughness: 0.9 })
      );
      planter.position.y = 0.35;
      planter.castShadow = true;
      planter.receiveShadow = true;
      group.add(planter);

      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x4a8a4f, roughness: 0.9 })
      );
      bush.position.y = 0.7;
      bush.castShadow = true;
      group.add(bush);

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
        heart.position.y = 1.35 + Math.sin(time * 1.8) * 0.06;
        heart.rotation.y = time * 0.8;
        heart.rotation.x = Math.sin(time * 0.5) * 0.2;
      };
    } else {
      // --- Feira vendor visuals ---
      const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.24, 0.58, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0x5b8f6b, roughness: 0.75 })
      );
      torso.position.y = 0.53; // sits exactly on the ground
      torso.castShadow = true;
      group.add(torso);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 14, 14),
        new THREE.MeshStandardMaterial({ color: 0xf2cc8f, roughness: 0.8 })
      );
      head.position.y = 1.08;
      head.castShadow = true;
      group.add(head);

      const hat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.34, 0.16, 16),
        new THREE.MeshStandardMaterial({ color: 0xd85f2d, roughness: 0.8 })
      );
      hat.position.y = 1.31;
      hat.castShadow = true;
      group.add(hat);

      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.08, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x8a5a2f, roughness: 0.9 })
      );
      tray.position.set(0, 0.63, 0.25);
      tray.castShadow = true;
      group.add(tray);

      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.045, 0.22, 10),
        new THREE.MeshStandardMaterial({ color: 0xa7d94f, roughness: 0.5, metalness: 0.1 })
      );
      // Positioned relative to the tray
      bottle.position.set(-0.16, 0.14, 0);
      tray.add(bottle);

      const slipper = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.03, 0.34),
        new THREE.MeshStandardMaterial({ color: 0x2a6bd4, roughness: 0.8 })
      );
      // Positioned relative to the tray
      slipper.position.set(0.12, 0.06, -0.03);
      tray.add(slipper);

      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16),
        new THREE.MeshStandardMaterial({ color: 0xffcf5c, metalness: 0.7, roughness: 0.3 })
      );
      coin.rotation.x = Math.PI / 2;
      // Positioned relative to the tray
      coin.position.set(0.03, 0.06, 0.06);
      tray.add(coin);

      interactObject = torso;
      animateFn = (_delta, time) => {
        torso.rotation.y = Math.sin(time * 0.9) * 0.1;
        tray.position.y = 0.63 + Math.sin(time * 2.2) * 0.02;
      };
    }

    // Add Name Tag
    const nameColor =
      type === 'robot'
        ? '#00d2ff'
        : type === 'joker'
          ? '#ffb997'
          : type === 'romance'
            ? '#ff4b72'
            : '#ffcf5c';
    const nameTexture = makeNameTagTexture(displayName, nameColor);
    const nameSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: nameTexture, depthTest: false })
    );
    nameSprite.scale.set(1.1, 0.275, 1);
    nameSprite.position.y = type === 'vendor' ? 1.55 : 1.95;
    nameSprite.renderOrder = 10;
    group.add(nameSprite);

    group.position.copy(position);
    group.lookAt(new THREE.Vector3(0, position.y, 0));

    this.scene.add(group);
    this.npcInstances.push({
      def,
      group,
      interactObject,
      animate: animateFn,
    });
  }

  removeNpc(id: string) {
    const idx = this.npcInstances.findIndex((inst) => inst.group.name === id);
    if (idx === -1) return;

    const inst = this.npcInstances[idx];
    this.scene.remove(inst.group);

    // Dispose geometries and materials
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

    this.npcInstances.splice(idx, 1);
    console.log(`[NpcManager] Removed NPC ${id}`);
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
    // NPCs are now loaded dynamically from the database via the main loop.
    // This is kept as a stub for compatibility or manual triggers.
  }
}
