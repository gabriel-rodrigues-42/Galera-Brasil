import { sharedStyles } from '../shared-styles';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: block;
    font-family: var(--font-body);
    color: var(--color-text-primary);
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-height: 380px;
    overflow-y: auto;
  }

  .group {
    background: var(--color-bg-elevated);
    border-radius: var(--border-radius-md);
    padding: var(--space-3);
  }

  h4 {
    margin: 0 0 var(--space-2);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    color: var(--color-brand-primary);
    border-bottom: var(--border-ui-stroke);
    padding-bottom: var(--space-1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  td {
    padding: var(--space-1) 0;
    vertical-align: middle;
  }

  td:first-child {
    width: 9rem;
    font-weight: 600;
    padding-right: var(--space-2);
  }

  kbd {
    display: inline-block;
    padding: 1px 4px;
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: bold;
    color: var(--color-text-primary);
    background: var(--color-bg-base);
    border: var(--border-ui-stroke);
    border-bottom-width: 2px;
    border-radius: var(--border-radius-sm);
    margin: 1px;
  }
`);

/** Shortcuts tab of the GM panel — pure static reference content, no props,
 * methods, or events. See DESIGN.md §8. */
export class GmShortcutsTab extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <div class="groups">
        <div class="group">
          <h4>🏃 Movimentação</h4>
          <table>
            <tr>
              <td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / <kbd>Setas</kbd></td>
              <td>Mover Personagem</td>
            </tr>
            <tr>
              <td><kbd>Espaço</kbd></td>
              <td>Pular</td>
            </tr>
            <tr>
              <td><kbd>Shift (segurar)</kbd></td>
              <td>Correr</td>
            </tr>
          </table>
        </div>

        <div class="group">
          <h4>⚔️ Combate & Itens</h4>
          <table>
            <tr>
              <td><kbd>1</kbd></td>
              <td>Equipar Vassoura (Melee)</td>
            </tr>
            <tr>
              <td><kbd>2</kbd></td>
              <td>Equipar Chinelo (Ranged)</td>
            </tr>
            <tr>
              <td><kbd>3</kbd></td>
              <td>Beber Suco de Laranja (Heal)</td>
            </tr>
            <tr>
              <td><kbd>Clique Esquerdo</kbd></td>
              <td>Atacar com arma atual</td>
            </tr>
            <tr>
              <td><kbd>Clique Direito</kbd></td>
              <td>Arremesso rápido de chinelo</td>
            </tr>
            <tr>
              <td><kbd>Scroll Mouse</kbd></td>
              <td>Alternar armas (vassoura / chinelo)</td>
            </tr>
          </table>
        </div>

        <div class="group">
          <h4>🛠️ Construção (Game Master)</h4>
          <table>
            <tr>
              <td><kbd>B</kbd></td>
              <td>Abrir / Fechar Painel GM</td>
            </tr>
            <tr>
              <td><kbd>Clique Esquerdo</kbd></td>
              <td>Posicionar elemento ativo</td>
            </tr>
            <tr>
              <td><kbd>Clique Direito</kbd></td>
              <td>Destruir elemento mirado</td>
            </tr>
            <tr>
              <td><kbd>Esc</kbd></td>
              <td>Sair do modo de construção / fechar painéis</td>
            </tr>
          </table>
        </div>

        <div class="group">
          <h4>💬 Geral & Debug</h4>
          <table>
            <tr>
              <td><kbd>Enter</kbd></td>
              <td>Abrir canal de chat</td>
            </tr>
            <tr>
              <td><kbd>E</kbd></td>
              <td>Interagir com NPCs / outdoors / transições</td>
            </tr>
            <tr>
              <td><kbd>C</kbd></td>
              <td>Alternar tamanho do chat (compacto)</td>
            </tr>
            <tr>
              <td><kbd>Ctrl + Shift + D</kbd></td>
              <td>Abrir/copiar log de debug</td>
            </tr>
          </table>
        </div>
      </div>
    `;
  }
}
