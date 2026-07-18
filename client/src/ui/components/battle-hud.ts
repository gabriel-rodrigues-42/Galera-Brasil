import { sharedStyles } from '../shared-styles';
import type { SelfState, WeaponId } from '../../network';

/** Mirrors the server's leveling curve (server/src/rooms/combat.ts) so the XP
 * bar can show progress without an extra round-trip. */
function xpNeeded(level: number): number {
  return 40 * level;
}

const LEVEL_CAP = 10;

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    position: fixed;
    inset: 0;
    z-index: var(--z-hud);
    pointer-events: none;
  }

  :host([hidden]) {
    display: none;
  }

  #crosshair {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6px;
    height: 6px;
    margin: -3px 0 0 -3px;
    border-radius: 50%;
    background: rgba(244, 241, 232, 0.8);
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
    display: none;
  }

  #crosshair.locked {
    display: block;
  }

  #crosshair.hitmark {
    background: var(--color-brand-primary);
    box-shadow:
      0 0 6px rgba(255, 197, 66, 0.9),
      0 0 2px rgba(0, 0, 0, 0.6);
    transform: scale(1.6);
  }

  #hud {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: min(340px, 60vw);
  }

  #hud.hidden {
    display: none;
  }

  .hud-bar {
    position: relative;
    height: 22px;
    border-radius: 6px;
    background: rgba(10, 20, 15, 0.65);
    border: 1px solid rgba(244, 241, 232, 0.25);
    overflow: hidden;
  }

  .hud-bar.xp {
    height: 16px;
  }

  .hud-bar.health {
    transition: all 0.25s ease;
  }

  .hud-bar.health.has-shield {
    border-color: rgba(116, 214, 255, 0.8);
    box-shadow: 0 0 8px rgba(116, 214, 255, 0.4);
  }

  .hud-bar-fill {
    position: absolute;
    inset: 0 auto 0 0;
    width: 100%;
    transition: width 0.25s ease;
  }

  #hud-health-fill {
    background: linear-gradient(180deg, #e0524d, #a83a36);
  }

  .hud-bar.xp .hud-bar-fill {
    background: linear-gradient(180deg, #ffcf5c, #d9a83a);
  }

  #hud-shield-fill {
    background: linear-gradient(180deg, #3db2ff, #1d82d1);
    border-left: 2px solid rgba(255, 255, 255, 0.7);
    transition:
      width 0.25s ease,
      left 0.25s ease;
  }

  #hud-shield-fill.hidden {
    display: none;
  }

  .hud-bar-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: #f4f1e8;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .hud-bar.xp .hud-bar-text {
    font-size: 0.65rem;
  }

  #hud-coins-text {
    align-self: center;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(10, 20, 15, 0.68);
    border: 1px solid rgba(255, 207, 92, 0.45);
    color: #ffcf5c;
    font-size: 0.72rem;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  #hotbar {
    position: absolute;
    left: 50%;
    /* Sits above the centered #hud stack (shield+health+xp+coins ≈ 96px). */
    bottom: 110px;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
  }

  #hotbar.hidden {
    display: none;
  }

  .hotbar-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    width: 64px;
    padding: 6px 4px 4px;
    border-radius: 8px;
    background: rgba(10, 20, 15, 0.65);
    border: 2px solid rgba(244, 241, 232, 0.2);
    color: #f4f1e8;
    position: relative;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .hotbar-slot.active {
    border-color: #ffcf5c;
    background: rgba(255, 207, 92, 0.15);
  }

  .hotbar-slot.upgraded {
    border-color: #74d6ff;
    background: rgba(116, 214, 255, 0.14);
    box-shadow: inset 0 0 0 1px rgba(116, 214, 255, 0.18);
  }

  .hotbar-slot.consumable.empty {
    opacity: 0.55;
  }

  .hotbar-key {
    position: absolute;
    top: 2px;
    left: 5px;
    font-size: 0.65rem;
    font-weight: 700;
    opacity: 0.7;
  }

  .hotbar-icon {
    font-size: 1.4rem;
    line-height: 1.2;
  }

  .hotbar-label {
    font-size: 0.6rem;
    opacity: 0.85;
  }

  #boss-bar {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    width: min(440px, 72vw);
    height: 28px;
    border-radius: 8px;
    background: rgba(20, 8, 12, 0.7);
    border: 1px solid rgba(255, 207, 92, 0.55);
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  }

  #boss-bar.hidden {
    display: none;
  }

  #boss-bar-fill {
    position: absolute;
    inset: 0 auto 0 0;
    width: 100%;
    background: linear-gradient(180deg, #c2274d, #7c1230);
    transition: width 0.2s ease;
  }

  #boss-bar-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 700;
    color: #ffe9b8;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  }

  #hud-floats {
    position: absolute;
    left: 50%;
    top: 38%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .hud-float {
    font-weight: 800;
    color: #ffcf5c;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
    animation: hud-float-rise 1.4s ease-out forwards;
  }

  .hud-float.xp {
    font-size: 1.1rem;
  }

  .hud-float.level {
    font-size: 1.5rem;
    color: #7ed957;
  }

  .hud-float.coin {
    font-size: 1rem;
    color: #ffcf5c;
  }

  @keyframes hud-float-rise {
    0% {
      opacity: 0;
      transform: translateY(12px);
    }
    15% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateY(-42px);
    }
  }

  #damage-vignette {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 120px 40px rgba(200, 30, 30, 0.55);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  #damage-vignette.active {
    opacity: 1;
    transition: opacity 0.05s ease;
  }

  #death-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(6, 4, 4, 0.85);
    color: #f4f1e8;
    text-align: center;
  }

  #death-overlay.hidden {
    display: none;
  }

  #death-overlay h2 {
    margin: 0;
    font-size: 2rem;
    color: #e0524d;
  }

  #death-overlay p {
    margin: 0;
    opacity: 0.85;
  }
`);

/** Battle HUD (2.0, migrated to the design system in PLAN-UI Phase 4):
 * health/shield/XP/coins bars, weapon hotbar, boss bar, damage vignette,
 * crosshair, death overlay, and floating "+XP" text. Pure presentation —
 * all values come from the server via the schema self-watcher. Same public
 * method surface as the old client/src/hud.ts so combat.ts/main.ts only
 * change how they obtain the instance. */
export class BattleHud extends HTMLElement {
  private healthBarEl!: HTMLDivElement;
  private shieldFillEl!: HTMLDivElement;
  private healthFillEl!: HTMLDivElement;
  private healthTextEl!: HTMLSpanElement;
  private xpFillEl!: HTMLDivElement;
  private xpTextEl!: HTMLSpanElement;
  private coinsTextEl!: HTMLSpanElement;
  private hudEl!: HTMLDivElement;
  private hotbarEl!: HTMLDivElement;
  private slotVassouraEl!: HTMLDivElement;
  private slotChineloEl!: HTMLDivElement;
  private slotSucoEl!: HTMLDivElement;
  private sucoLabelEl!: HTMLSpanElement;
  private vignetteEl!: HTMLDivElement;
  private deathOverlayEl!: HTMLDivElement;
  private deathCountdownEl!: HTMLSpanElement;
  private crosshairEl!: HTMLDivElement;
  private floatsEl!: HTMLDivElement;
  private bossBarEl!: HTMLDivElement;
  private bossFillEl!: HTMLDivElement;
  private bossTextEl!: HTMLSpanElement;

  private vignetteTimer = 0;
  private hitmarkTimer = 0;
  private countdownInterval = 0;
  private lastLevel = 0;
  private lastCoins = -1;
  private shakeTimer = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot!.adoptedStyleSheets = [sharedStyles, sheet];
    this.shadowRoot!.innerHTML = `
      <div id="crosshair"></div>
      <div id="hud" class="hidden">
        <div class="hud-bar health">
          <div id="hud-health-fill" class="hud-bar-fill"></div>
          <div id="hud-shield-fill" class="hud-bar-fill shield-fill hidden"></div>
          <span id="hud-health-text" class="hud-bar-text">Vida 100/100</span>
        </div>
        <div class="hud-bar xp">
          <div id="hud-xp-fill" class="hud-bar-fill"></div>
          <span id="hud-xp-text" class="hud-bar-text">Nível 1 — 0/40 XP</span>
        </div>
        <div id="hud-coins-text">Moedas 0</div>
      </div>
      <div id="hotbar" class="hidden">
        <div id="hotbar-slot-vassoura" class="hotbar-slot active">
          <span class="hotbar-key">1</span>
          <span class="hotbar-icon">🧹</span>
          <span class="hotbar-label">Vassoura</span>
        </div>
        <div id="hotbar-slot-chinelo" class="hotbar-slot">
          <span class="hotbar-key">2</span>
          <span class="hotbar-icon">🩴</span>
          <span class="hotbar-label">Chinelo</span>
        </div>
        <div id="hotbar-slot-suco" class="hotbar-slot consumable">
          <span class="hotbar-key">3</span>
          <span class="hotbar-icon">🍊</span>
          <span id="hotbar-suco-label" class="hotbar-label">Suco x0</span>
        </div>
      </div>
      <div id="boss-bar" class="hidden">
        <div id="boss-bar-fill"></div>
        <span id="boss-bar-text">👑 Muriçoca Rainha</span>
      </div>
      <div id="hud-floats"></div>
      <div id="damage-vignette"></div>
      <div id="death-overlay" class="hidden">
        <h2>😵 Você desmaiou!</h2>
        <p>Os mosquitos venceram dessa vez...</p>
        <p>Voltando pra praça em <span id="death-countdown">3</span>s</p>
      </div>
    `;

    const sr = this.shadowRoot!;
    this.crosshairEl = sr.querySelector('#crosshair')!;
    this.hudEl = sr.querySelector('#hud')!;
    this.healthBarEl = sr.querySelector('.hud-bar.health')!;
    this.healthFillEl = sr.querySelector('#hud-health-fill')!;
    this.shieldFillEl = sr.querySelector('#hud-shield-fill')!;
    this.healthTextEl = sr.querySelector('#hud-health-text')!;
    this.xpFillEl = sr.querySelector('#hud-xp-fill')!;
    this.xpTextEl = sr.querySelector('#hud-xp-text')!;
    this.coinsTextEl = sr.querySelector('#hud-coins-text')!;
    this.hotbarEl = sr.querySelector('#hotbar')!;
    this.slotVassouraEl = sr.querySelector('#hotbar-slot-vassoura')!;
    this.slotChineloEl = sr.querySelector('#hotbar-slot-chinelo')!;
    this.slotSucoEl = sr.querySelector('#hotbar-slot-suco')!;
    this.sucoLabelEl = sr.querySelector('#hotbar-suco-label')!;
    this.vignetteEl = sr.querySelector('#damage-vignette')!;
    this.deathOverlayEl = sr.querySelector('#death-overlay')!;
    this.deathCountdownEl = sr.querySelector('#death-countdown')!;
    this.floatsEl = sr.querySelector('#hud-floats')!;
    this.bossBarEl = sr.querySelector('#boss-bar')!;
    this.bossFillEl = sr.querySelector('#boss-bar-fill')!;
    this.bossTextEl = sr.querySelector('#boss-bar-text')!;
  }

  /** HUD stays hidden until the first self-state arrives after connecting. */
  show() {
    this.hudEl.classList.remove('hidden');
    this.hotbarEl.classList.remove('hidden');
  }

  updateSelf(state: SelfState) {
    const totalMax = state.maxHp + state.maxShield;

    if (state.maxShield > 0) {
      this.healthBarEl.classList.add('has-shield');

      const hpPercent = totalMax > 0 ? (state.hp / totalMax) * 100 : 0;
      const shieldPercent = totalMax > 0 ? (state.shield / totalMax) * 100 : 0;

      this.healthFillEl.style.width = `${hpPercent}%`;

      this.shieldFillEl.classList.remove('hidden');
      this.shieldFillEl.style.left = `${hpPercent}%`;
      this.shieldFillEl.style.width = `${shieldPercent}%`;

      this.healthTextEl.textContent = `Vida ${state.hp}/${state.maxHp} + Shield ${state.shield}/${state.maxShield}`;
    } else {
      this.healthBarEl.classList.remove('has-shield');

      const hpFraction = state.maxHp > 0 ? state.hp / state.maxHp : 0;
      this.healthFillEl.style.width = `${Math.max(0, Math.min(1, hpFraction)) * 100}%`;

      this.shieldFillEl.classList.add('hidden');
      this.shieldFillEl.style.width = '0%';

      this.healthTextEl.textContent = `Vida ${state.hp}/${state.maxHp}`;
    }

    if (state.level >= LEVEL_CAP) {
      this.xpFillEl.style.width = '100%';
      this.xpTextEl.textContent = `Nível ${state.level} — máximo!`;
    } else {
      const needed = xpNeeded(state.level);
      this.xpFillEl.style.width = `${Math.max(0, Math.min(1, state.xp / needed)) * 100}%`;
      this.xpTextEl.textContent = `Nível ${state.level} — ${state.xp}/${needed} XP`;
    }

    if (this.lastLevel > 0 && state.level > this.lastLevel) {
      this.showFloat(`⭐ Nível ${state.level}!`, 'level');
    }

    if (this.lastCoins >= 0 && state.coins > this.lastCoins) {
      this.showFloat(`+${state.coins - this.lastCoins} moedas`, 'coin');
    }
    this.coinsTextEl.textContent = `Moedas ${state.coins}`;
    this.sucoLabelEl.textContent = `Suco x${state.sucos}`;
    this.slotSucoEl.classList.toggle('empty', state.sucos <= 0);
    this.slotChineloEl.classList.toggle('upgraded', state.reinforcedChinelo);
    const chineloLabel = this.slotChineloEl.querySelector<HTMLElement>('.hotbar-label');
    if (chineloLabel) chineloLabel.textContent = state.reinforcedChinelo ? 'Chinelo+' : 'Chinelo';
    this.lastLevel = state.level;
    this.lastCoins = state.coins;
  }

  setWeapon(weapon: WeaponId) {
    this.slotVassouraEl.classList.toggle('active', weapon === 'vassoura');
    this.slotChineloEl.classList.toggle('active', weapon === 'chinelo');
  }

  /** Toggles crosshair visibility with pointer-lock state (previously the
   * global `body.locked #crosshair` CSS rule; shadow DOM can't reach a
   * light-DOM class on `body`, so main.ts calls this from the lock/unlock
   * listeners instead). */
  setCrosshairLocked(locked: boolean) {
    this.crosshairEl.classList.toggle('locked', locked);
  }

  /** Red edge pulse when the local player takes damage. */
  flashDamage() {
    this.vignetteEl.classList.add('active');
    window.clearTimeout(this.vignetteTimer);
    this.vignetteTimer = window.setTimeout(() => this.vignetteEl.classList.remove('active'), 350);
  }

  /** Crosshair tick confirming a hit landed (server-validated). */
  flashHitmarker() {
    this.crosshairEl.classList.add('hitmark');
    window.clearTimeout(this.hitmarkTimer);
    this.hitmarkTimer = window.setTimeout(() => this.crosshairEl.classList.remove('hitmark'), 150);
  }

  showXpFloat(amount: number) {
    this.showFloat(`+${amount} XP`, 'xp');
  }

  /** Big top-of-screen bar while the Muriçoca Rainha is alive (2.3). */
  showBossBar() {
    this.bossBarEl.classList.remove('hidden');
  }

  updateBossBar(hp: number, maxHp: number, phase: number) {
    const fraction = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.bossFillEl.style.width = `${fraction * 100}%`;
    const phaseLabel = phase >= 2 ? ` · Fase ${phase}` : '';
    this.bossTextEl.textContent = `👑 Muriçoca Rainha${phaseLabel} — ${hp}/${maxHp}`;
  }

  hideBossBar() {
    this.bossBarEl.classList.add('hidden');
  }

  shakeBite() {
    document.body.classList.add('bite-shake');
    window.clearTimeout(this.shakeTimer);
    this.shakeTimer = window.setTimeout(() => document.body.classList.remove('bite-shake'), 220);
  }

  private showFloat(text: string, kind: 'xp' | 'level' | 'coin') {
    const el = document.createElement('div');
    el.className = `hud-float ${kind}`;
    el.textContent = text;
    this.floatsEl.appendChild(el);
    // Remove after the CSS animation ends (fallback timeout in case it doesn't fire)
    el.addEventListener('animationend', () => el.remove());
    window.setTimeout(() => el.remove(), 2000);
  }

  showDeath(respawnInMs: number) {
    this.deathOverlayEl.classList.remove('hidden');
    const deadline = Date.now() + respawnInMs;
    const tick = () => {
      const secs = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      this.deathCountdownEl.textContent = String(secs);
    };
    tick();
    window.clearInterval(this.countdownInterval);
    this.countdownInterval = window.setInterval(tick, 250);
  }

  hideDeath() {
    this.deathOverlayEl.classList.add('hidden');
    window.clearInterval(this.countdownInterval);
  }
}
