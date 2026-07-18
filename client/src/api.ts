import type { HubPost } from './hub-types';

export interface HubSummary {
  owner: string;
  tag: string;
  slot: number;
}

export interface HubRecord extends HubSummary {
  bio: string;
  allowVisitorPosts: boolean;
  posts: HubPost[];
}

export type NewPostInput =
  | { type: 'text'; title: string; body: string }
  | { type: 'link'; label: string; url: string; description: string }
  | { type: 'guestbook'; author: string; message: string };

function getApiBase(): string {
  // In Vite dev, the app can run on any free port (not just 5173), while the
  // game server + REST API stay on 2567. In production, same-origin is correct.
  const isDev = import.meta.env.DEV;
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

export function updateHubSettings(
  owner: string,
  allowVisitorPosts: boolean
): Promise<{ success: boolean }> {
  return apiFetch(`/api/hubs/${encodeURIComponent(owner)}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowVisitorPosts }),
  });
}

export function reactToPost(postId: string, emoji: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/posts/${encodeURIComponent(postId)}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji }),
  });
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
  npc_type: 'robot' | 'joker' | 'romance' | 'vendor';
  category: string;
  content: string;
}

interface StickerDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  npcType: 'robot' | 'joker' | 'romance' | 'vendor';
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

export function claimNpcSticker(
  playerName: string,
  npcType: string
): Promise<StickerClaimResponse> {
  return apiFetch(
    `/api/players/${encodeURIComponent(playerName)}/stickers/claim/${encodeURIComponent(npcType)}`,
    {
      method: 'POST',
    }
  );
}

export interface PlacedObjectRecord {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
}

export function listPlacedObjects(): Promise<PlacedObjectRecord[]> {
  return apiFetch('/api/placed-objects');
}

export function addPlacedObject(obj: PlacedObjectRecord): Promise<PlacedObjectRecord> {
  return apiFetch('/api/placed-objects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  });
}

export function deletePlacedObject(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/placed-objects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function clearPlacedObjects(): Promise<{ success: boolean }> {
  return apiFetch('/api/placed-objects', {
    method: 'DELETE',
  });
}
