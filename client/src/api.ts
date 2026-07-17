import type { HubPost } from './hub-types';

export interface HubSummary {
  owner: string;
  tag: string;
  slot: number;
}

export interface HubRecord extends HubSummary {
  bio: string;
  posts: HubPost[];
}

export type NewPostInput =
  | { type: 'text'; title: string; body: string }
  | { type: 'link'; label: string; url: string; description: string };

function getApiBase(): string {
  // Dev mode: Vite serves the client on 5173, but the game server (and its
  // REST API) runs on 2567. In production the server serves the client
  // itself, so relative paths already hit the right place.
  const isDev = window.location.port === '5173';
  return isDev ? `${window.location.protocol}//${window.location.hostname}:2567` : '';
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, options);
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export function listHubs(): Promise<HubSummary[]> {
  return apiFetch('/api/hubs');
}

export function getHub(owner: string): Promise<HubRecord> {
  return apiFetch(`/api/hubs/${encodeURIComponent(owner)}`);
}

export function claimHub(owner: string): Promise<HubRecord> {
  return apiFetch(`/api/hubs/${encodeURIComponent(owner)}/claim`, { method: 'POST' });
}

export function addPost(owner: string, post: NewPostInput): Promise<HubPost> {
  return apiFetch(`/api/hubs/${encodeURIComponent(owner)}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(post),
  });
}

// --- NPC & Sticker API calls ---------------------------------------------------

export interface NpcDialogueResponse {
  npc_type: 'robot' | 'joker' | 'romance';
  category: string;
  content: string;
}

export interface StickerDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  npcType: 'robot' | 'joker' | 'romance';
}

export interface StickerClaimResponse {
  success: boolean;
  sticker?: StickerDef;
  error?: 'cooldown' | 'already_all' | 'unknown_npc' | 'not_found';
  remainingTimeMs?: number;
}

export function getRandomNpcDialogue(npcType: string): Promise<NpcDialogueResponse> {
  return apiFetch(`/api/npcs/dialogue/${encodeURIComponent(npcType)}`);
}

export function getPlayerStickers(playerName: string): Promise<string[]> {
  return apiFetch(`/api/players/${encodeURIComponent(playerName)}/stickers`);
}

export function claimNpcSticker(playerName: string, npcType: string): Promise<StickerClaimResponse> {
  return apiFetch(`/api/players/${encodeURIComponent(playerName)}/stickers/claim/${encodeURIComponent(npcType)}`, {
    method: 'POST'
  });
}
