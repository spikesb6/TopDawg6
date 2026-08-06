/**
 * Energy projectiles.
 *
 * Pooled rather than allocated per shot: Starfall Barrage and End of Worlds can
 * put dozens in flight, and the brief calls out "no unbounded particle
 * spawning" as a performance requirement. The pool is hard-capped, and the
 * oldest live projectile is recycled if the cap is hit.
 */

import { Vec3 } from '../core/Vec3';
import type { ProjectileParams } from './Ability';

export const MAX_PROJECTILES = 96;

export class Projectile {
  readonly position = new Vec3();
  readonly velocity = new Vec3();

  active = false;
  /** Index of the fighter that fired it. Cannot hit its own owner. */
  ownerIndex = -1;
  params!: ProjectileParams;
  /** Metres travelled so far; expires past params.range. */
  travelled = 0;
  /** Fighters already hit, so a piercing shot doesn't multi-hit one target. */
  readonly hitTargets = new Set<number>();
  /** Frames alive — used by the render layer for trail fade. */
  age = 0;
  /** Set when the projectile should explode rather than simply expire. */
  detonate = false;

  reset(): void {
    this.active = false;
    this.ownerIndex = -1;
    this.travelled = 0;
    this.age = 0;
    this.detonate = false;
    this.hitTargets.clear();
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
  }
}

export class ProjectilePool {
  readonly items: Projectile[] = [];
  private cursor = 0;

  constructor(size = MAX_PROJECTILES) {
    for (let i = 0; i < size; i++) this.items.push(new Projectile());
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.items) if (p.active) n++;
    return n;
  }

  /**
   * Acquires a slot. Prefers a free one; if the pool is saturated it recycles
   * round-robin so spawn pressure can never allocate or grow unbounded.
   */
  spawn(): Projectile {
    for (let i = 0; i < this.items.length; i++) {
      const idx = (this.cursor + i) % this.items.length;
      const p = this.items[idx];
      if (!p.active) {
        this.cursor = (idx + 1) % this.items.length;
        p.reset();
        p.active = true;
        return p;
      }
    }
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    p.reset();
    p.active = true;
    return p;
  }

  clear(): void {
    for (const p of this.items) p.reset();
    this.cursor = 0;
  }
}
