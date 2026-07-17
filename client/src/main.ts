import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { HUB_EXIT_ZONE, type Interactable } from './hub-builder';
import { HubManager, ROOM_HALF } from './hub-manager';
import type { HubPost } from './hub-types';
import { log, initDebugPanel, updateStats, installGlobalErrorLogging } from './logger';
import { Network } from './network';
import { AvatarManager } from './avatars';
import * as api from './api';
import './style.css';

installGlobalErrorLogging();
log('info', 'main.ts starting');

// --- Renderer / Scene / Camera -------------------------------------------------

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const hintEl = document.querySelector<HTMLDivElement>('#interact-hint')!;
const panelEl = document.querySelector<HTMLDivElement>('#post-panel')!;
const panelContentEl = document.querySelector<HTMLDivElement>('#post-panel-content')!;
const panelCloseEl = document.querySelector<HTMLButtonElement>('#post-panel-close')!;
const debugPanelEl = document.querySelector<HTMLDivElement>('#debug-panel')!;
const debugStatsEl = document.querySelector<HTMLPreElement>('#debug-stats')!;
const debugLogEl = document.querySelector<HTMLPreElement>('#debug-log')!;
const joinFormEl = document.querySelector<HTMLFormElement>('#join-form')!;
const nameInputEl = document.querySelector<HTMLInputElement>('#name-input')!;
const joinStatusEl = document.querySelector<HTMLParagraphElement>('#join-status')!;
const resumeBlockEl = document.querySelector<HTMLDivElement>('#resume-block')!;
const chatLogEl = document.querySelector<HTMLDivElement>('#chat-log')!;
const chatInputEl = document.querySelector<HTMLInputElement>('#chat-input')!;
const addPostPanelEl = document.querySelector<HTMLDivElement>('#add-post-panel')!;
const addPostFormEl = document.querySelector<HTMLFormElement>('#add-post-form')!;
const postTitleInputEl = document.querySelector<HTMLInputElement>('#post-title-input')!;
const postBodyInputEl = document.querySelector<HTMLTextAreaElement>('#post-body-input')!;
const addPostCancelEl = document.querySelector<HTMLButtonElement>('#add-post-cancel')!;
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

// --- Content Garden hubs: one per registered friend, fetched from the server ---

const hubManager = new HubManager(scene);
hubManager.refreshList().catch((err) => log('error', `failed to load hub list: ${err}`));

type Mode = 'plaza' | 'hub';
let mode: Mode = 'plaza';
let currentHubOwner: string | null = null;
let hubTransitionInFlight = false;
let myName = '';
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
const avatarManager = new AvatarManager(scene, (hubId) => hubManager.originFor(hubId));
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
network.onHubAdded = (event) => hubManager.addFacade(event);
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
    .then(() => hubManager.ensureOwnHub(name))
    .then(() => {
      localStorage.setItem(SAVED_NAME_KEY, name);
      myName = name;
      connected = true;
      joinFormEl.classList.add('hidden');
      joinStatusEl.textContent = '';
      resumeBlockEl.classList.remove('hidden');
      requestLock();
    })
    .catch((err) => {
      log('error', `failed to connect: ${err}`);
      joinStatusEl.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
      submitBtn.disabled = false;
      nameInputEl.disabled = false;
    });
});

// `controls.lock()` fires-and-forgets `canvas.requestPointerLock()` without
// capturing the promise it returns, so any rejection (e.g. Chrome's ~1.3s
// cooldown after exiting a lock — SecurityError if you re-click too soon)
// surfaces only as an unhandled rejection. Call requestPointerLock ourselves
// so we can catch it and give the player visible feedback instead.
function requestLock() {
  canvas.requestPointerLock().catch((err: DOMException) => {
    log('warn', `pointer lock request rejected: ${err.name} — ${err.message}`);
    if (err.name === 'SecurityError') {
      joinStatusEl.textContent = 'Aguarde um instante e clique novamente.';
      setTimeout(() => {
        if (joinStatusEl.textContent === 'Aguarde um instante e clique novamente.') joinStatusEl.textContent = '';
      }, 2000);
    }
  });
}

// Some UI panels (the post-detail view, the add-post form) have real
// clickable elements — but the mouse is captured for camera-look the whole
// time we're locked, so there's no visible cursor to click them with. Release
// the lock while those are open (without falling back to the start screen,
// which the normal 'unlock' handler below does for a genuine Escape-to-pause)
// and re-acquire it when they close. Movement/interaction updates are gated
// on controls.isLocked, so releasing also (correctly) freezes the game loop
// while one of these panels is open — the E-to-close path inside
// updateInteraction can no longer fire once that happens, so closing instead
// goes through an explicit button click or the dedicated Escape listener
// below, both of which call resumeAfterUI() themselves.
let suppressUnlockOverlay = false;
let pointerReleasedForUI = false;

function releasePointerForUI() {
  if (!controls.isLocked) return;
  pointerReleasedForUI = true;
  suppressUnlockOverlay = true;
  document.exitPointerLock();
  document.body.classList.remove('locked');
}

function resumeAfterUI() {
  if (!pointerReleasedForUI) return;
  pointerReleasedForUI = false;
  requestLock();
}

// Escape while a panel released the pointer (see above) doesn't trigger the
// browser's native pointer-lock-exit path — there's no lock to exit — so it
// needs its own listener rather than relying on the 'unlock' event.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || !pointerReleasedForUI) return;
  if (openPost) closePostPanel();
  if (addPostOpen) closeAddPostForm();
  resumeAfterUI();
});

// The overlay sits visually on top of the canvas while visible, so it (not
// the canvas) is what actually receives the click that should engage pointer
// lock — only meaningful once already connected (the join form handles the
// first connection, via its submit handler above).
overlay.addEventListener('click', (e) => {
  if (!connected || e.target === nameInputEl || (e.target as HTMLElement).closest('#join-form')) return;
  log('info', `overlay clicked, requesting pointer lock (document.hasFocus=${document.hasFocus()}, visibilityState=${document.visibilityState})`);
  requestLock();
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
  if (suppressUnlockOverlay) {
    suppressUnlockOverlay = false;
    log('info', 'pointer lock released for a UI panel (cursor visible, panel stays open)');
    return;
  }
  overlay.classList.remove('hidden');
  document.body.classList.remove('locked');
  hintEl.classList.add('hidden');
  closePostPanel();
  closeChatInput();
  closeAddPostForm();
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

// --- Add-post form: only usable inside your own hub -----------------------------

let addPostOpen = false;

function openAddPostForm() {
  addPostOpen = true;
  Object.keys(keys).forEach((code) => (keys[code] = false));
  addPostPanelEl.classList.remove('hidden');
  postTitleInputEl.value = '';
  postBodyInputEl.value = '';
  postTitleInputEl.focus();
  releasePointerForUI(); // let the mouse click Publicar/Cancelar
}

function closeAddPostForm() {
  addPostOpen = false;
  addPostPanelEl.classList.add('hidden');
  postTitleInputEl.blur();
  postBodyInputEl.blur();
}

// Ctrl/Cmd+Enter submits from either field (title or the multi-line body,
// where plain Enter has to stay a newline) — a keyboard path for players who
// don't want to reach for the mouse now that it's been released above.
addPostFormEl.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.code === 'Escape') {
    closeAddPostForm();
    resumeAfterUI();
  } else if (e.code === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    addPostFormEl.requestSubmit();
  }
});
addPostCancelEl.addEventListener('click', () => {
  closeAddPostForm();
  resumeAfterUI();
});

addPostFormEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = postTitleInputEl.value.trim();
  const body = postBodyInputEl.value.trim();
  if (!title || !body || !currentHubOwner) return;

  api
    .addPost(currentHubOwner, { type: 'text', title, body })
    .then(() => hubManager.rebuild(currentHubOwner!))
    .then(() => {
      log('info', `post added to hub "${currentHubOwner}": "${title}"`);
      closeAddPostForm();
      resumeAfterUI();
    })
    .catch((err) => log('error', `failed to add post: ${err}`));
});

const keys: Record<string, boolean> = {};
let eJustPressed = false;
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyE') eJustPressed = true;
  if (e.code === 'Enter' && controls.isLocked && !openPost && !chatInputOpen && !addPostOpen) openChatInput();
  if (
    e.code === 'KeyN' &&
    controls.isLocked &&
    !openPost &&
    !chatInputOpen &&
    !addPostOpen &&
    mode === 'hub' &&
    currentHubOwner === myName
  ) {
    openAddPostForm();
  }
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
  if (openPost || chatInputOpen || addPostOpen) return; // frozen while a UI panel is open

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
  } else if (currentHubOwner) {
    // No real colliders yet on the hub's walls, so clamp to the room's
    // interior bounds instead — exiting only happens via the E-triggered
    // teleport at HUB_EXIT_ZONE, not by walking through the doorway gap.
    const origin = hubManager.originFor(currentHubOwner);
    if (origin) {
      const limit = ROOM_HALF - 0.3;
      obj.position.x = origin.x + THREE.MathUtils.clamp(obj.position.x - origin.x, -limit, limit);
      obj.position.z = origin.z + THREE.MathUtils.clamp(obj.position.z - origin.z, -limit, limit);
    }
  }
  obj.position.y = 1.7;
}

// --- Content Garden interaction: entrance/exit triggers + post raycasting ------

const raycaster = new THREE.Raycaster();
const INTERACT_DISTANCE = 3.2;
const raycastOrigin = new THREE.Vector3();
const raycastDir = new THREE.Vector3();

function findInteractable(hit: THREE.Object3D, interactables: Interactable[]): Interactable | null {
  let obj: THREE.Object3D | null = hit;
  while (obj) {
    const found = interactables.find((i) => i.object === obj);
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
  releasePointerForUI(); // lets the mouse click a link post's URL or the Fechar button
  log('info', `post panel opened: ${post.type}/${post.id}`);
}

function closePostPanel() {
  openPost = null;
  panelEl.classList.add('hidden');
  log('info', 'post panel closed');
}

panelCloseEl.addEventListener('click', () => {
  closePostPanel();
  resumeAfterUI();
});

async function enterHub(owner: string) {
  if (hubTransitionInFlight) return;
  hubTransitionInFlight = true;
  try {
    const built = await hubManager.enter(owner);
    const origin = hubManager.originFor(owner);
    if (!built || !origin) return;

    lastPlazaTransform.position.copy(controls.object.position);
    lastPlazaTransform.yaw = camera.rotation.y;
    mode = 'hub';
    currentHubOwner = owner;
    controls.object.position.set(origin.x + built.spawnPoint.x, built.spawnPoint.y, origin.z + built.spawnPoint.z);
    camera.rotation.set(0, built.spawnYaw, 0);
    velocity.set(0, 0, 0);
    log(
      'info',
      `entered hub "${owner}" — teleported to (${controls.object.position.x.toFixed(2)}, ${controls.object.position.y.toFixed(2)}, ${controls.object.position.z.toFixed(2)})`,
    );
  } catch (err) {
    log('error', `failed to enter hub "${owner}": ${err}`);
  } finally {
    hubTransitionInFlight = false;
  }
}

function exitHub() {
  mode = 'plaza';
  currentHubOwner = null;
  controls.object.position.copy(lastPlazaTransform.position);
  camera.rotation.set(0, lastPlazaTransform.yaw, 0);
  velocity.set(0, 0, 0);
  log('info', `exited hub — restored to (${controls.object.position.x.toFixed(2)}, ${controls.object.position.y.toFixed(2)}, ${controls.object.position.z.toFixed(2)})`);
}

function updateInteraction() {
  if (chatInputOpen || addPostOpen) {
    hintEl.classList.add('hidden');
    return;
  }

  let hint = '';
  let hovered: Interactable | null = null;
  let nearEntranceOwner: string | null = null;
  let nearExit = false;
  let isOwnHub = false;

  if (mode === 'plaza') {
    if (!hubTransitionInFlight) {
      const nearHub = hubManager.findNearestEntrance(controls.object.position.x, controls.object.position.z);
      nearEntranceOwner = nearHub?.owner ?? null;
    }
  } else if (currentHubOwner) {
    const origin = hubManager.originFor(currentHubOwner);
    const built = hubManager.getBuilt(currentHubOwner);
    isOwnHub = currentHubOwner === myName;

    if (origin) {
      const localX = controls.object.position.x - origin.x;
      const localZ = controls.object.position.z - origin.z;
      nearExit = Math.hypot(localX - HUB_EXIT_ZONE.x, localZ - HUB_EXIT_ZONE.z) < HUB_EXIT_ZONE.radius;
    }

    if (!openPost && built) {
      camera.getWorldPosition(raycastOrigin);
      camera.getWorldDirection(raycastDir);
      raycaster.set(raycastOrigin, raycastDir);
      const hits = raycaster.intersectObjects(built.interactables.map((i) => i.object), true);
      if (hits.length > 0 && hits[0].distance <= INTERACT_DISTANCE) {
        hovered = findInteractable(hits[0].object, built.interactables);
      }
    }
  }

  if (openPost) {
    hint = 'Pressione E para fechar';
  } else if (hovered) {
    hint = `Pressione E — ${hovered.label}`;
  } else if (nearEntranceOwner) {
    hint = `Pressione E para entrar no hub de ${nearEntranceOwner}`;
  } else if (nearExit) {
    hint = isOwnHub ? 'Pressione E para sair · N para novo post' : 'Pressione E para sair';
  } else if (isOwnHub) {
    hint = 'Pressione N para adicionar um post';
  }

  hintEl.textContent = hint;
  hintEl.classList.toggle('hidden', hint === '');

  if (eJustPressed) {
    if (openPost) {
      // Normally unreachable — opening a post releases pointer lock, which
      // stops updateInteraction from running at all — but exitPointerLock()
      // is asynchronous, so a fast second E-press could still land here in
      // the brief window before that takes effect. Keep it in sync with the
      // real close paths (Fechar button, Escape) rather than leaving it as
      // dead code that quietly forgets to resume the pointer lock.
      closePostPanel();
      resumeAfterUI();
    } else if (hovered) {
      openPostPanel(hovered.post);
    } else if (mode === 'plaza' && nearEntranceOwner) {
      enterHub(nearEntranceOwner);
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
      const origin = mode === 'hub' && currentHubOwner ? hubManager.originFor(currentHubOwner) : null;
      const localX = origin ? camera.position.x - origin.x : camera.position.x;
      const localZ = origin ? camera.position.z - origin.z : camera.position.z;
      network.sendMove(localX, camera.position.y, localZ, camera.rotation.y, mode, currentHubOwner ?? '');
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
    `hub=${currentHubOwner ?? 'none'}  myName=${myName || 'none'}`,
  ]);

  renderer.render(scene, camera);
}

log('info', `initial camera pos=(${camera.position.x}, ${camera.position.y}, ${camera.position.z}) scene.children=${scene.children.length}`);
animate(performance.now());
