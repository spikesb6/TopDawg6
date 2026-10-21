'use strict';
// Persistent progression stored in localStorage. Every access is guarded so the game still runs
// in private windows or when storage is blocked (progress just won't carry over).

const SAVE_KEY = 'topdawg_ops_save_v1';
const STASH_CAP = 150;

function defaultSave() {
  const weapons = {};
  for (const id of WEAPON_IDS) weapons[id] = { xp: 0, kills: 0, headshots: 0, bestRarity: 0, camo: 'none' };
  return {
    version: 1,
    xp: 0, level: 1, salvage: 0, nextUid: 1,
    stats: {},
    weapons,
    unlocked: DEFAULT_UNLOCKS.slice(),
    stash: [],
    claimed: {},
    difficulty: 'regular',
    loadout: {
      primary: { wid: 'vanguard', atts: {} },
      secondary: { wid: 'p9', atts: {} },
    },
    settings: { sens: 1.0, adsSens: 0.8, fov: 95, volume: 0.7, dmgNumbers: true, shadows: true, invertY: false },
  };
}

let SAVE = loadSave();

function loadSave() {
  let data = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (e) { data = null; }
  const base = defaultSave();
  if (!data || typeof data !== 'object') return base;
  // Merge onto defaults so newer fields always exist.
  const out = Object.assign(base, data);
  out.settings = Object.assign(defaultSave().settings, data.settings || {});
  out.weapons = Object.assign(defaultSave().weapons, data.weapons || {});
  for (const id of WEAPON_IDS) out.weapons[id] = Object.assign({ xp: 0, kills: 0, headshots: 0, bestRarity: 0, camo: 'none' }, out.weapons[id]);
  out.stats = data.stats || {};
  out.claimed = data.claimed || {};
  out.stash = Array.isArray(data.stash) ? data.stash.filter(i => ATTACHMENTS[i.aid]) : [];
  out.unlocked = Array.isArray(data.unlocked) ? data.unlocked.filter(w => WEAPONS[w]) : DEFAULT_UNLOCKS.slice();
  for (const w of DEFAULT_UNLOCKS) if (!out.unlocked.includes(w)) out.unlocked.push(w);
  if (!out.loadout || !out.loadout.primary || !WEAPONS[out.loadout.primary.wid]) out.loadout = defaultSave().loadout;
  if (!WEAPONS[out.loadout.secondary && out.loadout.secondary.wid]) out.loadout.secondary = { wid: 'p9', atts: {} };
  if (!DIFFICULTIES[out.difficulty]) out.difficulty = 'regular';
  return out;
}

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { /* storage unavailable */ }
}

function resetSave() {
  SAVE = defaultSave();
  persist();
}

function newUid() { return SAVE.nextUid++; }

function stashItem(uid) { return SAVE.stash.find(i => i.uid === uid) || null; }

function addToStash(aid, rarity) {
  const item = { uid: newUid(), aid, rarity };
  SAVE.stash.push(item);
  trimStash();
  return item;
}

// Keep the stash bounded: auto-salvage the lowest-rarity items that aren't equipped.
function trimStash() {
  if (SAVE.stash.length <= STASH_CAP) return;
  const equipped = equippedUids();
  const removable = SAVE.stash.filter(i => !equipped.has(i.uid)).sort((a, b) => a.rarity - b.rarity || a.uid - b.uid);
  while (SAVE.stash.length > STASH_CAP && removable.length) {
    const it = removable.shift();
    SAVE.salvage += RARITIES[it.rarity].salvage;
    SAVE.stash.splice(SAVE.stash.indexOf(it), 1);
  }
}

function equippedUids() {
  const s = new Set();
  for (const slot of ['primary', 'secondary']) {
    const atts = SAVE.loadout[slot].atts || {};
    for (const k in atts) if (atts[k] != null) s.add(atts[k]);
  }
  return s;
}

function addXp(amount) {
  SAVE.xp += Math.round(amount);
  let leveled = 0;
  while (SAVE.xp >= xpForLevel(SAVE.level)) {
    SAVE.xp -= xpForLevel(SAVE.level);
    SAVE.level++;
    SAVE.salvage += 50;
    leveled++;
  }
  return leveled;
}

function weaponMastery(wid) {
  const xp = SAVE.weapons[wid].xp;
  let lvl = 1, need = 800, left = xp;
  while (left >= need && lvl < 30) { left -= need; lvl++; need = 800 + lvl * 150; }
  return { level: lvl, progress: lvl >= 30 ? 1 : left / need };
}

function unlockedCamos(wid) {
  const w = SAVE.weapons[wid];
  return Object.keys(CAMOS).filter(k => {
    const r = CAMOS[k].req;
    return !r || ((r.kills || 0) <= w.kills && (r.headshots || 0) <= w.headshots);
  });
}
