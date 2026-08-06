/**
 * Acceptance tests for the combat, defense, energy and ability systems.
 *
 * These run the REAL simulation — no mocks, no stubs. Every assertion is about
 * observable game state after N frames of real input, which is what makes them
 * valid evidence for the Gauntlet Loop.
 */

import { describe, it, expect } from 'vitest';
import { Simulation } from '../src/gameplay/Simulation';
import { FighterState } from '../src/gameplay/CombatTypes';
import { KAIRO } from '../src/characters/kairo';
import { VEYRON } from '../src/characters/veyron';
import { emptyInputFrame, type InputFrame, type ActionName } from '../src/core/Input';
import {
  damageScaling,
  hitstunScaling,
  COMBO_HARD_CAP,
} from '../src/gameplay/DamageModel';

// ---------------------------------------------------------------- helpers

function newSim(opts = {}) {
  return new Simulation(KAIRO, VEYRON, { skipIntro: true, seed: 42, ...opts });
}

/** Places the two fighters at a known separation, facing each other. */
function place(sim: Simulation, gap: number, height = 0): void {
  sim.fighters[0].position.set(0, 0, -gap / 2);
  sim.fighters[1].position.set(0, height, gap / 2);
  sim.fighters[0].yaw = 0;
  sim.fighters[1].yaw = Math.PI;
  sim.fighters[0].velocity.set(0, 0, 0);
  sim.fighters[1].velocity.set(0, 0, 0);
}

const NEUTRAL = emptyInputFrame();

function frameWith(...actions: ActionName[]): InputFrame {
  const f = emptyInputFrame();
  for (const a of actions) f.held[a] = true;
  return f;
}

/** Advances N frames with fixed inputs. */
function advance(sim: Simulation, n: number, a: InputFrame = NEUTRAL, b: InputFrame = NEUTRAL) {
  for (let i = 0; i < n; i++) sim.tick(a, b);
}

/** Presses an action for `hold` frames then releases for `gap` frames. */
function tap(sim: Simulation, action: ActionName, hold = 2, gap = 0, forB = false) {
  const f = frameWith(action);
  for (let i = 0; i < hold; i++) sim.tick(forB ? NEUTRAL : f, forB ? f : NEUTRAL);
  for (let i = 0; i < gap; i++) sim.tick(NEUTRAL, NEUTRAL);
}

/** Runs until `pred` is true or `max` frames elapse. Returns frames taken. */
function until(sim: Simulation, pred: () => boolean, max = 300, a = NEUTRAL, b = NEUTRAL) {
  for (let i = 0; i < max; i++) {
    if (pred()) return i;
    sim.tick(a, b);
  }
  return -1;
}

// ================================================================= MOVEMENT

describe('Movement', () => {
  it('accelerates to walk speed and stops promptly when input is released', () => {
    const sim = newSim();
    place(sim, 30);
    const k = sim.fighters[0];
    const fwd = emptyInputFrame();
    fwd.moveZ = 1;

    advance(sim, 40, fwd);
    const speed = k.velocity.lengthXZ;
    expect(speed).toBeGreaterThan(KAIRO.movement.walkSpeed * 0.9);

    // Deceleration must be snappy — "avoid floaty movement" is a P0 target.
    advance(sim, 12, NEUTRAL);
    expect(k.velocity.lengthXZ).toBeLessThan(0.5);
  });

  it('sprints faster than it walks', () => {
    const sim = newSim();
    place(sim, 40);
    const walk = emptyInputFrame();
    walk.moveZ = 1;
    advance(sim, 45, walk);
    const walkSpeed = sim.fighters[0].velocity.lengthXZ;

    const sim2 = newSim();
    place(sim2, 40);
    const sprint = frameWith('boost');
    sprint.moveZ = 1;
    advance(sim2, 45, sprint);
    const sprintSpeed = sim2.fighters[0].velocity.lengthXZ;

    expect(sprintSpeed).toBeGreaterThan(walkSpeed * 1.4);
  });

  it('jumps, falls under gravity and lands back on the ground', () => {
    const sim = newSim();
    place(sim, 30);
    const k = sim.fighters[0];
    tap(sim, 'jump', 3);
    advance(sim, 4);
    expect(k.grounded).toBe(false);
    expect(k.position.y).toBeGreaterThan(0.4);

    const landed = until(sim, () => k.grounded, 240);
    expect(landed).toBeGreaterThan(0);
    expect(k.position.y).toBeCloseTo(0, 3);
  });

  it('enters free flight from a mid-air jump tap and can ascend', () => {
    const sim = newSim();
    place(sim, 30);
    const k = sim.fighters[0];
    tap(sim, 'jump', 3);
    advance(sim, 10, NEUTRAL); // release so the second tap is a fresh press
    tap(sim, 'jump', 3);
    advance(sim, 2);
    expect(k.movement.flying).toBe(true);

    const yBefore = k.position.y;
    advance(sim, 40, frameWith('jump'));
    expect(k.position.y).toBeGreaterThan(yBefore + 3);
    expect(k.state === FighterState.Fly || k.state === FighterState.Boost).toBe(true);
  });

  it('boost flight is faster than normal flight and consumes energy', () => {
    const sim = newSim();
    place(sim, 60);
    const k = sim.fighters[0];
    k.movement.enterFlight(k.velocity);
    k.position.y = 10;

    const fly = emptyInputFrame();
    fly.moveZ = 1;
    advance(sim, 50, fly);
    const flySpeed = k.velocity.lengthXZ;

    const boost = frameWith('boost');
    boost.moveZ = 1;
    const energyBefore = k.energy.current;
    advance(sim, 50, boost);
    expect(k.velocity.lengthXZ).toBeGreaterThan(flySpeed * 1.5);
    expect(k.energy.current).toBeLessThan(energyBefore);
  });

  it('dashes a meaningful distance with the boost+dodge chord', () => {
    const sim = newSim();
    place(sim, 40);
    const k = sim.fighters[0];
    const start = k.position.clone();
    const dash = frameWith('boost', 'dodge');
    dash.moveZ = 1;
    advance(sim, 3, dash);
    expect(k.movement.dashing).toBe(true);
    advance(sim, 14, NEUTRAL);
    expect(start.distanceTo(k.position)).toBeGreaterThan(3.0);
  });

  it('is bounded by the arena and never escapes the hard radius', () => {
    const sim = newSim();
    const k = sim.fighters[0];
    const out = emptyInputFrame();
    out.moveZ = 1;
    // Fly straight at the boundary at full boost for 20 seconds.
    k.movement.enterFlight(k.velocity);
    k.position.y = 12;
    const boost = frameWith('boost');
    boost.moveZ = 1;
    advance(sim, 1200, boost);
    const r = Math.hypot(k.position.x, k.position.z);
    expect(r).toBeLessThanOrEqual(sim.arena.def.hardRadius + 0.01);
    expect(k.position.isFinite()).toBe(true);
  });
});

// =================================================================== MELEE

describe('Melee combat', () => {
  it('a light attack connects and deals damage', () => {
    const sim = newSim();
    place(sim, 2.4);
    const v = sim.fighters[1];
    const hpBefore = v.health.current;
    tap(sim, 'light', 2);
    advance(sim, 14);
    expect(v.health.current).toBeLessThan(hpBefore);
  });

  it('light attacks chain into a full 4-hit ground combo', () => {
    const sim = newSim();
    place(sim, 2.2);
    const k = sim.fighters[0];
    let hits = 0;
    sim.events.on('hit', (e) => {
      if (e.source === 0) hits++;
    });
    // Mash light with realistic press/release cadence.
    for (let i = 0; i < 90; i++) {
      sim.tick(i % 5 < 2 ? frameWith('light') : NEUTRAL, NEUTRAL);
    }
    expect(hits).toBeGreaterThanOrEqual(4);
    expect(k.combo.best).toBeGreaterThanOrEqual(4);
  });

  it('heavy attacks deal more damage and more hitstop than lights', () => {
    const light = KAIRO.attacks[KAIRO.lightChain[0]];
    const heavy = KAIRO.attacks[KAIRO.heavyAttack];
    expect(heavy.damage).toBeGreaterThan(light.damage * 1.8);
    expect(heavy.hitstop).toBeGreaterThan(light.hitstop);
    expect(heavy.startup).toBeGreaterThan(light.startup);
  });

  it('the launcher puts a grounded opponent into the air', () => {
    const sim = newSim();
    place(sim, 2.2);
    const v = sim.fighters[1];
    // Launcher is guard+heavy.
    advance(sim, 4, frameWith('guard', 'heavy'));
    advance(sim, 26);
    expect(v.position.y).toBeGreaterThan(1.5);
    expect(v.state === FighterState.Launched || !v.grounded).toBe(true);
  });

  it('hitstop freezes both fighters on connect', () => {
    const sim = newSim();
    place(sim, 2.2);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    let sawHitstop = false;
    for (let i = 0; i < 40; i++) {
      sim.tick(i < 2 ? frameWith('light') : NEUTRAL, NEUTRAL);
      if (k.hitstop > 0 && v.hitstop > 0) sawHitstop = true;
    }
    expect(sawHitstop).toBe(true);
  });

  it('a downed opponent cannot be hit on the ground (no knockdown loop)', () => {
    const sim = newSim();
    place(sim, 2.2);
    const v = sim.fighters[1];
    v.state = FighterState.Downed;
    v.reactionFrames = 40;
    const hpBefore = v.health.current;
    for (let i = 0; i < 20; i++) sim.tick(i % 4 < 2 ? frameWith('light') : NEUTRAL, NEUTRAL);
    expect(v.health.current).toBe(hpBefore);
  });

  it('an aerial chain connects on an airborne target', () => {
    const sim = newSim();
    place(sim, 2.0, 6);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    k.position.y = 6;
    k.movement.enterFlight(k.velocity);
    v.movement.enterFlight(v.velocity);
    v.state = FighterState.Hitstun;
    v.reactionFrames = 200; // hold them there for the test
    let hits = 0;
    sim.events.on('hit', (e) => {
      if (e.source === 0) hits++;
    });
    for (let i = 0; i < 70; i++) sim.tick(i % 5 < 2 ? frameWith('light') : NEUTRAL, NEUTRAL);
    expect(hits).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================ COMBO SAFETY

describe('Combo safety (P0: no infinites, no stunlock)', () => {
  it('damage scaling decreases monotonically and has a floor', () => {
    let prev = damageScaling(1);
    for (let i = 2; i <= 40; i++) {
      const s = damageScaling(i);
      expect(s).toBeLessThanOrEqual(prev + 1e-9);
      prev = s;
    }
    expect(damageScaling(60)).toBeGreaterThan(0.1);
    expect(damageScaling(60)).toBeLessThan(0.25);
  });

  it('hitstun scaling decreases and has a floor', () => {
    expect(hitstunScaling(1)).toBe(1);
    expect(hitstunScaling(30)).toBeLessThan(0.6);
    expect(hitstunScaling(100)).toBeGreaterThan(0.3);
  });

  it('a relentlessly mashing attacker cannot exceed the combo hard cap', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 2.0);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    v.health.max = 1e9;
    v.health.current = 1e9;
    for (let i = 0; i < 4000; i++) {
      sim.tick(i % 3 < 2 ? frameWith('light') : NEUTRAL, NEUTRAL);
    }
    expect(k.combo.best).toBeLessThanOrEqual(COMBO_HARD_CAP);
  });

  it('a defender left helpless always regains control within 10 seconds', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 2.0);
    const v = sim.fighters[1];
    v.health.max = 1e9;
    v.health.current = 1e9;
    let longestHelplessRun = 0;
    let run = 0;
    for (let i = 0; i < 3000; i++) {
      sim.tick(i % 3 < 2 ? frameWith('light') : NEUTRAL, NEUTRAL);
      if (v.isHelpless || v.hitstop > 0) {
        run++;
        longestHelplessRun = Math.max(longestHelplessRun, run);
      } else {
        run = 0;
      }
    }
    // 600 frames = 10 seconds. Anything approaching this is a stunlock.
    expect(longestHelplessRun).toBeLessThan(600);
  });
});

// ================================================================= DEFENSE

describe('Defense', () => {
  it('guarding reduces incoming damage to chip', () => {
    const openSim = newSim();
    place(openSim, 2.2);
    const openHp = openSim.fighters[1].health.current;
    for (let i = 0; i < 30; i++) openSim.tick(i < 2 ? frameWith('light') : NEUTRAL, NEUTRAL);
    const openDamage = openHp - openSim.fighters[1].health.current;

    const guardSim = newSim();
    place(guardSim, 2.2);
    const guardHp = guardSim.fighters[1].health.current;
    // Guard is held from well before the attack so the parry window has passed.
    advance(guardSim, 20, NEUTRAL, frameWith('guard'));
    for (let i = 0; i < 30; i++) {
      guardSim.tick(i < 2 ? frameWith('light') : NEUTRAL, frameWith('guard'));
    }
    const guardDamage = guardHp - guardSim.fighters[1].health.current;

    expect(openDamage).toBeGreaterThan(0);
    expect(guardDamage).toBeLessThan(openDamage * 0.3);
  });

  it('a perfect guard in the parry window negates damage and punishes', () => {
    const sim = newSim();
    place(sim, 2.2);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    let parried = false;
    sim.events.on('parry', () => {
      parried = true;
    });
    const hpBefore = v.health.current;

    // Start the attack, then raise guard just before the hitbox goes live.
    sim.tick(frameWith('light'), NEUTRAL);
    sim.tick(frameWith('light'), NEUTRAL);
    advance(sim, 2, NEUTRAL, NEUTRAL);
    // Kairo's light1 is 5f startup; guard raised here lands inside the window.
    for (let i = 0; i < 8; i++) sim.tick(NEUTRAL, frameWith('guard'));

    expect(parried).toBe(true);
    expect(v.health.current).toBe(hpBefore);
    // The attacker is punished with real frame disadvantage.
    expect(k.hitstop + k.defense.blockstunFrames).toBeGreaterThan(10);
  });

  it('sustained blocking eventually causes a guard break', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 2.2);
    const v = sim.fighters[1];
    let broke = false;
    sim.events.on('guardBreak', () => {
      broke = true;
    });
    // Hold guard permanently (so never in the parry window) and eat heavies.
    for (let i = 0; i < 900 && !broke; i++) {
      sim.tick(i % 40 < 3 ? frameWith('heavy') : NEUTRAL, frameWith('guard'));
    }
    expect(broke).toBe(true);
    expect(v.guard.fraction).toBeLessThan(0.6);
  });

  it('a dodge grants invulnerability frames', () => {
    const sim = newSim();
    place(sim, 2.2);
    const v = sim.fighters[1];
    const hpBefore = v.health.current;
    // Veyron dodges as Kairo attacks.
    for (let i = 0; i < 26; i++) {
      sim.tick(i < 2 ? frameWith('light') : NEUTRAL, i < 3 ? frameWith('dodge') : NEUTRAL);
    }
    expect(v.health.current).toBe(hpBefore);
  });

  it('Phase Break escapes a combo at the cost of a full energy bar', () => {
    const sim = newSim();
    place(sim, 2.0);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    v.energy.current = v.energy.max;
    let escaped = false;
    sim.events.on('comboEscape', (e) => {
      if (e.tag === 'phaseBreak') escaped = true;
    });
    const energyBefore = v.energy.current;
    // Kairo mashes; once deep enough into the combo Veyron burns a bar.
    for (let i = 0; i < 120 && !escaped; i++) {
      const deep = k.combo.hits >= VEYRON.defense.comboEscapeMinHits;
      sim.tick(
        i % 4 < 2 ? frameWith('light') : NEUTRAL,
        deep ? frameWith('guard', 'dodge') : NEUTRAL,
      );
    }
    expect(escaped).toBe(true);
    expect(v.energy.current).toBeLessThan(energyBefore);
    expect(k.combo.hits).toBe(0);
  });

  it('super armor lets Veyron absorb a jab and keep his attack', () => {
    const sim = newSim();
    place(sim, 2.4);
    const v = sim.fighters[1];
    // Veyron taps heavy: press enters the charge stance, release swings.
    advance(sim, 2, NEUTRAL, frameWith('heavy'));
    advance(sim, 2, NEUTRAL, NEUTRAL);
    expect(v.combat.isAttacking).toBe(true);
    expect(v.combat.current!.armor).toBeGreaterThan(0);
    // Kairo jabs into the armor while it is still in startup.
    advance(sim, 8, frameWith('light'), NEUTRAL);
    // The armored attack was not interrupted into hitstun.
    expect(v.state).not.toBe(FighterState.Hitstun);
    expect(v.state).not.toBe(FighterState.Launched);
  });
});

// ================================================================== ENERGY

describe('Energy system', () => {
  it('charging fills energy far faster than passive regen', () => {
    const simA = newSim();
    place(simA, 30);
    simA.fighters[0].energy.current = 0;
    advance(simA, 120);
    const passive = simA.fighters[0].energy.current;

    const simB = newSim();
    place(simB, 30);
    simB.fighters[0].energy.current = 0;
    advance(simB, 120, frameWith('charge'));
    const charged = simB.fighters[0].energy.current;

    expect(charged).toBeGreaterThan(passive * 5);
  });

  it('abilities cost energy and are refused when it is insufficient', () => {
    const sim = newSim();
    place(sim, 12);
    const k = sim.fighters[0];
    k.energy.current = 0;
    let refused = false;
    sim.events.on('abilityRefused', () => {
      refused = true;
    });
    advance(sim, 4, frameWith('ability1'));
    expect(refused).toBe(true);
    expect(k.activeAbility).toBeNull();

    // Release the button first: a press edge is required, and without the
    // neutral frames the second "press" is just a continued hold.
    advance(sim, 4, NEUTRAL);
    k.energy.current = k.energy.max;
    advance(sim, 4, frameWith('ability1'));
    expect(k.energy.current).toBeLessThan(k.energy.max);
  });

  it('cooldowns prevent immediate re-use of an ability', () => {
    const sim = newSim();
    place(sim, 12);
    const k = sim.fighters[0];
    k.energy.current = k.energy.max;
    advance(sim, 3, frameWith('ability1'));
    const ab = KAIRO.abilities.find((a) => a.slot === 1)!;
    // Run until the ability actually finishes. Its duration is not simply
    // startup+active+recovery: landing the bolt applies hitstop to the caster,
    // which pauses the ability clock.
    until(sim, () => k.activeAbility === null, 240);
    expect(k.cooldowns.isReady(ab.id)).toBe(false);
    expect(k.cooldowns.framesLeft(ab.id)).toBeGreaterThan(0);
  });
});

// =============================================================== ABILITIES

describe('Character abilities', () => {
  it('Celestial Bolt travels and damages the target', () => {
    const sim = newSim();
    place(sim, 20);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    k.energy.current = k.energy.max;
    const hp = v.health.current;
    let fired = 0;
    sim.events.on('projectileFired', () => fired++);
    advance(sim, 4, frameWith('ability1'));
    advance(sim, 90);
    expect(fired).toBe(1);
    expect(v.health.current).toBeLessThan(hp);
  });

  it('Nova Rush closes distance and connects', () => {
    const sim = newSim();
    place(sim, 22);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    k.energy.current = k.energy.max;
    const startGap = k.position.distanceTo(v.position);
    const hp = v.health.current;
    advance(sim, 4, frameWith('ability2'));
    advance(sim, 40);
    expect(k.position.distanceTo(v.position)).toBeLessThan(startGap * 0.5);
    expect(v.health.current).toBeLessThan(hp);
  });

  it('Ascension Breaker launches the opponent', () => {
    const sim = newSim();
    place(sim, 2.2);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    k.energy.current = k.energy.max;
    advance(sim, 4, frameWith('ability3'));
    advance(sim, 30);
    expect(v.position.y).toBeGreaterThan(2);
  });

  it('Starfall Barrage fires multiple projectiles', () => {
    const sim = newSim();
    place(sim, 18);
    const k = sim.fighters[0];
    k.energy.current = k.energy.max;
    let fired = 0;
    sim.events.on('projectileFired', () => fired++);
    advance(sim, 4, frameWith('ability4'));
    advance(sim, 90);
    expect(fired).toBeGreaterThanOrEqual(5);
  });

  it('Void Spear pierces and out-ranges Celestial Bolt', () => {
    const bolt = KAIRO.abilities.find((a) => a.id === 'celestial_bolt')!;
    const spear = VEYRON.abilities.find((a) => a.id === 'void_spear')!;
    expect(spear.projectile!.pierce).toBe(true);
    expect(spear.projectile!.range).toBeGreaterThan(bolt.projectile!.range);
    expect(spear.projectile!.damage).toBeGreaterThan(bolt.projectile!.damage);
  });

  it('Rift Counter punishes an attack made into it', () => {
    const sim = newSim();
    place(sim, 2.3);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    v.energy.current = v.energy.max;
    const kHp = k.health.current;
    let countered = false;
    sim.events.on('parry', (e) => {
      if (e.tag === 'counter') countered = true;
    });
    // Veyron enters the counter stance, Kairo attacks into it.
    advance(sim, 3, NEUTRAL, frameWith('ability3'));
    advance(sim, 4, NEUTRAL, NEUTRAL);
    advance(sim, 20, frameWith('light'), NEUTRAL);
    expect(countered).toBe(true);
    expect(k.health.current).toBeLessThan(kHp);
  });

  it('Black Star Detonation damages within its radius and not outside it', () => {
    const near = newSim();
    place(near, 5);
    near.fighters[1].energy.current = near.fighters[1].energy.max;
    const nearHp = near.fighters[0].health.current;
    advance(near, 4, NEUTRAL, frameWith('ability4'));
    advance(near, 40);
    expect(near.fighters[0].health.current).toBeLessThan(nearHp);

    const far = newSim();
    place(far, 40);
    far.fighters[1].energy.current = far.fighters[1].energy.max;
    const farHp = far.fighters[0].health.current;
    advance(far, 4, NEUTRAL, frameWith('ability4'));
    advance(far, 40);
    expect(far.fighters[0].health.current).toBe(farHp);
  });
});

// ========================================================== TRANSFORMATIONS

describe('Transformations', () => {
  it('cannot transform without a full Ascension meter', () => {
    const sim = newSim();
    place(sim, 10);
    const k = sim.fighters[0];
    k.ascension.current = 0;
    advance(sim, 4, frameWith('transform'));
    expect(k.transformed).toBe(false);
  });

  it('Celestial Surge boosts damage and speed, and expires on its own', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 10);
    const k = sim.fighters[0];
    k.ascension.current = k.ascension.max;
    advance(sim, 4, frameWith('transform'));
    expect(k.transformed).toBe(true);
    expect(k.damageMultiplier).toBeGreaterThan(1);
    expect(k.speedMultiplier).toBeGreaterThan(1);

    // It must be temporary — a permanent power state is an explicit non-goal.
    const ended = until(sim, () => !k.transformed, 60 * 60);
    expect(ended).toBeGreaterThan(0);
    expect(k.transformed).toBe(false);
  });

  it('the transformation sequence is invulnerable', () => {
    const sim = newSim();
    place(sim, 2.2);
    const v = sim.fighters[1];
    v.ascension.current = v.ascension.max;
    advance(sim, 3, NEUTRAL, frameWith('transform'));
    const hp = v.health.current;
    // Kairo attacks all through Veyron's transformation.
    for (let i = 0; i < 40; i++) sim.tick(i % 4 < 2 ? frameWith('light') : NEUTRAL, NEUTRAL);
    expect(v.health.current).toBe(hp);
  });

  it('transforming while in knockback does not corrupt the fighter state', () => {
    const sim = newSim();
    place(sim, 2.2);
    const v = sim.fighters[1];
    v.ascension.current = v.ascension.max;
    // Launch Veyron, then try to transform mid-flight.
    advance(sim, 4, frameWith('guard', 'heavy'), NEUTRAL);
    advance(sim, 14, NEUTRAL, frameWith('transform'));
    advance(sim, 120);
    expect(v.position.isFinite()).toBe(true);
    expect(Number.isFinite(v.health.current)).toBe(true);
    expect(v.state).not.toBe(FighterState.Cinematic);
  });
});

// ================================================================ ULTIMATES

describe('Ultimates', () => {
  it('Final Horizon captures a nearby opponent and deals heavy damage', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 6);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    k.energy.current = k.energy.max;
    v.health.current = v.health.max;
    let started = false;
    let captured = false;
    sim.events.on('ultimateStart', () => {
      started = true;
    });
    sim.events.on('ultimateImpact', (e) => {
      if (e.tag === 'captured') captured = true;
    });
    advance(sim, 4, frameWith('ultimate'));
    advance(sim, 200);
    expect(started).toBe(true);
    expect(captured).toBe(true);
    expect(v.health.max - v.health.current).toBeGreaterThan(200);
  });

  it('an ultimate is avoidable: escaping the capture range greatly reduces damage', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 6);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    k.energy.current = k.energy.max;
    advance(sim, 4, frameWith('ultimate'));
    // Veyron immediately teleports clear, simulating a successful escape.
    v.position.set(0, 0, 45);
    advance(sim, 220);
    const damage = v.health.max - v.health.current;
    expect(damage).toBeLessThan(120);
  });

  it('the ultimate ends cleanly and returns both fighters to normal states', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 6);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    k.energy.current = k.energy.max;
    v.health.max = 1e6;
    v.health.current = 1e6;
    advance(sim, 4, frameWith('ultimate'));
    advance(sim, 320);
    expect(k.activeAbility).toBeNull();
    expect(sim.cinematicOwner).toBe(-1);
    expect(k.state).not.toBe(FighterState.Cinematic);
    expect(v.state).not.toBe(FighterState.Cinematic);
  });

  it('an ultimate used at the arena boundary stays in bounds', () => {
    const sim = newSim({ matchSeconds: 600 });
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    const r = sim.arena.def.hardRadius - 1;
    k.position.set(0, 0, r);
    v.position.set(0, 0, r - 4);
    k.energy.current = k.energy.max;
    advance(sim, 4, frameWith('ultimate'));
    advance(sim, 260);
    for (const f of sim.fighters) {
      expect(Math.hypot(f.position.x, f.position.z)).toBeLessThanOrEqual(
        sim.arena.def.hardRadius + 0.01,
      );
      expect(f.position.isFinite()).toBe(true);
    }
  });
});

// =============================================================== MATCH FLOW

describe('Match flow', () => {
  it('a KO ends the match and records a winner', () => {
    const sim = newSim();
    place(sim, 2.2);
    sim.fighters[1].health.current = 20;
    for (let i = 0; i < 200; i++) sim.tick(i % 4 < 2 ? frameWith('light') : NEUTRAL, NEUTRAL);
    expect(sim.result).not.toBeNull();
    expect(sim.result!.winnerIndex).toBe(0);
    expect(sim.result!.reason).toBe('ko');
  });

  it('a timeout awards the win to the higher-health fighter', () => {
    const sim = newSim({ matchSeconds: 1 });
    place(sim, 30);
    sim.fighters[0].health.current = 800;
    sim.fighters[1].health.current = 400;
    advance(sim, 200);
    expect(sim.result?.reason).toBe('timeout');
    expect(sim.result?.winnerIndex).toBe(0);
  });

  it('simultaneous defeat is reported as a draw', () => {
    const sim = newSim();
    place(sim, 30);
    sim.fighters[0].health.current = 0;
    sim.fighters[1].health.current = 0;
    advance(sim, 4);
    expect(sim.result?.winnerIndex).toBe(-1);
  });

  it('pause halts the simulation and resume continues it', () => {
    const sim = newSim();
    place(sim, 30);
    const k = sim.fighters[0];
    const fwd = emptyInputFrame();
    fwd.moveZ = 1;
    advance(sim, 20, fwd);
    sim.pause();
    const pos = k.position.clone();
    advance(sim, 60, fwd);
    expect(k.position.distanceTo(pos)).toBeLessThan(1e-6);
    sim.resume();
    advance(sim, 20, fwd);
    expect(k.position.distanceTo(pos)).toBeGreaterThan(0.5);
  });

  it('reset restores full health and a clean state', () => {
    const sim = newSim();
    place(sim, 2.2);
    for (let i = 0; i < 200; i++) sim.tick(i % 4 < 2 ? frameWith('light') : NEUTRAL, NEUTRAL);
    sim.reset();
    expect(sim.fighters[0].health.current).toBe(KAIRO.maxHealth);
    expect(sim.fighters[1].health.current).toBe(VEYRON.maxHealth);
    expect(sim.result).toBeNull();
    expect(sim.projectiles.activeCount).toBe(0);
    expect(sim.fighters[0].state).toBe(FighterState.Idle);
  });

  it('restarting during a transformation leaves no residual state', () => {
    const sim = newSim();
    place(sim, 10);
    const k = sim.fighters[0];
    k.ascension.current = k.ascension.max;
    advance(sim, 6, frameWith('transform'));
    expect(k.transformed).toBe(true);
    sim.reset();
    expect(k.transformed).toBe(false);
    expect(k.ascension.active).toBe(false);
    expect(k.damageMultiplier).toBe(1);
  });
});

// ============================================================== EDGE CASES

describe('Edge cases and invalid states', () => {
  it('attacking into the arena boundary keeps both fighters in bounds', () => {
    const sim = newSim({ matchSeconds: 600 });
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    const r = sim.arena.def.hardRadius - 0.5;
    k.position.set(0, 0, r - 2);
    v.position.set(0, 0, r);
    for (let i = 0; i < 400; i++) sim.tick(i % 4 < 2 ? frameWith('heavy') : NEUTRAL, NEUTRAL);
    for (const f of sim.fighters) {
      expect(Math.hypot(f.position.x, f.position.z)).toBeLessThanOrEqual(
        sim.arena.def.hardRadius + 0.01,
      );
    }
  });

  it('recovers a fighter driven to a non-finite position', () => {
    const sim = newSim();
    place(sim, 10);
    const k = sim.fighters[0];
    k.position.set(NaN, NaN, NaN);
    advance(sim, 5);
    expect(k.position.isFinite()).toBe(true);
  });

  it('recovers a fighter wedged in an endless reaction state', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 10);
    const k = sim.fighters[0];
    k.state = FighterState.Hitstun;
    k.reactionFrames = 100000;
    advance(sim, 800);
    expect(k.isHelpless).toBe(false);
  });

  it('energy and health never go out of range under sustained abuse', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 2.0);
    for (let i = 0; i < 2000; i++) {
      const a = frameWith('light', 'heavy', 'ability1', 'ability2', 'boost', 'jump');
      const b = frameWith('guard', 'dodge', 'ability1', 'ability4');
      sim.tick(a, b);
      for (const f of sim.fighters) {
        expect(f.health.current).toBeGreaterThanOrEqual(0);
        expect(f.health.current).toBeLessThanOrEqual(f.health.max);
        expect(f.energy.current).toBeGreaterThanOrEqual(0);
        expect(f.energy.current).toBeLessThanOrEqual(f.energy.max);
      }
    }
  });

  it('the projectile pool never exceeds its hard cap', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 25);
    const k = sim.fighters[0];
    const v = sim.fighters[1];
    for (let i = 0; i < 2000; i++) {
      k.energy.current = k.energy.max;
      v.energy.current = v.energy.max;
      k.cooldowns.clear();
      v.cooldowns.clear();
      sim.tick(frameWith('ability4'), frameWith('ability1'));
      expect(sim.projectiles.activeCount).toBeLessThanOrEqual(96);
    }
  });

  it('losing the lock-on target does not break the fighter', () => {
    const sim = newSim();
    place(sim, 10);
    const k = sim.fighters[0];
    for (let i = 0; i < 60; i++) {
      // Toggle lock-on rapidly — the "rapid target changes" edge case.
      sim.tick(i % 2 === 0 ? frameWith('lockOn') : NEUTRAL, NEUTRAL);
    }
    expect(k.position.isFinite()).toBe(true);
    expect(k.state).toBeDefined();
  });

  it('both fighters attacking on the same frame resolves without corruption', () => {
    const sim = newSim({ matchSeconds: 600 });
    place(sim, 2.2);
    for (let i = 0; i < 600; i++) {
      const f = i % 5 < 2 ? frameWith('light') : NEUTRAL;
      sim.tick(f, f);
    }
    for (const f of sim.fighters) {
      expect(f.position.isFinite()).toBe(true);
      expect(f.health.current).toBeGreaterThanOrEqual(0);
    }
  });
});

// ================================================================ IDENTITY

describe('Fighter identity (they must feel different)', () => {
  it('Kairo is faster in every movement axis', () => {
    expect(KAIRO.movement.walkSpeed).toBeGreaterThan(VEYRON.movement.walkSpeed);
    expect(KAIRO.movement.sprintSpeed).toBeGreaterThan(VEYRON.movement.sprintSpeed);
    expect(KAIRO.movement.flySpeed).toBeGreaterThan(VEYRON.movement.flySpeed);
    expect(KAIRO.movement.airDashCharges).toBeGreaterThan(VEYRON.movement.airDashCharges);
    expect(KAIRO.movement.turnRate).toBeGreaterThan(VEYRON.movement.turnRate);
  });

  it('Veyron is tougher, longer-ranged and hits harder', () => {
    expect(VEYRON.maxHealth).toBeGreaterThan(KAIRO.maxHealth);
    expect(VEYRON.defense.guardMax).toBeGreaterThan(KAIRO.defense.guardMax);
    expect(VEYRON.attacks[VEYRON.heavyAttack].damage).toBeGreaterThan(
      KAIRO.attacks[KAIRO.heavyAttack].damage,
    );
    expect(VEYRON.attacks[VEYRON.heavyAttack].hitbox.reach).toBeGreaterThan(
      KAIRO.attacks[KAIRO.heavyAttack].hitbox.reach,
    );
    expect(VEYRON.attacks[VEYRON.heavyAttack].armor).toBeGreaterThan(0);
  });

  it('Kairo starts up faster and has a longer chain', () => {
    expect(KAIRO.attacks[KAIRO.lightChain[0]].startup).toBeLessThan(
      VEYRON.attacks[VEYRON.lightChain[0]].startup,
    );
    expect(KAIRO.lightChain.length).toBeGreaterThan(VEYRON.lightChain.length);
  });

  it('the two energy palettes are far apart in hue for readability', () => {
    const hue = (c: number) => {
      const r = ((c >> 16) & 255) / 255;
      const g = ((c >> 8) & 255) / 255;
      const b = (c & 255) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      if (d === 0) return 0;
      let h: number;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      return ((h * 60) + 360) % 360;
    };
    const hk = hue(KAIRO.visual.energyColor);
    const hv = hue(VEYRON.visual.energyColor);
    let delta = Math.abs(hk - hv);
    if (delta > 180) delta = 360 - delta;
    // At least 90 degrees apart — violet vs void-teal, never confusable.
    expect(delta).toBeGreaterThan(90);
  });
});
