'use strict';
// Input handling and the player: movement (sprint, slide, crouch, jump), aiming, shooting,
// recoil, reloads, grenades, melee, armor plates, and first-person viewmodel animation.

const Input = (() => {
  const keys = new Set(), pressed = new Set();
  let mdx = 0, mdy = 0, wheel = 0;
  const mouse = { left: false, right: false, leftPressed: false };
  let locked = false;
  window.addEventListener('keydown', e => {
    if (['Space', 'Tab', 'KeyF', 'KeyG'].includes(e.code) || (e.code.startsWith('Digit') && Game.state === 'playing')) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.left = mouse.right = false; });
  window.addEventListener('mousedown', e => {
    if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
    if (e.button === 2) mouse.right = true;
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  window.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('mousemove', e => {
    if (!locked) return;
    mdx += e.movementX || 0; mdy += e.movementY || 0;
  });
  window.addEventListener('wheel', e => { if (locked) wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement != null;
    if (!locked) { mouse.left = mouse.right = false; Game.onPointerUnlock(); }
  });
  return {
    keys, pressed, mouse,
    down: c => keys.has(c),
    hit: c => pressed.has(c),
    takeMouse() { const r = [mdx, mdy]; mdx = mdy = 0; return r; },
    takeWheel() { const w = wheel; wheel = 0; return w; },
    endFrame() { pressed.clear(); mouse.leftPressed = false; },
    get locked() { return locked; },
    set locked(v) { locked = v; },
  };
})();

const Player = (() => {
  const P = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    yaw: 0, pitch: 0, recoilPitch: 0, recoilYaw: 0, roll: 0,
    onGround: true, height: 1.8, eye: 1.62, eyeSmooth: 1.62,
    crouching: false, sliding: 0, slideCd: 0, slideDir: new THREE.Vector2(),
    sprinting: false, sprintOut: 0,
    health: 100, maxHealth: 100, armor: 100, maxArmor: 150, plates: 3, maxPlates: 6, plating: 0,
    grenades: 2, maxGrenades: 4, revives: 1, downed: 0,
    lastHit: 0, invuln: 0,
    weapons: [], cur: 0,
    fireCd: 0, burstHeld: false, reloadT: 0, reloadDur: 0, switchT: 0, adsT: 0, meleeT: 0, throwT: 0,
    kick: 0, shake: 0, landDip: 0, stepPhase: 0,
    buffs: { damage: 0, fireRate: 0, noReload: false },
    shotsFired: 0, shotsHit: 0, airTime: 0,
  };
  const HW = 0.32, STEP = 0.45, GRAV = 20;
  const tmpBoxes = [];
  let camera, vmCamera, vmScene, vmRoot, model = null;
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const vmSway = { x: 0, y: 0 };

  function init(cam, vmCam, vmSc) {
    camera = cam; vmCamera = vmCam; vmScene = vmSc;
    vmRoot = new THREE.Group();
    vmScene.add(vmRoot);
  }

  function reset(loadoutWeapons) {
    P.pos.set(0, 0, 30); P.vel.set(0, 0, 0);
    P.yaw = 0; P.pitch = 0; P.recoilPitch = P.recoilYaw = 0;
    P.health = 100; P.armor = 100; P.plates = 3; P.grenades = 2; P.revives = 1; P.downed = 0;
    P.crouching = false; P.sliding = 0; P.height = 1.8; P.eye = P.eyeSmooth = 1.62;
    P.weapons = loadoutWeapons; P.cur = 0;
    P.fireCd = P.reloadT = P.switchT = P.meleeT = P.throwT = P.plating = 0; P.adsT = 0;
    P.buffs = { damage: 0, fireRate: 0, noReload: false };
    P.shotsFired = P.shotsHit = 0; P.invuln = 0; P.lastHit = 0;
    rebuildModel();
  }

  function weapon() { return P.weapons[P.cur]; }
  function stats() { return computeStats(weapon(), P.buffs); }

  function rebuildModel() {
    if (model) { vmRoot.remove(model.group); model.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const w = weapon();
    if (!w) return;
    model = buildGunModel(w);
    addArms(model, w);
    vmRoot.add(model.group);
  }

  // ---------- Collision ----------
  function collides(x, y, z, h) {
    queryBoxesFor(x, z);
    for (const b of tmpBoxes) {
      if (x - HW < b.x1 && x + HW > b.x0 && y < b.y1 && y + h > b.y0 && z - HW < b.z1 && z + HW > b.z0) return b;
    }
    return null;
  }
  function queryBoxesFor(x, z) { World.queryBoxes(x - 1.5, z - 1.5, x + 1.5, z + 1.5, tmpBoxes); }

  function moveHoriz(axis, delta) {
    if (delta === 0) return;
    const p = P.pos;
    p[axis] += delta;
    const hit = collides(p.x, p.y, p.z, P.height);
    if (!hit) return;
    // Try stepping up onto low obstacles (stairs, curbs).
    if (P.onGround || P.sliding > 0) {
      const top = hit.y1;
      if (top - p.y <= STEP && top > p.y && !collides(p.x, top + 0.001, p.z, P.height)) {
        p.y = top + 0.001;
        return;
      }
    }
    p[axis] -= delta;
    // Slide flush against the face.
    const sgn = Math.sign(delta);
    let lo = 0, hi = Math.abs(delta);
    for (let i = 0; i < 5; i++) {
      const mid = (lo + hi) / 2;
      p[axis] += sgn * mid;
      if (collides(p.x, p.y, p.z, P.height)) hi = mid; else lo = mid;
      p[axis] -= sgn * mid;
    }
    p[axis] += sgn * lo;
    if (axis === 'x') P.vel.x = 0; else P.vel.z = 0;
  }

  function moveVert(delta) {
    const p = P.pos;
    p.y += delta;
    const hit = collides(p.x, p.y, p.z, P.height);
    if (hit) {
      if (delta < 0) { p.y = hit.y1 + 0.0005; if (!P.onGround && P.vel.y < -9) P.landDip = Math.min(1, -P.vel.y / 20); P.onGround = true; }
      else p.y = hit.y0 - P.height - 0.0005;
      P.vel.y = 0;
    } else if (delta < 0) {
      P.onGround = false;
    }
  }

  function setHeight(target) {
    if (target > P.height && collides(P.pos.x, P.pos.y, P.pos.z, target)) return false;
    P.height = target;
    return true;
  }

  // ---------- Update ----------
  function update(dt) {
    const w = weapon();
    const s = computeStats(w, P.buffs);
    const set = SAVE.settings;
    if (P.downed > 0) { updateDowned(dt); updateCamera(dt, s); updateViewmodel(dt, s, 0); return; }

    // Look
    const [mx, my] = Input.takeMouse();
    const adsZoomFov = adsFov(s);
    const fovRatio = lerp(1, adsZoomFov / baseFov(), P.adsT);
    const sens = 0.0022 * set.sens * lerp(1, set.adsSens * fovRatio, P.adsT);
    P.yaw -= mx * sens;
    P.pitch -= my * sens * (set.invertY ? -1 : 1);
    P.pitch = Math.max(-1.52, Math.min(1.52, P.pitch));
    vmSway.x = lerp(vmSway.x, Math.max(-1, Math.min(1, mx * 0.02)), Math.min(1, dt * 10));
    vmSway.y = lerp(vmSway.y, Math.max(-1, Math.min(1, my * 0.02)), Math.min(1, dt * 10));

    // Basis
    fwd.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));

    const kF = (Input.down('KeyW') ? 1 : 0) - (Input.down('KeyS') ? 1 : 0);
    const kR = (Input.down('KeyD') ? 1 : 0) - (Input.down('KeyA') ? 1 : 0);
    const wantAds = Input.mouse.right && P.plating <= 0 && P.meleeT <= 0;
    const busy = P.plating > 0 || P.throwT > 0 || P.meleeT > 0;

    // Sprint: hold Shift while moving forward; ADS or firing cancels.
    const wantSprint = Input.down('ShiftLeft') && kF > 0 && !wantAds && P.sliding <= 0 && !P.crouching;
    if (wantSprint && !P.sprinting) P.sprinting = true;
    if (!wantSprint) { if (P.sprinting) P.sprintOut = 0.14; P.sprinting = false; }
    P.sprintOut = Math.max(0, P.sprintOut - dt);

    // Crouch / slide
    P.slideCd = Math.max(0, P.slideCd - dt);
    const crouchPressed = Input.hit('KeyC');
    if (crouchPressed) {
      if (P.sprinting && P.onGround && P.slideCd <= 0) {
        P.sliding = 0.85; P.sprinting = false; P.slideCd = 1.0;
        const hv = Math.hypot(P.vel.x, P.vel.z) || 1;
        P.slideDir.set(P.vel.x / hv, P.vel.z / hv);
        const sp = Math.max(hv, 7) + 3.5;
        P.vel.x = P.slideDir.x * sp; P.vel.z = P.slideDir.y * sp;
        Sound.step(true);
      } else if (P.sliding <= 0) {
        P.crouching = !P.crouching;
      }
    }

    let targetH = 1.8;
    if (P.sliding > 0) {
      P.sliding -= dt;
      targetH = 0.95;
      if (P.sliding <= 0) { P.crouching = true; }
    } else if (P.crouching) targetH = 1.15;
    if (Input.hit('Space') && P.crouching && P.sliding <= 0) { if (setHeight(1.8)) P.crouching = false; }
    if (!setHeight(targetH)) { P.crouching = true; setHeight(1.15); }
    const eyeTarget = P.height - 0.18;

    // Horizontal movement
    let speed = 5.2 * s.speed;
    if (P.sprinting) speed = 7.6 * s.speed;
    else if (P.crouching) speed = 2.7 * s.speed;
    speed *= lerp(1, 0.55, P.adsT);
    if (P.plating > 0) speed *= 0.8;
    let wx = fwd.x * kF + right.x * kR, wz = fwd.z * kF + right.z * kR;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    if (P.sliding > 0) {
      // Momentum carries; steering is minimal and friction decays the slide.
      const sp = Math.hypot(P.vel.x, P.vel.z);
      const ns = Math.max(3, sp - dt * 9);
      const steer = 0.6 * dt;
      let dx = P.vel.x / (sp || 1) + wx * steer, dz = P.vel.z / (sp || 1) + wz * steer;
      const dl = Math.hypot(dx, dz) || 1;
      P.vel.x = dx / dl * ns; P.vel.z = dz / dl * ns;
    } else {
      const accel = P.onGround ? (wl > 0 ? 55 : 38) : 9;
      const tx = wx * speed, tz = wz * speed;
      P.vel.x = approach(P.vel.x, tx, accel * dt);
      P.vel.z = approach(P.vel.z, tz, accel * dt);
    }

    // Jump
    if (Input.hit('Space') && P.onGround && !P.crouching) {
      P.vel.y = 6.4; P.onGround = false;
      if (P.sliding > 0) { P.sliding = 0; } // slide-cancel keeps momentum
    }
    P.vel.y -= GRAV * dt;

    // Integrate with collision (sub-step for high speeds)
    const steps = Math.ceil(Math.max(Math.abs(P.vel.x), Math.abs(P.vel.z), Math.abs(P.vel.y)) * dt / 0.25) || 1;
    for (let i = 0; i < steps; i++) {
      moveHoriz('x', P.vel.x * dt / steps);
      moveHoriz('z', P.vel.z * dt / steps);
      moveVert(P.vel.y * dt / steps);
    }
    // keep inside the map
    const lim = World.HALF - 0.4;
    P.pos.x = Math.max(-lim, Math.min(lim, P.pos.x));
    P.pos.z = Math.max(-lim, Math.min(lim, P.pos.z));
    if (P.pos.y < -5) { P.pos.set(0, 0.5, 30); P.vel.set(0, 0, 0); }

    // Smooth eye height (stairs, crouch)
    P.eye = lerp(P.eye, eyeTarget, Math.min(1, dt * 14));
    const hv = Math.hypot(P.vel.x, P.vel.z);
    if (P.onGround && hv > 0.5 && P.sliding <= 0) {
      P.stepPhase += dt * hv * 1.9;
      if (Math.sin(P.stepPhase) > 0.95) Sound.step(P.sprinting);
    }

    // ADS
    const adsRate = 1 / Math.max(0.05, s.adsTime);
    const canAds = wantAds && !P.sprinting && P.switchT <= 0 && !busy;
    P.adsT = approach(P.adsT, canAds ? 1 : 0, adsRate * dt);

    // Weapon timers
    P.fireCd = Math.max(0, P.fireCd - dt);
    P.meleeT = Math.max(0, P.meleeT - dt);
    P.throwT = Math.max(0, P.throwT - dt);
    P.invuln = Math.max(0, P.invuln - dt);
    if (P.switchT > 0) {
      const before = P.switchT;
      P.switchT -= dt;
      if (before > 0.18 && P.switchT <= 0.18) rebuildModel();
    }
    if (P.reloadT > 0) {
      P.reloadT -= dt;
      if (P.reloadT <= 0) finishReload(s);
    }
    if (P.plating > 0) {
      P.plating -= dt;
      if (P.plating <= 0) {
        P.plates--; P.armor = Math.min(P.maxArmor, P.armor + 50);
        Sound.click(1200, 0.25);
        if (Input.down('KeyF') && P.plates > 0 && P.armor < P.maxArmor) P.plating = 0.8;
      }
    }

    // Regen (CoD-style): health refills after a short break from taking damage.
    if (Game.time - P.lastHit > 4 && P.health < P.maxHealth) P.health = Math.min(P.maxHealth, P.health + 35 * dt);

    handleActions(dt, s);
    updateCamera(dt, s);
    updateViewmodel(dt, s, hv);
  }

  function handleActions(dt, s) {
    const w = weapon();
    // Weapon swap
    const wh = Input.takeWheel();
    if ((Input.hit('Digit1') && P.cur !== 0) || (Input.hit('Digit2') && P.cur !== 1) || wh !== 0 || Input.hit('KeyQ')) {
      if (P.weapons.length > 1 && P.switchT <= 0) {
        P.cur = 1 - P.cur; P.switchT = 0.36; P.reloadT = 0; P.adsT *= 0.3;
        Sound.click(900, 0.15);
      }
    }
    // Reload
    if (Input.hit('KeyR')) startReload(s);
    // Armor plate
    if (Input.hit('KeyF') && P.plates > 0 && P.armor < P.maxArmor && P.plating <= 0) { P.plating = 0.8; P.reloadT = 0; Sound.click(700, 0.2); }
    // Grenade
    if (Input.hit('KeyG') && P.grenades > 0 && P.throwT <= 0 && P.switchT <= 0) throwGrenade();
    // Melee
    if (Input.hit('KeyV') && P.meleeT <= 0) melee();

    // Fire
    const blocked = P.switchT > 0 || P.plating > 0 || P.throwT > 0.2 || P.meleeT > 0.3;
    const trigger = s.auto ? Input.mouse.left : Input.mouse.leftPressed;
    if (trigger && !blocked) {
      if (P.sprinting) { P.sprinting = false; P.sprintOut = 0.12; }
      if (P.sprintOut <= 0 && P.fireCd <= 0) {
        if (P.reloadT > 0) {
          // Shotgun-style reload interruption is allowed if there's ammo
          if (w.ammo > 0 && s.cls === 'SG') P.reloadT = 0; else return;
        }
        if (w.ammo <= 0) {
          if (Input.mouse.leftPressed) Sound.dryFire();
          startReload(s);
          return;
        }
        fire(s);
      }
    }
    if (!Input.mouse.left) P.recoilHold = 0;
  }

  function startReload(s) {
    const w = weapon();
    if (P.reloadT > 0 || P.switchT > 0 || w.ammo >= s.mag || w.reserve <= 0 || P.buffs.noReload) return;
    P.reloadT = P.reloadDur = s.reload;
    Sound.reload(s.reload);
  }
  function finishReload(s) {
    const w = weapon();
    const need = s.mag - w.ammo;
    const take = Math.min(need, w.reserve);
    w.ammo += take; w.reserve -= take;
    P.reloadT = 0;
  }

  const shotO = new THREE.Vector3(), shotD = new THREE.Vector3(), hitInfo = {};
  function fire(s) {
    const w = weapon();
    P.fireCd = 60 / s.rpm;
    if (!P.buffs.noReload) w.ammo--;
    P.shotsFired++;
    P.recoilHold = (P.recoilHold || 0) + 1;
    Sound.gunshot(WEAPONS[w.wid].sound, s.suppressed);
    if (!s.suppressed) Game.playerFired();

    camera.getWorldPosition(shotO);
    const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    // Spread cone (degrees) from ADS state, movement and air time.
    const hv = Math.hypot(P.vel.x, P.vel.z);
    let spread = lerp(s.hip, s.adsSpread, P.adsT);
    spread += (hv / 7) * lerp(s.hip * 0.45, 0.4, P.adsT);
    if (!P.onGround) spread += 2.5;
    if (P.crouching && P.sliding <= 0) spread *= 0.85;
    if (s.pellets > 1) spread = lerp(s.hip, s.adsSpread, P.adsT);
    const spreadRad = spread * Math.PI / 180;

    // Muzzle position in the world for tracers.
    const muzzle = shotO.clone().addScaledVector(camFwd, 0.6).addScaledVector(camRight, lerp(0.16, 0.0, P.adsT)).addScaledVector(camUp, lerp(-0.13, -0.05, P.adsT));
    FX.muzzleFlash(muzzle.x, muzzle.y, muzzle.z);
    model && (model.flash = 0.05);

    let anyHit = false;
    for (let p = 0; p < s.pellets; p++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Math.tan(spreadRad);
      shotD.copy(camFwd).addScaledVector(camRight, Math.cos(a) * r).addScaledVector(camUp, Math.sin(a) * r).normalize();
      const maxRange = 400;
      const tWorld = World.raycast(shotO.x, shotO.y, shotO.z, shotD.x, shotD.y, shotD.z, maxRange, hitInfo);
      const eh = Enemies.rayHit(shotO, shotD, Math.min(tWorld, maxRange));
      const tEnd = eh ? eh.t : Math.min(tWorld, maxRange);
      const ex = shotO.x + shotD.x * tEnd, ey = shotO.y + shotD.y * tEnd, ez = shotO.z + shotD.z * tEnd;
      if (p === 0 && (P.shotsFired % 2 === 0 || s.pellets > 1 || s.rpm < 200)) FX.tracer(muzzle.x, muzzle.y, muzzle.z, ex, ey, ez);
      if (eh) {
        anyHit = true;
        const dist = eh.t;
        let fall = 1;
        if (dist > s.rangeStart) fall = dist >= s.rangeEnd ? s.minDmg : lerp(1, s.minDmg, (dist - s.rangeStart) / (s.rangeEnd - s.rangeStart));
        let dmg = s.damage * fall;
        const head = eh.zone === 'head';
        if (head) dmg *= Math.min(s.head, eh.enemy.type.headCap || 99);
        else if (eh.zone === 'legs') dmg *= 0.85;
        Enemies.damage(eh.enemy, dmg, { head, dist, cls: s.cls, wid: w.wid, slide: P.sliding > 0, x: ex, y: ey, z: ez, nx: -shotD.x, nz: -shotD.z });
        if (s.explosive > 0 && Math.random() * 100 < s.explosive) Game.explode(ex, ey, ez, 3.5, 90, { source: 'player', cls: s.cls, wid: w.wid, noSelf: true });
      } else if (tWorld < maxRange) {
        FX.impact(ex, ey, ez, hitInfo.nx, hitInfo.ny, hitInfo.nz, 'dust');
      }
    }
    if (anyHit) P.shotsHit++;

    // Recoil: half the kick is permanent (you pull down to control it), half recovers on its own.
    const adsK = lerp(1, 0.72, P.adsT) * (P.crouching ? 0.85 : 1);
    const v = s.recoilV * (0.85 + Math.random() * 0.3) * adsK * Math.PI / 180;
    const drift = Math.sin(P.recoilHold * 0.7) * 0.6 + (Math.random() - 0.5);
    const h = s.recoilH * drift * adsK * Math.PI / 180;
    P.pitch = Math.min(1.52, P.pitch + v * 0.5);
    P.recoilPitch += v * 0.5;
    P.yaw -= h * 0.6;
    P.recoilYaw += h * 0.4;
    P.kick = Math.min(1.5, P.kick + 0.6 + s.recoilV * 0.15);

    if (w.ammo <= 0 && w.reserve > 0 && !P.buffs.noReload) setTimeout(() => { if (weapon() === w && Game.state === 'playing') startReload(computeStats(w, P.buffs)); }, 180);
  }

  function throwGrenade() {
    P.grenades--; P.throwT = 0.55; P.reloadT = 0;
    const o = new THREE.Vector3(); camera.getWorldPosition(o);
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const vel = d.clone().multiplyScalar(17).add(new THREE.Vector3(0, 3.5, 0)).add(new THREE.Vector3(P.vel.x * 0.5, 0, P.vel.z * 0.5));
    Game.spawnGrenade(o.addScaledVector(d, 0.5), vel, 'player');
    Sound.click(500, 0.2);
  }

  function melee() {
    P.meleeT = 0.6; P.reloadT = 0;
    Sound.knife();
    const o = new THREE.Vector3(); camera.getWorldPosition(o);
    const target = Enemies.meleeTarget(o, fwd, 2.4);
    if (target) {
      setTimeout(() => {
        if (!target.dead) Enemies.damage(target, target.type.boss ? 250 : 400, { melee: true, head: false, dist: 1, cls: 'MELEE', x: target.pos.x, y: 1.2, z: target.pos.z, nx: fwd.x, nz: fwd.z });
      }, 90);
    }
  }

  function damage(amount, src) {
    if (P.downed > 0 || P.invuln > 0 || Game.state !== 'playing') return;
    amount *= Game.difficulty.dmg;
    P.lastHit = Game.time;
    if (P.armor > 0) {
      const had = P.armor;
      P.armor -= amount;
      Sound.armorHit();
      if (P.armor <= 0) { P.health += P.armor; P.armor = 0; Sound.armorBreak(); HUD.flash('armor'); }
      else if (had > 50 && P.armor <= 50) { /* plate broke */ }
    } else {
      P.health -= amount;
      Sound.hurt();
    }
    P.shake = Math.min(1, P.shake + amount * 0.02);
    if (src) HUD.damageFrom(src);
    HUD.flash('hit');
    if (P.health <= 0) down();
  }

  function down() {
    P.health = 0;
    Game.onPlayerDowned();
    if (P.revives > 0) {
      P.revives--;
      P.downed = 3.0;
      P.reloadT = 0; P.adsT = 0; P.sliding = 0;
    } else {
      Game.gameOver();
    }
  }
  function updateDowned(dt) {
    P.downed -= dt;
    P.eye = lerp(P.eye, 0.5, Math.min(1, dt * 5));
    if (P.downed <= 0) {
      P.downed = 0; P.health = 60; P.armor = Math.max(P.armor, 50); P.invuln = 2.5;
      HUD.toast('Self-revive used', '#ffb627');
      Game.explode(P.pos.x, 0.5, P.pos.z, 6, 0, { source: 'player', stun: true, noSelf: true });
    }
  }

  function heal(n) { P.health = Math.min(P.maxHealth, P.health + n); }

  // The FOV setting is horizontal (like most shooters); three.js cameras take vertical FOV.
  function baseFov() {
    const h = SAVE.settings.fov * Math.PI / 180;
    return 2 * Math.atan(Math.tan(h / 2) / camera.aspect) * 180 / Math.PI;
  }
  function adsFov(s) {
    const base = baseFov() * Math.PI / 180;
    return 2 * Math.atan(Math.tan(base / 2) / s.zoom) * 180 / Math.PI;
  }

  function updateCamera(dt, s) {
    // Recoil recovery
    if (P.fireCd <= 0 || !Input.mouse.left) {
      const k = Math.min(1, dt * 7);
      P.recoilPitch -= P.recoilPitch * k;
      P.recoilYaw -= P.recoilYaw * k;
    }
    P.kick = Math.max(0, P.kick - dt * 9);
    P.shake = Math.max(0, P.shake - dt * 2.5);
    P.landDip = Math.max(0, P.landDip - dt * 4);
    const targetRoll = P.sliding > 0 ? -0.07 : 0;
    P.roll = lerp(P.roll, targetRoll, Math.min(1, dt * 8));
    const shk = P.shake * 0.02 + Game.screenShake * 0.04;
    camera.position.set(P.pos.x, P.pos.y + P.eye - P.landDip * 0.12, P.pos.z);
    camera.rotation.set(P.pitch + P.recoilPitch + (Math.random() - 0.5) * shk, P.yaw + P.recoilYaw + (Math.random() - 0.5) * shk, P.roll, 'YXZ');
    // FOV: sprint/slide widen, ADS narrows by optic zoom.
    let fov = baseFov() + (P.sprinting ? 4 : 0) + (P.sliding > 0 ? 6 : 0);
    fov = lerp(fov, adsFov(s), easeInOut(P.adsT));
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 18)); camera.updateProjectionMatrix(); }
  }

  const vmPos = new THREE.Vector3(), vmRot = new THREE.Euler();
  function updateViewmodel(dt, s, hv) {
    if (!model) return;
    const g = model.group;
    const a = easeInOut(P.adsT);
    const scoped = s.reticle === 'scope';
    // Hip and ADS anchor points (ADS puts the sight line on the camera axis).
    vmPos.set(lerp(0.15, 0, a), lerp(-0.165, -model.sightY, a), lerp(-0.56, -0.42, a));
    vmRot.set(0, 0.035 * (1 - a), 0);
    // Movement bob
    const bobAmt = P.onGround && P.sliding <= 0 ? Math.min(1, hv / 7) * lerp(1, 0.15, a) : 0;
    vmPos.x += Math.cos(P.stepPhase * 0.5) * 0.012 * bobAmt;
    vmPos.y += Math.abs(Math.sin(P.stepPhase * 0.5)) * 0.014 * bobAmt;
    // Idle breathing
    vmPos.y += Math.sin(Game.time * 1.6) * 0.002 * (1 - a);
    // Sway from mouse
    vmPos.x -= vmSway.x * 0.012 * (1 - a * 0.8);
    vmPos.y += vmSway.y * 0.01 * (1 - a * 0.8);
    vmRot.y += vmSway.x * 0.05 * (1 - a * 0.8);
    // Sprint pose
    const sprintK = P.sprinting ? 1 : P.sprintOut / 0.14;
    sprintBlend = lerp(sprintBlend, sprintK, Math.min(1, dt * 12));
    vmPos.x += sprintBlend * 0.04; vmPos.y -= sprintBlend * 0.06;
    vmRot.y += sprintBlend * 0.7; vmRot.x -= sprintBlend * 0.25; vmRot.z += sprintBlend * 0.3;
    // Slide tilt
    if (P.sliding > 0) { vmRot.z += 0.25 * (1 - a); vmPos.x -= 0.03 * (1 - a); }
    // Recoil kick
    vmPos.z += P.kick * lerp(0.035, 0.02, a);
    vmRot.x += P.kick * lerp(0.07, 0.025, a);
    // Reload dip
    if (P.reloadT > 0) {
      const t = 1 - P.reloadT / P.reloadDur;
      const k = Math.sin(Math.min(1, t) * Math.PI);
      vmPos.y -= k * 0.08; vmRot.x -= k * 0.35; vmRot.z += k * 0.5;
      if (model.mag) model.mag.visible = !(t > 0.25 && t < 0.55);
    } else if (model.mag) model.mag.visible = true;
    // Switching
    if (P.switchT > 0) { const k = Math.sin((P.switchT / 0.36) * Math.PI); vmPos.y -= k * 0.25; vmRot.x -= k * 0.6; }
    // Plating / throwing / melee lower the gun
    if (P.plating > 0) { vmPos.y -= 0.18; vmRot.x -= 0.6; }
    if (P.throwT > 0) { const k = Math.sin((P.throwT / 0.55) * Math.PI); vmPos.y -= k * 0.2; vmRot.z -= k * 0.4; }
    if (P.meleeT > 0) { const k = Math.sin(Math.min(1, (0.6 - P.meleeT) / 0.3) * Math.PI); vmPos.x -= k * 0.12; vmPos.z -= k * 0.15; vmRot.y += k * 0.6; }
    if (P.downed > 0) { vmPos.y -= 0.3; }
    g.position.copy(vmPos);
    g.rotation.copy(vmRot);
    // Scoped weapons hide the model at full ADS (scope overlay takes over).
    g.visible = !(scoped && P.adsT > 0.85);
    if (model.laser) model.laser.visible = P.adsT < 0.5 && !P.sprinting;
    // Prismatic camo cycles hue.
    if (model.camo && model.camo.animated) model.bodyMat.color.setHSL((Game.time * 0.15) % 1, 0.7, 0.55);
    vmCamera.fov = lerp(62, 45, a * (s.zoom > 2 ? 1 : 0.4));
    vmCamera.updateProjectionMatrix();
  }
  let sprintBlend = 0;

  return { P, init, reset, update, weapon, stats, damage, heal, rebuildModel, startReload: () => startReload(stats()), adsFov, get model() { return model; } };
})();

function lerp(a, b, t) { return a + (b - a) * t; }
function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }
function easeInOut(t) { return t * t * (3 - 2 * t); }
