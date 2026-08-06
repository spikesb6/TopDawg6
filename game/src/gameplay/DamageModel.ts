/**
 * Combo proration and the anti-infinite ruleset.
 *
 * The brief lists "infinite combos" and "stunlock loops" as P0 failures. Rather
 * than relying on animators to avoid them, they are made structurally
 * impossible here by four independent mechanisms, any one of which would break
 * a loop on its own:
 *
 *   1. Damage scaling      — later hits in a combo deal progressively less.
 *   2. Hitstun proration   — later hits stun for less time, so eventually the
 *                            victim recovers before the next hit can connect.
 *   3. Juggle gravity decay— each aerial hit increases gravity on the victim,
 *                            so juggles inevitably drop out of range.
 *   4. Hard combo cap      — at COMBO_HARD_CAP the victim is forcibly ejected
 *                            with invulnerability. Nothing can exceed it.
 *
 * Mechanism 4 is the guarantee; 1-3 exist so that combos taper off naturally
 * and the cap is rarely the thing the player notices.
 */

/** Damage multiplier floor. Even a 40-hit combo can't chip for nothing. */
export const DAMAGE_SCALE_FLOOR = 0.18;
/** Per-hit damage falloff after the first hit. */
export const DAMAGE_SCALE_STEP = 0.085;
/** Hits that land at full damage before scaling starts. */
export const DAMAGE_SCALE_GRACE = 2;

/** Hitstun multiplier floor. Below this a combo cannot self-sustain. */
export const HITSTUN_SCALE_FLOOR = 0.42;
export const HITSTUN_SCALE_STEP = 0.055;
export const HITSTUN_SCALE_GRACE = 3;

/** Absolute maximum hits in a single combo before forced escape. */
export const COMBO_HARD_CAP = 22;
/** Frames without a connect before the combo counter resets. */
export const COMBO_DROP_FRAMES = 48;

/** Juggle gravity ramps from 1x to this over the course of an air combo. */
export const JUGGLE_GRAVITY_MAX = 2.35;
export const JUGGLE_GRAVITY_STEP = 0.11;

/**
 * Damage multiplier for the Nth hit of a combo (1-based).
 * Hit 1 and 2 are unscaled so that single confirms feel full-strength.
 */
export function damageScaling(comboIndex: number): number {
  if (comboIndex <= DAMAGE_SCALE_GRACE) return 1;
  const scaled = 1 - (comboIndex - DAMAGE_SCALE_GRACE) * DAMAGE_SCALE_STEP;
  return Math.max(DAMAGE_SCALE_FLOOR, scaled);
}

/** Hitstun multiplier for the Nth hit of a combo (1-based). */
export function hitstunScaling(comboIndex: number): number {
  if (comboIndex <= HITSTUN_SCALE_GRACE) return 1;
  const scaled = 1 - (comboIndex - HITSTUN_SCALE_GRACE) * HITSTUN_SCALE_STEP;
  return Math.max(HITSTUN_SCALE_FLOOR, scaled);
}

/** Extra gravity applied to a juggled victim, by air-hit count. */
export function juggleGravityMultiplier(airHits: number): number {
  return Math.min(JUGGLE_GRAVITY_MAX, 1 + airHits * JUGGLE_GRAVITY_STEP);
}

/**
 * Launch power decays through a juggle so the opponent can't be re-popped to
 * the same height forever.
 */
export function juggleLaunchScaling(airHits: number): number {
  return Math.max(0.25, 1 - airHits * 0.14);
}

/** Tracks one attacker's current combo against one victim. */
export class ComboTracker {
  hits = 0;
  airHits = 0;
  damage = 0;
  /** Highest hit count reached this match — reported on the results screen. */
  best = 0;
  private framesSinceHit = Infinity;

  registerHit(damage: number, airborne: boolean): number {
    this.hits++;
    this.airHits += airborne ? 1 : 0;
    this.damage += damage;
    this.framesSinceHit = 0;
    if (this.hits > this.best) this.best = this.hits;
    return this.hits;
  }

  tick(): void {
    if (this.framesSinceHit === Infinity) return;
    this.framesSinceHit++;
    if (this.framesSinceHit > COMBO_DROP_FRAMES) this.reset();
  }

  /**
   * A combo is a sequence the victim could not escape. The moment they regain
   * the ability to act, the sequence is over — even if the attacker keeps
   * landing hits immediately afterward.
   *
   * Resetting purely on a timer instead would let sustained pressure across a
   * whole round report as one enormous "combo", which both misleads the player
   * and makes damage scaling punish neutral-game hits it was never meant to.
   */
  endIfVictimRecovered(victimCanAct: boolean): void {
    if (victimCanAct && this.hits > 0) this.reset();
  }

  /** True once the combo has hit the hard cap and must be broken. */
  get atHardCap(): boolean {
    return this.hits >= COMBO_HARD_CAP;
  }

  get active(): boolean {
    return this.hits > 0;
  }

  reset(): void {
    this.hits = 0;
    this.airHits = 0;
    this.damage = 0;
    this.framesSinceHit = Infinity;
  }

  fullReset(): void {
    this.reset();
    this.best = 0;
  }
}
