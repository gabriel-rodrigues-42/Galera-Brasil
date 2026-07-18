import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { HUB_EXIT_ZONE, type Interactable } from './hub-builder';
import { HubManager, ROOM_HALF, disposeObject3D } from './hub-manager';
import { log, initDebugPanel, updateStats, installGlobalErrorLogging } from './logger';
import { Network } from './network';
import { AvatarManager } from './avatars';
import { NpcManager, type NpcDef } from './npc-manager';
import { RadioManager } from './radio-manager';
import { EnemyManager } from './enemy-manager';
import { PickupManager } from './pickup-manager';
import { CombatManager } from './combat';
import { Hud } from './hud';
import * as api from './api';
import { registerUiComponents } from './ui';
import type { GmBadge } from './ui/components/gm-badge';
import type { GmPanel } from './ui/components/gm-panel';
import type { GmBuilderTab, PlacedItemView } from './ui/components/gm-builder-tab';
import type { GmSoundTab } from './ui/components/gm-sound-tab';
import type { GmPermissionsTab, HubPermissionRow } from './ui/components/gm-permissions-tab';
import type { BuilderStatus } from './ui/components/builder-status';
import { initGmController } from './ui/controllers/gm-controller';
import { initHubPanelsController } from './ui/controllers/hub-panels-controller';
import { initJoinController } from './ui/controllers/join-controller';
import type { JoinOverlay } from './ui/components/join-overlay';
import type { GuestbookPanel } from './ui/components/guestbook-panel';
import type { PostPanel } from './ui/components/post-panel';
import type { AddPostPanel } from './ui/components/add-post-panel';
import type { EnemyKind, RespawnTarget, VolumeChannel } from './ui/events';
import { BUILD_TYPE_LABELS, type BuildType } from './ui/gm-catalog';
import './ui/tokens.css';
import './ui/fonts.css';
import './style.css';

registerUiComponents();

installGlobalErrorLogging();
log('info', 'main.ts starting');

// --- Renderer / Scene / Camera -------------------------------------------------

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const overlay = document.querySelector<JoinOverlay>('#overlay')!;
const hintEl = document.querySelector<HTMLDivElement>('#interact-hint')!;
const guestbookPanelEl = document.querySelector<GuestbookPanel>('#guestbook-panel')!;
const postPanelEl = document.querySelector<PostPanel>('#post-panel')!;
const addPostPanelEl = document.querySelector<AddPostPanel>('#add-post-panel')!;

const debugPanelEl = document.querySelector<HTMLDivElement>('#debug-panel')!;
const debugBadgeEl = document.querySelector<HTMLButtonElement>('#debug-badge')!;
const debugStatsEl = document.querySelector<HTMLPreElement>('#debug-stats')!;
const debugLogEl = document.querySelector<HTMLPreElement>('#debug-log')!;
const chatLogEl = document.querySelector<HTMLDivElement>('#chat-log')!;
const chatCardEl = document.querySelector<HTMLDivElement>('#chat-card')!;
const chatCardHintEl = document.querySelector<HTMLSpanElement>('#chat-card-hint')!;
const chatUnreadEl = document.querySelector<HTMLSpanElement>('#chat-card-unread')!;
const chatInputEl = document.querySelector<HTMLInputElement>('#chat-input')!;

// NPC UI selectors
const npcPanelEl = document.querySelector<HTMLDivElement>('#npc-panel')!;
const npcPanelNameEl = document.querySelector<HTMLHeadingElement>('#npc-panel-name')!;
const npcPanelTextEl = document.querySelector<HTMLParagraphElement>('#npc-panel-text')!;
const npcPanelRewardEl = document.querySelector<HTMLDivElement>('#npc-panel-sticker-reward')!;
const npcShopEl = document.querySelector<HTMLDivElement>('#npc-shop')!;
const npcShopChineloEl = document.querySelector<HTMLButtonElement>('#npc-shop-chinelo')!;
const npcShopRepelenteEl = document.querySelector<HTMLButtonElement>('#npc-shop-repelente')!;
const npcShopSucoEl = document.querySelector<HTMLButtonElement>('#npc-shop-suco')!;
const npcBtnActionEl = document.querySelector<HTMLButtonElement>('#npc-btn-action')!;
const npcBtnStickerEl = document.querySelector<HTMLButtonElement>('#npc-btn-sticker')!;
const npcPanelCloseEl = document.querySelector<HTMLButtonElement>('#npc-panel-close')!;
const npcStickersListEl = document.querySelector<HTMLDivElement>('#npc-panel-stickers-list')!;
const npcStickerSectionEl = document.querySelector<HTMLDivElement>('#npc-panel-stickers-section')!;

// Game Master UI selectors (badge/panel/builder tab are now components — see
// ui/controllers/gm-controller.ts; the sound & permissions tabs stay legacy
// light-DOM markup, slotted into <gm-panel>, until PLAN-UI.md Phase 1b/1c)
const gmHelpBadgeEl = document.querySelector<GmBadge>('#gm-help-badge')!;
const gmPanelEl = document.querySelector<GmPanel>('#gm-panel')!;
const gmBuilderTabEl = document.querySelector<GmBuilderTab>('#gm-builder-tab')!;
const gmSoundTabEl = document.querySelector<GmSoundTab>('#gm-sound-tab')!;
const gmPermissionsTabEl = document.querySelector<GmPermissionsTab>('#gm-permissions-tab')!;
const builderStatusEl = document.querySelector<BuilderStatus>('#builder-status')!;

initDebugPanel(debugLogEl, debugStatsEl);

function toggleDebugPanel() {
  debugPanelEl.classList.toggle('collapsed');
}

async function copyDebugLogToClipboard() {
  const content = debugLogEl.textContent?.trim() || '';
  if (!content) return;
  try {
    await navigator.clipboard.writeText(content);
    log('info', 'debug log copied to clipboard (Ctrl+Shift+D)');
  } catch {
    // Fallback for browsers/environments where Clipboard API is unavailable.
    const ta = document.createElement('textarea');
    ta.value = content;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      log('info', 'debug log copied to clipboard (fallback)');
    } finally {
      document.body.removeChild(ta);
    }
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyD' && e.ctrlKey && e.shiftKey) {
    e.preventDefault();
    if (debugPanelEl.classList.contains('collapsed')) {
      debugPanelEl.classList.remove('collapsed');
    }
    void copyDebugLogToClipboard();
    return;
  }

  if (e.code !== 'Backquote' && e.key !== '~') return;
  e.preventDefault();
  toggleDebugPanel();
});

debugBadgeEl.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDebugPanel();
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
// (guestbookOpen/openPost moved to hubPanelsController)
let openNpc: NpcDef | null = null;
let currentBuildType: BuildType = 'tree';
let builderModeActive = false;
const gmPlacedObjects: THREE.Object3D[] = [];
let stickersCollected: string[] = [];
const lastPlazaTransform = { position: new THREE.Vector3(0, 1.7, 8), yaw: 0 };

// --- Multiplayer: networking, remote avatars, chat -----------------------------

function getServerUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  // In Vite dev, the client may run on any port (5173, 5174, ...), while the
  // game server stays on 2567. In production, websocket is same-origin.
  const isDev = import.meta.env.DEV;
  const host = isDev ? `${window.location.hostname}:2567` : window.location.host;
  return `${protocol}://${host}`;
}

const network = new Network(getServerUrl());
const avatarManager = new AvatarManager(scene, (hubId) => hubManager.originFor(hubId));
const enemyManager = new EnemyManager(scene);
const pickupManager = new PickupManager(scene);
const hud = new Hud();
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
  if (chatCompact) {
    chatUnread += 1;
    chatUnreadEl.textContent = String(chatUnread);
    chatUnreadEl.classList.remove('hidden');
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

// Battle: server-owned enemies mirror into the 3D scene; own stats drive the HUD.
// The Muriçoca Rainha (2.3) rides the same enemies map — spotting her kind
// here is what turns the big top-of-screen boss bar on and off.
let bossEnemyId = '';
network.onEnemyAdd = (enemyId, state) => {
  enemyManager.add(enemyId, state);
  if (state.kind === 'muricoca_rainha') {
    bossEnemyId = enemyId;
    hud.showBossBar();
    hud.updateBossBar(state.hp, state.maxHp, state.phase);
  }
};
network.onEnemyChange = (enemyId, state) => {
  enemyManager.updateTarget(enemyId, state);
  if (enemyId === bossEnemyId) hud.updateBossBar(state.hp, state.maxHp, state.phase);
};
network.onEnemyRemove = (enemyId) => {
  enemyManager.remove(enemyId);
  if (enemyId === bossEnemyId) {
    bossEnemyId = '';
    hud.hideBossBar();
  }
};
network.onPickupAdd = (pickupId, state) => pickupManager.add(pickupId, state);
network.onPickupChange = (pickupId, state) => pickupManager.updateTarget(pickupId, state);
network.onPickupRemove = (pickupId) => pickupManager.remove(pickupId);

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

// --- Battle system (2.0): weapons, projectiles, hit feedback --------------------

// Movement velocity lives up here (rather than with the other movement
// constants below) because the bonk knockback needs to push it.
const velocity = new THREE.Vector3();

const combat: CombatManager = new CombatManager({
  scene,
  camera,
  network,
  hud,
  enemyManager,
  avatarManager,
  // Attacks share the builder-mode mouse buttons — the two guards are mutually
  // exclusive (builder handler requires builderModeActive, this one forbids it).
  canAttack: () =>
    connected &&
    controls.isLocked &&
    !builderModeActive &&
    mode === 'plaza' &&
    !combat.isDead &&
    !chatInputOpen &&
    !hubPanelsController.isAddPostOpen &&
    !gmController.isOpen &&
    !hubPanelsController.isPostOpen &&
    !openNpc,
  canSwitch: () =>
    connected &&
    controls.isLocked &&
    !chatInputOpen &&
    !hubPanelsController.isAddPostOpen &&
    !gmController.isOpen,
  velocity,
  onRespawn: () => {
    controls.object.position.set(0, 1.7, 8);
    velocity.set(0, 0, 0);
  },
});

network.onAttackVisual = (event) => combat.handleAttackVisual(event);
network.onEnemyHit = (event) => combat.handleEnemyHit(event, performance.now() / 1000);
network.onEnemyDied = (event) => combat.handleEnemyDied(event);
network.onPlayerHit = (event) => combat.handlePlayerHit(event);
network.onBonk = (event) => combat.handleBonk(event);
network.onDied = (respawnInMs) => combat.handleDied(respawnInMs);
network.onRespawned = () => combat.handleRespawned();
network.onSelfChange = (state) => {
  hud.show();
  hud.updateSelf(state);
  combat.handleSelfState(state);
};
network.onBossEvent = (event) => combat.handleBossEvent(event);
network.onShopPurchaseResult = (event) => {
  if (!openNpc || openNpc.id !== 'vendor') return;
  npcPanelRewardEl.innerHTML = `${event.success ? '✅' : '❌'} ${event.message}`;
  npcPanelRewardEl.classList.remove('hidden');
};

const joinController = initJoinController({
  overlay,
  connect: (name) => network.connect(name),
  ensureOwnHub: (name) => hubManager.ensureOwnHub(name),
  setMyName: (name) => {
    myName = name;
    hubManager.setMyName(name);
  },
  setConnected: (val) => {
    connected = val;
  },
  appendSystemChatLine: (text) => appendChatLine('', text, true),
  requestLock,
  onJoined: () => {
    gmHelpBadgeEl.hidden = false;

    // Listen for other players placing/removing objects in real-time
    network.onObjectPlaced = (event) => {
      if (gmPlacedObjects.some((o) => o.name === event.id)) return;
      const pos = new THREE.Vector3(event.x, event.y, event.z);
      spawnObjectAt(event.type as BuildType, pos, event.id);
    };

    network.onObjectRemoved = (id) => {
      const target = gmPlacedObjects.find((o) => o.name === id);
      if (target) {
        scene.remove(target);
        disposeObject3D(target);
        const idx = gmPlacedObjects.indexOf(target);
        if (idx !== -1) gmPlacedObjects.splice(idx, 1);
      }
      npcManager.removeNpc(id);
      updatePlacedObjectsList();
    };

    network.onObjectsCleared = () => {
      gmPlacedObjects.forEach((obj) => {
        scene.remove(obj);
        disposeObject3D(obj);
      });
      gmPlacedObjects.length = 0;
      npcManager.destroy();

      setTimeout(() => {
        api
          .listPlacedObjects()
          .then((objects) => {
            objects.forEach((obj) => {
              if (gmPlacedObjects.some((o) => o.name === obj.id)) return;
              const pos = new THREE.Vector3(obj.x, obj.y, obj.z);
              spawnObjectAt(obj.type as BuildType, pos, obj.id);
            });
            log('info', 'reloaded placed objects after global clear');
            updatePlacedObjectsList();
          })
          .catch((err) => log('error', `failed to reload placed objects after clear: ${err}`));
      }, 100);
    };

    // Load initial placed objects from database
    api
      .listPlacedObjects()
      .then((objects) => {
        objects.forEach((obj) => {
          if (gmPlacedObjects.some((o) => o.name === obj.id)) return;
          const pos = new THREE.Vector3(obj.x, obj.y, obj.z);
          spawnObjectAt(obj.type as BuildType, pos, obj.id);
        });
        log('info', `loaded ${objects.length} placed objects from DB`);
        updatePlacedObjectsList();
      })
      .catch((err) => log('error', `failed to load initial placed objects: ${err}`));

    api
      .getPlayerStickers(myName)
      .then((stickers) => {
        stickersCollected = stickers;
        log('info', `loaded player stickers: ${stickers.join(', ')}`);
      })
      .catch((err) => log('error', `failed to load player stickers: ${err}`));
  },
});

joinController.init();

// `controls.lock()` fires-and-forgets `canvas.requestPointerLock()` without
// capturing the promise it returns, so any rejection (e.g. Chrome's ~1.3s
// cooldown after exiting a lock — SecurityError if you re-click too soon)
// surfaces only as an unhandled rejection. Call requestPointerLock ourselves
// so we can catch it and give the player visible feedback instead.
function requestLock() {
  canvas.requestPointerLock().catch((err: DOMException) => {
    log('warn', `pointer lock request rejected: ${err.name} — ${err.message}`);
    if (err.name === 'SecurityError') {
      joinController.setStatus('Aguarde um instante e clique novamente.');
      setTimeout(() => {
        joinController.setStatus('');
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
  if (hubPanelsController.isPostOpen) hubPanelsController.closePost();
  if (openNpc) closeNpcPanel();
  if (hubPanelsController.isAddPostOpen) hubPanelsController.closeAddPost();
  if (gmController.isOpen) gmController.close();
  if (hubPanelsController.isGuestbookOpen) hubPanelsController.closeGuestbook();
  resumeAfterUI();
});

// (overlay click listener replaced by joinController resume-click event)
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
  hubPanelsController.closePost();
  closeNpcPanel();
  closeChatInput();
  hubPanelsController.closeAddPost();
  log('info', 'pointer lock RELEASED');
});
// PointerLockControls logs this to console itself but doesn't expose it as a
// subscribable event, so hook the native event directly to get it on-screen too.
document.addEventListener('pointerlockerror', () => {
  log('error', 'pointerlockerror: browser refused the pointer lock request');
});

// --- Proximity chat -------------------------------------------------------------

let chatInputOpen = false;
let chatCompact = false;
let chatUnread = 0;

/** C toggles the chat card between full and a compact header-only pill —
 * never fully hidden, so announcements always have somewhere to land. */
function setChatCompact(compact: boolean) {
  chatCompact = compact;
  chatCardEl.classList.toggle('compact', compact);
  chatCardHintEl.textContent = compact ? 'C para abrir' : 'C para compactar';
  if (!compact) {
    chatUnread = 0;
    chatUnreadEl.classList.add('hidden');
  }
}

function openChatInput() {
  chatInputOpen = true;
  // Typing implies wanting to read — expand the card if it was compacted.
  if (chatCompact) setChatCompact(false);
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

// (addPostOpen/openAddPostForm/closeAddPostForm moved to hubPanelsController)

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

  if (currentBuildType.startsWith('npc:')) {
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.8, 4, 8), ghostMaterial);
    capsule.position.y = 0.64;
    ghostGroup.add(capsule);
  } else if (currentBuildType.startsWith('monster:')) {
    const kind = currentBuildType.split(':')[1];
    let yPos = 1.5;
    let geom: THREE.BufferGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    if (kind === 'mosquito') {
      yPos = 1.5;
      geom = new THREE.SphereGeometry(0.25, 8, 8);
    } else if (kind === 'barata') {
      yPos = 0.2;
      geom = new THREE.BoxGeometry(0.5, 0.15, 0.8);
    } else if (kind === 'pombo') {
      yPos = 1.2;
      geom = new THREE.BoxGeometry(0.4, 0.4, 0.5);
    }
    const mesh = new THREE.Mesh(geom, ghostMaterial);
    mesh.position.y = yPos;
    ghostGroup.add(mesh);
  } else if (currentBuildType === 'tree') {
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

function updatePlacedObjectsList() {
  const items: PlacedItemView[] = [...gmPlacedObjects]
    .sort((a, b) => camera.position.distanceTo(a.position) - camera.position.distanceTo(b.position))
    .map((obj) => {
      const type = (obj.userData.type || 'tree') as BuildType;
      const dist = camera.position.distanceTo(obj.position);
      return {
        id: obj.name,
        label: BUILD_TYPE_LABELS[type] || type,
        coordsStr: `(${obj.position.x.toFixed(1)}, ${obj.position.z.toFixed(1)})`,
        distStr: `${dist.toFixed(1)}m`,
      };
    });
  gmController.setPlacedObjects(items);
}

function deletePlacedObject(id: string) {
  const obj = gmPlacedObjects.find((o) => o.name === id);
  if (!obj) return;
  const coordsStr = `(${obj.position.x.toFixed(1)}, ${obj.position.z.toFixed(1)})`;

  scene.remove(obj);
  disposeObject3D(obj);
  const idx = gmPlacedObjects.indexOf(obj);
  if (idx !== -1) gmPlacedObjects.splice(idx, 1);

  // Also tell npcManager to clean it up in case it was an NPC
  npcManager.removeNpc(id);

  api.deletePlacedObject(id).catch((err) => log('error', `failed to delete: ${err}`));
  network.sendObjectRemoved(id);

  log('info', `GM broke object ${id} via list at ${coordsStr}`);
  updatePlacedObjectsList();
}

function spawnObjectAt(type: BuildType, pos: THREE.Vector3, id?: string) {
  let obj: THREE.Object3D;
  const finalId = id || self.crypto.randomUUID();

  if (type.startsWith('npc:')) {
    const npcType = type.split(':')[1] as 'robot' | 'joker' | 'romance' | 'vendor';
    npcManager.addNpc(finalId, npcType, pos);
    obj = scene.getObjectByName(finalId) || new THREE.Object3D();
  } else if (type.startsWith('monster:')) {
    obj = new THREE.Object3D();
    obj.position.copy(pos);
  } else if (type === 'tree') {
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

  obj.name = finalId;
  obj.userData.type = type;
  gmPlacedObjects.push(obj);

  if (!id) {
    // Locally placed by the player, persist to database and broadcast to other players
    const payload = { id: finalId, type, x: pos.x, y: pos.y, z: pos.z };
    api
      .addPlacedObject(payload)
      .catch((err) => log('error', `failed to persist placed object: ${err}`));
    network.sendObjectPlaced(payload);
  }

  log(
    'info',
    `GM placed object: ${type} (id=${finalId}) at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`
  );
  updatePlacedObjectsList();
}

// Build-mode toggle and build-type selection are now driven by <gm-builder-tab>
// events, wired in initGmController() below (see gm-controller.ts).
function clearGhost() {
  ghostGroup.visible = false;
  while (ghostGroup.children.length > 0) {
    const child = ghostGroup.children[0];
    ghostGroup.remove(child);
    if (child instanceof THREE.Mesh) child.geometry?.dispose();
  }
}

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

    // 1. Raycast against scenery & NPCs
    const hits = raycaster.intersectObjects(gmPlacedObjects, true);
    if (hits.length > 0 && hits[0].distance <= 25) {
      let target: THREE.Object3D | null = hits[0].object;
      while (target && !gmPlacedObjects.includes(target)) {
        target = target.parent;
      }
      if (target) {
        const idToDelete = target.name;
        scene.remove(target);
        disposeObject3D(target);
        const idx = gmPlacedObjects.indexOf(target);
        if (idx !== -1) gmPlacedObjects.splice(idx, 1);

        // Remove from npcManager in case it was an NPC
        npcManager.removeNpc(idToDelete);

        // Delete from database and broadcast removal
        api
          .deletePlacedObject(idToDelete)
          .catch((err) => log('error', `failed to delete placed object from DB: ${err}`));
        network.sendObjectRemoved(idToDelete);

        log(
          'info',
          `GM broke object ${idToDelete} at (${target.position.x.toFixed(2)}, ${target.position.z.toFixed(2)})`
        );
        updatePlacedObjectsList();
        return;
      }
    }

    // 2. Raycast against live monsters
    const enemyGroups = enemyManager.getGroups();
    const monsterHits = raycaster.intersectObjects(enemyGroups, true);
    if (monsterHits.length > 0 && monsterHits[0].distance <= 25) {
      const enemyId = enemyManager.getEnemyByObject(monsterHits[0].object);
      if (enemyId) {
        // Find proxy in gmPlacedObjects
        const target = gmPlacedObjects.find((o) => o.name === enemyId);
        if (target) {
          const idx = gmPlacedObjects.indexOf(target);
          if (idx !== -1) gmPlacedObjects.splice(idx, 1);
        }

        api
          .deletePlacedObject(enemyId)
          .catch((err) => log('error', `failed to delete monster spawn point: ${err}`));
        network.sendObjectRemoved(enemyId);

        log('info', `GM broke persistent monster ${enemyId}`);
        updatePlacedObjectsList();
      }
    }
  }
});

// Any locked state now uses right-click (builder break / chinelo quick-throw),
// so the browser context menu must never appear while locked.
window.addEventListener('contextmenu', (e) => {
  if (controls.isLocked) {
    e.preventDefault();
  }
});

function reloadNpcsFromDb() {
  npcManager.destroy();
  // Filter out NPC visual groups from gmPlacedObjects
  for (let i = gmPlacedObjects.length - 1; i >= 0; i--) {
    const obj = gmPlacedObjects[i];
    if (obj.userData.type && obj.userData.type.startsWith('npc:')) {
      gmPlacedObjects.splice(i, 1);
    }
  }

  api
    .listPlacedObjects()
    .then((objects) => {
      objects.forEach((obj) => {
        if (obj.type.startsWith('npc:')) {
          const pos = new THREE.Vector3(obj.x, obj.y, obj.z);
          spawnObjectAt(obj.type as BuildType, pos, obj.id);
        }
      });
      updatePlacedObjectsList();
    })
    .catch((err) => log('error', `failed to reload NPCs: ${err}`));
}

// Battle quick-actions & respawn buttons are now driven by <gm-builder-tab>
// events (gm-spawn-enemy / gm-spawn-boss / gm-clear-enemies / gm-respawn),
// wired in initGmController() below.
function onGmSpawnEnemy(kind: EnemyKind) {
  network.sendGmSpawnEnemy(kind);
  log('info', `GM requested ${kind} spawn`);
}

function onGmSpawnBoss() {
  network.sendGmSpawnBoss();
  log('info', 'GM requested Muriçoca Rainha spawn');
}

function onGmClearEnemies() {
  network.sendGmClearEnemies();
  log('info', 'GM requested mosquito clear');
}

function onGmRespawn(target: RespawnTarget) {
  switch (target) {
    case 'npcs':
      reloadNpcsFromDb();
      log('info', 'GM triggered NPCs reload from DB');
      break;
    case 'trees':
      clearTrees();
      spawnTrees();
      log('info', 'GM triggered Trees respawn');
      break;
    case 'canopies':
      clearSolarCanopies();
      spawnSolarCanopies();
      log('info', 'GM triggered Solar Canopies respawn');
      break;
    case 'lake':
      clearLake();
      spawnLake();
      log('info', 'GM triggered Lake & Deck respawn');
      break;
    case 'all':
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
      npcManager.destroy();

      // Clear database, reload defaults for local player and broadcast clear
      api
        .clearPlacedObjects()
        .then(() => {
          setTimeout(() => {
            api
              .listPlacedObjects()
              .then((objects) => {
                objects.forEach((obj) => {
                  if (gmPlacedObjects.some((o) => o.name === obj.id)) return;
                  const pos = new THREE.Vector3(obj.x, obj.y, obj.z);
                  spawnObjectAt(obj.type as BuildType, pos, obj.id);
                });
                updatePlacedObjectsList();
              })
              .catch((err) => log('error', `failed to reload placed objects after clear: ${err}`));
          }, 100);
        })
        .catch((err) => log('error', `failed to clear placed objects: ${err}`));

      network.sendObjectsCleared();
      log('info', 'GM triggered full world respawn');
      break;
  }
}

// (addPostForm listeners moved to add-post-panel component)

const keys: Record<string, boolean> = {};
let eJustPressed = false;
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyE') eJustPressed = true;
  if (
    e.code === 'Enter' &&
    controls.isLocked &&
    !hubPanelsController.isPostOpen &&
    !chatInputOpen &&
    !hubPanelsController.isAddPostOpen &&
    !gmController.isOpen
  )
    openChatInput();
  if (
    e.code === 'KeyN' &&
    controls.isLocked &&
    !hubPanelsController.isPostOpen &&
    !chatInputOpen &&
    !hubPanelsController.isAddPostOpen &&
    !gmController.isOpen &&
    mode === 'hub' &&
    currentHubOwner === myName
  ) {
    hubPanelsController.openAddPost();
  }
  if (
    e.code === 'KeyC' &&
    connected &&
    !chatInputOpen &&
    !hubPanelsController.isAddPostOpen &&
    !gmController.isOpen &&
    !hubPanelsController.isPostOpen &&
    !openNpc
  ) {
    setChatCompact(!chatCompact);
  }
  if (
    e.code === 'KeyB' &&
    connected &&
    !chatInputOpen &&
    !hubPanelsController.isAddPostOpen &&
    !hubPanelsController.isPostOpen &&
    !openNpc
  ) {
    if (gmController.isOpen) {
      gmController.close();
      resumeAfterUI();
    } else {
      gmController.open();
    }
  }
});
window.addEventListener('keyup', (e) => (keys[e.code] = false));

const MOVE_ACCEL = 60; // units/second^2
const MAX_SPEED = 5; // meters/second
const PLAZA_RADIUS = 58; // soft world boundary
const inputDir = new THREE.Vector3();

function isDown(...codes: string[]): boolean {
  return codes.some((code) => keys[code] === true);
}

function updateMovement(delta: number) {
  // frozen while a UI panel is open or while fainted (death overlay showing)
  if (
    hubPanelsController.isPostOpen ||
    chatInputOpen ||
    hubPanelsController.isAddPostOpen ||
    combat.isDead
  )
    return;

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

// (renderPostPanel moved to post-panel component)

// (openPostPanel/closePostPanel/openGuestbookPanel/closeGuestbookPanel moved to hubPanelsController)

function refreshGmPermissionsTab() {
  gmPermissionsTabEl.setLoading();

  api
    .getGMBypass()
    .then((res) => {
      gmPermissionsTabEl.setBypass(res.enabled);
    })
    .catch((err) => {
      log('error', `Failed to get GM bypass state: ${err}`);
    });

  api
    .listHubs()
    .then((summaries) => {
      if (summaries.length === 0) {
        gmPermissionsTabEl.setHubs([]);
        return;
      }
      return Promise.all(summaries.map((s) => api.getHub(s.owner)));
    })
    .then((hubs) => {
      if (!hubs) return;
      gmPermissionsTabEl.setHubs(hubs satisfies HubPermissionRow[]);
    })
    .catch((err) => {
      log('error', `Failed to load GM permissions: ${err}`);
      gmPermissionsTabEl.setError();
    });
}

// (renderGuestbookComments and related listeners moved to hubPanelsController)

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
  {
    id: 'sticker_vendor_1',
    name: 'Cesta de Vime',
    emoji: '🧺',
    description: 'Concedido por Dona Jurema por visitar a feira livre.',
    npcType: 'vendor',
  },
  {
    id: 'sticker_vendor_2',
    name: 'Chinelo de Ouro',
    emoji: '🩴',
    description: 'Concedido por Dona Jurema por ser um cliente fiel.',
    npcType: 'vendor',
  },
  {
    id: 'sticker_vendor_3',
    name: 'Suco Natural',
    emoji: '🍊',
    description: 'Concedido por Dona Jurema por valorizar a saúde.',
    npcType: 'vendor',
  },
];

function renderStickerAlbum(npcType: 'robot' | 'joker' | 'romance' | 'vendor') {
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
  npcShopEl.classList.add('hidden');

  if (npc.id === 'robot') {
    npcBtnActionEl.textContent = 'Pedir Dica';
    npcPanelTextEl.textContent =
      'Olá! Eu sou o Robô da Net. Quer aprender algum atalho ou truque de computador?';
    npcBtnActionEl.classList.remove('hidden');
    npcBtnStickerEl.classList.remove('hidden');
    npcStickerSectionEl.classList.remove('hidden');
    renderStickerAlbum(npc.id);
  } else if (npc.id === 'joker') {
    npcBtnActionEl.textContent = 'Pedir Piada';
    npcPanelTextEl.textContent =
      'Olá! Eu sou o Coringa do Feirão. Preparado para dar umas risadas?';
    npcBtnActionEl.classList.remove('hidden');
    npcBtnStickerEl.classList.remove('hidden');
    npcStickerSectionEl.classList.remove('hidden');
    renderStickerAlbum(npc.id);
  } else if (npc.id === 'romance') {
    npcBtnActionEl.textContent = 'Pedir Cantada / Encontro';
    npcPanelTextEl.textContent =
      'Olá! Eu sou o Cupido Solarpunk. Procurando ideias de encontros ou cantadas românticas?';
    npcBtnActionEl.classList.remove('hidden');
    npcBtnStickerEl.classList.remove('hidden');
    npcStickerSectionEl.classList.remove('hidden');
    renderStickerAlbum(npc.id);
  } else if (npc.id === 'vendor') {
    npcBtnActionEl.textContent = 'Falar com Feirante';
    npcPanelTextEl.textContent =
      'Bem-vindo à feira! Tenho reforço para chinelo, repelente e suco para voltar à luta.';
    npcBtnActionEl.classList.remove('hidden');
    npcBtnStickerEl.classList.remove('hidden');
    npcStickerSectionEl.classList.remove('hidden');
    npcShopEl.classList.remove('hidden');
    renderStickerAlbum(npc.id);
  } else {
    npcPanelTextEl.textContent = 'Olá!';
    npcBtnActionEl.classList.add('hidden');
    npcBtnStickerEl.classList.add('hidden');
    npcStickerSectionEl.classList.add('hidden');
  }

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
  const npcId = openNpc.id;

  api
    .claimNpcSticker(myName, openNpc.id)
    .then((res) => {
      if (res.success && res.sticker) {
        if (!stickersCollected.includes(res.sticker.id)) {
          stickersCollected.push(res.sticker.id);
        }
        renderStickerAlbum(npcId);
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

npcShopChineloEl.addEventListener('click', () => {
  if (!openNpc || openNpc.id !== 'vendor') return;
  network.sendShopPurchase('chinelo_reforcado');
});

npcShopRepelenteEl.addEventListener('click', () => {
  if (!openNpc || openNpc.id !== 'vendor') return;
  network.sendShopPurchase('repelente');
});

npcShopSucoEl.addEventListener('click', () => {
  if (!openNpc || openNpc.id !== 'vendor') return;
  network.sendShopPurchase('suco_laranja');
});

// --- updateInteraction ---------------------------------------------------------

function updateInteraction() {
  if (chatInputOpen || hubPanelsController.isAddPostOpen) {
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
    if (!nearEntranceOwner && !openNpc && !hubPanelsController.isPostOpen) {
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

    if (!hubPanelsController.isPostOpen && built) {
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

  if (hubPanelsController.isPostOpen) {
    hint = 'Pressione E para fechar';
  } else if (openNpc) {
    hint = 'Pressione E para fechar';
  } else if (hubPanelsController.isGuestbookOpen) {
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
    if (hubPanelsController.isPostOpen) {
      hubPanelsController.closePost();
      resumeAfterUI();
    } else if (openNpc) {
      closeNpcPanel();
      resumeAfterUI();
    } else if (hubPanelsController.isGuestbookOpen) {
      hubPanelsController.closeGuestbook();
      resumeAfterUI();
    } else if (hovered) {
      if (hovered.post.type === 'guestbook') {
        hubPanelsController.openGuestbook();
      } else {
        hubPanelsController.openPost(hovered.post);
      }
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
  enemyManager.update(delta, timestamp / 1000);
  pickupManager.update(delta, timestamp / 1000);
  combat.update(delta, timestamp / 1000);

  updateStats([
    `mode=${mode}  locked=${controls.isLocked}  fps=${fps.toFixed(0)}`,
    `pos=(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`,
    `rot yaw=${THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(1)}°  pitch=${THREE.MathUtils.radToDeg(camera.rotation.x).toFixed(1)}°`,
    `scene.children=${scene.children.length}  openPost=${hubPanelsController.isPostOpen ? 'active' : 'none'}`,
    `connected=${connected}  sessionId=${network.sessionId || 'none'}  remotePlayers=${avatarManager.count}`,
    `enemies=${enemyManager.count}  pickups=${pickupManager.count}  dead=${combat.isDead}`,
    `hub=${currentHubOwner ?? 'none'}  myName=${myName || 'none'}`,
  ]);

  renderer.render(scene, camera);
}

// --- Game Master Panel Controller (badge, panel shell, all 4 tabs) -----------
// Tab navigation, the builder card grid, the sound mixer/radio player, and the
// permissions list are all internal to <gm-panel> / <gm-builder-tab> /
// <gm-sound-tab> / <gm-permissions-tab> now; this wires their events to
// game/network state (Shortcuts is pure static content, no wiring needed).
const hubPanelsController = initHubPanelsController({
  guestbookPanel: guestbookPanelEl,
  postPanel: postPanelEl,
  addPostPanel: addPostPanelEl,

  getMyName: () => myName,
  getCurrentHubOwner: () => currentHubOwner,
  resetKeys: () => Object.keys(keys).forEach((code) => (keys[code] = false)),
  resetVelocity: () => velocity.set(0, 0, 0),
  releasePointerForUI,
  resumeAfterUI,

  rebuildHub: (owner) => hubManager.rebuild(owner).then(() => {}),
});

const gmController = initGmController({
  badge: gmHelpBadgeEl,
  panel: gmPanelEl,
  builderTab: gmBuilderTabEl,
  soundTab: gmSoundTabEl,
  permissionsTab: gmPermissionsTabEl,
  builderStatus: builderStatusEl,

  isConnected: () => connected,
  isChatInputOpen: () => chatInputOpen,
  isAddPostOpen: () => hubPanelsController.isAddPostOpen,
  hasOpenPost: () => hubPanelsController.isPostOpen,
  hasOpenNpc: () => !!openNpc,

  resetKeys: () => Object.keys(keys).forEach((code) => (keys[code] = false)),
  resetVelocity: () => velocity.set(0, 0, 0),
  releasePointerForUI,
  resumeAfterUI,

  isBuilderModeActive: () => builderModeActive,
  setBuilderModeActive: (active) => {
    builderModeActive = active;
  },
  updateGhostVisual,
  hideGhost: () => {
    ghostGroup.visible = false;
  },
  clearGhost,

  refreshPlacedList: updatePlacedObjectsList,
  onPlacedDelete: deletePlacedObject,

  onSpawnEnemy: onGmSpawnEnemy,
  onSpawnBoss: onGmSpawnBoss,
  onClearEnemies: onGmClearEnemies,
  onRespawn: onGmRespawn,

  resumeRadio: () => RadioManager.getInstance().resume(),
  refreshPermissions: refreshGmPermissionsTab,

  audioSource: {
    getAnalyser: () => RadioManager.getInstance().analyser,
    getIsPlaying: () => RadioManager.getInstance().getIsPlaying(),
  },
  getPlaybackState: () => {
    const radio = RadioManager.getInstance();
    if (radio.getIsPlaying()) {
      const track = radio.getCurrentTrack();
      return {
        isPlaying: true,
        trackName: track.name,
        trackGenreLine: `${track.genre} · ${track.tempo} BPM`,
      };
    }
    return {
      isPlaying: false,
      trackName: 'Rádio Desativada',
      trackGenreLine: 'Ligue para começar a relaxar',
    };
  },
  onRadioToggle: () => RadioManager.getInstance().toggleRadio(),
  onRadioNext: () => RadioManager.getInstance().nextTrack(),
  onRadioPrev: () => RadioManager.getInstance().prevTrack(),
  onVolumeChange: (channel: VolumeChannel, value: number) => {
    const radio = RadioManager.getInstance();
    if (channel === 'master') radio.setMasterVolume(value);
    else if (channel === 'sfx') radio.setSfxVolume(value);
    else radio.setRadioVolume(value);
  },

  setBuildType: (type) => {
    currentBuildType = type;
  },

  onBypassToggle: onGmBypassToggle,
  onHubPermissionToggle: onGmHubPermissionToggle,
});

// GM permissions tab actions are now driven by <gm-permissions-tab> events,
// wired in initGmController() above.
function onGmBypassToggle(enabled: boolean) {
  api
    .setGMBypass(enabled)
    .then((res) => {
      log('info', `GM Bypass Global set to ${res.enabled}`);
    })
    .catch((err) => {
      log('error', `Failed to set GM Bypass Global: ${err}`);
    });
}

function onGmHubPermissionToggle(owner: string, allowed: boolean) {
  api
    .updateHubSettings(owner, allowed)
    .then((res) => {
      if (res.success) {
        log('info', `GM updated settings for ${owner}: allow_visitor_posts = ${allowed}`);
      }
    })
    .catch((err) => {
      log('error', `GM failed to update settings for ${owner}: ${err}`);
    });
}

log(
  'info',
  `initial camera pos=(${camera.position.x}, ${camera.position.y}, ${camera.position.z}) scene.children=${scene.children.length}`
);
animate(performance.now());
