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
`);

// Pre-populate NPC content if empty
const countRow = db.prepare('SELECT COUNT(*) as c FROM npc_content').get() as { c: number };
if (countRow.c === 0) {
  const insertContent = db.prepare('INSERT INTO npc_content (id, npc_type, category, content) VALUES (?, ?, ?, ?)');
  
  // Robot tips
  const robotTips = [
    "Use Ctrl + Shift + T para reabrir a última aba fechada do navegador. Salva vidas!",
    "PC lento? Pressione Ctrl + Shift + Esc para abrir o Gerenciador de Tarefas diretamente.",
    "Pressione Windows + V para ativar e abrir o histórico da área de transferência. Você pode colar itens copiados anteriormente!",
    "Segure Alt ao clicar em um link para forçar o download do arquivo em vez de abri-lo.",
    "Pressione Windows + Shift + S para tirar um print de uma área específica da tela instantaneamente.",
    "Digite 'cmd' na barra de endereços do Explorador de Arquivos para abrir o prompt de comando direto na pasta atual.",
    "Se a sua tela congelar, pressione Win + Ctrl + Shift + B para reiniciar o driver de vídeo sem reiniciar o PC."
  ];
  robotTips.forEach((tip) => {
    insertContent.run(randomUUID(), 'robot', 'tip', tip);
  });

  // Joker jokes
  const jokerJokes = [
    "Por que os programadores usam óculos? Porque eles não conseguem C#.",
    "Existem 10 tipos de pessoas no mundo: as que entendem binário e as que não entendem.",
    "Por que o computador foi ao hospital? Porque ele estava com um vírus!",
    "Qual é o lugar favorito de um programador para relaxar? O Foo Bar.",
    "Quantos programadores são necessários para trocar uma lâmpada? Nenhum, isso é um problema de hardware.",
    "Uma consulta SQL entra em um bar, caminha até duas tabelas e pergunta: 'Posso me juntar (JOIN) a vocês?'",
    "Qual é a forma orientada a objetos de ficar rico? Herança."
  ];
  jokerJokes.forEach((joke) => {
    insertContent.run(randomUUID(), 'joker', 'joke', joke);
  });

  // Romance lines and date ideas
  const romanceContent = [
    { cat: 'date_idea', txt: "Ideia de Encontro: Aluguem uma bicicleta dupla para explorar um parque e parem para um piquenique sob a sombra de uma árvore." },
    { cat: 'hot_line', txt: "Cantada: Você é um teclado? Porque você faz exatamente o meu tipo." },
    { cat: 'date_idea', txt: "Ideia de Encontro: Façam uma noite de pizza caseira DIY, onde cada um monta mini-pizzas com recheios inusitados." },
    { cat: 'hot_line', txt: "Cantada: Você é um renderizador WebGL? Porque você deixa o meu mundo muito mais bonito em 3D." },
    { cat: 'date_idea', txt: "Ideia de Encontro: Visitem um jardim botânico local durante o entardecer (golden hour) para tirar fotos lindas um do outro." },
    { cat: 'hot_line', txt: "Cantada: Você deve ser uma folha de estilo CSS, porque você dá classe e beleza à minha vida." },
    { cat: 'date_idea', txt: "Ideia de Encontro: Vão a uma feira de rua local, escolham ingredientes frescos juntos e preparem um almoço especial." }
  ];
  romanceContent.forEach((item) => {
    insertContent.run(randomUUID(), 'romance', item.cat, item.txt);
  });
}

export type StoredPost =
  | { type: 'text'; id: string; title: string; body: string }
  | { type: 'link'; id: string; label: string; url: string; description: string }
  | { type: 'image'; id: string; caption: string; accentColor: string };

export interface HubRecord {
  owner: string;
  bio: string;
  tag: string;
  slot: number;
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
  const rows = db.prepare('SELECT owner, tag, slot FROM hubs ORDER BY slot ASC').all() as unknown as HubSummary[];
  return rows;
}

export function getHub(owner: string): HubRecord | null {
  const row = db.prepare('SELECT owner, bio, tag, slot FROM hubs WHERE owner = ?').get(owner) as
    | { owner: string; bio: string; tag: string; slot: number }
    | undefined;
  if (!row) return null;
  return { ...row, posts: getPostsForOwner(owner) };
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
  db.prepare('INSERT INTO hubs (owner, bio, tag, slot, created_at) VALUES (?, ?, ?, ?, ?)').run(
    owner,
    `O hub de ${owner} na Galera Brasil.`,
    '#GaleraBrasil',
    slot,
    Date.now(),
  );
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
    Date.now(),
  );
  return getHub(owner)!;
}

export type NewPostInput =
  | { type: 'text'; title: string; body: string }
  | { type: 'link'; label: string; url: string; description: string };

export function addPost(owner: string, input: NewPostInput): StoredPost | null {
  if (!getHub(owner)) return null;

  const id = randomUUID();
  let data: Record<string, string>;
  if (input.type === 'text') {
    const title = String(input.title ?? '').trim().slice(0, MAX_TITLE_LENGTH);
    const body = String(input.body ?? '').trim().slice(0, MAX_TEXT_LENGTH);
    if (!title || !body) return null;
    data = { title, body };
  } else {
    const label = String(input.label ?? '').trim().slice(0, MAX_TITLE_LENGTH);
    const url = String(input.url ?? '').trim().slice(0, MAX_URL_LENGTH);
    const description = String(input.description ?? '').trim().slice(0, MAX_TEXT_LENGTH);
    if (!label || !url) return null;
    data = { label, url, description };
  }

  db.prepare('INSERT INTO posts (id, owner, type, data, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    owner,
    input.type,
    JSON.stringify(data),
    Date.now(),
  );
  return { id, type: input.type, ...data } as StoredPost;
}

// --- NPC & Sticker system helpers ----------------------------------------------

export interface StickerDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  npcType: 'robot' | 'joker' | 'romance';
}

export const STICKERS: StickerDef[] = [
  { id: 'sticker_robot_1', name: 'Microchip de Ouro', emoji: '🪙', description: 'Concedido pelo Robô por dominar atalhos do PC.', npcType: 'robot' },
  { id: 'sticker_robot_2', name: 'Fibra Óptica Express', emoji: '⚡', description: 'Concedido pelo Robô por demonstrar conexão rápida.', npcType: 'robot' },
  { id: 'sticker_robot_3', name: 'Super Antena 5G', emoji: '📡', description: 'Concedido pelo Robô por captar excelentes dicas.', npcType: 'robot' },
  { id: 'sticker_joker_1', name: 'Risada Suprema', emoji: '🎭', description: 'Concedido pelo Coringa após ouvir uma ótima piada.', npcType: 'joker' },
  { id: 'sticker_joker_2', name: 'Buzina Maluca', emoji: '📯', description: 'Concedido pelo Coringa por espalhar bom humor.', npcType: 'joker' },
  { id: 'sticker_joker_3', name: 'Torta Flutuante', emoji: '🥧', description: 'Concedido pelo Coringa por sobreviver ao stand-up.', npcType: 'joker' },
  { id: 'sticker_romance_1', name: 'Flecha do Cupido', emoji: '💘', description: 'Concedido pelo Romântico por demonstrar carisma.', npcType: 'romance' },
  { id: 'sticker_romance_2', name: 'Coração Pixelado', emoji: '💖', description: 'Concedido pelo Romântico para corações apaixonados.', npcType: 'romance' },
  { id: 'sticker_romance_3', name: 'Poção do Amor', emoji: '🧪', description: 'Concedido pelo Romântico para encontros perfeitos.', npcType: 'romance' },
];

export interface NpcDialogue {
  npc_type: 'robot' | 'joker' | 'romance';
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

export function claimNpcSticker(playerName: string, npcType: 'robot' | 'joker' | 'romance'): ClaimResult {
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
  db.prepare('INSERT OR REPLACE INTO player_stickers (player_name, sticker_id, claimed_at) VALUES (?, ?, ?)').run(
    playerName,
    randomSticker.id,
    now,
  );

  // Update cooldown
  db.prepare('INSERT OR REPLACE INTO npc_cooldowns (player_name, npc_type, last_claimed_at) VALUES (?, ?, ?)').run(
    playerName,
    npcType,
    now,
  );

  return {
    success: true,
    sticker: randomSticker,
  };
}
