import * as THREE from 'three';
import type { HubDescription, HubPost } from './hub-types';
import { makeImagePlaceholderTexture, makePlaqueTexture, makeLinkLabelTexture } from './textures';

export interface Interactable {
  object: THREE.Object3D;
  post: HubPost;
  label: string;
}

export interface BuiltHub {
  group: THREE.Group;
  interactables: Interactable[];
  /** Position just inside the entrance, facing into the room. */
  spawnPoint: THREE.Vector3;
  spawnYaw: number;
}

export const ROOM_HALF = 4.5;
const WALL_HEIGHT = 3.4;
const DOOR_HALF_WIDTH = 1.3;

function linspace(count: number, min: number, max: number): number[] {
  if (count <= 1) return [(min + max) / 2];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

export function buildHub(data: HubDescription): BuiltHub {
  const group = new THREE.Group();
  const interactables: Interactable[] = [];

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4ede0, roughness: 0.85 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xd7b98c, roughness: 0.9 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF * 2, 0.2, ROOM_HALF * 2), floorMat);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  group.add(floor);

  function addWall(w: number, h: number, d: number, x: number, y: number, z: number) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  const span = ROOM_HALF * 2;
  addWall(span, WALL_HEIGHT, 0.2, 0, WALL_HEIGHT / 2, -ROOM_HALF); // north (back)
  addWall(0.2, WALL_HEIGHT, span, -ROOM_HALF, WALL_HEIGHT / 2, 0); // west
  addWall(0.2, WALL_HEIGHT, span, ROOM_HALF, WALL_HEIGHT / 2, 0); // east

  const doorSegmentWidth = ROOM_HALF - DOOR_HALF_WIDTH;
  const doorSegmentX = DOOR_HALF_WIDTH + doorSegmentWidth / 2;
  addWall(doorSegmentWidth, WALL_HEIGHT, 0.2, -doorSegmentX, WALL_HEIGHT / 2, ROOM_HALF); // south-left
  addWall(doorSegmentWidth, WALL_HEIGHT, 0.2, doorSegmentX, WALL_HEIGHT / 2, ROOM_HALF); // south-right

  const imagePosts = data.posts.filter((p): p is Extract<HubPost, { type: 'image' }> => p.type === 'image');
  const textPosts = data.posts.filter((p): p is Extract<HubPost, { type: 'text' }> => p.type === 'text');
  const linkPosts = data.posts.filter((p): p is Extract<HubPost, { type: 'link' }> => p.type === 'link');

  // Image posts: framed pictures on the back (north) wall.
  const imageXs = linspace(imagePosts.length, -ROOM_HALF + 1.6, ROOM_HALF - 1.6);
  imagePosts.forEach((post, i) => {
    const texture = makeImagePlaceholderTexture(post.caption, post.accentColor);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.65, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.6 }),
    );
    const picture = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.45),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 }),
    );
    picture.position.z = 0.05;
    frame.add(picture);
    frame.position.set(imageXs[i], 1.8, -ROOM_HALF + 0.15);
    frame.castShadow = true;
    group.add(frame);
    interactables.push({ object: frame, post, label: post.caption });
  });

  // Text posts: wooden plaques on the west wall.
  const textZs = linspace(textPosts.length, -ROOM_HALF + 1.6, ROOM_HALF - 1.6);
  textPosts.forEach((post, i) => {
    const texture = makePlaqueTexture(post.title, post.body);
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 1.25),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }),
    );
    plaque.position.set(-ROOM_HALF + 0.15, 1.6, textZs[i]);
    plaque.rotation.y = Math.PI / 2;
    plaque.castShadow = true;
    group.add(plaque);
    interactables.push({ object: plaque, post, label: post.title });
  });

  // Link posts: freestanding glowing pedestals.
  const linkXs = linspace(linkPosts.length, -1.5, 1.5);
  linkPosts.forEach((post, i) => {
    const pedestal = new THREE.Group();
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 1.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x22333c, roughness: 0.4, metalness: 0.4 }),
    );
    column.position.y = 0.55;
    column.castShadow = true;
    pedestal.add(column);

    const texture = makeLinkLabelTexture(post.label);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12),
      new THREE.MeshStandardMaterial({
        map: texture,
        emissive: 0x1a4a55,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      }),
    );
    top.position.y = 1.12;
    pedestal.add(top);

    pedestal.position.set(linkXs[i], 0, 1.2);
    group.add(pedestal);
    interactables.push({ object: pedestal, post, label: post.label });
  });

  return {
    group,
    interactables,
    spawnPoint: new THREE.Vector3(0, 1.7, ROOM_HALF - 0.6),
    spawnYaw: 0, // camera default forward is -Z, which faces into the room from the entrance
  };
}

export const HUB_EXIT_ZONE = { x: 0, z: ROOM_HALF - 0.6, radius: 1.4 };
