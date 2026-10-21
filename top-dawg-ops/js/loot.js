'use strict';
// Loot: enemy drops, supply crates, supply drops, pickups and the in-run attachment bag.

const Loot = (() => {
  let scene;
  const items = [], crates = [];
  const geo = {}, mats = {};
  let interactHold = 0;

  function init(sc) {
    scene = sc;
    geo.small = new THREE.BoxGeometry(0.34, 0.22, 0.22);
    geo.plate = new THREE.BoxGeometry(0.32, 0.4, 0.06);
    geo.nade = new THREE.SphereGeometry(0.11, 10, 8);
    geo.att = new THREE.BoxGeometry(0.26, 0.18, 0.26);
    geo.weapon = new THREE.BoxGeometry(0.9, 0.14, 0.12);
    geo.beam = new THREE.CylinderGeometry(0.06, 0.12, 1, 8, 1, true); geo.beam.translate(0, 0.5, 0);
    geo.crate = new THREE.BoxGeometry(1.3, 0.75, 0.85);
    geo.lid = new THREE.BoxGeometry(1.34, 0.12, 0.89);
    geo.strip = new THREE.BoxGeometry(1.32, 0.06, 0.87);
    geo.chute = new THREE.SphereGeometry(2.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    mats.ammo = new THREE.MeshStandardMaterial({ color: 0x55603a, roughness: 0.7 });
    mats.plate = new THREE.MeshStandardMaterial({ color: 0x6f8aa6, roughness: 0.4, metalness: 0.5 });
    mats.nade = new THREE.MeshStandardMaterial({ color: 0x3f4a2a, roughness: 0.6 });
    mats.salvage = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.8, emissive: 0x3a2a00 });
    mats.revive = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, emissive: 0xaa1111, emissiveIntensity: 0.5 });
    mats.crate = new THREE.MeshStandardMaterial({ color: 0x46502f, roughness: 0.8 });
    mats.drop = new THREE.MeshStandardMaterial({ color: 0x2b3640, roughness: 0.6, metalness: 0.4 });
    mats.chute = new THREE.MeshStandardMaterial({ color: 0x8a7a55, roughness: 1, side: THREE.DoubleSide });
    for (const r of RARITIES) {
      mats['r' + r.id] = new THREE.MeshStandardMaterial({ color: r.hex, emissive: r.hex, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 });
      mats['beam' + r.id] = new THREE.MeshBasicMaterial({ color: r.hex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    }
  }

  function luck(extra = 0) {
    return Game.difficulty.luck + (Game.wave || 1) * 0.04 + Math.min(0.6, (Game.streak || 0) * 0.025) + extra;
  }

  // ---------- Item creation ----------
  function rollItem(lk, forceGear = false, minRarity = 0) {
    const r = Math.random();
    if (forceGear || r < 0.3) {
      const rarity = rollRarity(lk, minRarity);
      if (Math.random() < (forceGear ? 0.3 : 0.14)) {
        const wid = WEAPON_IDS[(Math.random() * WEAPON_IDS.length) | 0];
        return { type: 'weapon', inst: randomFieldWeapon(wid, rarity), rarity };
      }
      // Attachment that fits something the player has, most of the time.
      const owned = Player.P.weapons.map(w => w.wid);
      const wid = Math.random() < 0.75 ? owned[(Math.random() * owned.length) | 0] : WEAPON_IDS[(Math.random() * WEAPON_IDS.length) | 0];
      return { type: 'att', att: { aid: randomAttachmentFor(wid), rarity, found: true }, rarity };
    }
    if (r < 0.62) return { type: 'ammo', rarity: 0 };
    if (r < 0.8) return { type: 'plate', rarity: 0 };
    if (r < 0.88) return { type: 'grenade', rarity: 0 };
    if (r < 0.985) return { type: 'salvage', amount: 5 + Math.floor(Math.random() * 15), rarity: 0 };
    return { type: 'revive', rarity: 3 };
  }

  function spawnItem(item, x, y, z, burst = true) {
    let mesh;
    switch (item.type) {
      case 'ammo': mesh = new THREE.Mesh(geo.small, mats.ammo); break;
      case 'plate': mesh = new THREE.Mesh(geo.plate, mats.plate); break;
      case 'grenade': mesh = new THREE.Mesh(geo.nade, mats.nade); break;
      case 'salvage': mesh = new THREE.Mesh(geo.att, mats.salvage); mesh.scale.setScalar(0.7); break;
      case 'revive': mesh = new THREE.Mesh(geo.small, mats.revive); break;
      case 'att': mesh = new THREE.Mesh(geo.att, mats['r' + item.rarity]); break;
      case 'weapon': mesh = new THREE.Mesh(geo.weapon, mats['r' + item.rarity]); break;
    }
    const g = new THREE.Group();
    g.add(mesh);
    mesh.castShadow = true;
    if (item.type === 'att' || item.type === 'weapon' || item.type === 'revive') {
      const beam = new THREE.Mesh(geo.beam, mats['beam' + item.rarity]);
      beam.scale.y = RARITIES[item.rarity].beam;
      g.add(beam);
      item.beam = beam;
    }
    g.position.set(x, y, z);
    scene.add(g);
    item.group = g; item.mesh = mesh;
    item.pos = g.position;
    item.vel = burst ? new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 2, (Math.random() - 0.5) * 4) : new THREE.Vector3();
    item.ground = World.groundHeight(x, z, y + 0.5);
    item.age = 0; item.spin = Math.random() * 6;
    items.push(item);
    return item;
  }

  function dropFromEnemy(e) {
    const t = e.type;
    const x = e.pos.x, y = e.pos.y + 1, z = e.pos.z;
    if (Math.random() < 0.38) spawnItem({ type: 'ammo', rarity: 0 }, x, y, z);
    const lk = luck();
    if (t.minLoot) {
      spawnItem(rollItem(lk + 0.5, true, t.boss ? 4 : 3), x, y, z);
      for (let i = 1; i < t.minLoot; i++) spawnItem(rollItem(lk + 0.3, i === 1), x, y, z);
    } else if (Math.random() < t.loot * (1 + lk * 0.5)) {
      spawnItem(rollItem(lk), x, y, z);
    }
  }

  // ---------- Crates ----------
  function spawnCrate(x, z, kind = 'crate') {
    const g = new THREE.Group();
    const isDrop = kind === 'drop' || kind === 'contract';
    const body = new THREE.Mesh(geo.crate, isDrop ? mats.drop : mats.crate);
    body.position.y = 0.375; body.castShadow = true;
    const lid = new THREE.Mesh(geo.lid, isDrop ? mats.drop : mats.crate);
    lid.position.y = 0.81; lid.castShadow = true;
    const strip = new THREE.Mesh(geo.strip, mats[isDrop ? (kind === 'contract' ? 'r3' : 'r4') : 'r2']);
    strip.position.y = 0.55;
    g.add(body, lid, strip);
    const y = kind === 'drop' ? 55 : World.groundHeight(x, z, 10);
    g.position.set(x, y, z);
    g.rotation.y = Math.random() * Math.PI;
    let chute = null;
    if (kind === 'drop') {
      chute = new THREE.Mesh(geo.chute, mats.chute);
      chute.position.y = 4.5; g.add(chute);
    }
    scene.add(g);
    const c = { kind, group: g, lid, chute, x, z, ground: World.groundHeight(x, z, 10), opened: false, falling: kind === 'drop', age: 0, smoke: null };
    if (kind === 'drop') c.smoke = FX.smokeColumn(x, z, 0.85, 0.15, 0.1, 40);
    crates.push(c);
    return c;
  }

  function openCrate(c) {
    c.opened = true; c.age = 0;
    Sound.pickup(c.kind === 'crate' ? 2 : 4);
    if (c.smoke) FX.stopEmitter(c.smoke);
    const lk = luck(c.kind === 'crate' ? 0.2 : 0.8);
    const n = c.kind === 'crate' ? 3 : 4;
    const minR = c.kind === 'crate' ? 0 : 2;
    const x = c.x, y = c.ground + 1, z = c.z;
    spawnItem(rollItem(lk, true, minR), x, y, z);
    if (c.kind !== 'crate') spawnItem(rollItem(lk, true, minR), x, y, z);
    for (let i = c.kind === 'crate' ? 1 : 2; i < n; i++) spawnItem(rollItem(lk * 0.5), x, y, z);
    spawnItem({ type: 'ammo', rarity: 0 }, x, y, z);
    Game.onCrateOpened(c);
  }

  // ---------- Pickup logic ----------
  function collect(item) {
    const P = Player.P;
    switch (item.type) {
      case 'ammo': {
        for (const w of P.weapons) { const cap = WEAPONS[w.wid].reserve * 1.5; w.reserve = Math.min(cap, w.reserve + Math.ceil(WEAPONS[w.wid].reserve * 0.35)); }
        HUD.pickupToast('Ammo', '#d6cfa3'); Sound.click(1500, 0.15); break;
      }
      case 'plate': P.plates++; HUD.pickupToast('Armor plate', '#8fb3d9'); Sound.click(1100, 0.2); break;
      case 'grenade': P.grenades++; HUD.pickupToast('Frag grenade', '#9fb36a'); Sound.click(900, 0.2); break;
      case 'salvage': Game.run.salvage += item.amount; HUD.pickupToast(`+${item.amount} Salvage`, '#e0b84a'); Sound.pickup(1); break;
      case 'revive': P.revives++; HUD.pickupToast('Self-revive kit', '#ff6b6b'); Sound.pickup(3); break;
      case 'att': takeAttachment(item.att); break;
      case 'weapon': takeWeapon(item.inst); break;
    }
    if (item.rarity >= 4) Game.stat('legendaries', 1);
    removeItem(item);
  }

  function canAutoCollect(item) {
    const P = Player.P;
    if (item.type === 'ammo') return P.weapons.some(w => w.reserve < WEAPONS[w.wid].reserve * 1.5);
    if (item.type === 'plate') return P.plates < P.maxPlates;
    if (item.type === 'grenade') return P.grenades < P.maxGrenades;
    if (item.type === 'salvage') return true;
    if (item.type === 'revive') return P.revives < 2;
    return false;
  }

  function attLabel(a) { return `${RARITIES[a.rarity].name} ${ATTACHMENTS[a.aid].name}`; }

  function takeAttachment(att) {
    const P = Player.P;
    Sound.pickup(att.rarity);
    const order = [P.cur, 1 - P.cur].filter(i => P.weapons[i]);
    for (const i of order) {
      const w = P.weapons[i];
      if (!attachmentFits(att.aid, w.wid)) continue;
      const slot = ATTACHMENTS[att.aid].slot;
      const cur = w.atts[slot];
      if (!cur || att.rarity > cur.rarity) {
        if (cur) Game.run.bag.push(cur);
        equipAttachment(w, slot, att);
        HUD.pickupToast(`${attLabel(att)} → ${WEAPONS[w.wid].name}`, RARITIES[att.rarity].color);
        return;
      }
    }
    Game.run.bag.push(att);
    HUD.pickupToast(`${attLabel(att)} (bag)`, RARITIES[att.rarity].color);
  }

  function equipAttachment(w, slot, att) {
    const before = computeStats(w).mag;
    w.atts[slot] = att;
    const after = computeStats(w).mag;
    if (after < w.ammo) { w.reserve += w.ammo - after; w.ammo = after; }
    else if (after > before && w.ammo === before) w.ammo = after;
    if (w === Player.weapon()) Player.rebuildModel();
  }

  function takeWeapon(inst) {
    const P = Player.P;
    const old = P.weapons[P.cur];
    P.weapons[P.cur] = inst;
    inst.reserve = Math.max(inst.reserve, WEAPONS[inst.wid].reserve);
    Game.run.foundWeapons.push({ wid: inst.wid, rarity: inst.rarity });
    for (const k in inst.atts) inst.atts[k].found = true;
    Sound.pickup(inst.rarity);
    HUD.pickupToast(`Picked up ${weaponLabel(inst)}`, RARITIES[inst.rarity].color);
    P.switchT = 0.36; P.reloadT = 0;
    Player.rebuildModel();
    // Drop the old gun so it can be swapped back.
    const it = spawnItem({ type: 'weapon', inst: old, rarity: old.rarity, dropped: true }, P.pos.x, P.pos.y + 1, P.pos.z);
    it.vel.set(-Math.sin(P.yaw) * 2, 2, -Math.cos(P.yaw) * 2);
  }

  function removeItem(item) {
    scene.remove(item.group);
    const i = items.indexOf(item);
    if (i >= 0) items.splice(i, 1);
  }

  // What the player is looking at / standing next to.
  function findInteractable() {
    const P = Player.P;
    const cam = Game.camera;
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const o = cam.position;
    let best = null, bestScore = -1;
    for (const it of items) {
      if (it.type !== 'att' && it.type !== 'weapon') continue;
      if (it.age < 0.4) continue;
      const dx = it.pos.x - o.x, dy = it.pos.y - o.y, dz = it.pos.z - o.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 2.8) continue;
      const dot = (dx * d.x + dy * d.y + dz * d.z) / dist;
      const score = dot - dist * 0.1;
      if (dot > 0.5 && score > bestScore) { best = { kind: 'item', item: it }; bestScore = score; }
    }
    for (const c of crates) {
      if (c.opened || c.falling) continue;
      const dist = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
      if (dist < 2.4 && Math.abs(c.ground - P.pos.y) < 1.5) {
        const score = 2 - dist * 0.1;
        if (score > bestScore) { best = { kind: 'crate', crate: c }; bestScore = score; }
      }
    }
    return best;
  }

  function update(dt) {
    const P = Player.P;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.age += dt;
      // fall & settle
      if (it.vel.lengthSq() > 0 || it.pos.y > it.ground + 0.3) {
        it.vel.y -= 18 * dt;
        it.pos.addScaledVector(it.vel, dt);
        if (Math.abs(it.pos.x) > World.HALF - 1 || Math.abs(it.pos.z) > World.HALF - 1) { it.pos.x *= 0.98; it.pos.z *= 0.98; }
        it.ground = World.groundHeight(it.pos.x, it.pos.z, it.pos.y + 0.3);
        if (it.pos.y <= it.ground + 0.3) { it.pos.y = it.ground + 0.3; it.vel.set(0, 0, 0); }
      }
      it.spin += dt * 1.6;
      it.mesh.rotation.y = it.spin;
      it.mesh.position.y = Math.sin(it.spin * 1.4) * 0.06;
      // auto-collect consumables
      if (it.age > 0.5) {
        const d = Math.hypot(it.pos.x - P.pos.x, it.pos.z - P.pos.z);
        if (d < 1.7 && Math.abs(it.pos.y - (P.pos.y + 0.5)) < 1.5 && canAutoCollect(it)) { collect(it); continue; }
      }
      // despawn very old common stuff
      if (it.age > 90 && it.rarity < 2 && !it.dropped) removeItem(it);
    }
    for (let i = crates.length - 1; i >= 0; i--) {
      const c = crates[i];
      c.age += dt;
      if (c.falling) {
        c.group.position.y -= dt * 11;
        if (c.chute) c.chute.rotation.y += dt;
        if (c.group.position.y <= c.ground) {
          c.group.position.y = c.ground; c.falling = false;
          if (c.chute) { c.group.remove(c.chute); c.chute = null; }
          Sound.explosion(20); FX.sparksEmit(c.x, c.ground + 0.2, c.z, 0, 2, 0, 0.6, 0.5, 0.4, 0.5, 5);
        }
      }
      if (c.opened) {
        c.lid.position.y = Math.min(1.5, c.lid.position.y + dt * 3);
        c.lid.rotation.x = Math.min(1.2, c.lid.rotation.x + dt * 4);
        if (c.age > 25) { scene.remove(c.group); crates.splice(i, 1); }
      }
    }

    // Interaction (E): tap to pick up gear, hold to open crates.
    const target = Game.state === 'playing' && P.downed <= 0 ? findInteractable() : null;
    if (target && target.kind === 'crate') {
      if (Input.down('KeyE')) {
        interactHold += dt;
        if (interactHold >= 1.0) { openCrate(target.crate); interactHold = 0; }
      } else interactHold = 0;
      const label = { crate: 'Supply Crate', drop: 'Supply Drop', contract: 'Contract Cache' }[target.crate.kind];
      HUD.prompt(`Hold <b>E</b> to open ${label}`, interactHold / 1.0);
    } else {
      interactHold = 0;
      if (target && target.kind === 'item') {
        const it = target.item;
        if (it.type === 'att') {
          const a = it.att, def = ATTACHMENTS[a.aid];
          const fitsCur = attachmentFits(a.aid, Player.weapon().wid);
          HUD.prompt(`<b>E</b> pick up <span style="color:${RARITIES[a.rarity].color}">${attLabel(a)}</span><small>${SLOT_NAMES[def.slot]}${fitsCur ? '' : ' · does not fit current gun'} · ${modsText(scaledMods(a.aid, a.rarity))}</small>`);
        } else {
          HUD.prompt(`<b>E</b> swap for <span style="color:${RARITIES[it.rarity].color}">${weaponLabel(it.inst)}</span><small>${WEAPONS[it.inst.wid].clsName} · ${Object.keys(it.inst.atts).length} attachments${it.inst.upgrades.length ? ' · ' + it.inst.upgrades.length + ' field upgrades' : ''}</small>`);
        }
        if (Input.hit('KeyE')) collect(it);
      } else HUD.prompt(null);
    }
  }

  function modsText(mods) {
    return Object.keys(mods).map(k => {
      const v = mods[k];
      const good = Math.sign(v) === STAT_DIR[k];
      return `<span class="${good ? 'good' : 'bad'}">${v > 0 ? '+' : ''}${Math.round(v * 100)}% ${STAT_LABEL[k]}</span>`;
    }).join(' ');
  }

  function clear() {
    for (const it of items) scene.remove(it.group);
    for (const c of crates) scene.remove(c.group);
    items.length = 0; crates.length = 0;
  }

  function cratesRemaining() { return crates.filter(c => !c.opened).length; }

  return { init, update, spawnItem, rollItem, dropFromEnemy, spawnCrate, clear, items, crates, equipAttachment, attLabel, modsText, cratesRemaining };
})();
