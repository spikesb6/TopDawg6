/**
 * Attack execution and frame tracking.
 *
 * Owns exactly one question: "which attack is running, what frame is it on, and
 * what is legal right now?" It does not do hit detection (that is the
 * Simulation's job, since it needs both fighters) and it does not do movement.
 */

import type { AttackDef } from './CombatTypes';
import { AttackKind, attackDuration } from './CombatTypes';

export enum AttackPhase {
  None = 'None',
  Startup = 'Startup',
  Active = 'Active',
  Recovery = 'Recovery',
}

/** Frames of held input required to reach a full charge on the heavy. */
export const FULL_CHARGE_FRAMES = 46;
/** Charge frames below which the heavy releases uncharged. */
export const MIN_CHARGE_FRAMES = 10;

export class CombatComponent {
  current: AttackDef | null = null;
  /** Frame index within the current attack, 0-based. */
  frame = 0;
  /** True once this activation has connected — gates cancels. */
  connected = false;
  /** Targets already hit by this activation (prevents multi-hit per swing). */
  readonly hitThisActivation = new Set<number>();

  /** Index into the character's light chain, or -1 if not chaining. */
  chainIndex = -1;
  /** Frames remaining in which the chain stays open after an attack ends. */
  chainWindow = 0;

  /** Frames the heavy button has been held while charging. */
  chargeFrames = 0;
  charging = false;

  /** Armor hits remaining on the current attack. */
  armorRemaining = 0;

  /** Speed multiplier applied to startup by transformations. */
  private speedMultiplier = 1;

  reset(): void {
    this.current = null;
    this.frame = 0;
    this.connected = false;
    this.hitThisActivation.clear();
    this.chainIndex = -1;
    this.chainWindow = 0;
    this.chargeFrames = 0;
    this.charging = false;
    this.armorRemaining = 0;
    this.speedMultiplier = 1;
  }

  get isAttacking(): boolean {
    return this.current !== null;
  }

  setSpeedMultiplier(m: number): void {
    this.speedMultiplier = m;
  }

  /** Startup frames after transformation scaling, minimum 2. */
  private scaledStartup(a: AttackDef): number {
    return Math.max(2, Math.round(a.startup * this.speedMultiplier));
  }

  private scaledDuration(a: AttackDef): number {
    return this.scaledStartup(a) + a.active + a.recovery;
  }

  get phase(): AttackPhase {
    const a = this.current;
    if (!a) return AttackPhase.None;
    const su = this.scaledStartup(a);
    if (this.frame < su) return AttackPhase.Startup;
    if (this.frame < su + a.active) return AttackPhase.Active;
    return AttackPhase.Recovery;
  }

  /** True on frames where the hitbox should be tested. */
  get hitboxLive(): boolean {
    return this.phase === AttackPhase.Active;
  }

  begin(a: AttackDef, chainIndex = -1): void {
    this.current = a;
    this.frame = 0;
    this.connected = false;
    this.hitThisActivation.clear();
    this.chainIndex = chainIndex;
    this.armorRemaining = a.armor;
    this.charging = false;
    this.chargeFrames = 0;
  }

  /** Advances one frame. Returns true when the attack has finished. */
  advance(): boolean {
    const a = this.current;
    if (!a) return false;
    this.frame++;
    if (this.frame >= this.scaledDuration(a)) {
      // Leave the chain window open briefly so the next link is easy to hit.
      this.chainWindow = a.cancelInto.length > 0 ? 14 : 0;
      this.current = null;
      this.frame = 0;
      this.connected = false;
      this.hitThisActivation.clear();
      this.armorRemaining = 0;
      return true;
    }
    return false;
  }

  tickChainWindow(): void {
    if (this.chainWindow > 0) {
      this.chainWindow--;
      if (this.chainWindow === 0) this.chainIndex = -1;
    }
  }

  /**
   * Whether the current attack may be cancelled into `nextId` right now.
   *
   * Cancels require a connect. Whiff-cancelling would remove all risk from
   * throwing out attacks, which is the fastest way to make a fighting game
   * feel mindless.
   */
  canCancelInto(nextId: string): boolean {
    const a = this.current;
    if (!a) return false;
    if (!this.connected) return false;
    if (this.frame < a.cancelFrom) return false;
    return a.cancelInto.includes(nextId);
  }

  /** True if the attack is far enough along that special-cancels are allowed. */
  canSpecialCancel(): boolean {
    const a = this.current;
    if (!a) return false;
    return this.connected && this.frame >= this.scaledStartup(a);
  }

  markConnected(targetIndex: number): void {
    this.connected = true;
    this.hitThisActivation.add(targetIndex);
  }

  hasHit(targetIndex: number): boolean {
    return this.hitThisActivation.has(targetIndex);
  }

  /** Cancels the current attack outright (interrupted, hit, or KO'd). */
  interrupt(): void {
    this.current = null;
    this.frame = 0;
    this.connected = false;
    this.hitThisActivation.clear();
    this.chainIndex = -1;
    this.chainWindow = 0;
    this.armorRemaining = 0;
    this.charging = false;
    this.chargeFrames = 0;
  }

  consumeArmorHit(): boolean {
    if (this.armorRemaining <= 0) return false;
    this.armorRemaining--;
    return true;
  }

  // ------------------------------------------------------------- charging

  beginCharge(): void {
    this.charging = true;
    this.chargeFrames = 0;
  }

  tickCharge(): void {
    if (this.charging && this.chargeFrames < FULL_CHARGE_FRAMES) this.chargeFrames++;
  }

  /** 0..1 charge progress, for the HUD ring and VFX intensity. */
  get chargeRatio(): number {
    return Math.min(1, this.chargeFrames / FULL_CHARGE_FRAMES);
  }

  get isFullyCharged(): boolean {
    return this.chargeFrames >= FULL_CHARGE_FRAMES;
  }

  get chargeReleasable(): boolean {
    return this.chargeFrames >= MIN_CHARGE_FRAMES;
  }

  endCharge(): number {
    const f = this.chargeFrames;
    this.charging = false;
    this.chargeFrames = 0;
    return f;
  }
}

/**
 * Builds the scaled variant of a charged heavy.
 *
 * A partial charge should feel like a meaningful middle ground rather than a
 * binary, so damage, knockback and hitstop all interpolate with charge, and
 * super armor only appears near full charge as the reward for committing.
 */
export function applyChargeScaling(base: AttackDef, ratio: number): AttackDef {
  const t = Math.min(1, Math.max(0, ratio));
  return {
    ...base,
    kind: t >= 0.999 ? AttackKind.ChargedHeavy : base.kind,
    damage: base.damage * (1 + t * 1.15),
    guardDamage: base.guardDamage * (1 + t * 1.4),
    chipDamage: base.chipDamage * (1 + t * 1.6),
    hitstop: Math.round(base.hitstop * (1 + t * 0.65)),
    hitstun: Math.round(base.hitstun * (1 + t * 0.3)),
    knockbackForward: base.knockbackForward * (1 + t * 0.75),
    knockbackUp: base.knockbackUp * (1 + t * 0.5),
    shake: Math.min(1, base.shake * (1 + t)),
    armor: t >= 0.72 ? Math.max(base.armor, 1) : base.armor,
    hitbox: { ...base.hitbox, radius: base.hitbox.radius * (1 + t * 0.22) },
  };
}

/** Total duration helper exported for tests and AI planning. */
export const totalFrames = attackDuration;
