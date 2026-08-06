/**
 * Simulation → presentation event channel.
 *
 * The simulation never calls into the renderer, the HUD or the audio system
 * directly. It emits typed events; presentation layers subscribe. This is what
 * allows the entire fight to run headlessly in Node during automated tests —
 * with no subscribers attached, the events simply go nowhere.
 */

import { Vec3 } from './Vec3';

export type GameEventType =
  | 'hit'
  | 'block'
  | 'parry'
  | 'guardBreak'
  | 'comboEscape'
  | 'dodge'
  | 'dash'
  | 'jump'
  | 'land'
  | 'flightEnter'
  | 'flightExit'
  | 'wallImpact'
  | 'groundImpact'
  | 'pillarShatter'
  | 'projectileFired'
  | 'projectileImpact'
  | 'explosion'
  | 'charge'
  | 'chargeRelease'
  | 'abilityCast'
  | 'abilityRefused'
  | 'transformStart'
  | 'transformEnd'
  | 'ultimateStart'
  | 'ultimateImpact'
  | 'ultimateEnd'
  | 'knockout'
  | 'matchStart'
  | 'matchEnd'
  | 'roundReset'
  | 'lockOnChanged'
  | 'cameraShake';

export interface GameEvent {
  type: GameEventType;
  /** Index of the fighter the event originates from, or -1. */
  source: number;
  /** Index of the fighter the event targets, or -1. */
  target: number;
  /** World position, when meaningful. */
  position: Vec3;
  /** Direction, when meaningful (e.g. hit normal, knockback vector). */
  direction: Vec3;
  /** Generic magnitude: damage, shake intensity, impact speed. */
  magnitude: number;
  /** Free-form tag used to pick the VFX/SFX variant. */
  tag: string;
  /** Extra numeric payload (combo count, charge ratio, refusal code…). */
  value: number;
}

export type GameEventListener = (e: GameEvent) => void;

/**
 * Fixed-size ring of pooled event objects. Emitting never allocates, so a
 * ten-minute stability run produces zero GC pressure from the event channel.
 */
export class EventBus {
  private readonly pool: GameEvent[] = [];
  private cursor = 0;
  private readonly listeners = new Map<GameEventType | '*', Set<GameEventListener>>();
  /** Events emitted this frame, for tests and the debug overlay. */
  readonly thisFrame: GameEvent[] = [];

  constructor(poolSize = 256) {
    for (let i = 0; i < poolSize; i++) {
      this.pool.push({
        type: 'hit',
        source: -1,
        target: -1,
        position: new Vec3(),
        direction: new Vec3(),
        magnitude: 0,
        tag: '',
        value: 0,
      });
    }
  }

  on(type: GameEventType | '*', fn: GameEventListener): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit(
    type: GameEventType,
    opts: {
      source?: number;
      target?: number;
      position?: Vec3;
      direction?: Vec3;
      magnitude?: number;
      tag?: string;
      value?: number;
    } = {},
  ): void {
    const e = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    e.type = type;
    e.source = opts.source ?? -1;
    e.target = opts.target ?? -1;
    if (opts.position) e.position.copy(opts.position);
    else e.position.set(0, 0, 0);
    if (opts.direction) e.direction.copy(opts.direction);
    else e.direction.set(0, 0, 0);
    e.magnitude = opts.magnitude ?? 0;
    e.tag = opts.tag ?? '';
    e.value = opts.value ?? 0;

    this.thisFrame.push(e);
    const specific = this.listeners.get(type);
    if (specific) for (const fn of specific) fn(e);
    const all = this.listeners.get('*');
    if (all) for (const fn of all) fn(e);
  }

  /** Called by the simulation at the top of each frame. */
  beginFrame(): void {
    this.thisFrame.length = 0;
  }

  clearListeners(): void {
    this.listeners.clear();
  }
}
