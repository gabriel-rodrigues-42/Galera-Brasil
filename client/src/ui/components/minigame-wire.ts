/**
 * <minigame-wire> — Solar Panel Wire Puzzle
 *
 * Renders a pair of columns (left = power nodes, right = output nodes).
 * Player drags from a left node to a right node to connect a wire.
 * All correct pairs must be matched within time to fire 'minigame-success'.
 */

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    width: 100%;
    user-select: none;
  }

  .instructions {
    text-align: center;
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .board {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex: 1;
    position: relative;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .node {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 2px solid var(--color-bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
    background: var(--color-bg-elevated);
    position: relative;
    z-index: 1;
  }

  .node:hover { transform: scale(1.1); }
  .node.dragging { border-color: var(--color-brand-primary); box-shadow: 0 0 10px rgba(74,138,79,0.5); }
  .node.matched  { border-color: var(--color-brand-green);   opacity: 0.7; cursor: default; }
  .node.wrong    { border-color: #e07a5f; animation: shake 0.3s; }

  svg.wires {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }

  line.wire { stroke-width: 3; stroke-linecap: round; }
  line.pending { stroke: var(--color-brand-primary); stroke-dasharray: 6 4; animation: dash 0.5s linear infinite; }
  line.correct { stroke: var(--color-brand-green); }
  line.wrong-line { stroke: #e07a5f; }

  @keyframes dash {
    to { stroke-dashoffset: -10; }
  }

  @keyframes shake {
    0%,100% { transform: translateX(0); }
    25%      { transform: translateX(-4px); }
    75%      { transform: translateX(4px); }
  }
`);

const ICONS = ['☀️', '⚡', '🔋', '🌀', '🔌'];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class MinigameWire extends HTMLElement {
  private shadow!: ShadowRoot;
  private leftNodes: HTMLElement[] = [];
  private rightNodes: HTMLElement[] = [];
  private svgEl!: SVGSVGElement;
  private boardEl!: HTMLDivElement;

  // Map from leftIndex → rightIndex (the correct answer)
  private solution: number[] = [];
  // Map from leftIndex → shuffled rightIndex displayed on screen
  private rightOrder: number[] = [];

  private draggingFromLeft: number | null = null;
  private pendingLine: SVGLineElement | null = null;
  private matched = new Set<number>(); // left indices that are correctly matched

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadow.adoptedStyleSheets = [sheet];
    this.init();
  }

  private init() {
    const N = 4;
    this.solution = Array.from({ length: N }, (_, i) => i);
    this.rightOrder = shuffled(this.solution);
    this.matched.clear();
    this.draggingFromLeft = null;

    const icons = shuffled(ICONS).slice(0, N);

    this.shadow.innerHTML = `
      <p class="instructions">Conecte cada painel ao seu cabo correto. Arraste da esquerda para a direita.</p>
      <div class="board">
        <div class="col left-col">
          ${icons.map((ic, i) => `<div class="node left-node" data-i="${i}">${ic}</div>`).join('')}
        </div>
        <svg class="wires"></svg>
        <div class="col right-col">
          ${this.rightOrder.map((ri, i) => `<div class="node right-node" data-i="${i}" data-ri="${ri}">${icons[ri]}</div>`).join('')}
        </div>
      </div>
    `;

    this.boardEl = this.shadow.querySelector('.board')!;
    this.svgEl = this.shadow.querySelector('svg')!;
    this.leftNodes = Array.from(this.shadow.querySelectorAll('.left-node'));
    this.rightNodes = Array.from(this.shadow.querySelectorAll('.right-node'));

    this.leftNodes.forEach((node, i) => {
      node.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.startDrag(i);
      });
      node.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          this.startDrag(i);
        },
        { passive: false }
      );
    });

    this.boardEl.addEventListener('mousemove', (e) => this.onDragMove(e.clientX, e.clientY));
    this.boardEl.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      this.onDragMove(t.clientX, t.clientY);
    });
    this.boardEl.addEventListener('mouseup', (e) => this.onDragEnd(e.clientX, e.clientY));
    this.boardEl.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      this.onDragEnd(t.clientX, t.clientY);
    });
  }

  private getNodeCenter(el: HTMLElement): { x: number; y: number } {
    const br = this.boardEl.getBoundingClientRect();
    const nr = el.getBoundingClientRect();
    return { x: nr.left + nr.width / 2 - br.left, y: nr.top + nr.height / 2 - br.top };
  }

  private startDrag(leftIdx: number) {
    if (this.matched.has(leftIdx)) return;
    this.draggingFromLeft = leftIdx;
    this.leftNodes[leftIdx].classList.add('dragging');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('wire', 'pending');
    const c = this.getNodeCenter(this.leftNodes[leftIdx]);
    line.setAttribute('x1', String(c.x));
    line.setAttribute('y1', String(c.y));
    line.setAttribute('x2', String(c.x));
    line.setAttribute('y2', String(c.y));
    this.svgEl.appendChild(line);
    this.pendingLine = line;
  }

  private onDragMove(cx: number, cy: number) {
    if (this.draggingFromLeft === null || !this.pendingLine) return;
    const br = this.boardEl.getBoundingClientRect();
    this.pendingLine.setAttribute('x2', String(cx - br.left));
    this.pendingLine.setAttribute('y2', String(cy - br.top));
  }

  private onDragEnd(cx: number, cy: number) {
    if (this.draggingFromLeft === null) return;
    const leftIdx = this.draggingFromLeft;
    this.draggingFromLeft = null;
    this.leftNodes[leftIdx].classList.remove('dragging');

    if (this.pendingLine) {
      this.svgEl.removeChild(this.pendingLine);
      this.pendingLine = null;
    }

    // Find which right node is under cursor
    let hitRightIdx = -1;
    this.rightNodes.forEach((rn, i) => {
      const r = rn.getBoundingClientRect();
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        hitRightIdx = i;
      }
    });

    if (hitRightIdx === -1) return;

    const displayedRightVal = this.rightOrder[hitRightIdx];
    const correct = this.solution[leftIdx] === displayedRightVal;

    const c1 = this.getNodeCenter(this.leftNodes[leftIdx]);
    const c2 = this.getNodeCenter(this.rightNodes[hitRightIdx]);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('wire', correct ? 'correct' : 'wrong-line');
    line.setAttribute('x1', String(c1.x));
    line.setAttribute('y1', String(c1.y));
    line.setAttribute('x2', String(c2.x));
    line.setAttribute('y2', String(c2.y));
    this.svgEl.appendChild(line);

    if (correct) {
      this.leftNodes[leftIdx].classList.add('matched');
      this.rightNodes[hitRightIdx].classList.add('matched');
      this.matched.add(leftIdx);

      if (this.matched.size === this.solution.length) {
        setTimeout(
          () =>
            this.dispatchEvent(
              new CustomEvent('minigame-success', { bubbles: true, composed: true })
            ),
          300
        );
      }
    } else {
      this.leftNodes[leftIdx].classList.add('wrong');
      this.rightNodes[hitRightIdx].classList.add('wrong');
      setTimeout(() => {
        this.leftNodes[leftIdx].classList.remove('wrong');
        this.rightNodes[hitRightIdx].classList.remove('wrong');
        this.svgEl.removeChild(line);
      }, 500);
    }
  }
}
