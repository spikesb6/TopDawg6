/**
 * Deterministic PRNG (mulberry32).
 *
 * Every non-deterministic decision in the simulation — AI choices, VFX jitter,
 * hit spark offsets — must draw from a seeded Rand instance rather than
 * Math.random(). That is what makes the automated Gauntlet tests reproducible:
 * a failing 10-minute stability run can be replayed exactly from its seed.
 */
export class Rand {
  private s: number;

  constructor(seed = 0x9e3779b9) {
    this.s = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  int(loInclusive: number, hiExclusive: number): number {
    return loInclusive + Math.floor(this.next() * (hiExclusive - loInclusive));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length)];
  }

  /** Snapshot/restore so tests can fork a run without disturbing the stream. */
  getState(): number {
    return this.s;
  }

  setState(s: number): void {
    this.s = s >>> 0;
  }
}
