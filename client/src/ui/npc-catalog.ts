export type NpcId = 'robot' | 'joker' | 'romance' | 'vendor';

export interface StickerDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  npcType: NpcId;
}

export const STICKERS: StickerDef[] = [
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

export interface ShopItemDef {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  price: number;
}

// Prices mirrored by hand from server/src/rooms/combat.ts SHOP_PRICES — keep in sync.
export const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: 'chinelo_reforcado',
    emoji: '🩴',
    title: 'Chinelo Reforçado',
    desc: 'visual dourado e +dano no arremesso',
    price: 45,
  },
  {
    id: 'repelente',
    emoji: '🧴',
    title: 'Repelente',
    desc: 'adiciona uma barra de shield contra picadas',
    price: 20,
  },
  {
    id: 'suco_laranja',
    emoji: '🍊',
    title: 'Suco de Laranja',
    desc: 'guarda 1 carga para usar na tecla 3',
    price: 12,
  },
  {
    id: 'super_vassoura',
    emoji: '🧹',
    title: 'Super Vassoura',
    desc: 'limpeza de detritos do mutirão 25% mais rápida',
    price: 30,
  },
  {
    id: 'lanterna_ecologica',
    emoji: '🔦',
    title: 'Lanterna Ecológica',
    desc: 'imune ao Apagão Solar sabotado',
    price: 25,
  },
  {
    id: 'detector',
    emoji: '📡',
    title: 'Detector de Sabotagem',
    desc: 'tecla 4 mostra o setor da última sabotagem',
    price: 20,
  },
];

export const NPC_DIALOGUE_ACTION_LABEL: Record<NpcId, string> = {
  robot: 'Pedir Dica',
  joker: 'Pedir Piada',
  romance: 'Pedir Cantada / Encontro',
  vendor: 'Falar com Feirante',
};

export const NPC_GREETING: Record<NpcId, string> = {
  robot: 'Olá! Eu sou o Robô da Net. Quer aprender algum atalho ou truque de computador?',
  joker: 'Olá! Eu sou o Coringa do Feirão. Preparado para dar umas risadas?',
  romance: 'Olá! Eu sou o Cupido Solarpunk. Procurando ideias de encontros ou cantadas românticas?',
  vendor: 'Bem-vindo à feira! Tenho reforço para chinelo, repelente e suco para voltar à luta.',
};
