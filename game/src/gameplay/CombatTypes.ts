/**
 * Frame-data driven combat definitions.
 *
 * Everything in KAIRO: ASCENSION's melee layer is expressed as explicit frame
 * data rather than "play animation, hope it feels right". Startup / active /
 * recovery in 60Hz frames is what makes the combat readable, punishable and
 * tunable — and it is what lets the headless tests assert combat behaviour
 * without a renderer.
 *
 * These structs are the data-asset schema. In the UE5 port they become a
 * UDataTable row struct; nothing here is character-specific, so shared systems
 * never hardcode Kairo or Veyron values.
 */

import type { Vec3 } from '../core/Vec3';

/** Simulation runs at a fixed 60Hz. One frame = 1/60s. */
export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;

/** High-level fighter state. Drives animation selection and legal transitions. */
export enum FighterState {
  Idle = 'Idle',
  Move = 'Move',
  Sprint = 'Sprint',
  Jump = 'Jump',
  Fall = 'Fall',
  Fly = 'Fly',
  Boost = 'Boost',
  Dash = 'Dash',
  Pursuit = 'Pursuit',
  Attack = 'Attack',
  Ability = 'Ability',
  Charging = 'Charging',
  Guard = 'Guard',
  GuardStun = 'GuardStun',
  GuardBreak = 'GuardBreak',
  Parry = 'Parry',
  Dodge = 'Dodge',
  Hitstun = 'Hitstun',
  Launched = 'Launched',
  Downed = 'Downed',
  WakeUp = 'WakeUp',
  AirRecover = 'AirRecover',
  Transform = 'Transform',
  Cinematic = 'Cinematic',
  Defeated = 'Defeated',
}

/** States in which the fighter cannot act at all. */
export const HELPLESS_STATES: ReadonlySet<FighterState> = new Set([
  FighterState.Hitstun,
  FighterState.Launched,
  FighterState.Downed,
  FighterState.GuardBreak,
  FighterState.Defeated,
]);

/** States that are "busy" — new actions must go through the buffer. */
export const BUSY_STATES: ReadonlySet<FighterState> = new Set([
  FighterState.Attack,
  FighterState.Ability,
  FighterState.Dodge,
  FighterState.Transform,
  FighterState.Cinematic,
  FighterState.GuardStun,
  FighterState.WakeUp,
  FighterState.AirRecover,
  ...HELPLESS_STATES,
]);

export enum AttackKind {
  Light = 'Light',
  Heavy = 'Heavy',
  ChargedHeavy = 'ChargedHeavy',
  Launcher = 'Launcher',
  AirLight = 'AirLight',
  AirHeavy = 'AirHeavy',
  Finisher = 'Finisher',
  Ability = 'Ability',
  Ultimate = 'Ultimate',
}

/** How the victim is thrown. Drives which reaction state they enter. */
export enum ReactionType {
  /** Small stagger, victim stays grounded and recovers in place. */
  Flinch = 'Flinch',
  /** Pushed back along the hit vector, still in hitstun. */
  Knockback = 'Knockback',
  /** Popped upward into a juggle state — the combo opener into air. */
  Launch = 'Launch',
  /** Slammed downward; bounces off the floor once for a follow-up. */
  Slam = 'Slam',
  /** Blown away hard. Ends the combo; victim can air-recover. */
  Blowaway = 'Blowaway',
}

export interface HitboxSpec {
  /** Distance from the attacker's origin to the hitbox centre, in metres. */
  reach: number;
  /** Hitbox radius in metres. */
  radius: number;
  /** Vertical offset from the attacker's feet. */
  height: number;
  /** Half-angle in radians the target must be within. PI = omnidirectional. */
  arc: number;
}

export interface AttackDef {
  id: string;
  /** Player-facing name. Original terminology only. */
  name: string;
  kind: AttackKind;

  /** Frames before the hitbox goes live. Lower = faster, more oppressive. */
  startup: number;
  /** Frames the hitbox is live. */
  active: number;
  /** Frames after the hitbox closes before the fighter can act freely. */
  recovery: number;

  hitbox: HitboxSpec;

  damage: number;
  /** Damage dealt through a successful guard. */
  chipDamage: number;
  /** Guard-meter damage. Enough of this triggers a guard break. */
  guardDamage: number;

  /** Frames the victim is stunned on hit, before combo proration. */
  hitstun: number;
  /** Frames the victim is locked in blockstun. */
  blockstun: number;
  /**
   * Frames BOTH fighters freeze on connect. This is the single most important
   * value for making hits feel heavy; it reads as weight, not as lag.
   */
  hitstop: number;

  reaction: ReactionType;
  /** Knockback along the attacker's facing, in m/s. */
  knockbackForward: number;
  /** Knockback upward, in m/s. */
  knockbackUp: number;

  /** Forward momentum the ATTACKER gains on startup, in m/s. */
  advance: number;

  /** Energy granted to the attacker on connect. */
  energyOnHit: number;
  /** Energy granted to the victim on being hit (comeback pressure). */
  energyOnTakeHit: number;
  /** Energy the attack costs to use. 0 for normals. */
  energyCost: number;

  /**
   * Frame (relative to attack start) from which this attack may be cancelled
   * into another. Cancels are only legal after the attack has CONNECTED —
   * whiff-cancelling would remove all risk from offence.
   */
  cancelFrom: number;
  /** Attack ids this may cancel into. Empty = terminal in the chain. */
  cancelInto: readonly string[];

  /** Hits of super armor this attack grants during startup+active. */
  armor: number;
  /** Whether this attack can be performed while airborne. */
  airOk: boolean;
  /** Whether this attack can be performed while grounded. */
  groundOk: boolean;
  /** True if the attack should snap the attacker toward the lock-on target. */
  homing: boolean;
  /** Max distance the homing snap will close, in metres. */
  homingRange: number;

  /** Camera shake magnitude on connect, 0..1. */
  shake: number;
  /** VFX/SFX tags the presentation layer binds to. */
  fx: string;
  sfx: string;
}

/**
 * Partial spec merged over ATTACK_DEFAULTS to keep character data terse.
 * `hitbox` is omitted from the Partial and re-declared so that a spec may
 * override individual hitbox fields without restating the whole struct.
 */
export type AttackSpec = Omit<Partial<AttackDef>, 'hitbox'> &
  Pick<AttackDef, 'id' | 'name' | 'kind'> & { hitbox?: Partial<HitboxSpec> };

export const ATTACK_DEFAULTS: Omit<AttackDef, 'id' | 'name' | 'kind'> = {
  startup: 6,
  active: 3,
  recovery: 12,
  hitbox: { reach: 1.8, radius: 1.1, height: 1.0, arc: Math.PI * 0.45 },
  damage: 40,
  chipDamage: 3,
  guardDamage: 8,
  hitstun: 16,
  blockstun: 11,
  hitstop: 4,
  reaction: ReactionType.Flinch,
  knockbackForward: 2.5,
  knockbackUp: 0,
  advance: 3.0,
  energyOnHit: 22,
  energyOnTakeHit: 14,
  energyCost: 0,
  cancelFrom: 0,
  cancelInto: [],
  armor: 0,
  airOk: false,
  groundOk: true,
  homing: true,
  homingRange: 4.0,
  shake: 0.18,
  fx: 'hit_light',
  sfx: 'hit_light',
};

export function makeAttack(spec: AttackSpec): AttackDef {
  return {
    ...ATTACK_DEFAULTS,
    ...spec,
    hitbox: { ...ATTACK_DEFAULTS.hitbox, ...(spec.hitbox ?? {}) },
  };
}

/** Total frame length of an attack. */
export const attackDuration = (a: AttackDef): number =>
  a.startup + a.active + a.recovery;

/** Frame-advantage on hit (positive = attacker recovers first). */
export const advantageOnHit = (a: AttackDef): number =>
  a.hitstun - (a.recovery + a.active - 1);

/** Frame-advantage on block. Negative values are punishable. */
export const advantageOnBlock = (a: AttackDef): number =>
  a.blockstun - (a.recovery + a.active - 1);

/** Result of resolving one attack against one defender. */
export interface HitResult {
  connected: boolean;
  blocked: boolean;
  parried: boolean;
  /** Absorbed by super armor — damage applied, no stun. */
  armored: boolean;
  /** Defender was invulnerable (dodge i-frames, wake-up, cinematic). */
  evaded: boolean;
  damage: number;
  /** Combo index this hit landed at (1-based). */
  comboIndex: number;
  /** Damage multiplier applied by combo proration. */
  scaling: number;
  position: Vec3 | null;
}

export function emptyHitResult(): HitResult {
  return {
    connected: false,
    blocked: false,
    parried: false,
    armored: false,
    evaded: false,
    damage: 0,
    comboIndex: 0,
    scaling: 1,
    position: null,
  };
}
