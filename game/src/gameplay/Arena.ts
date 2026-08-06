/**
 * Arena bounds and collision, simulation side.
 *
 * The brief asks for "clear boundaries that do not feel like invisible walls".
 * The solution here is a three-zone boundary:
 *
 *   inner (< softRadius)   — completely free movement, no forces at all.
 *   soft  (soft..hard)     — a visible Veyra Barrier lights up and applies a
 *                            gentle inward force that scales with depth. The
 *                            player is warned before they are stopped.
 *   hard  (= hardRadius)   — a real surface. Being knocked into it causes a
 *                            wall splat with its own hit reaction, which turns
 *                            the boundary into a combat feature instead of an
 *                            annoyance.
 *
 * Pillars are solid cylinders used for wall impacts and camera occlusion.
 */

import { Vec3, clamp } from '../core/Vec3';

export interface Pillar {
  x: number;
  z: number;
  radius: number;
  height: number;
  /** Broken pillars are shorter and no longer block the camera as much. */
  intact: boolean;
}

export interface ArenaDef {
  /** Radius at which the barrier begins to glow and push back. */
  softRadius: number;
  /** Absolute movement limit. */
  hardRadius: number;
  /** Ceiling height for flight. */
  ceiling: number;
  /** Ground plane height. */
  floor: number;
  pillars: Pillar[];
}

export const RUINS_OF_VEYRA: ArenaDef = {
  softRadius: 52,
  hardRadius: 62,
  ceiling: 48,
  floor: 0,
  pillars: [
    { x: 20, z: -14, radius: 2.6, height: 16, intact: true },
    { x: -24, z: 10, radius: 3.1, height: 21, intact: true },
    { x: 6, z: 30, radius: 2.2, height: 12, intact: true },
    { x: -12, z: -28, radius: 2.8, height: 18, intact: true },
    { x: 34, z: 20, radius: 3.4, height: 25, intact: true },
    { x: -38, z: -22, radius: 2.4, height: 14, intact: true },
  ],
};

export interface BoundaryContact {
  /** True if the fighter is being pushed by the soft barrier. */
  inSoftZone: boolean;
  /** 0..1 depth into the soft zone; drives barrier VFX intensity. */
  softDepth: number;
  /** True on the frame a hard surface was struck. */
  hitWall: boolean;
  /** Outward normal of the surface struck (points away from the wall). */
  normal: Vec3;
  /** Speed at which the wall was struck, m/s. Gates the wall-splat reaction. */
  impactSpeed: number;
}

/** Inward force applied by the soft barrier, m/s^2 at full depth. */
const SOFT_PUSH_ACCEL = 34;
/** Minimum speed into a wall that produces a wall splat rather than a stop. */
export const WALL_SPLAT_SPEED = 11;

export class Arena {
  constructor(public readonly def: ArenaDef = RUINS_OF_VEYRA) {}

  /** Reset destructible state between matches. */
  reset(): void {
    for (const p of this.def.pillars) p.intact = true;
  }

  /**
   * Resolves a fighter's position and velocity against the arena.
   * Mutates both; returns what happened so the caller can react.
   */
  resolve(
    position: Vec3,
    velocity: Vec3,
    radius: number,
    dt: number,
    out: BoundaryContact,
  ): BoundaryContact {
    const { softRadius, hardRadius, ceiling, floor } = this.def;
    out.inSoftZone = false;
    out.softDepth = 0;
    out.hitWall = false;
    out.impactSpeed = 0;
    out.normal.set(0, 0, 0);

    // --- Cylindrical outer boundary -------------------------------------
    const distXZ = Math.hypot(position.x, position.z);
    if (distXZ > softRadius - radius) {
      const nx = distXZ > 1e-6 ? position.x / distXZ : 1;
      const nz = distXZ > 1e-6 ? position.z / distXZ : 0;
      const depth = clamp(
        (distXZ - (softRadius - radius)) / (hardRadius - softRadius),
        0,
        1,
      );
      out.inSoftZone = true;
      out.softDepth = depth;

      // Gentle inward acceleration, ramped so it never feels like a snag.
      const push = SOFT_PUSH_ACCEL * depth * depth;
      velocity.x -= nx * push * dt;
      velocity.z -= nz * push * dt;

      const limit = hardRadius - radius;
      if (distXZ > limit) {
        const outward = velocity.x * nx + velocity.z * nz;
        out.hitWall = true;
        out.impactSpeed = Math.max(0, outward);
        out.normal.set(-nx, 0, -nz);
        position.x = nx * limit;
        position.z = nz * limit;
        // Remove the outward component; keep tangential slide so the fighter
        // grazes along the barrier instead of sticking to it.
        if (outward > 0) {
          velocity.x -= nx * outward;
          velocity.z -= nz * outward;
        }
      }
    }

    // --- Pillars ---------------------------------------------------------
    for (const p of this.def.pillars) {
      const h = p.intact ? p.height : p.height * 0.45;
      if (position.y > h) continue;
      const dx = position.x - p.x;
      const dz = position.z - p.z;
      const d = Math.hypot(dx, dz);
      const minD = p.radius + radius;
      if (d < minD && d > 1e-6) {
        const nx = dx / d;
        const nz = dz / d;
        const inward = -(velocity.x * nx + velocity.z * nz);
        if (inward > out.impactSpeed) {
          out.hitWall = true;
          out.impactSpeed = inward;
          out.normal.set(nx, 0, nz);
        }
        position.x = p.x + nx * minD;
        position.z = p.z + nz * minD;
        if (inward > 0) {
          velocity.x += nx * inward;
          velocity.z += nz * inward;
        }
        // A hard enough impact shatters the pillar — reactive environment.
        if (p.intact && inward > WALL_SPLAT_SPEED * 1.4) p.intact = false;
      }
    }

    // --- Ceiling ---------------------------------------------------------
    if (position.y > ceiling) {
      position.y = ceiling;
      if (velocity.y > 0) {
        out.impactSpeed = Math.max(out.impactSpeed, velocity.y);
        velocity.y = 0;
      }
    }

    // --- Floor is handled by the fighter (needs landing-state logic) ------
    if (position.y < floor) position.y = floor;

    return out;
  }

  /** True if the segment a→b is blocked by a pillar. Used for camera collision. */
  segmentBlocked(a: Vec3, b: Vec3): { blocked: boolean; t: number } {
    let nearest = 1;
    let blocked = false;
    for (const p of this.def.pillars) {
      const h = p.intact ? p.height : p.height * 0.45;
      // Cheap check: skip pillars entirely above/below the segment.
      if (Math.min(a.y, b.y) > h) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const fx = a.x - p.x;
      const fz = a.z - p.z;
      const A = dx * dx + dz * dz;
      if (A < 1e-8) continue;
      const B = 2 * (fx * dx + fz * dz);
      const C = fx * fx + fz * fz - p.radius * p.radius;
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      const t1 = (-B - sq) / (2 * A);
      if (t1 > 0 && t1 < nearest) {
        nearest = t1;
        blocked = true;
      }
    }
    return { blocked, t: nearest };
  }

  /** Clamp an arbitrary point (e.g. the camera) inside the playable volume. */
  clampPoint(p: Vec3, margin = 1.5): void {
    const d = Math.hypot(p.x, p.z);
    const limit = this.def.hardRadius - margin;
    if (d > limit && d > 1e-6) {
      p.x = (p.x / d) * limit;
      p.z = (p.z / d) * limit;
    }
    p.y = clamp(p.y, this.def.floor + 0.6, this.def.ceiling + 8);
  }
}

export function emptyBoundaryContact(): BoundaryContact {
  return {
    inSoftZone: false,
    softDepth: 0,
    hitWall: false,
    normal: new Vec3(),
    impactSpeed: 0,
  };
}
