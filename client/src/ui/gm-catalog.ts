/** Shared build-mode catalog for the GM builder tab. Single source of truth
 * for the card grid (ui/components/gm-builder-tab.ts) and the status-bar /
 * placed-object labels (ui/controllers/gm-controller.ts) — replaces the
 * duplicated `emojiMap` literals that used to live in main.ts. */
export type BuildType =
  | 'tree'
  | 'canopy'
  | 'rock'
  | 'plank'
  | 'lily'
  | 'npc:robot'
  | 'npc:joker'
  | 'npc:romance'
  | 'npc:vendor'
  | 'monster:mosquito'
  | 'monster:barata'
  | 'monster:pombo';

interface BuildCatalogItem {
  type: BuildType;
  emoji: string;
  cardName: string;
  /** Fuller label used in the builder-status bar and the placed-objects list. */
  fullLabel: string;
}

export interface BuildCatalogGroup {
  title: string;
  items: BuildCatalogItem[];
}

export const DEFAULT_BUILD_TYPE: BuildType = 'tree';

export const BUILD_CATALOG: BuildCatalogGroup[] = [
  {
    title: 'Cenário',
    items: [
      { type: 'tree', emoji: '🌳', cardName: 'Árvore', fullLabel: '🌳 Árvore' },
      { type: 'canopy', emoji: '☀️', cardName: 'Tenda', fullLabel: '☀️ Tenda Solar' },
      { type: 'rock', emoji: '🪨', cardName: 'Rocha', fullLabel: '🪨 Rocha' },
      { type: 'plank', emoji: '🪵', cardName: 'Bloco', fullLabel: '🪵 Bloco de Madeira' },
      { type: 'lily', emoji: '🪷', cardName: 'Vitória', fullLabel: '🪷 Vitória Régia' },
    ],
  },
  {
    title: 'NPCs (Personagens)',
    items: [
      { type: 'npc:robot', emoji: '🤖', cardName: 'Robô', fullLabel: '🤖 Robô da Net' },
      { type: 'npc:joker', emoji: '🃏', cardName: 'Coringa', fullLabel: '🃏 Coringa do Feirão' },
      { type: 'npc:romance', emoji: '💘', cardName: 'Cupido', fullLabel: '💘 Cupido Solarpunk' },
      { type: 'npc:vendor', emoji: '🧺', cardName: 'Jurema', fullLabel: '🧺 Dona Jurema da Feira' },
    ],
  },
  {
    title: 'Monstros (Spawns Persistentes)',
    items: [
      {
        type: 'monster:mosquito',
        emoji: '🦟',
        cardName: 'Mosquito',
        fullLabel: '🦟 Spawn: Mosquito',
      },
      { type: 'monster:barata', emoji: '🪳', cardName: 'Barata', fullLabel: '🪳 Spawn: Barata' },
      { type: 'monster:pombo', emoji: '🕊️', cardName: 'Pombo', fullLabel: '🕊️ Spawn: Pombo' },
    ],
  },
];

export const BUILD_TYPE_LABELS: Record<BuildType, string> = BUILD_CATALOG.flatMap(
  (group) => group.items
).reduce(
  (acc, item) => {
    acc[item.type] = item.fullLabel;
    return acc;
  },
  {} as Record<BuildType, string>
);
