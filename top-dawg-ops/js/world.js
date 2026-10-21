'use strict';
// The map: procedural textures, static geometry (merged per material), AABB colliders,
// ray casts, and the navigation flow field the enemies follow.

const World = (() => {
  const HALF = 62;              // playable half-size (walls at +/-HALF)
  const boxes = [];             // colliders: {x0,y0,z0,x1,y1,z1}
  const geoBatches = {};        // material key -> list of boxes to merge
  const materials = {};
  const spawnPoints = [], crateSpots = [], perches = [];
  let scene;

  // ---------- Procedural textures ----------
  function canvasTex(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    draw(g, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }
  function speckle(g, s, n, colors, rMin, rMax, alpha) {
    for (let i = 0; i < n; i++) {
      g.globalAlpha = alpha * Math.random();
      g.fillStyle = colors[(Math.random() * colors.length) | 0];
      const r = rMin + Math.random() * (rMax - rMin);
      g.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
    g.globalAlpha = 1;
  }
  function makeTextures() {
    const T = {};
    T.concrete = canvasTex(256, (g, s) => {
      g.fillStyle = '#9a9a96'; g.fillRect(0, 0, s, s);
      speckle(g, s, 3000, ['#7d7d79', '#b3b3ae', '#8a8780'], 1, 3, 0.6);
      speckle(g, s, 40, ['#6e6b64'], 6, 20, 0.15);
      g.strokeStyle = 'rgba(60,60,60,0.35)'; g.lineWidth = 2;
      g.strokeRect(0, 0, s, s);
    });
    T.plaster = canvasTex(256, (g, s) => {
      g.fillStyle = '#c2b394'; g.fillRect(0, 0, s, s);
      speckle(g, s, 2500, ['#b0a080', '#d0c2a4', '#a89878'], 1, 3, 0.5);
      const grad = g.createLinearGradient(0, s, 0, s * 0.6);
      grad.addColorStop(0, 'rgba(70,55,35,0.35)'); grad.addColorStop(1, 'rgba(70,55,35,0)');
      g.fillStyle = grad; g.fillRect(0, 0, s, s);
    });
    T.metal = canvasTex(128, (g, s) => {
      g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 16) {
        const gr = g.createLinearGradient(x, 0, x + 16, 0);
        gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.5, '#f0f0f0'); gr.addColorStop(1, '#9a9a9a');
        g.fillStyle = gr; g.fillRect(x, 0, 16, s);
      }
      speckle(g, s, 300, ['#6b4a2e', '#8a6a4a'], 1, 4, 0.35);
    });
    T.wood = canvasTex(128, (g, s) => {
      g.fillStyle = '#8a6a40'; g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 21) {
        g.fillStyle = y % 42 ? '#7a5c36' : '#94744a'; g.fillRect(0, y, s, 19);
        g.fillStyle = '#4a361e'; g.fillRect(0, y + 19, s, 2);
      }
      speckle(g, s, 400, ['#5a4228', '#a08050'], 1, 6, 0.3);
      g.strokeStyle = '#3e2c16'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6);
    });
    T.sandbag = canvasTex(128, (g, s) => {
      g.fillStyle = '#8f7f5c'; g.fillRect(0, 0, s, s);
      for (let row = 0; row < 4; row++) {
        for (let i = -1; i < 3; i++) {
          const x = i * 64 + (row % 2) * 32, y = row * 32;
          const gr = g.createRadialGradient(x + 32, y + 16, 4, x + 32, y + 16, 34);
          gr.addColorStop(0, '#b3a27a'); gr.addColorStop(1, '#6d5f42');
          g.fillStyle = gr; g.beginPath(); g.ellipse(x + 32, y + 16, 31, 15, 0, 0, Math.PI * 2); g.fill();
        }
      }
    });
    T.ground = canvasTex(512, (g, s) => {
      g.fillStyle = '#6f6650'; g.fillRect(0, 0, s, s);
      speckle(g, s, 9000, ['#5f5743', '#7d7459', '#685f4a', '#857b5f'], 1, 4, 0.6);
      speckle(g, s, 120, ['#4d5a36', '#5a6640'], 8, 30, 0.25);
      speckle(g, s, 60, ['#4a4334'], 10, 40, 0.2);
    });
    T.asphalt = canvasTex(256, (g, s) => {
      g.fillStyle = '#3c3d3f'; g.fillRect(0, 0, s, s);
      speckle(g, s, 4000, ['#2f3032', '#4a4b4d', '#55565a'], 1, 2, 0.7);
      g.fillStyle = 'rgba(200,180,60,0.55)';
      g.fillRect(s / 2 - 3, 0, 6, s * 0.45);
    });
    T.dark = canvasTex(64, (g, s) => {
      g.fillStyle = '#444'; g.fillRect(0, 0, s, s);
      speckle(g, s, 300, ['#333', '#555'], 1, 3, 0.6);
    });
    return T;
  }

  function makeMaterials() {
    const T = makeTextures();
    const std = (map, color, rough = 0.9, metal = 0) => new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: metal });
    materials.concrete = { mat: std(T.concrete, 0xffffff), scale: 3 };
    materials.concreteDark = { mat: std(T.concrete, 0x9a9a9a), scale: 3 };
    materials.plaster = { mat: std(T.plaster, 0xffffff), scale: 3 };
    materials.plasterRed = { mat: std(T.plaster, 0xc98c6e), scale: 3 };
    materials.ctRed = { mat: std(T.metal, 0x9c3a2c, 0.6, 0.3), scale: 2.6 };
    materials.ctBlue = { mat: std(T.metal, 0x2d5a8a, 0.6, 0.3), scale: 2.6 };
    materials.ctGreen = { mat: std(T.metal, 0x3f6b3a, 0.6, 0.3), scale: 2.6 };
    materials.ctOrange = { mat: std(T.metal, 0xc0702a, 0.6, 0.3), scale: 2.6 };
    materials.wood = { mat: std(T.wood, 0xffffff), scale: 1.2 };
    materials.sandbag = { mat: std(T.sandbag, 0xffffff, 1), scale: 1.4 };
    materials.ground = { mat: std(T.ground, 0xffffff, 1), scale: 14 };
    materials.asphalt = { mat: std(T.asphalt, 0xffffff, 0.95), scale: 8 };
    materials.metalDark = { mat: std(T.dark, 0x777777, 0.5, 0.6), scale: 2 };
    materials.roof = { mat: std(T.concrete, 0x6b6660), scale: 4 };
  }

  // ---------- Geometry helpers ----------
  function addBox(x0, y0, z0, x1, y1, z1, mat, solid = true) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    const b = { x0, y0, z0, x1, y1, z1 };
    if (solid) boxes.push(b);
    (geoBatches[mat] = geoBatches[mat] || []).push(b);
    return b;
  }
  // Centered convenience: center x/z, base y, size w/h/d
  function block(cx, y, cz, w, h, d, mat, solid = true) {
    return addBox(cx - w / 2, y, cz - d / 2, cx + w / 2, y + h, cz + d / 2, mat, solid);
  }

  // A wall run along x or z with openings: [{at, width, bottom, top}]
  function wall(ax, az, bx, bz, y0, y1, thick, mat, openings = []) {
    const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
    const len = alongX ? Math.abs(bx - ax) : Math.abs(bz - az);
    const start = alongX ? Math.min(ax, bx) : Math.min(az, bz);
    const fixed = alongX ? az : ax;
    const ops = openings.slice().sort((a, b) => a.at - b.at);
    let cur = 0;
    const seg = (s0, s1, yy0, yy1) => {
      if (s1 - s0 < 0.01 || yy1 - yy0 < 0.01) return;
      if (alongX) addBox(start + s0, yy0, fixed - thick / 2, start + s1, yy1, fixed + thick / 2, mat);
      else addBox(fixed - thick / 2, yy0, start + s0, fixed + thick / 2, yy1, start + s1, mat);
    };
    for (const o of ops) {
      const o0 = o.at - o.width / 2, o1 = o.at + o.width / 2;
      seg(cur, o0, y0, y1);
      const bot = o.bottom || 0, top = o.top || 2.4;
      seg(o0, o1, y0, y0 + bot);
      seg(o0, o1, y0 + top, y1);
      cur = o1;
    }
    seg(cur, len, y0, y1);
  }

  // Rectangular building shell. doors/windows: {side:'n'|'s'|'e'|'w', at (0..1 along side), width, bottom, top}
  function building(cx, cz, w, d, h, mat, openings, roof = true, floorY = 0) {
    const t = 0.3;
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const bySide = s => openings.filter(o => o.side === s).map(o => ({ ...o, at: o.at * (s === 'n' || s === 's' ? w : d) }));
    wall(x0, z0, x1, z0, floorY, floorY + h, t, mat, bySide('n'));
    wall(x0, z1, x1, z1, floorY, floorY + h, t, mat, bySide('s'));
    wall(x0, z0 + t / 2, x0, z1 - t / 2, floorY, floorY + h, t, mat, bySide('w').map(o => ({ ...o, at: o.at - t / 2 })));
    wall(x1, z0 + t / 2, x1, z1 - t / 2, floorY, floorY + h, t, mat, bySide('e').map(o => ({ ...o, at: o.at - t / 2 })));
    if (roof) addBox(x0 - 0.2, floorY + h, z0 - 0.2, x1 + 0.2, floorY + h + 0.3, z1 + 0.2, 'roof');
  }

  // Straight staircase rising from (x,z) along dir ('+x','-x','+z','-z').
  function stairs(x, z, dir, width, rise, steps, mat) {
    const run = 0.45, stepH = rise / steps;
    for (let i = 0; i < steps; i++) {
      const top = stepH * (i + 1);
      const a = i * run, b2 = (i + 1) * run;
      if (dir === '+x') addBox(x + a, 0, z - width / 2, x + b2, top, z + width / 2, mat);
      if (dir === '-x') addBox(x - b2, 0, z - width / 2, x - a, top, z + width / 2, mat);
      if (dir === '+z') addBox(x - width / 2, 0, z + a, x + width / 2, top, z + b2, mat);
      if (dir === '-z') addBox(x - width / 2, 0, z - b2, x + width / 2, top, z - a, mat);
    }
    return steps * run;
  }

  function container(cx, cz, rotZ, y, mat) {
    // rotZ false: long along x
    if (rotZ) block(cx, y, cz, 2.44, 2.6, 6.1, mat);
    else block(cx, y, cz, 6.1, 2.6, 2.44, mat);
  }

  function sandbags(cx, cz, len, alongX, h = 1.05) {
    if (alongX) block(cx, 0, cz, len, h, 0.8, 'sandbag');
    else block(cx, 0, cz, 0.8, h, len, 'sandbag');
  }

  function barrier(cx, cz, alongX) {
    if (alongX) { block(cx, 0, cz, 3, 0.35, 0.8, 'concrete'); block(cx, 0.35, cz, 3, 0.75, 0.35, 'concrete'); }
    else { block(cx, 0, cz, 0.8, 0.35, 3, 'concrete'); block(cx, 0.35, cz, 0.35, 0.75, 3, 'concrete'); }
  }

  function crate(cx, cz, s = 1.2, y = 0) { block(cx, y, cz, s, s, s, 'wood'); }

  function tower(cx, cz, stairDir) {
    const H = 5.4, S = 4.2;
    // legs
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) block(cx + dx * (S / 2 - 0.2), 0, cz + dz * (S / 2 - 0.2), 0.35, H, 0.35, 'metalDark');
    addBox(cx - S / 2, H, cz - S / 2, cx + S / 2, H + 0.25, cz + S / 2, 'wood');
    // railing (cover) with a gap where the stairs arrive
    const r = 1.1, t = 0.18, y = H + 0.25;
    const sides = { n: [cx - S / 2, cz - S / 2, cx + S / 2, cz - S / 2 + t], s: [cx - S / 2, cz + S / 2 - t, cx + S / 2, cz + S / 2],
      w: [cx - S / 2, cz - S / 2, cx - S / 2 + t, cz + S / 2], e: [cx + S / 2 - t, cz - S / 2, cx + S / 2, cz + S / 2] };
    const gap = { '+x': 'w', '-x': 'e', '+z': 'n', '-z': 's' }[stairDir];
    for (const k in sides) if (k !== gap) { const v = sides[k]; addBox(v[0], y, v[1], v[2], y + r, v[3], 'wood'); }
    // roof
    addBox(cx - S / 2 - 0.3, H + 2.9, cz - S / 2 - 0.3, cx + S / 2 + 0.3, H + 3.1, cz + S / 2 + 0.3, 'metalDark');
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) block(cx + dx * (S / 2 - 0.1), y, cz + dz * (S / 2 - 0.1), 0.15, 2.65, 0.15, 'metalDark');
    // stairs come up to the platform from outside
    const steps = 18;
    const run = 0.45 * steps;
    if (stairDir === '+x') stairs(cx - S / 2 - run, cz, '+x', 1.4, H + 0.25, steps, 'metalDark');
    if (stairDir === '-x') stairs(cx + S / 2 + run, cz, '-x', 1.4, H + 0.25, steps, 'metalDark');
    if (stairDir === '+z') stairs(cx, cz - S / 2 - run, '+z', 1.4, H + 0.25, steps, 'metalDark');
    if (stairDir === '-z') stairs(cx, cz + S / 2 + run, '-z', 1.4, H + 0.25, steps, 'metalDark');
    perches.push({ x: cx, y: H + 0.25, z: cz });
  }

  function buildLayout() {
    // Ground + roads
    addBox(-HALF - 40, -1, -HALF - 40, HALF + 40, 0, HALF + 40, 'ground');
    addBox(-HALF, 0, -3, HALF, 0.02, 3, 'asphalt', false);
    addBox(-3, 0, -HALF, 3, 0.02, HALF, 'asphalt', false);

    // Perimeter walls
    const W = 5;
    addBox(-HALF - 1, 0, -HALF - 1, HALF + 1, W, -HALF, 'concreteDark');
    addBox(-HALF - 1, 0, HALF, HALF + 1, W, HALF + 1, 'concreteDark');
    addBox(-HALF - 1, 0, -HALF, -HALF, W, HALF, 'concreteDark');
    addBox(HALF, 0, -HALF, HALF + 1, W, HALF, 'concreteDark');

    // ---- HQ: two-storey command building in the middle
    const hx = 0, hz = -8, hw = 18, hd = 12, fh = 3.6;
    building(hx, hz, hw, hd, fh + 0.3, 'plaster', [
      { side: 's', at: 0.5, width: 2.2 }, { side: 'n', at: 0.5, width: 2.2 },
      { side: 'e', at: 0.35, width: 1.8 }, { side: 'w', at: 0.65, width: 1.8 },
      { side: 's', at: 0.2, width: 1.6, bottom: 1.0, top: 2.2 }, { side: 's', at: 0.8, width: 1.6, bottom: 1.0, top: 2.2 },
      { side: 'n', at: 0.2, width: 1.6, bottom: 1.0, top: 2.2 }, { side: 'n', at: 0.8, width: 1.6, bottom: 1.0, top: 2.2 },
    ], false);
    // first-floor slab with a stairwell opening along the west wall
    const sx0 = hx - hw / 2 + 0.15, slabY = fh;
    const stairLen = stairs(sx0 + 0.2, hz + hd / 2 - 1.6, '+x', 2.0, fh + 0.3, 12, 'concrete');
    addBox(sx0, slabY, hz - hd / 2 + 0.15, hx + hw / 2 - 0.15, slabY + 0.3, hz + hd / 2 - 2.8, 'concrete');
    addBox(sx0 + stairLen + 0.4, slabY, hz + hd / 2 - 2.8, hx + hw / 2 - 0.15, slabY + 0.3, hz + hd / 2 - 0.15, 'concrete');
    // stair rail
    addBox(sx0 + 0.2, slabY + 0.3, hz + hd / 2 - 2.85, sx0 + stairLen + 0.4, slabY + 1.3, hz + hd / 2 - 2.7, 'metalDark');
    building(hx, hz, hw, hd, 3.2, 'plaster', [
      { side: 's', at: 0.2, width: 2, bottom: 0.9, top: 2.2 }, { side: 's', at: 0.5, width: 2.4, bottom: 0.9, top: 2.2 }, { side: 's', at: 0.8, width: 2, bottom: 0.9, top: 2.2 },
      { side: 'n', at: 0.2, width: 2, bottom: 0.9, top: 2.2 }, { side: 'n', at: 0.5, width: 2.4, bottom: 0.9, top: 2.2 }, { side: 'n', at: 0.8, width: 2, bottom: 0.9, top: 2.2 },
      { side: 'e', at: 0.5, width: 2.4, bottom: 0.9, top: 2.2 }, { side: 'w', at: 0.3, width: 2.0, bottom: 0.9, top: 2.2 },
    ], true, fh + 0.3);
    // interior cover
    crate(hx + 5, hz - 2); crate(hx + 5, hz - 0.8, 1.0); crate(hx - 3, hz - 3.5);
    block(hx + 3, slabY + 0.3, hz - 3, 3, 1.0, 0.8, 'wood');
    crateSpots.push({ x: hx + 6.5, z: hz + 3 }, { x: hx - 6, z: hz - 4 });

    // ---- Warehouses
    building(-36, -18, 20, 14, 5.5, 'plasterRed', [
      { side: 'e', at: 0.5, width: 4.5, top: 4 }, { side: 'w', at: 0.5, width: 4.5, top: 4 },
      { side: 's', at: 0.25, width: 1.6 }, { side: 'n', at: 0.75, width: 1.6 },
      { side: 's', at: 0.7, width: 2.5, bottom: 1.4, top: 2.6 }, { side: 'n', at: 0.3, width: 2.5, bottom: 1.4, top: 2.6 },
    ]);
    crate(-40, -21); crate(-40, -19.6); crate(-40, -21, 1.2, 1.2); block(-32, 0, -14, 4, 1.4, 1.2, 'wood');
    container(-31, -22, false, 0, 'ctBlue');
    crateSpots.push({ x: -43, z: -14 }, { x: -30, z: -16 });

    building(36, 18, 20, 14, 5.5, 'plasterRed', [
      { side: 'n', at: 0.5, width: 4.5, top: 4 }, { side: 's', at: 0.5, width: 4.5, top: 4 },
      { side: 'e', at: 0.3, width: 1.6 }, { side: 'w', at: 0.7, width: 1.6 },
      { side: 'e', at: 0.75, width: 2.5, bottom: 1.4, top: 2.6 }, { side: 'w', at: 0.25, width: 2.5, bottom: 1.4, top: 2.6 },
    ]);
    crate(32, 14); crate(33.2, 14); crate(32.6, 14, 1.0, 1.2); block(40, 0, 21, 1.2, 1.4, 4, 'wood');
    container(41, 14, true, 0, 'ctGreen');
    crateSpots.push({ x: 30, z: 22 }, { x: 43, z: 22 });

    // ---- Small houses
    const house = (cx, cz, door, mat) => {
      const ops = [{ side: door, at: 0.5, width: 1.4 }];
      for (const s of ['n', 's', 'e', 'w']) if (s !== door) ops.push({ side: s, at: 0.5, width: 1.6, bottom: 1.0, top: 2.1 });
      building(cx, cz, 8, 8, 3.2, mat, ops);
      crateSpots.push({ x: cx + 2, z: cz + 2 });
    };
    house(-30, 30, 'e', 'plaster');
    house(-44, 44, 'n', 'plasterRed');
    house(28, -34, 'w', 'plaster');
    house(-12, -44, 's', 'plasterRed');
    house(14, 44, 'n', 'plaster');

    // ---- Container yard (north-east)
    const yard = [
      [24, -50, false, 'ctRed'], [24, -50, false, 'ctBlue', 2.6], [31, -50, false, 'ctGreen'],
      [40, -50, false, 'ctOrange'], [40, -50, false, 'ctRed', 2.6], [48, -54, true, 'ctBlue'],
      [24, -42, false, 'ctOrange'], [34, -42, false, 'ctBlue'], [34, -42, false, 'ctGreen', 2.6],
      [46, -42, false, 'ctRed'], [52, -30, true, 'ctGreen'], [52, -30, true, 'ctOrange', 2.6],
      [20, -24, true, 'ctBlue'], [46, -34, false, 'ctOrange'],
    ];
    for (const c of yard) container(c[0], c[1], c[2], c[4] || 0, c[3]);
    perches.push({ x: 24, y: 5.2, z: -50 }, { x: 34, y: 5.2, z: -42 });
    crateSpots.push({ x: 29, z: -46 }, { x: 41, z: -46 }, { x: 52, z: -46 });

    // ---- Container cluster (south-west)
    container(-24, 46, true, 0, 'ctOrange'); container(-18, 52, false, 0, 'ctBlue'); container(-18, 52, false, 2.6, 'ctRed');
    container(-52, 18, true, 0, 'ctGreen'); container(-52, 10, true, 0, 'ctRed');
    crateSpots.push({ x: -22, z: 52 }, { x: -48, z: 14 });

    // ---- Watchtowers in the corners (sniper perches)
    tower(-52, -52, '-z'); tower(52, 52, '+z'); tower(54, -14, '-z'); tower(-54, 32, '+z');

    // ---- Cover: sandbags, barriers, crates, low walls
    sandbags(0, 14, 6, true); sandbags(-8, 18, 4, false); sandbags(8, 18, 4, false);
    sandbags(-18, 4, 5, false); sandbags(18, -2, 5, false);
    sandbags(-14, -26, 6, true); sandbags(12, -28, 6, true);
    sandbags(-36, 2, 6, true); sandbags(36, -2, 6, true);
    sandbags(0, 34, 5, true); sandbags(-20, 22, 4, true); sandbags(22, 28, 4, false);
    barrier(-8, 26, true); barrier(8, 30, true); barrier(-26, -4, false); barrier(26, 6, false);
    barrier(-6, -30, true); barrier(6, -36, true); barrier(-46, -32, true); barrier(46, 34, false);
    barrier(0, 48, true); barrier(-36, 14, false); barrier(36, -12, false); barrier(14, 10, true);
    crate(-6, 6); crate(-6, 7.2); crate(-6, 6, 1.2, 1.2); crate(10, 2); crate(11.3, 2.4, 1.0);
    crate(-22, -36); crate(-21, -37.2); crate(20, 34); crate(-40, 4); crate(44, 4); crate(-2, 40); crate(30, -10);
    crate(-28, 12); crate(-27, 13.2, 1.0); crate(24, -16); crate(-14, 40);
    // ruined walls
    block(-26, 0, -42, 6, 2.2, 0.4, 'concrete'); block(-29, 0, -40, 0.4, 1.4, 4, 'concrete');
    block(36, 0, 40, 0.4, 2.2, 6, 'concrete'); block(38, 0, 43, 4, 1.3, 0.4, 'concrete');
    block(-46, 0, -2, 0.4, 2.2, 7, 'concrete'); block(46, 0, -22, 7, 1.6, 0.4, 'concrete');
    // fuel tanks
    block(-16, 0, -12, 2.6, 2.4, 2.6, 'metalDark'); block(-16, 0, -15.4, 2.6, 2.4, 2.6, 'metalDark');

    crateSpots.push(
      { x: 0, z: 22 }, { x: -18, z: 10 }, { x: 18, z: 4 }, { x: -12, z: -32 }, { x: 14, z: -22 },
      { x: -38, z: 8 }, { x: 40, z: 0 }, { x: -50, z: -40 }, { x: 50, z: 40 }, { x: 0, z: -52 }, { x: -2, z: 54 },
    );

    // Enemy spawn points around the edge of the map
    for (let i = -48; i <= 48; i += 12) {
      spawnPoints.push({ x: i, z: -57 }, { x: i, z: 57 }, { x: -57, z: i }, { x: 57, z: i });
    }
  }

  // ---------- Merge static geometry per material ----------
  function mergeBatches() {
    for (const key in geoBatches) {
      const list = geoBatches[key];
      const m = materials[key];
      const pos = [], nor = [], uv = [], idx = [];
      let vbase = 0;
      for (const b of list) {
        const w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0;
        const g = new THREE.BoxGeometry(w, h, d);
        const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
        for (let i = 0; i < p.count; i++) {
          const px = p.getX(i) + cx, py = p.getY(i) + cy, pz = p.getZ(i) + cz;
          pos.push(px, py, pz);
          const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
          nor.push(nx, ny, nz);
          // World-space planar UVs so textures keep a constant scale on any box size.
          let uu, vv;
          if (Math.abs(nx) > 0.5) { uu = pz; vv = py; }
          else if (Math.abs(ny) > 0.5) { uu = px; vv = pz; }
          else { uu = px; vv = py; }
          uv.push(uu / m.scale, vv / m.scale);
        }
        const gi = g.index;
        for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + vbase);
        vbase += p.count;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, m.mat);
      mesh.castShadow = key !== 'ground' && key !== 'asphalt';
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  // ---------- Scenery outside the walls ----------
  function scenery() {
    // Sky dome
    const skyGeo = new THREE.SphereGeometry(600, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3a5f8f) }, mid: { value: new THREE.Color(0xd9a77a) }, bot: { value: new THREE.Color(0x8a7a6a) } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = h>0.0 ? mix(mid, top, pow(h,0.6)) : mix(mid, bot, min(1.0,-h*4.0)); gl_FragColor = vec4(c,1.0); }',
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));
    // Sun disc
    const sun = new THREE.Mesh(new THREE.CircleGeometry(18, 24), new THREE.MeshBasicMaterial({ color: 0xffe2b0, fog: false }));
    sun.position.set(-260, 120, -380); sun.lookAt(0, 0, 0);
    scene.add(sun);
    // Distant hills
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5d5a4a, roughness: 1, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.1;
      const r = 220 + Math.random() * 120;
      const h = 30 + Math.random() * 60;
      const m = new THREE.Mesh(new THREE.ConeGeometry(40 + Math.random() * 50, h, 6), hillMat);
      m.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
      scene.add(m);
    }
    // Trees just outside the walls
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3825, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3d5230, roughness: 1, flatShading: true });
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 6);
    const leafGeo = new THREE.ConeGeometry(2.4, 6, 7);
    for (let i = 0; i < 120; i++) {
      const side = i % 4, along = (Math.random() * 2 - 1) * (HALF + 30);
      const out = HALF + 4 + Math.random() * 30;
      const x = side < 2 ? along : (side === 2 ? -out : out);
      const z = side < 2 ? (side === 0 ? -out : out) : along;
      const s = 0.8 + Math.random() * 0.8;
      const tr = new THREE.Mesh(trunkGeo, trunkMat); tr.position.set(x, 1.5 * s, z); tr.scale.setScalar(s);
      const lf = new THREE.Mesh(leafGeo, leafMat); lf.position.set(x, (3 + 2.6) * s, z); lf.scale.setScalar(s);
      scene.add(tr, lf);
    }
    // Floodlight poles inside for flavour
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 });
    for (const [x, z] of [[-20, 20], [20, -20], [-20, -20], [20, 20]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 9, 8), poleMat);
      p.position.set(x, 4.5, z); p.castShadow = true; scene.add(p);
      boxes.push({ x0: x - 0.15, y0: 0, z0: z - 0.15, x1: x + 0.15, y1: 9, z1: z + 0.15 });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe090, emissiveIntensity: 0.6 }));
      lamp.position.set(x, 9, z); scene.add(lamp);
    }
  }

  // ---------- Broadphase grid ----------
  const BP_CELL = 8, BP_MIN = -HALF - 8, BP_N = Math.ceil((HALF * 2 + 16) / BP_CELL);
  let bpCells = null, bpStamp = null, bpCounter = 0;
  function buildBroadphase() {
    bpCells = Array.from({ length: BP_N * BP_N }, () => []);
    bpStamp = new Uint32Array(boxes.length);
    boxes.forEach((b, i) => {
      b.i = i;
      const cx0 = clampI(Math.floor((b.x0 - BP_MIN) / BP_CELL)), cx1 = clampI(Math.floor((b.x1 - BP_MIN) / BP_CELL));
      const cz0 = clampI(Math.floor((b.z0 - BP_MIN) / BP_CELL)), cz1 = clampI(Math.floor((b.z1 - BP_MIN) / BP_CELL));
      for (let x = cx0; x <= cx1; x++) for (let z = cz0; z <= cz1; z++) bpCells[z * BP_N + x].push(b);
    });
  }
  function clampI(v) { return v < 0 ? 0 : v >= BP_N ? BP_N - 1 : v; }
  // Calls fn(box) for each box near the xz-range, without duplicates.
  function queryBoxes(x0, z0, x1, z1, out) {
    out.length = 0;
    bpCounter++;
    const cx0 = clampI(Math.floor((x0 - BP_MIN) / BP_CELL)), cx1 = clampI(Math.floor((x1 - BP_MIN) / BP_CELL));
    const cz0 = clampI(Math.floor((z0 - BP_MIN) / BP_CELL)), cz1 = clampI(Math.floor((z1 - BP_MIN) / BP_CELL));
    for (let x = cx0; x <= cx1; x++) for (let z = cz0; z <= cz1; z++) {
      const cell = bpCells[z * BP_N + x];
      for (let k = 0; k < cell.length; k++) {
        const b = cell[k];
        if (bpStamp[b.i] !== bpCounter) { bpStamp[b.i] = bpCounter; out.push(b); }
      }
    }
    return out;
  }

  // ---------- Ray casting ----------
  // Returns distance to first box hit along normalized dir, or Infinity. Writes normal into hitInfo if given.
  function raycast(ox, oy, oz, dx, dy, dz, maxT, hitInfo) {
    let best = maxT, bestBox = null;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      let tmin = 0, tmax = best;
      if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) continue; }
      else {
        const inv = 1 / dx; let t1 = (b.x0 - ox) * inv, t2 = (b.x1 - ox) * inv;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) continue;
      }
      if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) continue; }
      else {
        const inv = 1 / dy; let t1 = (b.y0 - oy) * inv, t2 = (b.y1 - oy) * inv;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) continue;
      }
      if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) continue; }
      else {
        const inv = 1 / dz; let t1 = (b.z0 - oz) * inv, t2 = (b.z1 - oz) * inv;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) continue;
      }
      if (tmin < best) { best = tmin; bestBox = b; }
    }
    if (hitInfo) {
      hitInfo.box = bestBox;
      if (bestBox) {
        const px = ox + dx * best, py = oy + dy * best, pz = oz + dz * best, b = bestBox, e = 0.002;
        hitInfo.nx = Math.abs(px - b.x0) < e ? -1 : Math.abs(px - b.x1) < e ? 1 : 0;
        hitInfo.ny = Math.abs(py - b.y0) < e ? -1 : Math.abs(py - b.y1) < e ? 1 : 0;
        hitInfo.nz = Math.abs(pz - b.z0) < e ? -1 : Math.abs(pz - b.z1) < e ? 1 : 0;
        if (!hitInfo.nx && !hitInfo.ny && !hitInfo.nz) hitInfo.ny = 1;
      }
    }
    return bestBox ? best : Infinity;
  }

  function lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return true;
    return raycast(ax, ay, az, dx / len, dy / len, dz / len, len) >= len - 0.05;
  }

  // Highest solid surface under (x,z) at or below y.
  function groundHeight(x, z, y) {
    let best = 0;
    for (const b of boxes) {
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= y + 0.01 && b.y1 > best) best = b.y1;
    }
    return best;
  }

  function overlapsAny(x0, y0, z0, x1, y1, z1, tmp) {
    queryBoxes(x0, z0, x1, z1, tmp);
    for (const b of tmp) if (x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0 && z0 < b.z1 && z1 > b.z0) return b;
    return null;
  }

  // ---------- Navigation flow field ----------
  const NAV_MIN = -HALF, NAV_N = HALF * 2;   // 1m cells
  const blocked = new Uint8Array(NAV_N * NAV_N);
  const dist = new Int32Array(NAV_N * NAV_N);
  const queue = new Int32Array(NAV_N * NAV_N);
  const NAV_FAR = 1e9;
  function buildNav() {
    const pad = 0.45;
    for (const b of boxes) {
      if (b.y1 < 0.3 || b.y0 > 1.6) continue; // floor-level or overhead
      const x0 = Math.floor(b.x0 - pad - NAV_MIN), x1 = Math.floor(b.x1 + pad - NAV_MIN);
      const z0 = Math.floor(b.z0 - pad - NAV_MIN), z1 = Math.floor(b.z1 + pad - NAV_MIN);
      for (let x = Math.max(0, x0); x <= Math.min(NAV_N - 1, x1); x++)
        for (let z = Math.max(0, z0); z <= Math.min(NAV_N - 1, z1); z++) {
          // cell center must actually be inside the padded box
          const cx = x + NAV_MIN + 0.5, cz = z + NAV_MIN + 0.5;
          if (cx > b.x0 - pad && cx < b.x1 + pad && cz > b.z0 - pad && cz < b.z1 + pad) blocked[z * NAV_N + x] = 1;
        }
    }
    for (let i = 0; i < NAV_N; i++) { blocked[i] = blocked[(NAV_N - 1) * NAV_N + i] = blocked[i * NAV_N] = blocked[i * NAV_N + NAV_N - 1] = 1; }
  }
  function cellOf(x, z) {
    const cx = Math.floor(x - NAV_MIN), cz = Math.floor(z - NAV_MIN);
    if (cx < 0 || cz < 0 || cx >= NAV_N || cz >= NAV_N) return -1;
    return cz * NAV_N + cx;
  }
  function nearestFree(c) {
    if (c >= 0 && !blocked[c]) return c;
    const cx = c % NAV_N, cz = (c / NAV_N) | 0;
    for (let r = 1; r < 8; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= NAV_N || z >= NAV_N) continue;
      const k = z * NAV_N + x;
      if (!blocked[k]) return k;
    }
    return -1;
  }
  function computeFlow(tx, tz) {
    dist.fill(NAV_FAR);
    const start = nearestFree(cellOf(Math.max(NAV_MIN + 1, Math.min(-NAV_MIN - 1, tx)), Math.max(NAV_MIN + 1, Math.min(-NAV_MIN - 1, tz))));
    if (start < 0) return;
    let head = 0, tail = 0;
    dist[start] = 0; queue[tail++] = start;
    while (head < tail) {
      const c = queue[head++];
      const x = c % NAV_N, d = dist[c] + 1;
      if (x > 0 && !blocked[c - 1] && dist[c - 1] > d) { dist[c - 1] = d; queue[tail++] = c - 1; }
      if (x < NAV_N - 1 && !blocked[c + 1] && dist[c + 1] > d) { dist[c + 1] = d; queue[tail++] = c + 1; }
      if (c >= NAV_N && !blocked[c - NAV_N] && dist[c - NAV_N] > d) { dist[c - NAV_N] = d; queue[tail++] = c - NAV_N; }
      if (c < NAV_N * (NAV_N - 1) && !blocked[c + NAV_N] && dist[c + NAV_N] > d) { dist[c + NAV_N] = d; queue[tail++] = c + NAV_N; }
    }
  }
  // Direction (unit xz) toward the lowest-distance neighbour. Returns null if no path.
  const NB = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  function flowDir(x, z, out) {
    let c = cellOf(x, z);
    if (c < 0) return null;
    if (blocked[c] || dist[c] >= NAV_FAR) { c = nearestFree(c); if (c < 0) return null; }
    const cx = c % NAV_N, cz = (c / NAV_N) | 0;
    let best = dist[c], bx = -1, bz = -1;
    for (const [dx, dz] of NB) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= NAV_N || nz >= NAV_N) continue;
      const k = nz * NAV_N + nx;
      if (blocked[k]) continue;
      if (dx && dz && (blocked[cz * NAV_N + nx] || blocked[nz * NAV_N + cx])) continue;
      const v = dist[k] + (dx && dz ? 0.4 : 0);
      if (v < best) { best = v; bx = nx; bz = nz; }
    }
    if (bx < 0) return null;
    const tx = bx + NAV_MIN + 0.5 - x, tz = bz + NAV_MIN + 0.5 - z;
    const l = Math.hypot(tx, tz) || 1;
    out.x = tx / l; out.z = tz / l;
    return out;
  }
  function isFree(x, z) { const c = cellOf(x, z); return c >= 0 && !blocked[c]; }

  function init(sc) {
    scene = sc;
    makeMaterials();
    buildLayout();
    mergeBatches();
    scenery();
    buildBroadphase();
    buildNav();
    // Only keep spawn/crate points that are walkable.
    for (const list of [spawnPoints, crateSpots]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (!isFree(p.x, p.z)) {
          const c = nearestFree(cellOf(p.x, p.z));
          if (c < 0) { list.splice(i, 1); continue; }
          p.x = (c % NAV_N) + NAV_MIN + 0.5; p.z = ((c / NAV_N) | 0) + NAV_MIN + 0.5;
        }
      }
    }
  }

  return { init, boxes, raycast, lineOfSight, groundHeight, overlapsAny, queryBoxes, computeFlow, flowDir, isFree, spawnPoints, crateSpots, perches, HALF };
})();
