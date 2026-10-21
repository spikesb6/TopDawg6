'use strict';
// Weapon instances, final stat calculation, and procedural first-person gun models.

let RUN_UID = 1;

function createWeapon(wid, rarity = 0, atts = {}, camo = 'none') {
  const inst = { uid: 'w' + (RUN_UID++), wid, rarity, atts: {}, upgrades: [], camo, ammo: 0, reserve: 0 };
  for (const slot in atts) if (atts[slot]) inst.atts[slot] = { ...atts[slot] };
  const s = computeStats(inst);
  inst.ammo = s.mag;
  inst.reserve = WEAPONS[wid].reserve;
  return inst;
}

// Weapons found in the field come with attachments that roughly match their rarity.
function randomFieldWeapon(wid, rarity) {
  const inst = createWeapon(wid, rarity);
  const n = Math.min(WEAPONS[wid].slots.length, rarity + (Math.random() < 0.5 ? 1 : 0));
  const slots = WEAPONS[wid].slots.slice().sort(() => Math.random() - 0.5).slice(0, n);
  for (const slot of slots) {
    const fits = ATTACHMENT_IDS.filter(a => ATTACHMENTS[a].slot === slot && attachmentFits(a, wid));
    if (!fits.length) continue;
    const aid = fits[(Math.random() * fits.length) | 0];
    inst.atts[slot] = { aid, rarity: Math.max(0, Math.min(4, rarity - (Math.random() < 0.4 ? 1 : 0))) };
  }
  inst.ammo = computeStats(inst).mag;
  return inst;
}

function weaponLabel(inst) { return `${RARITIES[inst.rarity].name} ${WEAPONS[inst.wid].name}`; }

// buffs: { damage, fireRate, noReload } from Overdrive etc.
function computeStats(inst, buffs) {
  const b = WEAPONS[inst.wid], r = RARITIES[inst.rarity];
  const m = { damage: 0, fireRate: 0, mag: 0, reload: 0, adsTime: 0, range: 0, hipSpread: 0, adsSpread: 0, recoilV: 0, recoilH: 0, speed: 0, headMult: 0 };
  let zoom = b.zoom, reticle = b.model.scoped ? 'scope' : 'iron', suppressed = false, laser = false;
  for (const slot in inst.atts) {
    const a = inst.atts[slot];
    if (!a) continue;
    const def = ATTACHMENTS[a.aid];
    const mods = scaledMods(a.aid, a.rarity);
    for (const k in mods) m[k] += mods[k];
    if (def.zoom) { zoom = def.zoom; reticle = def.reticle; }
    if (def.suppressed) suppressed = true;
    if (def.laser) laser = true;
  }
  const extra = { lifesteal: 0, scavenge: 0, explosive: 0 };
  for (const u of inst.upgrades) {
    if (u.stat === 'recoil') { m.recoilV += u.value; m.recoilH += u.value; }
    else if (u.stat in m) m[u.stat] += u.value;
    else extra[u.stat] += u.value;
  }
  // Weapon mastery (persistent): small damage and reload bonuses per level.
  const mastery = SAVE.weapons[inst.wid] ? weaponMastery(inst.wid).level - 1 : 0;
  m.damage += mastery * 0.005;
  m.reload -= mastery * 0.004;
  const f = k => Math.max(0.2, 1 + m[k]);
  const s = {
    wid: inst.wid, cls: b.cls,
    damage: b.dmg * r.weaponDmg * f('damage'),
    rpm: b.rpm * f('fireRate'),
    auto: b.auto,
    mag: Math.max(1, Math.round(b.mag * f('mag'))),
    reload: b.reload * r.weaponReload * f('reload'),
    adsTime: b.ads * f('adsTime'),
    rangeStart: b.rangeStart * f('range'), rangeEnd: b.rangeEnd * f('range'),
    minDmg: b.minDmg,
    hip: b.hip * f('hipSpread'), adsSpread: b.adsSpread * f('adsSpread'),
    recoilV: b.recoilV * f('recoilV'), recoilH: b.recoilH * f('recoilH'),
    speed: b.speed * f('speed'),
    head: b.head * f('headMult'),
    pellets: b.pellets,
    zoom, reticle, suppressed, laser,
    lifesteal: extra.lifesteal, scavenge: extra.scavenge, explosive: extra.explosive,
  };
  if (buffs) {
    s.damage *= 1 + (buffs.damage || 0);
    s.rpm *= 1 + (buffs.fireRate || 0);
  }
  return s;
}

// ---------- First-person model ----------
function buildGunModel(inst) {
  const def = WEAPONS[inst.wid], md = def.model;
  const g = new THREE.Group();
  const camo = CAMOS[inst.camo] || CAMOS.none;
  const bodyMat = new THREE.MeshStandardMaterial({ color: camo.color || md.color, roughness: camo.metal ? 0.25 : 0.6, metalness: camo.metal ? 0.9 : 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.5, metalness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({ color: RARITIES[inst.rarity].hex, roughness: 0.4, metalness: 0.3, emissive: RARITIES[inst.rarity].hex, emissiveIntensity: inst.rarity >= 3 ? 0.35 : 0.1 });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.25 });
  const box = (w, h, d, x, y, z, mat = bodyMat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
  const cyl = (r, len, x, y, z, mat = darkMat, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); g.add(m); return m; };

  const L = md.len, H = md.bodyH;
  const pistol = def.cls === 'PI';
  const rl = pistol ? 0.2 : L * 0.42;
  const recvZ = -rl * 0.1;
  const out = { group: g, bodyMat, camo, sightY: 0.028, mag: null, muzzle: new THREE.Object3D(), laser: null };

  if (pistol) {
    box(0.034, 0.042, 0.2, 0, -0.021, -0.04);                 // slide
    box(0.03, 0.03, 0.16, 0, -0.055, -0.03, darkMat);          // frame
    const grip = box(0.03, 0.11, 0.045, 0, -0.11, 0.035, darkMat); grip.rotation.x = -0.2;
    box(0.036, 0.008, 0.06, 0, -0.002, -0.06, accentMat);
    out.mag = grip;
    box(0.006, 0.012, 0.008, 0, 0.004, -0.13, darkMat);        // front sight
    box(0.02, 0.01, 0.008, 0, 0.003, 0.05, darkMat);           // rear sight
    out.muzzle.position.set(0, -0.02, -0.15);
    out.sightY = 0.008;
  } else {
    box(0.06, H, rl, 0, -H / 2, recvZ);                                      // receiver
    box(0.062, 0.012, rl * 0.6, 0, 0.004, recvZ, darkMat);                   // top rail
    box(0.064, 0.01, rl * 0.3, 0, -H * 0.55, recvZ + rl * 0.1, accentMat);   // rarity stripe
    const hgLen = L * 0.26;
    const hgZ = recvZ - rl / 2 - hgLen / 2;
    box(0.055, H * 0.8, hgLen, 0, -H * 0.45, hgZ, darkMat);                  // handguard
    // barrel (modified by barrel attachments)
    const bar = inst.atts.barrel ? inst.atts.barrel.aid : null;
    let barLen = md.barrel + 0.05, barR = 0.012;
    if (bar === 'longbar') barLen += 0.12; if (bar === 'shortbar') barLen *= 0.55; if (bar === 'heavybar') barR = 0.018;
    const barStart = hgZ - hgLen / 2;
    cyl(barR, barLen + hgLen * 0.5, 0, -H * 0.3, barStart - barLen / 2 + hgLen * 0.25);
    let muzzleZ = barStart - barLen;
    // muzzle device
    const mz = inst.atts.muzzle ? inst.atts.muzzle.aid : null;
    if (mz === 'supp') { cyl(0.022, 0.16, 0, -H * 0.3, muzzleZ - 0.08, darkMat, 14); muzzleZ -= 0.16; }
    else if (mz === 'comp') { box(0.04, 0.04, 0.06, 0, -H * 0.3, muzzleZ - 0.03, darkMat); muzzleZ -= 0.06; }
    else if (mz === 'brake') { box(0.05, 0.03, 0.05, 0, -H * 0.3, muzzleZ - 0.025, darkMat); muzzleZ -= 0.05; }
    else if (mz === 'flash' || mz === 'choke') { cyl(0.018, 0.05, 0, -H * 0.3, muzzleZ - 0.025, darkMat, 6); muzzleZ -= 0.05; }
    out.muzzle.position.set(0, -H * 0.3, muzzleZ - 0.01);
    // magazine
    const mg = inst.atts.magazine ? inst.atts.magazine.aid : null;
    const magZ = recvZ - rl * 0.18;
    if (md.mag === 'tube') {
      cyl(0.014, hgLen + 0.1, 0, -H * 0.85, hgZ, darkMat);
      out.mag = box(0.05, 0.04, 0.05, 0, -H - 0.01, recvZ, darkMat);
    } else if (mg === 'drum' || md.mag === 'box') {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), darkMat);
      d.rotation.z = Math.PI / 2; d.position.set(0, -H - 0.06, magZ); g.add(d); out.mag = d;
    } else {
      const ml = (mg === 'extmag' ? 0.17 : 0.11) * (md.mag === 'curved' ? 1 : 0.9);
      const m = box(0.032, ml, 0.05, 0, -H - ml / 2 + 0.01, magZ, darkMat);
      if (md.mag === 'curved') m.rotation.x = 0.25;
      if (mg === 'fastmag') box(0.032, ml, 0.05, 0.034, -H - ml / 2 + 0.01, magZ, darkMat).rotation.x = m.rotation.x;
      if (mg === 'hpmag') box(0.034, 0.01, 0.052, 0, -H - ml + 0.02, magZ, accentMat);
      out.mag = m;
    }
    // pistol grip
    const grip = box(0.036, 0.1, 0.04, 0, -H - 0.04, recvZ + rl * 0.32, darkMat); grip.rotation.x = -0.35;
    // stock
    const st = inst.atts.stock ? inst.atts.stock.aid : null;
    if (md.stock === 'full' || st) {
      const sl = L * 0.3, sz = recvZ + rl / 2 + sl / 2;
      if (st === 'lightstock') { box(0.012, 0.012, sl, 0, -H * 0.3, sz, darkMat); box(0.012, 0.012, sl, 0, -H * 0.8, sz, darkMat); box(0.03, H, 0.02, 0, -H * 0.55, sz + sl / 2, darkMat); }
      else box(st === 'heavystock' ? 0.05 : 0.04, H * (st === 'heavystock' ? 1.15 : 0.9), sl, 0, -H * 0.55, sz, st ? darkMat : bodyMat);
    } else if (md.stock === 'folding') {
      box(0.012, 0.012, 0.16, 0.035, -H * 0.4, recvZ + rl / 2 + 0.08, darkMat);
    }
    // underbarrel
    const ub = inst.atts.underbarrel ? inst.atts.underbarrel.aid : null;
    if (ub === 'vgrip') box(0.028, 0.08, 0.03, 0, -H * 0.85 - 0.04, hgZ, darkMat);
    else if (ub === 'agrip') { const a = box(0.028, 0.03, 0.08, 0, -H * 0.85 - 0.02, hgZ + 0.02, darkMat); a.rotation.x = 0.4; }
    else if (ub === 'bipod') { box(0.008, 0.008, 0.14, 0.015, -H * 0.85, hgZ - 0.05, darkMat); box(0.008, 0.008, 0.14, -0.015, -H * 0.85, hgZ - 0.05, darkMat); }
    else if (ub === 'laser') {
      box(0.025, 0.025, 0.06, 0.035, -H * 0.5, hgZ - hgLen * 0.3, darkMat);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 30), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.position.set(0.035, -H * 0.5, hgZ - hgLen * 0.3 - 15);
      g.add(beam); out.laser = beam;
    }
    // iron sights
    if (!md.scoped && !inst.atts.optic) {
      box(0.006, 0.026, 0.008, 0, 0.014, hgZ - hgLen / 2 + 0.01, darkMat);
      box(0.026, 0.02, 0.01, 0, 0.012, recvZ + rl * 0.4, darkMat);
      box(0.006, 0.02, 0.01, -0.011, 0.02, recvZ + rl * 0.4, darkMat);
      box(0.006, 0.02, 0.01, 0.011, 0.02, recvZ + rl * 0.4, darkMat);
      out.sightY = 0.026;
    }
  }

  // optics
  const op = inst.atts.optic ? inst.atts.optic.aid : (md.scoped ? 'recon' : null);
  const oz = pistol ? -0.04 : recvZ;
  const top = pistol ? 0.0 : 0.009;
  if (op === 'reddot') {
    box(0.03, 0.012, 0.05, 0, top + 0.006, oz, darkMat);
    box(0.034, 0.03, 0.006, 0, top + 0.027, oz - 0.02, darkMat); box(0.034, 0.03, 0.006, 0, top + 0.027, oz + 0.015, darkMat);
    box(0.03, 0.026, 0.002, 0, top + 0.027, oz - 0.02, glassMat);
    out.sightY = top + 0.027;
  } else if (op === 'holo') {
    box(0.04, 0.014, 0.07, 0, top + 0.007, oz, darkMat);
    box(0.006, 0.04, 0.06, -0.02, top + 0.034, oz, darkMat); box(0.006, 0.04, 0.06, 0.02, top + 0.034, oz, darkMat);
    box(0.046, 0.006, 0.06, 0, top + 0.055, oz, darkMat);
    box(0.034, 0.034, 0.002, 0, top + 0.034, oz - 0.03, glassMat);
    out.sightY = top + 0.034;
  } else if (op === 'acog' || op === 'recon') {
    const len = op === 'recon' ? 0.26 : 0.14, r = op === 'recon' ? 0.022 : 0.02;
    box(0.02, 0.02, 0.05, 0, top + 0.01, oz, darkMat);
    cyl(r, len, 0, top + 0.04, oz - 0.01, darkMat, 14);
    if (op === 'recon') { cyl(r * 1.4, 0.05, 0, top + 0.04, oz - len / 2 - 0.01, darkMat, 14); cyl(r * 1.25, 0.04, 0, top + 0.04, oz + len / 2 - 0.02, darkMat, 14); }
    out.sightY = top + 0.04;
  }
  g.add(out.muzzle);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return out;
}

// Gloved hands/arms attached to the gun so they move with it.
function addArms(model, inst) {
  const g = model.group;
  const def = WEAPONS[inst.wid];
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.9 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x1e1f1c, roughness: 0.8 });
  const limb = (a, b, t, mat) => {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.lookAt(b);
    g.add(m);
  };
  const H = def.model.bodyH;
  const pistol = def.cls === 'PI';
  const rightHand = pistol ? new THREE.Vector3(0, -0.1, 0.04) : new THREE.Vector3(0, -H - 0.05, -def.model.len * 0.42 * 0.1 + def.model.len * 0.42 * 0.32);
  const leftHand = pistol ? new THREE.Vector3(-0.015, -0.11, 0.03) : new THREE.Vector3(-0.005, -H * 0.85, -def.model.len * 0.42 * 0.6 - def.model.len * 0.13);
  const hand = (p, s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.07), glove); m.position.copy(p); m.scale.setScalar(s); g.add(m); };
  hand(rightHand, 1);
  limb(rightHand.clone().add(new THREE.Vector3(0.01, -0.01, 0.03)), new THREE.Vector3(0.12, -0.2, 0.4), 0.065, sleeve);
  hand(leftHand, 1);
  limb(leftHand.clone().add(new THREE.Vector3(-0.01, -0.02, 0.02)), new THREE.Vector3(-0.2, -0.28, 0.3), 0.065, sleeve);
}
