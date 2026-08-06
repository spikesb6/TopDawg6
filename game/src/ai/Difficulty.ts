/**
 * AI difficulty configuration.
 *
 * The brief forbids "constant AI input reading". None of these values give the
 * AI access to the player's inputs — the AI only ever sees *observable* state
 * (position, velocity, animation state) and only after `reactionFrames` of
 * delay. Difficulty therefore scales how quickly and how well the AI reacts to
 * things a human could also see, never what it is allowed to know.
 */

export interface DifficultyProfile {
  id: string;
  name: string;

  /** Frames of perception delay. A human is roughly 12-15 frames. */
  reactionFrames: number;
  /** Probability of reacting at all to a given threat, 0..1. */
  reactionChance: number;

  /** Probability of blocking an incoming attack it has perceived. */
  guardChance: number;
  /** Probability of attempting a dodge instead of a block. */
  dodgeChance: number;
  /** Probability of attempting a perfect guard (tight timing). */
  parryChance: number;
  /** Probability of using the counter ability when pressured. */
  counterChance: number;

  /** Frames between offensive decisions. Lower = more aggressive. */
  decisionInterval: number;
  /** Base aggression 0..1; biases approach vs spacing. */
  aggression: number;
  /** How willing it is to spend energy on specials, 0..1. */
  energyDiscipline: number;

  /** Minimum frames it commits to a chosen tactic before re-evaluating. */
  commitFrames: number;
  /** Penalty applied to a tactic's score for each recent use. Anti-repetition. */
  repetitionPenalty: number;

  /** Accuracy of movement toward its desired position, 0..1. */
  positioningSkill: number;
  /** Chance per decision to simply do nothing (a deliberate opening). */
  idleChance: number;

  /** Fraction of the opponent's health below which it will use the ultimate. */
  ultimateHealthTrigger: number;
  /** Fraction of its OWN health below which it will transform. */
  transformHealthTrigger: number;
}

export const DIFFICULTIES: Record<string, DifficultyProfile> = {
  cadet: {
    id: 'cadet',
    name: 'CADET',
    reactionFrames: 22,
    reactionChance: 0.45,
    guardChance: 0.3,
    dodgeChance: 0.12,
    parryChance: 0.02,
    counterChance: 0.08,
    decisionInterval: 34,
    aggression: 0.42,
    energyDiscipline: 0.3,
    commitFrames: 26,
    repetitionPenalty: 0.15,
    positioningSkill: 0.6,
    idleChance: 0.22,
    ultimateHealthTrigger: 0.3,
    transformHealthTrigger: 0.35,
  },
  warrior: {
    id: 'warrior',
    name: 'WARRIOR',
    reactionFrames: 15,
    reactionChance: 0.7,
    guardChance: 0.52,
    dodgeChance: 0.24,
    parryChance: 0.07,
    counterChance: 0.2,
    decisionInterval: 24,
    aggression: 0.58,
    energyDiscipline: 0.55,
    commitFrames: 20,
    repetitionPenalty: 0.22,
    positioningSkill: 0.8,
    idleChance: 0.12,
    ultimateHealthTrigger: 0.42,
    transformHealthTrigger: 0.5,
  },
  warlord: {
    id: 'warlord',
    name: 'WARLORD',
    reactionFrames: 10,
    reactionChance: 0.86,
    guardChance: 0.68,
    dodgeChance: 0.34,
    parryChance: 0.16,
    counterChance: 0.34,
    decisionInterval: 17,
    aggression: 0.72,
    energyDiscipline: 0.78,
    commitFrames: 15,
    repetitionPenalty: 0.28,
    positioningSkill: 0.92,
    idleChance: 0.06,
    ultimateHealthTrigger: 0.55,
    transformHealthTrigger: 0.62,
  },
  tyrant: {
    id: 'tyrant',
    name: 'TYRANT',
    reactionFrames: 7,
    reactionChance: 0.95,
    guardChance: 0.78,
    dodgeChance: 0.42,
    parryChance: 0.26,
    counterChance: 0.45,
    decisionInterval: 13,
    aggression: 0.84,
    energyDiscipline: 0.9,
    commitFrames: 12,
    repetitionPenalty: 0.32,
    positioningSkill: 0.98,
    idleChance: 0.03,
    ultimateHealthTrigger: 0.7,
    transformHealthTrigger: 0.75,
  },
};

export const DEFAULT_DIFFICULTY = 'warrior';
