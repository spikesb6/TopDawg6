/**
 * Third-person combat camera.
 *
 * The camera is the single largest determinant of whether a 3D fighter is
 * readable, so this is not a follow-cam with a spring. It solves for a framing
 * that keeps BOTH fighters on screen at a legible size, then handles the cases
 * where that is impossible.
 *
 * Behaviours:
 *   - Lock-on framing: positions behind the player, looking through them at
 *     the target, with distance scaled to the gap between the two.
 *   - Free-look: standard orbit when lock-on is off.
 *   - Occlusion: pulls in along the view ray when a pillar blocks the shot.
 *   - Pursuit framing: widens and drops back during high-speed chases.
 *   - Cinematic: hands control to a scripted orbit during ultimates.
 *   - Shake: trauma-based, so intensity decays quadratically and never
 *     accumulates into the nauseating constant rumble the brief warns about.
 */

import { Vec3, clamp, damp, lerp, angleDelta } from '../core/Vec3';
import type { Fighter } from '../gameplay/Fighter';
import type { Arena } from '../gameplay/Arena';
import { FighterState } from '../gameplay/CombatTypes';

export interface CameraState {
  position: Vec3;
  lookAt: Vec3;
  fov: number;
  /** Roll in radians, used sparingly for impact and pursuit. */
  roll: number;
}

/** Distance behind the player at the minimum combat gap. */
const MIN_DISTANCE = 6.2;
/** Distance behind the player when the fighters are far apart. */
const MAX_DISTANCE = 15.5;
/** Height above the player's feet that the camera sits at. */
const BASE_HEIGHT = 2.5;
const BASE_FOV = 58;
/** Lateral over-the-shoulder offset at point-blank range, metres. */
const SHOULDER_OFFSET = 1.6;
/** How far the camera swings off the player→target axis at melee range, radians. */
const MAX_OFF_AXIS = 0.62;
/** Trauma decays to zero over roughly this many seconds. */
const TRAUMA_DECAY = 1.9;
/** Maximum positional shake offset in metres at full trauma. */
const SHAKE_POS = 0.55;
/** Maximum angular shake in radians at full trauma. */
const SHAKE_ROT = 0.055;

export class CombatCamera {
  readonly state: CameraState = {
    position: new Vec3(0, 4, -14),
    lookAt: new Vec3(0, 1.5, 0),
    fov: BASE_FOV,
    roll: 0,
  };

  /** Orbit yaw around the player, radians. Driven by mouse in free-look. */
  yaw = 0;
  /** Orbit pitch, radians. Positive looks down. */
  pitch = 0.19;

  /** 0..1 trauma. Shake magnitude is trauma^2 so small hits stay subtle. */
  private trauma = 0;
  /** Player-configurable shake scale — the brief asks for adjustable intensity. */
  shakeScale = 1;

  private readonly desiredPos = new Vec3();
  private readonly desiredLook = new Vec3();
  private readonly tmp = new Vec3();
  private readonly tmp2 = new Vec3();
  private time = 0;

  /** Smoothed distance so the camera doesn't snap when the gap changes. */
  private distance = MIN_DISTANCE;
  /** Cinematic blend, 0 = gameplay camera, 1 = fully cinematic. */
  private cinematicBlend = 0;
  private cinematicTime = 0;

  reset(): void {
    this.trauma = 0;
    this.distance = MIN_DISTANCE;
    this.cinematicBlend = 0;
    this.cinematicTime = 0;
    this.yaw = 0;
    this.pitch = 0.19;
    this.state.roll = 0;
    this.state.fov = BASE_FOV;
  }

  /** Adds camera trauma. Multiple sources add rather than override. */
  addShake(magnitude: number): void {
    this.trauma = clamp(this.trauma + magnitude * 0.55, 0, 1);
  }

  /** Free-look input, in radians. */
  addLook(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = clamp(this.pitch + dy, -0.85, 1.05);
  }

  update(
    player: Fighter,
    target: Fighter | null,
    arena: Arena,
    dt: number,
    cinematicOwner: number,
  ): CameraState {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY * dt);

    const cinematicActive = cinematicOwner >= 0;
    this.cinematicBlend = damp(this.cinematicBlend, cinematicActive ? 1 : 0, 6, dt);
    if (cinematicActive) this.cinematicTime += dt;
    else this.cinematicTime = 0;

    const locked = player.lockOnEnabled && target !== null && !target.defeated;

    if (locked) this.solveLockOn(player, target!, dt);
    else this.solveFreeLook(player, dt);

    if (cinematicActive && this.cinematicBlend > 0.01) {
      this.blendCinematic(player, target, cinematicOwner);
    }

    // --- Occlusion: pull the camera in until the player is visible ---------
    this.resolveOcclusion(player, arena);

    // --- Commit, with smoothing -------------------------------------------
    // Position is smoothed harder than the look target: a laggy look-at reads
    // as the camera "losing" the fight, while a laggy position reads as weight.
    const posRate = cinematicActive ? 7 : 13;
    this.state.position.x = damp(this.state.position.x, this.desiredPos.x, posRate, dt);
    this.state.position.y = damp(this.state.position.y, this.desiredPos.y, posRate, dt);
    this.state.position.z = damp(this.state.position.z, this.desiredPos.z, posRate, dt);
    this.state.lookAt.x = damp(this.state.lookAt.x, this.desiredLook.x, 20, dt);
    this.state.lookAt.y = damp(this.state.lookAt.y, this.desiredLook.y, 20, dt);
    this.state.lookAt.z = damp(this.state.lookAt.z, this.desiredLook.z, 20, dt);

    arena.clampPoint(this.state.position, 1.2);

    // --- FOV: widens with speed and during transformations ----------------
    const speed = player.velocity.length;
    const speedFov = clamp((speed - 14) * 0.55, 0, 13);
    const transformFov = player.transformed ? player.transformation.cameraFovBoost : 0;
    const targetFov = BASE_FOV + speedFov + transformFov + (cinematicActive ? -6 : 0);
    this.state.fov = damp(this.state.fov, targetFov, 5, dt);

    // --- Shake -------------------------------------------------------------
    this.applyShake(dt);

    return this.state;
  }

  /**
   * Lock-on framing.
   *
   * The camera sits behind the player on the player→target axis, so the target
   * is always dead centre. Distance scales with the gap, and height rises when
   * the fighters are vertically separated so aerial exchanges stay in frame.
   */
  private solveLockOn(player: Fighter, target: Fighter, dt: number): void {
    const px = player.position.x;
    const pz = player.position.z;
    const dx = target.position.x - px;
    const dz = target.position.z - pz;
    const gap = Math.hypot(dx, dz);

    // Camera yaw follows the player→target axis, swung off-axis at close range.
    //
    // Sitting exactly on the axis is the intuitive lock-on solve and it fails
    // in melee: the player is directly between the lens and the opponent, so
    // the opponent's body eclipses them entirely at the exact moment the
    // exchange matters most. Swinging the camera around the pair as they close
    // turns that stack into two separated silhouettes, while the look target
    // stays between them so neither leaves frame.
    const axisYaw = Math.atan2(dx, dz);
    const closeness = 1 - clamp((gap - 2.5) / 8, 0, 1);
    const offAxis = closeness * MAX_OFF_AXIS;
    // Smoothly rotate rather than snapping, so target changes read as a sweep.
    const delta = angleDelta(this.yaw, axisYaw + offAxis);
    this.yaw += delta * clamp(dt * 9, 0, 1);

    // Distance grows with the gap so both fighters stay framed.
    const t = clamp((gap - 3) / 26, 0, 1);
    let targetDistance = lerp(MIN_DISTANCE, MAX_DISTANCE, t);

    // High-speed pursuit: fall back and widen so the chase reads.
    const chasing =
      player.state === FighterState.Pursuit ||
      player.state === FighterState.Boost ||
      player.velocity.length > 22;
    if (chasing) targetDistance += 3.4;

    // Close-quarters: push OUT slightly. Pulling in here is the intuitive
    // choice and it is wrong — at melee range the two capsules already fill the
    // frame, and closing further just crops them.
    if (gap < 4.5) targetDistance += 1.4;

    this.distance = damp(this.distance, targetDistance, 5, dt);

    // Height: midpoint of the two fighters, biased upward.
    const midY =
      (player.position.y + player.data.visual.height * 0.6 +
        target.position.y + target.data.visual.height * 0.6) *
      0.5;
    const verticalGap = Math.abs(target.position.y - player.position.y);
    const heightBoost = clamp(verticalGap * 0.28, 0, 5.5);

    // Pitch: look down more when the fighters are far apart vertically.
    const pitchTarget = 0.16 + clamp(verticalGap * 0.012, 0, 0.22);
    this.pitch = damp(this.pitch, pitchTarget, 4, dt);

    const back = this.distance;
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);

    // A small additional lateral slide on top of the off-axis swing.
    const lateral = SHOULDER_OFFSET * closeness;
    // Perpendicular to the view axis.
    const rx = cy;
    const rz = -sy;

    this.desiredPos.set(
      px - sy * back + rx * lateral,
      player.position.y +
        BASE_HEIGHT +
        heightBoost +
        back * Math.sin(this.pitch) * 0.55 +
        // Rise at close range so the camera looks slightly down over the
        // exchange rather than staring into two overlapping torsos.
        closeness * 1.5,
      pz - cy * back + rz * lateral,
    );

    // Look at a point biased toward the target so the opponent sits slightly
    // above centre — the standard arena-fighter framing.
    // Bias toward the true midpoint in melee (so both fighters share the
    // frame) and toward the target at range (so the opponent stays centred).
    const lookBias = lerp(0.5, 0.4, 1 - closeness);
    this.desiredLook.set(
      lerp(px, target.position.x, lookBias),
      lerp(
        player.position.y + player.data.visual.height * 0.62,
        target.position.y + target.data.visual.height * 0.62,
        0.45,
      ) + clamp(gap * 0.02, 0, 1.2),
      lerp(pz, target.position.z, lookBias),
    );
    void midY;
  }

  private solveFreeLook(player: Fighter, dt: number): void {
    this.distance = damp(this.distance, MIN_DISTANCE + 2.4, 5, dt);
    const back = this.distance;
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    this.desiredPos.set(
      player.position.x - sy * back * cp,
      player.position.y + BASE_HEIGHT + back * sp,
      player.position.z - cy * back * cp,
    );
    this.desiredLook.set(
      player.position.x,
      player.position.y + player.data.visual.height * 0.7,
      player.position.z,
    );
  }

  /**
   * Cinematic framing for ultimates: a slow orbit around the midpoint between
   * the two fighters, so the sequence reads as an event rather than as normal
   * gameplay that happens to be loud.
   */
  private blendCinematic(player: Fighter, target: Fighter | null, owner: number): void {
    const a = player;
    const b = target ?? player;
    const cx = (a.position.x + b.position.x) * 0.5;
    const cy = (a.position.y + b.position.y) * 0.5 + 1.6;
    const cz = (a.position.z + b.position.z) * 0.5;

    // Orbit direction depends on who is casting, so the two ultimates read
    // differently even before their VFX differ.
    const dir = owner === 0 ? 1 : -1;
    const angle = this.yaw + Math.PI * 0.42 * dir + this.cinematicTime * 0.55 * dir;
    const dist = 8.2 + Math.sin(this.cinematicTime * 1.3) * 0.9;
    const height = 2.2 + Math.sin(this.cinematicTime * 0.8) * 0.7;

    this.tmp.set(cx - Math.sin(angle) * dist, cy + height, cz - Math.cos(angle) * dist);
    this.tmp2.set(cx, cy, cz);

    const k = this.cinematicBlend;
    Vec3.lerp(this.desiredPos, this.tmp, k, this.desiredPos);
    Vec3.lerp(this.desiredLook, this.tmp2, k, this.desiredLook);
  }

  /**
   * Camera collision. Casts from the look target back to the desired position
   * and pulls in to the first blocking surface, so a pillar never eats the
   * fight. Also enforces a floor clearance so the camera never sinks below the
   * arena.
   */
  private resolveOcclusion(player: Fighter, arena: Arena): void {
    const hit = arena.segmentBlocked(this.desiredLook, this.desiredPos);
    if (hit.blocked) {
      // Pull to just in front of the obstruction.
      const t = clamp(hit.t * 0.92, 0.22, 1);
      Vec3.lerp(this.desiredLook, this.desiredPos, t, this.desiredPos);
    }
    const minY = arena.def.floor + 1.1;
    if (this.desiredPos.y < minY) this.desiredPos.y = minY;
    // Never let the camera end up inside the player.
    const d = this.desiredPos.distanceTo(player.position);
    if (d < 2.0) {
      this.tmp
        .set(
          this.desiredPos.x - player.position.x,
          this.desiredPos.y - player.position.y,
          this.desiredPos.z - player.position.z,
        )
        .normalize()
        .scale(2.0);
      this.desiredPos.set(
        player.position.x + this.tmp.x,
        player.position.y + this.tmp.y,
        player.position.z + this.tmp.z,
      );
    }
  }

  /**
   * Trauma-based shake.
   *
   * Magnitude is trauma squared, so a jab produces a barely-perceptible tick
   * while an ultimate produces a real slam — and because trauma decays rather
   * than being set directly, rapid hits never stack into a permanent rumble.
   */
  private applyShake(dt: number): void {
    if (this.trauma <= 0.001) {
      this.state.roll = damp(this.state.roll, 0, 12, dt);
      return;
    }
    const s = this.trauma * this.trauma * this.shakeScale;
    const t = this.time * 43;
    // Deterministic pseudo-noise: three offset sines beat Math.random() here
    // because the motion stays continuous rather than jittering per frame.
    const nx = Math.sin(t * 1.13) * Math.sin(t * 0.37);
    const ny = Math.sin(t * 1.71 + 1.3) * Math.sin(t * 0.51);
    const nz = Math.sin(t * 1.39 + 2.7) * Math.sin(t * 0.43);
    this.state.position.x += nx * SHAKE_POS * s;
    this.state.position.y += ny * SHAKE_POS * s;
    this.state.position.z += nz * SHAKE_POS * s;
    this.state.roll = damp(this.state.roll, nz * SHAKE_ROT * s, 22, dt);
  }

  get traumaLevel(): number {
    return this.trauma;
  }
}
