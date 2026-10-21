'use strict';
// Game director: renderer, main loop, waves, kills, kill streaks, field upgrades, contracts,
// challenges, explosives, sentries, and run start/end.

const Game = (() => {
  const G = {
    state: 'menu', time: 0, wave: 0, streak: 0, streakInv: {}, uavT: 0, overdriveT: 0,
    intermission: 0, contract: null, run: null, sentries: [], screenShake: 0,
    difficulty: DIFFICULTIES.regular, camera: null,
  };
  let renderer, scene, vmScene, vmCamera, sun;
  let spawnQueue = [], spawnT = 0, maxAlive = 8, waveActive = false;
  const grenades = [], strikes = [];
  let pendingUpgrade = 0, upgradeChoices = null;
  let last = performance.now();
  const TEST = /[?&]test\b/.test(location.search);
  let geoNade, matNade, sentryParts;

  // ---------- Setup ----------
  function init() {
    renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = SAVE.settings.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClear = false;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xc9a98a, 70, 280);
    scene.background = new THREE.Color(0xc9a98a);
    G.camera = new THREE.PerspectiveCamera(SAVE.settings.fov, window.innerWidth / window.innerHeight, 0.05, 1000);
    G.camera.rotation.order = 'YXZ';
    scene.add(G.camera);

    scene.add(new THREE.HemisphereLight(0xc8d6ea, 0x5a4a3a, 0.7));
    sun = new THREE.DirectionalLight(0xffe2bd, 1.05);
    sun.position.set(-50, 70, -60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 1; sc.far = 260;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    vmScene = new THREE.Scene();
    vmCamera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.01, 40);
    vmScene.add(new THREE.HemisphereLight(0xfff4e0, 0x404040, 0.95));
    const vl = new THREE.DirectionalLight(0xffffff, 0.75); vl.position.set(-1, 2, 1); vmScene.add(vl);

    World.init(scene);
    FX.init(scene);
    Enemies.init(scene);
    Loot.init(scene);
    Player.init(G.camera, vmCamera, vmScene);
    HUD.init();
    Menu.bind();
    buildKillstreakBar();

    geoNade = new THREE.SphereGeometry(0.09, 8, 6);
    matNade = new THREE.MeshStandardMaterial({ color: 0x3f4a2a, roughness: 0.6 });
    sentryParts = {
      leg: new THREE.BoxGeometry(0.06, 1.0, 0.06), body: new THREE.BoxGeometry(0.45, 0.32, 0.6),
      barrel: new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8),
      mat: new THREE.MeshStandardMaterial({ color: 0x3a4232, roughness: 0.6, metalness: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.5, metalness: 0.6 }),
      light: new THREE.MeshBasicMaterial({ color: 0x4fd16a }),
    };

    window.addEventListener('resize', onResize);
    $('game').addEventListener('click', () => {
      if (G.state === 'paused') resume();
      else if (G.state === 'playing' && !document.pointerLockElement) lockPointer();
    });
    document.addEventListener('pointerlockerror', onLockFailed);
    // Idle camera for the menu backdrop
    G.camera.position.set(30, 18, 50); G.camera.lookAt(0, 2, 0);
    Menu.main();
    requestAnimationFrame(frame);
    if (TEST) {
      Input.locked = true;
      // Test hook: advance the simulation without rendering (headless renderers are slow).
      const step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) { if (G.state === 'playing') update(dt); Input.endFrame(); } };
      window.TD = { Game: G, Player, Enemies, Loot, World, Input, Menu, start, chooseUpgrade, useStreak, startWave, step, render };
    }
  }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    G.camera.aspect = vmCamera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix(); vmCamera.updateProjectionMatrix();
  }

  function applySettings() {
    if (renderer.shadowMap.enabled !== SAVE.settings.shadows) {
      renderer.shadowMap.enabled = SAVE.settings.shadows;
      scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    }
  }

  function buildKillstreakBar() {
    $('streakbar').innerHTML = STREAKS.map(k => `<div class="ks" id="ks_${k.id}" title="${k.desc}"><kbd>${k.key}</kbd><b>${k.name}</b><small>${k.kills} kills</small><span class="cnt"></span></div>`).join('');
  }

  // ---------- Run lifecycle ----------
  function start() {
    Sound.init();
    G.difficulty = DIFFICULTIES[SAVE.difficulty];
    Enemies.clear(); Loot.clear(); FX.clear();
    for (const g of grenades) scene.remove(g.mesh); grenades.length = 0;
    for (const s of G.sentries) scene.remove(s.group); G.sentries.length = 0;
    strikes.length = 0;
    G.time = 0; G.wave = 0; G.streak = 0; G.streakInv = {}; G.uavT = 0; G.overdriveT = 0; G.contract = null;
    G.run = { kills: 0, headshots: 0, bestStreak: 0, crates: 0, contracts: 0, xp: 0, salvage: 0, bag: [], foundWeapons: [], challenges: [], secured: [] };
    const weapons = [Menu.loadoutInstance('primary'), Menu.loadoutInstance('secondary')];
    for (const w of weapons) for (const k in w.atts) w.atts[k].found = false;
    Player.reset(weapons);
    spawnQueue = []; waveActive = false; G.intermission = 6;
    pendingUpgrade = 0; upgradeChoices = null;
    // A few crates to loot from the start
    spawnCrates(3);
    Menu.screen(null);
    HUD.show(true);
    G.state = 'playing';
    HUD.banner('OPERATION TOP DAWG', 'Hold the compound. Loot everything. First wave inbound.', '#ffb627');
    lockPointer();
  }

  function lockPointer() {
    if (TEST) { Input.locked = true; return; }
    const c = $('game');
    try {
      const p = c.requestPointerLock();
      if (p && p.catch) p.catch(onLockFailed);
    } catch (e) { onLockFailed(); }
  }

  // Browsers refuse a re-lock for a moment after Esc; fall back to the pause screen.
  function onLockFailed() {
    if (G.state !== 'playing') return;
    G.state = 'paused';
    Menu.screen('pause');
    $('pausestats').innerHTML = pauseText() + '<br>Click Resume to take back mouse control.';
  }

  function onPointerUnlock() {
    if (G.state === 'playing') { G.state = 'paused'; Menu.screen('pause'); $('pausestats').innerHTML = pauseText(); }
  }
  function pauseText() {
    return `Wave ${G.wave} · ${G.run.kills} kills · streak ${G.streak} · ${G.run.bag.length} spare attachments`;
  }

  function resume() {
    Menu.screen(null);
    G.state = 'playing';
    lockPointer();
  }

  function quit() { endRun(true); }

  function gameOver() {
    G.state = 'over';
    HUD.banner('K.I.A.', 'No self-revives left', '#ff3b30');
    setTimeout(() => endRun(false), 1600);
  }

  function endRun(quitting) {
    if (!G.run) return;
    const r = G.run;
    G.state = 'menu';
    // Secure everything found this run into the Armory.
    const found = [...r.bag];
    for (const w of Player.P.weapons) for (const k in w.atts) if (w.atts[k] && w.atts[k].found) found.push(w.atts[k]);
    for (const a of found) { addToStash(a.aid, a.rarity); r.secured.push({ label: Loot.attLabel(a), rarity: a.rarity }); }
    for (const fw of r.foundWeapons) {
      const sw = SAVE.weapons[fw.wid];
      if (!SAVE.unlocked.includes(fw.wid)) { SAVE.unlocked.push(fw.wid); r.secured.push({ label: `Unlocked ${WEAPONS[fw.wid].name}`, rarity: fw.rarity }); }
      if (fw.rarity > sw.bestRarity) { sw.bestRarity = fw.rarity; r.secured.push({ label: `${RARITIES[fw.rarity].name} ${WEAPONS[fw.wid].name} blueprint`, rarity: fw.rarity }); }
    }
    SAVE.salvage += r.salvage;
    persist();
    if (!TEST && document.pointerLockElement) document.exitPointerLock();
    HUD.show(false);
    Menu.summary({ ...r, wave: G.wave, shots: Player.P.shotsFired, hits: Player.P.shotsHit, quit: quitting });
    G.run = null;
  }

  // ---------- Waves ----------
  function buildQueue(n) {
    const q = [];
    const total = Math.min(60, 8 + 4 * (n - 1));
    for (let i = 0; i < total; i++) {
      const w = { grunt: 60, rusher: n >= 2 ? 18 + n * 2 : 0, heavy: n >= 3 ? 6 + n : 0, sniper: n >= 4 ? 7 : 0 };
      let sum = 0; for (const k in w) sum += w[k];
      let r = Math.random() * sum, pick = 'grunt';
      for (const k in w) { r -= w[k]; if (r <= 0) { pick = k; break; } }
      q.push(pick);
    }
    if (n >= 2) q.splice(Math.floor(q.length * (0.3 + Math.random() * 0.4)), 0, 'elite');
    if (n % 5 === 0) q.splice(2, 0, 'jugg');
    return q;
  }

  function startWave(n) {
    G.wave = n;
    spawnQueue = buildQueue(n);
    maxAlive = Math.min(5 + n, 16);
    spawnT = 1;
    waveActive = true;
    G.intermission = 0;
    // Contract
    const hasHvt = spawnQueue.includes('elite');
    const pool = CONTRACTS.filter(c => !c.needsHvt || hasHvt);
    const def = pool[(Math.random() * pool.length) | 0];
    G.contract = { def, goal: def.goal(n), progress: 0, done: false, failed: false, hvtSeen: null };
    if (Loot.cratesRemaining() < 6) spawnCrates(n % 3 === 0 ? 3 : 2);
    Sound.wave(true);
    HUD.banner(`WAVE ${n}`, n % 5 === 0 ? 'JUGGERNAUT INBOUND' : `${spawnQueue.length} hostiles · Contract: ${def.name}`, n % 5 === 0 ? '#ff3b30' : '#fff');
  }

  function waveComplete() {
    waveActive = false;
    G.intermission = 22;
    statMax('bestWave', G.wave);
    const xp = 250 * G.wave;
    giveXp(xp, `WAVE ${G.wave} CLEARED +${xp}`);
    if (G.contract && !G.contract.done) G.contract.failed = true;
    Player.P.grenades = Math.min(Player.P.maxGrenades, Player.P.grenades + 1);
    for (const w of Player.P.weapons) w.reserve = Math.min(WEAPONS[w.wid].reserve * 1.5, w.reserve + WEAPONS[w.wid].reserve * 0.3);
    // Supply drop somewhere reachable
    const spot = World.crateSpots[(Math.random() * World.crateSpots.length) | 0];
    Loot.spawnCrate(spot.x + (Math.random() - 0.5) * 2, spot.z + (Math.random() - 0.5) * 2, 'drop');
    Sound.wave(false);
    HUD.banner('WAVE CLEARED', 'Supply drop inbound (red smoke) · Loot up, swap attachments with TAB', '#4fd16a');
    persist();
  }

  function spawnCrates(n) {
    const spots = World.crateSpots.slice().sort(() => Math.random() - 0.5);
    let made = 0;
    for (const s of spots) {
      if (made >= n) break;
      if (Loot.crates.some(c => Math.hypot(c.x - s.x, c.z - s.z) < 3)) continue;
      if (Math.hypot(s.x - Player.P.pos.x, s.z - Player.P.pos.z) < 8) continue;
      Loot.spawnCrate(s.x, s.z, 'crate'); made++;
    }
  }

  function pickSpawn(type) {
    const P = Player.P;
    if (type === 'sniper') {
      const free = World.perches.filter(p => Math.hypot(p.x - P.pos.x, p.z - P.pos.z) > 25 && !Enemies.list.some(e => !e.dead && e.perched && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 1.5));
      if (free.length) { const p = free[(Math.random() * free.length) | 0]; return { x: p.x, z: p.z, y: p.y }; }
    }
    const cands = World.spawnPoints.filter(s => Math.hypot(s.x - P.pos.x, s.z - P.pos.z) > 30);
    const hidden = cands.filter(s => !World.lineOfSight(s.x, 1.6, s.z, P.pos.x, P.pos.y + P.eye, P.pos.z));
    const list = hidden.length ? hidden : (cands.length ? cands : World.spawnPoints);
    const s = list[(Math.random() * list.length) | 0];
    return { x: s.x + (Math.random() - 0.5) * 2, z: s.z + (Math.random() - 0.5) * 2, y: 0 };
  }

  function enemiesRemaining() { return spawnQueue.length + Enemies.aliveCount(); }

  function updateWaves(dt) {
    if (!waveActive) {
      if (G.intermission > 0) {
        G.intermission -= dt;
        if (Input.hit('Enter') || Input.hit('NumpadEnter')) G.intermission = 0;
        if (G.intermission <= 0) startWave(G.wave + 1);
      }
      return;
    }
    spawnT -= dt;
    if (spawnQueue.length && spawnT <= 0 && Enemies.aliveCount() < maxAlive) {
      let type = spawnQueue.shift();
      const p = pickSpawn(type);
      if (type === 'sniper' && !p.y) type = 'grunt';
      const e = Enemies.spawn(type, p.x, p.z, { y: p.y });
      if (e.type.hvt) {
        if (G.contract && G.contract.def.id === 'hvt') G.contract.hvtSeen = G.time;
        HUD.toast('HVT Commander has entered the area · guaranteed Epic+ loot', '#ffb627');
      }
      if (e.type.boss) HUD.toast('JUGGERNAUT DEPLOYED · guaranteed Legendary loot', '#ff3b30', true);
      spawnT = 0.5 + Math.random() * 0.8;
    }
    if (!spawnQueue.length && Enemies.aliveCount() === 0) waveComplete();
    // HVT contract timer
    const c = G.contract;
    if (c && c.def.id === 'hvt' && c.hvtSeen !== null && !c.done && !c.failed && G.time - c.hvtSeen > 75) { c.failed = true; HUD.toast('Contract failed: HVT escaped the window', '#ff6b6b'); }
  }

  // ---------- Kills, streaks, XP ----------
  function giveXp(amount, label) {
    amount = Math.round(amount * G.difficulty.xp);
    G.run.xp += amount;
    const lv = addXp(amount);
    if (label) HUD.xpPopup(label);
    if (lv) { HUD.toast(`RANK UP · ${SAVE.level}`, '#ffb627', true); Sound.streak(); }
  }

  function onKill(e, info) {
    const r = G.run;
    if (!r) return;
    const fromStreak = info.source === 'streak';
    r.kills++;
    stat('kills', 1);
    const parts = [];
    let xp = e.type.xp;
    if (info.head) { xp += 50; r.headshots++; stat('headshots', 1); parts.push('HEADSHOT'); }
    if (info.dist >= 40 && !info.explosive && !fromStreak) { xp += 50; stat('longshots', 1); parts.push('LONGSHOT'); }
    if (info.melee) { xp += 75; stat('meleeKills', 1); parts.push('MELEE'); }
    if (info.slide) { xp += 25; stat('slideKills', 1); parts.push('SLIDE'); }
    if (info.explosive || fromStreak) stat('explosiveKills', 1);
    if (e.type.hvt || e.type.boss) { stat('hvtKills', 1); parts.push(e.type.boss ? 'JUGGERNAUT' : 'HVT'); }
    if (info.cls && WEAPONS[info.wid]) {
      stat('kills_' + info.cls, 1);
      const sw = SAVE.weapons[info.wid];
      const before = unlockedCamos(info.wid).length;
      const mBefore = weaponMastery(info.wid).level;
      sw.kills++; if (info.head) sw.headshots++;
      sw.xp += xp;
      if (unlockedCamos(info.wid).length > before) HUD.toast(`Camo unlocked · ${CAMOS[unlockedCamos(info.wid).pop()].name} for ${WEAPONS[info.wid].name}`, '#66e0ff');
      if (weaponMastery(info.wid).level > mBefore) HUD.toast(`${WEAPONS[info.wid].name} mastery ${weaponMastery(info.wid).level}`, '#b45cff');
      // Field upgrade perks on the gun that got the kill
      const w = Player.P.weapons.find(w => w.wid === info.wid);
      if (w) {
        const st = computeStats(w);
        if (st.lifesteal) Player.heal(st.lifesteal);
        if (st.scavenge) w.reserve += Math.ceil(st.mag * st.scavenge / 100);
      }
    }
    // Streak (killstreak-reward kills don't extend the streak)
    if (!fromStreak) {
      G.streak++;
      r.bestStreak = Math.max(r.bestStreak, G.streak);
      statMax('bestStreak', G.streak);
      if (G.streak >= 3) xp += Math.min(200, G.streak * 10);
      for (const k of STREAKS) {
        if (k.kills === G.streak) {
          G.streakInv[k.id] = (G.streakInv[k.id] || 0) + 1;
          HUD.toast(`${k.name} ready · press ${k.key}`, '#ffb627', true);
          Sound.streak();
        }
      }
      if (G.streak % FIELD_UPGRADE_EVERY === 0) pendingUpgrade++;
    }
    giveXp(xp, `+${Math.round(xp * G.difficulty.xp)} ${parts.join(' ') || 'KILL'}`);
    const wname = info.melee ? 'Knife' : info.source === 'streak' ? info.streakName || 'Killstreak' : info.explosive && info.cls === undefined ? 'Frag' : WEAPONS[info.wid] ? WEAPONS[info.wid].name : 'Frag';
    HUD.killfeed(`<b>YOU</b> <span>[${esc(wname)}]</span> <i class="${e.type.hvt || e.type.boss ? 'gold' : ''}">${e.type.name}</i>${info.head ? ' <em>✛</em>' : ''}${info.dist ? ` <small>${Math.round(info.dist)}m</small>` : ''}`);
    Sound.kill(info.head);
    // Contract progress
    const c = G.contract;
    if (c && !c.done && !c.failed) {
      const id = c.def.id;
      if ((id === 'headshots' && info.head) || (id === 'slide' && info.slide) || (id === 'longshot' && info.dist >= 35 && !info.explosive) ||
        (id === 'melee' && info.melee) || (id === 'grenade' && info.explosive && info.cls === undefined && !fromStreak) || (id === 'hvt' && e.type.hvt)) c.progress++;
      if (id === 'streak') c.progress = Math.max(c.progress, Math.min(c.goal, G.streak));
      if (c.progress >= c.goal) completeContract();
    }
    Loot.dropFromEnemy(e);
  }

  function completeContract() {
    const c = G.contract;
    c.done = true; c.progress = c.goal;
    G.run.contracts++;
    giveXp(500, `CONTRACT COMPLETE +500`);
    G.run.salvage += 30;
    const P = Player.P;
    const a = P.yaw;
    Loot.spawnCrate(P.pos.x - Math.sin(a) * 2.5, P.pos.z - Math.cos(a) * 2.5, 'contract');
    HUD.toast(`Contract complete: ${c.def.name} · Cache dropped nearby`, '#b45cff', true);
    Sound.streak();
  }

  function onPlayerDowned() {
    if (G.streak >= 3) HUD.toast(`Streak lost at ${G.streak}`, '#ff6b6b');
    G.streak = 0;
  }

  function onCrateOpened(c) {
    if (c.kind === 'crate' || c.kind === 'drop') { G.run.crates++; stat('crates', 1); }
  }

  function playerFired() { /* hook for future noise/alert systems */ }

  // ---------- Stats & challenges ----------
  function stat(name, amount) {
    SAVE.stats[name] = (SAVE.stats[name] || 0) + amount;
    checkChallenges(name);
  }
  function statMax(name, v) {
    if ((SAVE.stats[name] || 0) < v) { SAVE.stats[name] = v; checkChallenges(name); }
  }
  function checkChallenges(name) {
    for (const c of CHALLENGES) {
      if (c.stat !== name) continue;
      let claimed = SAVE.claimed[c.id] || 0;
      while (claimed < c.tiers.length && (SAVE.stats[name] || 0) >= c.tiers[claimed].goal) {
        const tier = c.tiers[claimed];
        claimed++;
        SAVE.claimed[c.id] = claimed;
        grantReward(tier.reward);
        const label = `${c.name} ${['I', 'II', 'III', 'IV'][claimed - 1]}`;
        if (G.run) G.run.challenges.push(`${label} — ${Menu.rewardText(tier.reward)}`);
        HUD.toast(`CHALLENGE COMPLETE · ${label}<br><small>${Menu.rewardText(tier.reward)}</small>`, '#4fd16a', true);
      }
    }
  }
  function grantReward(r) {
    if (r.xp) giveXp(r.xp);
    if (r.salvage) SAVE.salvage += r.salvage;
    if (r.unlock && !SAVE.unlocked.includes(r.unlock)) { SAVE.unlocked.push(r.unlock); HUD.toast(`Weapon unlocked · ${WEAPONS[r.unlock].name}`, '#ffb627', true); }
    if (r.att !== undefined) {
      const aid = ATTACHMENT_IDS[(Math.random() * ATTACHMENT_IDS.length) | 0];
      addToStash(aid, r.att);
      if (G.run) G.run.secured.push({ label: `${RARITIES[r.att].name} ${ATTACHMENTS[aid].name} (reward)`, rarity: r.att });
    }
  }

  // ---------- Field upgrades ----------
  function openUpgrade() {
    const pool = FIELD_UPGRADES.slice().sort(() => Math.random() - 0.5);
    const lk = 0.2 + G.streak * 0.04 + G.difficulty.luck;
    upgradeChoices = [];
    for (const def of pool) {
      if (upgradeChoices.length >= 3) break;
      const rarity = rollRarity(lk, def.minRarity || 0);
      const mult = 1 + 0.35 * rarity;
      upgradeChoices.push({ def, id: def.id, name: def.name, stat: def.stat, rarity, value: def.base * mult });
    }
    G.state = 'upgrade';
    Menu.fieldUpgrade(upgradeChoices);
    Sound.streak();
  }

  function chooseUpgrade(i) {
    if (G.state !== 'upgrade' || !upgradeChoices || !upgradeChoices[i]) return;
    const c = upgradeChoices[i];
    const w = Player.weapon();
    const before = computeStats(w).mag;
    w.upgrades.push({ id: c.id, name: c.name, stat: c.stat, value: c.value, rarity: c.rarity });
    const after = computeStats(w).mag;
    if (after > before) w.ammo += after - before;
    stat('fieldUpgrades', 1);
    upgradeChoices = null;
    pendingUpgrade--;
    Menu.screen(null);
    G.state = 'playing';
    if (!TEST && !document.pointerLockElement) lockPointer();
    HUD.toast(`${c.name} applied to ${WEAPONS[w.wid].name}`, RARITIES[c.rarity].color);
    Sound.pickup(c.rarity);
  }

  // ---------- Kill streak rewards ----------
  function useStreak(id) {
    if (!(G.streakInv[id] > 0)) return;
    const P = Player.P;
    const k = STREAKS.find(s => s.id === id);
    if (id === 'uav') { G.uavT = 30; }
    else if (id === 'overdrive') {
      G.overdriveT = 20;
      P.buffs = { damage: 0.25, fireRate: 0.35, noReload: true };
      for (const w of P.weapons) w.ammo = Math.max(w.ammo, computeStats(w).mag);
      P.reloadT = 0;
    } else if (id === 'airstrike') {
      const o = G.camera.position, d = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
      let t = World.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 150);
      if (!isFinite(t)) t = 60;
      const x = o.x + d.x * t, z = o.z + d.z * t;
      FX.smokeColumn(x, z, 0.9, 0.2, 0.15, 4);
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 8;
        strikes.push({ t: 1.6 + i * 0.28, x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, radius: 6, dmg: 300, name: k.name });
      }
      Sound.beep(660);
    } else if (id === 'sentry') {
      const d = 2;
      let x = P.pos.x - Math.sin(P.yaw) * d, z = P.pos.z - Math.cos(P.yaw) * d;
      if (!World.isFree(x, z)) { x = P.pos.x; z = P.pos.z; }
      spawnSentry(x, World.groundHeight(x, z, P.pos.y + 1), z);
    } else if (id === 'hellstorm') {
      for (const e of Enemies.alive()) strikes.push({ t: 0.4 + Math.random() * 1.4, target: e, radius: 4, dmg: 900, missile: true, name: k.name });
      G.screenShake = 0.5;
    }
    G.streakInv[id]--;
    HUD.toast(`${k.name} inbound`, '#ffb627');
    Sound.streak();
  }

  function spawnSentry(x, y, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(sentryParts.leg, sentryParts.dark);
      const a = i / 3 * Math.PI * 2;
      l.position.set(Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3);
      l.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      g.add(l);
    }
    const head = new THREE.Group(); head.position.y = 1.0; g.add(head);
    const body = new THREE.Mesh(sentryParts.body, sentryParts.mat); head.add(body);
    const barrel = new THREE.Mesh(sentryParts.barrel, sentryParts.dark); barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.5; head.add(barrel);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), sentryParts.light); lamp.position.set(0, 0.2, -0.1); head.add(lamp);
    g.position.set(x, y, z);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    G.sentries.push({ group: g, head, pos: g.position, t: 45, fireT: 0, target: null, scanT: 0 });
  }

  function updateSentries(dt) {
    for (let i = G.sentries.length - 1; i >= 0; i--) {
      const s = G.sentries[i];
      s.t -= dt; s.scanT -= dt; s.fireT -= dt;
      if (s.t <= 0) { scene.remove(s.group); G.sentries.splice(i, 1); continue; }
      const hx = s.pos.x, hy = s.pos.y + 1.0, hz = s.pos.z;
      if (s.scanT <= 0 || !s.target || s.target.dead) {
        s.scanT = 0.25; s.target = null;
        let bd = 40;
        for (const e of Enemies.list) {
          if (e.dead) continue;
          const d = Math.hypot(e.pos.x - hx, e.pos.z - hz);
          if (d < bd && World.lineOfSight(hx, hy, hz, e.pos.x, e.pos.y + 1.2, e.pos.z)) { bd = d; s.target = e; }
        }
      }
      if (s.target) {
        const e = s.target;
        const want = Math.atan2(-(e.pos.x - hx), -(e.pos.z - hz));
        let d = want - s.head.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        s.head.rotation.y += d * Math.min(1, dt * 10);
        if (Math.abs(d) < 0.2 && s.fireT <= 0) {
          s.fireT = 0.11;
          const sc = e.type.scale || 1;
          const ty = e.pos.y + 1.2 * sc;
          const mx = hx - Math.sin(s.head.rotation.y) * 0.8, mz = hz - Math.cos(s.head.rotation.y) * 0.8;
          FX.tracer(mx, hy, mz, e.pos.x, ty, e.pos.z, 0x9dff9d);
          FX.muzzleFlash(mx, hy, mz);
          Sound.enemyShot(Math.hypot(hx - Player.P.pos.x, hz - Player.P.pos.z) * 0.6, false);
          Enemies.damage(e, 24, { source: 'streak', streakName: 'Sentry Gun', head: false, dist: Math.hypot(e.pos.x - Player.P.pos.x, e.pos.z - Player.P.pos.z), x: e.pos.x, y: ty, z: e.pos.z });
        }
      }
    }
  }

  function updateStrikes(dt) {
    for (let i = strikes.length - 1; i >= 0; i--) {
      const s = strikes[i];
      s.t -= dt;
      if (s.missile && s.target && !s.trailed && s.t < 0.25) {
        s.trailed = true;
        const p = s.target.pos;
        FX.tracer(p.x + 20, 80, p.z + 10, p.x, p.y + 0.5, p.z, 0xffaa55, 320);
      }
      if (s.t <= 0) {
        const x = s.target ? s.target.pos.x : s.x, z = s.target ? s.target.pos.z : s.z;
        const y = s.target ? s.target.pos.y + 0.3 : World.groundHeight(x, z, 30) + 0.2;
        explode(x, y, z, s.radius, s.dmg, { source: 'streak', streakName: s.name, noSelf: true });
        strikes.splice(i, 1);
      }
    }
  }

  // ---------- Explosives ----------
  function spawnGrenade(pos, vel, owner, fuse = 2.3) {
    const mesh = new THREE.Mesh(geoNade, matNade);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    scene.add(mesh);
    grenades.push({ pos: mesh.position, vel: vel.clone(), fuse, owner, mesh });
  }

  const nadeHit = {};
  function updateGrenades(dt) {
    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i];
      g.fuse -= dt;
      g.vel.y -= 20 * dt;
      const sp = g.vel.length();
      if (sp > 0.01) {
        const step = sp * dt;
        const dx = g.vel.x / sp, dy = g.vel.y / sp, dz = g.vel.z / sp;
        const t = World.raycast(g.pos.x, g.pos.y, g.pos.z, dx, dy, dz, step + 0.09, nadeHit);
        if (t <= step + 0.09) {
          g.pos.x += dx * Math.max(0, t - 0.09); g.pos.y += dy * Math.max(0, t - 0.09); g.pos.z += dz * Math.max(0, t - 0.09);
          // reflect
          if (nadeHit.nx) g.vel.x *= -0.4; if (nadeHit.ny) g.vel.y *= -0.35; if (nadeHit.nz) g.vel.z *= -0.4;
          if (nadeHit.ny > 0) { g.vel.x *= 0.7; g.vel.z *= 0.7; if (Math.abs(g.vel.y) < 1.2) g.vel.y = 0; }
          if (sp > 3) Sound.click(400, 0.08);
        } else g.pos.addScaledVector(g.vel, dt);
      }
      g.mesh.rotation.x += dt * 8;
      if (g.fuse <= 0) {
        scene.remove(g.mesh);
        grenades.splice(i, 1);
        explode(g.pos.x, g.pos.y, g.pos.z, 7, g.owner === 'player' ? 240 : 85, { source: g.owner });
      }
    }
  }

  function nearestEnemyGrenade() {
    const P = Player.P;
    for (const g of grenades) if (g.owner === 'enemy' && Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z) < 9) return g;
    return null;
  }

  function explode(x, y, z, radius, dmg, info) {
    const P = Player.P;
    const pd = Math.hypot(P.pos.x - x, P.pos.y + 1 - y, P.pos.z - z);
    if (dmg > 0 || info.stun) {
      FX.explosion(x, y, z, radius * 0.5);
      Sound.explosion(pd);
      G.screenShake = Math.max(G.screenShake, Math.max(0, 1 - pd / (radius * 4)));
    }
    if (info.source !== 'enemy') Enemies.explosion(x, y, z, radius, dmg, info);
    // Player damage: enemy explosives, or your own frags (half damage)
    if (dmg > 0 && pd < radius && !info.noSelf && World.lineOfSight(x, y + 0.3, z, P.pos.x, P.pos.y + 1, P.pos.z)) {
      const k = Math.pow(1 - pd / radius, 0.8);
      Player.damage(dmg * k * (info.source === 'player' ? 0.5 : 1), { x, z });
    }
  }

  // ---------- Main loop ----------
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      if (G.state === 'playing') update(dt);
      else if (G.state === 'upgrade') {
        for (let i = 0; i < 3; i++) if (Input.hit('Digit' + (i + 1))) chooseUpgrade(i);
        Input.takeMouse();
      } else if (G.state === 'inventory') {
        if (Input.hit('Tab') || Input.hit('Escape') || Input.hit('KeyI')) resume();
      } else if (G.state === 'menu') {
        // slow orbit behind menus
        const a = now * 0.00004;
        G.camera.position.set(Math.cos(a) * 55, 22, Math.sin(a) * 55);
        G.camera.lookAt(0, 2, 0);
        G.camera.fov = 60; G.camera.updateProjectionMatrix();
      }
      render();
    } catch (err) {
      console.error(err);
    }
    Input.endFrame();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    G.time += dt;
    G.screenShake = Math.max(0, G.screenShake - dt * 1.5);
    Player.update(dt);
    Enemies.update(dt);
    Loot.update(dt);
    updateGrenades(dt);
    updateStrikes(dt);
    updateSentries(dt);
    updateWaves(dt);
    FX.update(dt);
    // streak timers
    if (G.uavT > 0) G.uavT -= dt;
    if (G.overdriveT > 0) { G.overdriveT -= dt; if (G.overdriveT <= 0) Player.P.buffs = { damage: 0, fireRate: 0, noReload: false }; }
    for (const k of STREAKS) if (Input.hit('Digit' + k.key)) useStreak(k.id);
    if (Input.hit('Tab') || Input.hit('KeyI')) {
      G.state = 'inventory';
      if (!TEST && document.pointerLockElement) document.exitPointerLock();
      Menu.inventory();
    }
    HUD.update(dt);
    if (pendingUpgrade > 0 && G.state === 'playing' && Player.P.downed <= 0) openUpgrade();
  }

  function render() {
    renderer.clear();
    renderer.render(scene, G.camera);
    if (G.state !== 'menu' && G.run) {
      renderer.clearDepth();
      renderer.render(vmScene, vmCamera);
    }
  }

  return Object.assign(G, {
    init, start, resume, quit, gameOver, onPointerUnlock, applySettings, onKill, onPlayerDowned, onCrateOpened,
    playerFired, stat, statMax, chooseUpgrade, useStreak, spawnGrenade, explode, nearestEnemyGrenade, enemiesRemaining, startWave,
  });
})();

window.addEventListener('load', () => Game.init());
