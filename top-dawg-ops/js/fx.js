'use strict';
// Visual effects: tracers, particles, bullet holes, explosions, smoke.

const FX = (() => {
  let scene;
  const tracers = [], decals = [], blasts = [], emitters = [];
  let decalIdx = 0;
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

  class Particles {
    constructor(max, additive, size) {
      this.max = max; this.n = 0;
      this.pos = new Float32Array(max * 3);
      this.col = new Float32Array(max * 3);
      this.vel = new Float32Array(max * 3);
      this.life = new Float32Array(max);
      this.maxLife = new Float32Array(max);
      this.grav = new Float32Array(max);
      this.base = new Float32Array(max * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
      g.setDrawRange(0, 0);
      this.geo = g;
      const tex = FX_dotTexture();
      this.mesh = new THREE.Points(g, new THREE.PointsMaterial({
        size, map: tex, vertexColors: true, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true,
      }));
      this.mesh.frustumCulled = false;
      scene.add(this.mesh);
    }
    emit(x, y, z, vx, vy, vz, r, g, b, life, grav) {
      let i;
      if (this.n < this.max) i = this.n++;
      else i = (Math.random() * this.max) | 0;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.base[i * 3] = r; this.base[i * 3 + 1] = g; this.base[i * 3 + 2] = b;
      this.life[i] = this.maxLife[i] = life;
      this.grav[i] = grav;
    }
    update(dt) {
      let n = this.n;
      for (let i = 0; i < n; i++) {
        this.life[i] -= dt;
        if (this.life[i] <= 0) {
          // swap-remove with last
          n--;
          if (i !== n) {
            for (let k = 0; k < 3; k++) {
              this.pos[i * 3 + k] = this.pos[n * 3 + k]; this.vel[i * 3 + k] = this.vel[n * 3 + k]; this.base[i * 3 + k] = this.base[n * 3 + k];
            }
            this.life[i] = this.life[n]; this.maxLife[i] = this.maxLife[n]; this.grav[i] = this.grav[n];
            i--;
          }
          continue;
        }
        this.vel[i * 3 + 1] -= this.grav[i] * dt;
        const drag = 1 - Math.min(1, dt * 1.5);
        this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag;
        this.pos[i * 3] += this.vel[i * 3] * dt;
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
        this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        if (this.pos[i * 3 + 1] < 0.02) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; }
        const f = this.life[i] / this.maxLife[i];
        this.col[i * 3] = this.base[i * 3] * f; this.col[i * 3 + 1] = this.base[i * 3 + 1] * f; this.col[i * 3 + 2] = this.base[i * 3 + 2] * f;
      }
      this.n = n;
      this.geo.setDrawRange(0, n);
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }

  let dotTex = null;
  function FX_dotTexture() {
    if (dotTex) return dotTex;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    dotTex = new THREE.CanvasTexture(c);
    return dotTex;
  }

  let sparks, dust, smoke;
  let tracerGeo, decalGeo, decalMat, scorchMat, blastGeo;
  let flashLight;

  function init(sc) {
    scene = sc;
    sparks = new Particles(700, true, 0.12);
    dust = new Particles(900, false, 0.22);
    smoke = new Particles(500, false, 1.6);
    tracerGeo = new THREE.BoxGeometry(0.025, 0.025, 1);
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; m.frustumCulled = false;
      scene.add(m);
      tracers.push({ mesh: m, active: false });
    }
    decalGeo = new THREE.PlaneGeometry(0.12, 0.12);
    decalMat = new THREE.MeshBasicMaterial({ color: 0x151310, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
    scorchMat = new THREE.MeshBasicMaterial({ color: 0x0c0a08, transparent: true, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
    for (let i = 0; i < 120; i++) {
      const m = new THREE.Mesh(decalGeo, decalMat);
      m.visible = false; scene.add(m); decals.push(m);
    }
    blastGeo = new THREE.SphereGeometry(1, 16, 12);
    flashLight = new THREE.PointLight(0xffb060, 0, 12, 2);
    scene.add(flashLight);
  }

  function tracer(ax, ay, az, bx, by, bz, color = 0xffd27a, speed = 380) {
    const t = tracers.find(t => !t.active) || tracers[(Math.random() * tracers.length) | 0];
    t.active = true;
    t.ax = ax; t.ay = ay; t.az = az;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    t.len = Math.hypot(dx, dy, dz);
    t.dx = dx / t.len; t.dy = dy / t.len; t.dz = dz / t.len;
    t.head = 0; t.speed = speed; t.seg = Math.min(5, t.len * 0.6);
    t.mesh.material.color.setHex(color);
    t.mesh.material.opacity = 1;
    t.mesh.visible = true;
  }

  function impact(x, y, z, nx, ny, nz, kind) {
    if (kind === 'blood') {
      for (let i = 0; i < 10; i++) dust.emit(x, y, z, nx * 1.5 + (Math.random() - 0.5) * 2.5, Math.random() * 2, nz * 1.5 + (Math.random() - 0.5) * 2.5, 0.55, 0.05, 0.04, 0.5 + Math.random() * 0.3, 6);
      return;
    }
    for (let i = 0; i < 6; i++) sparks.emit(x, y, z, nx * 3 + (Math.random() - 0.5) * 5, ny * 3 + Math.random() * 3, nz * 3 + (Math.random() - 0.5) * 5, 1, 0.75, 0.35, 0.18 + Math.random() * 0.15, 12);
    for (let i = 0; i < 5; i++) dust.emit(x, y, z, nx * 1.2 + (Math.random() - 0.5), ny * 1.2 + Math.random() * 0.8, nz * 1.2 + (Math.random() - 0.5), 0.45, 0.42, 0.36, 0.5 + Math.random() * 0.5, 1.5);
    decal(x, y, z, nx, ny, nz, decalMat, 1);
  }

  function decal(x, y, z, nx, ny, nz, mat, scale) {
    const m = decals[decalIdx];
    decalIdx = (decalIdx + 1) % decals.length;
    m.material = mat;
    m.scale.setScalar(scale);
    m.position.set(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01);
    tmpV.set(x + nx, y + ny, z + nz);
    m.lookAt(tmpV);
    m.rotateZ(Math.random() * Math.PI);
    m.visible = true;
  }

  function explosion(x, y, z, radius) {
    const mesh = new THREE.Mesh(blastGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    blasts.push({ mesh, t: 0, r: radius });
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 10, up = Math.random() * 9;
      sparks.emit(x, y + 0.3, z, Math.cos(a) * s, up, Math.sin(a) * s, 1, 0.55 + Math.random() * 0.3, 0.15, 0.4 + Math.random() * 0.5, 14);
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 2.5;
      smoke.emit(x + Math.cos(a), y + 0.5, z + Math.sin(a), Math.cos(a) * s, 1 + Math.random() * 2, Math.sin(a) * s, 0.28, 0.26, 0.24, 2 + Math.random() * 1.5, -0.4);
    }
    flashLight.position.set(x, y + 1.5, z);
    flashLight.intensity = 30; flashLight.distance = radius * 4;
    if (y < 0.3) decal(x, 0.02, z, 0, 1, 0, scorchMat, radius * 8);
  }

  function muzzleFlash(x, y, z) {
    flashLight.position.set(x, y, z);
    flashLight.intensity = Math.max(flashLight.intensity, 4);
    flashLight.distance = 8;
  }

  // Coloured smoke column (supply drops, airstrike markers).
  function smokeColumn(x, z, r, g, b, duration) {
    const e = { x, z, r, g, b, t: duration, acc: 0 };
    emitters.push(e);
    return e;
  }

  function update(dt) {
    for (const t of tracers) {
      if (!t.active) continue;
      t.head += t.speed * dt;
      const headD = Math.min(t.head, t.len);
      const tailD = Math.max(0, t.head - t.seg);
      if (tailD >= t.len) { t.active = false; t.mesh.visible = false; continue; }
      const segLen = headD - tailD;
      const mid = (headD + tailD) / 2;
      t.mesh.position.set(t.ax + t.dx * mid, t.ay + t.dy * mid, t.az + t.dz * mid);
      tmpV2.set(t.ax + t.dx * t.len, t.ay + t.dy * t.len, t.az + t.dz * t.len);
      t.mesh.lookAt(tmpV2);
      t.mesh.scale.set(1, 1, Math.max(0.05, segLen));
    }
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      b.t += dt;
      const k = b.t / 0.45;
      b.mesh.scale.setScalar(b.r * (0.3 + 0.9 * Math.min(1, k * 1.6)));
      b.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
      if (k >= 1) { scene.remove(b.mesh); b.mesh.material.dispose(); blasts.splice(i, 1); }
    }
    for (let i = emitters.length - 1; i >= 0; i--) {
      const e = emitters[i];
      e.t -= dt; e.acc += dt;
      while (e.acc > 0.08) {
        e.acc -= 0.08;
        smoke.emit(e.x + (Math.random() - 0.5) * 0.6, 0.4, e.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, 2.5 + Math.random(), (Math.random() - 0.5) * 0.8, e.r, e.g, e.b, 3.5, -0.2);
      }
      if (e.t <= 0) emitters.splice(i, 1);
    }
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 120);
    sparks.update(dt); dust.update(dt); smoke.update(dt);
  }

  function stopEmitter(e) { e.t = 0; }

  function clear() {
    for (const t of tracers) { t.active = false; t.mesh.visible = false; }
    for (const d of decals) d.visible = false;
    for (const b of blasts) scene.remove(b.mesh);
    blasts.length = 0; emitters.length = 0;
    sparks.n = dust.n = smoke.n = 0;
  }

  return { init, tracer, impact, explosion, muzzleFlash, smokeColumn, stopEmitter, update, clear, sparksEmit: (...a) => sparks.emit(...a) };
})();
