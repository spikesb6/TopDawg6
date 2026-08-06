/**
 * Guard, perfect guard, dodge and combo escape.
 *
 * The design goal from the brief is "clear counterplay" with "no permanent stun
 * loops". Every defensive option here has an explicit cost and an explicit
 * window, so both players can reason about them:
 *
 *   Guard        — free, but drains the guard meter and loses to guard break.
 *   Perfect guard— free, but only in a 6-frame window on guard startup.
 *   Dodge        — i-frames, but a fixed cooldown and no i-frames on the tail.
 *   Phase Break  — escapes any combo, but costs a full energy bar.
 *
 * Because Phase Break exists and costs a resource both players can see, no
 * combo is truly inescapable even before the hard cap engages.
 */

import { Vec3 } from '../core/Vec3';
import type { DefenseProfile } from '../characters/CharacterData';

export class DefenseComponent {
  /** True while the guard button is held and guarding is legal. */
  guarding = false;
  /** Frames guard has been held. Frames < parryWindow are perfect-guard frames. */
  guardFrames = 0;

  /** Frames remaining in the current dodge. */
  dodgeFrames = 0;
  dodgeCooldown = 0;
  readonly dodgeDirection = new Vec3();

  /** Frames of general invulnerability from any source. */
  invulnFrames = 0;

  /** Frames of blockstun remaining. */
  blockstunFrames = 0;
  /** Frames of guard-break helplessness remaining. */
  guardBreakFrames = 0;

  /** Set on the frame a perfect guard triggers; consumed by the Simulation. */
  parriedThisFrame = false;
  /** Frames the fighter is frozen for after a successful parry (attacker side). */
  parryPunishFrames = 0;

  constructor(private readonly profile: DefenseProfile) {}

  reset(): void {
    this.guarding = false;
    this.guardFrames = 0;
    this.dodgeFrames = 0;
    this.dodgeCooldown = 0;
    this.invulnFrames = 0;
    this.blockstunFrames = 0;
    this.guardBreakFrames = 0;
    this.parriedThisFrame = false;
    this.parryPunishFrames = 0;
    this.dodgeDirection.set(0, 0, 0);
  }

  tickTimers(): void {
    this.parriedThisFrame = false;
    if (this.dodgeCooldown > 0) this.dodgeCooldown--;
    if (this.dodgeFrames > 0) this.dodgeFrames--;
    if (this.invulnFrames > 0) this.invulnFrames--;
    if (this.blockstunFrames > 0) this.blockstunFrames--;
    if (this.guardBreakFrames > 0) this.guardBreakFrames--;
    if (this.parryPunishFrames > 0) this.parryPunishFrames--;
  }

  get isDodging(): boolean {
    return this.dodgeFrames > 0;
  }

  get isInvulnerable(): boolean {
    return this.invulnFrames > 0 || this.dodgeIFramesActive;
  }

  /**
   * i-frames cover the FRONT of the dodge only. The tail is vulnerable, which
   * is what makes dodge-spamming punishable by a delayed attack.
   */
  get dodgeIFramesActive(): boolean {
    if (this.dodgeFrames <= 0) return false;
    const elapsed = this.profile.dodgeFrames - this.dodgeFrames;
    return elapsed < this.profile.dodgeIFrames;
  }

  get canDodge(): boolean {
    return this.dodgeCooldown <= 0 && this.dodgeFrames <= 0;
  }

  /** True during the perfect-guard window at the start of a guard. */
  get inParryWindow(): boolean {
    return this.guarding && this.guardFrames <= this.profile.parryWindowFrames;
  }

  setGuarding(on: boolean): void {
    if (on && !this.guarding) this.guardFrames = 0;
    this.guarding = on;
    if (on) this.guardFrames++;
    else this.guardFrames = 0;
  }

  startDodge(dir: Vec3): void {
    this.dodgeDirection.copy(dir).normalize();
    if (this.dodgeDirection.lengthSq < 1e-6) this.dodgeDirection.set(0, 0, -1);
    this.dodgeFrames = this.profile.dodgeFrames;
    this.dodgeCooldown = this.profile.dodgeCooldown + this.profile.dodgeFrames;
    this.guarding = false;
    this.guardFrames = 0;
  }

  /** Per-frame dodge velocity, front-loaded so the burst reads as explosive. */
  dodgeVelocity(out: Vec3): Vec3 {
    const total = this.profile.dodgeFrames;
    const elapsed = total - this.dodgeFrames;
    // Ease-out curve: fast at the start, settling toward the end.
    const t = elapsed / Math.max(1, total);
    const curve = 1 - t * t;
    const speed = (this.profile.dodgeDistance / (total / 60)) * curve * 1.6;
    return out.copy(this.dodgeDirection).scale(speed);
  }

  grantInvulnerability(frames: number): void {
    this.invulnFrames = Math.max(this.invulnFrames, frames);
  }

  registerParry(): void {
    this.parriedThisFrame = true;
    // A perfect guard refreshes the window slightly so chained parries against
    // a multi-hit string are possible but require re-timing.
    this.guardFrames = 0;
    this.grantInvulnerability(4);
  }

  applyBlockstun(frames: number): void {
    this.blockstunFrames = Math.max(this.blockstunFrames, frames);
  }

  applyGuardBreak(frames: number): void {
    this.guardBreakFrames = frames;
    this.guarding = false;
    this.guardFrames = 0;
  }
}
