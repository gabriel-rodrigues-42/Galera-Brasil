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
`);

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
