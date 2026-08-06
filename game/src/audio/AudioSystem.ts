/**
 * Procedural audio.
 *
 * Every sound in KAIRO: ASCENSION is synthesised at runtime from oscillators
 * and shaped noise. Nothing is sampled, downloaded or licensed, which makes the
 * originality position unambiguous: there is no third-party audio in the build
 * to be infringing.
 *
 * It also happens to suit a fighting game. Impact sounds are generated per hit
 * with pitch and body derived from the attack's own damage and hitstop, so a
 * light jab and a charged heavy are audibly different without anyone authoring
 * two clips — and a new attack gets a fitting sound for free.
 *
 * The architecture mirrors a normal game audio setup: a master bus, three
 * submixes (sfx / impacts / music) with independent gain, and a soft limiter on
 * the master so overlapping ultimates cannot clip.
 */

export type SfxTag =
  | 'hit_light'
  | 'hit_medium'
  | 'hit_heavy'
  | 'hit_launch'
  | 'block'
  | 'parry'
  | 'guardBreak'
  | 'dodge'
  | 'dash'
  | 'jump'
  | 'land'
  | 'flight'
  | 'charge'
  | 'bolt'
  | 'spear'
  | 'starfall'
  | 'blackstar'
  | 'explosion'
  | 'transform'
  | 'ultimate'
  | 'knockout'
  | 'uiMove'
  | 'uiConfirm'
  | 'uiBack'
  | 'wallImpact'
  | 'groundImpact';

interface Buses {
  master: GainNode;
  sfx: GainNode;
  impact: GainNode;
  music: GainNode;
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private buses: Buses | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private started = false;

  /** Ambient drone nodes, stopped on dispose. */
  private ambient: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  volumes = { master: 0.65, sfx: 1, impact: 1, music: 0.5 };
  muted = false;

  /**
   * Must be called from a user gesture — browsers refuse to start an
   * AudioContext otherwise. Safe to call repeatedly.
   */
  async start(): Promise<void> {
    if (this.started) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const master = this.ctx.createGain();
    // Soft limiter: stops stacked ultimates from clipping into distortion.
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 12;
    limiter.ratio.value = 9;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    master.connect(limiter);
    limiter.connect(this.ctx.destination);

    const mk = () => {
      const g = this.ctx!.createGain();
      g.connect(master);
      return g;
    };
    this.buses = { master, sfx: mk(), impact: mk(), music: mk() };
    this.applyVolumes();

    // Pre-baked white-noise buffer, reused by every noise-based sound.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (seed / 2147483648 - 1) * 0.85;
    }
    this.noiseBuffer = buf;

    this.started = true;
    this.startAmbient();
  }

  get isRunning(): boolean {
    return this.started && this.ctx?.state === 'running';
  }

  applyVolumes(): void {
    if (!this.buses) return;
    const m = this.muted ? 0 : this.volumes.master;
    this.buses.master.gain.value = m;
    this.buses.sfx.gain.value = this.volumes.sfx * 0.55;
    this.buses.impact.gain.value = this.volumes.impact * 0.8;
    this.buses.music.gain.value = this.volumes.music * 0.3;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
  }

  // =====================================================================
  // Primitives
  // =====================================================================

  private now(): number {
    return this.ctx!.currentTime;
  }

  private noise(
    bus: GainNode,
    duration: number,
    gain: number,
    filterType: BiquadFilterType,
    freq: number,
    q = 1,
    sweepTo?: number,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = freq;
    filt.Q.value = q;
    if (sweepTo !== undefined) {
      filt.frequency.setValueAtTime(freq, this.now());
      filt.frequency.exponentialRampToValueAtTime(
        Math.max(40, sweepTo),
        this.now() + duration,
      );
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, this.now());
    g.gain.linearRampToValueAtTime(gain, this.now() + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, this.now() + duration);
    src.connect(filt);
    filt.connect(g);
    g.connect(bus);
    src.start();
    src.stop(this.now() + duration + 0.02);
  }

  private tone(
    bus: GainNode,
    type: OscillatorType,
    freq: number,
    endFreq: number,
    duration: number,
    gain: number,
    delay = 0,
  ): void {
    const ctx = this.ctx!;
    const t = this.now() + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // =====================================================================
  // Game sounds
  // =====================================================================

  /**
   * Plays a sound.
   *
   * `intensity` (0..1) scales weight and pitch, so the SAME tag covers a jab
   * and a charged heavy. `pitch` applies the character's timbre offset, which
   * is how Kairo and Veyron sound different without separate sound sets.
   */
  play(tag: SfxTag, intensity = 0.5, pitch = 1): void {
    if (!this.isRunning || !this.buses) return;
    const b = this.buses;
    const i = Math.max(0, Math.min(1, intensity));

    switch (tag) {
      case 'hit_light':
        this.noise(b.impact, 0.07 + i * 0.05, 0.5 + i * 0.3, 'bandpass', 1500 * pitch, 1.4, 600);
        this.tone(b.impact, 'triangle', 320 * pitch, 130 * pitch, 0.09, 0.28 + i * 0.2);
        break;
      case 'hit_medium':
        this.noise(b.impact, 0.11 + i * 0.06, 0.62 + i * 0.3, 'bandpass', 1050 * pitch, 1.1, 380);
        this.tone(b.impact, 'triangle', 240 * pitch, 88 * pitch, 0.14, 0.36 + i * 0.22);
        break;
      case 'hit_heavy':
      case 'wallImpact':
      case 'groundImpact':
        // Body + crack + sub: three layers is what makes an impact feel heavy.
        this.noise(b.impact, 0.2 + i * 0.12, 0.7 + i * 0.3, 'lowpass', 900 * pitch, 0.8, 140);
        this.tone(b.impact, 'square', 160 * pitch, 46 * pitch, 0.2, 0.3 + i * 0.25);
        this.tone(b.impact, 'sine', 88 * pitch, 32, 0.34, 0.4 + i * 0.3);
        break;
      case 'hit_launch':
        this.noise(b.impact, 0.16, 0.6, 'bandpass', 900 * pitch, 1.2, 2400);
        this.tone(b.impact, 'sawtooth', 180 * pitch, 620 * pitch, 0.26, 0.28);
        this.tone(b.impact, 'sine', 90, 40, 0.3, 0.34);
        break;
      case 'block':
        this.noise(b.impact, 0.09, 0.42, 'bandpass', 2600, 3.2, 1400);
        this.tone(b.impact, 'square', 420, 300, 0.07, 0.16);
        break;
      case 'parry':
        // A bright, unmistakable chime — the audio half of "you nailed it".
        this.tone(b.impact, 'triangle', 1180, 1760, 0.14, 0.3);
        this.tone(b.impact, 'sine', 2360, 3100, 0.22, 0.18, 0.01);
        this.noise(b.impact, 0.1, 0.3, 'highpass', 3400, 1);
        break;
      case 'guardBreak':
        this.noise(b.impact, 0.34, 0.7, 'lowpass', 1600, 0.7, 200);
        this.tone(b.impact, 'sawtooth', 300, 70, 0.36, 0.32);
        break;
      case 'dodge':
        this.noise(b.sfx, 0.16, 0.3, 'bandpass', 2400 * pitch, 2.2, 700);
        break;
      case 'dash':
        this.noise(b.sfx, 0.2, 0.4, 'bandpass', 1500 * pitch, 1.6, 3200);
        this.tone(b.sfx, 'sine', 300 * pitch, 900 * pitch, 0.16, 0.12);
        break;
      case 'jump':
        this.tone(b.sfx, 'sine', 260 * pitch, 520 * pitch, 0.13, 0.14);
        break;
      case 'land':
        this.noise(b.sfx, 0.14, 0.32 + i * 0.3, 'lowpass', 700, 0.9, 150);
        break;
      case 'flight':
        this.noise(b.sfx, 0.3, 0.22, 'bandpass', 700 * pitch, 1.1, 1800);
        this.tone(b.sfx, 'sine', 180 * pitch, 460 * pitch, 0.3, 0.1);
        break;
      case 'charge':
        this.tone(b.sfx, 'sawtooth', 130 * pitch, 210 * pitch, 0.3, 0.075);
        this.tone(b.sfx, 'sine', 520 * pitch, 780 * pitch, 0.26, 0.05);
        break;
      case 'bolt':
        this.tone(b.sfx, 'sawtooth', 900 * pitch, 260 * pitch, 0.24, 0.2);
        this.noise(b.sfx, 0.18, 0.25, 'bandpass', 1800 * pitch, 2, 600);
        break;
      case 'spear':
        this.tone(b.sfx, 'sawtooth', 420 * pitch, 1500 * pitch, 0.3, 0.22);
        this.noise(b.sfx, 0.24, 0.3, 'highpass', 1200, 1.4, 3800);
        break;
      case 'starfall':
        this.tone(b.sfx, 'triangle', 1400 * pitch, 700 * pitch, 0.16, 0.12);
        break;
      case 'blackstar':
      case 'explosion':
        this.noise(b.impact, 0.7, 0.75, 'lowpass', 1400, 0.6, 90);
        this.tone(b.impact, 'sine', 120, 24, 0.8, 0.45);
        this.tone(b.impact, 'sawtooth', 260, 40, 0.4, 0.2);
        break;
      case 'transform':
        // A rising, widening swell: three detuned saws plus a noise sweep.
        for (let k = 0; k < 3; k++) {
          this.tone(
            b.sfx,
            'sawtooth',
            (110 + k * 3) * pitch,
            (620 + k * 9) * pitch,
            1.15,
            0.11,
            k * 0.012,
          );
        }
        this.noise(b.sfx, 1.2, 0.4, 'bandpass', 400, 1.1, 5200);
        this.tone(b.impact, 'sine', 60, 180, 1.2, 0.3);
        break;
      case 'ultimate':
        for (let k = 0; k < 4; k++) {
          this.tone(
            b.sfx,
            k % 2 ? 'sawtooth' : 'square',
            (70 + k * 5) * pitch,
            (900 + k * 40) * pitch,
            1.5,
            0.1,
            k * 0.02,
          );
        }
        this.noise(b.impact, 1.6, 0.5, 'bandpass', 300, 0.9, 7000);
        this.tone(b.impact, 'sine', 48, 22, 1.9, 0.5);
        break;
      case 'knockout':
        this.noise(b.impact, 1.0, 0.8, 'lowpass', 1200, 0.7, 60);
        this.tone(b.impact, 'sine', 150, 20, 1.2, 0.5);
        this.tone(b.impact, 'sawtooth', 380, 60, 0.6, 0.2);
        break;
      case 'uiMove':
        this.tone(b.sfx, 'square', 660, 660, 0.045, 0.08);
        break;
      case 'uiConfirm':
        this.tone(b.sfx, 'triangle', 620, 990, 0.11, 0.14);
        break;
      case 'uiBack':
        this.tone(b.sfx, 'triangle', 520, 300, 0.11, 0.12);
        break;
    }
  }

  // =====================================================================
  // Ambience and music
  // =====================================================================

  /** A low, unresolved drone — the sound of a dead world still humming. */
  private startAmbient(): void {
    if (!this.ctx || !this.buses) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.1;
    g.connect(this.buses.music);
    const oscs: OscillatorNode[] = [];
    // A minor-second cluster, deliberately dissonant and slow-beating.
    for (const f of [55, 82.5, 110.6, 164.8]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = this.ctx.createGain();
      og.gain.value = 0.25;
      // Slow LFO so the drone breathes instead of sitting flat.
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.06 + Math.random() * 0.05;
      const lg = this.ctx.createGain();
      lg.gain.value = 0.13;
      lfo.connect(lg);
      lg.connect(og.gain);
      lfo.start();
      o.connect(og);
      og.connect(g);
      o.start();
      oscs.push(o, lfo);
    }
    this.ambient = { osc: oscs, gain: g };
  }

  /**
   * Battle pulse: a sparse, driving ostinato that raises intensity with the
   * fight. Original composition — a four-note minor figure generated in code.
   */
  startMusic(): void {
    if (!this.ctx || !this.buses || this.musicTimer !== null) return;
    const scale = [0, 3, 5, 7, 10, 12]; // minor pentatonic + octave
    const root = 110;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.isRunning || !this.buses) return;
      const s = this.musicStep++;
      const bus = this.buses.music;
      // Kick on the downbeat.
      if (s % 4 === 0) {
        this.tone(bus, 'sine', 110, 42, 0.2, 0.35);
        this.noise(bus, 0.05, 0.2, 'lowpass', 300, 1);
      }
      // Hat-ish tick.
      if (s % 2 === 1) this.noise(bus, 0.03, 0.09, 'highpass', 6500, 1);
      // Melodic figure every other bar.
      if (s % 8 === 2 || s % 8 === 5) {
        const n = scale[(s * 3) % scale.length];
        const f = root * Math.pow(2, n / 12);
        this.tone(bus, 'triangle', f, f, 0.26, 0.11);
        this.tone(bus, 'sine', f * 2, f * 2, 0.18, 0.05, 0.02);
      }
    }, 250);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** Ducks the music under an ultimate so the cinematic reads. */
  duck(seconds: number): void {
    if (!this.buses || !this.ctx) return;
    const g = this.buses.music.gain;
    const t = this.now();
    const target = this.volumes.music * 0.3;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(target * 0.12, t + 0.12);
    g.linearRampToValueAtTime(target, t + seconds);
  }

  dispose(): void {
    this.stopMusic();
    if (this.ambient) {
      for (const o of this.ambient.osc) {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
      }
      this.ambient = null;
    }
    this.ctx?.close();
    this.ctx = null;
    this.started = false;
  }
}
