'use strict';
// In-game HUD (DOM overlay + minimap canvas) and the menu screens.

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const HUD = (() => {
  let mm, mmc, lastPromptHtml = null;
  const numbers = [];
  const dmgArrows = [];
  let hitT = 0, killT = 0, headT = 0;
  let glintT = 0;

  function init() {
    mm = $('minimap'); mmc = mm.getContext('2d');
    for (let i = 0; i < 24; i++) {
      const d = document.createElement('div'); d.className = 'dmgnum'; $('hud').appendChild(d);
      numbers.push({ el: d, t: 0, x: 0, y: 0, z: 0 });
    }
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('div'); d.className = 'dmgdir'; $('dmgdirs').appendChild(d);
      dmgArrows.push({ el: d, t: 0, x: 0, z: 0 });
    }
  }

  function show(on) { $('hud').classList.toggle('hidden', !on); }

  // ---------- Feedback ----------
  function hitmarker(head, kill) {
    const el = $('hitmarker');
    el.className = 'hitmarker show' + (kill ? ' kill' : head ? ' head' : '');
    hitT = kill ? 0.3 : 0.14;
    Sound.hitmarker(head);
  }

  function damageNumber(x, y, z, dmg, head) {
    const n = numbers.find(n => n.t <= 0) || numbers[0];
    n.t = 0.8; n.x = x + (Math.random() - 0.5) * 0.3; n.y = y; n.z = z + (Math.random() - 0.5) * 0.3;
    n.el.textContent = Math.round(dmg);
    n.el.className = 'dmgnum' + (head ? ' head' : '');
  }

  function damageFrom(src) {
    const a = dmgArrows.find(a => a.t <= 0) || dmgArrows[0];
    a.t = 1.2; a.x = src.x; a.z = src.z;
  }

  function flash(kind) {
    const el = $(kind === 'armor' ? 'armorflash' : 'hitflash');
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  }

  function toast(text, color = '#fff', big = false) {
    const d = document.createElement('div');
    d.className = 'toast' + (big ? ' big' : '');
    d.style.color = color;
    d.innerHTML = text;
    $('toasts').appendChild(d);
    setTimeout(() => d.remove(), big ? 3500 : 2600);
  }

  function pickupToast(text, color) {
    const d = document.createElement('div');
    d.className = 'pickup';
    d.innerHTML = `<i style="background:${color}"></i>${esc(text)}`;
    $('pickups').prepend(d);
    while ($('pickups').children.length > 5) $('pickups').lastChild.remove();
    setTimeout(() => d.remove(), 3500);
  }

  function xpPopup(text) {
    const d = document.createElement('div');
    d.className = 'xppop'; d.textContent = text;
    $('xppops').prepend(d);
    while ($('xppops').children.length > 4) $('xppops').lastChild.remove();
    setTimeout(() => d.remove(), 1600);
  }

  function killfeed(html) {
    const d = document.createElement('div');
    d.className = 'kf'; d.innerHTML = html;
    $('killfeed').prepend(d);
    while ($('killfeed').children.length > 6) $('killfeed').lastChild.remove();
    setTimeout(() => d.remove(), 5000);
  }

  function banner(title, sub, color = '#fff') {
    const b = $('banner');
    b.innerHTML = `<div class="bt" style="color:${color}">${title}</div><div class="bs">${sub || ''}</div>`;
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  }

  function prompt(html, progress) {
    const el = $('prompt');
    if (!html) { if (lastPromptHtml !== null) { el.classList.add('hidden'); lastPromptHtml = null; } return; }
    if (html !== lastPromptHtml) { el.innerHTML = html + '<div class="pbar"><i></i></div>'; lastPromptHtml = html; el.classList.remove('hidden'); }
    el.querySelector('.pbar').style.display = progress !== undefined ? 'block' : 'none';
    if (progress !== undefined) el.querySelector('.pbar i').style.width = (progress * 100) + '%';
  }

  function sniperGlint() { glintT = 0.25; }

  // ---------- Per-frame ----------
  const proj = new THREE.Vector3();
  function update(dt) {
    const P = Player.P, w = Player.weapon(), s = Player.stats(), cam = Game.camera;
    // Health & armor
    $('hpfill').style.width = (P.health / P.maxHealth * 100) + '%';
    $('hpfill').classList.toggle('low', P.health < 35);
    for (let i = 0; i < 3; i++) {
      const seg = Math.max(0, Math.min(50, P.armor - i * 50)) / 50;
      $('ap' + i).style.width = (seg * 100) + '%';
    }
    $('plates').textContent = P.plates;
    $('nades').textContent = P.grenades;
    $('revives').textContent = P.revives;
    // Ammo
    $('ammo').textContent = P.buffs.noReload ? '∞' : w.ammo;
    $('ammo').classList.toggle('low', w.ammo <= Math.ceil(s.mag * 0.25));
    $('reserve').textContent = Math.floor(w.reserve);
    $('wname').textContent = WEAPONS[w.wid].name;
    $('wname').style.color = RARITIES[w.rarity].color;
    $('wrarity').textContent = RARITIES[w.rarity].name + (w.upgrades.length ? ` · ${w.upgrades.length} upgrade${w.upgrades.length > 1 ? 's' : ''}` : '');
    const other = P.weapons[1 - P.cur];
    $('wother').textContent = other ? `[Q] ${WEAPONS[other.wid].name}` : '';
    const noAmmo = w.ammo === 0 && w.reserve <= 0;
    const lowAmmo = w.ammo <= s.mag * 0.25 && w.reserve > 0;
    $('reloadhint').classList.toggle('hidden', P.reloadT > 0 || P.buffs.noReload || !(noAmmo || lowAmmo));
    $('reloadhint').textContent = noAmmo ? 'NO AMMO · SWITCH WEAPONS' : 'R  RELOAD';
    $('reloadbar').style.display = P.reloadT > 0 ? 'block' : 'none';
    if (P.reloadT > 0) $('reloadbar').firstElementChild.style.width = ((1 - P.reloadT / P.reloadDur) * 100) + '%';

    // Streak
    $('streaknum').textContent = Game.streak;
    const next = STREAKS.find(k => k.kills > Game.streak);
    const nextFU = (Math.floor(Game.streak / FIELD_UPGRADE_EVERY) + 1) * FIELD_UPGRADE_EVERY;
    $('streaknext').innerHTML = (next ? `${next.name} in ${next.kills - Game.streak}` : 'All streaks earned') + ` · Upgrade in ${nextFU - Game.streak}`;
    const luckPct = Math.round(Math.min(0.6, Game.streak * 0.025) * 100);
    $('streakluck').textContent = luckPct ? `Hot streak: +${luckPct}% loot luck` : '';
    for (const k of STREAKS) {
      const el = $('ks_' + k.id);
      el.classList.toggle('ready', (Game.streakInv[k.id] || 0) > 0);
      el.querySelector('.cnt').textContent = Game.streakInv[k.id] > 1 ? 'x' + Game.streakInv[k.id] : '';
      el.classList.toggle('active', (k.id === 'uav' && Game.uavT > 0) || (k.id === 'overdrive' && Game.overdriveT > 0));
    }
    // Wave
    $('wave').textContent = Game.wave;
    $('enemiesleft').textContent = Game.intermission > 0 ? `Next wave in ${Math.ceil(Game.intermission)}s · ENTER to skip` : `${Game.enemiesRemaining()} hostiles remaining`;
    // Contract
    const c = Game.contract;
    if (c) {
      $('contract').classList.remove('hidden');
      $('contract').classList.toggle('done', c.done);
      $('contract').classList.toggle('failed', c.failed);
      $('ctitle').textContent = 'CONTRACT · ' + c.def.name;
      $('ctext').textContent = c.def.text(c.goal) + (c.done ? ' — complete' : c.failed ? ' — failed' : ` (${c.progress}/${c.goal})`);
    } else $('contract').classList.add('hidden');

    // Crosshair spread
    const hv = Math.hypot(P.vel.x, P.vel.z);
    let spread = lerp(s.hip, s.adsSpread, P.adsT) + hv / 7 * s.hip * 0.45 * (1 - P.adsT) + (P.onGround ? 0 : 2.5);
    const px = Math.tan(spread * Math.PI / 180) / Math.tan(cam.fov * Math.PI / 360) * (window.innerHeight / 2);
    const gap = Math.max(4, px) + P.kick * 6;
    const ch = $('crosshair');
    ch.style.setProperty('--gap', gap + 'px');
    ch.style.opacity = P.adsT > 0.5 || P.sprinting || P.downed > 0 ? 0 : 1;
    // ADS reticles
    const ret = $('reticle');
    const showRet = P.adsT > 0.8 && s.reticle !== 'iron' && s.reticle !== 'scope';
    ret.className = 'reticle ' + (showRet ? s.reticle : 'hidden');
    $('scope').classList.toggle('hidden', !(s.reticle === 'scope' && P.adsT > 0.85));
    // Hitmarker decay
    hitT -= dt; if (hitT <= 0) $('hitmarker').className = 'hitmarker';
    // Damage numbers
    for (const n of numbers) {
      if (n.t <= 0) { n.el.style.display = 'none'; continue; }
      n.t -= dt; n.y += dt * 0.9;
      proj.set(n.x, n.y, n.z).project(cam);
      if (proj.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = 'block';
      n.el.style.transform = `translate(${(proj.x * 0.5 + 0.5) * window.innerWidth}px, ${(-proj.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%,-50%) scale(${0.8 + n.t * 0.4})`;
      n.el.style.opacity = Math.min(1, n.t * 3);
    }
    // Damage direction arrows
    for (const a of dmgArrows) {
      if (a.t <= 0) { a.el.style.opacity = 0; continue; }
      a.t -= dt;
      const ang = Math.atan2(a.x - P.pos.x, a.z - P.pos.z);
      const rel = ang - (P.yaw + Math.PI);
      a.el.style.opacity = Math.min(1, a.t * 1.5);
      a.el.style.transform = `translate(-50%,-50%) rotate(${-rel}rad) translateY(-150px)`;
    }
    // Overlays
    const hpK = 1 - P.health / P.maxHealth;
    $('vignette').style.opacity = Math.max(0, hpK * 1.2 - 0.15);
    $('downed').classList.toggle('hidden', P.downed <= 0);
    if (P.downed > 0) $('downedt').textContent = `Self-reviving… ${P.downed.toFixed(1)}s`;
    $('overdrive').classList.toggle('hidden', Game.overdriveT <= 0);
    glintT -= dt;
    $('glint').classList.toggle('on', glintT > 0);
    $('platebar').style.display = P.plating > 0 ? 'block' : 'none';
    if (P.plating > 0) $('platebar').firstElementChild.style.width = ((1 - P.plating / 0.8) * 100) + '%';
    // grenade warning
    const ng = Game.nearestEnemyGrenade();
    $('nadewarn').classList.toggle('hidden', !ng);
    if (ng) {
      const ang = Math.atan2(ng.pos.x - P.pos.x, ng.pos.z - P.pos.z) - (P.yaw + Math.PI);
      $('nadewarn').style.transform = `translate(-50%,-50%) rotate(${-ang}rad) translateY(-90px) rotate(${ang}rad)`;
    }
    drawMinimap();
  }

  function drawMinimap() {
    const P = Player.P;
    const W = mm.width, H = mm.height, R = 45; // meters visible radius
    const sc = (W / 2) / R;
    mmc.save();
    mmc.clearRect(0, 0, W, H);
    mmc.fillStyle = 'rgba(14,18,16,0.82)';
    mmc.beginPath(); mmc.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2); mmc.fill();
    mmc.clip();
    mmc.translate(W / 2, H / 2);
    mmc.rotate(P.yaw);
    mmc.translate(-P.pos.x * sc, -P.pos.z * sc);
    // map boxes
    mmc.fillStyle = 'rgba(160,170,150,0.45)';
    for (const b of World.boxes) {
      if (b.y1 < 0.5 || b.y0 > 3 || b.x1 - b.x0 > 100) continue;
      if (Math.abs((b.x0 + b.x1) / 2 - P.pos.x) > R + 15 || Math.abs((b.z0 + b.z1) / 2 - P.pos.z) > R + 15) continue;
      mmc.fillRect(b.x0 * sc, b.z0 * sc, (b.x1 - b.x0) * sc, (b.z1 - b.z0) * sc);
    }
    // crates & loot
    for (const c of Loot.crates) {
      if (c.opened) continue;
      mmc.fillStyle = c.kind === 'crate' ? '#3d9bff' : '#ffb627';
      mmc.fillRect(c.x * sc - 3, c.z * sc - 3, 6, 6);
    }
    for (const it of Loot.items) {
      if (it.rarity < 2 || (it.type !== 'att' && it.type !== 'weapon')) continue;
      mmc.fillStyle = RARITIES[it.rarity].color;
      mmc.beginPath(); mmc.arc(it.pos.x * sc, it.pos.z * sc, 2.2, 0, Math.PI * 2); mmc.fill();
    }
    // sentry
    for (const t of Game.sentries) { mmc.fillStyle = '#4fd16a'; mmc.fillRect(t.pos.x * sc - 3, t.pos.z * sc - 3, 6, 6); }
    // enemies: always with UAV, otherwise only when they fire
    for (const e of Enemies.list) {
      if (e.dead) continue;
      if (!(Game.uavT > 0 || e.reveal > 0 || e.type.hvt || e.type.boss)) continue;
      mmc.fillStyle = e.type.hvt || e.type.boss ? '#ffb627' : '#ff3b30';
      mmc.beginPath(); mmc.arc(e.pos.x * sc, e.pos.z * sc, e.type.boss ? 5 : 3.5, 0, Math.PI * 2); mmc.fill();
    }
    mmc.restore();
    // player arrow (always pointing up)
    mmc.fillStyle = '#fff';
    mmc.beginPath(); mmc.moveTo(W / 2, H / 2 - 7); mmc.lineTo(W / 2 - 5, H / 2 + 5); mmc.lineTo(W / 2 + 5, H / 2 + 5); mmc.closePath(); mmc.fill();
    if (Game.uavT > 0) {
      mmc.strokeStyle = 'rgba(255,59,48,0.6)'; mmc.lineWidth = 2;
      mmc.beginPath(); mmc.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); mmc.stroke();
    }
  }

  return { init, show, hitmarker, damageNumber, damageFrom, flash, toast, pickupToast, xpPopup, killfeed, banner, prompt, sniperGlint, update };
})();

// ---------------------------------------------------------------------------
// Menus: main, loadout, armory, challenges, settings, pause, inventory, field upgrade, summary.
const Menu = (() => {
  let loadoutSlot = 'primary';
  let pickTarget = null; // {slot (loadout slot), attSlot}

  function screen(id) {
    for (const el of document.querySelectorAll('.screen')) el.classList.toggle('hidden', el.id !== id);
    $('menus').classList.toggle('hidden', !id);
  }

  function rankBadge() {
    const need = xpForLevel(SAVE.level);
    return `<div class="rank"><b>RANK ${SAVE.level}</b><div class="xpbar"><i style="width:${SAVE.xp / need * 100}%"></i></div><small>${SAVE.xp} / ${need} XP · ${SAVE.salvage} Salvage</small></div>`;
  }

  function main() {
    screen('mainmenu');
    $('mainrank').innerHTML = rankBadge();
    const lo = SAVE.loadout;
    $('mainloadout').innerHTML = ['primary', 'secondary'].map(k => {
      const l = lo[k], wd = WEAPONS[l.wid], r = SAVE.weapons[l.wid].bestRarity;
      const n = Object.values(l.atts).filter(Boolean).length;
      return `<div class="lo-mini"><small>${k.toUpperCase()}</small><b style="color:${RARITIES[r].color}">${wd.name}</b><span>${RARITIES[r].name} · ${n} attachment${n === 1 ? '' : 's'}</span></div>`;
    }).join('');
    for (const b of document.querySelectorAll('[data-diff]')) b.classList.toggle('sel', b.dataset.diff === SAVE.difficulty);
    const best = SAVE.stats.bestWave || 0;
    $('mainstats').textContent = best ? `Best wave ${best} · Best streak ${SAVE.stats.bestStreak || 0} · ${SAVE.stats.kills || 0} total kills` : 'Survive the waves. Chain kills to upgrade your gun. Loot everything.';
  }

  // ---------- Loadout ----------
  function loadout() {
    screen('loadout');
    renderLoadout();
  }
  function renderLoadout() {
    const lo = SAVE.loadout[loadoutSlot];
    for (const b of document.querySelectorAll('[data-loslot]')) b.classList.toggle('sel', b.dataset.loslot === loadoutSlot);
    // weapon list
    $('lo-weapons').innerHTML = WEAPON_IDS.map(wid => {
      const wd = WEAPONS[wid], unlocked = SAVE.unlocked.includes(wid), sw = SAVE.weapons[wid];
      const other = SAVE.loadout[loadoutSlot === 'primary' ? 'secondary' : 'primary'].wid;
      const m = weaponMastery(wid);
      return `<button class="wcard ${lo.wid === wid ? 'sel' : ''} ${unlocked ? '' : 'locked'}" ${unlocked && other !== wid ? `data-wid="${wid}"` : 'disabled'}>
        <b style="color:${unlocked ? RARITIES[sw.bestRarity].color : '#777'}">${wd.name}</b>
        <small>${wd.clsName}${unlocked ? ` · ${RARITIES[sw.bestRarity].name} · Mastery ${m.level}` : ''}</small>
        ${unlocked ? '' : `<em>🔒 ${esc(wd.unlock)}</em>`}${other === wid ? '<em>In other slot</em>' : ''}
      </button>`;
    }).join('');
    // details
    const wid = lo.wid, wd = WEAPONS[wid], sw = SAVE.weapons[wid];
    const inst = loadoutInstance(loadoutSlot);
    const st = computeStats(inst), m = weaponMastery(wid);
    $('lo-detail').innerHTML = `
      <h3 style="color:${RARITIES[sw.bestRarity].color}">${RARITIES[sw.bestRarity].name} ${wd.name}</h3>
      <div class="mastery">Mastery ${m.level}<div class="xpbar"><i style="width:${m.progress * 100}%"></i></div><small>${sw.kills} kills · ${sw.headshots} headshots · +${((m.level - 1) * 0.5).toFixed(1)}% dmg</small></div>
      ${statBars(st, wd)}
      <div class="camos"><small>CAMO</small>${Object.keys(CAMOS).map(k => {
        const un = unlockedCamos(wid).includes(k), c = CAMOS[k];
        const req = c.req ? `${c.req.kills || 0} kills${c.req.headshots ? ', ' + c.req.headshots + ' headshots' : ''}` : '';
        return `<button class="camo ${sw.camo === k ? 'sel' : ''}" ${un ? `data-camo="${k}"` : 'disabled'} title="${c.name}${un ? '' : ' — ' + req}" style="background:${c.color ? '#' + c.color.toString(16).padStart(6, '0') : '#2c3036'}">${un ? '' : '🔒'}</button>`;
      }).join('')}</div>`;
    // attachment slots
    $('lo-atts').innerHTML = wd.slots.map(slot => {
      const uid = lo.atts[slot];
      const it = uid != null ? stashItem(uid) : null;
      return `<button class="attslot" data-attslot="${slot}"><small>${SLOT_NAMES[slot]}</small>${it ? `<b style="color:${RARITIES[it.rarity].color}">${ATTACHMENTS[it.aid].name}</b><span>${RARITIES[it.rarity].name}</span>` : '<b class="empty">Empty</b>'}</button>`;
    }).join('');
    renderPicker();
  }

  function statBars(st, wd) {
    const rows = [
      ['Damage', st.damage * st.pellets, 130, false], ['Fire rate', st.rpm, 1000, false], ['Range', st.rangeEnd, 120, false],
      ['Accuracy', 1 / (0.4 + st.recoilV + st.recoilH), 1.2, false], ['Handling', 1 / st.adsTime, 9, false], ['Mobility', st.speed, 1.15, false],
    ];
    return `<div class="stats">${rows.map(([n, v, max]) => `<div class="srow"><span>${n}</span><div class="sbar"><i style="width:${Math.min(100, v / max * 100)}%"></i></div></div>`).join('')}
      <div class="snum">${Math.round(st.damage)}${st.pellets > 1 ? '×' + st.pellets : ''} dmg · ${Math.round(st.rpm)} rpm · ${st.mag} rounds · ${st.reload.toFixed(2)}s reload · ${(st.adsTime * 1000) | 0}ms ADS</div></div>`;
  }

  function renderPicker() {
    const el = $('lo-picker');
    if (!pickTarget) { el.innerHTML = '<p class="hint">Select an attachment slot to equip loot from your Armory.</p>'; return; }
    const lo = SAVE.loadout[loadoutSlot];
    const used = equippedUids();
    const list = SAVE.stash.filter(i => ATTACHMENTS[i.aid].slot === pickTarget && attachmentFits(i.aid, lo.wid) && (!used.has(i.uid) || lo.atts[pickTarget] === i.uid))
      .sort((a, b) => b.rarity - a.rarity);
    el.innerHTML = `<h4>${SLOT_NAMES[pickTarget]}</h4><button class="pick" data-pick="none">— Remove —</button>` + (list.length ? list.map(i => `
      <button class="pick ${lo.atts[pickTarget] === i.uid ? 'sel' : ''}" data-pick="${i.uid}"><b style="color:${RARITIES[i.rarity].color}">${RARITIES[i.rarity].name} ${ATTACHMENTS[i.aid].name}</b><small>${Loot.modsText(scaledMods(i.aid, i.rarity))}</small></button>`).join('')
      : '<p class="hint">No compatible attachments yet. Find them in the field: enemies, supply crates, supply drops and contracts.</p>');
  }

  function loadoutInstance(slot) {
    const lo = SAVE.loadout[slot];
    const atts = {};
    for (const k in lo.atts) { const it = lo.atts[k] != null ? stashItem(lo.atts[k]) : null; if (it && attachmentFits(it.aid, lo.wid)) atts[k] = { aid: it.aid, rarity: it.rarity, stashUid: it.uid }; }
    return createWeapon(lo.wid, SAVE.weapons[lo.wid].bestRarity, atts, SAVE.weapons[lo.wid].camo);
  }

  // ---------- Armory ----------
  let armoryFilter = 'all';
  function armory() { screen('armory'); renderArmory(); }
  function renderArmory() {
    $('armoryhead').innerHTML = `${SAVE.salvage} Salvage · ${SAVE.stash.length}/${STASH_CAP} items`;
    for (const b of document.querySelectorAll('[data-afilter]')) b.classList.toggle('sel', b.dataset.afilter === armoryFilter);
    const used = equippedUids();
    const list = SAVE.stash.filter(i => armoryFilter === 'all' || ATTACHMENTS[i.aid].slot === armoryFilter).sort((a, b) => b.rarity - a.rarity || a.aid.localeCompare(b.aid));
    $('armorylist').innerHTML = list.length ? list.map(i => {
      const cost = i.rarity < 4 ? UPGRADE_COST.att[i.rarity] : null;
      return `<div class="aitem" style="border-color:${RARITIES[i.rarity].color}55">
        <div><b style="color:${RARITIES[i.rarity].color}">${RARITIES[i.rarity].name} ${ATTACHMENTS[i.aid].name}</b>${used.has(i.uid) ? '<em>Equipped</em>' : ''}<br><small>${SLOT_NAMES[ATTACHMENTS[i.aid].slot]} · ${Loot.modsText(scaledMods(i.aid, i.rarity))}</small></div>
        <div class="abtns">${cost ? `<button data-upg="${i.uid}" ${SAVE.salvage < cost ? 'disabled' : ''}>Upgrade · ${cost}</button>` : ''}${used.has(i.uid) ? '' : `<button data-salv="${i.uid}">Salvage +${RARITIES[i.rarity].salvage}</button>`}</div>
      </div>`;
    }).join('') : '<p class="hint">Your Armory is empty. Everything you pick up during a deployment is kept here.</p>';
    // weapon blueprint upgrades
    $('armoryweapons').innerHTML = SAVE.unlocked.map(wid => {
      const r = SAVE.weapons[wid].bestRarity, cost = r < 4 ? UPGRADE_COST.weapon[r] : null;
      return `<div class="aitem"><div><b style="color:${RARITIES[r].color}">${RARITIES[r].name} ${WEAPONS[wid].name}</b><br><small>+${Math.round((RARITIES[r].weaponDmg - 1) * 100)}% damage, ${Math.round((1 - RARITIES[r].weaponReload) * 100)}% faster reload</small></div>
        <div class="abtns">${cost ? `<button data-wupg="${wid}" ${SAVE.salvage < cost ? 'disabled' : ''}>Upgrade · ${cost}</button>` : '<em>Max</em>'}</div></div>`;
    }).join('');
  }

  // ---------- Challenges ----------
  function challenges() {
    screen('challenges');
    $('challist').innerHTML = CHALLENGES.map(c => {
      const v = SAVE.stats[c.stat] || 0;
      const claimed = SAVE.claimed[c.id] || 0;
      const tier = c.tiers[Math.min(claimed, c.tiers.length - 1)];
      const done = claimed >= c.tiers.length;
      const goal = tier.goal;
      return `<div class="chal ${done ? 'done' : ''}">
        <div class="ch-h"><b>${c.name}</b><span>${done ? 'COMPLETE' : `Tier ${claimed + 1}/${c.tiers.length}`}</span></div>
        <small>${c.desc}</small>
        <div class="xpbar"><i style="width:${Math.min(100, v / goal * 100)}%"></i></div>
        <div class="ch-f"><span>${Math.min(v, goal)} / ${goal}</span><span>${done ? '' : rewardText(tier.reward)}</span></div>
      </div>`;
    }).join('');
    // weapon camos
    $('camolist').innerHTML = WEAPON_IDS.map(wid => {
      const un = unlockedCamos(wid);
      return `<div class="chal"><div class="ch-h"><b>${WEAPONS[wid].name}</b><span>${un.length - 1}/${Object.keys(CAMOS).length - 1} camos</span></div>
        <div class="camos">${Object.keys(CAMOS).slice(1).map(k => { const c = CAMOS[k]; return `<i class="camo sm ${un.includes(k) ? '' : 'lockedc'}" title="${c.name}: ${c.req.kills} kills${c.req.headshots ? ', ' + c.req.headshots + ' headshots' : ''}" style="background:#${c.color.toString(16).padStart(6, '0')}"></i>`; }).join('')}</div></div>`;
    }).join('');
  }
  function rewardText(r) {
    const p = [];
    if (r.unlock) p.push(`Unlock ${WEAPONS[r.unlock].name}`);
    if (r.att !== undefined) p.push(`${RARITIES[r.att].name} attachment`);
    if (r.salvage) p.push(`${r.salvage} Salvage`);
    if (r.xp) p.push(`${r.xp} XP`);
    return p.join(' · ');
  }

  // ---------- Settings ----------
  function settings(fromPause) {
    screen('settings');
    $('settingsback').dataset.back = fromPause ? 'pause' : 'main';
    const s = SAVE.settings;
    $('set-sens').value = s.sens; $('set-adssens').value = s.adsSens; $('set-fov').value = s.fov; $('set-vol').value = s.volume;
    $('set-dmg').checked = s.dmgNumbers; $('set-shadows').checked = s.shadows; $('set-invert').checked = s.invertY;
    syncSettingLabels();
  }
  function syncSettingLabels() {
    $('lbl-sens').textContent = (+$('set-sens').value).toFixed(2);
    $('lbl-adssens').textContent = (+$('set-adssens').value).toFixed(2);
    $('lbl-fov').textContent = $('set-fov').value;
    $('lbl-vol').textContent = Math.round($('set-vol').value * 100) + '%';
  }

  // ---------- In-run inventory (Tab) ----------
  function inventory() {
    screen('inventory');
    renderInventory();
  }
  let invSel = null; // index into bag
  function renderInventory() {
    const P = Player.P, bag = Game.run.bag;
    $('inv-weapons').innerHTML = P.weapons.map((w, wi) => {
      const st = computeStats(w);
      return `<div class="invw ${wi === P.cur ? 'cur' : ''}">
        <h3 style="color:${RARITIES[w.rarity].color}">${weaponLabel(w)}</h3>
        <div class="snum">${Math.round(st.damage)}${st.pellets > 1 ? '×' + st.pellets : ''} dmg · ${Math.round(st.rpm)} rpm · ${st.mag} mag · ${st.reload.toFixed(2)}s reload</div>
        <div class="invslots">${WEAPONS[w.wid].slots.map(slot => {
          const a = w.atts[slot];
          const can = invSel !== null && bag[invSel] && ATTACHMENTS[bag[invSel].aid].slot === slot && attachmentFits(bag[invSel].aid, w.wid);
          return `<button class="attslot ${can ? 'can' : ''}" data-invw="${wi}" data-invslot="${slot}"><small>${SLOT_NAMES[slot]}</small>${a ? `<b style="color:${RARITIES[a.rarity].color}">${ATTACHMENTS[a.aid].name}</b>` : '<b class="empty">Empty</b>'}</button>`;
        }).join('')}</div>
        <div class="upgrades">${w.upgrades.length ? w.upgrades.map(u => `<span style="border-color:${RARITIES[u.rarity].color}">${u.name}: ${FIELD_UPGRADES.find(f => f.id === u.id).desc(u.value)}</span>`).join('') : '<small>No field upgrades yet: every 5 kills in a streak earns one.</small>'}</div>
      </div>`;
    }).join('');
    $('inv-bag').innerHTML = bag.length ? bag.map((a, i) => `<button class="pick ${invSel === i ? 'sel' : ''}" data-bag="${i}"><b style="color:${RARITIES[a.rarity].color}">${Loot.attLabel(a)}</b><small>${SLOT_NAMES[ATTACHMENTS[a.aid].slot]} · ${Loot.modsText(scaledMods(a.aid, a.rarity))}</small></button>`).join('')
      : '<p class="hint">Spare attachments you pick up land here. Select one, then click a highlighted slot to equip it. Click an equipped slot to unequip.</p>';
    $('inv-sum').innerHTML = `Plates ${P.plates} · Grenades ${P.grenades} · Self-revives ${P.revives} · Salvage this run ${Game.run.salvage}`;
  }

  // ---------- Field upgrade (pick 1 of 3) ----------
  function fieldUpgrade(choices) {
    screen('fieldupgrade');
    const w = Player.weapon();
    $('fu-weapon').innerHTML = `Upgrading your <b style="color:${RARITIES[w.rarity].color}">${weaponLabel(w)}</b>`;
    $('fu-choices').innerHTML = choices.map((c, i) => `
      <button class="fu" data-fu="${i}" style="border-color:${RARITIES[c.rarity].color}">
        <kbd>${i + 1}</kbd><small style="color:${RARITIES[c.rarity].color}">${RARITIES[c.rarity].name}</small>
        <b>${c.name}</b><span>${c.def.desc(c.value)}</span>
      </button>`).join('');
  }

  // ---------- Summary ----------
  function summary(r) {
    screen('summary');
    const acc = r.shots ? Math.round(r.hits / r.shots * 100) : 0;
    $('sum-title').textContent = r.quit ? 'Mission Aborted' : 'K.I.A.';
    $('sum-stats').innerHTML = [
      ['Wave reached', r.wave], ['Kills', r.kills], ['Headshots', r.headshots], ['Best streak', r.bestStreak],
      ['Accuracy', acc + '%'], ['Crates opened', r.crates], ['Contracts', r.contracts], ['XP earned', r.xp],
    ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
    const loot = r.secured;
    $('sum-loot').innerHTML = (loot.length ? loot.sort((a, b) => b.rarity - a.rarity).map(i => `<span style="color:${RARITIES[i.rarity].color};border-color:${RARITIES[i.rarity].color}66">${i.label}</span>`).join('') : '<small>No new gear secured.</small>')
      + (r.salvage ? `<span style="color:#e0b84a">+${r.salvage} Salvage</span>` : '');
    $('sum-chal').innerHTML = r.challenges.length ? r.challenges.map(c => `<div>✔ ${c}</div>`).join('') : '<small>No challenge tiers completed this run.</small>';
    $('sum-rank').innerHTML = rankBadge();
  }

  function bind() {
    document.addEventListener('click', e => {
      const t = e.target.closest('button, [data-act]');
      if (!t) return;
      Sound.init();
      const act = t.dataset.act;
      if (act) Sound.ui();
      if (act === 'deploy') Game.start();
      if (act === 'loadout') loadout();
      if (act === 'armory') armory();
      if (act === 'challenges') challenges();
      if (act === 'settings') settings(false);
      if (act === 'howto') screen('howto');
      if (act === 'main') main();
      if (act === 'resume') Game.resume();
      if (act === 'quit') Game.quit();
      if (act === 'pause-settings') settings(true);
      if (act === 'settings-back') { if (t.dataset.back === 'pause') screen('pause'); else main(); }
      if (act === 'reset') { if (confirm('Erase all progress, loot and unlocks?')) { resetSave(); main(); } }
      if (t.dataset.diff) { SAVE.difficulty = t.dataset.diff; persist(); main(); }
      if (t.dataset.loslot) { loadoutSlot = t.dataset.loslot; pickTarget = null; renderLoadout(); }
      if (t.dataset.wid) {
        const lo = SAVE.loadout[loadoutSlot];
        if (lo.wid !== t.dataset.wid) { lo.wid = t.dataset.wid; lo.atts = {}; pickTarget = null; persist(); renderLoadout(); }
      }
      if (t.dataset.camo) { SAVE.weapons[SAVE.loadout[loadoutSlot].wid].camo = t.dataset.camo; persist(); renderLoadout(); }
      if (t.dataset.attslot) { pickTarget = t.dataset.attslot; renderPicker(); }
      if (t.dataset.pick) {
        const lo = SAVE.loadout[loadoutSlot];
        lo.atts[pickTarget] = t.dataset.pick === 'none' ? null : +t.dataset.pick;
        persist(); renderLoadout();
      }
      if (t.dataset.afilter) { armoryFilter = t.dataset.afilter; renderArmory(); }
      if (t.dataset.upg) {
        const it = stashItem(+t.dataset.upg);
        const cost = UPGRADE_COST.att[it.rarity];
        if (it && it.rarity < 4 && SAVE.salvage >= cost) { SAVE.salvage -= cost; it.rarity++; persist(); Sound.pickup(it.rarity); renderArmory(); }
      }
      if (t.dataset.wupg) {
        const sw = SAVE.weapons[t.dataset.wupg], cost = UPGRADE_COST.weapon[sw.bestRarity];
        if (sw.bestRarity < 4 && SAVE.salvage >= cost) { SAVE.salvage -= cost; sw.bestRarity++; persist(); Sound.pickup(sw.bestRarity); renderArmory(); }
      }
      if (t.dataset.salv) {
        const it = stashItem(+t.dataset.salv);
        if (it) { SAVE.salvage += RARITIES[it.rarity].salvage; SAVE.stash.splice(SAVE.stash.indexOf(it), 1); persist(); renderArmory(); }
      }
      if (t.dataset.fu !== undefined) Game.chooseUpgrade(+t.dataset.fu);
      if (t.dataset.bag !== undefined) { invSel = invSel === +t.dataset.bag ? null : +t.dataset.bag; renderInventory(); }
      if (t.dataset.invslot) {
        const w = Player.P.weapons[+t.dataset.invw], slot = t.dataset.invslot, bag = Game.run.bag;
        if (invSel !== null && bag[invSel] && ATTACHMENTS[bag[invSel].aid].slot === slot && attachmentFits(bag[invSel].aid, w.wid)) {
          const a = bag.splice(invSel, 1)[0];
          if (w.atts[slot]) bag.push(w.atts[slot]);
          Loot.equipAttachment(w, slot, a);
          invSel = null;
        } else if (w.atts[slot]) {
          bag.push(w.atts[slot]); delete w.atts[slot];
          Loot.equipAttachment(w, slot, undefined); delete w.atts[slot];
          if (w === Player.weapon()) Player.rebuildModel();
        }
        renderInventory();
      }
    });
    for (const id of ['set-sens', 'set-adssens', 'set-fov', 'set-vol', 'set-dmg', 'set-shadows', 'set-invert']) {
      $(id).addEventListener('input', () => {
        const s = SAVE.settings;
        s.sens = +$('set-sens').value; s.adsSens = +$('set-adssens').value; s.fov = +$('set-fov').value; s.volume = +$('set-vol').value;
        s.dmgNumbers = $('set-dmg').checked; s.shadows = $('set-shadows').checked; s.invertY = $('set-invert').checked;
        Sound.setVolume(s.volume); Game.applySettings();
        syncSettingLabels(); persist();
      });
    }
  }

  return { screen, main, loadout, armory, challenges, settings, inventory, renderInventory, fieldUpgrade, summary, bind, loadoutInstance, rewardText };
})();
