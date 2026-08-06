/**
 * Headless match runner.
 *
 * Drives a full Simulation with no renderer, no DOM and no GPU, at whatever
 * speed the CPU allows. This is the backbone of the Gauntlet Loop: every
 * acceptance test, the ten-minute stability run and all AI-vs-AI validation go
 * through here.
 */

import { Simulation, MatchPhase, type SimulationOptions } from '../gameplay/Simulation';
import { FighterAI } from '../ai/FighterAI';
import { emptyInputFrame, type InputFrame, type ActionName } from '../core/Input';
import type { CharacterData } from '../characters/CharacterData';
import type { GameEvent } from '../core/Events';

/** A scripted controller: given the sim and frame, produce an input frame. */
export type Controller = (sim: Simulation, frame: number) => InputFrame;

export interface HeadlessOptions extends SimulationOptions {
  /** Difficulty for any AI-controlled side. */
  difficultyA?: string;
  difficultyB?: string;
  /** Record every emitted event. Off by default (long runs get huge). */
  recordEvents?: boolean;
  /** Called every frame; return true to stop early. */
  onFrame?: (sim: Simulation, frame: number) => boolean | void;
}

export interface RunReport {
  frames: number;
  wallMs: number;
  /** Frames simulated per second of wall clock. */
  fps: number;
  phase: MatchPhase;
  winner: number;
  reason: string;
  health: [number, number];
  bestCombo: [number, number];
  damageDealt: [number, number];
  peakProjectiles: number;
  events: Record<string, number>;
  warnings: string[];
  /** Per-fighter tally of frames spent in each state — used by feel tests. */
  stateHistogram: [Record<string, number>, Record<string, number>];
  eventLog?: GameEvent[];
}

export class HeadlessMatch {
  readonly sim: Simulation;
  readonly aiA: FighterAI | null;
  readonly aiB: FighterAI | null;

  private readonly neutral = emptyInputFrame();
  private readonly eventCounts: Record<string, number> = {};
  private readonly eventLog: GameEvent[] = [];
  private readonly warnings: string[] = [];
  private peakProjectiles = 0;
  private readonly stateHist: [Record<string, number>, Record<string, number>] = [{}, {}];

  constructor(
    charA: CharacterData,
    charB: CharacterData,
    private readonly controllerA: Controller | 'ai',
    private readonly controllerB: Controller | 'ai',
    private readonly opts: HeadlessOptions = {},
  ) {
    this.sim = new Simulation(charA, charB, opts);
    // AI seeds are DERIVED from the run seed. Hardcoding them would make every
    // match with the same difficulty byte-identical, which silently turns a
    // 24-match balance sweep into one match reported 24 times.
    const baseSeed = (opts.seed ?? 0x1a2b3c4d) >>> 0;
    this.aiA =
      controllerA === 'ai'
        ? new FighterAI(
            this.sim.fighters[0],
            this.sim.fighters[1],
            opts.difficultyA,
            (baseSeed ^ 0xa11ce5) >>> 0,
          )
        : null;
    this.aiB =
      controllerB === 'ai'
        ? new FighterAI(
            this.sim.fighters[1],
            this.sim.fighters[0],
            opts.difficultyB,
            (baseSeed ^ 0x0b0bcafe) >>> 0,
          )
        : null;

    this.sim.events.on('*', (e) => {
      this.eventCounts[e.type] = (this.eventCounts[e.type] ?? 0) + 1;
      if (opts.recordEvents) {
        this.eventLog.push({
          ...e,
          position: e.position.clone(),
          direction: e.direction.clone(),
        });
      }
    });

    // Capture engine warnings so tests can assert on invalid-state recovery.
    const origWarn = console.warn;
    this.restoreWarn = () => {
      console.warn = origWarn;
    };
    console.warn = (...args: unknown[]) => {
      this.warnings.push(args.map(String).join(' '));
      if (this.warnings.length < 40) origWarn(...args);
    };
  }

  private readonly restoreWarn: () => void;

  /** Runs until the match resolves or `maxFrames` elapses. */
  run(maxFrames = 60 * 60 * 12): RunReport {
    const t0 = performance.now();
    let frame = 0;
    try {
      for (; frame < maxFrames; frame++) {
        const inA = this.aiA ? this.aiA.think() : (this.controllerA as Controller)(this.sim, frame);
        const inB = this.aiB ? this.aiB.think() : (this.controllerB as Controller)(this.sim, frame);
        this.sim.tick(inA ?? this.neutral, inB ?? this.neutral);

        const n = this.sim.projectiles.activeCount;
        if (n > this.peakProjectiles) this.peakProjectiles = n;
        for (let i = 0; i < 2; i++) {
          const s = this.sim.fighters[i].state;
          this.stateHist[i][s] = (this.stateHist[i][s] ?? 0) + 1;
        }

        if (this.opts.onFrame?.(this.sim, frame) === true) break;
        if (this.sim.phase === MatchPhase.Victory) break;
      }
    } finally {
      this.restoreWarn();
    }
    const wallMs = performance.now() - t0;

    return {
      frames: frame,
      wallMs,
      fps: frame / (wallMs / 1000),
      phase: this.sim.phase,
      winner: this.sim.result?.winnerIndex ?? -2,
      reason: this.sim.result?.reason ?? 'unresolved',
      health: [
        Math.round(this.sim.fighters[0].health.current),
        Math.round(this.sim.fighters[1].health.current),
      ],
      bestCombo: [this.sim.fighters[0].combo.best, this.sim.fighters[1].combo.best],
      damageDealt: [
        Math.round(this.sim.damageDealt[0]),
        Math.round(this.sim.damageDealt[1]),
      ],
      peakProjectiles: this.peakProjectiles,
      events: { ...this.eventCounts },
      warnings: this.warnings,
      stateHistogram: this.stateHist,
      eventLog: this.opts.recordEvents ? this.eventLog : undefined,
    };
  }
}

// =====================================================================
// Controller helpers — these make scripted acceptance tests readable
// =====================================================================

/** A controller that does nothing. */
export const idleController: Controller = () => emptyInputFrame();

/** Builds a controller from a frame-indexed script of held actions. */
export function scripted(
  script: Array<{ at: number; hold?: ActionName[]; moveX?: number; moveZ?: number; frames?: number }>,
): Controller {
  return (_sim, frame) => {
    const f = emptyInputFrame();
    for (const step of script) {
      const len = step.frames ?? 1;
      if (frame >= step.at && frame < step.at + len) {
        for (const a of step.hold ?? []) f.held[a] = true;
        if (step.moveX !== undefined) f.moveX = step.moveX;
        if (step.moveZ !== undefined) f.moveZ = step.moveZ;
      }
    }
    return f;
  };
}

/** Holds a set of actions for the whole run. */
export function holding(...actions: ActionName[]): Controller {
  return () => {
    const f = emptyInputFrame();
    for (const a of actions) f.held[a] = true;
    return f;
  };
}

/** Mashes an action with a given period, so buffering behaves realistically. */
export function mashing(action: ActionName, period = 12): Controller {
  return (_sim, frame) => {
    const f = emptyInputFrame();
    f.held[action] = frame % period < 2;
    return f;
  };
}

/** Walks toward the opponent, mashing an action once in range. */
export function pressure(action: ActionName, range = 2.2, period = 10): Controller {
  return (sim, frame) => {
    const f = emptyInputFrame();
    const me = sim.fighters[0];
    const them = sim.fighters[1];
    const dx = them.position.x - me.position.x;
    const dz = them.position.z - me.position.z;
    const d = Math.hypot(dx, dz);
    if (d > range) {
      f.moveX = dx / (d || 1);
      f.moveZ = dz / (d || 1);
    }
    if (d <= range + 0.6) f.held[action] = frame % period < 2;
    return f;
  };
}

/** Combines controllers; later ones override held actions set by earlier ones. */
export function combine(...cs: Controller[]): Controller {
  return (sim, frame) => {
    const out = emptyInputFrame();
    for (const c of cs) {
      const f = c(sim, frame);
      if (f.moveX !== 0) out.moveX = f.moveX;
      if (f.moveZ !== 0) out.moveZ = f.moveZ;
      for (const k in f.held) {
        const a = k as ActionName;
        if (f.held[a]) out.held[a] = true;
      }
    }
    return out;
  };
}
