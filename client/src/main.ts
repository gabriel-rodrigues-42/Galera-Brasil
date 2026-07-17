import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import './style.css';

// --- Renderer / Scene / Camera -------------------------------------------------

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// `false` keeps the canvas's CSS size controlled by our stylesheet (inset: 0);
// otherwise three.js writes an inline width/height that can freeze at 0x0
// before the container has been laid out.
function resizeRenderer() {
  const width = canvas.parentElement?.clientWidth || window.innerWidth;
  const height = canvas.parentElement?.clientHeight || window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ff);
scene.fog = new THREE.Fog(0xbfe3ff, 25, 90);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(0, 1.7, 8);

resizeRenderer();
window.addEventListener('resize', resizeRenderer);

// --- Lighting (solarpunk daytime) ----------------------------------------------

const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
sun.position.set(15, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.camera.far = 60;
scene.add(sun);

const sky = new THREE.HemisphereLight(0xbfe3ff, 0x3a5f3a, 0.9);
scene.add(sky);

// --- Ground: grass field + central praça (plaza) -------------------------------

const grass = new THREE.Mesh(
  new THREE.CircleGeometry(60, 48),
  new THREE.MeshStandardMaterial({ color: 0x4a8a4f, roughness: 1 }),
);
grass.rotation.x = -Math.PI / 2;
grass.receiveShadow = true;
scene.add(grass);

const plaza = new THREE.Mesh(
  new THREE.CircleGeometry(14, 48),
  new THREE.MeshStandardMaterial({ color: 0xe8d9b5, roughness: 0.9 }),
);
plaza.rotation.x = -Math.PI / 2;
plaza.position.y = 0.01;
plaza.receiveShadow = true;
scene.add(plaza);

// --- Simple procedural trees ----------------------------------------------------

function makeTree(x: number, z: number, scale = 1) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }),
  );
  trunk.position.y = 0.7;
  trunk.castShadow = true;
  group.add(trunk);

  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.9 - i * 0.15, 10, 10), canopyMat);
    puff.position.y = 1.6 + i * 0.55;
    puff.castShadow = true;
    group.add(puff);
  }

  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  return group;
}

const treePositions: [number, number, number][] = [
  [-18, -10, 1.1], [-22, 4, 0.9], [-16, 16, 1.2], [-9, 22, 1],
  [18, -8, 1], [23, 6, 1.15], [15, 18, 0.9], [8, 24, 1.05],
  [-24, -18, 1], [22, -20, 1.1], [-6, -24, 0.95], [4, -26, 1],
];
for (const [x, z, s] of treePositions) scene.add(makeTree(x, z, s));

// --- Solar canopy (feira market roof) — the solarpunk marketplace signature -----

function makeSolarCanopy(x: number, z: number, rotation = 0) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.5, metalness: 0.3 });

  const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8);
  const offsets: [number, number][] = [
    [-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1],
  ];
  for (const [ox, oz] of offsets) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(ox, 1.3, oz);
    pole.castShadow = true;
    group.add(pole);
  }

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.08, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x274a63, roughness: 0.3, metalness: 0.6 }),
  );
  panel.position.y = 2.7;
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  return group;
}

scene.add(makeSolarCanopy(-6, 0, 0.3));
scene.add(makeSolarCanopy(6, -1.5, -0.2));
scene.add(makeSolarCanopy(0, 6, Math.PI / 2));

// --- Placeholder content-garden hubs (future: profile facades) -----------------

const hubColors = [0xe07a5f, 0x81b29a, 0xf2cc8f, 0x3d405b, 0xe8a798];

function makeHub(x: number, z: number, color: number, rotation: number) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3, 2.4, 3),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  body.position.y = 1.2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 1.1, 4),
    new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.8 }),
  );
  roof.position.y = 2.95;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  return group;
}

const ring = 20;
const hubCount = 5;
for (let i = 0; i < hubCount; i++) {
  const angle = (i / hubCount) * Math.PI * 2;
  const x = Math.sin(angle) * ring;
  const z = Math.cos(angle) * ring;
  scene.add(makeHub(x, z, hubColors[i], angle + Math.PI));
}

// --- Player controls: pointer lock + WASD ---------------------------------------

const controls = new PointerLockControls(camera, canvas);
scene.add(controls.object);

canvas.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
  document.body.classList.add('locked');
});
controls.addEventListener('unlock', () => {
  overlay.classList.remove('hidden');
  document.body.classList.remove('locked');
});

const keys: Record<string, boolean> = {};
window.addEventListener('keydown', (e) => (keys[e.code] = true));
window.addEventListener('keyup', (e) => (keys[e.code] = false));

const MOVE_ACCEL = 60; // units/second^2
const MAX_SPEED = 5; // meters/second
const PLAZA_RADIUS = 58; // soft world boundary
const velocity = new THREE.Vector3();
const inputDir = new THREE.Vector3();

function updateMovement(delta: number) {
  // Damping
  velocity.x -= velocity.x * 8 * delta;
  velocity.z -= velocity.z * 8 * delta;

  const forward = Number(keys['KeyW'] || keys['ArrowUp']) - Number(keys['KeyS'] || keys['ArrowDown']);
  const strafe = Number(keys['KeyD'] || keys['ArrowRight']) - Number(keys['KeyA'] || keys['ArrowLeft']);

  inputDir.set(strafe, 0, -forward);
  if (inputDir.lengthSq() > 0) inputDir.normalize();

  velocity.x += inputDir.x * MOVE_ACCEL * delta;
  velocity.z += inputDir.z * MOVE_ACCEL * delta;
  velocity.x = THREE.MathUtils.clamp(velocity.x, -MAX_SPEED, MAX_SPEED);
  velocity.z = THREE.MathUtils.clamp(velocity.z, -MAX_SPEED, MAX_SPEED);

  controls.moveRight(velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  const obj = controls.object;
  const dist = Math.hypot(obj.position.x, obj.position.z);
  if (dist > PLAZA_RADIUS) {
    const scale = PLAZA_RADIUS / dist;
    obj.position.x *= scale;
    obj.position.z *= scale;
  }
  obj.position.y = 1.7;
}

// --- Render loop -----------------------------------------------------------------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  if (controls.isLocked) updateMovement(delta);
  renderer.render(scene, camera);
}

animate();
