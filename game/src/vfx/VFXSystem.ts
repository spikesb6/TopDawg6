/**
 * VFX system — the Niagara equivalent for this slice.
 *
 * Entirely event-driven: it subscribes to the simulation's EventBus and never
 * inspects game state directly, which is what lets the whole sim run headless
 * with no VFX attached.
 *
 * Two hard rules, both from the brief:
 *
 *   No unbounded spawning. Every effect class is a fixed-size pool. Under any
 *   amount of spawn pressure the cost is constant; the oldest effect is
 *   recycled instead of allocating.
 *
 *   Readability over density. Effects are additive, short-lived, and coloured
 *   by their OWNER, so at any moment the player can tell whose energy is on
 *   screen. Impact flashes are bright and brief rather than large and lingering,
 *   so they never bury the fighters.
 */

import * as THREE from 'three';
import type { EventBus, GameEvent } from '../core/Events';
import { Rand } from '../core/Rand';
import { clamp } from '../core/Vec3';

const MAX_SPARKS = 420;
const MAX_FLASHES = 40;
const MAX_RINGS = 28;
const MAX_BEAMS = 12;

interface Spark {
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
}

interface Flash {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  scale: number;
}

interface Ring {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  growth: number;
}

interface Beam {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

export interface VFXColors {
  /** Per-fighter energy colours, indexed by fighter index. */
  fighter: number[];
}

export class VFXSystem {
  readonly group = new THREE.Group();

  private readonly sparkGeo: THREE.BufferGeometry;
  private readonly sparkPoints: THREE.Points;
  private readonly sparkPos: Float32Array;
  private readonly sparkCol: Float32Array;
  private readonly sparkAlpha: Float32Array;
  private readonly sparks: Spark[] = [];
  private sparkCursor = 0;

  private readonly flashes: Flash[] = [];
  private flashCursor = 0;
  private readonly rings: Ring[] = [];
  private ringCursor = 0;
  private readonly beams: Beam[] = [];
  private beamCursor = 0;

  /** Pooled projectile visuals, keyed to the sim's projectile pool by index. */
  private readonly projectileMeshes: THREE.Mesh[] = [];
  private readonly projectileMats: THREE.MeshBasicMaterial[] = [];
  private readonly projectileTrails: THREE.Mesh[] = [];

  private readonly rand = new Rand(0x2fed42);
  private readonly tmpColor = new THREE.Color();

  /** Set by the host each frame so effects can tint by owner. */
  colors: VFXColors = { fighter: [0x9d6bff, 0x35f0c0] };

  /** Shake requests accumulated this frame, drained by the camera. */
  pendingShake = 0;

  constructor(projectilePoolSize: number) {
    // --- Sparks: one Points cloud, no per-spark objects in the scene -------
    this.sparkPos = new Float32Array(MAX_SPARKS * 3);
    this.sparkCol = new Float32Array(MAX_SPARKS * 3);
    this.sparkAlpha = new Float32Array(MAX_SPARKS);
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3));
    this.sparkGeo.setAttribute('alpha', new THREE.BufferAttribute(this.sparkAlpha, 1));
    const sparkMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: 26 } },
      vertexShader: `
        attribute float alpha;
        varying vec3 vColor; varying float vAlpha;
        uniform float uSize;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * alpha / max(1.0, -mv.z) * 8.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d);
          if (r > 0.25) discard;
          float f = 1.0 - r * 4.0;
          gl_FragColor = vec4(vColor, vAlpha * f * f);
        }`,
      vertexColors: true,
    });
    this.sparkPoints = new THREE.Points(this.sparkGeo, sparkMat);
    this.sparkPoints.frustumCulled = false;
    this.group.add(this.sparkPoints);
    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparks.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, gravity: 1 });
      this.sparkPos[i * 3 + 1] = -9999;
    }

    // --- Flashes: additive billboards for impacts --------------------------
    const flashGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < MAX_FLASHES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(flashGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.flashes.push({ mesh, mat, life: 0, maxLife: 1, scale: 1 });
    }

    // --- Rings: expanding shockwaves ---------------------------------------
    const ringGeo = new THREE.RingGeometry(0.82, 1, 40);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, life: 0, maxLife: 1, growth: 10 });
    }

    // --- Beams: ultimate pillars -------------------------------------------
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    for (let i = 0; i < MAX_BEAMS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(beamGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.beams.push({ mesh, mat, life: 0, maxLife: 1 });
    }

    // --- Projectile visuals -------------------------------------------------
    const projGeo = new THREE.SphereGeometry(1, 12, 10);
    const trailGeo = new THREE.ConeGeometry(1, 1, 8, 1, true);
    for (let i = 0; i < projectilePoolSize; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(projGeo, mat);
      mesh.visible = false;
      const trail = new THREE.Mesh(trailGeo, mat);
      trail.visible = false;
      this.group.add(mesh, trail);
      this.projectileMeshes.push(mesh);
      this.projectileMats.push(mat);
      this.projectileTrails.push(trail);
    }
  }

  // =====================================================================
  // Event binding
  // =====================================================================

  bind(events: EventBus): () => void {
    const offs = [
      events.on('hit', (e) => this.onHit(e)),
      events.on('block', (e) => this.onBlock(e)),
      events.on('parry', (e) => this.onParry(e)),
      events.on('guardBreak', (e) => this.onGuardBreak(e)),
      events.on('explosion', (e) => this.onExplosion(e)),
      events.on('projectileImpact', (e) => this.onProjectileImpact(e)),
      events.on('wallImpact', (e) => this.onWallImpact(e)),
      events.on('groundImpact', (e) => this.onGroundImpact(e)),
      events.on('land', (e) => this.onLand(e)),
      events.on('dash', (e) => this.onDash(e)),
      events.on('dodge', (e) => this.onDodge(e)),
      events.on('charge', (e) => this.onCharge(e)),
      events.on('transformStart', (e) => this.onTransform(e)),
      events.on('comboEscape', (e) => this.onComboEscape(e)),
      events.on('ultimateStart', (e) => this.onUltimateStart(e)),
      events.on('ultimateImpact', (e) => this.onUltimateImpact(e)),
      events.on('knockout', (e) => this.onKnockout(e)),
      events.on('cameraShake', (e) => {
        this.pendingShake = Math.max(this.pendingShake, e.magnitude);
      }),
    ];
    return () => offs.forEach((o) => o());
  }

  private colorOf(index: number): number {
    return this.colors.fighter[index] ?? 0xffffff;
  }

  private onHit(e: GameEvent): void {
    const c = this.colorOf(e.source);
    const power = clamp(e.magnitude * 2.2, 0.35, 1.4);
    // Hit spark: a bright, tight burst. Brief by design — a lingering flash on
    // every jab would bury the fighters within seconds.
    this.spawnFlash(e.position, 0xffffff, 1.1 + power * 1.5, 0.1);
    this.spawnFlash(e.position, c, 1.9 + power * 2.4, 0.16);
    this.burst(e.position, c, Math.round(8 + power * 16), 7 + power * 13, 0.28, 0.45);
    if (power > 0.55) this.spawnRing(e.position, c, 0.75 + power, 13, 0.3);
  }

  private onBlock(e: GameEvent): void {
    this.spawnFlash(e.position, 0xbfe9ff, 1.5, 0.13);
    this.burst(e.position, 0x9fd8ff, 8, 5, 0.22, 0.7);
    this.spawnRing(e.position, 0x9fd8ff, 0.7, 7, 0.2);
  }

  private onParry(e: GameEvent): void {
    // Perfect guard gets its own unmistakable read: a gold flash and a fast
    // expanding ring. A player must never wonder whether they parried.
    this.spawnFlash(e.position, 0xffe9a8, 3.4, 0.22);
    this.spawnRing(e.position, 0xffd166, 1.0, 26, 0.34);
    this.spawnRing(e.position, 0xffffff, 0.7, 17, 0.26);
    this.burst(e.position, 0xffd166, 26, 13, 0.42, 0.35);
  }

  private onGuardBreak(e: GameEvent): void {
    this.spawnFlash(e.position, 0xff5a5a, 3.6, 0.3);
    this.spawnRing(e.position, 0xff5a5a, 1.1, 18, 0.42);
    this.burst(e.position, 0xff8a6a, 30, 11, 0.6, 1.1);
  }

  private onExplosion(e: GameEvent): void {
    const c = e.value || this.colorOf(e.source);
    const r = Math.max(1, e.magnitude);
    this.spawnFlash(e.position, 0xffffff, r * 1.5, 0.16);
    this.spawnFlash(e.position, c, r * 2.4, 0.34);
    this.spawnRing(e.position, c, r * 0.4, r * 5.5, 0.5);
    this.spawnRing(e.position, 0xffffff, r * 0.25, r * 3.6, 0.34);
    this.burst(e.position, c, 90, r * 2.4, 0.85, 1.6);
  }

  private onProjectileImpact(e: GameEvent): void {
    const c = e.value || this.colorOf(e.source);
    this.spawnFlash(e.position, c, 2.0, 0.17);
    this.burst(e.position, c, 14, 9, 0.34, 0.9);
  }

  private onWallImpact(e: GameEvent): void {
    const splat = e.tag === 'splat';
    const c = 0xd8c4ff;
    this.spawnFlash(e.position, c, splat ? 3.6 : 1.6, splat ? 0.26 : 0.13);
    this.burst(e.position, c, splat ? 44 : 12, splat ? 15 : 6, 0.7, 2.2);
    if (splat) this.spawnRing(e.position, c, 1.0, 20, 0.4);
  }

  private onGroundImpact(e: GameEvent): void {
    const bounce = e.tag === 'bounce';
    const c = 0xc9b8ff;
    this.spawnRing(e.position, c, 0.9, bounce ? 20 : 26, 0.42, true);
    this.burst(e.position, 0x8f86ad, bounce ? 26 : 40, 8, 0.8, 2.6, true);
    this.spawnFlash(e.position, c, bounce ? 2.2 : 3.0, 0.2);
  }

  private onLand(e: GameEvent): void {
    if (e.magnitude < 0.25) return;
    this.spawnRing(e.position, 0x8f86ad, 0.6, 12 * e.magnitude, 0.3, true);
    this.burst(e.position, 0x8f86ad, Math.round(10 * e.magnitude), 5, 0.5, 2.4, true);
  }

  private onDash(e: GameEvent): void {
    const c = this.colorOf(e.source);
    const pursuit = e.tag === 'pursuit';
    this.spawnRing(e.position, c, 0.5, pursuit ? 18 : 11, pursuit ? 0.32 : 0.22);
    this.burst(e.position, c, pursuit ? 26 : 12, pursuit ? 11 : 6, 0.35, 0.2);
  }

  private onDodge(e: GameEvent): void {
    const c = this.colorOf(e.source);
    this.burst(e.position, c, 10, 4.5, 0.36, 0.15);
  }

  private onCharge(e: GameEvent): void {
    const c = this.colorOf(e.source);
    // Charging pulls energy INWARD — the inverse of every other effect, which
    // makes it instantly distinguishable from an attack.
    for (let i = 0; i < 5; i++) {
      const a = this.rand.range(0, Math.PI * 2);
      const r = this.rand.range(2.4, 4.4);
      const p = {
        x: e.position.x + Math.cos(a) * r,
        y: e.position.y + this.rand.range(0, 2.4),
        z: e.position.z + Math.sin(a) * r,
      };
      const s = this.acquireSpark();
      if (s < 0) continue;
      this.initSpark(s, p, c, 0.42);
      const sp = this.sparks[s];
      const inv = 1 / 0.42;
      sp.vx = (e.position.x - p.x) * inv;
      sp.vy = (e.position.y + 1 - p.y) * inv;
      sp.vz = (e.position.z - p.z) * inv;
      sp.gravity = 0;
    }
  }

  private onTransform(e: GameEvent): void {
    const c = this.colorOf(e.source);
    this.spawnFlash(e.position, 0xffffff, 6, 0.4);
    this.spawnRing(e.position, c, 1.2, 34, 0.7);
    this.spawnRing(e.position, 0xffffff, 0.8, 22, 0.5);
    this.burst(e.position, c, 120, 20, 1.2, -2.2);
    this.spawnBeam(e.position, c, 3.2, 34, 0.85);
  }

  private onComboEscape(e: GameEvent): void {
    const c = this.colorOf(e.source);
    this.spawnFlash(e.position, 0xffffff, 3.0, 0.2);
    this.spawnRing(e.position, c, 0.9, 24, 0.36);
    this.burst(e.position, c, 34, 14, 0.45, 0.2);
  }

  private onUltimateStart(e: GameEvent): void {
    const c = this.colorOf(e.source);
    this.spawnBeam(e.position, c, 4.5, 46, 1.5);
    this.spawnRing(e.position, c, 1.4, 30, 0.9);
    this.burst(e.position, c, 140, 16, 1.5, -1.6);
  }

  private onUltimateImpact(e: GameEvent): void {
    const c = this.colorOf(e.source);
    if (e.tag === 'captured') {
      this.spawnFlash(e.position, 0xffffff, 8, 0.5);
      this.spawnBeam(e.position, c, 5.5, 52, 1.4);
    }
  }

  private onKnockout(e: GameEvent): void {
    this.spawnFlash(e.position, 0xffffff, 7, 0.45);
    this.spawnRing(e.position, 0xffffff, 1.2, 40, 0.8);
    this.burst(e.position, 0xffd9d9, 90, 17, 1.3, 2.0);
  }

  // =====================================================================
  // Pooled spawners
  // =====================================================================

  private acquireSpark(): number {
    for (let i = 0; i < MAX_SPARKS; i++) {
      const idx = (this.sparkCursor + i) % MAX_SPARKS;
      if (this.sparks[idx].life <= 0) {
        this.sparkCursor = (idx + 1) % MAX_SPARKS;
        return idx;
      }
    }
    // Saturated: recycle round-robin. Cost stays constant under any pressure.
    const idx = this.sparkCursor;
    this.sparkCursor = (this.sparkCursor + 1) % MAX_SPARKS;
    return idx;
  }

  private initSpark(
    i: number,
    p: { x: number; y: number; z: number },
    color: number,
    life: number,
  ): void {
    this.sparkPos[i * 3] = p.x;
    this.sparkPos[i * 3 + 1] = p.y;
    this.sparkPos[i * 3 + 2] = p.z;
    this.tmpColor.set(color);
    this.sparkCol[i * 3] = this.tmpColor.r;
    this.sparkCol[i * 3 + 1] = this.tmpColor.g;
    this.sparkCol[i * 3 + 2] = this.tmpColor.b;
    this.sparkAlpha[i] = 1;
    const s = this.sparks[i];
    s.life = life;
    s.maxLife = life;
    s.gravity = 1;
  }

  private burst(
    p: { x: number; y: number; z: number },
    color: number,
    count: number,
    speed: number,
    life: number,
    gravity: number,
    flat = false,
  ): void {
    for (let n = 0; n < count; n++) {
      const i = this.acquireSpark();
      if (i < 0) return;
      this.initSpark(i, p, color, life * this.rand.range(0.6, 1.25));
      const a = this.rand.range(0, Math.PI * 2);
      const e = flat ? this.rand.range(0, 0.5) : this.rand.range(-1, 1);
      const h = Math.sqrt(Math.max(0, 1 - e * e));
      const sp = speed * this.rand.range(0.35, 1.15);
      const s = this.sparks[i];
      s.vx = Math.cos(a) * h * sp;
      s.vy = e * sp + (flat ? sp * 0.35 : 0);
      s.vz = Math.sin(a) * h * sp;
      s.gravity = gravity;
    }
  }

  private spawnFlash(
    p: { x: number; y: number; z: number },
    color: number,
    scale: number,
    life: number,
  ): void {
    const f = this.flashes[this.flashCursor];
    this.flashCursor = (this.flashCursor + 1) % MAX_FLASHES;
    f.mesh.position.set(p.x, p.y + 0.9, p.z);
    f.mat.color.set(color);
    f.mat.opacity = 1;
    f.life = life;
    f.maxLife = life;
    f.scale = scale;
    f.mesh.visible = true;
    f.mesh.scale.setScalar(scale * 0.35);
  }

  private spawnRing(
    p: { x: number; y: number; z: number },
    color: number,
    scale: number,
    growth: number,
    life: number,
    flat = false,
  ): void {
    const r = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % MAX_RINGS;
    r.mesh.position.set(p.x, p.y + (flat ? 0.08 : 0.9), p.z);
    r.mesh.rotation.set(flat ? -Math.PI / 2 : 0, 0, this.rand.range(0, Math.PI));
    r.mesh.userData.flat = flat;
    r.mat.color.set(color);
    r.mat.opacity = 0.9;
    r.life = life;
    r.maxLife = life;
    r.growth = growth;
    r.mesh.visible = true;
    r.mesh.scale.setScalar(scale);
  }

  private spawnBeam(
    p: { x: number; y: number; z: number },
    color: number,
    radius: number,
    height: number,
    life: number,
  ): void {
    const b = this.beams[this.beamCursor];
    this.beamCursor = (this.beamCursor + 1) % MAX_BEAMS;
    b.mesh.position.set(p.x, p.y + height * 0.5, p.z);
    b.mesh.scale.set(radius, height, radius);
    b.mat.color.set(color);
    b.mat.opacity = 0.7;
    b.life = life;
    b.maxLife = life;
    b.mesh.visible = true;
  }

  // =====================================================================
  // Per-frame update
  // =====================================================================

  update(dt: number, cameraQuat: THREE.Quaternion): void {
    // Sparks.
    let anyAlive = false;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = this.sparks[i];
      if (s.life <= 0) {
        if (this.sparkAlpha[i] !== 0) this.sparkAlpha[i] = 0;
        continue;
      }
      anyAlive = true;
      s.life -= dt;
      const t = clamp(s.life / s.maxLife, 0, 1);
      this.sparkAlpha[i] = t * t;
      s.vy -= 26 * s.gravity * dt;
      this.sparkPos[i * 3] += s.vx * dt;
      this.sparkPos[i * 3 + 1] += s.vy * dt;
      this.sparkPos[i * 3 + 2] += s.vz * dt;
      // Ground collision so debris settles rather than sinking.
      if (this.sparkPos[i * 3 + 1] < 0.05 && s.gravity > 0) {
        this.sparkPos[i * 3 + 1] = 0.05;
        s.vy *= -0.28;
        s.vx *= 0.62;
        s.vz *= 0.62;
      }
      if (s.life <= 0) this.sparkAlpha[i] = 0;
    }
    if (anyAlive) {
      (this.sparkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.sparkGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (this.sparkGeo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    }

    // Flashes: billboard toward the camera, expand and fade fast.
    for (const f of this.flashes) {
      if (f.life <= 0) {
        if (f.mesh.visible) f.mesh.visible = false;
        continue;
      }
      f.life -= dt;
      const t = clamp(f.life / f.maxLife, 0, 1);
      f.mat.opacity = t * t;
      f.mesh.scale.setScalar(f.scale * (0.35 + (1 - t) * 0.9));
      f.mesh.quaternion.copy(cameraQuat);
      if (f.life <= 0) f.mesh.visible = false;
    }

    // Rings.
    for (const r of this.rings) {
      if (r.life <= 0) {
        if (r.mesh.visible) r.mesh.visible = false;
        continue;
      }
      r.life -= dt;
      const t = clamp(r.life / r.maxLife, 0, 1);
      r.mat.opacity = t * 0.9;
      r.mesh.scale.addScalar(r.growth * dt);
      if (!r.mesh.userData.flat) r.mesh.quaternion.copy(cameraQuat);
      if (r.life <= 0) r.mesh.visible = false;
    }

    // Beams.
    for (const b of this.beams) {
      if (b.life <= 0) {
        if (b.mesh.visible) b.mesh.visible = false;
        continue;
      }
      b.life -= dt;
      const t = clamp(b.life / b.maxLife, 0, 1);
      b.mat.opacity = t * 0.7;
      b.mesh.scale.x *= 1 + dt * 0.8;
      b.mesh.scale.z = b.mesh.scale.x;
      if (b.life <= 0) b.mesh.visible = false;
    }
  }

  /** Syncs projectile visuals from the simulation's pool. */
  syncProjectiles(
    items: Array<{
      active: boolean;
      position: { x: number; y: number; z: number };
      velocity: { x: number; y: number; z: number };
      params: { radius: number; color: number };
      age: number;
    }>,
  ): void {
    for (let i = 0; i < this.projectileMeshes.length; i++) {
      const p = items[i];
      const mesh = this.projectileMeshes[i];
      const trail = this.projectileTrails[i];
      if (!p || !p.active) {
        if (mesh.visible) {
          mesh.visible = false;
          trail.visible = false;
        }
        continue;
      }
      const r = p.params.radius;
      mesh.visible = true;
      mesh.position.set(p.position.x, p.position.y, p.position.z);
      // A brief spawn pop so shots read as launched, not teleported in.
      const pop = clamp(p.age / 4, 0.35, 1);
      mesh.scale.setScalar(r * (1.35 + Math.sin(p.age * 0.7) * 0.12) * pop);
      this.projectileMats[i].color.set(p.params.color);

      const speed = Math.hypot(p.velocity.x, p.velocity.y, p.velocity.z);
      if (speed > 1) {
        trail.visible = true;
        trail.position.set(p.position.x, p.position.y, p.position.z);
        const len = clamp(speed * 0.09, 1, 6);
        trail.scale.set(r * 1.1, len, r * 1.1);
        // Point the cone backward along the velocity.
        const dir = new THREE.Vector3(p.velocity.x, p.velocity.y, p.velocity.z).normalize();
        trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.negate());
        trail.position.addScaledVector(dir, len * 0.5);
      } else {
        trail.visible = false;
      }
    }
  }

  /** Drains the accumulated shake request. */
  takeShake(): number {
    const s = this.pendingShake;
    this.pendingShake = 0;
    return s;
  }

  clear(): void {
    for (const s of this.sparks) s.life = 0;
    for (let i = 0; i < MAX_SPARKS; i++) this.sparkAlpha[i] = 0;
    for (const f of this.flashes) {
      f.life = 0;
      f.mesh.visible = false;
    }
    for (const r of this.rings) {
      r.life = 0;
      r.mesh.visible = false;
    }
    for (const b of this.beams) {
      b.life = 0;
      b.mesh.visible = false;
    }
    for (const m of this.projectileMeshes) m.visible = false;
    for (const t of this.projectileTrails) t.visible = false;
    this.pendingShake = 0;
  }

  /** Live effect counts, surfaced by the performance overlay. */
  stats(): { sparks: number; flashes: number; rings: number } {
    let s = 0;
    for (const k of this.sparks) if (k.life > 0) s++;
    let f = 0;
    for (const k of this.flashes) if (k.life > 0) f++;
    let r = 0;
    for (const k of this.rings) if (k.life > 0) r++;
    return { sparks: s, flashes: f, rings: r };
  }
}
