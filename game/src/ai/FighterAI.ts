/**
 * FighterAI — utility-scored combat AI.
 *
 * Deliberately character-agnostic: it selects abilities by AbilityKind rather
 * than by id, so it drives Veyron today and any future fighter without
 * modification. A zoner with a Projectile ability and a grappler with a Rush
 * ability both get sensible behaviour out of the same code.
 *
 * Three properties the brief calls out explicitly:
 *
 *   No input reading. The AI never touches the opponent's InputState. It reads
 *   a DELAYED snapshot of publicly observable state (position, velocity,
 *   animation state, whether a hitbox is live) — exactly what a human sees.
 *
 *   No repetitive behaviour. Every tactic carries a recency penalty, so a
 *   tactic that just fired scores lower until it decays. Combined with a
 *   commitment timer this produces varied, readable pressure instead of a
 *   loop.
 *
 *   Reacts to player patterns. A rolling profile of the opponent's habits
 *   (how much they block, how much they attack, how much they stay airborne)
 *   biases tactic scores, so a turtling player starts eating guard-breaks and
 *   a rushdown player starts eating counters.
 */

import { Vec3, clamp } from '../core/Vec3';
import { Rand } from '../core/Rand';
import { emptyInputFrame, type InputFrame, type ActionName } from '../core/Input';
import type { Fighter } from '../gameplay/Fighter';
import { FighterState } from '../gameplay/CombatTypes';
import { AbilityKind, type AbilityDef } from '../gameplay/Ability';
import type { DifficultyProfile } from './Difficulty';
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from './Difficulty';

/** Observable snapshot of the opponent, delayed by the reaction window. */
interface Perception {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  state: FighterState;
  grounded: boolean;
  /** True if a hitbox is currently live — the visible "attack is happening". */
  attacking: boolean;
  /** True if an attack is in startup — the visible wind-up. */
  windup: boolean;
  guarding: boolean;
  healthFraction: number;
  energyFraction: number;
  transformed: boolean;
  /** Distance from the AI to the opponent at snapshot time. */
  distance: number;
}

type TacticId =
  | 'approach'
  | 'space'
  | 'melee'
  | 'heavy'
  | 'launcher'
  | 'rangedAttack'
  | 'rushAttack'
  | 'strikeAttack'
  | 'blastAttack'
  | 'counterStance'
  | 'guard'
  | 'dodge'
  | 'pursue'
  | 'aerial'
  | 'charge'
  | 'transform'
  | 'ultimate'
  | 'reposition';

interface Tactic {
  id: TacticId;
  /** Frames this tactic runs before it can be replaced. */
  commit: number;
}

const PERCEPTION_BUFFER = 40;

export class FighterAI {
  private readonly frame: InputFrame = emptyInputFrame();
  private readonly rand: Rand;
  profile: DifficultyProfile;

  /** Ring buffer of observed opponent states, for reaction delay. */
  private readonly history: Perception[] = [];
  private historyCursor = 0;

  private currentTactic: Tactic = { id: 'approach', commit: 0 };
  private tacticFrames = 0;
  private framesSinceDecision = 0;

  /** Recency heat per tactic, decays each frame. Drives anti-repetition. */
  private readonly heat = new Map<TacticId, number>();

  /** Rolling opponent behaviour profile, all 0..1. */
  private readonly pattern = {
    blockiness: 0.2,
    aggression: 0.3,
    airiness: 0.2,
    ranged: 0.2,
  };

  /** Frames the AI has been unable to reach a sensible state — triggers reset. */
  private stuckFrames = 0;
  private lastPosition = new Vec3();

  private readonly tmp = new Vec3();

  constructor(
    private readonly self: Fighter,
    private readonly opponent: Fighter,
    difficulty: string = DEFAULT_DIFFICULTY,
    seed = 0xbeef,
  ) {
    this.profile = DIFFICULTIES[difficulty] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
    this.rand = new Rand(seed);
    for (let i = 0; i < PERCEPTION_BUFFER; i++) this.history.push(this.observe());
  }

  setDifficulty(id: string): void {
    this.profile = DIFFICULTIES[id] ?? this.profile;
  }

  reset(): void {
    this.historyCursor = 0;
    for (let i = 0; i < PERCEPTION_BUFFER; i++) this.history[i] = this.observe();
    this.currentTactic = { id: 'approach', commit: 0 };
    this.tacticFrames = 0;
    this.framesSinceDecision = 0;
    this.heat.clear();
    this.stuckFrames = 0;
    this.pattern.blockiness = 0.2;
    this.pattern.aggression = 0.3;
    this.pattern.airiness = 0.2;
    this.pattern.ranged = 0.2;
    clearFrame(this.frame);
  }

  /** Current tactic name, surfaced by the debug overlay. */
  get debugTactic(): string {
    return this.currentTactic.id;
  }

  // =====================================================================
  // Perception
  // =====================================================================

  private observe(): Perception {
    const o = this.opponent;
    const s = this.self;
    return {
      x: o.position.x,
      y: o.position.y,
      z: o.position.z,
      vx: o.velocity.x,
      vy: o.velocity.y,
      vz: o.velocity.z,
      state: o.state,
      grounded: o.grounded,
      attacking: o.combat.hitboxLive || (o.activeAbility !== null && o.abilityFrame >= o.activeAbility.startup),
      windup:
        (o.combat.isAttacking && !o.combat.hitboxLive) ||
        (o.activeAbility !== null && o.abilityFrame < o.activeAbility.startup),
      guarding: o.defense.guarding,
      healthFraction: o.health.fraction,
      energyFraction: o.energy.fraction,
      transformed: o.transformed,
      distance: s.position.distanceTo(o.position),
    };
  }

  /** The opponent as the AI is allowed to perceive them: N frames stale. */
  private perceived(): Perception {
    const delay = this.profile.reactionFrames;
    const idx =
      (this.historyCursor - delay + PERCEPTION_BUFFER * 2) % PERCEPTION_BUFFER;
    return this.history[idx];
  }

  private recordPerception(): void {
    this.history[this.historyCursor] = this.observe();
    this.historyCursor = (this.historyCursor + 1) % PERCEPTION_BUFFER;
  }

  private updatePatternProfile(): void {
    const o = this.opponent;
    const k = 0.004; // slow adaptation, ~4 seconds to shift meaningfully
    const blocking = o.defense.guarding ? 1 : 0;
    const attacking = o.combat.isAttacking || o.activeAbility ? 1 : 0;
    const airborne = !o.grounded ? 1 : 0;
    const ranged =
      o.activeAbility &&
      (o.activeAbility.kind === AbilityKind.Projectile ||
        o.activeAbility.kind === AbilityKind.Barrage)
        ? 1
        : 0;
    this.pattern.blockiness += (blocking - this.pattern.blockiness) * k;
    this.pattern.aggression += (attacking - this.pattern.aggression) * k;
    this.pattern.airiness += (airborne - this.pattern.airiness) * k;
    this.pattern.ranged += (ranged - this.pattern.ranged) * k * 3;
  }

  // =====================================================================
  // Ability lookup by kind — this is what keeps the AI character-agnostic
  // =====================================================================

  private abilityOfKind(kind: AbilityKind): AbilityDef | null {
    for (const a of this.self.data.abilities) if (a.kind === kind) return a;
    return null;
  }

  private canUse(a: AbilityDef | null): boolean {
    if (!a) return false;
    if (!this.self.energy.has(a.energyCost)) return false;
    if (!this.self.cooldowns.isReady(a.id)) return false;
    if (this.self.grounded && !a.groundOk) return false;
    if (!this.self.grounded && !a.airOk) return false;
    return true;
  }

  /**
   * Energy discipline: the AI reserves energy for its ultimate rather than
   * dumping every bar into specials, scaled by difficulty. Low-discipline AI
   * spends freely and rarely reaches an ultimate — which reads as "worse", not
   * "cheated down".
   */
  private willSpend(cost: number): boolean {
    const e = this.self.energy;
    const reserve = this.self.data.ultimate.energyCost * this.profile.energyDiscipline * 0.55;
    return e.current - cost >= reserve * (1 - this.profile.aggression * 0.4);
  }

  // =====================================================================
  // Main entry point — produces one frame of input
  // =====================================================================

  think(cameraYaw = 0): InputFrame {
    clearFrame(this.frame);
    this.frame.cameraYaw = 0; // AI works in world space directly
    void cameraYaw;

    this.recordPerception();
    this.updatePatternProfile();
    this.decayHeat();
    this.tacticFrames++;
    this.framesSinceDecision++;

    const s = this.self;

    // --- Non-negotiable reflexes, evaluated before any tactic --------------

    // Defeated or match over: no input.
    if (s.defeated) return this.frame;

    // In hitstun: the only meaningful choices are combo escape and air
    // recovery. Both are gated on resources so the AI can't spam them.
    if (s.isHelpless) {
      this.thinkWhileHelpless();
      return this.frame;
    }

    // Mid-action: hold whatever is in flight, but keep guard available.
    if (!s.canAct) {
      // Chain continuation. Without this the AI can never cancel one normal
      // into the next, because canAct is false for the whole attack — so it
      // throws single jabs forever and its longest "combo" is two hits.
      // Continuing a chain that has already CONNECTED is also exactly the
      // decision a human makes, so this costs nothing in fairness.
      if (
        s.combat.isAttacking &&
        s.combat.connected &&
        this.currentTactic.id === 'melee'
      ) {
        this.frame.held.light = true;
      }
      // Holding guard through recovery is what makes AI feel defensively aware
      // without requiring frame-perfect timing.
      if (this.shouldGuard()) this.frame.held.guard = true;
      return this.frame;
    }

    this.checkStuck();

    // --- Tactic selection --------------------------------------------------
    if (
      this.tacticFrames >= this.currentTactic.commit ||
      this.framesSinceDecision >= this.profile.decisionInterval
    ) {
      const next = this.selectTactic();
      if (next.id !== this.currentTactic.id) {
        this.currentTactic = next;
        this.tacticFrames = 0;
        this.bumpHeat(next.id);
      }
      this.framesSinceDecision = 0;
    }

    this.executeTactic(this.currentTactic.id);
    return this.frame;
  }

  private thinkWhileHelpless(): void {
    const s = this.self;
    const d = s.data.defense;
    const opp = this.opponent;

    // Phase Break: only when the combo is genuinely deep and energy allows.
    // Difficulty gates the reaction so a Cadet eats long combos.
    if (
      opp.combo.hits >= d.comboEscapeMinHits + 2 &&
      s.energy.has(d.comboEscapeCost) &&
      this.rand.chance(this.profile.reactionChance * 0.06)
    ) {
      this.frame.held.guard = true;
      this.frame.held.dodge = true;
      return;
    }
    // Air recovery / ground recovery: press dodge, gated by reaction chance.
    if (
      (s.state === FighterState.Launched || s.state === FighterState.Downed) &&
      this.rand.chance(this.profile.reactionChance * 0.12)
    ) {
      this.frame.held.dodge = true;
    }
  }

  // =====================================================================
  // Tactic scoring
  // =====================================================================

  private selectTactic(): Tactic {
    const s = this.self;
    const p = this.perceived();
    const prof = this.profile;
    const dist = s.position.distanceTo(this.opponent.position);
    const heightDelta = this.opponent.position.y - s.position.y;

    const scores = new Map<TacticId, number>();
    const add = (id: TacticId, v: number) => {
      const heat = this.heat.get(id) ?? 0;
      scores.set(id, v - heat * prof.repetitionPenalty);
    };

    // --- Survival / resource tactics ---------------------------------------
    const hpFrac = s.health.fraction;

    // Ultimate: when it will actually land. Requires energy, a reachable
    // target, and either a finishing opportunity or a vulnerable opponent.
    const ult = s.data.ultimate;
    if (
      s.energy.has(ult.energyCost) &&
      s.cooldowns.isReady(ult.id) &&
      dist < (ult.captureRange ?? 15) * 0.8
    ) {
      const finisher = p.healthFraction < prof.ultimateHealthTrigger ? 2.4 : 0;
      const punish =
        p.state === FighterState.Hitstun ||
        p.state === FighterState.Launched ||
        p.state === FighterState.GuardBreak ||
        p.state === FighterState.Downed
          ? 2.0
          : 0;
      add('ultimate', 1.0 + finisher + punish);
    }

    // Transform: when hurt, or when about to commit to a push.
    if (s.ascension.canTransform) {
      const hurt = hpFrac < prof.transformHealthTrigger ? 1.8 : 0.4;
      const safe = dist > 9 ? 0.8 : 0;
      add('transform', 1.6 + hurt + safe);
    }

    // Charge: only when far, safe, and short on energy.
    if (s.energy.fraction < 0.45 && dist > 16 && s.grounded) {
      add('charge', 1.4 + (1 - s.energy.fraction) * 1.6 - prof.aggression);
    }

    // --- Defensive reactions ------------------------------------------------
    const threatened = p.attacking || p.windup;
    const inThreatRange = dist < 4.2;
    if (threatened && inThreatRange && this.rand.chance(prof.reactionChance)) {
      add('guard', 1.5 + prof.guardChance * 2.4);
      add('dodge', 1.0 + prof.dodgeChance * 2.6);
      const counter = this.abilityOfKind(AbilityKind.Counter);
      if (this.canUse(counter) && this.willSpend(counter!.energyCost)) {
        // Counter scores higher against an opponent the profile says is
        // aggressive — this is the pattern-adaptation the brief asks for.
        add('counterStance', 1.2 + prof.counterChance * 3.0 + this.pattern.aggression * 1.8);
      }
    }

    // Get-off-me blast when cornered by a rushdown opponent.
    const blast = this.abilityOfKind(AbilityKind.AreaBlast);
    if (this.canUse(blast) && dist < (blast!.blastRadius ?? 9) * 0.7 && this.willSpend(blast!.energyCost)) {
      add('blastAttack', 0.9 + this.pattern.aggression * 1.6 + (hpFrac < 0.4 ? 0.9 : 0));
    }

    // --- Pursuit ------------------------------------------------------------
    const oppLaunched =
      p.state === FighterState.Launched ||
      p.state === FighterState.Hitstun ||
      p.state === FighterState.AirRecover;
    if (oppLaunched && dist > 5 && dist < s.data.movement.pursuitRange) {
      add('pursue', 2.2 + prof.aggression * 1.5);
    }

    // Opponent airborne and we're grounded: go up or shoot up.
    if (!p.grounded && heightDelta > 3.5) {
      add('aerial', 1.2 + prof.aggression * 1.2 + this.pattern.airiness * 1.4);
      const ranged = this.abilityOfKind(AbilityKind.Projectile);
      if (this.canUse(ranged) && this.willSpend(ranged!.energyCost)) {
        add('rangedAttack', 1.4 + this.pattern.airiness * 1.5);
      }
    }

    // --- Offence ------------------------------------------------------------
    const meleeRange = s.data.attacks[s.data.heavyAttack].hitbox.reach + 1.0;

    if (dist <= meleeRange) {
      add('melee', 1.8 + prof.aggression * 1.6);
      // A blocking opponent should be attacked with guard-damage tools, not
      // more jabs. This is the single clearest "reads the player" behaviour.
      const strike = this.abilityOfKind(AbilityKind.Strike);
      if (this.canUse(strike) && this.willSpend(strike!.energyCost)) {
        add('strikeAttack', 1.0 + this.pattern.blockiness * 3.2 + prof.aggression);
      }
      add('heavy', 0.9 + prof.aggression * 1.1 + this.pattern.blockiness * 1.2);
      add('launcher', 0.8 + prof.aggression * 0.9 + (p.grounded ? 0.6 : -0.5));
    } else if (dist < meleeRange + 6) {
      add('approach', 1.7 + prof.aggression * 1.8);
      const rush = this.abilityOfKind(AbilityKind.Rush);
      if (this.canUse(rush) && this.willSpend(rush!.energyCost)) {
        add('rushAttack', 1.3 + prof.aggression * 1.6);
      }
    } else {
      // Long range: zone or close, biased by aggression and the opponent's
      // own tendency to zone (a zoner must be approached).
      const ranged = this.abilityOfKind(AbilityKind.Projectile);
      if (this.canUse(ranged) && this.willSpend(ranged!.energyCost)) {
        add('rangedAttack', 1.6 + (1 - prof.aggression) * 1.4 - this.pattern.ranged * 0.8);
      }
      add('approach', 1.5 + prof.aggression * 2.0 + this.pattern.ranged * 1.8);
      const rush = this.abilityOfKind(AbilityKind.Rush);
      if (this.canUse(rush) && this.willSpend(rush!.energyCost) && dist < (rush!.rushRange ?? 40)) {
        add('rushAttack', 1.4 + prof.aggression * 1.8);
      }
    }

    // Spacing: back off when hurt or when the opponent is winning neutral.
    if (hpFrac < 0.35 && dist < 8) add('space', 1.2 + (1 - prof.aggression) * 1.8);
    // A deliberate pause — creates the openings that make the AI beatable.
    if (this.rand.chance(prof.idleChance)) add('reposition', 1.9);

    // --- Pick the winner ---------------------------------------------------
    let bestId: TacticId = 'approach';
    let bestScore = -Infinity;
    for (const [id, v] of scores) {
      // Small noise so equal-scoring tactics alternate naturally.
      const jittered = v + this.rand.range(-0.18, 0.18);
      if (jittered > bestScore) {
        bestScore = jittered;
        bestId = id;
      }
    }
    return { id: bestId, commit: this.commitFor(bestId) };
  }

  private commitFor(id: TacticId): number {
    const base = this.profile.commitFrames;
    switch (id) {
      case 'guard':
        return base + 10;
      case 'charge':
        return base * 3;
      case 'counterStance':
      case 'ultimate':
      case 'transform':
        return 4;
      case 'pursue':
        return base + 14;
      case 'reposition':
        return base + 18;
      default:
        return base;
    }
  }

  private bumpHeat(id: TacticId): void {
    this.heat.set(id, (this.heat.get(id) ?? 0) + 1);
  }

  private decayHeat(): void {
    for (const [id, v] of this.heat) {
      const next = v - 0.012;
      if (next <= 0) this.heat.delete(id);
      else this.heat.set(id, next);
    }
  }

  // =====================================================================
  // Tactic execution
  // =====================================================================

  private executeTactic(id: TacticId): void {
    const s = this.self;
    const o = this.opponent;
    const dist = s.position.distanceTo(o.position);
    const heightDelta = o.position.y - s.position.y;

    switch (id) {
      case 'ultimate':
        this.frame.held.ultimate = true;
        break;

      case 'transform':
        this.frame.held.transform = true;
        break;

      case 'charge':
        this.frame.held.charge = true;
        break;

      case 'guard':
        this.frame.held.guard = true;
        // Perfect-guard attempt: release and re-press to refresh the window.
        if (this.rand.chance(this.profile.parryChance * 0.25)) {
          this.frame.held.guard = this.tacticFrames % 9 < 5;
        }
        this.faceAndStrafe(0.25);
        break;

      case 'dodge':
        this.frame.held.dodge = true;
        this.moveAwayFrom(o, 1);
        break;

      case 'counterStance':
        this.pressAbilitySlot(AbilityKind.Counter);
        break;

      case 'blastAttack':
        this.pressAbilitySlot(AbilityKind.AreaBlast);
        break;

      case 'rangedAttack':
        this.pressAbilitySlot(AbilityKind.Projectile);
        this.faceAndStrafe(0.35);
        break;

      case 'rushAttack':
        this.pressAbilitySlot(AbilityKind.Rush);
        break;

      case 'strikeAttack':
        this.pressAbilitySlot(AbilityKind.Strike);
        break;

      case 'melee':
        this.moveToward(o, dist > 2.4 ? 1 : 0.25);
        // Mix light and heavy so the pressure isn't a metronome.
        if (this.tacticFrames % 6 === 0) {
          if (this.rand.chance(0.24 + this.pattern.blockiness * 0.3)) {
            this.frame.held.heavy = true;
          } else {
            this.frame.held.light = true;
          }
        }
        break;

      case 'heavy':
        this.moveToward(o, dist > 2.6 ? 1 : 0.2);
        if (this.tacticFrames === 2) this.frame.held.heavy = true;
        break;

      case 'launcher':
        this.moveToward(o, dist > 2.4 ? 1 : 0.2);
        // Launcher input is guard+heavy, matching the player's binding.
        if (this.tacticFrames >= 2 && this.tacticFrames <= 4) {
          this.frame.held.guard = true;
          this.frame.held.heavy = true;
        }
        break;

      case 'pursue':
        // Boost + dodge is the dash chord; toward a launched target it
        // becomes a pursuit dash.
        this.moveToward(o, 1);
        this.frame.held.boost = true;
        if (this.tacticFrames % 14 === 2) this.frame.held.dodge = true;
        if (heightDelta > 1.5) this.frame.held.jump = true;
        break;

      case 'aerial':
        this.moveToward(o, 1);
        if (s.grounded) {
          this.frame.held.jump = true;
        } else if (!s.movement.flying) {
          // Tap jump in the air to enter flight.
          this.frame.held.jump = this.tacticFrames % 8 < 2;
        } else {
          if (heightDelta > 1) this.frame.held.jump = true;
          else if (heightDelta < -1) this.frame.held.descend = true;
          this.frame.held.boost = dist > 10;
          if (dist < 3.0 && this.tacticFrames % 7 === 0) this.frame.held.light = true;
        }
        break;

      case 'approach':
        this.moveToward(o, 1);
        this.frame.held.boost = dist > 9;
        if (heightDelta > 3 && s.grounded) this.frame.held.jump = true;
        break;

      case 'space':
        this.moveAwayFrom(o, 1);
        this.frame.held.boost = true;
        break;

      case 'reposition':
      default:
        // Circle-strafe: keeps the AI visually alive during its idle beats and
        // stops it from standing still like a training dummy.
        this.faceAndStrafe(0.7);
        break;
    }
  }

  private pressAbilitySlot(kind: AbilityKind): void {
    const a = this.abilityOfKind(kind);
    if (!a) return;
    const key = `ability${a.slot}` as ActionName;
    // Press for a couple of frames so the buffer reliably picks it up.
    if (this.tacticFrames <= 2) this.frame.held[key] = true;
  }

  private moveToward(target: Fighter, magnitude: number): void {
    const skill = this.profile.positioningSkill;
    this.tmp.set(
      target.position.x - this.self.position.x,
      0,
      target.position.z - this.self.position.z,
    );
    const len = this.tmp.lengthXZ;
    if (len < 1e-4) return;
    this.tmp.scale(1 / len);
    // Positioning error: lower-skill AI drifts off the ideal line.
    const err = (1 - skill) * this.rand.range(-0.9, 0.9);
    const c = Math.cos(err);
    const sn = Math.sin(err);
    this.frame.moveX = (this.tmp.x * c - this.tmp.z * sn) * magnitude;
    this.frame.moveZ = (this.tmp.x * sn + this.tmp.z * c) * magnitude;
  }

  private moveAwayFrom(target: Fighter, magnitude: number): void {
    this.moveToward(target, magnitude);
    this.frame.moveX *= -1;
    this.frame.moveZ *= -1;
  }

  private faceAndStrafe(magnitude: number): void {
    this.tmp.set(
      this.opponent.position.x - this.self.position.x,
      0,
      this.opponent.position.z - this.self.position.z,
    );
    const len = this.tmp.lengthXZ;
    if (len < 1e-4) return;
    this.tmp.scale(1 / len);
    // Perpendicular = strafe. Direction flips slowly for a natural weave.
    const sign = Math.sin(this.tacticFrames * 0.045) > 0 ? 1 : -1;
    this.frame.moveX = -this.tmp.z * sign * magnitude;
    this.frame.moveZ = this.tmp.x * sign * magnitude;
  }

  private shouldGuard(): boolean {
    const p = this.perceived();
    return (
      (p.attacking || p.windup) &&
      p.distance < 4.5 &&
      this.rand.chance(this.profile.guardChance * 0.25)
    );
  }

  // =====================================================================
  // Invalid-state recovery
  //
  // The brief requires the AI to recover from invalid states and from losing
  // navigation. The AI watches its own position: if it has barely moved for
  // several seconds while trying to close distance, it forcibly resets its
  // tactic and dashes out of wherever it is wedged.
  // =====================================================================

  private checkStuck(): void {
    const moved = this.self.position.distanceTo(this.lastPosition);
    this.lastPosition.copy(this.self.position);
    const wantsToMove =
      this.currentTactic.id === 'approach' ||
      this.currentTactic.id === 'pursue' ||
      this.currentTactic.id === 'aerial';

    if (wantsToMove && moved < 0.02) this.stuckFrames++;
    else this.stuckFrames = Math.max(0, this.stuckFrames - 2);

    if (this.stuckFrames > 90) {
      console.warn('[AI] stuck; forcing reposition');
      this.stuckFrames = 0;
      this.currentTactic = { id: 'reposition', commit: 40 };
      this.tacticFrames = 0;
      // Dash away from the arena centre-line to break out of any wedge.
      this.frame.held.boost = true;
      this.frame.held.dodge = true;
      this.frame.held.jump = true;
    }
  }

  /** Diagnostics for the debug overlay and AI tests. */
  debugSnapshot(): Record<string, string | number> {
    return {
      difficulty: this.profile.id,
      tactic: this.currentTactic.id,
      tacticFrames: this.tacticFrames,
      blockiness: +this.pattern.blockiness.toFixed(2),
      aggression: +this.pattern.aggression.toFixed(2),
      airiness: +this.pattern.airiness.toFixed(2),
      heatEntries: this.heat.size,
      stuck: this.stuckFrames,
    };
  }
}

function clearFrame(f: InputFrame): void {
  f.moveX = 0;
  f.moveZ = 0;
  for (const k in f.held) f.held[k as ActionName] = false;
}

export { clamp };
