/**
 * Locomotion: ground, air, flight, boost, dash and pursuit.
 *
 * Design notes that matter for feel:
 *
 * - Acceleration is high and deceleration is higher. The brief's "avoid floaty
 *   movement" is mostly a deceleration problem: fighters that coast feel like
 *   they are on ice. Ground decel is roughly 1.6x accel.
 *
 * - Gravity is ~3.5x real-world. Anime fighters read as weightless in the air
 *   because they FLY, not because they fall slowly; a slow fall just feels
 *   unresponsive. Flight is the freedom mechanic, gravity stays punchy.
 *
 * - Direction changes get an extra "pivot" boost: when the input direction
 *   opposes current velocity, decel is doubled. This is what makes rapid
 *   left-right changes feel instant rather than mushy.
 *
 * - Flight is a first-class state, not "jump but longer". Entering it zeroes
 *   vertical velocity so the transition reads as a deliberate snap.
 */

import { Vec3, clamp, approachAngle } from '../core/Vec3';
import type { MovementProfile } from '../characters/CharacterData';
import { TICK_DT } from './CombatTypes';

/** Extra decel multiplier when input opposes current velocity. */
const PIVOT_DECEL_BOOST = 2.0;
/** Vertical velocity retained when the jump button is released early. */
const SHORT_HOP_CUT = 0.42;
/** Speed below which a fighter is considered stationary, m/s. */
export const IDLE_SPEED_EPSILON = 0.35;

export interface MoveIntent {
  /** World-space desired direction, normalized or zero. */
  x: number;
  z: number;
  /** 0..1 analog magnitude. */
  magnitude: number;
  /** Sprint / boost held. */
  boost: boolean;
  /** Ascend held (flight only). */
  ascend: boolean;
  /** Descend held (flight only). */
  descend: boolean;
}

export function emptyMoveIntent(): MoveIntent {
  return { x: 0, z: 0, magnitude: 0, boost: false, ascend: false, descend: false };
}

export class MovementComponent {
  /** Air dashes remaining before the fighter must touch ground. */
  airDashCharges: number;
  /** Frames until another dash is permitted. */
  dashCooldown = 0;
  /** Frames remaining in the current dash. */
  dashFrames = 0;
  /** Direction locked in at dash start. */
  readonly dashDirection = new Vec3();
  /** Speed of the current dash, m/s. */
  dashSpeed = 0;
  /** True if the current dash is a long-range pursuit rather than a short hop. */
  dashIsPursuit = false;

  /** True while the fighter is in free flight. */
  flying = false;
  /** Frames since flight was entered — used to gate the flight-entry VFX. */
  flightFrames = 0;
  /** Set on the frame the fighter touches down. */
  justLanded = false;
  /** Set on the frame the fighter leaves the ground. */
  justLeftGround = false;

  /** Whether the jump button is still held from the jump that started the arc. */
  private jumpHeld = false;

  constructor(private readonly profile: MovementProfile) {
    this.airDashCharges = profile.airDashCharges;
  }

  reset(): void {
    this.airDashCharges = this.profile.airDashCharges;
    this.dashCooldown = 0;
    this.dashFrames = 0;
    this.dashSpeed = 0;
    this.dashIsPursuit = false;
    this.flying = false;
    this.flightFrames = 0;
    this.justLanded = false;
    this.justLeftGround = false;
    this.jumpHeld = false;
  }

  tickTimers(): void {
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.dashFrames > 0) this.dashFrames--;
    if (this.flying) this.flightFrames++;
    else this.flightFrames = 0;
  }

  get dashing(): boolean {
    return this.dashFrames > 0;
  }

  get canDash(): boolean {
    return this.dashCooldown <= 0 && this.dashFrames <= 0;
  }

  // ---------------------------------------------------------------- ground

  /**
   * Grounded locomotion. `speedScale` folds in transformation buffs so the
   * shared system never needs to know a transformation exists.
   */
  applyGround(
    velocity: Vec3,
    intent: MoveIntent,
    speedScale: number,
    dt: number,
  ): void {
    const p = this.profile;
    const target = (intent.boost ? p.sprintSpeed : p.walkSpeed) * speedScale;

    if (intent.magnitude > 0.15) {
      const desiredX = intent.x * target * intent.magnitude;
      const desiredZ = intent.z * target * intent.magnitude;
      // Detect a pivot: current velocity opposing the desired direction.
      const dot = velocity.x * intent.x + velocity.z * intent.z;
      const accel = p.groundAccel * speedScale * (dot < 0 ? PIVOT_DECEL_BOOST : 1);
      velocity.x = approach(velocity.x, desiredX, accel * dt);
      velocity.z = approach(velocity.z, desiredZ, accel * dt);
    } else {
      const decel = p.groundDecel * dt;
      velocity.x = approach(velocity.x, 0, decel);
      velocity.z = approach(velocity.z, 0, decel);
    }
    velocity.clampXZ(target);
    velocity.y = Math.min(velocity.y, 0);
  }

  /** Applies a jump impulse. Caller must have verified the fighter is grounded. */
  jump(velocity: Vec3, speedScale: number): void {
    velocity.y = this.profile.jumpSpeed * Math.min(1.15, speedScale);
    this.jumpHeld = true;
    this.justLeftGround = true;
  }

  // ------------------------------------------------------------------- air

  applyAir(
    velocity: Vec3,
    intent: MoveIntent,
    speedScale: number,
    jumpStillHeld: boolean,
    gravityMultiplier: number,
    dt: number,
  ): void {
    const p = this.profile;
    const maxAir = p.airSpeed * speedScale;
    if (intent.magnitude > 0.15) {
      const desiredX = intent.x * maxAir * intent.magnitude;
      const desiredZ = intent.z * maxAir * intent.magnitude;
      const accel = p.airAccel * speedScale * dt;
      velocity.x = approach(velocity.x, desiredX, accel);
      velocity.z = approach(velocity.z, desiredZ, accel);
    }
    velocity.clampXZ(Math.max(maxAir, velocity.lengthXZ * 0.995));

    // Variable jump height: releasing the button early cuts the rise.
    if (this.jumpHeld && !jumpStillHeld && velocity.y > 0) {
      velocity.y *= SHORT_HOP_CUT;
      this.jumpHeld = false;
    }
    velocity.y -= p.gravity * gravityMultiplier * dt;
    velocity.y = Math.max(velocity.y, -p.maxFallSpeed);
  }

  // ---------------------------------------------------------------- flight

  /** Enter free flight. Zeroing vertical velocity makes the snap read clearly. */
  enterFlight(velocity: Vec3): void {
    this.flying = true;
    this.flightFrames = 0;
    this.jumpHeld = false;
    velocity.y = clamp(velocity.y, -2, 2);
  }

  exitFlight(): void {
    this.flying = false;
    this.flightFrames = 0;
  }

  /** Returns energy consumed this frame (boost flight has a running cost). */
  applyFlight(
    velocity: Vec3,
    intent: MoveIntent,
    speedScale: number,
    hasEnergyForBoost: boolean,
    dt: number,
  ): number {
    const p = this.profile;
    const boosting = intent.boost && hasEnergyForBoost;
    const target = p.flySpeed * speedScale * (boosting ? p.boostMultiplier : 1);
    const accel = p.flyAccel * speedScale * (boosting ? 1.5 : 1);

    if (intent.magnitude > 0.15) {
      const dot = velocity.x * intent.x + velocity.z * intent.z;
      const a = accel * (dot < 0 ? PIVOT_DECEL_BOOST : 1) * dt;
      velocity.x = approach(velocity.x, intent.x * target * intent.magnitude, a);
      velocity.z = approach(velocity.z, intent.z * target * intent.magnitude, a);
    } else {
      const d = accel * 1.3 * dt;
      velocity.x = approach(velocity.x, 0, d);
      velocity.z = approach(velocity.z, 0, d);
    }
    velocity.clampXZ(target);

    // Vertical: explicit ascend/descend, otherwise hover with slight settle.
    const vTarget = p.flyVerticalSpeed * speedScale * (boosting ? 1.35 : 1);
    if (intent.ascend && !intent.descend) {
      velocity.y = approach(velocity.y, vTarget, accel * dt);
    } else if (intent.descend && !intent.ascend) {
      velocity.y = approach(velocity.y, -vTarget, accel * dt);
    } else {
      velocity.y = approach(velocity.y, 0, accel * 1.4 * dt);
    }

    return boosting ? p.boostEnergyPerSecond * dt : 0;
  }

  // ------------------------------------------------------------------ dash

  /**
   * Starts a dash in `dir`. `pursuit` uses the longer-range pursuit profile,
   * used to chase a launched opponent across the arena.
   */
  startDash(dir: Vec3, pursuit: boolean, speedScale: number): void {
    this.dashDirection.copy(dir).normalize();
    if (this.dashDirection.lengthSq < 1e-6) this.dashDirection.set(0, 0, 1);
    this.dashIsPursuit = pursuit;
    const p = this.profile;
    this.dashFrames = pursuit ? Math.round(p.dashFrames * 1.6) : p.dashFrames;
    this.dashSpeed = pursuit
      ? p.pursuitSpeed * speedScale
      : (p.dashDistance / (p.dashFrames * TICK_DT)) * speedScale;
    this.dashCooldown = p.dashCooldown + this.dashFrames;
  }

  applyDash(velocity: Vec3): void {
    velocity.x = this.dashDirection.x * this.dashSpeed;
    velocity.y = this.dashDirection.y * this.dashSpeed;
    velocity.z = this.dashDirection.z * this.dashSpeed;
  }

  /** Bleeds off dash momentum so the exit doesn't stop dead. */
  endDash(velocity: Vec3): void {
    velocity.scale(0.35);
    this.dashFrames = 0;
  }

  consumeAirDashCharge(): boolean {
    if (this.airDashCharges <= 0) return false;
    this.airDashCharges--;
    return true;
  }

  // --------------------------------------------------------------- landing

  /**
   * Applies the ground plane. Returns true on the frame of touchdown so the
   * caller can emit landing FX and refresh air resources.
   */
  resolveGround(position: Vec3, velocity: Vec3, floor: number): boolean {
    this.justLanded = false;
    if (position.y <= floor + 1e-4) {
      position.y = floor;
      const wasFalling = velocity.y < 0;
      if (wasFalling) velocity.y = 0;
      if (wasFalling || !this.groundedLastFrame) {
        this.justLanded = true;
        this.airDashCharges = this.profile.airDashCharges;
        this.flying = false;
        this.jumpHeld = false;
      }
      this.groundedLastFrame = true;
      return true;
    }
    this.groundedLastFrame = false;
    return false;
  }

  private groundedLastFrame = true;

  /** Rotates `currentYaw` toward `targetYaw`, honouring the profile turn rate. */
  turnToward(currentYaw: number, targetYaw: number, dt: number, scale = 1): number {
    return approachAngle(currentYaw, targetYaw, this.profile.turnRate * scale * dt);
  }
}

/** Moves `value` toward `target` by at most `maxDelta`. */
function approach(value: number, target: number, maxDelta: number): number {
  const d = target - value;
  if (Math.abs(d) <= maxDelta) return target;
  return value + Math.sign(d) * maxDelta;
}
