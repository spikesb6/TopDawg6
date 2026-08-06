/**
 * KAIRO: ASCENSION — client entry point.
 *
 * Binds the headless simulation to the renderer, camera, VFX, audio and HUD.
 *
 * Timing model: the simulation runs at a FIXED 60Hz regardless of display
 * refresh, and rendering interpolates between the last two simulation states.
 * This is why combat feels identical on a 60Hz laptop and a 144Hz monitor, and
 * it is the same model the headless tests run under — so a bug reproduced in a
 * test reproduces exactly in the game.
 */

import * as THREE from 'three';
import { Simulation, MatchPhase } from './gameplay/Simulation';
import { TICK_DT, FighterState } from './gameplay/CombatTypes';
import { KAIRO } from './characters/kairo';
import { VEYRON } from './characters/veyron';
import { FighterAI } from './ai/FighterAI';
import { DIFFICULTIES } from './ai/Difficulty';
import { CombatCamera } from './camera/CombatCamera';
import { RuinsOfVeyra } from './arena/RuinsOfVeyra';
import { FighterRig } from './render/FighterRig';
import { VFXSystem } from './vfx/VFXSystem';
import { AudioSystem, type SfxTag } from './audio/AudioSystem';
import { HUD, HUD_STYLES } from './ui/HUD';
import { emptyInputFrame, type InputFrame, type ActionName } from './core/Input';
import { clamp } from './core/Vec3';

// =====================================================================
// Boot
// =====================================================================

const style = document.createElement('style');
style.textContent = HUD_STYLES;
document.head.appendChild(style);

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const hud = new HUD();
document.body.appendChild(hud.root);

const overlay = document.createElement('div');
overlay.className = 'overlay show';
overlay.id = 'overlay';
document.body.appendChild(overlay);

// =====================================================================
// Renderer
// =====================================================================

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0716, 0.0062);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2000);

// --- Lighting. Anime fighters live and die on rim light: a cool key from
// --- above and two warm/cold rims that separate the fighters from the murk.
scene.add(new THREE.AmbientLight(0x3b3358, 1.05));
const key = new THREE.DirectionalLight(0xc9b6ff, 2.1);
key.position.set(28, 54, 22);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 190;
const sc = key.shadow.camera as THREE.OrthographicCamera;
sc.left = -55;
sc.right = 55;
sc.top = 55;
sc.bottom = -55;
sc.updateProjectionMatrix();
scene.add(key);

const rimA = new THREE.DirectionalLight(0x9d6bff, 1.5);
rimA.position.set(-40, 16, -34);
scene.add(rimA);
const rimB = new THREE.DirectionalLight(0x35f0c0, 1.0);
rimB.position.set(38, 12, -40);
scene.add(rimB);
// A dim uplight from the fractures keeps feet from vanishing into black.
const under = new THREE.PointLight(0xa877ff, 90, 90, 2);
under.position.set(0, -3, 0);
scene.add(under);

// =====================================================================
// Simulation and scene content
// =====================================================================

let difficulty = 'warrior';
const sim = new Simulation(KAIRO, VEYRON, { seed: (Math.random() * 1e9) | 0 });
let ai = new FighterAI(sim.fighters[1], sim.fighters[0], difficulty, (Math.random() * 1e9) | 0);

const arena = new RuinsOfVeyra(sim.arena.def);
scene.add(arena.group);

const rigs = sim.fighters.map((f) => new FighterRig(f));
for (const r of rigs) {
  scene.add(r.group);
  scene.add(r.shadowMesh);
}

const vfx = new VFXSystem(sim.projectiles.items.length);
vfx.colors = { fighter: [KAIRO.visual.energyColor, VEYRON.visual.energyColor] };
scene.add(vfx.group);
vfx.bind(sim.events);

const combatCam = new CombatCamera();
const audio = new AudioSystem();

hud.init(sim);

// =====================================================================
// Audio binding — the simulation emits, audio listens. No coupling.
// =====================================================================

const sfxFor = (tag: string): SfxTag => {
  if (tag.startsWith('hit_')) return tag as SfxTag;
  return 'hit_medium';
};

sim.events.on('hit', (e) => {
  const pitch = sim.fighters[e.source]?.data.audio.pitch ?? 1;
  audio.play(sfxFor(e.tag), clamp(e.magnitude * 1.6, 0.15, 1), pitch);
});
sim.events.on('block', () => audio.play('block', 0.5));
sim.events.on('parry', () => audio.play('parry', 0.9));
sim.events.on('guardBreak', () => audio.play('guardBreak', 1));
sim.events.on('dodge', (e) => {
  if (e.tag !== 'evade') audio.play('dodge', 0.5, pitchOf(e.source));
});
sim.events.on('dash', (e) => audio.play('dash', e.tag === 'pursuit' ? 1 : 0.5, pitchOf(e.source)));
sim.events.on('jump', (e) => audio.play('jump', 0.4, pitchOf(e.source)));
sim.events.on('land', (e) => audio.play('land', e.magnitude, pitchOf(e.source)));
sim.events.on('flightEnter', (e) => audio.play('flight', 0.6, pitchOf(e.source)));
sim.events.on('charge', (e) => audio.play('charge', 0.5, pitchOf(e.source)));
sim.events.on('projectileFired', (e) => {
  const t: SfxTag = e.tag.includes('spear')
    ? 'spear'
    : e.tag.includes('starfall')
      ? 'starfall'
      : 'bolt';
  audio.play(t, 0.6, pitchOf(e.source));
});
sim.events.on('explosion', () => audio.play('explosion', 0.9));
sim.events.on('wallImpact', (e) =>
  audio.play('wallImpact', e.tag === 'splat' ? 1 : 0.35, 0.9),
);
sim.events.on('groundImpact', (e) => audio.play('groundImpact', e.magnitude, 0.85));
sim.events.on('transformStart', (e) => {
  audio.play('transform', 1, pitchOf(e.source));
  audio.duck(2.2);
});
sim.events.on('ultimateStart', (e) => {
  audio.play('ultimate', 1, pitchOf(e.source));
  audio.duck(3.6);
});
sim.events.on('knockout', () => audio.play('knockout', 1));
sim.events.on('comboEscape', (e) => audio.play('parry', 0.6, pitchOf(e.source)));
sim.events.on('cameraShake', (e) => combatCam.addShake(e.magnitude));

function pitchOf(i: number): number {
  return sim.fighters[i]?.data.audio.pitch ?? 1;
}

// =====================================================================
// Input
// =====================================================================

const KEYMAP: Record<string, ActionName> = {
  KeyJ: 'light',
  KeyK: 'heavy',
  KeyL: 'guard',
  Space: 'jump',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  ControlLeft: 'descend',
  KeyC: 'descend',
  KeyE: 'dodge',
  KeyR: 'charge',
  Digit1: 'ability1',
  Digit2: 'ability2',
  Digit3: 'ability3',
  Digit4: 'ability4',
  KeyF: 'transform',
  KeyX: 'ultimate',
  Tab: 'lockOn',
};

const held = new Set<string>();
const playerInput: InputFrame = emptyInputFrame();
const aiInput: InputFrame = emptyInputFrame();
let mouseDX = 0;
let mouseDY = 0;
let pointerLocked = false;
let paused = false;
let showPerf = false;
/** When true the fixed-timestep loop is suspended and automation owns the clock. */
let manualClock = false;

addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  held.add(e.code);
  if (e.code === 'Escape') togglePause();
  if (e.code === 'F3') {
    showPerf = !showPerf;
  }
  if (e.code === 'KeyM') {
    audio.setMuted(!audio.muted);
  }
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

canvas.addEventListener('mousedown', (e) => {
  if (!pointerLocked) {
    canvas.requestPointerLock();
    return;
  }
  held.add(e.button === 0 ? 'MouseL' : e.button === 2 ? 'MouseR' : 'MouseM');
});
addEventListener('mouseup', (e) => {
  held.delete(e.button === 0 ? 'MouseL' : e.button === 2 ? 'MouseR' : 'MouseM');
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});
addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  mouseDX += e.movementX * 0.0026;
  mouseDY += e.movementY * 0.0021;
});

// Mouse buttons double as light/heavy so the game is playable either way.
KEYMAP.MouseL = 'light';
KEYMAP.MouseR = 'heavy';

function buildPlayerInput(): InputFrame {
  for (const k in playerInput.held) playerInput.held[k as ActionName] = false;
  for (const code of held) {
    const a = KEYMAP[code];
    if (a) playerInput.held[a] = true;
  }
  let mx = 0;
  let mz = 0;
  if (held.has('KeyW')) mz += 1;
  if (held.has('KeyS')) mz -= 1;
  if (held.has('KeyA')) mx -= 1;
  if (held.has('KeyD')) mx += 1;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  playerInput.moveX = mx;
  playerInput.moveZ = mz;
  playerInput.cameraYaw = combatCam.yaw;
  return playerInput;
}

// =====================================================================
// Menus
// =====================================================================

const CONTROLS: Array<[string, string]> = [
  ['W A S D', 'Move'],
  ['Space', 'Jump / tap again in air to FLY / ascend'],
  ['Ctrl or C', 'Descend'],
  ['Shift', 'Sprint / Boost flight'],
  ['Shift + E', 'Dash — toward a launched foe it becomes a PURSUIT DASH'],
  ['J or LMB', 'Light attack (chains up to 4)'],
  ['K or RMB', 'Heavy — tap for a fast heavy, HOLD to charge'],
  ['L + K', 'Launcher — starts aerial combos'],
  ['L', 'Guard — tap just before a hit for a PERFECT GUARD'],
  ['E', 'Dodge (invulnerable)'],
  ['L + E', 'Phase Break — escape a combo for one energy bar'],
  ['R', 'Charge Celestial Force'],
  ['1 2 3 4', 'Celestial Bolt / Nova Rush / Ascension Breaker / Starfall Barrage'],
  ['F', 'CELESTIAL SURGE — when the meter is full'],
  ['X', 'FINAL HORIZON — ultimate'],
  ['Tab', 'Toggle lock-on'],
  ['Esc', 'Pause'],
  ['F3', 'Performance overlay'],
  ['M', 'Mute'],
];

function controlsHTML(): string {
  return `<div class="controls">${CONTROLS.map(
    ([k, v]) => `<b>${k}</b><span>${v}</span>`,
  ).join('')}</div>`;
}

function showTitle(): void {
  overlay.innerHTML = `
    <h1 style="color:var(--kairo)">KAIRO<span style="color:var(--kairo-hi)">:</span> ASCENSION</h1>
    <h2>THE RUINS OF VEYRA &nbsp;·&nbsp; VERTICAL SLICE</h2>
    <div id="difficulty-row"></div>
    <button class="menu-btn" id="btn-start">BEGIN THE DUEL</button>
    ${controlsHTML()}
  `;
  const row = overlay.querySelector('#difficulty-row')!;
  for (const id of Object.keys(DIFFICULTIES)) {
    const b = document.createElement('button');
    b.className = 'diff-btn' + (id === difficulty ? ' sel' : '');
    b.textContent = DIFFICULTIES[id].name;
    b.onclick = () => {
      difficulty = id;
      ai.setDifficulty(id);
      audio.play('uiMove');
      row.querySelectorAll('.diff-btn').forEach((e) => e.classList.remove('sel'));
      b.classList.add('sel');
    };
    row.appendChild(b);
  }
  (overlay.querySelector('#btn-start') as HTMLElement).onclick = () => startMatch();
  overlay.classList.add('show');
}

function togglePause(): void {
  if (sim.phase === MatchPhase.Victory) return;
  if (paused) {
    resumeMatch();
  } else {
    paused = true;
    sim.pause();
    overlay.innerHTML = `
      <h1>PAUSED</h1>
      <button class="menu-btn" id="btn-resume">RESUME</button>
      <button class="menu-btn" id="btn-restart">RESTART MATCH</button>
      <button class="menu-btn" id="btn-title">RETURN TO TITLE</button>
      ${controlsHTML()}
    `;
    (overlay.querySelector('#btn-resume') as HTMLElement).onclick = () => resumeMatch();
    (overlay.querySelector('#btn-restart') as HTMLElement).onclick = () => startMatch();
    (overlay.querySelector('#btn-title') as HTMLElement).onclick = () => {
      paused = false;
      showTitle();
    };
    overlay.classList.add('show');
    audio.play('uiBack');
  }
}

function resumeMatch(): void {
  paused = false;
  sim.resume();
  overlay.classList.remove('show');
  audio.play('uiConfirm');
  canvas.requestPointerLock?.();
}

function startMatch(): void {
  sim.reset();
  ai = new FighterAI(sim.fighters[1], sim.fighters[0], difficulty, (Math.random() * 1e9) | 0);
  vfx.clear();
  arena.reset();
  combatCam.reset();
  hud.reset();
  paused = false;
  overlay.classList.remove('show');
  void audio.start().then(() => audio.startMusic());
  audio.play('uiConfirm');
  canvas.requestPointerLock?.();
}

function showResults(): void {
  const r = sim.result;
  const won = r?.winnerIndex === 0;
  const draw = r?.winnerIndex === -1;
  overlay.innerHTML = `
    <h1 style="color:${draw ? '#eae6ff' : won ? 'var(--kairo-hi)' : 'var(--danger)'}">
      ${draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT'}
    </h1>
    <h2>${
      draw
        ? 'NEITHER STOOD'
        : won
          ? 'VEYRA IS AVENGED — FOR NOW'
          : 'THE WARLORD ENDURES'
    }</h2>
    <div class="controls" style="grid-template-columns:auto auto;max-height:none">
      <b>Result</b><span>${r?.reason === 'timeout' ? 'Time out' : 'Knockout'}</span>
      <b>Duration</b><span>${((r?.durationFrames ?? 0) / 60).toFixed(1)}s</span>
      <b>Kairo damage</b><span>${r?.damageDealt[0] ?? 0}</span>
      <b>Veyron damage</b><span>${r?.damageDealt[1] ?? 0}</span>
      <b>Best combo</b><span>Kairo ${r?.bestCombo[0] ?? 0} · Veyron ${r?.bestCombo[1] ?? 0}</span>
    </div>
    <button class="menu-btn" id="btn-again">FIGHT AGAIN</button>
    <button class="menu-btn" id="btn-title2">RETURN TO TITLE</button>
  `;
  (overlay.querySelector('#btn-again') as HTMLElement).onclick = () => startMatch();
  (overlay.querySelector('#btn-title2') as HTMLElement).onclick = () => showTitle();
  overlay.classList.add('show');
  document.exitPointerLock?.();
}

showTitle();

// =====================================================================
// Main loop
// =====================================================================

let accumulator = 0;
let last = performance.now();
let resultsShown = false;
const projScreen = new THREE.Vector3();

// Rolling performance stats for the overlay and the evidence capture.
const frameTimes: number[] = [];
let simMsAccum = 0;
let renderMsAccum = 0;
let statFrames = 0;
let statFps = 0;
let statSimMs = 0;
let statRenderMs = 0;
let worstFrame = 0;
let statTimer = 0;

function resize(): void {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function loop(now: number): void {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  // Clamp so a tab-switch never produces a catch-up avalanche.
  dt = Math.min(dt, 0.25);
  frameTimes.push(dt * 1000);
  if (frameTimes.length > 120) frameTimes.shift();
  worstFrame = Math.max(worstFrame, dt * 1000);

  // --- Fixed-timestep simulation ---------------------------------------
  const simStart = performance.now();
  if (!paused && !manualClock && sim.phase !== MatchPhase.Victory) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= TICK_DT && steps < 6) {
      const pIn = buildPlayerInputWithScript();
      const aIn = ai.think();
      copyInto(aIn, aiInput);
      sim.tick(pIn, aiInput);
      accumulator -= TICK_DT;
      steps++;
    }
    if (steps >= 6) accumulator = 0; // give up on catching up
  }
  simMsAccum += performance.now() - simStart;

  // --- Camera look from mouse -------------------------------------------
  if (mouseDX !== 0 || mouseDY !== 0) {
    if (!sim.player.lockOnEnabled) combatCam.addLook(mouseDX, mouseDY);
    mouseDX = 0;
    mouseDY = 0;
  }

  const renderStart = performance.now();

  // --- Camera -------------------------------------------------------------
  const camState = combatCam.update(
    sim.player,
    sim.enemy,
    sim.arena,
    dt,
    sim.cinematicOwner,
  );
  camera.position.set(camState.position.x, camState.position.y, camState.position.z);
  camera.up.set(Math.sin(camState.roll), Math.cos(camState.roll), 0);
  camera.lookAt(camState.lookAt.x, camState.lookAt.y, camState.lookAt.z);
  if (Math.abs(camera.fov - camState.fov) > 0.01) {
    camera.fov = camState.fov;
    camera.updateProjectionMatrix();
  }

  // --- Rigs, arena, VFX ---------------------------------------------------
  for (const r of rigs) r.update(dt, now / 1000);

  const barrierInfo = sim.fighters.map((f) => {
    const d = Math.hypot(f.position.x, f.position.z);
    const near = clamp(
      (d - sim.arena.def.softRadius * 0.82) /
        (sim.arena.def.hardRadius - sim.arena.def.softRadius * 0.82),
      0,
      1,
    );
    return { x: f.position.x, y: f.position.y, z: f.position.z, near };
  });
  arena.update(dt, barrierInfo[0], barrierInfo[1]);
  arena.syncPillars();

  vfx.syncProjectiles(sim.projectiles.items);
  vfx.update(dt, camera.quaternion);

  // --- HUD ----------------------------------------------------------------
  const target = sim.enemy;
  let lockScreen = { x: 0, y: 0, visible: false };
  if (sim.player.lockOnEnabled && !target.defeated && sim.phase === MatchPhase.Fighting) {
    projScreen.set(
      target.position.x,
      target.position.y + target.data.visual.height * 0.6,
      target.position.z,
    );
    projScreen.project(camera);
    if (projScreen.z < 1) {
      lockScreen = {
        x: (projScreen.x * 0.5 + 0.5) * innerWidth,
        y: (-projScreen.y * 0.5 + 0.5) * innerHeight,
        visible: true,
      };
    }
  }
  hud.update(sim, dt, lockScreen);

  renderer.render(scene, camera);
  renderMsAccum += performance.now() - renderStart;

  // --- Stats --------------------------------------------------------------
  statFrames++;
  statTimer += dt;
  if (statTimer >= 0.5) {
    statFps = statFrames / statTimer;
    statSimMs = simMsAccum / statFrames;
    statRenderMs = renderMsAccum / statFrames;
    statFrames = 0;
    statTimer = 0;
    simMsAccum = 0;
    renderMsAccum = 0;
  }
  if (showPerf) {
    const s = vfx.stats();
    const p = sim.player;
    hud.setPerf(
      [
        `fps      ${statFps.toFixed(0)}`,
        `sim ms   ${statSimMs.toFixed(2)}`,
        `render   ${statRenderMs.toFixed(2)}`,
        `worst    ${worstFrame.toFixed(1)} ms`,
        `draws    ${renderer.info.render.calls}`,
        `tris     ${renderer.info.render.triangles}`,
        `sparks   ${s.sparks}`,
        `projs    ${sim.projectiles.activeCount}`,
        `---`,
        `state    ${p.state}`,
        `hp/en    ${Math.round(p.health.current)} / ${Math.round(p.energy.current)}`,
        `combo    ${p.combo.hits}`,
        `ai       ${ai.debugTactic}`,
        `phase    ${sim.phase}`,
      ].join('\n'),
      true,
    );
  } else {
    hud.setPerf('', false);
  }

  // --- Results ------------------------------------------------------------
  if (sim.phase === MatchPhase.Victory && !resultsShown) {
    resultsShown = true;
    audio.stopMusic();
    showResults();
  }
  if (sim.phase !== MatchPhase.Victory) resultsShown = false;
}

function copyInto(src: InputFrame, dst: InputFrame): void {
  dst.moveX = src.moveX;
  dst.moveZ = src.moveZ;
  dst.cameraYaw = src.cameraYaw;
  for (const k in src.held) dst.held[k as ActionName] = src.held[k as ActionName];
}

requestAnimationFrame(loop);

// =====================================================================
// Automation hook
//
// Exposes the live game to Playwright so the Gauntlet Loop can drive real
// matches in a real browser and capture evidence. This is a test seam, not a
// cheat surface — it only mirrors what the player can already do.
// =====================================================================

interface AutomationAPI {
  sim: Simulation;
  press: (a: ActionName, frames?: number) => void;
  move: (x: number, z: number) => void;
  start: () => void;
  stats: () => { fps: number; simMs: number; renderMs: number; worst: number };
  setDifficulty: (d: string) => void;
  resetWorst: () => void;
  state: () => Record<string, unknown>;
  /**
   * Steps the simulation a precise number of frames, independent of the
   * display refresh.
   *
   * Necessary because on a software renderer the browser may only manage ~10
   * fps, while the fixed-timestep loop still advances 6 sim ticks per rendered
   * frame to keep real time. A capture script driving input once per rendered
   * frame is then injecting one press per ~6 game frames, which is far too
   * sparse to actually play — the captured "gameplay" ends up being the AI
   * beating a motionless player. Taking manual control of the clock makes
   * captures deterministic and independent of render speed.
   */
  stepFrames: (n: number) => void;
  /** Suspends the automatic fixed-timestep loop so stepFrames owns the clock. */
  setManualClock: (on: boolean) => void;
}

const scriptedHold = new Map<ActionName, number>();
const automation: AutomationAPI = {
  sim,
  press(a, frames = 3) {
    scriptedHold.set(a, frames);
  },
  move(x, z) {
    scriptedMove.x = x;
    scriptedMove.z = z;
  },
  start: () => startMatch(),
  setDifficulty(d) {
    difficulty = d;
    ai.setDifficulty(d);
  },
  stats: () => ({
    fps: statFps,
    simMs: statSimMs,
    renderMs: statRenderMs,
    worst: worstFrame,
  }),
  resetWorst() {
    worstFrame = 0;
  },
  state: () => sim.snapshot(),
  setManualClock(on) {
    manualClock = on;
    accumulator = 0;
  },
  stepFrames(n) {
    for (let i = 0; i < n; i++) {
      if (sim.phase === MatchPhase.Victory) break;
      const pIn = buildPlayerInputWithScript();
      const aIn = ai.think();
      copyInto(aIn, aiInput);
      sim.tick(pIn, aiInput);
    }
  },
};
const scriptedMove = { x: 0, z: 0 };

// Fold scripted input into the player's input each frame.
function buildPlayerInputWithScript(): InputFrame {
  const f = buildPlayerInput();
  if (scriptedMove.x !== 0 || scriptedMove.z !== 0) {
    f.moveX = scriptedMove.x;
    f.moveZ = scriptedMove.z;
  }
  for (const [a, n] of scriptedHold) {
    f.held[a] = true;
    if (n <= 1) scriptedHold.delete(a);
    else scriptedHold.set(a, n - 1);
  }
  return f;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).KAIRO = automation;

export { FighterState };
