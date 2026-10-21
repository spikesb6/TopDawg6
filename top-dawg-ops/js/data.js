'use strict';
// Static game data: rarities, weapons, attachments, enemies, streaks, upgrades, challenges.

const RARITIES = [
  { id: 0, name: 'Common',    color: '#b9c0c9', hex: 0xb9c0c9, weaponDmg: 1.00, weaponReload: 1.00, attMult: 1.00, penalty: 1.00, weight: 50,  salvage: 5,  beam: 1.2 },
  { id: 1, name: 'Uncommon',  color: '#4fd16a', hex: 0x4fd16a, weaponDmg: 1.05, weaponReload: 0.97, attMult: 1.25, penalty: 0.90, weight: 28,  salvage: 10, beam: 1.8 },
  { id: 2, name: 'Rare',      color: '#3d9bff', hex: 0x3d9bff, weaponDmg: 1.10, weaponReload: 0.94, attMult: 1.50, penalty: 0.80, weight: 14,  salvage: 20, beam: 2.6 },
  { id: 3, name: 'Epic',      color: '#b45cff', hex: 0xb45cff, weaponDmg: 1.16, weaponReload: 0.90, attMult: 1.80, penalty: 0.65, weight: 6,   salvage: 40, beam: 3.6 },
  { id: 4, name: 'Legendary', color: '#ffb627', hex: 0xffb627, weaponDmg: 1.24, weaponReload: 0.85, attMult: 2.20, penalty: 0.50, weight: 2,   salvage: 80, beam: 5.0 },
];

// luck > 0 shifts weight toward higher tiers. minRarity floors the result.
function rollRarity(luck = 0, minRarity = 0) {
  let total = 0;
  const w = RARITIES.map(r => {
    const v = r.id < minRarity ? 0 : r.weight * Math.pow(1 + luck, r.id);
    total += v;
    return v;
  });
  let roll = Math.random() * total;
  for (let i = 0; i < w.length; i++) {
    roll -= w[i];
    if (roll <= 0) return i;
  }
  return RARITIES.length - 1;
}

const SLOTS = ['optic', 'muzzle', 'barrel', 'underbarrel', 'magazine', 'stock'];
const SLOT_NAMES = { optic: 'Optic', muzzle: 'Muzzle', barrel: 'Barrel', underbarrel: 'Underbarrel', magazine: 'Magazine', stock: 'Stock' };

// Stat direction: +1 means bigger is better, -1 means smaller is better.
const STAT_DIR = {
  damage: 1, fireRate: 1, mag: 1, reload: -1, adsTime: -1, range: 1, hipSpread: -1,
  adsSpread: -1, recoilV: -1, recoilH: -1, speed: 1, headMult: 1,
};
const STAT_LABEL = {
  damage: 'Damage', fireRate: 'Fire rate', mag: 'Magazine', reload: 'Reload time', adsTime: 'ADS time',
  range: 'Range', hipSpread: 'Hip-fire spread', adsSpread: 'ADS spread', recoilV: 'Vertical recoil',
  recoilH: 'Horizontal recoil', speed: 'Move speed', headMult: 'Headshot multiplier',
};

// cls: AR, SMG, LMG, DMR, SG (shotgun), SR (sniper), PI (pistol)
const WEAPONS = {
  vanguard: {
    id: 'vanguard', name: 'Vanguard AR', cls: 'AR', clsName: 'Assault Rifle',
    dmg: 27, rpm: 740, auto: true, mag: 30, reserve: 180, reload: 2.0, ads: 0.22,
    rangeStart: 28, rangeEnd: 60, minDmg: 0.72, hip: 3.4, adsSpread: 0.25,
    recoilV: 1.05, recoilH: 0.45, speed: 0.95, head: 1.5, zoom: 1.3, pellets: 1,
    slots: SLOTS, unlock: 'Default',
    model: { len: 0.72, bodyH: 0.09, barrel: 0.26, mag: 'curved', stock: 'full', color: 0x2c3036 },
    sound: { freq: 900, body: 120, len: 0.16, gain: 0.55 },
  },
  kestrel: {
    id: 'kestrel', name: 'Kestrel SMG', cls: 'SMG', clsName: 'Submachine Gun',
    dmg: 21, rpm: 950, auto: true, mag: 32, reserve: 224, reload: 1.7, ads: 0.15,
    rangeStart: 14, rangeEnd: 34, minDmg: 0.65, hip: 2.4, adsSpread: 0.45,
    recoilV: 0.75, recoilH: 0.6, speed: 1.06, head: 1.4, zoom: 1.2, pellets: 1,
    slots: SLOTS, unlock: 'Default',
    model: { len: 0.52, bodyH: 0.1, barrel: 0.12, mag: 'straight', stock: 'folding', color: 0x33302b },
    sound: { freq: 1400, body: 160, len: 0.11, gain: 0.45 },
  },
  p9: {
    id: 'p9', name: 'P9 Sidearm', cls: 'PI', clsName: 'Pistol',
    dmg: 30, rpm: 420, auto: false, mag: 15, reserve: 105, reload: 1.35, ads: 0.12,
    rangeStart: 14, rangeEnd: 30, minDmg: 0.65, hip: 2.0, adsSpread: 0.35,
    recoilV: 1.4, recoilH: 0.5, speed: 1.1, head: 1.6, zoom: 1.15, pellets: 1,
    slots: ['optic', 'muzzle', 'magazine'], unlock: 'Default',
    model: { len: 0.24, bodyH: 0.1, barrel: 0, mag: 'grip', stock: 'none', color: 0x23262b },
    sound: { freq: 1200, body: 140, len: 0.13, gain: 0.5 },
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark LMG', cls: 'LMG', clsName: 'Light Machine Gun',
    dmg: 31, rpm: 640, auto: true, mag: 100, reserve: 300, reload: 4.4, ads: 0.36,
    rangeStart: 34, rangeEnd: 70, minDmg: 0.75, hip: 5.2, adsSpread: 0.3,
    recoilV: 1.0, recoilH: 0.55, speed: 0.86, head: 1.4, zoom: 1.3, pellets: 1,
    slots: SLOTS, unlock: 'Challenge: Hold the Line (reach wave 5) or find one',
    model: { len: 0.86, bodyH: 0.13, barrel: 0.3, mag: 'box', stock: 'full', color: 0x343a2e },
    sound: { freq: 700, body: 100, len: 0.2, gain: 0.6 },
  },
  marksman: {
    id: 'marksman', name: 'Warden DMR', cls: 'DMR', clsName: 'Marksman Rifle',
    dmg: 58, rpm: 330, auto: false, mag: 15, reserve: 90, reload: 2.4, ads: 0.27,
    rangeStart: 50, rangeEnd: 100, minDmg: 0.8, hip: 4.0, adsSpread: 0.1,
    recoilV: 1.9, recoilH: 0.5, speed: 0.93, head: 1.9, zoom: 1.5, pellets: 1,
    slots: SLOTS, unlock: 'Challenge: Scavenger (open 10 supply crates) or find one',
    model: { len: 0.9, bodyH: 0.1, barrel: 0.34, mag: 'straight', stock: 'full', color: 0x3a3226 },
    sound: { freq: 650, body: 90, len: 0.26, gain: 0.65 },
  },
  breacher: {
    id: 'breacher', name: 'Breacher 12G', cls: 'SG', clsName: 'Shotgun',
    dmg: 19, rpm: 85, auto: false, mag: 6, reserve: 36, reload: 2.8, ads: 0.2,
    rangeStart: 7, rangeEnd: 18, minDmg: 0.3, hip: 5.5, adsSpread: 4.2,
    recoilV: 3.2, recoilH: 0.9, speed: 0.98, head: 1.25, zoom: 1.15, pellets: 9,
    slots: ['optic', 'muzzle', 'barrel', 'underbarrel', 'magazine', 'stock'], unlock: 'Challenge: Close Quarters (40 SMG kills) or find one',
    model: { len: 0.82, bodyH: 0.1, barrel: 0.32, mag: 'tube', stock: 'full', color: 0x2e2a27 },
    sound: { freq: 500, body: 70, len: 0.32, gain: 0.8 },
  },
  longbow: {
    id: 'longbow', name: 'Longbow SR', cls: 'SR', clsName: 'Sniper Rifle',
    dmg: 125, rpm: 48, auto: false, mag: 5, reserve: 35, reload: 3.0, ads: 0.42,
    rangeStart: 120, rangeEnd: 220, minDmg: 0.85, hip: 7.5, adsSpread: 0.0,
    recoilV: 4.5, recoilH: 0.8, speed: 0.9, head: 2.6, zoom: 4.0, pellets: 1,
    slots: SLOTS, unlock: 'Challenge: Long Shot (15 kills from 40m+) or find one',
    model: { len: 1.05, bodyH: 0.1, barrel: 0.45, mag: 'straight', stock: 'full', color: 0x2b3229, scoped: true },
    sound: { freq: 450, body: 60, len: 0.4, gain: 0.85 },
  },
};
const WEAPON_IDS = Object.keys(WEAPONS);
const DEFAULT_UNLOCKS = ['vanguard', 'kestrel', 'p9'];

// mods are fractional: +0.1 = +10%. Optic "zoom" is an absolute magnification.
const ATTACHMENTS = {
  // Optics
  reddot:   { slot: 'optic', name: 'Red Dot Sight', zoom: 1.35, reticle: 'dot', mods: { adsTime: -0.05 } },
  holo:     { slot: 'optic', name: 'Holo Sight', zoom: 1.5, reticle: 'holo', mods: { adsSpread: -0.12, adsTime: -0.02 } },
  acog:     { slot: 'optic', name: '3x Tactical Scope', zoom: 2.4, reticle: 'chevron', mods: { adsSpread: -0.25, adsTime: 0.12 }, exclude: ['SG', 'PI'] },
  recon:    { slot: 'optic', name: '8x Recon Scope', zoom: 6.0, reticle: 'scope', mods: { adsSpread: -0.4, adsTime: 0.18 }, only: ['DMR', 'SR'] },
  // Muzzles
  comp:     { slot: 'muzzle', name: 'Compensator', mods: { recoilV: -0.15, recoilH: -0.05, hipSpread: 0.05 } },
  supp:     { slot: 'muzzle', name: 'Suppressor', suppressed: true, mods: { recoilV: -0.06, range: 0.08, damage: -0.03 } },
  brake:    { slot: 'muzzle', name: 'Muzzle Brake', mods: { recoilH: -0.22, adsTime: 0.03 } },
  flash:    { slot: 'muzzle', name: 'Flash Guard', mods: { recoilV: -0.06, hipSpread: -0.06 } },
  choke:    { slot: 'muzzle', name: 'Full Choke', mods: { adsSpread: -0.3, hipSpread: -0.15, range: 0.1 }, only: ['SG'] },
  // Barrels
  longbar:  { slot: 'barrel', name: 'Long Barrel', mods: { range: 0.25, damage: 0.03, adsTime: 0.06, speed: -0.02 } },
  shortbar: { slot: 'barrel', name: 'CQB Barrel', mods: { adsTime: -0.1, hipSpread: -0.12, range: -0.15 } },
  heavybar: { slot: 'barrel', name: 'Heavy Barrel', mods: { damage: 0.08, recoilV: -0.05, speed: -0.04, adsTime: 0.05 } },
  // Underbarrel
  vgrip:    { slot: 'underbarrel', name: 'Vertical Grip', mods: { recoilV: -0.12 } },
  agrip:    { slot: 'underbarrel', name: 'Angled Grip', mods: { adsTime: -0.1, recoilH: -0.05 } },
  laser:    { slot: 'underbarrel', name: 'Tac Laser', laser: true, mods: { hipSpread: -0.3, adsTime: -0.03 } },
  bipod:    { slot: 'underbarrel', name: 'Combat Bipod', mods: { recoilV: -0.1, recoilH: -0.1, speed: -0.03 } },
  // Magazines
  extmag:   { slot: 'magazine', name: 'Extended Mag', mods: { mag: 0.5, reload: 0.12 } },
  drum:     { slot: 'magazine', name: 'Drum Mag', mods: { mag: 1.0, reload: 0.3, speed: -0.05, adsTime: 0.05 }, exclude: ['SG', 'SR', 'PI', 'DMR'] },
  fastmag:  { slot: 'magazine', name: 'Fast Mag', mods: { reload: -0.3 } },
  hpmag:    { slot: 'magazine', name: 'Hollow Point Rounds', mods: { damage: 0.07, headMult: 0.1, mag: -0.1 } },
  // Stocks
  tacstock: { slot: 'stock', name: 'Tactical Stock', mods: { adsTime: -0.06, recoilV: -0.05 } },
  lightstock: { slot: 'stock', name: 'Skeleton Stock', mods: { speed: 0.05, adsTime: -0.08, recoilV: 0.06 } },
  heavystock: { slot: 'stock', name: 'Padded Stock', mods: { recoilV: -0.12, recoilH: -0.08, adsTime: 0.05 } },
};
const ATTACHMENT_IDS = Object.keys(ATTACHMENTS);

function attachmentFits(aid, wid) {
  const a = ATTACHMENTS[aid], w = WEAPONS[wid];
  if (!a || !w) return false;
  if (!w.slots.includes(a.slot)) return false;
  if (a.only && !a.only.includes(w.cls)) return false;
  if (a.exclude && a.exclude.includes(w.cls)) return false;
  return true;
}

// Rarity scales the good parts of an attachment up and the bad parts down.
function scaledMods(aid, rarity) {
  const a = ATTACHMENTS[aid], r = RARITIES[rarity];
  const out = {};
  for (const k in a.mods) {
    const v = a.mods[k];
    const good = Math.sign(v) === STAT_DIR[k];
    out[k] = v * (good ? r.attMult : r.penalty);
  }
  return out;
}

function randomAttachmentFor(wid) {
  const fits = ATTACHMENT_IDS.filter(a => attachmentFits(a, wid));
  return fits[(Math.random() * fits.length) | 0];
}

const CAMOS = {
  none:      { name: 'Factory',   color: null, req: null },
  woodland:  { name: 'Woodland',  color: 0x4d5a36, req: { kills: 25 } },
  arctic:    { name: 'Arctic',    color: 0xcfd8dc, req: { headshots: 15 } },
  crimson:   { name: 'Crimson',   color: 0x8e1b1b, req: { kills: 60 } },
  gold:      { name: 'Gold',      color: 0xd4a017, metal: true, req: { kills: 100, headshots: 40 } },
  prismatic: { name: 'Prismatic', color: 0x66e0ff, metal: true, animated: true, req: { kills: 200, headshots: 80 } },
};

const ENEMY_TYPES = {
  grunt:  { name: 'Rifleman', hp: 110, speed: 3.4, dmg: 8, rpm: 420, burst: [3, 5], pause: [0.6, 1.3], accuracy: 0.42, range: 48, prefer: 20, color: 0x4f5a40, helmet: 0x3b4430, xp: 100, loot: 0.3, grenades: true },
  rusher: { name: 'Rusher', hp: 85, speed: 5.4, dmg: 6, rpm: 780, burst: [5, 9], pause: [0.5, 1.0], accuracy: 0.36, range: 26, prefer: 6, color: 0x6b4a33, helmet: 0x2a2a2a, xp: 110, loot: 0.3 },
  heavy:  { name: 'Heavy', hp: 320, speed: 2.4, dmg: 7, rpm: 600, burst: [10, 18], pause: [1.0, 1.8], accuracy: 0.38, range: 42, prefer: 18, color: 0x30363e, helmet: 0x1d2126, xp: 200, loot: 0.55, scale: 1.15, armor: 0.2 },
  sniper: { name: 'Sniper', hp: 90, speed: 3.0, dmg: 42, rpm: 40, burst: [1, 1], pause: [2.5, 3.5], accuracy: 0.85, range: 120, prefer: 50, color: 0x5b6450, helmet: 0x434b3a, xp: 150, loot: 0.45, sniper: true, aimTime: 1.8 },
  elite:  { name: 'HVT Commander', hp: 480, speed: 3.8, dmg: 9, rpm: 600, burst: [4, 8], pause: [0.5, 1.0], accuracy: 0.48, range: 48, prefer: 16, color: 0x1e1e22, helmet: 0xd4a017, xp: 500, loot: 1, minLoot: 3, hvt: true, grenades: true },
  jugg:   { name: 'Juggernaut', hp: 1800, speed: 2.0, dmg: 6, rpm: 1000, burst: [20, 40], pause: [1.2, 2.0], accuracy: 0.3, range: 40, prefer: 12, color: 0x2a2d33, helmet: 0x111111, xp: 1500, loot: 1, minLoot: 4, scale: 1.45, armor: 0.35, headCap: 1.3, boss: true },
};

const DIFFICULTIES = {
  recruit: { name: 'Recruit', dmg: 0.6, acc: 0.8, hp: 0.85, luck: 0.0, xp: 0.8 },
  regular: { name: 'Regular', dmg: 1.0, acc: 1.0, hp: 1.0, luck: 0.15, xp: 1.0 },
  veteran: { name: 'Veteran', dmg: 1.4, acc: 1.15, hp: 1.2, luck: 0.35, xp: 1.35 },
};

// Kill streak rewards: earned once per streak, used with the listed key.
const STREAKS = [
  { id: 'uav',       name: 'UAV',                 kills: 3,  key: '3', desc: 'Reveals every hostile on the minimap for 30s.' },
  { id: 'airstrike', name: 'Precision Airstrike', kills: 6,  key: '4', desc: 'Mortar barrage where you aim.' },
  { id: 'sentry',    name: 'Sentry Gun',          kills: 9,  key: '5', desc: 'Deploys an auto-turret for 45s.' },
  { id: 'overdrive', name: 'Overdrive',           kills: 13, key: '6', desc: '20s of no reloads, +35% fire rate, +25% damage.' },
  { id: 'hellstorm', name: 'Hellstorm',           kills: 18, key: '7', desc: 'Missiles strike every hostile on the field.' },
];
const FIELD_UPGRADE_EVERY = 5;

// Field upgrades: offered (pick 1 of 3) every 5 kills in a streak. They stay on that gun for the run.
const FIELD_UPGRADES = [
  { id: 'hotloads',  name: 'Hot Loads',       desc: v => `+${pct(v)} damage`, stat: 'damage', base: 0.1 },
  { id: 'rapid',     name: 'Rapid Cycle',     desc: v => `+${pct(v)} fire rate`, stat: 'fireRate', base: 0.08 },
  { id: 'deepmag',   name: 'Deep Magazine',   desc: v => `+${pct(v)} magazine size`, stat: 'mag', base: 0.25 },
  { id: 'speedload', name: 'Speed Loader',    desc: v => `${pct(v)} faster reloads`, stat: 'reload', base: -0.18 },
  { id: 'stabilize', name: 'Stabilizer',      desc: v => `${pct(v)} less recoil`, stat: 'recoil', base: -0.14 },
  { id: 'focus',     name: 'Laser Focus',     desc: v => `${pct(v)} tighter hip-fire`, stat: 'hipSpread', base: -0.22 },
  { id: 'quickdraw', name: 'Quickdraw',       desc: v => `${pct(v)} faster aim-down-sights`, stat: 'adsTime', base: -0.14 },
  { id: 'reach',     name: 'Long Reach',      desc: v => `+${pct(v)} effective range`, stat: 'range', base: 0.2 },
  { id: 'headhunter',name: 'Headhunter',      desc: v => `+${pct(v)} headshot damage`, stat: 'headMult', base: 0.18 },
  { id: 'vampire',   name: 'Vampire Rounds',  desc: v => `Kills heal ${Math.round(v)} HP`, stat: 'lifesteal', base: 12, flat: true },
  { id: 'scavenger', name: 'Scavenger',       desc: v => `Kills refund ${Math.round(v)}% of a magazine`, stat: 'scavenge', base: 20, flat: true },
  { id: 'explosive', name: 'Explosive Tips',  desc: v => `${Math.round(v)}% chance hits explode`, stat: 'explosive', base: 8, flat: true, minRarity: 2 },
];
function pct(v) { return Math.round(Math.abs(v) * 100) + '%'; }

// Per-wave optional objectives that pay out a loot cache.
const CONTRACTS = [
  { id: 'headshots', name: 'Precision Work',  goal: w => 4 + Math.floor(w / 2), text: g => `Get ${g} headshots this wave` },
  { id: 'hvt',       name: 'Decapitation',    goal: () => 1, text: () => 'Eliminate the HVT within 75s of it appearing', needsHvt: true },
  { id: 'slide',     name: 'Slip and Slide',  goal: () => 3, text: g => `Get ${g} kills while sliding` },
  { id: 'longshot',  name: 'Overwatch',       goal: () => 3, text: g => `Get ${g} kills from 35m+` },
  { id: 'melee',     name: 'Up Close',        goal: () => 2, text: g => `Get ${g} melee kills` },
  { id: 'grenade',   name: 'Fire in the Hole',goal: () => 2, text: g => `Get ${g} grenade kills` },
  { id: 'streak',    name: 'On a Roll',       goal: w => Math.min(6 + w, 15), text: g => `Reach a ${g} kill streak this wave` },
];

// Persistent Battlefield-style challenges. mode 'max' tracks a best value, otherwise a running total.
const CHALLENGES = [
  { id: 'cq', name: 'Close Quarters', desc: 'Kills with SMGs', stat: 'kills_SMG', tiers: [
    { goal: 40, reward: { unlock: 'breacher', xp: 1000 } }, { goal: 150, reward: { att: 3, xp: 2000 } }, { goal: 400, reward: { att: 4, xp: 4000 } } ] },
  { id: 'line', name: 'Hold the Line', desc: 'Highest wave reached', stat: 'bestWave', mode: 'max', tiers: [
    { goal: 5, reward: { unlock: 'bulwark', xp: 1000 } }, { goal: 10, reward: { att: 3, salvage: 200, xp: 2500 } }, { goal: 15, reward: { att: 4, salvage: 400, xp: 5000 } } ] },
  { id: 'scav', name: 'Scavenger', desc: 'Supply crates opened', stat: 'crates', tiers: [
    { goal: 10, reward: { unlock: 'marksman', xp: 800 } }, { goal: 40, reward: { salvage: 250, xp: 1500 } }, { goal: 100, reward: { att: 4, xp: 3000 } } ] },
  { id: 'long', name: 'Long Shot', desc: 'Kills from 40m or more', stat: 'longshots', tiers: [
    { goal: 15, reward: { unlock: 'longbow', xp: 1000 } }, { goal: 60, reward: { att: 3, xp: 2000 } }, { goal: 150, reward: { att: 4, xp: 4000 } } ] },
  { id: 'marks', name: 'Marksman', desc: 'Headshot kills', stat: 'headshots', tiers: [
    { goal: 25, reward: { salvage: 100, xp: 800 } }, { goal: 100, reward: { att: 3, xp: 2000 } }, { goal: 300, reward: { att: 4, salvage: 300, xp: 5000 } } ] },
  { id: 'rampage', name: 'Rampage', desc: 'Best kill streak', stat: 'bestStreak', mode: 'max', tiers: [
    { goal: 10, reward: { att: 2, xp: 800 } }, { goal: 20, reward: { att: 3, xp: 2000 } }, { goal: 35, reward: { att: 4, xp: 5000 } } ] },
  { id: 'slide', name: 'Slide Specialist', desc: 'Kills while sliding', stat: 'slideKills', tiers: [
    { goal: 15, reward: { salvage: 100, xp: 800 } }, { goal: 60, reward: { att: 3, xp: 2000 } } ] },
  { id: 'demo', name: 'Demolitions', desc: 'Grenade and killstreak kills', stat: 'explosiveKills', tiers: [
    { goal: 25, reward: { salvage: 150, xp: 1000 } }, { goal: 100, reward: { att: 3, xp: 2500 } } ] },
  { id: 'knife', name: 'Point Blank', desc: 'Melee kills', stat: 'meleeKills', tiers: [
    { goal: 10, reward: { salvage: 100, xp: 800 } }, { goal: 40, reward: { att: 3, xp: 2000 } } ] },
  { id: 'hvt', name: 'Headhunter', desc: 'HVT Commanders and Juggernauts eliminated', stat: 'hvtKills', tiers: [
    { goal: 5, reward: { att: 2, xp: 1000 } }, { goal: 25, reward: { att: 4, xp: 3000 } } ] },
  { id: 'treasure', name: 'Treasure Hunter', desc: 'Legendary items found', stat: 'legendaries', tiers: [
    { goal: 1, reward: { salvage: 200, xp: 1000 } }, { goal: 10, reward: { att: 4, xp: 3000 } } ] },
  { id: 'gunsmith', name: 'Gunsmith', desc: 'Field upgrades applied', stat: 'fieldUpgrades', tiers: [
    { goal: 10, reward: { salvage: 150, xp: 800 } }, { goal: 50, reward: { att: 3, xp: 2000 } } ] },
  { id: 'veteran', name: 'Veteran', desc: 'Total kills', stat: 'kills', tiers: [
    { goal: 100, reward: { salvage: 100, xp: 1000 } }, { goal: 500, reward: { att: 3, salvage: 200, xp: 3000 } }, { goal: 2000, reward: { att: 4, salvage: 500, xp: 8000 } } ] },
];

// XP needed to go from level n to n+1.
function xpForLevel(n) { return 1000 + 300 * (n - 1); }

const UPGRADE_COST = { att: [40, 90, 180, 350], weapon: [120, 260, 520, 1000] };
