'use strict';
// Synthesized sound effects (WebAudio), so the game ships with no audio files.

const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let lastPlay = {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { ctx = null; return; }
    master = ctx.createGain();
    master.gain.value = SAVE.settings.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function setVolume(v) { if (master) master.gain.value = v; }

  function throttle(key, ms) {
    const now = performance.now();
    if (lastPlay[key] && now - lastPlay[key] < ms) return true;
    lastPlay[key] = now;
    return false;
  }

  function noise(t, dur, filterType, freq, gain, q = 1, dest = master) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    return f;
  }

  function tone(t, dur, type, f0, f1, gain, dest = master) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // A distance-aware bus: far sounds are quieter and duller.
  function bus(dist) {
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = Math.max(600, 14000 - dist * 220);
    g.gain.value = Math.max(0.05, 1 / (1 + dist * 0.06));
    g.connect(f); f.connect(master);
    return g;
  }

  function gunshot(snd, suppressed) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const gm = suppressed ? 0.35 : 1;
    noise(t, snd.len * (suppressed ? 0.6 : 1), 'bandpass', suppressed ? snd.freq * 0.6 : snd.freq, snd.gain * gm, 0.8);
    noise(t, snd.len * 0.5, 'highpass', 3000, 0.15 * gm);
    tone(t, snd.len * 1.4, 'sine', snd.body * 1.6, snd.body * 0.5, 0.5 * gm);
    if (!suppressed) noise(t + 0.02, snd.len * 2.5, 'lowpass', 400, 0.18); // tail
  }

  function enemyShot(dist, heavy) {
    if (!ctx || throttle('eshot', 28)) return;
    const t = ctx.currentTime, b = bus(dist);
    noise(t, heavy ? 0.22 : 0.14, 'bandpass', heavy ? 600 : 1000, 0.5, 0.8, b);
    tone(t, 0.12, 'sine', 180, 60, 0.3, b);
  }

  function whizz() {
    if (!ctx || throttle('whizz', 80)) return;
    const t = ctx.currentTime;
    const f = noise(t, 0.12, 'bandpass', 2500, 0.18, 4);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.12);
  }

  function hitmarker(head) {
    if (!ctx || throttle('hit', 30)) return;
    const t = ctx.currentTime;
    if (head) { tone(t, 0.18, 'triangle', 1900, 1700, 0.25); tone(t, 0.12, 'square', 3800, 3800, 0.04); }
    else tone(t, 0.06, 'square', 1200, 900, 0.09);
  }

  function kill(head) {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 0.25, 'sine', 160, 50, 0.6);
    noise(t, 0.1, 'lowpass', 800, 0.3);
    if (head) tone(t + 0.02, 0.3, 'triangle', 2400, 2000, 0.18);
  }

  function hurt() {
    if (!ctx || throttle('hurt', 90)) return;
    const t = ctx.currentTime;
    tone(t, 0.12, 'sine', 120, 60, 0.4);
    noise(t, 0.08, 'lowpass', 600, 0.4);
  }

  function armorHit() {
    if (!ctx || throttle('armor', 70)) return;
    const t = ctx.currentTime;
    tone(t, 0.15, 'triangle', 700, 500, 0.12);
    noise(t, 0.06, 'highpass', 4000, 0.12);
  }

  function armorBreak() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.4, 'highpass', 2500, 0.5);
    tone(t, 0.3, 'square', 400, 120, 0.15);
  }

  function click(f = 2000, g = 0.12) {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.04, 'bandpass', f, g, 3);
  }

  function reload(dur) {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t + 0.05, 0.05, 'bandpass', 1500, 0.2, 3);
    noise(t + dur * 0.45, 0.06, 'bandpass', 900, 0.25, 3);
    noise(t + dur * 0.85, 0.05, 'bandpass', 2200, 0.25, 3);
    tone(t + dur * 0.85, 0.05, 'square', 600, 400, 0.05);
  }

  function dryFire() { click(3000, 0.15); }

  function explosion(dist = 0) {
    if (!ctx) return;
    const t = ctx.currentTime, b = bus(dist * 0.5);
    noise(t, 1.4, 'lowpass', 700, 1.2, 0.7, b);
    noise(t, 0.3, 'bandpass', 2000, 0.4, 0.5, b);
    tone(t, 0.9, 'sine', 90, 25, 1.0, b);
  }

  function pickup(rarity) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 520 + rarity * 90;
    tone(t, 0.15, 'triangle', base, base, 0.15);
    tone(t + 0.07, 0.2, 'triangle', base * 1.5, base * 1.5, 0.13);
    if (rarity >= 3) tone(t + 0.14, 0.4, 'sine', base * 2, base * 2, 0.15);
  }

  function streak() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [440, 554, 659, 880].forEach((f, i) => tone(t + i * 0.08, 0.35, 'sawtooth', f, f, 0.06));
  }

  function wave(start) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (start) { tone(t, 1.2, 'sawtooth', 110, 110, 0.12); tone(t, 1.2, 'sawtooth', 165, 165, 0.08); }
    else [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.1, 0.5, 'triangle', f, f, 0.12));
  }

  function knife() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = noise(t, 0.18, 'bandpass', 3000, 0.3, 2);
    f.frequency.exponentialRampToValueAtTime(800, t + 0.18);
  }

  function step(sprint) {
    if (!ctx || throttle('step', 180)) return;
    const t = ctx.currentTime;
    noise(t, 0.07, 'lowpass', sprint ? 500 : 350, sprint ? 0.12 : 0.07);
  }

  function ui() { click(1800, 0.08); }

  function beep(f = 880) {
    if (!ctx) return;
    tone(ctx.currentTime, 0.12, 'square', f, f, 0.06);
  }

  return { init, setVolume, gunshot, enemyShot, whizz, hitmarker, kill, hurt, armorHit, armorBreak, click, reload, dryFire, explosion, pickup, streak, wave, knife, step, ui, beep };
})();
