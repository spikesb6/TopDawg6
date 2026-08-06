/**
 * Character data-asset schema.
 *
 * This is the contract that makes the roster expandable: adding a fighter means
 * authoring one CharacterData object and its ability list, with zero edits to
 * any shared system. In the UE5 port this becomes a UPrimaryDataAsset.
 *
 * No shared system may branch on a character id. If a behaviour differs between
 * fighters, it belongs in this struct.
 */

import type { AttackDef } from '../gameplay/CombatTypes';
import type { AbilityDef } from '../gameplay/Ability';

export interface MovementProfile {
  /** Ground walk speed, m/s. */
  walkSpeed: number;
  /** Ground sprint speed, m/s. */
  sprintSpeed: number;
  /** Ground acceleration, m/s^2. High values = snappy, low = floaty. */
  groundAccel: number;
  /** Ground deceleration when input is released, m/s^2. */
  groundDecel: number;
  /** Radians/sec the fighter can turn while grounded. */
  turnRate: number;

  /** Upward velocity imparted by a jump, m/s. */
  jumpSpeed: number;
  /** Gravity, m/s^2. Tuned well above real-world 9.81 to avoid floatiness. */
  gravity: number;
  /** Terminal fall speed, m/s. */
  maxFallSpeed: number;
  /** Air control acceleration, m/s^2. */
  airAccel: number;
  /** Horizontal air speed cap, m/s. */
  airSpeed: number;

  /** Free-flight horizontal speed, m/s. */
  flySpeed: number;
  /** Flight vertical ascend/descend speed, m/s. */
  flyVerticalSpeed: number;
  /** Flight acceleration, m/s^2. */
  flyAccel: number;
  /** Boost-flight speed multiplier over flySpeed. */
  boostMultiplier: number;
  /** Energy cost per second of boost flight. */
  boostEnergyPerSecond: number;

  /** Ground/air dash distance, metres. */
  dashDistance: number;
  /** Dash duration, frames. */
  dashFrames: number;
  /** Frames of invulnerability at the start of a dash. */
  dashIFrames: number;
  /** Frames after a dash before another may be performed. */
  dashCooldown: number;
  /** Energy cost of an air dash. Ground dashes are free. */
  airDashEnergyCost: number;
  /** Air dashes allowed before touching ground. */
  airDashCharges: number;

  /** Pursuit-dash (close distance to a launched target) speed, m/s. */
  pursuitSpeed: number;
  /** Energy cost of a pursuit dash. */
  pursuitEnergyCost: number;
  /** Max range at which a pursuit dash can be initiated, metres. */
  pursuitRange: number;
}

export interface DefenseProfile {
  /** Guard meter capacity. */
  guardMax: number;
  guardRegenRate: number;
  guardRegenDelayFrames: number;
  guardBreakStunFrames: number;
  /** Fraction of incoming damage taken while guarding (chip is separate). */
  guardDamageReduction: number;

  /** Frames after raising guard during which a hit is a perfect guard. */
  parryWindowFrames: number;
  /** Frames the attacker is stunned by a perfect guard. */
  parryPunishFrames: number;
  /** Energy awarded for a perfect guard. */
  parryEnergyReward: number;

  /** Dodge duration, frames. */
  dodgeFrames: number;
  /** Frames of invulnerability within the dodge. */
  dodgeIFrames: number;
  /** Frames after a dodge before another may be performed. */
  dodgeCooldown: number;
  /** Dodge travel distance, metres. */
  dodgeDistance: number;

  /** Energy cost of a combo escape (Phase Break). */
  comboEscapeCost: number;
  /** Frames of invulnerability granted by a combo escape. */
  comboEscapeIFrames: number;
  /** Minimum combo hits before a combo escape is legal. */
  comboEscapeMinHits: number;
}

export interface TransformationDef {
  id: string;
  name: string;
  /** Frames of the transformation sequence (invulnerable, cinematic). */
  frames: number;
  /** Outgoing damage multiplier. */
  damageMultiplier: number;
  /** Incoming damage multiplier. Below 1 = damage resistance. */
  defenseMultiplier: number;
  /** Movement speed multiplier applied across walk/sprint/fly/boost. */
  speedMultiplier: number;
  /** Attack startup frames multiplier. Below 1 = faster attacks. */
  attackSpeedMultiplier: number;
  /** Passive energy regen multiplier while transformed. */
  energyRegenMultiplier: number;
  /** Hits of super armor granted on all attacks. */
  bonusArmor: number;
  /** Aura colour, hex. */
  auraColor: number;
  /** Secondary/rim colour, hex. */
  accentColor: number;
  /** Audio treatment tag applied while transformed. */
  audioProfile: string;
  /** Camera FOV offset in degrees while transformed. */
  cameraFovBoost: number;
  fx: string;
  sfx: string;
}

export interface VisualProfile {
  /** Primary body/costume colour. */
  primaryColor: number;
  /** Secondary trim colour. */
  secondaryColor: number;
  /** Energy/aura colour in the base state. */
  energyColor: number;
  /** Rim-light colour used to separate the fighter from the background. */
  rimColor: number;
  /** Capsule height in metres. */
  height: number;
  /** Capsule radius in metres. */
  radius: number;
  /** Silhouette build: affects proportions of the greybox rig. */
  build: 'agile' | 'heavy';
}

export interface AudioProfile {
  /** Base pitch multiplier for this fighter's voice/impact layer. */
  pitch: number;
  /** Timbre tag consumed by the procedural audio synthesiser. */
  timbre: 'bright' | 'dark';
}

export interface CharacterData {
  id: string;
  name: string;
  /** Original in-fiction energy name. Shown on the HUD. */
  energyName: string;
  /** One-line combat identity, shown on the character select / results. */
  tagline: string;

  maxHealth: number;
  energyPerBar: number;
  energyBars: number;
  energyPassiveRegen: number;
  energyChargeRate: number;

  ascensionMax: number;
  ascensionGainDealt: number;
  ascensionGainTaken: number;
  ascensionDrain: number;
  ascensionThreshold: number;

  movement: MovementProfile;
  defense: DefenseProfile;
  visual: VisualProfile;
  audio: AudioProfile;

  /** Melee attack table, keyed by attack id. */
  attacks: Record<string, AttackDef>;
  /** Ground light-attack chain, in order. */
  lightChain: readonly string[];
  /** Aerial light-attack chain, in order. */
  airChain: readonly string[];
  /** Attack id for the ground heavy. */
  heavyAttack: string;
  /** Attack id for the fully-charged heavy. */
  chargedHeavyAttack: string;
  /** Attack id for the launcher. */
  launcher: string;
  /** Attack id for the aerial heavy / air finisher. */
  airHeavyAttack: string;

  /** Special abilities bound to ability1..ability4. */
  abilities: readonly AbilityDef[];
  /** The ultimate. Separate binding, separate cost tier. */
  ultimate: AbilityDef;
  transformation: TransformationDef;
}
