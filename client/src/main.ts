import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildHub, ROOM_HALF, HUB_EXIT_ZONE, type Interactable } from './hub-builder';
import { demoHub } from './hub-content';
import type { HubPost } from './hub-types';
import { log, initDebugPanel, updateStats, installGlobalErrorLogging } from './logger';
import { Network } from './network';
import { AvatarManager } from './avatars';
import './style.css';

installGlobalErrorLogging();
log('info', 'main.ts starting');

// --- Renderer / Scene / Camera -------------------------------------------------

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const hintEl = document.querySelector<HTMLDivElement>('#interact-hint')!;
const panelEl = document.querySelector<HTMLDivElement>('#post-panel')!;
const panelContentEl = document.querySelector<HTMLDivElement>('#post-panel-content')!;
const debugPanelEl = document.querySelector<HTMLDivElement>('#debug-panel')!;
const debugStatsEl = document.querySelector<HTMLPreElement>('#debug-stats')!;
const debugLogEl = document.querySelector<HTMLPreElement>('#debug-log')!;
const joinFormEl = document.querySelector<HTMLFormElement>('#join-form')!;
const nameInputEl = document.querySelector<HTMLInputElement>('#name-input')!;
const joinStatusEl = document.querySelector<HTMLParagraphElement>('#join-status')!;
const resumeBlockEl = document.querySelector<HTMLDivElement>('#resume-block')!;
const chatLogEl = document.querySelector<HTMLDivElement>('#chat-log')!;
const chatInputEl = document.querySelector<HTMLInputElement>('#chat-input')!;
initDebugPanel(debugLogEl, debugStatsEl);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote') debugPanelEl.classList.toggle('hidden');
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

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
  log('info', `resizeRenderer: ${width}x${height} (canvas rect now ${canvas.getBoundingClientRect().width}x${canvas.getBoundingClientRect().height})`);
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
const hub0Position = new THREE.Vector3();
for (let i = 0; i < hubCount; i++) {
  const angle = (i / hubCount) * Math.PI * 2;
  const x = Math.sin(angle) * ring;
  const z = Math.cos(angle) * ring;
  scene.add(makeHub(x, z, hubColors[i], angle + Math.PI));
  if (i === 0) hub0Position.set(x, 0, z);
}

// Beacon marking hub #0 as the one real, walkable Content Garden (Phase 1);
// the other four are still just placeholder facades for the future street.
const beacon = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.35),
  new THREE.MeshStandardMaterial({ color: 0xffcf5c, emissive: 0xffcf5c, emissiveIntensity: 0.8, roughness: 0.3 }),
);
beacon.position.set(hub0Position.x, 3.6, hub0Position.z);
scene.add(beacon);

// --- The Content Garden: hub #0's walkable interior --------------------------

const HUB_INTERIOR_ORIGIN = new THREE.Vector3(0, 0, 300); // far beyond fog draw distance
const builtHub = buildHub(demoHub);
builtHub.group.position.copy(HUB_INTERIOR_ORIGIN);
scene.add(builtHub.group);

const ENTRANCE_POINT = { x: hub0Position.x, z: hub0Position.z - 2.5 };
const ENTRANCE_RADIUS = 2;

type Mode = 'plaza' | 'hub';
let mode: Mode = 'plaza';
let openPost: HubPost | null = null;
const lastPlazaTransform = { position: new THREE.Vector3(0, 1.7, 8), yaw: 0 };

// --- Multiplayer: networking, remote avatars, chat -----------------------------

function getServerUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  // Dev mode: Vite serves the client on 5173, but the game server runs on
  // 2567. In production the server serves the built client itself, so the
  // websocket is same-origin — this one function covers both cases.
  const isDev = window.location.port === '5173';
  const host = isDev ? `${window.location.hostname}:2567` : window.location.host;
  return `${protocol}://${host}`;
}

const network = new Network(getServerUrl());
const avatarManager = new AvatarManager(scene, HUB_INTERIOR_ORIGIN);
let connected = false;

const MAX_CHAT_LINES = 8;
function appendChatLine(name: string, text: string, isSystem = false) {
  const line = document.createElement('div');
  line.className = isSystem ? 'chat-line system' : 'chat-line';
  if (isSystem) {
    line.textContent = text;
  } else {
    const nameSpan = document.createElement('span');
    nameSpan.className = 'chat-name';
    nameSpan.textContent = `${name}: `;
    line.appendChild(nameSpan);
    line.appendChild(document.createTextNode(text));
  }
  chatLogEl.appendChild(line);
  while (chatLogEl.children.length > MAX_CHAT_LINES) {
    chatLogEl.removeChild(chatLogEl.firstChild!);
  }
}

network.onPlayerAdd = (sessionId, state) => avatarManager.add(sessionId, state);
network.onPlayerChange = (sessionId, state) => avatarManager.updateTarget(sessionId, state);
network.onPlayerRemove = (sessionId) => avatarManager.remove(sessionId);
network.onChat = (event) => {
  appendChatLine(event.name, event.text);
  avatarManager.showChatBubble(event.sessionId, event.text, performance.now() / 1000);
};
network.onSystem = (text) => appendChatLine('', text, true);
network.onDisconnected = (reason) => appendChatLine('', `Desconectado do servidor (${reason})`, true);

// --- Player controls: pointer lock + WASD ---------------------------------------

const controls = new PointerLockControls(camera, canvas);
scene.add(controls.object);

// PointerLockControls allows the full 0..PI pitch range by default (straight
// up to straight down), so a single stray mouse movement can pitch the
// camera into an all-sky (or all-ground) view with nothing to reorient by.
// Clamp to a comfortable ±85° from the horizon like a typical FPS.
const MAX_PITCH_FROM_HORIZON = THREE.MathUtils.degToRad(85);
controls.minPolarAngle = Math.PI / 2 - MAX_PITCH_FROM_HORIZON;
controls.maxPolarAngle = Math.PI / 2 + MAX_PITCH_FROM_HORIZON;

const SAVED_NAME_KEY = 'galera-brasil-name';
nameInputEl.value = localStorage.getItem(SAVED_NAME_KEY) ?? '';

joinFormEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInputEl.value.trim().slice(0, 24) || `Visitante${Math.floor(Math.random() * 900 + 100)}`;
  const submitBtn = joinFormEl.querySelector('button')!;
  submitBtn.disabled = true;
  nameInputEl.disabled = true;
  joinStatusEl.textContent = 'Conectando...';

  network
    .connect(name)
    .then(() => {
      localStorage.setItem(SAVED_NAME_KEY, name);
      connected = true;
      joinFormEl.classList.add('hidden');
      joinStatusEl.textContent = '';
      resumeBlockEl.classList.remove('hidden');
      controls.lock();
    })
    .catch((err) => {
      log('error', `failed to connect: ${err}`);
      joinStatusEl.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
      submitBtn.disabled = false;
      nameInputEl.disabled = false;
    });
});

// The overlay sits visually on top of the canvas while visible, so it (not
// the canvas) is what actually receives the click that should engage pointer
// lock — only meaningful once already connected (the join form handles the
// first connection, via its submit handler above).
overlay.addEventListener('click', (e) => {
  if (!connected || e.target === nameInputEl || (e.target as HTMLElement).closest('#join-form')) return;
  log('info', `overlay clicked, requesting pointer lock (document.hasFocus=${document.hasFocus()}, visibilityState=${document.visibilityState})`);
  controls.lock();
});
controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
  document.body.classList.add('locked');
  log(
    'info',
    `pointer lock ENGAGED — camera pos=(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}) ` +
      `rot(yaw,pitch deg)=(${THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(1)}, ${THREE.MathUtils.radToDeg(camera.rotation.x).toFixed(1)}) scene.children=${scene.children.length}`,
  );
});
controls.addEventListener('unlock', () => {
  overlay.classList.remove('hidden');
  document.body.classList.remove('locked');
  hintEl.classList.add('hidden');
  closePostPanel();
  closeChatInput();
  log('info', 'pointer lock RELEASED');
});
// PointerLockControls logs this to console itself but doesn't expose it as a
// subscribable event, so hook the native event directly to get it on-screen too.
document.addEventListener('pointerlockerror', () => {
  log('error', 'pointerlockerror: browser refused the pointer lock request');
});

// --- Proximity chat -------------------------------------------------------------

let chatInputOpen = false;

function openChatInput() {
  chatInputOpen = true;
  Object.keys(keys).forEach((code) => (keys[code] = false)); // don't keep sliding on stale held keys
  chatInputEl.classList.remove('hidden');
  chatInputEl.value = '';
  chatInputEl.focus();
}

function closeChatInput() {
  chatInputOpen = false;
  chatInputEl.classList.add('hidden');
  chatInputEl.blur();
}

// stopPropagation keeps every keystroke typed here from also reaching the
// window-level game-input listener below (movement keys, E-to-interact, etc).
chatInputEl.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.code === 'Enter') {
    const text = chatInputEl.value.trim();
    if (text) network.sendChat(text);
    closeChatInput();
  } else if (e.code === 'Escape') {
    closeChatInput();
  }
});

const keys: Record<string, boolean> = {};
let eJustPressed = false;
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyE') eJustPressed = true;
  if (e.code === 'Enter' && controls.isLocked && !openPost && !chatInputOpen) openChatInput();
});
window.addEventListener('keyup', (e) => (keys[e.code] = false));

const MOVE_ACCEL = 60; // units/second^2
const MAX_SPEED = 5; // meters/second
const PLAZA_RADIUS = 58; // soft world boundary
const velocity = new THREE.Vector3();
const inputDir = new THREE.Vector3();

function isDown(...codes: string[]): boolean {
  return codes.some((code) => keys[code] === true);
}

function updateMovement(delta: number) {
  if (openPost || chatInputOpen) return; // frozen while reading a post panel or typing chat

  // Damping
  velocity.x -= velocity.x * 8 * delta;
  velocity.z -= velocity.z * 8 * delta;

  // NOTE: keys['KeyW'] is `undefined` (not `false`) until that key has been
  // pressed at least once. `undefined || undefined` is `undefined`, and
  // `Number(undefined)` is `NaN` — so the old `Number(keys[a] || keys[b])`
  // form poisoned velocity, then position, with NaN from the very first
  // locked frame if no key had been pressed yet. isDown() coerces properly.
  const forward = Number(isDown('KeyW', 'ArrowUp')) - Number(isDown('KeyS', 'ArrowDown'));
  const strafe = Number(isDown('KeyD', 'ArrowRight')) - Number(isDown('KeyA', 'ArrowLeft'));

  inputDir.set(strafe, 0, -forward);
  if (inputDir.lengthSq() > 0) inputDir.normalize();

  velocity.x += inputDir.x * MOVE_ACCEL * delta;
  velocity.z += inputDir.z * MOVE_ACCEL * delta;
  velocity.x = THREE.MathUtils.clamp(velocity.x, -MAX_SPEED, MAX_SPEED);
  velocity.z = THREE.MathUtils.clamp(velocity.z, -MAX_SPEED, MAX_SPEED);

  controls.moveRight(velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  const obj = controls.object;
  if (mode === 'plaza') {
    const dist = Math.hypot(obj.position.x, obj.position.z);
    if (dist > PLAZA_RADIUS) {
      const scale = PLAZA_RADIUS / dist;
      obj.position.x *= scale;
      obj.position.z *= scale;
    }
  } else {
    // No real colliders yet on the hub's walls, so clamp to the room's
    // interior bounds instead — exiting only happens via the E-triggered
    // teleport at HUB_EXIT_ZONE, not by walking through the doorway gap.
    const limit = ROOM_HALF - 0.3;
    obj.position.x = HUB_INTERIOR_ORIGIN.x + THREE.MathUtils.clamp(obj.position.x - HUB_INTERIOR_ORIGIN.x, -limit, limit);
    obj.position.z = HUB_INTERIOR_ORIGIN.z + THREE.MathUtils.clamp(obj.position.z - HUB_INTERIOR_ORIGIN.z, -limit, limit);
  }
  obj.position.y = 1.7;
}

// --- Content Garden interaction: entrance/exit triggers + post raycasting ------

const raycaster = new THREE.Raycaster();
const INTERACT_DISTANCE = 3.2;
const raycastOrigin = new THREE.Vector3();
const raycastDir = new THREE.Vector3();

function findInteractable(hit: THREE.Object3D): Interactable | null {
  let obj: THREE.Object3D | null = hit;
  while (obj) {
    const found = builtHub.interactables.find((i) => i.object === obj);
    if (found) return found;
    obj = obj.parent;
  }
  return null;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderPostPanel(post: HubPost): string {
  if (post.type === 'image') {
    return `
      <div class="panel-photo" style="background: linear-gradient(135deg, ${escapeHtml(post.accentColor)}, #1c1c22)"></div>
      <p class="panel-caption">${escapeHtml(post.caption)}</p>
    `;
  }
  if (post.type === 'text') {
    return `<h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(post.body)}</p>`;
  }
  return `
    <h2>${escapeHtml(post.label)}</h2>
    <p>${escapeHtml(post.description)}</p>
    <a href="${encodeURI(post.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.url)}</a>
  `;
}

function openPostPanel(post: HubPost) {
  openPost = post;
  panelContentEl.innerHTML = renderPostPanel(post);
  panelEl.classList.remove('hidden');
  velocity.set(0, 0, 0);
  log('info', `post panel opened: ${post.type}/${post.id}`);
}

function closePostPanel() {
  openPost = null;
  panelEl.classList.add('hidden');
  log('info', 'post panel closed');
}

function enterHub() {
  lastPlazaTransform.position.copy(controls.object.position);
  lastPlazaTransform.yaw = camera.rotation.y;
  mode = 'hub';
  controls.object.position.set(
    HUB_INTERIOR_ORIGIN.x + builtHub.spawnPoint.x,
    builtHub.spawnPoint.y,
    HUB_INTERIOR_ORIGIN.z + builtHub.spawnPoint.z,
  );
  camera.rotation.set(0, builtHub.spawnYaw, 0);
  velocity.set(0, 0, 0);
  log('info', `entered hub — teleported to (${controls.object.position.x.toFixed(2)}, ${controls.object.position.y.toFixed(2)}, ${controls.object.position.z.toFixed(2)})`);
}

function exitHub() {
  mode = 'plaza';
  controls.object.position.copy(lastPlazaTransform.position);
  camera.rotation.set(0, lastPlazaTransform.yaw, 0);
  velocity.set(0, 0, 0);
  log('info', `exited hub — restored to (${controls.object.position.x.toFixed(2)}, ${controls.object.position.y.toFixed(2)}, ${controls.object.position.z.toFixed(2)})`);
}

function updateInteraction() {
  if (chatInputOpen) {
    hintEl.classList.add('hidden');
    return;
  }

  let hint = '';
  let hovered: Interactable | null = null;
  let nearEntrance = false;
  let nearExit = false;

  if (mode === 'plaza') {
    const dx = controls.object.position.x - ENTRANCE_POINT.x;
    const dz = controls.object.position.z - ENTRANCE_POINT.z;
    nearEntrance = Math.hypot(dx, dz) < ENTRANCE_RADIUS;
  } else {
    const localX = controls.object.position.x - HUB_INTERIOR_ORIGIN.x;
    const localZ = controls.object.position.z - HUB_INTERIOR_ORIGIN.z;
    nearExit = Math.hypot(localX - HUB_EXIT_ZONE.x, localZ - HUB_EXIT_ZONE.z) < HUB_EXIT_ZONE.radius;

    if (!openPost) {
      camera.getWorldPosition(raycastOrigin);
      camera.getWorldDirection(raycastDir);
      raycaster.set(raycastOrigin, raycastDir);
      const hits = raycaster.intersectObjects(builtHub.interactables.map((i) => i.object), true);
      if (hits.length > 0 && hits[0].distance <= INTERACT_DISTANCE) {
        hovered = findInteractable(hits[0].object);
      }
    }
  }

  if (openPost) {
    hint = 'Pressione E para fechar';
  } else if (hovered) {
    hint = `Pressione E — ${hovered.label}`;
  } else if (nearEntrance) {
    hint = `Pressione E para entrar no hub de ${demoHub.owner}`;
  } else if (nearExit) {
    hint = 'Pressione E para sair';
  }

  hintEl.textContent = hint;
  hintEl.classList.toggle('hidden', hint === '');

  if (eJustPressed) {
    if (openPost) {
      closePostPanel();
    } else if (hovered) {
      openPostPanel(hovered.post);
    } else if (mode === 'plaza' && nearEntrance) {
      enterHub();
    } else if (mode === 'hub' && nearExit) {
      exitHub();
    }
  }
  eJustPressed = false;
}

// --- Render loop -----------------------------------------------------------------

const timer = new THREE.Timer();
timer.connect(document); // zero-out delta while the tab is hidden, instead of a huge catch-up jump

let prevYaw = camera.rotation.y;
let prevPitch = camera.rotation.x;
let fps = 0;
let fpsFrameCount = 0;
let fpsAccum = 0;
let nanGuardTripped = false;
const lastGoodPosition = camera.position.clone();

const SEND_INTERVAL = 1 / 15; // 15Hz is plenty for walking-speed avatars
let sendAccum = 0;

function animate(timestamp: number) {
  requestAnimationFrame(animate);
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.1);

  fpsFrameCount++;
  fpsAccum += delta;
  if (fpsAccum >= 0.5) {
    fps = fpsFrameCount / fpsAccum;
    fpsFrameCount = 0;
    fpsAccum = 0;
  }

  if (controls.isLocked) {
    updateMovement(delta);
    updateInteraction();

    sendAccum += delta;
    if (connected && sendAccum >= SEND_INTERVAL) {
      sendAccum = 0;
      const localX = mode === 'hub' ? camera.position.x - HUB_INTERIOR_ORIGIN.x : camera.position.x;
      const localZ = mode === 'hub' ? camera.position.z - HUB_INTERIOR_ORIGIN.z : camera.position.z;
      network.sendMove(localX, camera.position.y, localZ, camera.rotation.y, mode);
    }

    // Flag any single-frame rotation big enough to plausibly explain "camera
    // suddenly stuck looking at the sky" — e.g. a cursor-warp artifact right
    // after requestPointerLock(), rather than a deliberate mouse move.
    const yawDeltaDeg = THREE.MathUtils.radToDeg(camera.rotation.y - prevYaw);
    const pitchDeltaDeg = THREE.MathUtils.radToDeg(camera.rotation.x - prevPitch);
    if (Math.abs(yawDeltaDeg) > 60 || Math.abs(pitchDeltaDeg) > 30) {
      log('warn', `Large single-frame rotation jump: yaw Δ=${yawDeltaDeg.toFixed(1)}° pitch Δ=${pitchDeltaDeg.toFixed(1)}°`);
    }
  }
  prevYaw = camera.rotation.y;
  prevPitch = camera.rotation.x;

  if (!nanGuardTripped && (!Number.isFinite(camera.position.x) || !Number.isFinite(camera.position.z))) {
    nanGuardTripped = true;
    log('error', `Camera position went non-finite: (${camera.position.x}, ${camera.position.y}, ${camera.position.z}) — recovering to last known-good spot`);
    camera.position.set(lastGoodPosition.x, lastGoodPosition.y, lastGoodPosition.z);
    velocity.set(0, 0, 0);
  } else if (Number.isFinite(camera.position.x) && Number.isFinite(camera.position.z)) {
    lastGoodPosition.copy(camera.position);
    nanGuardTripped = false;
  }

  avatarManager.update(delta, timestamp / 1000);

  updateStats([
    `mode=${mode}  locked=${controls.isLocked}  fps=${fps.toFixed(0)}`,
    `pos=(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`,
    `rot yaw=${THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(1)}°  pitch=${THREE.MathUtils.radToDeg(camera.rotation.x).toFixed(1)}°`,
    `scene.children=${scene.children.length}  openPost=${openPost ? openPost.id : 'none'}`,
    `connected=${connected}  sessionId=${network.sessionId || 'none'}  remotePlayers=${avatarManager.count}`,
  ]);

  beacon.rotation.y += delta * 1.2;
  renderer.render(scene, camera);
}

log('info', `initial camera pos=(${camera.position.x}, ${camera.position.y}, ${camera.position.z}) scene.children=${scene.children.length}`);
animate(performance.now());
