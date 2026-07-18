import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { randomUUID } from 'crypto';

const dbPath = path.resolve(__dirname, '../data.sqlite');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS hubs (
    owner TEXT PRIMARY KEY,
    bio TEXT NOT NULL DEFAULT '',
    tag TEXT NOT NULL DEFAULT '#GaleraBrasil',
    slot INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS npc_content (
    id TEXT PRIMARY KEY,
    npc_type TEXT NOT NULL, -- 'robot' | 'joker' | 'romance'
    category TEXT NOT NULL, -- 'tip' | 'joke' | 'date_idea' | 'hot_line'
    content TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS player_stickers (
    player_name TEXT NOT NULL,
    sticker_id TEXT NOT NULL,
    claimed_at INTEGER NOT NULL,
    PRIMARY KEY (player_name, sticker_id)
  );
  CREATE TABLE IF NOT EXISTS npc_cooldowns (
    player_name TEXT NOT NULL,
    npc_type TEXT NOT NULL,
    last_claimed_at INTEGER NOT NULL,
    PRIMARY KEY (player_name, npc_type)
  );
  CREATE TABLE IF NOT EXISTS placed_objects (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    z REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS player_stats (
    player_name TEXT PRIMARY KEY,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS player_upgrades (
    player_name TEXT PRIMARY KEY,
    reinforced_chinelo INTEGER NOT NULL DEFAULT 0,
    suco_count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
`);

// Lightweight migration for existing databases created before coins existed.
const playerStatsColumns = db.prepare('PRAGMA table_info(player_stats)').all() as {
  name: string;
}[];
if (!playerStatsColumns.some((c) => c.name === 'coins')) {
  db.exec('ALTER TABLE player_stats ADD COLUMN coins INTEGER NOT NULL DEFAULT 0');
}

const playerUpgradesColumns = db.prepare('PRAGMA table_info(player_upgrades)').all() as {
  name: string;
}[];
if (!playerUpgradesColumns.some((c) => c.name === 'suco_count')) {
  db.exec('ALTER TABLE player_upgrades ADD COLUMN suco_count INTEGER NOT NULL DEFAULT 0');
}

const hubsColumns = db.prepare('PRAGMA table_info(hubs)').all() as {
  name: string;
}[];
if (!hubsColumns.some((c) => c.name === 'allow_visitor_posts')) {
  db.exec('ALTER TABLE hubs ADD COLUMN allow_visitor_posts INTEGER NOT NULL DEFAULT 1');
}

// Pre-populate NPC content if empty
const countRow = db.prepare('SELECT COUNT(*) as c FROM npc_content').get() as { c: number };
if (countRow.c === 0) {
  const insertContent = db.prepare(
    'INSERT INTO npc_content (id, npc_type, category, content) VALUES (?, ?, ?, ?)'
  );

  // Robot tips
  const robotTips = [
    'Use Ctrl + Shift + T para reabrir a última aba fechada do navegador. Salva vidas!',
    'PC lento? Pressione Ctrl + Shift + Esc para abrir o Gerenciador de Tarefas diretamente.',
    'Pressione Windows + V para ativar e abrir o histórico da área de transferência. Você pode colar itens copiados anteriormente!',
    'Segure Alt ao clicar em um link para forçar o download do arquivo em vez de abri-lo.',
    'Pressione Windows + Shift + S para tirar um print de uma área específica da tela instantaneamente.',
    "Digite 'cmd' na barra de endereços do Explorador de Arquivos para abrir o prompt de comando direto na pasta atual.",
    'Se a sua tela congelar, pressione Win + Ctrl + Shift + B para reiniciar o driver de vídeo sem reiniciar o PC.',
  ];
  robotTips.forEach((tip) => {
    insertContent.run(randomUUID(), 'robot', 'tip', tip);
  });

  // Joker jokes
  const jokerJokes = [
    'Por que os programadores usam óculos? Porque eles não conseguem C#.',
    'Existem 10 tipos de pessoas no mundo: as que entendem binário e as que não entendem.',
    'Por que o computador foi ao hospital? Porque ele estava com um vírus!',
    'Qual é o lugar favorito de um programador para relaxar? O Foo Bar.',
    'Quantos programadores são necessários para trocar uma lâmpada? Nenhum, isso é um problema de hardware.',
    "Uma consulta SQL entra em um bar, caminha até duas tabelas e pergunta: 'Posso me juntar (JOIN) a vocês?'",
    'Qual é a forma orientada a objetos de ficar rico? Herança.',
  ];
  jokerJokes.forEach((joke) => {
    insertContent.run(randomUUID(), 'joker', 'joke', joke);
  });

  // Romance lines and date ideas
  const romanceContent = [
    {
      cat: 'date_idea',
      txt: 'Ideia de Encontro: Aluguem uma bicicleta dupla para explorar um parque e parem para um piquenique sob a sombra de uma árvore.',
    },
    { cat: 'hot_line', txt: 'Cantada: Você é um teclado? Porque você faz exatamente o meu tipo.' },
    {
      cat: 'date_idea',
      txt: 'Ideia de Encontro: Façam uma noite de pizza caseira DIY, onde cada um monta mini-pizzas com recheios inusitados.',
    },
    {
      cat: 'hot_line',
      txt: 'Cantada: Você é um renderizador WebGL? Porque você deixa o meu mundo muito mais bonito em 3D.',
    },
    {
      cat: 'date_idea',
      txt: 'Ideia de Encontro: Visitem um jardim botânico local durante o entardecer (golden hour) para tirar fotos lindas um do outro.',
    },
    {
      cat: 'hot_line',
      txt: 'Cantada: Você deve ser uma folha de estilo CSS, porque você dá classe e beleza à minha vida.',
    },
    {
      cat: 'date_idea',
      txt: 'Ideia de Encontro: Vão a uma feira de rua local, escolham ingredientes frescos juntos e preparem um almoço especial.',
    },
  ];
  romanceContent.forEach((item) => {
    insertContent.run(randomUUID(), 'romance', item.cat, item.txt);
  });

  // Vendor tips
  const vendorTips = [
    'Quer repelente? Protege contra as picadas de mosquito e mantém o seu escudo no máximo!',
    'O suco de laranja da minha barraca é o melhor da praça. Cura você na hora pressionando a tecla 3!',
    'Olha a verdura fresquinha freguês! Se os mosquitos atacarem, use a vassoura neles!',
    'Menino, toma cuidado com a Muriçoca Rainha! Ela é enorme e só aparece se atiçarem muito os mosquitos.',
    'Sabia que você pode jogar chinelos de longe? Se equipar o Chinelo Reforçado, o estrago é ainda maior!',
    'Trabalhar na feira é duro, mas ver a praça cheia e livre de mosquitos me enche de orgulho!',
  ];
  vendorTips.forEach((tip) => {
    insertContent.run(randomUUID(), 'vendor', 'tip', tip);
  });
}

// Pre-populate placed_objects with default NPCs if database is completely empty
const placedObjectsCount = db.prepare('SELECT COUNT(*) as c FROM placed_objects').get() as {
  c: number;
};
if (placedObjectsCount.c === 0) {
  const insertObj = db.prepare(
    'INSERT INTO placed_objects (id, type, x, y, z, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const now = Date.now();
  insertObj.run('npc_robot', 'npc:robot', -4, 0, 2, now);
  insertObj.run('npc_joker', 'npc:joker', 4, 0, -1.5, now);
  insertObj.run('npc_romance', 'npc:romance', 0, 0, 4.5, now);
  insertObj.run('npc_vendor', 'npc:vendor', 6, 0, -1.5, now);
}

export type StoredPost =
  | { type: 'text'; id: string; title: string; body: string }
  | { type: 'link'; id: string; label: string; url: string; description: string }
  | { type: 'image'; id: string; caption: string; accentColor: string }
  | {
      type: 'guestbook';
      id: string;
      author: string;
      message: string;
      reactions: Record<string, number>;
    };

export interface HubRecord {
  owner: string;
  bio: string;
  tag: string;
  slot: number;
  allowVisitorPosts: boolean;
  posts: StoredPost[];
}

export interface HubSummary {
  owner: string;
  tag: string;
  slot: number;
}

const MAX_NAME_LENGTH = 24;
const MAX_TEXT_LENGTH = 400;
const MAX_TITLE_LENGTH = 60;
const MAX_URL_LENGTH = 300;

function getPostsForOwner(owner: string): StoredPost[] {
  const rows = db
    .prepare('SELECT id, type, data FROM posts WHERE owner = ? ORDER BY created_at ASC')
    .all(owner) as { id: string; type: string; data: string }[];
  return rows.map((row) => ({ id: row.id, type: row.type, ...JSON.parse(row.data) }) as StoredPost);
}

export function listHubs(): HubSummary[] {
  const rows = db
    .prepare('SELECT owner, tag, slot FROM hubs ORDER BY slot ASC')
    .all() as unknown as HubSummary[];
  return rows;
}

export function getHub(owner: string): HubRecord | null {
  const row = db
    .prepare('SELECT owner, bio, tag, slot, allow_visitor_posts FROM hubs WHERE owner = ?')
    .get(owner) as
    | { owner: string; bio: string; tag: string; slot: number; allow_visitor_posts: number }
    | undefined;
  if (!row) return null;
  return {
    owner: row.owner,
    bio: row.bio,
    tag: row.tag,
    slot: row.slot,
    allowVisitorPosts: row.allow_visitor_posts !== 0,
    posts: getPostsForOwner(owner),
  };
}

/** Creates a hub with a welcome post the first time this name is seen;
 * returns the existing hub unchanged if it already exists. No login system —
 * "account" here just means a name-keyed hub, trusted within a small group
 * of friends rather than authenticated. */
export function getOrCreateHub(rawOwner: string): HubRecord {
  const owner = rawOwner.trim().slice(0, MAX_NAME_LENGTH) || 'Visitante';
  const existing = getHub(owner);
  if (existing) return existing;

  const slot = (db.prepare('SELECT COUNT(*) as c FROM hubs').get() as { c: number }).c;
  db.prepare(
    'INSERT INTO hubs (owner, bio, tag, slot, allow_visitor_posts, created_at) VALUES (?, ?, ?, ?, 1, ?)'
  ).run(owner, `O hub de ${owner} na Galera Brasil.`, '#GaleraBrasil', slot, Date.now());
  db.prepare('INSERT INTO posts (id, owner, type, data, created_at) VALUES (?, ?, ?, ?, ?)').run(
    randomUUID(),
    owner,
    'text',
    JSON.stringify({
      title: 'Bem-vindo(a)!',
      // Shown to every visitor, not just the owner — no "press N" instruction
      // here, since that only works for the owner and would mislead guests.
      body: `Este é o hub de ${owner} na Galera Brasil.`,
    }),
    Date.now()
  );
  return getHub(owner)!;
}

export type NewPostInput =
  | { type: 'text'; title: string; body: string }
  | { type: 'link'; label: string; url: string; description: string }
  | { type: 'guestbook'; author: string; message: string };

export function addPost(owner: string, input: NewPostInput): StoredPost | null {
  if (!getHub(owner)) return null;

  const id = randomUUID();
  let data: Record<string, any>;
  if (input.type === 'text') {
    const title = String(input.title ?? '')
      .trim()
      .slice(0, MAX_TITLE_LENGTH);
    const body = String(input.body ?? '')
      .trim()
      .slice(0, MAX_TEXT_LENGTH);
    if (!title || !body) return null;
    data = { title, body };
  } else if (input.type === 'link') {
    const label = String(input.label ?? '')
      .trim()
      .slice(0, MAX_TITLE_LENGTH);
    const url = String(input.url ?? '')
      .trim()
      .slice(0, MAX_URL_LENGTH);
    const description = String(input.description ?? '')
      .trim()
      .slice(0, MAX_TEXT_LENGTH);
    if (!label || !url) return null;
    data = { label, url, description };
  } else if (input.type === 'guestbook') {
    const author = String(input.author ?? '')
      .trim()
      .slice(0, MAX_NAME_LENGTH);
    const message = String(input.message ?? '')
      .trim()
      .slice(0, MAX_TEXT_LENGTH);
    if (!author || !message) return null;
    data = {
      author,
      message,
      reactions: { thumbs: 0, heart: 0, orange: 0 },
    };
  } else {
    return null;
  }

  db.prepare('INSERT INTO posts (id, owner, type, data, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    owner,
    input.type,
    JSON.stringify(data),
    Date.now()
  );
  return { id, type: input.type, ...data } as StoredPost;
}

export function updateHubSettings(owner: string, allowVisitorPosts: boolean): boolean {
  if (!getHub(owner)) return false;
  db.prepare('UPDATE hubs SET allow_visitor_posts = ? WHERE owner = ?').run(
    allowVisitorPosts ? 1 : 0,
    owner
  );
  return true;
}

export function incrementPostReaction(postId: string, emoji: string): boolean {
  const row = db.prepare('SELECT owner, type, data FROM posts WHERE id = ?').get(postId) as
    { owner: string; type: string; data: string } | undefined;
  if (!row) return false;

  try {
    const data = JSON.parse(row.data);
    if (!data.reactions) {
      data.reactions = { thumbs: 0, heart: 0, orange: 0 };
    }
    if (data.reactions[emoji] === undefined) {
      data.reactions[emoji] = 0;
    }
    data.reactions[emoji] += 1;

    db.prepare('UPDATE posts SET data = ? WHERE id = ?').run(JSON.stringify(data), postId);
    return true;
  } catch (err) {
    return false;
  }
}

// --- NPC & Sticker system helpers ----------------------------------------------

interface StickerDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  npcType: 'robot' | 'joker' | 'romance' | 'vendor';
}

const STICKERS: StickerDef[] = [
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

export interface NpcDialogue {
  npc_type: 'robot' | 'joker' | 'romance' | 'vendor';
  category: 'tip' | 'joke' | 'date_idea' | 'hot_line';
  content: string;
}

export function getRandomNpcDialogue(npcType: string): NpcDialogue | null {
  const rows = db
    .prepare('SELECT npc_type, category, content FROM npc_content WHERE npc_type = ?')
    .all(npcType) as unknown as NpcDialogue[];
  if (rows.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * rows.length);
  return rows[randomIndex];
}

export function getPlayerStickers(playerName: string): string[] {
  const rows = db
    .prepare('SELECT sticker_id FROM player_stickers WHERE player_name = ?')
    .all(playerName) as unknown as { sticker_id: string }[];
  return rows.map((r) => r.sticker_id);
}

const CLAIM_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown for easy testing

export interface ClaimResult {
  success: boolean;
  sticker?: StickerDef;
  error?: 'cooldown' | 'already_all' | 'unknown_npc' | 'not_found';
  remainingTimeMs?: number;
}

export function claimNpcSticker(
  playerName: string,
  npcType: 'robot' | 'joker' | 'romance' | 'vendor'
): ClaimResult {
  // Validate NPC type
  const npcStickers = STICKERS.filter((s) => s.npcType === npcType);
  if (npcStickers.length === 0) return { success: false, error: 'unknown_npc' };

  // Check cooldown
  const cooldownRow = db
    .prepare('SELECT last_claimed_at FROM npc_cooldowns WHERE player_name = ? AND npc_type = ?')
    .get(playerName, npcType) as { last_claimed_at: number } | undefined;

  const now = Date.now();
  if (cooldownRow) {
    const elapsed = now - cooldownRow.last_claimed_at;
    if (elapsed < CLAIM_COOLDOWN_MS) {
      return {
        success: false,
        error: 'cooldown',
        remainingTimeMs: CLAIM_COOLDOWN_MS - elapsed,
      };
    }
  }

  // Get current player stickers
  const playerStickerIds = getPlayerStickers(playerName);
  const unclaimedStickers = npcStickers.filter((s) => !playerStickerIds.includes(s.id));

  if (unclaimedStickers.length === 0) {
    return { success: false, error: 'already_all' };
  }

  // Pick a random unclaimed sticker
  const randomSticker = unclaimedStickers[Math.floor(Math.random() * unclaimedStickers.length)];

  // Save to database
  db.prepare(
    'INSERT OR REPLACE INTO player_stickers (player_name, sticker_id, claimed_at) VALUES (?, ?, ?)'
  ).run(playerName, randomSticker.id, now);

  // Update cooldown
  db.prepare(
    'INSERT OR REPLACE INTO npc_cooldowns (player_name, npc_type, last_claimed_at) VALUES (?, ?, ?)'
  ).run(playerName, npcType, now);

  return {
    success: true,
    sticker: randomSticker,
  };
}

// --- Player battle stats (XP / level) -------------------------------------------

export interface PlayerStats {
  level: number;
  xp: number;
  coins: number;
}

export interface PlayerUpgrades {
  reinforcedChinelo: boolean;
  sucoCount: number;
}

/** Loads a player's battle stats, creating a level-1 row the first time the
 * name is seen. Same trust model as hubs: name-keyed, no authentication. */
export function getOrCreatePlayerStats(rawName: string): PlayerStats {
  const name = rawName.trim().slice(0, MAX_NAME_LENGTH) || 'Visitante';
  const row = db
    .prepare('SELECT level, xp, coins FROM player_stats WHERE player_name = ?')
    .get(name) as PlayerStats | undefined;
  if (row) return row;

  db.prepare(
    'INSERT INTO player_stats (player_name, level, xp, coins, updated_at) VALUES (?, 1, 0, 0, ?)'
  ).run(name, Date.now());
  return { level: 1, xp: 0, coins: 0 };
}

export function savePlayerStats(rawName: string, level: number, xp: number, coins: number): void {
  const name = rawName.trim().slice(0, MAX_NAME_LENGTH) || 'Visitante';
  db.prepare(
    'INSERT OR REPLACE INTO player_stats (player_name, level, xp, coins, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(name, level, xp, coins, Date.now());
}

export function getOrCreatePlayerUpgrades(rawName: string): PlayerUpgrades {
  const name = rawName.trim().slice(0, MAX_NAME_LENGTH) || 'Visitante';
  const row = db
    .prepare('SELECT reinforced_chinelo, suco_count FROM player_upgrades WHERE player_name = ?')
    .get(name) as { reinforced_chinelo: number; suco_count: number } | undefined;
  if (row) {
    return {
      reinforcedChinelo: row.reinforced_chinelo === 1,
      sucoCount: Math.max(0, row.suco_count),
    };
  }

  db.prepare(
    'INSERT INTO player_upgrades (player_name, reinforced_chinelo, suco_count, updated_at) VALUES (?, 0, 0, ?)'
  ).run(name, Date.now());
  return { reinforcedChinelo: false, sucoCount: 0 };
}

export function savePlayerUpgrades(rawName: string, upgrades: PlayerUpgrades): void {
  const name = rawName.trim().slice(0, MAX_NAME_LENGTH) || 'Visitante';
  db.prepare(
    'INSERT OR REPLACE INTO player_upgrades (player_name, reinforced_chinelo, suco_count, updated_at) VALUES (?, ?, ?, ?)'
  ).run(name, upgrades.reinforcedChinelo ? 1 : 0, Math.max(0, upgrades.sucoCount), Date.now());
}

export interface PlacedObject {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  created_at: number;
}

export function listPlacedObjects(): PlacedObject[] {
  return db
    .prepare('SELECT id, type, x, y, z, created_at FROM placed_objects ORDER BY created_at ASC')
    .all() as unknown as PlacedObject[];
}

export function addPlacedObject(
  id: string,
  type: string,
  x: number,
  y: number,
  z: number
): PlacedObject {
  const now = Date.now();
  db.prepare(
    'INSERT OR REPLACE INTO placed_objects (id, type, x, y, z, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, type, x, y, z, now);
  return { id, type, x, y, z, created_at: now };
}

export function deletePlacedObject(id: string): boolean {
  db.prepare('DELETE FROM placed_objects WHERE id = ?').run(id);
  return true;
}

export function clearPlacedObjects(): boolean {
  db.prepare('DELETE FROM placed_objects').run();
  // Re-insert default NPCs
  const insertObj = db.prepare(
    'INSERT INTO placed_objects (id, type, x, y, z, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const now = Date.now();
  insertObj.run('npc_robot', 'npc:robot', -4, 0, 2, now);
  insertObj.run('npc_joker', 'npc:joker', 4, 0, -1.5, now);
  insertObj.run('npc_romance', 'npc:romance', 0, 0, 4.5, now);
  insertObj.run('npc_vendor', 'npc:vendor', 6, 0, -1.5, now);
  return true;
}
