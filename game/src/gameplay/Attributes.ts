/**
 * Fighter resource components: Health, Energy, Guard and the Ascension meter.
 *
 * Each is a standalone component with no knowledge of the fighter that owns it,
 * so they can be reused by any future character without modification. In the
 * UE5 port these map onto a GAS UAttributeSet.
 */

import { clamp } from '../core/Vec3';

export class Health {
  current: number;
  constructor(public max: number) {
    this.current = max;
  }

  get fraction(): number {
    return this.max <= 0 ? 0 : clamp(this.current / this.max, 0, 1);
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  /** Returns damage actually applied (clipped at 0 HP). */
  apply(amount: number): number {
    const before = this.current;
    this.current = clamp(this.current - amount, 0, this.max);
    return before - this.current;
  }

  heal(amount: number): void {
    this.current = clamp(this.current + amount, 0, this.max);
  }

  reset(): void {
    this.current = this.max;
  }
}

/**
 * Energy — "Celestial Force" for Kairo, "Void Dominion" for Veyron. Same
 * mechanics, different presentation; the shared system is name-agnostic.
 *
 * Divided into discrete bars so ability costs read as "one bar", "two bars",
 * which is far more legible mid-fight than a raw number.
 */
export class Energy {
  current: number;

  constructor(
    public readonly perBar: number,
    public readonly bars: number,
    /** Passive regen per second. Deliberately slow — charging is the real source. */
    public passiveRegen: number,
    /** Regen per second while actively charging. */
    public chargeRate: number,
  ) {
    this.current = perBar; // start with one bar so openers are available
  }

  get max(): number {
    return this.perBar * this.bars;
  }

  get fraction(): number {
    return clamp(this.current / this.max, 0, 1);
  }

  /** Number of complete bars currently held. */
  get filledBars(): number {
    return Math.floor(this.current / this.perBar);
  }

  /** Fill fraction of the partially-filled bar, 0..1. */
  get partialBar(): number {
    return (this.current % this.perBar) / this.perBar;
  }

  has(cost: number): boolean {
    return this.current >= cost;
  }

  /** Spends if affordable. Returns false and spends nothing otherwise. */
  spend(cost: number): boolean {
    if (!this.has(cost)) return false;
    this.current = clamp(this.current - cost, 0, this.max);
    return true;
  }

  gain(amount: number): void {
    this.current = clamp(this.current + amount, 0, this.max);
  }

  regen(dt: number, charging: boolean, multiplier = 1): void {
    const rate = charging ? this.chargeRate : this.passiveRegen;
    this.gain(rate * multiplier * dt);
  }

  reset(): void {
    this.current = this.perBar;
  }
}

/**
 * Guard meter. Blocking is not free: each blocked hit drains this, and when it
 * empties the fighter is guard-broken and fully punishable. This is what stops
 * turtling from being a dominant strategy without making blocking useless.
 */
export class Guard {
  current: number;
  /** Frames remaining before the meter starts refilling. */
  private regenDelay = 0;
  broken = false;

  constructor(
    public readonly max: number,
    /** Refill per second once the delay has elapsed. */
    public readonly regenRate: number,
    /** Frames after taking guard damage before refill resumes. */
    public readonly regenDelayFrames: number,
    /** Frames of helpless stun on a guard break. */
    public readonly breakStunFrames: number,
  ) {
    this.current = max;
  }

  get fraction(): number {
    return clamp(this.current / this.max, 0, 1);
  }

  /** Applies guard damage. Returns true if this caused a guard break. */
  applyGuardDamage(amount: number): boolean {
    if (this.broken) return false;
    this.current = clamp(this.current - amount, 0, this.max);
    this.regenDelay = this.regenDelayFrames;
    if (this.current <= 0) {
      this.broken = true;
      return true;
    }
    return false;
  }

  tick(dt: number): void {
    if (this.regenDelay > 0) {
      this.regenDelay--;
      return;
    }
    if (this.broken) return; // stays broken until recoverFromBreak
    this.current = clamp(this.current + this.regenRate * dt, 0, this.max);
  }

  /** Called when guard-break stun ends; restores a partial meter. */
  recoverFromBreak(): void {
    this.broken = false;
    this.current = this.max * 0.5;
    this.regenDelay = this.regenDelayFrames;
  }

  reset(): void {
    this.current = this.max;
    this.broken = false;
    this.regenDelay = 0;
  }
}

/**
 * Ascension meter — gates transformations (Celestial Surge / Tyrant Unbound).
 *
 * It fills from dealing AND taking damage, so a losing player still earns their
 * comeback window, and it drains while transformed. Transformations are
 * therefore always temporary, which the brief requires explicitly.
 */
export class Ascension {
  current = 0;
  /** True while the transformation is active and the meter is draining. */
  active = false;

  constructor(
    public readonly max: number,
    /** Meter gained per point of damage dealt. */
    public readonly gainPerDamageDealt: number,
    /** Meter gained per point of damage taken (higher — comeback mechanic). */
    public readonly gainPerDamageTaken: number,
    /** Drain per second while transformed. Sets the transformation's duration. */
    public readonly drainRate: number,
    /** Fraction of the meter required to trigger a transformation. */
    public readonly threshold: number,
  ) {}

  get fraction(): number {
    return clamp(this.current / this.max, 0, 1);
  }

  get canTransform(): boolean {
    return !this.active && this.fraction >= this.threshold;
  }

  onDamageDealt(damage: number): void {
    if (this.active) return;
    this.current = clamp(this.current + damage * this.gainPerDamageDealt, 0, this.max);
  }

  onDamageTaken(damage: number): void {
    if (this.active) return;
    this.current = clamp(this.current + damage * this.gainPerDamageTaken, 0, this.max);
  }

  begin(): void {
    this.active = true;
  }

  /** Drains while active. Returns true on the frame the transformation ends. */
  tick(dt: number): boolean {
    if (!this.active) return false;
    this.current = clamp(this.current - this.drainRate * dt, 0, this.max);
    if (this.current <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  reset(): void {
    this.current = 0;
    this.active = false;
  }
}
