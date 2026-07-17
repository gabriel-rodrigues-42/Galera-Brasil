import type { HubDescription } from './hub-types';

// This is the demo profile for Phase 1 (single-player Content Garden).
// Edit this file to make the hub your own — Phase 2 moves this data to a
// real server so every player gets one, but the shape stays the same.
export const demoHub: HubDescription = {
  owner: 'Você',
  bio: 'Bem-vindo à minha praça. Este é o primeiro hub de conteúdo do Galera Brasil.',
  tag: '#GameDev',
  posts: [
    {
      type: 'text',
      id: 'welcome',
      title: 'Bem-vindo(a)',
      body:
        'Este espaço é o seu perfil, só que físico: cada post vira um objeto ' +
        'que dá para visitar andando. Edite src/hub-content.ts para contar a ' +
        'sua própria história aqui.',
    },
    {
      type: 'image',
      id: 'praca-wip',
      caption: 'A praça em construção — Fase 0',
      accentColor: '#e07a5f',
    },
    {
      type: 'image',
      id: 'primeira-arvore',
      caption: 'Primeira árvore procedural gerada por código',
      accentColor: '#81b29a',
    },
    {
      type: 'text',
      id: 'roadmap',
      title: 'Roteiro',
      body:
        'Fase 1: este hub. Fase 2: contas e várias ruas por interesse. ' +
        'Fase 3: multiplayer. Fase 4: descoberta e crews. Veja PLAN.md ' +
        'na raiz do projeto para os detalhes completos.',
    },
    {
      type: 'link',
      id: 'contato',
      label: 'Fale comigo',
      url: 'https://wa.me/55XXXXXXXXXXX',
      description: 'Substitua pelo seu link real de contato, portfólio ou loja.',
    },
  ],
};
