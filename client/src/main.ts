import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { HUB_EXIT_ZONE, type Interactable } from './hub-builder';
import { HubManager, ROOM_HALF, disposeObject3D } from './hub-manager';
import type { HubPost } from './hub-types';
import { log, initDebugPanel, updateStats, installGlobalErrorLogging } from './logger';
import { Network } from './network';
import { AvatarManager } from './avatars';
import { NpcManager, type NpcDef } from './npc-manager';
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

// NPC UI selectors
const npcPanelEl = document.querySelector<HTMLDivElement>('#npc-panel')!;
const npcPanelNameEl = document.querySelector<HTMLHeadingElement>('#npc-panel-name')!;
const npcPanelTextEl = document.querySelector<HTMLParagraphElement>('#npc-panel-text')!;
const npcPanelRewardEl = document.querySelector<HTMLDivElement>('#npc-panel-sticker-reward')!;
const npcBtnActionEl = document.querySelector<HTMLButtonElement>('#npc-btn-action')!;
const npcBtnStickerEl = document.querySelector<HTMLButtonElement>('#npc-btn-sticker')!;
const npcPanelCloseEl = document.querySelector<HTMLButtonElement>('#npc-panel-close')!;
const npcStickersListEl = document.querySelector<HTMLDivElement>('#npc-panel-stickers-list')!;

// Game Master UI selectors
const gmHelpBadgeEl = document.querySelector<HTMLDivElement>('#gm-help-badge')!;
const gmPanelEl = document.querySelector<HTMLDivElement>('#gm-panel')!;
const gmPanelCloseEl = document.querySelector<HTMLButtonElement>('#gm-panel-close')!;
const gmBtnNpcsEl = document.querySelector<HTMLButtonElement>('#gm-btn-npcs')!;
const gmBtnTreesEl = document.querySelector<HTMLButtonElement>('#gm-btn-trees')!;
const gmBtnCanopiesEl = document.querySelector<HTMLButtonElement>('#gm-btn-canopies')!;
const gmBtnLakeEl = document.querySelector<HTMLButtonElement>('#gm-btn-lake')!;
const gmBtnAllEl = document.querySelector<HTMLButtonElement>('#gm-btn-all')!;

// Builder Mode UI selectors
const gmBtnToggleBuildEl = document.querySelector<HTMLButtonElement>('#gm-btn-toggle-build')!;
const gmSelectBuildTypeEl = document.querySelector<HTMLSelectElement>('#gm-select-build-type')!;
const builderStatusEl = document.querySelector<HTMLDivElement>('#builder-status')!;
const builderStatusItemEl = document.querySelector<HTMLElement>('#builder-status-item')!;

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
  log(
    'info',
    `resizeRenderer: ${width}x${height} (canvas rect now ${canvas.getBoundingClientRect().width}x${canvas.getBoundingClientRect().height})`
  );
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ff);
scene.fog = new THREE.Fog(0xbfe3ff, 25, 90);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
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
  new THREE.MeshStandardMaterial({ color: 0x4a8a4f, roughness: 1 })
);
grass.rotation.x = -Math.PI / 2;
grass.receiveShadow = true;
scene.add(grass);

const plaza = new THREE.Mesh(
  new THREE.CircleGeometry(14, 48),
  new THREE.MeshStandardMaterial({ color: 0xe8d9b5, roughness: 0.9 })
);
plaza.rotation.x = -Math.PI / 2;
plaza.position.y = 0.01;
plaza.receiveShadow = true;
scene.add(plaza);

// --- Lake & Path to the Main Park (Plaza) ---------------------------------------

const lakeElements: THREE.Object3D[] = [];

function spawnLake() {
  // A sand path connecting the plaza to the lake
  const lakePath = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.01, 14),
    new THREE.MeshStandardMaterial({ color: 0xe8d9b5, roughness: 0.9 })
  );
  // Path extends from z = -14 (plaza edge) to z = -28. Center is at z = -21.
  lakePath.position.set(0, 0.015, -21);
  lakePath.receiveShadow = true;
  scene.add(lakePath);
  lakeElements.push(lakePath);

  // Lake water
  const lakeWater = new THREE.Mesh(
    new THREE.CircleGeometry(7, 32),
    new THREE.MeshStandardMaterial({ color: 0x2a7b9b, roughness: 0.1, metalness: 0.1 })
  );
  lakeWater.rotation.x = -Math.PI / 2;
  lakeWater.position.set(0, 0.016, -35);
  lakeWater.receiveShadow = true;
  scene.add(lakeWater);
  lakeElements.push(lakeWater);

  // Wooden Pier extending into the lake
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.08, 3),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 })
  );
  // Starts at z = -28 (path end) and extends to z = -31 (extends 1.5 units into the lake)
  pier.position.set(0, 0.05, -29.5);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);
  lakeElements.push(pier);

  // Lily pads floating on the water
  const lilyPadGeo = new THREE.CircleGeometry(0.4, 8);
  const lilyPadMat = new THREE.MeshStandardMaterial({ color: 0x3d8c40, roughness: 0.8 });

  const padLocations: [number, number][] = [
    [-2, -33],
    [2.5, -36.5],
    [-1.5, -38],
  ];
  for (const [lx, lz] of padLocations) {
    const pad = new THREE.Mesh(lilyPadGeo, lilyPadMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(lx, 0.02, lz);
    pad.receiveShadow = true;
    scene.add(pad);
    lakeElements.push(pad);
  }

  // Decorative rocks around the lake perimeter
  const rockGeo = new THREE.DodecahedronGeometry(0.5);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
  const rockLocations: [number, number, number][] = [
    [-6.5, -32.5, 0.9],
    [6.8, -33.5, 0.8],
    [-5.5, -39.5, 1.2],
    [5.0, -40.0, 1.0],
    [-1.5, -42.0, 0.7],
    [2.0, -41.8, 1.1],
  ];
  for (const [rx, rz, rs] of rockLocations) {
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.scale.set(rs, rs * 0.7, rs);
    rock.position.set(rx, rs * 0.35, rz);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    lakeElements.push(rock);
  }
}

function clearLake() {
  lakeElements.forEach((el) => {
    scene.remove(el);
    disposeObject3D(el);
  });
  lakeElements.length = 0;
}

spawnLake();

// --- Simple procedural trees ----------------------------------------------------

function makeTree(x: number, z: number, scale = 1) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 })
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
  [-18, -10, 1.1],
  [-22, 4, 0.9],
  [-16, 16, 1.2],
  [-9, 22, 1],
  [18, -8, 1],
  [23, 6, 1.15],
  [15, 18, 0.9],
  [8, 24, 1.05],
  [-24, -18, 1],
  [22, -20, 1.1],
  [-5, -18, 0.95],
  [5, -18, 1],
];

const treeGroups: THREE.Group[] = [];

function spawnTrees() {
  for (const [x, z, s] of treePositions) {
    const tree = makeTree(x, z, s);
    scene.add(tree);
    treeGroups.push(tree);
  }
}

function clearTrees() {
  treeGroups.forEach((tree) => {
    scene.remove(tree);
    disposeObject3D(tree);
  });
  treeGroups.length = 0;
}

spawnTrees();

// --- Solar canopy (feira market roof) — the solarpunk marketplace signature -----

function makeSolarCanopy(x: number, z: number, rotation = 0) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xd8d2c2,
    roughness: 0.5,
    metalness: 0.3,
  });

  const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8);
  const offsets: [number, number][] = [
    [-1.6, -1.1],
    [1.6, -1.1],
    [-1.6, 1.1],
    [1.6, 1.1],
  ];
  for (const [ox, oz] of offsets) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(ox, 1.3, oz);
    pole.castShadow = true;
    group.add(pole);
  }

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.08, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x274a63, roughness: 0.3, metalness: 0.6 })
  );
  panel.position.y = 2.7;
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  return group;
}

const solarCanopyGroups: THREE.Group[] = [];

function spawnSolarCanopies() {
  const c1 = makeSolarCanopy(-6, 0, 0.3);
  const c2 = makeSolarCanopy(6, -1.5, -0.2);
  const c3 = makeSolarCanopy(0, 6, Math.PI / 2);
  scene.add(c1);
  scene.add(c2);
  scene.add(c3);
  solarCanopyGroups.push(c1, c2, c3);
}

function clearSolarCanopies() {
  solarCanopyGroups.forEach((c) => {
    scene.remove(c);
    disposeObject3D(c);
  });
  solarCanopyGroups.length = 0;
}

spawnSolarCanopies();

// --- Content Garden hubs: one per registered friend, fetched from the server ---

const hubManager = new HubManager(scene);
hubManager.refreshList().catch((err) => log('error', `failed to load hub list: ${err}`));

const npcManager = new NpcManager(scene);

type Mode = 'plaza' | 'hub';
let mode: Mode = 'plaza';
let currentHubOwner: string | null = null;
let hubTransitionInFlight = false;
let myName = '';
let openPost: HubPost | null = null;
let openNpc: NpcDef | null = null;
let gmPanelOpen = false;
type BuildType = 'tree' | 'canopy' | 'rock' | 'plank' | 'lily';
let currentBuildType: BuildType = 'tree';
let builderModeActive = false;
const gmPlacedObjects: THREE.Object3D[] = [];
let stickersCollected: string[] = [];
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
network.onDisconnected = (reason) =>
  appendChatLine('', `Desconectado do servidor (${reason})`, true);

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
  const name =
    nameInputEl.value.trim().slice(0, 24) || `Visitante${Math.floor(Math.random() * 900 + 100)}`;
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
      gmHelpBadgeEl.classList.remove('hidden');
      requestLock();

      api
        .getPlayerStickers(name)
        .then((stickers) => {
          stickersCollected = stickers;
          log('info', `loaded player stickers: ${stickers.join(', ')}`);
        })
        .catch((err) => log('error', `failed to load player stickers: ${err}`));
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
        if (joinStatusEl.textContent === 'Aguarde um instante e clique novamente.')
          joinStatusEl.textContent = '';
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
  if (openNpc) closeNpcPanel();
  if (addPostOpen) closeAddPostForm();
  if (gmPanelOpen) closeGmPanel();
  resumeAfterUI();
});

// The overlay sits visually on top of the canvas while visible, so it (not
// the canvas) is what actually receives the click that should engage pointer
// lock — only meaningful once already connected (the join form handles the
// first connection, via its submit handler above).
overlay.addEventListener('click', (e) => {
  if (!connected || e.target === nameInputEl || (e.target as HTMLElement).closest('#join-form'))
    return;
  log(
    'info',
    `overlay clicked, requesting pointer lock (document.hasFocus=${document.hasFocus()}, visibilityState=${document.visibilityState})`
  );
  requestLock();
});
controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
  document.body.classList.add('locked');
  log(
    'info',
    `pointer lock ENGAGED — camera pos=(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}) ` +
      `rot(yaw,pitch deg)=(${THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(1)}, ${THREE.MathUtils.radToDeg(camera.rotation.x).toFixed(1)}) scene.children=${scene.children.length}`
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
  closeNpcPanel();
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

function openGmPanel() {
  gmPanelOpen = true;
  Object.keys(keys).forEach((code) => (keys[code] = false));
  gmPanelEl.classList.remove('hidden');
  velocity.set(0, 0, 0);
  releasePointerForUI();
  ghostGroup.visible = false; // Hide ghost when menu is open
  log('info', 'GM builder panel opened');
}

function closeGmPanel() {
  gmPanelOpen = false;
  gmPanelEl.classList.add('hidden');
  log('info', 'GM builder panel closed');
}

gmHelpBadgeEl.addEventListener('click', () => {
  if (!connected || chatInputOpen || addPostOpen || openPost || openNpc) return;
  if (gmPanelOpen) {
    closeGmPanel();
    resumeAfterUI();
  } else {
    openGmPanel();
  }
});

gmPanelCloseEl.addEventListener('click', () => {
  closeGmPanel();
  resumeAfterUI();
});

// --- Builder Mode: Minecraft-style placement & raycasting preview --------------

const ghostGroup = new THREE.Group();
ghostGroup.visible = false;
scene.add(ghostGroup);

const ghostMaterial = new THREE.MeshBasicMaterial({
  color: 0x81b29a,
  transparent: true,
  opacity: 0.4,
  wireframe: true,
});

function updateGhostVisual() {
  while (ghostGroup.children.length > 0) {
    const child = ghostGroup.children[0];
    ghostGroup.remove(child);
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
    }
  }

  if (currentBuildType === 'tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8), ghostMaterial);
    trunk.position.y = 0.7;
    ghostGroup.add(trunk);

    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.9 - i * 0.15, 8, 8), ghostMaterial);
      puff.position.y = 1.6 + i * 0.55;
      ghostGroup.add(puff);
    }
  } else if (currentBuildType === 'canopy') {
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6);
    const offsets: [number, number][] = [
      [-1.6, -1.1],
      [1.6, -1.1],
      [-1.6, 1.1],
      [1.6, 1.1],
    ];
    for (const [ox, oz] of offsets) {
      const pole = new THREE.Mesh(poleGeo, ghostMaterial);
      pole.position.set(ox, 1.3, oz);
      ghostGroup.add(pole);
    }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 2.6), ghostMaterial);
    panel.position.y = 2.7;
    ghostGroup.add(panel);
  } else if (currentBuildType === 'rock') {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5), ghostMaterial);
    rock.position.y = 0.35;
    ghostGroup.add(rock);
  } else if (currentBuildType === 'plank') {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.5), ghostMaterial);
    plank.position.y = 0.2;
    ghostGroup.add(plank);
  } else if (currentBuildType === 'lily') {
    const lily = new THREE.Mesh(new THREE.CircleGeometry(0.4, 8), ghostMaterial);
    lily.rotation.x = -Math.PI / 2;
    lily.position.y = 0.02;
    ghostGroup.add(lily);
  }
}

function spawnObjectAt(type: BuildType, pos: THREE.Vector3) {
  let obj: THREE.Object3D;
  if (type === 'tree') {
    obj = makeTree(pos.x, pos.z, 1.0);
    scene.add(obj);
  } else if (type === 'canopy') {
    obj = makeSolarCanopy(pos.x, pos.z, 0);
    scene.add(obj);
  } else if (type === 'rock') {
    const rockGeo = new THREE.DodecahedronGeometry(0.5);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
    const mesh = new THREE.Mesh(rockGeo, rockMat);
    mesh.scale.set(1.1, 0.8, 1.1);
    mesh.position.set(pos.x, 0.5 * 0.35, pos.z);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obj = mesh;
  } else if (type === 'plank') {
    const plankGeo = new THREE.BoxGeometry(1.5, 0.4, 1.5);
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
    const mesh = new THREE.Mesh(plankGeo, plankMat);
    mesh.position.set(pos.x, 0.2, pos.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obj = mesh;
  } else {
    // lily
    const lilyGeo = new THREE.CircleGeometry(0.4, 8);
    const lilyMat = new THREE.MeshStandardMaterial({ color: 0x3d8c40, roughness: 0.8 });
    const mesh = new THREE.Mesh(lilyGeo, lilyMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.02, pos.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    obj = mesh;
  }
  gmPlacedObjects.push(obj);
  log('info', `GM placed object: ${type} at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`);
}

gmBtnToggleBuildEl.addEventListener('click', () => {
  builderModeActive = !builderModeActive;
  if (builderModeActive) {
    gmBtnToggleBuildEl.textContent = 'Ativado';
    gmBtnToggleBuildEl.classList.add('active');
    builderStatusEl.classList.remove('hidden');
    updateGhostVisual();

    // Close GM menu and lock mouse to start building
    closeGmPanel();
    resumeAfterUI();
  } else {
    gmBtnToggleBuildEl.textContent = 'Desativado';
    gmBtnToggleBuildEl.classList.remove('active');
    builderStatusEl.classList.add('hidden');

    // Clear ghost visual
    ghostGroup.visible = false;
    while (ghostGroup.children.length > 0) {
      const child = ghostGroup.children[0];
      ghostGroup.remove(child);
      if (child instanceof THREE.Mesh) child.geometry?.dispose();
    }
  }
});

gmSelectBuildTypeEl.addEventListener('change', () => {
  currentBuildType = gmSelectBuildTypeEl.value as BuildType;

  // Update UI text in status bar
  const emojiMap: Record<BuildType, string> = {
    tree: '🌳 Árvore',
    canopy: '☀️ Tenda Solar',
    rock: '🪨 Rocha',
    plank: '🪵 Bloco de Madeira',
    lily: '🪷 Vitória Régia',
  };
  builderStatusItemEl.textContent = emojiMap[currentBuildType];

  if (builderModeActive) {
    updateGhostVisual();
  }
});

// Mouse events for placing / breaking
window.addEventListener('mousedown', (e) => {
  if (!controls.isLocked || !builderModeActive) return;

  // Left Click (button 0): Spawn
  if (e.button === 0 && ghostGroup.visible) {
    e.preventDefault();
    spawnObjectAt(currentBuildType, ghostGroup.position);
  }

  // Right Click (button 2): Break
  if (e.button === 2) {
    e.preventDefault();
    camera.getWorldPosition(raycastOrigin);
    camera.getWorldDirection(raycastDir);
    raycaster.set(raycastOrigin, raycastDir);
    const hits = raycaster.intersectObjects(gmPlacedObjects, true);
    if (hits.length > 0 && hits[0].distance <= 25) {
      let target: THREE.Object3D | null = hits[0].object;
      while (target && !gmPlacedObjects.includes(target)) {
        target = target.parent;
      }
      if (target) {
        scene.remove(target);
        disposeObject3D(target);
        const idx = gmPlacedObjects.indexOf(target);
        if (idx !== -1) gmPlacedObjects.splice(idx, 1);
        log(
          'info',
          `GM broke object at (${target.position.x.toFixed(2)}, ${target.position.z.toFixed(2)})`
        );
      }
    }
  }
});

window.addEventListener('contextmenu', (e) => {
  if (controls.isLocked && builderModeActive) {
    e.preventDefault();
  }
});

gmBtnNpcsEl.addEventListener('click', () => {
  npcManager.respawn();
  log('info', 'GM triggered NPCs respawn');
});

gmBtnTreesEl.addEventListener('click', () => {
  clearTrees();
  spawnTrees();
  log('info', 'GM triggered Trees respawn');
});

gmBtnCanopiesEl.addEventListener('click', () => {
  clearSolarCanopies();
  spawnSolarCanopies();
  log('info', 'GM triggered Solar Canopies respawn');
});

gmBtnLakeEl.addEventListener('click', () => {
  clearLake();
  spawnLake();
  log('info', 'GM triggered Lake & Deck respawn');
});

gmBtnAllEl.addEventListener('click', () => {
  npcManager.respawn();
  clearTrees();
  spawnTrees();
  clearSolarCanopies();
  spawnSolarCanopies();
  clearLake();
  spawnLake();

  // Clean up all GM-placed builder objects
  gmPlacedObjects.forEach((obj) => {
    scene.remove(obj);
    disposeObject3D(obj);
  });
  gmPlacedObjects.length = 0;

  log('info', 'GM triggered full world respawn');
});

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
  if (
    e.code === 'Enter' &&
    controls.isLocked &&
    !openPost &&
    !chatInputOpen &&
    !addPostOpen &&
    !gmPanelOpen
  )
    openChatInput();
  if (
    e.code === 'KeyN' &&
    controls.isLocked &&
    !openPost &&
    !chatInputOpen &&
    !addPostOpen &&
    !gmPanelOpen &&
    mode === 'hub' &&
    currentHubOwner === myName
  ) {
    openAddPostForm();
  }
  if (e.code === 'KeyB' && connected && !chatInputOpen && !addPostOpen && !openPost && !openNpc) {
    if (gmPanelOpen) {
      closeGmPanel();
      resumeAfterUI();
    } else {
      openGmPanel();
    }
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
    controls.object.position.set(
      origin.x + built.spawnPoint.x,
      built.spawnPoint.y,
      origin.z + built.spawnPoint.z
    );
    camera.rotation.set(0, built.spawnYaw, 0);
    velocity.set(0, 0, 0);
    log(
      'info',
      `entered hub "${owner}" — teleported to (${controls.object.position.x.toFixed(2)}, ${controls.object.position.y.toFixed(2)}, ${controls.object.position.z.toFixed(2)})`
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
  log(
    'info',
    `exited hub — restored to (${controls.object.position.x.toFixed(2)}, ${controls.object.position.y.toFixed(2)}, ${controls.object.position.z.toFixed(2)})`
  );
}

// --- NPC & Sticker Panel UI Handlers -------------------------------------------

const STICKERS = [
  {
    id: 'sticker_robot_1',
    name: 'Microchip de Ouro',
    emoji: '🪙',
    description: 'Concedido pelo Robô por dominar atalhos do PC.',
    npcType: 'robot',
  },
  {
    id: 'sticker_robot_2',
    name: 'Fibra Óptica Express',
    emoji: '⚡',
    description: 'Concedido pelo Robô por demonstrar conexão rápida.',
    npcType: 'robot',
  },
  {
    id: 'sticker_robot_3',
    name: 'Super Antena 5G',
    emoji: '📡',
    description: 'Concedido pelo Robô por captar excelentes dicas.',
    npcType: 'robot',
  },
  {
    id: 'sticker_joker_1',
    name: 'Risada Suprema',
    emoji: '🎭',
    description: 'Concedido pelo Coringa após ouvir uma ótima piada.',
    npcType: 'joker',
  },
  {
    id: 'sticker_joker_2',
    name: 'Buzina Maluca',
    emoji: '📯',
    description: 'Concedido pelo Coringa por espalhar bom humor.',
    npcType: 'joker',
  },
  {
    id: 'sticker_joker_3',
    name: 'Torta Flutuante',
    emoji: '🥧',
    description: 'Concedido pelo Coringa por sobreviver ao stand-up.',
    npcType: 'joker',
  },
  {
    id: 'sticker_romance_1',
    name: 'Flecha do Cupido',
    emoji: '💘',
    description: 'Concedido pelo Romântico por demonstrar carisma.',
    npcType: 'romance',
  },
  {
    id: 'sticker_romance_2',
    name: 'Coração Pixelado',
    emoji: '💖',
    description: 'Concedido pelo Romântico para corações apaixonados.',
    npcType: 'romance',
  },
  {
    id: 'sticker_romance_3',
    name: 'Poção do Amor',
    emoji: '🧪',
    description: 'Concedido pelo Romântico para encontros perfeitos.',
    npcType: 'romance',
  },
];

function renderStickerAlbum(npcType: 'robot' | 'joker' | 'romance') {
  const npcStickers = STICKERS.filter((s) => s.npcType === npcType);
  npcStickersListEl.innerHTML = npcStickers
    .map((sticker) => {
      const isUnlocked = stickersCollected.includes(sticker.id);
      const klass = isUnlocked ? 'sticker-item unlocked' : 'sticker-item locked';
      return `
        <div class="${klass}" title="${sticker.description}">
          <div class="sticker-emoji">${sticker.emoji}</div>
          <div class="sticker-name">${sticker.name}</div>
          <div class="sticker-desc">${sticker.description}</div>
        </div>
      `;
    })
    .join('');
}

function openNpcPanel(npc: NpcDef) {
  openNpc = npc;
  npcPanelNameEl.textContent = npc.displayName;
  npcPanelRewardEl.classList.add('hidden');
  npcPanelRewardEl.textContent = '';

  if (npc.id === 'robot') {
    npcBtnActionEl.textContent = 'Pedir Dica';
    npcPanelTextEl.textContent =
      'Olá! Eu sou o Robô da Net. Quer aprender algum atalho ou truque de computador?';
  } else if (npc.id === 'joker') {
    npcBtnActionEl.textContent = 'Pedir Piada';
    npcPanelTextEl.textContent =
      'Olá! Eu sou o Coringa do Feirão. Preparado para dar umas risadas?';
  } else {
    npcBtnActionEl.textContent = 'Pedir Cantada / Encontro';
    npcPanelTextEl.textContent =
      'Olá! Eu sou o Cupido Solarpunk. Procurando ideias de encontros ou cantadas românticas?';
  }

  renderStickerAlbum(npc.id);
  npcPanelEl.classList.remove('hidden');
  velocity.set(0, 0, 0);
  releasePointerForUI();
  log('info', `NPC panel opened: ${npc.id}`);
}

function closeNpcPanel() {
  openNpc = null;
  npcPanelEl.classList.add('hidden');
  log('info', 'NPC panel closed');
}

npcPanelCloseEl.addEventListener('click', () => {
  closeNpcPanel();
  resumeAfterUI();
});

npcBtnActionEl.addEventListener('click', () => {
  if (!openNpc) return;
  npcPanelRewardEl.classList.add('hidden');

  api
    .getRandomNpcDialogue(openNpc.id)
    .then((res) => {
      npcPanelTextEl.textContent = res.content;
      log('info', `Fetched dialogue for ${openNpc?.id}: ${res.content}`);
    })
    .catch((err) => {
      log('error', `Failed to fetch NPC dialogue: ${err}`);
      npcPanelTextEl.textContent = 'Ops, deu um erro de conexão ao falar com o NPC!';
    });
});

npcBtnStickerEl.addEventListener('click', () => {
  if (!openNpc || !myName) return;

  api
    .claimNpcSticker(myName, openNpc.id)
    .then((res) => {
      if (res.success && res.sticker) {
        if (!stickersCollected.includes(res.sticker.id)) {
          stickersCollected.push(res.sticker.id);
        }
        renderStickerAlbum(openNpc!.id);
        npcPanelRewardEl.innerHTML = `🎉 <strong>Sticker Desbloqueado!</strong> Você ganhou o sticker <strong>${res.sticker.emoji} ${res.sticker.name}</strong>!<br><span style="font-size:0.85rem">${res.sticker.description}</span>`;
        npcPanelRewardEl.classList.remove('hidden');
        log('info', `Claimed sticker ${res.sticker.id}`);
      } else if (res.error === 'cooldown') {
        const secs = Math.ceil((res.remainingTimeMs ?? 0) / 1000);
        npcPanelRewardEl.innerHTML = `⏳ <strong>Calma lá!</strong> O NPC está descansando. Tente novamente em <strong>${secs}s</strong>.`;
        npcPanelRewardEl.classList.remove('hidden');
      } else if (res.error === 'already_all') {
        npcPanelRewardEl.innerHTML = `🏆 <strong>Álbum Cheio!</strong> Você já coletou todos os stickers de ${openNpc?.displayName}!`;
        npcPanelRewardEl.classList.remove('hidden');
      } else {
        npcPanelRewardEl.innerHTML = `❌ Erro ao reivindicar: ${res.error}`;
        npcPanelRewardEl.classList.remove('hidden');
      }
    })
    .catch((err) => {
      log('error', `Failed to claim sticker: ${err}`);
      npcPanelRewardEl.innerHTML = `❌ Erro de conexão com o servidor.`;
      npcPanelRewardEl.classList.remove('hidden');
    });
});

// --- updateInteraction ---------------------------------------------------------

function updateInteraction() {
  if (chatInputOpen || addPostOpen) {
    hintEl.classList.add('hidden');
    return;
  }

  let hint = '';
  let hovered: Interactable | null = null;
  let hoveredNpc: NpcDef | null = null;
  let nearEntranceOwner: string | null = null;
  let nearExit = false;
  let isOwnHub = false;

  if (mode === 'plaza') {
    if (!hubTransitionInFlight) {
      const nearHub = hubManager.findNearestEntrance(
        controls.object.position.x,
        controls.object.position.z
      );
      nearEntranceOwner = nearHub?.owner ?? null;
    }

    // Raycast against NPCs in plaza
    if (!nearEntranceOwner && !openNpc && !openPost) {
      camera.getWorldPosition(raycastOrigin);
      camera.getWorldDirection(raycastDir);
      raycaster.set(raycastOrigin, raycastDir);
      const hits = raycaster.intersectObjects(npcManager.getInteractables(), true);
      if (hits.length > 0 && hits[0].distance <= INTERACT_DISTANCE) {
        hoveredNpc = npcManager.getNpcByObject(hits[0].object);
      }
    }
  } else if (currentHubOwner) {
    const origin = hubManager.originFor(currentHubOwner);
    const built = hubManager.getBuilt(currentHubOwner);
    isOwnHub = currentHubOwner === myName;

    if (origin) {
      const localX = controls.object.position.x - origin.x;
      const localZ = controls.object.position.z - origin.z;
      nearExit =
        Math.hypot(localX - HUB_EXIT_ZONE.x, localZ - HUB_EXIT_ZONE.z) < HUB_EXIT_ZONE.radius;
    }

    if (!openPost && built) {
      camera.getWorldPosition(raycastOrigin);
      camera.getWorldDirection(raycastDir);
      raycaster.set(raycastOrigin, raycastDir);
      const hits = raycaster.intersectObjects(
        built.interactables.map((i) => i.object),
        true
      );
      if (hits.length > 0 && hits[0].distance <= INTERACT_DISTANCE) {
        hovered = findInteractable(hits[0].object, built.interactables);
      }
    }
  }

  if (openPost) {
    hint = 'Pressione E para fechar';
  } else if (openNpc) {
    hint = 'Pressione E para fechar';
  } else if (hovered) {
    hint = `Pressione E — ${hovered.label}`;
  } else if (hoveredNpc) {
    hint = `Pressione E para falar com ${hoveredNpc.displayName}`;
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
      closePostPanel();
      resumeAfterUI();
    } else if (openNpc) {
      closeNpcPanel();
      resumeAfterUI();
    } else if (hovered) {
      openPostPanel(hovered.post);
    } else if (hoveredNpc) {
      openNpcPanel(hoveredNpc);
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

    if (builderModeActive) {
      camera.getWorldPosition(raycastOrigin);
      camera.getWorldDirection(raycastDir);
      raycaster.set(raycastOrigin, raycastDir);
      const hits = raycaster.intersectObjects([grass, plaza]);
      if (hits.length > 0 && hits[0].distance <= 25) {
        ghostGroup.position.copy(hits[0].point);
        ghostGroup.visible = true;
      } else {
        ghostGroup.visible = false;
      }
    } else {
      ghostGroup.visible = false;
    }

    sendAccum += delta;
    if (connected && sendAccum >= SEND_INTERVAL) {
      sendAccum = 0;
      const origin =
        mode === 'hub' && currentHubOwner ? hubManager.originFor(currentHubOwner) : null;
      const localX = origin ? camera.position.x - origin.x : camera.position.x;
      const localZ = origin ? camera.position.z - origin.z : camera.position.z;
      network.sendMove(
        localX,
        camera.position.y,
        localZ,
        camera.rotation.y,
        mode,
        currentHubOwner ?? ''
      );
    }

    // Flag any single-frame rotation big enough to plausibly explain "camera
    // suddenly stuck looking at the sky" — e.g. a cursor-warp artifact right
    // after requestPointerLock(), rather than a deliberate mouse move.
    const yawDeltaDeg = THREE.MathUtils.radToDeg(camera.rotation.y - prevYaw);
    const pitchDeltaDeg = THREE.MathUtils.radToDeg(camera.rotation.x - prevPitch);
    if (Math.abs(yawDeltaDeg) > 60 || Math.abs(pitchDeltaDeg) > 30) {
      log(
        'warn',
        `Large single-frame rotation jump: yaw Δ=${yawDeltaDeg.toFixed(1)}° pitch Δ=${pitchDeltaDeg.toFixed(1)}°`
      );
    }
  } else {
    ghostGroup.visible = false;
  }
  prevYaw = camera.rotation.y;
  prevPitch = camera.rotation.x;

  if (
    !nanGuardTripped &&
    (!Number.isFinite(camera.position.x) || !Number.isFinite(camera.position.z))
  ) {
    nanGuardTripped = true;
    log(
      'error',
      `Camera position went non-finite: (${camera.position.x}, ${camera.position.y}, ${camera.position.z}) — recovering to last known-good spot`
    );
    camera.position.set(lastGoodPosition.x, lastGoodPosition.y, lastGoodPosition.z);
    velocity.set(0, 0, 0);
  } else if (Number.isFinite(camera.position.x) && Number.isFinite(camera.position.z)) {
    lastGoodPosition.copy(camera.position);
    nanGuardTripped = false;
  }

  avatarManager.update(delta, timestamp / 1000);
  npcManager.update(delta, timestamp / 1000);

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

log(
  'info',
  `initial camera pos=(${camera.position.x}, ${camera.position.y}, ${camera.position.z}) scene.children=${scene.children.length}`
);
animate(performance.now());
