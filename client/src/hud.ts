import type { SelfState, WeaponId } from './network';

/** Mirrors the server's leveling curve (server/src/rooms/combat.ts) so the XP
 * bar can show progress without an extra round-trip. */
function xpNeeded(level: number): number {
  return 40 * level;
}

const LEVEL_CAP = 10;

/** DOM-overlay battle HUD: health/XP bars, weapon hotbar, damage vignette,
 * death overlay, and floating "+XP" text. Pure presentation — all values come
 * from the server via the schema self-watcher. */
export class Hud {
  private healthBarEl = document.querySelector<HTMLDivElement>('.hud-bar.health')!;
  private shieldFillEl = document.querySelector<HTMLDivElement>('#hud-shield-fill')!;
  private healthFillEl = document.querySelector<HTMLDivElement>('#hud-health-fill')!;
  private healthTextEl = document.querySelector<HTMLSpanElement>('#hud-health-text')!;
  private xpFillEl = document.querySelector<HTMLDivElement>('#hud-xp-fill')!;
  private xpTextEl = document.querySelector<HTMLSpanElement>('#hud-xp-text')!;
  private coinsTextEl = document.querySelector<HTMLSpanElement>('#hud-coins-text')!;
  private hudEl = document.querySelector<HTMLDivElement>('#hud')!;
  private hotbarEl = document.querySelector<HTMLDivElement>('#hotbar')!;
  private slotVassouraEl = document.querySelector<HTMLDivElement>('#hotbar-slot-vassoura')!;
  private slotChineloEl = document.querySelector<HTMLDivElement>('#hotbar-slot-chinelo')!;
  private slotSucoEl = document.querySelector<HTMLDivElement>('#hotbar-slot-suco')!;
  private sucoLabelEl = document.querySelector<HTMLSpanElement>('#hotbar-suco-label')!;
  private vignetteEl = document.querySelector<HTMLDivElement>('#damage-vignette')!;
  private deathOverlayEl = document.querySelector<HTMLDivElement>('#death-overlay')!;
  private deathCountdownEl = document.querySelector<HTMLSpanElement>('#death-countdown')!;
  private crosshairEl = document.querySelector<HTMLDivElement>('#crosshair')!;
  private floatsEl = document.querySelector<HTMLDivElement>('#hud-floats')!;
  private bossBarEl = document.querySelector<HTMLDivElement>('#boss-bar')!;
  private bossFillEl = document.querySelector<HTMLDivElement>('#boss-bar-fill')!;
  private bossTextEl = document.querySelector<HTMLSpanElement>('#boss-bar-text')!;

  private vignetteTimer = 0;
  private hitmarkTimer = 0;
  private countdownInterval = 0;
  private lastLevel = 0;
  private lastCoins = -1;
  private shakeTimer = 0;

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
