'use strict';
// Enemy soldiers: models, AI (advance via flow field, engage, strafe, snipe, grenade), hit detection.

const Enemies = (() => {
  let scene;
  const list = [];
  const geo = {}, mats = {};
  let nextId = 1;
  let flowT = 0, globalNadeCd = 0;
  const tmpBoxes = [], tmpDir = { x: 0, z: 0 };
  const playerChest = new THREE.Vector3();

  function init(sc) {
    scene = sc;
    geo.leg = new THREE.BoxGeometry(0.19, 0.86, 0.22); geo.leg.translate(0, -0.43, 0);
    geo.torso = new THREE.BoxGeometry(0.5, 0.62, 0.3);
    geo.vest = new THREE.BoxGeometry(0.54, 0.44, 0.36);
    geo.head = new THREE.BoxGeometry(0.24, 0.26, 0.25);
    geo.helmet = new THREE.BoxGeometry(0.3, 0.13, 0.31);
    geo.arm = new THREE.BoxGeometry(0.15, 0.15, 0.5);
    geo.gun = new THREE.BoxGeometry(0.07, 0.1, 0.7);
    geo.pack = new THREE.BoxGeometry(0.38, 0.4, 0.16);
    geo.marker = new THREE.OctahedronGeometry(0.22);
    geo.bar = new THREE.PlaneGeometry(0.9, 0.08);
    mats.skin = new THREE.MeshStandardMaterial({ color: 0xb08868, roughness: 0.9 });
    mats.dark = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.6, metalness: 0.4 });
    mats.visor = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 });
    mats.marker = new THREE.MeshBasicMaterial({ color: 0xffb627, depthTest: false, transparent: true });
    mats.barBg = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthTest: false });
    mats.barFg = new THREE.MeshBasicMaterial({ color: 0xff3b30, depthTest: false });
    mats.laser = new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  function typeMat(t, key, color) {
    const k = t + key;
    if (!mats[k]) mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: key === 'helm' && t === 'elite' ? 0.8 : 0.1 });
    return mats[k];
  }

  function buildModel(typeId) {
    const t = ENEMY_TYPES[typeId];
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const uni = typeMat(typeId, 'uni', t.color);
    const vestMat = typeMat(typeId, 'vest', new THREE.Color(t.color).multiplyScalar(0.6).getHex());
    const helm = typeMat(typeId, 'helm', t.helmet);
    const legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.set(-0.12, 0.88, 0); legR.position.set(0.12, 0.88, 0);
    legL.add(new THREE.Mesh(geo.leg, uni)); legR.add(new THREE.Mesh(geo.leg, uni));
    body.add(legL, legR);
    const torso = new THREE.Mesh(geo.torso, uni); torso.position.y = 1.2; body.add(torso);
    const vest = new THREE.Mesh(geo.vest, vestMat); vest.position.y = 1.25; body.add(vest);
    const pack = new THREE.Mesh(geo.pack, vestMat); pack.position.set(0, 1.25, 0.24); body.add(pack);
    const head = new THREE.Mesh(geo.head, mats.skin); head.position.y = 1.66; body.add(head);
    const helmet = new THREE.Mesh(geo.helmet, helm); helmet.position.y = 1.8; body.add(helmet);
    if (typeId === 'jugg' || typeId === 'heavy') {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.05), mats.visor);
      visor.position.set(0, 1.68, -0.14); body.add(visor);
    }
    const gun = new THREE.Mesh(geo.gun, mats.dark); gun.position.set(0.12, 1.32, -0.42); body.add(gun);
    const armR = new THREE.Mesh(geo.arm, uni); armR.position.set(0.24, 1.32, -0.2); armR.rotation.y = 0.2; body.add(armR);
    const armL = new THREE.Mesh(geo.arm, uni); armL.position.set(-0.08, 1.3, -0.3); armL.rotation.y = -0.6; body.add(armL);
    if (typeId === 'jugg') { gun.scale.set(2, 1.5, 1.2); }
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    const sc = t.scale || 1;
    root.scale.setScalar(sc);
    let marker = null;
    if (t.hvt || t.boss) {
      marker = new THREE.Mesh(geo.marker, mats.marker);
      marker.position.y = 2.35; marker.renderOrder = 10;
      root.add(marker);
    }
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(geo.bar, mats.barBg), fg = new THREE.Mesh(geo.bar, mats.barFg);
    bg.renderOrder = 11; fg.renderOrder = 12; fg.position.z = 0.001;
    bar.add(bg, fg); bar.position.y = 2.15; bar.visible = false;
    root.add(bar);
    return { root, body, legL, legR, gun, marker, bar, barFg: fg };
  }

  function spawn(typeId, x, z, opts = {}) {
    const t = ENEMY_TYPES[typeId];
    const wave = Game.wave || 1;
    const hpScale = (1 + 0.09 * (wave - 1)) * Game.difficulty.hp;
    const m = buildModel(typeId);
    const e = {
      id: nextId++, typeId, type: t, model: m,
      pos: new THREE.Vector3(x, opts.y || 0, z), yaw: 0,
      hp: t.hp * hpScale, maxHp: t.hp * hpScale,
      dmgScale: 1 + 0.035 * (wave - 1),
      perched: opts.y > 0.5,
      hasLOS: false, losT: 0, lastSeen: -99, lastKnown: new THREE.Vector3(),
      acquire: 0, reaction: (t.sniper ? 0 : 0.45 + Math.random() * 0.35) * Math.max(0.55, 1 - wave * 0.03),
      fireT: 0, burst: randInt(t.burst), pauseT: 0.5 + Math.random(), aimT: 0,
      strafe: Math.random() < 0.5 ? -1 : 1, strafeT: 1 + Math.random(),
      walk: Math.random() * 6, stuckT: 0, lastPos: new THREE.Vector3(x, 0, z), nudge: null,
      dead: false, deathT: 0, stun: 0, flinch: 0, reveal: 0, hpShow: 0, nadeCd: 4 + Math.random() * 4,
      spawnTime: Game.time, laser: null,
    };
    m.root.position.copy(e.pos);
    if (t.sniper) {
      e.laser = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), mats.laser.clone());
      e.laser.visible = false; e.laser.frustumCulled = false;
      scene.add(e.laser);
    }
    scene.add(m.root);
    list.push(e);
    return e;
  }

  function randInt([a, b]) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function rand([a, b]) { return a + Math.random() * (b - a); }

  function alive() { return list.filter(e => !e.dead); }
  function aliveCount() { let n = 0; for (const e of list) if (!e.dead) n++; return n; }

  // ---------- Hit detection ----------
  function rayHit(o, d, maxT) {
    let best = null;
    for (const e of list) {
      if (e.dead) continue;
      const sc = e.type.scale || 1;
      const cx = e.pos.x, cy = e.pos.y + 1.0 * sc, cz = e.pos.z;
      // coarse reject: distance from ray to enemy center
      const vx = cx - o.x, vy = cy - o.y, vz = cz - o.z;
      const tc = vx * d.x + vy * d.y + vz * d.z;
      if (tc < 0 || tc > maxT + 2) continue;
      const px = o.x + d.x * tc - cx, py = o.y + d.y * tc - cy, pz = o.z + d.z * tc - cz;
      if (px * px + py * py + pz * pz > 1.6 * sc * sc) continue;
      // head sphere
      const hy = e.pos.y + 1.7 * sc, hr = 0.17 * sc;
      const t = raySphere(o, d, cx, hy, cz, hr);
      if (t >= 0 && t < maxT && (!best || t < best.t)) best = { enemy: e, t, zone: 'head' };
      const tb = rayAabb(o, d, cx - 0.29 * sc, e.pos.y + 0.86 * sc, cz - 0.29 * sc, cx + 0.29 * sc, e.pos.y + 1.55 * sc, cz + 0.29 * sc);
      if (tb >= 0 && tb < maxT && (!best || tb < best.t)) best = { enemy: e, t: tb, zone: 'body' };
      const tl = rayAabb(o, d, cx - 0.24 * sc, e.pos.y, cz - 0.24 * sc, cx + 0.24 * sc, e.pos.y + 0.86 * sc, cz + 0.24 * sc);
      if (tl >= 0 && tl < maxT && (!best || tl < best.t)) best = { enemy: e, t: tl, zone: 'legs' };
    }
    return best;
  }
  function raySphere(o, d, cx, cy, cz, r) {
    const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
    const b = ox * d.x + oy * d.y + oz * d.z;
    const c = ox * ox + oy * oy + oz * oz - r * r;
    const h = b * b - c;
    if (h < 0) return -1;
    const t = -b - Math.sqrt(h);
    return t >= 0 ? t : -1;
  }
  function rayAabb(o, d, x0, y0, z0, x1, y1, z1) {
    let tmin = 0, tmax = 1e9;
    const ax = [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]];
    for (const [oo, dd, lo, hi] of ax) {
      if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return -1; continue; }
      let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
    return tmin;
  }

  function meleeTarget(o, fwd, range) {
    let best = null, bd = range;
    for (const e of list) {
      if (e.dead) continue;
      const dx = e.pos.x - o.x, dz = e.pos.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(e.pos.y - Player.P.pos.y) > 1.5) continue;
      if ((dx * fwd.x + dz * fwd.z) / (d || 1) < 0.55) continue;
      best = e; bd = d;
    }
    return best;
  }

  // ---------- Damage ----------
  function damage(e, dmg, info) {
    if (e.dead) return;
    if (!info.head && e.type.armor) dmg *= 1 - e.type.armor;
    e.hp -= dmg;
    e.hpShow = 3;
    e.flinch = 0.12;
    e.acquire = Math.max(e.acquire, e.reaction * 0.6);
    if (!info.explosive) {
      HUD.hitmarker(info.head, e.hp <= 0);
      if (info.x !== undefined) FX.impact(info.x, info.y, info.z, info.nx || 0, 0, info.nz || 0, 'blood');
    }
    if (info.x !== undefined && SAVE.settings.dmgNumbers) HUD.damageNumber(info.x, info.y + 0.3, info.z, dmg, info.head);
    if (e.hp <= 0) kill(e, info);
  }

  function kill(e, info) {
    e.dead = true; e.deathT = 0;
    e.deathDir = Math.random() < 0.5 ? 1 : -1;
    if (e.laser) e.laser.visible = false;
    if (e.model.marker) e.model.marker.visible = false;
    e.model.bar.visible = false;
    Game.onKill(e, info);
  }

  function explosion(x, y, z, radius, maxDmg, info) {
    for (const e of list) {
      if (e.dead) continue;
      const sc = e.type.scale || 1;
      const ex = e.pos.x, ey = e.pos.y + 1.0 * sc, ez = e.pos.z;
      const d = Math.hypot(ex - x, ey - y, ez - z);
      if (d > radius) continue;
      if (!World.lineOfSight(x, y + 0.4, z, ex, ey, ez)) continue;
      if (info.stun) e.stun = 2.5;
      if (maxDmg > 0) {
        const k = Math.max(0.25, Math.pow(1 - d / radius, 0.6));
        damage(e, maxDmg * k, { ...info, explosive: true, head: false, x: ex, y: ey, z: ez, dist: Math.hypot(ex - Player.P.pos.x, ez - Player.P.pos.z) });
      }
    }
  }

  // ---------- AI ----------
  function update(dt) {
    const P = Player.P;
    playerChest.set(P.pos.x, P.pos.y + P.height * 0.7, P.pos.z);
    flowT -= dt;
    if (flowT <= 0) { World.computeFlow(P.pos.x, P.pos.z); flowT = 0.3; }
    globalNadeCd = Math.max(0, globalNadeCd - dt);

    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.dead) { updateDead(e, dt, i); continue; }
      updateAlive(e, dt, P);
    }
    // separation
    for (let i = 0; i < list.length; i++) {
      const a = list[i]; if (a.dead || a.perched) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]; if (b.dead || b.perched) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.81 && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (0.9 - d) * 0.5;
          a.pos.x -= dx / d * push; a.pos.z -= dz / d * push;
          b.pos.x += dx / d * push; b.pos.z += dz / d * push;
        }
      }
    }
  }

  function updateDead(e, dt, i) {
    e.deathT += dt;
    const k = Math.min(1, e.deathT / 0.45);
    e.model.body.rotation.x = -k * k * 1.5 * e.deathDir;
    e.model.body.position.y = -k * 0.2;
    if (e.deathT > 4) e.model.root.position.y = e.pos.y - (e.deathT - 4) * 0.6;
    if (e.deathT > 5.5) {
      scene.remove(e.model.root);
      if (e.laser) scene.remove(e.laser);
      list.splice(i, 1);
    }
  }

  function updateAlive(e, dt, P) {
    const t = e.type, sc = t.scale || 1;
    e.reveal = Math.max(0, e.reveal - dt);
    e.hpShow = Math.max(0, e.hpShow - dt);
    e.flinch = Math.max(0, e.flinch - dt);
    e.nadeCd -= dt;
    const m = e.model;
    m.bar.visible = e.hpShow > 0;
    if (m.bar.visible) {
      m.bar.quaternion.copy(Game.camera.quaternion);
      const f = Math.max(0, e.hp / e.maxHp);
      m.barFg.scale.x = f; m.barFg.position.x = -(1 - f) * 0.45;
    }
    if (m.marker) { m.marker.rotation.y += dt * 2; m.marker.position.y = 2.35 + Math.sin(Game.time * 3) * 0.08; }

    if (e.stun > 0) { e.stun -= dt; m.body.rotation.z = Math.sin(Game.time * 12) * 0.08; syncModel(e); return; }
    m.body.rotation.z = 0;

    const ex = e.pos.x, ey = e.pos.y + 1.6 * sc, ez = e.pos.z;
    const dx = P.pos.x - ex, dz = P.pos.z - ez;
    const dist = Math.hypot(dx, dz, playerChest.y - ey);
    e.losT -= dt;
    if (e.losT <= 0) {
      e.losT = 0.12 + Math.random() * 0.1;
      e.hasLOS = dist < t.range * 1.5 && World.lineOfSight(ex, ey, ez, playerChest.x, playerChest.y, playerChest.z);
      if (!e.hasLOS && dist < t.range * 1.5) e.hasLOS = World.lineOfSight(ex, ey, ez, P.pos.x, P.pos.y + P.eye, P.pos.z);
    }
    if (P.downed > 0) e.hasLOS = false;
    if (e.hasLOS) { e.lastSeen = Game.time; e.lastKnown.copy(P.pos); }

    // ---- movement
    let mx = 0, mz = 0, spd = t.speed;
    const flat = Math.hypot(dx, dz) || 1;
    const engaged = e.hasLOS && dist < t.range;
    if (e.perched) {
      // stays put
    } else if (engaged) {
      if (e.typeId === 'rusher' || dist > t.prefer * 1.25) {
        if (World.flowDir(e.pos.x, e.pos.z, tmpDir)) { mx = tmpDir.x; mz = tmpDir.z; }
        else { mx = dx / flat; mz = dz / flat; }
        spd *= e.typeId === 'rusher' ? 0.95 : 0.6;
      } else if (dist < t.prefer * 0.55) {
        mx = -dx / flat; mz = -dz / flat; spd *= 0.5;
      } else {
        e.strafeT -= dt;
        if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = 1.2 + Math.random() * 1.5; }
        mx = -dz / flat * e.strafe; mz = dx / flat * e.strafe; spd *= 0.45;
      }
    } else if (World.flowDir(e.pos.x, e.pos.z, tmpDir)) {
      mx = tmpDir.x; mz = tmpDir.z;
      if (dist < 4) { mx = mz = 0; } // reached the player's cell (e.g. player on a roof) -> hold
    }
    if (e.nudge) { mx = e.nudge.x; mz = e.nudge.z; e.nudge.t -= dt; if (e.nudge.t <= 0) e.nudge = null; }
    if (e.flinch > 0) spd *= 0.3;
    // smooth heading
    e.vx = lerp(e.vx || 0, mx * spd, Math.min(1, dt * 8));
    e.vz = lerp(e.vz || 0, mz * spd, Math.min(1, dt * 8));
    if (!e.perched) moveEnemy(e, e.vx * dt, e.vz * dt);
    const moving = Math.hypot(e.vx, e.vz);

    // stuck detection
    e.stuckT += dt;
    if (e.stuckT > 1.5) {
      const moved = Math.hypot(e.pos.x - e.lastPos.x, e.pos.z - e.lastPos.z);
      if (moved < 0.4 && (mx || mz) && !engaged) { const a = Math.random() * Math.PI * 2; e.nudge = { x: Math.cos(a), z: Math.sin(a), t: 0.6 }; }
      e.lastPos.copy(e.pos); e.stuckT = 0;
    }

    // ---- facing
    let targetYaw;
    if (e.hasLOS) targetYaw = Math.atan2(-dx, -dz);
    else if (moving > 0.3) targetYaw = Math.atan2(-e.vx, -e.vz);
    else targetYaw = e.yaw;
    let dy = targetYaw - e.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    e.yaw += dy * Math.min(1, dt * 9);

    // ---- walking animation
    if (moving > 0.3) {
      e.walk += dt * moving * 2.4;
      const s = Math.sin(e.walk) * Math.min(1, moving / 3) * 0.6;
      m.legL.rotation.x = s; m.legR.rotation.x = -s;
    } else { m.legL.rotation.x *= 0.8; m.legR.rotation.x *= 0.8; }

    // ---- shooting
    if (engaged && Math.abs(dy) < 0.5) {
      if (t.sniper) sniperLogic(e, dt, dist, P);
      else {
        e.acquire += dt;
        if (e.acquire >= e.reaction) {
          if (e.pauseT > 0) e.pauseT -= dt;
          else {
            e.fireT -= dt;
            if (e.fireT <= 0) {
              shoot(e, dist, P);
              e.fireT = 60 / t.rpm;
              if (--e.burst <= 0) { e.burst = randInt(t.burst); e.pauseT = rand(t.pause); }
            }
          }
        }
      }
    } else {
      e.acquire = Math.max(0, e.acquire - dt * 1.5);
      if (e.laser) { e.laser.visible = false; e.aimT = Math.max(0, e.aimT - dt * 2); }
    }

    // ---- grenades: flush the player out of cover
    if (t.grenades && !e.hasLOS && e.nadeCd <= 0 && globalNadeCd <= 0) {
      const since = Game.time - e.lastSeen;
      const ld = Math.hypot(e.lastKnown.x - e.pos.x, e.lastKnown.z - e.pos.z);
      if (since > 1.5 && since < 6 && ld < 26 && ld > 6 && Math.random() < 0.5) throwNade(e);
      e.nadeCd = 6 + Math.random() * 6;
    }
    syncModel(e);
  }

  function syncModel(e) {
    e.model.root.position.copy(e.pos);
    e.model.root.rotation.y = e.yaw;
  }

  function moveEnemy(e, mx, mz) {
    const r = 0.36;
    e.pos.x += mx; e.pos.z += mz;
    World.queryBoxes(e.pos.x - 1, e.pos.z - 1, e.pos.x + 1, e.pos.z + 1, tmpBoxes);
    for (const b of tmpBoxes) {
      if (b.y1 < e.pos.y + 0.35 || b.y0 > e.pos.y + 1.7) continue;
      const cx = Math.max(b.x0, Math.min(e.pos.x, b.x1)), cz = Math.max(b.z0, Math.min(e.pos.z, b.z1));
      const ddx = e.pos.x - cx, ddz = e.pos.z - cz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2); e.pos.x += ddx / d * (r - d); e.pos.z += ddz / d * (r - d); }
        else { e.pos.x -= mx; e.pos.z -= mz; }
      }
    }
    const lim = World.HALF - 0.6;
    e.pos.x = Math.max(-lim, Math.min(lim, e.pos.x));
    e.pos.z = Math.max(-lim, Math.min(lim, e.pos.z));
  }

  const muzzle = new THREE.Vector3();
  function muzzlePos(e) {
    const sc = e.type.scale || 1;
    const s = Math.sin(e.yaw), c = Math.cos(e.yaw);
    // gun sits slightly right of center, 0.75m forward
    muzzle.set(e.pos.x + (0.12 * c - 0.77 * s) * sc, e.pos.y + 1.32 * sc, e.pos.z + (-0.12 * s - 0.77 * c) * sc);
    return muzzle;
  }

  function hitChance(e, dist, P) {
    const t = e.type;
    let c = t.accuracy * Game.difficulty.acc * (1 - Math.min(0.55, dist / t.range * 0.5));
    const hv = Math.hypot(P.vel.x, P.vel.z);
    if (P.sliding > 0) c *= 0.5;
    else if (hv > 6) c *= 0.65;
    else if (hv > 2) c *= 0.85;
    if (!P.onGround) c *= 0.7;
    if (P.crouching && P.sliding <= 0) c *= 0.85;
    if (e.flinch > 0) c *= 0.5;
    return Math.min(0.95, c);
  }

  function shoot(e, dist, P) {
    const mp = muzzlePos(e);
    const hit = Math.random() < hitChance(e, dist, P);
    const end = new THREE.Vector3();
    if (hit) end.set(playerChest.x + (Math.random() - 0.5) * 0.3, playerChest.y + (Math.random() - 0.5) * 0.4, playerChest.z + (Math.random() - 0.5) * 0.3);
    else {
      // near miss: offset perpendicular to the line of fire
      const a = Math.random() * Math.PI * 2, off = 0.5 + Math.random() * 1.2;
      end.set(P.pos.x + Math.cos(a) * off, P.pos.y + P.eye + (Math.random() - 0.4) * 1.2, P.pos.z + Math.sin(a) * off);
      // extend past the player
      end.sub(mp).multiplyScalar(1.8).add(mp);
    }
    const d = end.clone().sub(mp); const len = d.length(); d.divideScalar(len);
    const tw = World.raycast(mp.x, mp.y, mp.z, d.x, d.y, d.z, len);
    const blocked = tw < len - 0.3;
    const stop = blocked ? tw : len;
    FX.tracer(mp.x, mp.y, mp.z, mp.x + d.x * stop, mp.y + d.y * stop, mp.z + d.z * stop, 0xff8a5a, 300);
    FX.muzzleFlash(mp.x, mp.y, mp.z);
    Sound.enemyShot(dist, e.typeId === 'heavy' || e.typeId === 'jugg');
    e.reveal = 2;
    if (hit && !blocked) Player.damage(e.type.dmg * e.dmgScale, e.pos);
    else {
      if (blocked) FX.impact(mp.x + d.x * tw, mp.y + d.y * tw, mp.z + d.z * tw, -d.x, 0, -d.z, 'dust');
      if (dist < 40) Sound.whizz();
    }
  }

  function sniperLogic(e, dt, dist, P) {
    if (e.pauseT > 0) { e.pauseT -= dt; e.laser.visible = false; return; }
    e.aimT += dt;
    const mp = muzzlePos(e);
    // The beam points at the player's head but stops short so it doesn't smear across the camera.
    const head = new THREE.Vector3(P.pos.x, P.pos.y + P.eye - 0.1, P.pos.z);
    const full = mp.distanceTo(head);
    head.sub(mp).multiplyScalar(Math.max(0.1, (full - 2.5) / full)).add(mp);
    const len = mp.distanceTo(head);
    e.laser.visible = true;
    e.laser.position.copy(mp).add(head).multiplyScalar(0.5);
    e.laser.lookAt(head);
    e.laser.scale.set(1, 1, len);
    e.laser.material.opacity = 0.15 + 0.6 * Math.min(1, e.aimT / e.type.aimTime);
    HUD.sniperGlint(e);
    if (e.aimT >= e.type.aimTime) {
      shoot(e, dist, P);
      e.aimT = 0; e.pauseT = rand(e.type.pause); e.laser.visible = false;
    }
  }

  function throwNade(e) {
    globalNadeCd = 5;
    const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.6, e.pos.z);
    const to = e.lastKnown.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
    const flight = 1.3;
    const vel = new THREE.Vector3((to.x - from.x) / flight, 0, (to.z - from.z) / flight);
    vel.y = (to.y - from.y + 0.5 * 20 * flight * flight) / flight;
    Game.spawnGrenade(from, vel, 'enemy', 2.4);
  }

  function clear() {
    for (const e of list) { scene.remove(e.model.root); if (e.laser) scene.remove(e.laser); }
    list.length = 0;
  }

  return { init, spawn, update, rayHit, meleeTarget, damage, explosion, alive, aliveCount, list, clear };
})();
