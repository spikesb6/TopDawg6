'use strict';
// On-screen controls for phones and tablets: a floating move stick on the left, swipe-to-look on
// the right, and buttons that feed the same Input state the keyboard and mouse use.

const Touch = (() => {
  const BUTTONS = [
    { id: 'fire', label: 'FIRE' },
    { id: 'ads', label: 'AIM' },
    { id: 'jump', label: 'JUMP', key: 'Space' },
    { id: 'crouch', label: 'SLIDE', key: 'KeyC' },
    { id: 'reload', label: 'RELOAD', key: 'KeyR' },
    { id: 'swap', label: 'SWAP', key: 'KeyQ' },
    { id: 'nade', label: 'FRAG', key: 'KeyG' },
    { id: 'plate', label: 'PLATE', key: 'KeyF' },
    { id: 'use', label: 'USE', key: 'KeyE' },
    { id: 'melee', label: 'KNIFE', key: 'KeyV' },
    { id: 'bag', label: 'BAG', key: 'Tab' },
    { id: 'pause', label: 'II' },
    { id: 'skip', label: 'NEXT WAVE', key: 'Enter' },
  ];
  let layer, stick, knob;
  const ptrs = new Map(); // pointerId -> {kind, x, y, ox, oy, btn}
  const STICK_R = 52;

  function detect() {
    if (/[?&]touch\b/.test(location.search)) return true;
    try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
  }

  function init() {
    layer = document.getElementById('touch');
    layer.innerHTML = `<div id="t-stick" class="hidden"><i></i></div>` +
      BUTTONS.map(b => `<button class="tbtn" id="t-${b.id}" data-t="${b.id}">${b.label}</button>`).join('') +
      `<div id="t-rotate">Turn your phone sideways to play</div>`;
    stick = document.getElementById('t-stick');
    knob = stick.firstElementChild;
    layer.addEventListener('pointerdown', down);
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', up);
    layer.addEventListener('contextmenu', e => e.preventDefault());
    // Kill streak rewards are tapped straight from the HUD.
    document.getElementById('streakbar').addEventListener('pointerdown', e => {
      const ks = e.target.closest('.ks');
      if (ks && Game.state === 'playing') { e.preventDefault(); Game.useStreak(ks.id.slice(3)); }
    });
  }

  function down(e) {
    e.preventDefault();
    try { layer.setPointerCapture(e.pointerId); } catch (err) { /* touch pointers are captured implicitly */ }
    const btn = e.target.closest('.tbtn');
    const p = { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY };
    if (btn) {
      p.kind = 'btn'; p.btn = btn.dataset.t;
      btn.classList.add('on');
      press(p.btn);
    } else if (e.clientX < window.innerWidth * 0.42) {
      p.kind = 'stick';
      stick.classList.remove('hidden');
      stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px';
      knob.style.transform = 'translate(-50%,-50%)';
    } else p.kind = 'look';
    ptrs.set(e.pointerId, p);
  }

  function move(e) {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (p.kind === 'stick') {
      let vx = (p.x - p.ox) / STICK_R, vy = (p.y - p.oy) / STICK_R;
      const m = Math.hypot(vx, vy);
      Input.axis.sprint = m > 1.25 && vy < -0.8;
      if (m > 1) { vx /= m; vy /= m; }
      Input.axis.x = Math.abs(vx) < 0.12 ? 0 : vx;
      Input.axis.y = Math.abs(vy) < 0.12 ? 0 : -vy;
      knob.style.transform = `translate(calc(-50% + ${vx * STICK_R}px), calc(-50% + ${vy * STICK_R}px))`;
      stick.classList.toggle('sprint', Input.axis.sprint);
    } else if (p.kind === 'look' || (p.kind === 'btn' && p.btn === 'fire')) {
      // Dragging on the look area or the fire button turns the camera.
      Input.addLook(dx * 1.5, dy * 1.5);
    }
  }

  function up(e) {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    ptrs.delete(e.pointerId);
    if (p.kind === 'stick') {
      Input.axis.x = Input.axis.y = 0; Input.axis.sprint = false;
      stick.classList.add('hidden');
    } else if (p.kind === 'btn') {
      const el = document.getElementById('t-' + p.btn);
      if (el) el.classList.remove('on');
      release(p.btn);
    }
  }

  function press(id) {
    if (id === 'fire') { Input.mouse.left = true; Input.mouse.leftPressed = true; return; }
    if (id === 'ads') { Input.mouse.right = !Input.mouse.right; document.getElementById('t-ads').classList.toggle('lit', Input.mouse.right); return; }
    if (id === 'pause') { Game.pause(); return; }
    const b = BUTTONS.find(b => b.id === id);
    if (b && b.key) Input.press(b.key);
  }
  function release(id) {
    if (id === 'fire') { Input.mouse.left = false; return; }
    const b = BUTTONS.find(b => b.id === id);
    if (b && b.key) Input.release(b.key);
  }

  function show(on) {
    layer.classList.toggle('hidden', !on);
    if (!on) {
      for (const [, p] of ptrs) if (p.kind === 'btn') release(p.btn);
      ptrs.clear();
      Input.axis.x = Input.axis.y = 0; Input.axis.sprint = false;
      Input.mouse.left = Input.mouse.right = false;
      stick.classList.add('hidden');
      document.getElementById('t-ads').classList.remove('lit');
    }
  }

  return { detect, init, show };
})();
