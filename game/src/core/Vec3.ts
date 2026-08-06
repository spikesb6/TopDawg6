/**
 * Minimal mutable 3D vector used by the headless simulation.
 *
 * The simulation layer deliberately does NOT depend on three.js so that the
 * whole fight can be run in Node with no renderer, no DOM and no GPU. The
 * render layer converts these into THREE.Vector3 at draw time.
 *
 * Units: 1 unit = 1 metre. Y is up.
 */
export class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v: Vec3): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  add(v: Vec3): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  addScaled(v: Vec3, s: number): this {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }

  sub(v: Vec3): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  get length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  get lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /** Horizontal (XZ) magnitude — used constantly by ground movement. */
  get lengthXZ(): number {
    return Math.sqrt(this.x * this.x + this.z * this.z);
  }

  normalize(): this {
    const l = this.length;
    if (l > 1e-8) this.scale(1 / l);
    return this;
  }

  /** Clamp only the horizontal component, leaving vertical speed untouched. */
  clampXZ(max: number): this {
    const l = this.lengthXZ;
    if (l > max && l > 1e-8) {
      const s = max / l;
      this.x *= s;
      this.z *= s;
    }
    return this;
  }

  clampLength(max: number): this {
    const l = this.length;
    if (l > max && l > 1e-8) this.scale(max / l);
    return this;
  }

  distanceTo(v: Vec3): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  distanceToXZ(v: Vec3): number {
    const dx = this.x - v.x;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  isFinite(): boolean {
    return Number.isFinite(this.x) && Number.isFinite(this.y) && Number.isFinite(this.z);
  }

  static sub(a: Vec3, b: Vec3): Vec3 {
    return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  static lerp(a: Vec3, b: Vec3, t: number, out: Vec3): Vec3 {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    return out;
  }
}

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Frame-rate independent exponential smoothing. `rate` is per-second. */
export const damp = (a: number, b: number, rate: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-rate * dt));

/** Shortest signed angular difference in radians, result in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function approachAngle(from: number, to: number, maxStep: number): number {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}
