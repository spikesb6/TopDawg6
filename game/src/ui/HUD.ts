/**
 * HUD and menus.
 *
 * Built in DOM rather than in-world, for one reason that matters: the brief
 * requires the UI to stay readable during large VFX sequences. A DOM overlay is
 * composited above the canvas and is physically incapable of being washed out
 * by additive bloom, no matter how bright the ultimate gets.
 *
 * Layout follows fighting-game convention (opposed bars top-left/top-right,
 * timer centre) because that convention is load-bearing: players read those
 * positions without looking directly at them.
 */

import type { Fighter } from '../gameplay/Fighter';
import type { Simulation } from '../gameplay/Simulation';
import { MatchPhase } from '../gameplay/Simulation';
import { AbilityRefusal } from '../gameplay/Ability';

const css = String.raw;

export const HUD_STYLES = css`
  :root {
    --kairo: #9d6bff;
    --kairo-hi: #f0c46a;
    --veyron: #35f0c0;
    --veyron-hi: #7cffe4;
    --danger: #ff4d6a;
    --panel: rgba(8, 6, 16, 0.66);
  }
  * {
    box-sizing: border-box;
  }
  html,
  body {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    background: #05040c;
    font-family: 'Rajdhani', 'Eurostile', 'Bahnschrift', 'DIN Alternate',
      system-ui, sans-serif;
    color: #eae6ff;
    -webkit-font-smoothing: antialiased;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  #hud {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 10;
    /* A subtle vignette keeps the HUD legible over bright VFX. */
    background: radial-gradient(
      ellipse at center,
      transparent 52%,
      rgba(0, 0, 0, 0.42) 100%
    );
  }
  .fighter-panel {
    position: absolute;
    top: 22px;
    width: 40%;
    max-width: 520px;
    min-width: 280px;
  }
  .fighter-panel.left {
    left: 26px;
  }
  .fighter-panel.right {
    right: 26px;
    text-align: right;
  }
  .name-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 5px;
  }
  .right .name-row {
    flex-direction: row-reverse;
  }
  .fname {
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.95);
  }
  .ftag {
    font-size: 11px;
    letter-spacing: 0.2em;
    opacity: 0.5;
    text-transform: uppercase;
  }
  .bar {
    position: relative;
    height: 19px;
    background: rgba(0, 0, 0, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.16);
    overflow: hidden;
    /* Angled ends — reads as "fighting game" without borrowing any artwork. */
    clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  }
  .right .bar {
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 100%, 10px 100%);
  }
  /* Delayed "chip" layer drains behind the real bar so damage reads as a hit. */
  .bar .chip {
    position: absolute;
    inset: 0;
    background: rgba(255, 90, 110, 0.55);
    transform-origin: left center;
    transition: transform 0.42s cubic-bezier(0.2, 0, 0.1, 1) 0.22s;
  }
  .right .bar .chip {
    transform-origin: right center;
  }
  .bar .fill {
    position: absolute;
    inset: 0;
    transform-origin: left center;
    transition: transform 0.07s linear;
  }
  .right .bar .fill {
    transform-origin: right center;
  }
  .bar.hp .fill {
    background: linear-gradient(90deg, #fff 0%, var(--c) 12%, var(--c2) 100%);
    box-shadow: 0 0 18px var(--c);
  }
  .bar.hp.low .fill {
    animation: pulse 0.55s ease-in-out infinite alternate;
  }
  @keyframes pulse {
    from {
      filter: brightness(1);
    }
    to {
      filter: brightness(1.85);
    }
  }
  .hp-num {
    font-size: 12px;
    opacity: 0.75;
    margin-top: 2px;
    letter-spacing: 0.1em;
  }
  .energy-row {
    display: flex;
    gap: 3px;
    margin-top: 6px;
    height: 9px;
  }
  .right .energy-row {
    flex-direction: row-reverse;
  }
  .ebar {
    flex: 1;
    background: rgba(0, 0, 0, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.14);
    position: relative;
    overflow: hidden;
  }
  .ebar i {
    position: absolute;
    inset: 0;
    transform-origin: left center;
    transform: scaleX(0);
    background: var(--c);
    box-shadow: 0 0 10px var(--c);
    transition: transform 0.1s linear;
  }
  .right .ebar i {
    transform-origin: right center;
  }
  .ebar.full i {
    background: linear-gradient(90deg, var(--c), #fff);
  }
  .meta-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 7px;
    font-size: 11px;
    letter-spacing: 0.16em;
  }
  .right .meta-row {
    flex-direction: row-reverse;
  }
  .guard {
    width: 84px;
    height: 4px;
    background: rgba(0, 0, 0, 0.6);
    position: relative;
  }
  .guard i {
    position: absolute;
    inset: 0;
    background: #7fd4ff;
    transform-origin: left center;
    transition: transform 0.14s linear;
  }
  .right .guard i {
    transform-origin: right center;
  }
  .guard.broken i {
    background: var(--danger);
  }
  .surge {
    padding: 2px 9px;
    border: 1px solid var(--c);
    color: var(--c);
    opacity: 0.35;
    font-weight: 700;
    letter-spacing: 0.18em;
    transition: opacity 0.2s;
  }
  .surge.ready {
    opacity: 1;
    animation: surgeGlow 0.75s ease-in-out infinite alternate;
  }
  .surge.active {
    opacity: 1;
    background: var(--c);
    color: #06040e;
  }
  @keyframes surgeGlow {
    from {
      box-shadow: 0 0 0 var(--c);
    }
    to {
      box-shadow: 0 0 16px var(--c);
    }
  }
  #timer {
    position: absolute;
    top: 18px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 46px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-shadow: 0 3px 22px #000, 0 0 34px rgba(157, 107, 255, 0.4);
    font-variant-numeric: tabular-nums;
  }
  #timer.urgent {
    color: var(--danger);
  }
  #combo {
    position: absolute;
    left: 7%;
    top: 40%;
    opacity: 0;
    transform: translateY(14px) scale(0.86);
    transition: opacity 0.12s, transform 0.12s;
  }
  #combo.show {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  #combo .n {
    font-size: 72px;
    font-weight: 700;
    line-height: 0.85;
    color: var(--kairo-hi);
    text-shadow: 0 0 30px rgba(240, 196, 106, 0.65), 0 4px 14px #000;
  }
  #combo .l {
    font-size: 17px;
    letter-spacing: 0.36em;
    opacity: 0.85;
  }
  #abilities {
    position: absolute;
    bottom: 26px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 9px;
  }
  .slot {
    width: 74px;
    padding: 7px 5px 6px;
    background: var(--panel);
    border: 1px solid rgba(255, 255, 255, 0.14);
    text-align: center;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(5px);
  }
  .slot .k {
    font-size: 11px;
    opacity: 0.55;
    letter-spacing: 0.14em;
  }
  .slot .n {
    font-size: 10px;
    letter-spacing: 0.06em;
    margin-top: 2px;
    line-height: 1.15;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-transform: uppercase;
  }
  .slot .cost {
    font-size: 9px;
    opacity: 0.5;
    letter-spacing: 0.1em;
  }
  .slot.ready {
    border-color: var(--kairo);
    box-shadow: 0 0 14px rgba(157, 107, 255, 0.28) inset;
  }
  .slot.unaffordable {
    opacity: 0.34;
  }
  .slot .cd {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    background: var(--kairo);
    transition: width 0.08s linear;
  }
  .slot.ult {
    width: 96px;
    border-color: var(--kairo-hi);
  }
  .slot.ult.ready {
    animation: surgeGlow 0.8s ease-in-out infinite alternate;
    --c: var(--kairo-hi);
  }
  #lockon {
    position: absolute;
    width: 62px;
    height: 62px;
    margin: -31px 0 0 -31px;
    opacity: 0;
    transition: opacity 0.18s;
  }
  #lockon.show {
    opacity: 1;
  }
  #lockon svg {
    width: 100%;
    height: 100%;
  }
  #feedback {
    position: absolute;
    bottom: 130px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 15px;
    letter-spacing: 0.2em;
    color: var(--danger);
    opacity: 0;
    transition: opacity 0.16s;
    text-shadow: 0 2px 10px #000;
  }
  #feedback.show {
    opacity: 1;
  }
  #banner {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.3s;
    text-align: center;
  }
  #banner.show {
    opacity: 1;
  }
  #banner .big {
    font-size: 94px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-shadow: 0 0 60px currentColor, 0 6px 26px #000;
  }
  #banner .sub {
    font-size: 15px;
    letter-spacing: 0.4em;
    opacity: 0.72;
  }
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    background: rgba(4, 3, 10, 0.9);
    backdrop-filter: blur(9px);
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    pointer-events: auto;
  }
  .overlay.show {
    display: flex;
  }
  .overlay h1 {
    font-size: 46px;
    letter-spacing: 0.3em;
    margin: 0 0 6px;
    font-weight: 700;
  }
  .overlay h2 {
    font-size: 15px;
    letter-spacing: 0.34em;
    opacity: 0.6;
    margin: 0 0 18px;
    font-weight: 400;
  }
  .menu-btn {
    pointer-events: auto;
    min-width: 300px;
    padding: 13px 26px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.24);
    color: #eae6ff;
    font: inherit;
    font-size: 15px;
    letter-spacing: 0.24em;
    cursor: pointer;
    transition: all 0.14s;
    text-transform: uppercase;
  }
  .menu-btn:hover,
  .menu-btn:focus-visible {
    background: var(--kairo);
    border-color: var(--kairo);
    color: #06040e;
    outline: none;
    transform: scale(1.02);
  }
  .controls {
    margin-top: 14px;
    display: grid;
    grid-template-columns: auto auto;
    gap: 5px 20px;
    font-size: 12.5px;
    letter-spacing: 0.09em;
    opacity: 0.68;
    max-height: 44vh;
    overflow: auto;
  }
  .controls b {
    color: var(--kairo);
    font-weight: 600;
  }
  #perf {
    position: absolute;
    top: 8px;
    left: 8px;
    font-size: 11px;
    font-family: ui-monospace, monospace;
    background: rgba(0, 0, 0, 0.62);
    padding: 6px 9px;
    line-height: 1.5;
    white-space: pre;
    display: none;
    letter-spacing: 0;
  }
  #perf.show {
    display: block;
  }
  #difficulty-row {
    display: flex;
    gap: 8px;
  }
  .diff-btn {
    pointer-events: auto;
    padding: 8px 15px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #eae6ff;
    font: inherit;
    font-size: 12px;
    letter-spacing: 0.16em;
    cursor: pointer;
  }
  .diff-btn.sel {
    background: var(--kairo);
    border-color: var(--kairo);
    color: #06040e;
  }
`;

const LOCKON_SVG = `
<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3">
  <circle cx="50" cy="50" r="30" stroke-opacity="0.34"/>
  <path d="M50 8 L50 22 M50 78 L50 92 M8 50 L22 50 M78 50 L92 50" stroke-opacity="0.8"/>
  <path d="M26 26 L26 38 M26 26 L38 26 M74 26 L74 38 M74 26 L62 26
           M26 74 L26 62 M26 74 L38 74 M74 74 L74 62 M74 74 L62 74"/>
</svg>`;

export class HUD {
  readonly root: HTMLDivElement;
  private readonly els: Record<string, HTMLElement> = {};
  /** Delayed chip-damage values so health loss reads as an event. */
  private chip: [number, number] = [1, 1];
  private feedbackTimer = 0;
  private comboTimer = 0;
  private lastCombo = 0;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="fighter-panel left" id="p0"></div>
      <div class="fighter-panel right" id="p1"></div>
      <div id="timer">180</div>
      <div id="combo"><div class="n">0</div><div class="l">HITS</div></div>
      <div id="abilities"></div>
      <div id="lockon">${LOCKON_SVG}</div>
      <div id="feedback"></div>
      <div id="banner"><div class="big"></div><div class="sub"></div></div>
      <div id="perf"></div>
    `;
    for (const id of ['p0', 'p1', 'timer', 'combo', 'abilities', 'lockon', 'feedback', 'banner', 'perf']) {
      this.els[id] = this.root.querySelector(`#${id}`) as HTMLElement;
    }
  }

  /** Builds the static structure once both fighters are known. */
  init(sim: Simulation): void {
    for (let i = 0; i < 2; i++) {
      const f = sim.fighters[i];
      const c = i === 0 ? 'var(--kairo)' : 'var(--veyron)';
      const c2 = i === 0 ? 'var(--kairo-hi)' : 'var(--veyron-hi)';
      const bars = Array.from(
        { length: f.data.energyBars },
        () => `<div class="ebar" style="--c:${c}"><i></i></div>`,
      ).join('');
      this.els[`p${i}`].innerHTML = `
        <div class="name-row">
          <div class="fname" style="color:${c}">${f.data.name}</div>
          <div class="ftag">${f.data.energyName}</div>
        </div>
        <div class="bar hp" style="--c:${c};--c2:${c2}">
          <div class="chip"></div><div class="fill"></div>
        </div>
        <div class="hp-num"></div>
        <div class="energy-row">${bars}</div>
        <div class="meta-row">
          <div class="guard"><i></i></div>
          <div class="surge" style="--c:${c2}">${f.data.transformation.name}</div>
        </div>
      `;
    }

    // Ability slots for the player only.
    const p = sim.fighters[0];
    const keys = ['1', '2', '3', '4'];
    const slots = p.data.abilities
      .map(
        (a, i) => `
      <div class="slot" data-ab="${a.id}">
        <div class="k">${keys[i] ?? ''}</div>
        <div class="n">${a.name}</div>
        <div class="cost">${a.energyCost}</div>
        <div class="cd" style="width:100%"></div>
      </div>`,
      )
      .join('');
    this.els.abilities.innerHTML =
      slots +
      `<div class="slot ult" data-ab="${p.data.ultimate.id}">
        <div class="k">X</div>
        <div class="n">${p.data.ultimate.name}</div>
        <div class="cost">${p.data.ultimate.energyCost}</div>
        <div class="cd" style="width:100%"></div>
      </div>`;

    this.chip = [1, 1];
  }

  update(sim: Simulation, dt: number, lockOnScreen: { x: number; y: number; visible: boolean }): void {
    for (let i = 0; i < 2; i++) this.updateFighter(sim.fighters[i], i, dt);
    this.updateTimer(sim);
    this.updateCombo(sim, dt);
    this.updateAbilities(sim.fighters[0]);
    this.updateLockOn(lockOnScreen);
    this.updateFeedback(sim, dt);
    this.updateBanner(sim);
  }

  private updateFighter(f: Fighter, i: number, dt: number): void {
    const panel = this.els[`p${i}`];
    const hp = f.health.fraction;
    const fill = panel.querySelector('.fill') as HTMLElement;
    const chipEl = panel.querySelector('.chip') as HTMLElement;
    const bar = panel.querySelector('.bar.hp') as HTMLElement;
    fill.style.transform = `scaleX(${hp})`;
    // Chip layer only ever catches up downward, so it trails the real bar.
    if (hp < this.chip[i]) this.chip[i] = Math.max(hp, this.chip[i] - dt * 0.22);
    else this.chip[i] = hp;
    chipEl.style.transform = `scaleX(${this.chip[i]})`;
    bar.classList.toggle('low', hp < 0.25);
    (panel.querySelector('.hp-num') as HTMLElement).textContent =
      `${Math.ceil(f.health.current)} / ${f.health.max}`;

    const ebars = panel.querySelectorAll('.ebar');
    const filled = f.energy.filledBars;
    const partial = f.energy.partialBar;
    ebars.forEach((el, idx) => {
      const inner = el.querySelector('i') as HTMLElement;
      const v = idx < filled ? 1 : idx === filled ? partial : 0;
      inner.style.transform = `scaleX(${v})`;
      el.classList.toggle('full', v >= 0.999);
    });

    const g = panel.querySelector('.guard') as HTMLElement;
    (g.querySelector('i') as HTMLElement).style.transform = `scaleX(${f.guard.fraction})`;
    g.classList.toggle('broken', f.guard.broken);

    const s = panel.querySelector('.surge') as HTMLElement;
    s.classList.toggle('ready', f.ascension.canTransform);
    s.classList.toggle('active', f.transformed);
  }

  private updateTimer(sim: Simulation): void {
    const secs = Math.ceil(sim.timerFrames / 60);
    this.els.timer.textContent = String(secs);
    this.els.timer.classList.toggle('urgent', secs <= 15);
  }

  private updateCombo(sim: Simulation, dt: number): void {
    const hits = sim.fighters[0].combo.hits;
    if (hits >= 2) {
      this.comboTimer = 1.1;
      this.lastCombo = hits;
    } else {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
    }
    const el = this.els.combo;
    el.classList.toggle('show', this.comboTimer > 0);
    if (this.comboTimer > 0) {
      (el.querySelector('.n') as HTMLElement).textContent = String(this.lastCombo);
    }
  }

  private updateAbilities(p: Fighter): void {
    const slots = this.els.abilities.querySelectorAll('.slot');
    const all = [...p.data.abilities, p.data.ultimate];
    slots.forEach((el, i) => {
      const a = all[i];
      if (!a) return;
      const ready = p.cooldowns.isReady(a.id);
      const afford = p.energy.has(a.energyCost);
      el.classList.toggle('ready', ready && afford);
      el.classList.toggle('unaffordable', !afford);
      const cd = el.querySelector('.cd') as HTMLElement;
      cd.style.width = `${p.cooldowns.progress(a.id, a.cooldown) * 100}%`;
    });
  }

  private updateLockOn(s: { x: number; y: number; visible: boolean }): void {
    const el = this.els.lockon;
    el.classList.toggle('show', s.visible);
    if (s.visible) {
      el.style.left = `${s.x}px`;
      el.style.top = `${s.y}px`;
    }
  }

  private updateFeedback(sim: Simulation, dt: number): void {
    const p = sim.fighters[0];
    if (p.lastRefusal !== AbilityRefusal.None) {
      const msg =
        p.lastRefusal === AbilityRefusal.NotEnoughEnergy
          ? 'NOT ENOUGH CELESTIAL FORCE'
          : p.lastRefusal === AbilityRefusal.OnCooldown
            ? 'RECHARGING'
            : p.lastRefusal === AbilityRefusal.WrongStance
              ? 'CANNOT USE HERE'
              : '';
      if (msg) {
        this.els.feedback.textContent = msg;
        this.feedbackTimer = 1.0;
      }
      p.lastRefusal = AbilityRefusal.None;
    }
    this.feedbackTimer = Math.max(0, this.feedbackTimer - dt);
    this.els.feedback.classList.toggle('show', this.feedbackTimer > 0);
  }

  private updateBanner(sim: Simulation): void {
    const el = this.els.banner;
    const big = el.querySelector('.big') as HTMLElement;
    const sub = el.querySelector('.sub') as HTMLElement;
    if (sim.phase === MatchPhase.Intro) {
      el.classList.add('show');
      big.textContent = 'READY';
      big.style.color = 'var(--kairo)';
      sub.textContent = 'THE RUINS OF VEYRA';
    } else if (sim.phase === MatchPhase.Fighting && sim.frame < 48) {
      el.classList.add('show');
      big.textContent = 'FIGHT';
      big.style.color = 'var(--kairo-hi)';
      sub.textContent = '';
    } else if (sim.phase === MatchPhase.KO) {
      el.classList.add('show');
      big.textContent = sim.result?.reason === 'timeout' ? 'TIME' : 'K.O.';
      big.style.color = 'var(--danger)';
      sub.textContent = '';
    } else {
      el.classList.remove('show');
    }
  }

  setPerf(text: string, show: boolean): void {
    this.els.perf.classList.toggle('show', show);
    if (show) this.els.perf.textContent = text;
  }

  reset(): void {
    this.chip = [1, 1];
    this.comboTimer = 0;
    this.feedbackTimer = 0;
  }
}
