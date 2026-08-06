/**
 * THE RUINS OF VEYRA — the arena.
 *
 * Original visual direction: a shattered celestial plateau under a dying sky,
 * with the planet's own core-light bleeding up through fractures in the rock.
 * Broken monoliths that once channelled celestial energy now stand snapped and
 * dark. On the horizon, the debris field of the world Veyron unmade.
 *
 * Everything is generated procedurally — no external assets — which keeps the
 * slice self-contained and makes the whole arena tunable from code.
 *
 * The boundary is a visible energy barrier rather than an invisible wall: it
 * brightens as a fighter approaches, so the limit is communicated before it is
 * enforced.
 */

import * as THREE from 'three';
import type { ArenaDef } from '../gameplay/Arena';
import { Rand } from '../core/Rand';

/** Palette. Cold rock, warm celestial fractures, deep void sky. */
const ROCK_DARK = 0x1b1a26;
const ROCK_LIGHT = 0x2e2b3d;
const FRACTURE = 0xa877ff;
const SKY_LOW = 0x1a1030;
const SKY_HIGH = 0x05040c;
const BARRIER = 0x7b5cff;

export class RuinsOfVeyra {
  readonly group = new THREE.Group();
  private readonly barrierMat: THREE.ShaderMaterial;
  private readonly fractureMats: THREE.MeshBasicMaterial[] = [];
  private readonly pillarMeshes: THREE.Group[] = [];
  private readonly dust: THREE.Points;
  private readonly dustVelocities: Float32Array;
  private readonly embers: THREE.Points;
  private readonly emberData: Float32Array;
  private readonly rand = new Rand(0x5eed17);
  private time = 0;

  constructor(private readonly def: ArenaDef) {
    this.group.add(this.buildGround());
    this.group.add(this.buildFractures());
    this.buildPillars();
    this.group.add(this.buildMonoliths());
    this.group.add(this.buildHorizonDebris());
    this.group.add(this.buildSky());

    const barrier = this.buildBarrier();
    this.barrierMat = barrier.material as THREE.ShaderMaterial;
    this.group.add(barrier);

    const d = this.buildDust();
    this.dust = d.points;
    this.dustVelocities = d.velocities;
    this.group.add(this.dust);

    const e = this.buildEmbers();
    this.embers = e.points;
    this.emberData = e.data;
    this.group.add(this.embers);
  }

  // ------------------------------------------------------------------ ground

  private buildGround(): THREE.Mesh {
    const r = this.def.hardRadius + 26;
    const geo = new THREE.CircleGeometry(r, 96, 0, Math.PI * 2);
    geo.rotateX(-Math.PI / 2);

    // Displace vertices into a rocky, uneven plateau that stays flat in the
    // combat area and breaks up toward the rim.
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const cDark = new THREE.Color(ROCK_DARK);
    const cLight = new THREE.Color(ROCK_LIGHT);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.hypot(x, z);
      const edge = Math.max(0, (d - this.def.softRadius * 0.55) / r);
      const n =
        Math.sin(x * 0.09) * Math.cos(z * 0.11) * 0.5 +
        Math.sin(x * 0.31 + 1.7) * Math.cos(z * 0.27) * 0.22;
      const h = n * edge * 9 - edge * edge * 5;
      pos.setY(i, h);
      const c = cDark.clone().lerp(cLight, clamp01(0.4 + n * 0.5));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.94,
        metalness: 0.05,
        flatShading: true,
      }),
    );
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Glowing cracks in the plateau — the planet's core light bleeding through. */
  private buildFractures(): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 26; i++) {
      const a = this.rand.range(0, Math.PI * 2);
      const dist = this.rand.range(4, this.def.softRadius * 0.92);
      const len = this.rand.range(5, 20);
      const wid = this.rand.range(0.12, 0.42);
      const mat = new THREE.MeshBasicMaterial({
        color: FRACTURE,
        transparent: true,
        opacity: this.rand.range(0.3, 0.72),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.fractureMats.push(mat);
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), mat);
      crack.rotation.x = -Math.PI / 2;
      crack.rotation.z = this.rand.range(0, Math.PI);
      crack.position.set(Math.cos(a) * dist, 0.045, Math.sin(a) * dist);
      g.add(crack);
    }
    return g;
  }

  /** Standing monoliths — solid, and the source of camera occlusion. */
  private buildPillars(): void {
    const rockMat = new THREE.MeshStandardMaterial({
      color: ROCK_LIGHT,
      roughness: 0.88,
      metalness: 0.1,
      flatShading: true,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: FRACTURE,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.fractureMats.push(glowMat);

    for (const p of this.def.pillars) {
      const g = new THREE.Group();
      const seg = 4 + Math.floor(this.rand.range(0, 3));
      for (let i = 0; i < seg; i++) {
        const t = i / seg;
        const h = (p.height / seg) * this.rand.range(0.85, 1.15);
        const rTop = p.radius * (1 - t * 0.45) * this.rand.range(0.9, 1.05);
        const rBot = p.radius * (1 - (t - 1 / seg) * 0.45);
        const chunk = new THREE.Mesh(
          new THREE.CylinderGeometry(rTop, rBot, h, 7, 1),
          rockMat,
        );
        chunk.position.y = t * p.height + h * 0.5;
        chunk.rotation.y = this.rand.range(0, Math.PI);
        chunk.position.x = this.rand.range(-0.14, 0.14);
        chunk.position.z = this.rand.range(-0.14, 0.14);
        chunk.castShadow = true;
        chunk.receiveShadow = true;
        g.add(chunk);
      }
      // A vein of celestial light running up the monolith.
      const vein = new THREE.Mesh(
        new THREE.CylinderGeometry(p.radius * 0.24, p.radius * 0.1, p.height * 0.9, 6),
        glowMat,
      );
      vein.position.y = p.height * 0.45;
      g.add(vein);

      g.position.set(p.x, 0, p.z);
      g.userData.baseHeight = p.height;
      this.pillarMeshes.push(g);
      this.group.add(g);
    }
  }

  /** Broken celestial architecture ringing the arena — pure silhouette. */
  private buildMonoliths(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x14131d,
      roughness: 0.95,
      metalness: 0.15,
      flatShading: true,
    });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + this.rand.range(-0.1, 0.1);
      const d = this.def.hardRadius + this.rand.range(8, 42);
      const h = this.rand.range(14, 64);
      const w = this.rand.range(3, 11);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * this.rand.range(0.6, 1.4)), mat);
      m.position.set(Math.cos(a) * d, h * 0.5 - this.rand.range(2, 9), Math.sin(a) * d);
      m.rotation.set(
        this.rand.range(-0.18, 0.18),
        this.rand.range(0, Math.PI),
        this.rand.range(-0.22, 0.22),
      );
      g.add(m);
    }
    return g;
  }

  /** The debris field of the destroyed world, far off on the horizon. */
  private buildHorizonDebris(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a2140 });
    const glow = new THREE.MeshBasicMaterial({
      color: 0xff7a4a,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // The shattered remnant of Veyra itself, hanging in the sky.
    const core = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 18), mat);
    core.position.set(-320, 190, -520);
    core.scale.set(1, 0.92, 1);
    g.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(150, 20, 14), glow);
    halo.position.copy(core.position);
    g.add(halo);

    // Orbiting fragments.
    for (let i = 0; i < 40; i++) {
      const a = this.rand.range(0, Math.PI * 2);
      const rr = this.rand.range(150, 330);
      const s = this.rand.range(3, 22);
      const frag = new THREE.Mesh(new THREE.TetrahedronGeometry(s, 0), mat);
      frag.position.set(
        -320 + Math.cos(a) * rr,
        190 + this.rand.range(-90, 90),
        -520 + Math.sin(a) * rr * 0.5,
      );
      frag.rotation.set(this.rand.range(0, 6), this.rand.range(0, 6), this.rand.range(0, 6));
      g.add(frag);
    }
    return g;
  }

  /** Gradient sky dome. */
  private buildSky(): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        low: { value: new THREE.Color(SKY_LOW) },
        high: { value: new THREE.Color(SKY_HIGH) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 low; uniform vec3 high;
        varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
          vec3 c = mix(low, high, pow(h, 0.7));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    return new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), mat);
  }

  /**
   * The Veyra Barrier.
   *
   * A cylindrical energy wall that is almost invisible until a fighter nears
   * it, then flares with a hex pattern. This is what makes the boundary feel
   * like a deliberate part of the world rather than an invisible wall.
   */
  private buildBarrier(): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(
      this.def.hardRadius,
      this.def.hardRadius,
      this.def.ceiling + 16,
      72,
      1,
      true,
    );
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(BARRIER) },
        // Proximity of each fighter, 0..1, drives local flare intensity.
        uP0: { value: new THREE.Vector3() },
        uP1: { value: new THREE.Vector3() },
        uI0: { value: 0 },
        uI1: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorld;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uColor;
        uniform vec3 uP0; uniform vec3 uP1;
        uniform float uI0; uniform float uI1;
        varying vec3 vWorld;
        varying vec2 vUv;
        void main() {
          // Hex-ish grid built from three interfering sine bands.
          vec2 g = vec2(vUv.x * 150.0, vUv.y * 26.0);
          float a = abs(sin(g.x + sin(g.y * 0.5)));
          float b = abs(sin(g.y * 1.7 - uTime * 0.4));
          float grid = pow(max(a, b), 22.0);

          // Local flare where a fighter is close to the wall.
          float d0 = distance(vWorld.xz, uP0.xz) + abs(vWorld.y - uP0.y) * 0.35;
          float d1 = distance(vWorld.xz, uP1.xz) + abs(vWorld.y - uP1.y) * 0.35;
          float f0 = uI0 * exp(-d0 * 0.13);
          float f1 = uI1 * exp(-d1 * 0.13);
          float flare = clamp(f0 + f1, 0.0, 1.4);

          float base = 0.028 + 0.02 * sin(uTime * 0.7 + vUv.y * 8.0);
          float alpha = base + grid * 0.14 + flare * (0.55 + grid * 0.9);
          // Fade out toward the top so there is no hard ceiling line.
          alpha *= smoothstep(1.0, 0.55, vUv.y);
          gl_FragColor = vec4(uColor * (0.8 + flare), alpha);
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = (this.def.ceiling + 16) * 0.5 - 6;
    return m;
  }

  /** Slow ambient dust motes drifting through the combat volume. */
  private buildDust(): { points: THREE.Points; velocities: Float32Array } {
    const n = 900;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = this.rand.range(0, Math.PI * 2);
      const d = Math.sqrt(this.rand.next()) * this.def.hardRadius;
      pos[i * 3] = Math.cos(a) * d;
      pos[i * 3 + 1] = this.rand.range(0, this.def.ceiling);
      pos[i * 3 + 2] = Math.sin(a) * d;
      vel[i * 3] = this.rand.range(-0.25, 0.25);
      vel[i * 3 + 1] = this.rand.range(0.06, 0.5);
      vel[i * 3 + 2] = this.rand.range(-0.25, 0.25);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xb9a5ff,
        size: 0.13,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    return { points, velocities: vel };
  }

  /** Embers rising from the fractures — warmer, denser near the ground. */
  private buildEmbers(): { points: THREE.Points; data: Float32Array } {
    const n = 260;
    const pos = new Float32Array(n * 3);
    // data = [speed, seed] per particle
    const data = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = this.rand.range(0, Math.PI * 2);
      const d = Math.sqrt(this.rand.next()) * this.def.softRadius;
      pos[i * 3] = Math.cos(a) * d;
      pos[i * 3 + 1] = this.rand.range(0, 22);
      pos[i * 3 + 2] = Math.sin(a) * d;
      data[i * 2] = this.rand.range(0.9, 3.1);
      data[i * 2 + 1] = this.rand.range(0, 100);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffb26b,
        size: 0.2,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    return { points, data };
  }

  // ------------------------------------------------------------------ update

  update(
    dt: number,
    fighterA: { x: number; y: number; z: number; near: number },
    fighterB: { x: number; y: number; z: number; near: number },
  ): void {
    this.time += dt;

    const u = this.barrierMat.uniforms;
    u.uTime.value = this.time;
    (u.uP0.value as THREE.Vector3).set(fighterA.x, fighterA.y, fighterA.z);
    (u.uP1.value as THREE.Vector3).set(fighterB.x, fighterB.y, fighterB.z);
    u.uI0.value = fighterA.near;
    u.uI1.value = fighterB.near;

    // Fracture light breathes.
    const pulse = 0.5 + Math.sin(this.time * 0.9) * 0.16;
    for (let i = 0; i < this.fractureMats.length; i++) {
      const m = this.fractureMats[i];
      m.opacity = pulse * (0.55 + ((i * 37) % 11) / 22);
    }

    // Dust drift, wrapping at the ceiling.
    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    const arr = dp.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += this.dustVelocities[i] * dt;
      arr[i + 1] += this.dustVelocities[i + 1] * dt;
      arr[i + 2] += this.dustVelocities[i + 2] * dt;
      if (arr[i + 1] > this.def.ceiling) arr[i + 1] = 0;
    }
    dp.needsUpdate = true;

    // Embers rise faster and recycle at a lower ceiling.
    const ep = this.embers.geometry.attributes.position as THREE.BufferAttribute;
    const earr = ep.array as Float32Array;
    for (let i = 0, j = 0; i < earr.length; i += 3, j += 2) {
      earr[i + 1] += this.emberData[j] * dt;
      earr[i] += Math.sin(this.time * 0.7 + this.emberData[j + 1]) * 0.35 * dt;
      if (earr[i + 1] > 26) earr[i + 1] = 0;
    }
    ep.needsUpdate = true;
  }

  /** Reflects pillar destruction from the simulation into the visuals. */
  syncPillars(): void {
    for (let i = 0; i < this.pillarMeshes.length; i++) {
      const p = this.def.pillars[i];
      const g = this.pillarMeshes[i];
      if (!p.intact && !g.userData.broken) {
        g.userData.broken = true;
        // Topple the upper segments to show the impact.
        const kids = g.children;
        for (let k = Math.floor(kids.length * 0.45); k < kids.length; k++) {
          const c = kids[k];
          c.rotation.z += (k % 2 ? 1 : -1) * 0.9;
          c.position.y *= 0.42;
          c.position.x += (k % 2 ? 1 : -1) * 1.8;
        }
      }
    }
  }

  reset(): void {
    for (const g of this.pillarMeshes) g.userData.broken = false;
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
