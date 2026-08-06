/**
 * Ability framework — the KAIRO: ASCENSION equivalent of a GAS
 * UGameplayAbility, reduced to what a fighting game actually needs.
 *
 * An ability is pure data plus a `kind` tag. The AbilitySystem interprets the
 * tag; abilities themselves contain no logic. That keeps character files
 * declarative and means a designer can author a new special without touching
 * any system code.
 */

import type { AttackDef, AttackSpec } from './CombatTypes';
import { makeAttack } from './CombatTypes';

export enum AbilityKind {
  /** Fires one or more projectiles forward / at the lock-on target. */
  Projectile = 'Projectile',
  /** High-speed closing dash that transitions into a strike on contact. */
  Rush = 'Rush',
  /** A single heavy melee strike with special properties. */
  Strike = 'Strike',
  /** A timed stream of projectiles fired over a duration. */
  Barrage = 'Barrage',
  /** Defensive stance; punishes an attack received during the active window. */
  Counter = 'Counter',
  /** Radial explosion centred on the caster after a wind-up. */
  AreaBlast = 'AreaBlast',
  /** Cinematic ultimate: capture, camera sequence, massive payoff. */
  Ultimate = 'Ultimate',
}

/** How the ability behaves when the caster is interrupted mid-cast. */
export enum InterruptPolicy {
  /** Any hit cancels the ability and refunds nothing. */
  Cancellable = 'Cancellable',
  /** Startup has super armor; ability completes anyway. */
  Armored = 'Armored',
  /** Fully uninterruptible once started (ultimates only). */
  Uninterruptible = 'Uninterruptible',
}

export interface ProjectileParams {
  /** Projectiles fired per activation. */
  count: number;
  /** Frames between shots when count > 1. */
  interval: number;
  speed: number;
  /** Metres of travel before the projectile expires. */
  range: number;
  radius: number;
  damage: number;
  chipDamage: number;
  guardDamage: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  knockbackForward: number;
  knockbackUp: number;
  /** 0 = travels straight, 1 = fully tracks the target each frame. */
  homingStrength: number;
  /** Projectiles that pierce continue through the first target hit. */
  pierce: boolean;
  /** Explosion radius on impact. 0 = no splash. */
  splashRadius: number;
  /** Spread cone half-angle in radians for multi-shot. */
  spread: number;
  /** Vertical launch offset for arcing / overhead shots. */
  arc: number;
  /**
   * Purely visual: travels and renders but never collides or deals damage.
   * Used for the energy motes that stream inward during an ultimate cinematic,
   * which must read as spectacle without silently becoming a damage source.
   */
  cosmetic: boolean;
  fx: string;
  color: number;
}

export const PROJECTILE_DEFAULTS: ProjectileParams = {
  count: 1,
  interval: 4,
  speed: 42,
  range: 60,
  radius: 0.6,
  damage: 45,
  chipDamage: 8,
  guardDamage: 10,
  hitstun: 18,
  blockstun: 12,
  hitstop: 5,
  knockbackForward: 6,
  knockbackUp: 1,
  homingStrength: 0,
  pierce: false,
  splashRadius: 0,
  spread: 0,
  arc: 0,
  cosmetic: false,
  fx: 'bolt',
  color: 0x8a5cff,
};

export interface AbilityDef {
  id: string;
  name: string;
  kind: AbilityKind;
  /** Which input slot activates it: 1-4, or 0 for the ultimate binding. */
  slot: number;

  energyCost: number;
  /** Cooldown in frames after the ability ends. */
  cooldown: number;

  /** Frames before the ability's effect begins. */
  startup: number;
  /** Frames the ability's active phase lasts. */
  active: number;
  /** Frames of recovery after the active phase. */
  recovery: number;

  interrupt: InterruptPolicy;
  /** Hits of super armor during startup+active. */
  armor: number;

  airOk: boolean;
  groundOk: boolean;

  /** Projectile parameters, for Projectile / Barrage / Ultimate kinds. */
  projectile?: ProjectileParams;
  /** Melee payload, for Strike / Rush / AreaBlast / Counter / Ultimate kinds. */
  strike?: AttackDef;

  /** Rush kind: travel speed in m/s. */
  rushSpeed?: number;
  /** Rush kind: max distance closed, metres. */
  rushRange?: number;

  /** AreaBlast kind: explosion radius, metres. */
  blastRadius?: number;

  /** Counter kind: frames of the parry-active window. */
  counterWindow?: number;

  /** Ultimate kind: total cinematic length in frames. */
  cinematicFrames?: number;
  /** Ultimate kind: range at which the capture connects, metres. */
  captureRange?: number;

  /** Camera shake magnitude 0..1 on activation. */
  shake: number;
  /** Presentation tags. */
  fx: string;
  sfx: string;
  /** Short description surfaced in the HUD / pause menu. */
  description: string;
}

/**
 * `projectile` and `strike` are omitted from the Partial and re-declared as
 * partial sub-specs, so character files can state only the fields that differ
 * from PROJECTILE_DEFAULTS / ATTACK_DEFAULTS.
 */
export type AbilitySpec = Omit<Partial<AbilityDef>, 'projectile' | 'strike'> &
  Pick<AbilityDef, 'id' | 'name' | 'kind' | 'slot'> & {
    projectile?: Partial<ProjectileParams>;
    strike?: AttackSpec;
  };

const ABILITY_DEFAULTS: Omit<AbilityDef, 'id' | 'name' | 'kind' | 'slot'> = {
  energyCost: 100,
  cooldown: 30,
  startup: 10,
  active: 6,
  recovery: 20,
  interrupt: InterruptPolicy.Cancellable,
  armor: 0,
  airOk: true,
  groundOk: true,
  shake: 0.25,
  fx: 'ability',
  sfx: 'ability',
  description: '',
};

export function makeAbility(spec: AbilitySpec): AbilityDef {
  const def: AbilityDef = { ...ABILITY_DEFAULTS, ...(spec as object) } as AbilityDef;
  if (spec.projectile) {
    def.projectile = { ...PROJECTILE_DEFAULTS, ...spec.projectile };
  }
  if (spec.strike) {
    def.strike = makeAttack(spec.strike);
  }
  return def;
}

/** Total frame length of an ability's non-cinematic form. */
export const abilityDuration = (a: AbilityDef): number =>
  a.kind === AbilityKind.Ultimate && a.cinematicFrames
    ? a.cinematicFrames
    : a.startup + a.active + a.recovery;

/** Per-fighter cooldown bookkeeping. */
export class CooldownTracker {
  private readonly remaining = new Map<string, number>();

  tick(): void {
    for (const [id, frames] of this.remaining) {
      if (frames <= 1) this.remaining.delete(id);
      else this.remaining.set(id, frames - 1);
    }
  }

  start(id: string, frames: number): void {
    if (frames > 0) this.remaining.set(id, frames);
  }

  isReady(id: string): boolean {
    return !this.remaining.has(id);
  }

  framesLeft(id: string): number {
    return this.remaining.get(id) ?? 0;
  }

  /** 0..1 progress used to draw the HUD cooldown sweep. */
  progress(id: string, total: number): number {
    if (total <= 0) return 1;
    return 1 - this.framesLeft(id) / total;
  }

  clear(): void {
    this.remaining.clear();
  }
}

/** Reasons an ability activation can be refused — surfaced as HUD feedback. */
export enum AbilityRefusal {
  None = 'None',
  NotEnoughEnergy = 'NotEnoughEnergy',
  OnCooldown = 'OnCooldown',
  WrongStance = 'WrongStance',
  Busy = 'Busy',
  NoTarget = 'NoTarget',
}
