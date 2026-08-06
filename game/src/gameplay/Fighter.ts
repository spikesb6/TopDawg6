/**
 * Fighter — the shared base entity for every character in KAIRO: ASCENSION.
 *
 * This class contains ZERO character-specific logic. Everything that differs
 * between Kairo and Veyron comes from the CharacterData it is constructed with.
 * Adding a third fighter requires no changes to this file.
 *
 * Responsibilities:
 *   - own the resource components (health / energy / guard / ascension)
 *   - run the state machine
 *   - translate InputState into actions (the same path for humans and AI)
 *   - integrate physics against the arena
 *   - receive hits and enter the correct reaction
 *
 * Explicitly NOT its responsibility: hit detection between fighters, projectile
 * resolution and match flow. Those need both fighters, so they live in
 * Simulation.
 */

import { Vec3, clamp, damp } from '../core/Vec3';
import { InputState } from '../core/Input';
import type { EventBus } from '../core/Events';
import type { CharacterData, TransformationDef } from '../characters/CharacterData';
import { Health, Energy, Guard, Ascension } from './Attributes';
import { MovementComponent, emptyMoveIntent, type MoveIntent } from './MovementComponent';
import { CombatComponent, applyChargeScaling } from './CombatComponent';
import { DefenseComponent } from './DefenseComponent';
import { ComboTracker, juggleGravityMultiplier } from './DamageModel';
import { CooldownTracker, AbilityRefusal, AbilityKind, type AbilityDef } from './Ability';
import type { Arena, BoundaryContact } from './Arena';
import { emptyBoundaryContact, WALL_SPLAT_SPEED } from './Arena';
import {
  FighterState,
  ReactionType,
  HELPLESS_STATES,
  type AttackDef,
} from './CombatTypes';

/** Frames a downed fighter stays on the floor before auto-rising. */
const DOWNED_FRAMES = 42;
/** Frames of the wake-up animation, invulnerable throughout. */
const WAKEUP_FRAMES = 16;
/** Frames of the air-recovery flip, invulnerable throughout. */
const AIR_RECOVER_FRAMES = 20;
/** Vertical speed below which a launched fighter stops being "juggled". */
const LAUNCH_SETTLE_SPEED = -1.0;
/** Speed at which hitting the ground while launched causes a bounce. */
const GROUND_BOUNCE_SPEED = 9;
/** Fraction of impact speed retained by a ground bounce. */
const GROUND_BOUNCE_RESTITUTION = 0.44;

export interface FighterTickContext {
  arena: Arena;
  opponent: Fighter | null;
  events: EventBus;
  dt: number;
  /** True while a cinematic (ultimate) has control of the scene. */
  cinematicLock: boolean;
}

export class Fighter {
  readonly position = new Vec3();
  readonly velocity = new Vec3();
  /** Facing yaw in radians. 0 = +Z. */
  yaw = 0;

  readonly health: Health;
  readonly energy: Energy;
  readonly guard: Guard;
  readonly ascension: Ascension;

  readonly movement: MovementComponent;
  readonly combat: CombatComponent;
  readonly defense: DefenseComponent;
  readonly combo = new ComboTracker();
  readonly cooldowns = new CooldownTracker();
  readonly input = new InputState();

  state: FighterState = FighterState.Idle;
  /** Frames spent in the current state. */
  stateFrames = 0;
  grounded = true;

  /**
   * Hitstop freezes this fighter completely for N frames. It is the primary
   * source of impact feel; both attacker and victim freeze on the same frame.
   */
  hitstop = 0;

  /** Frames of hitstun/launch remaining. */
  reactionFrames = 0;
  /** Reaction currently being played out. */
  currentReaction: ReactionType = ReactionType.Flinch;
  /** Air hits taken in the current juggle; drives gravity ramp. */
  juggleHits = 0;
  /** Set while the fighter has already used its one air recovery this juggle. */
  airRecoverUsed = false;

  /** Lock-on target index, or -1. */
  lockOnTarget = -1;
  lockOnEnabled = false;

  /** Active ability, if any. */
  activeAbility: AbilityDef | null = null;
  abilityFrame = 0;
  /** Shots already fired by the current barrage. */
  abilityShotsFired = 0;
  /**
   * The abilityFrame whose effects have already been resolved.
   *
   * Frame-keyed ability effects (an ultimate's payoff, a blast's detonation)
   * must fire exactly once. Without this, any frame on which the ability clock
   * fails to advance — hitstop, global freeze — re-runs that frame's effects,
   * and an effect that applies hitstop to its own caster deadlocks the match.
   */
  lastResolvedAbilityFrame = -1;
  /** Set while a Counter-kind ability's parry window is open. */
  counterActive = false;
  /** Set when a counter has been triggered and the punish strike is pending. */
  counterTriggered = false;

  /** Frames remaining of the transformation entry sequence. */
  transformFrames = 0;
  transformed = false;

  /** Last refusal reason, for HUD feedback. Cleared each frame after read. */
  lastRefusal: AbilityRefusal = AbilityRefusal.None;

  /** Set when this fighter has been defeated. */
  defeated = false;

  private readonly intent: MoveIntent = emptyMoveIntent();
  private readonly boundary: BoundaryContact = emptyBoundaryContact();
  private readonly tmpVec = new Vec3();
  /** Rendering-side smoothed lean, exposed for the animation layer. */
  lean = 0;

  constructor(
    readonly index: number,
    readonly data: CharacterData,
  ) {
    this.health = new Health(data.maxHealth);
    this.energy = new Energy(
      data.energyPerBar,
      data.energyBars,
      data.energyPassiveRegen,
      data.energyChargeRate,
    );
    this.guard = new Guard(
      data.defense.guardMax,
      data.defense.guardRegenRate,
      data.defense.guardRegenDelayFrames,
      data.defense.guardBreakStunFrames,
    );
    this.ascension = new Ascension(
      data.ascensionMax,
      data.ascensionGainDealt,
      data.ascensionGainTaken,
      data.ascensionDrain,
      data.ascensionThreshold,
    );
    this.movement = new MovementComponent(data.movement);
    this.combat = new CombatComponent();
    this.defense = new DefenseComponent(data.defense);
  }

  // =====================================================================
  // Lifecycle
  // =====================================================================

  resetForMatch(x: number, z: number, facingYaw: number): void {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.yaw = facingYaw;
    this.health.reset();
    this.energy.reset();
    this.guard.reset();
    this.ascension.reset();
    this.movement.reset();
    this.combat.reset();
    this.defense.reset();
    this.combo.fullReset();
    this.cooldowns.clear();
    this.input.clearBuffer();
    this.state = FighterState.Idle;
    this.stateFrames = 0;
    this.grounded = true;
    this.hitstop = 0;
    this.reactionFrames = 0;
    this.juggleHits = 0;
    this.airRecoverUsed = false;
    this.activeAbility = null;
    this.abilityFrame = 0;
    this.abilityShotsFired = 0;
    this.lastResolvedAbilityFrame = -1;
    this.counterActive = false;
    this.counterTriggered = false;
    this.transformFrames = 0;
    this.transformed = false;
    this.defeated = false;
    this.lastRefusal = AbilityRefusal.None;
    this.lean = 0;
  }

  // =====================================================================
  // Derived stats — transformation modifiers folded in here so that every
  // consumer sees a single consistent number.
  // =====================================================================

  get transformation(): TransformationDef {
    return this.data.transformation;
  }

  get damageMultiplier(): number {
    return this.transformed ? this.transformation.damageMultiplier : 1;
  }

  get defenseMultiplier(): number {
    return this.transformed ? this.transformation.defenseMultiplier : 1;
  }

  get speedMultiplier(): number {
    return this.transformed ? this.transformation.speedMultiplier : 1;
  }

  get bonusArmor(): number {
    return this.transformed ? this.transformation.bonusArmor : 0;
  }

  get isHelpless(): boolean {
    return HELPLESS_STATES.has(this.state);
  }

  get isInvulnerable(): boolean {
    return (
      this.defense.isInvulnerable ||
      // A knocked-down fighter cannot be hit on the ground. This is the
      // standard fighting-game rule and it exists for a structural reason:
      // without it, a knockdown can be looped indefinitely. Forcing the
      // attacker to reset to neutral is what creates the wake-up mix-up.
      this.state === FighterState.Downed ||
      this.state === FighterState.WakeUp ||
      this.state === FighterState.AirRecover ||
      this.state === FighterState.Transform ||
      this.defeated
    );
  }

  /** Can the fighter start a new action right now? */
  get canAct(): boolean {
    if (this.defeated || this.hitstop > 0) return false;
    if (this.isHelpless) return false;
    if (this.state === FighterState.Transform) return false;
    if (this.state === FighterState.Cinematic) return false;
    if (this.state === FighterState.WakeUp || this.state === FighterState.AirRecover)
      return false;
    if (this.defense.blockstunFrames > 0) return false;
    if (this.defense.isDodging) return false;
    if (this.activeAbility) return false;
    if (this.combat.isAttacking) return false;
    return true;
  }

  /** World-space forward vector. */
  forward(out: Vec3): Vec3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  /** Centre of mass, used for hit tests and camera framing. */
  center(out: Vec3): Vec3 {
    return out.set(
      this.position.x,
      this.position.y + this.data.visual.height * 0.5,
      this.position.z,
    );
  }

  // =====================================================================
  // Main tick
  // =====================================================================

  tick(ctx: FighterTickContext): void {
    // Hitstop freezes everything except the frame counter that ends it. This
    // is deliberate: during hitstop the fighter should look *stopped*, not
    // slowed, which is what sells the impact.
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }

    if (this.defeated) {
      this.tickDefeated(ctx);
      return;
    }

    this.stateFrames++;
    this.movement.tickTimers();
    this.defense.tickTimers();
    this.cooldowns.tick();
    this.combo.tick();
    this.guard.tick(ctx.dt);
    this.combat.tickChainWindow();
    this.combat.setSpeedMultiplier(
      this.transformed ? this.transformation.attackSpeedMultiplier : 1,
    );

    // Transformation drain. Ending it is a state change, not just a flag flip.
    if (this.ascension.tick(ctx.dt)) this.endTransformation(ctx);

    this.updateIntentFromInput(ctx);

    // Reaction states own the fighter completely until they expire.
    if (this.isHelpless) {
      this.tickReaction(ctx);
    } else if (this.state === FighterState.Transform) {
      this.tickTransform(ctx);
    } else if (this.state === FighterState.WakeUp || this.state === FighterState.AirRecover) {
      this.tickRecoveryState(ctx);
    } else if (this.activeAbility) {
      this.tickAbility(ctx);
    } else if (this.combat.isAttacking) {
      this.tickAttack(ctx);
    } else if (this.defense.isDodging) {
      this.tickDodge(ctx);
    } else if (this.movement.dashing) {
      this.tickDash(ctx);
    } else {
      this.tickFree(ctx);
    }

    this.integrate(ctx);
    this.regenerateEnergy(ctx);
    this.validate(ctx);
  }

  // =====================================================================
  // Input translation — identical path for human and AI
  // =====================================================================

  private updateIntentFromInput(ctx: FighterTickContext): void {
    const i = this.input;
    const f = i.current;
    const mag = i.moveMagnitude;

    if (mag > 0.15) {
      // Convert stick input from camera space into world space.
      const cy = Math.cos(f.cameraYaw);
      const sy = Math.sin(f.cameraYaw);
      const wx = f.moveX * cy + f.moveZ * sy;
      const wz = -f.moveX * sy + f.moveZ * cy;
      const len = Math.hypot(wx, wz) || 1;
      this.intent.x = wx / len;
      this.intent.z = wz / len;
      this.intent.magnitude = clamp(mag, 0, 1);
    } else {
      this.intent.x = 0;
      this.intent.z = 0;
      this.intent.magnitude = 0;
    }
    this.intent.boost = i.held('boost');
    this.intent.ascend = i.held('jump');
    this.intent.descend = i.held('descend');

    // Lock-on toggle is always available, even during recovery, so the player
    // never loses their read on the opponent.
    if (i.pressed('lockOn')) {
      this.lockOnEnabled = !this.lockOnEnabled;
      this.lockOnTarget = this.lockOnEnabled && ctx.opponent ? ctx.opponent.index : -1;
      ctx.events.emit('lockOnChanged', {
        source: this.index,
        target: this.lockOnTarget,
        value: this.lockOnEnabled ? 1 : 0,
      });
    }
  }

  // =====================================================================
  // Free state — the fighter is in control
  // =====================================================================

  private tickFree(ctx: FighterTickContext): void {
    const i = this.input;

    // --- Defensive options are checked first: defence must always be able to
    // --- interrupt the neutral game, otherwise blocking feels laggy.
    if (this.tryDefensiveActions(ctx)) return;

    // --- Offensive options.
    if (this.tryOffensiveActions(ctx)) return;

    // --- Movement.
    const guardHeld = i.held('guard') && this.grounded && !this.guard.broken;
    this.defense.setGuarding(guardHeld);

    if (guardHeld) {
      this.setState(FighterState.Guard);
      // Guarding roots the fighter but still allows a slow shuffle.
      this.movement.applyGround(this.velocity, this.scaledIntent(0.35), 0.45, ctx.dt);
      this.faceTarget(ctx, 1.4);
      return;
    }

    this.tickLocomotion(ctx);
  }

  private scaledIntent(scale: number): MoveIntent {
    this.scaledIntentCache.x = this.intent.x;
    this.scaledIntentCache.z = this.intent.z;
    this.scaledIntentCache.magnitude = this.intent.magnitude * scale;
    this.scaledIntentCache.boost = false;
    this.scaledIntentCache.ascend = this.intent.ascend;
    this.scaledIntentCache.descend = this.intent.descend;
    return this.scaledIntentCache;
  }
  private readonly scaledIntentCache: MoveIntent = emptyMoveIntent();

  private tickLocomotion(ctx: FighterTickContext): void {
    const i = this.input;
    const spd = this.speedMultiplier;

    // Charging energy: hold to charge, roots the fighter, fully interruptible.
    if (i.held('charge') && this.grounded) {
      this.setState(FighterState.Charging);
      this.velocity.x = damp(this.velocity.x, 0, 18, ctx.dt);
      this.velocity.z = damp(this.velocity.z, 0, 18, ctx.dt);
      this.faceTarget(ctx, 2.2);
      if (this.stateFrames % 12 === 0) {
        ctx.events.emit('charge', {
          source: this.index,
          position: this.position,
          value: this.energy.fraction,
        });
      }
      return;
    }

    // --- Flight entry / exit -------------------------------------------
    if (this.movement.flying) {
      if (i.pressed('descend') && this.grounded) this.movement.exitFlight();
    } else if (!this.grounded && i.take('jump', 6)) {
      // Tapping jump in the air snaps into flight. This is the single most
      // important traversal verb in the game, so it is bound to the most
      // reachable button and requires no charge.
      this.movement.enterFlight(this.velocity);
      ctx.events.emit('flightEnter', { source: this.index, position: this.position });
    }

    // --- Dash / pursuit ------------------------------------------------
    if (i.buffered('dodge', 4) && i.held('boost') && this.movement.canDash) {
      // Boost + dodge = dash. Kept as a chord so dodge alone stays defensive.
      if (this.tryDash(ctx)) {
        i.consume('dodge');
        return;
      }
    }

    if (this.grounded && !this.movement.flying) {
      if (i.take('jump', 6)) {
        this.movement.jump(this.velocity, spd);
        this.setState(FighterState.Jump);
        ctx.events.emit('jump', { source: this.index, position: this.position });
        return;
      }
      this.movement.applyGround(this.velocity, this.intent, spd, ctx.dt);
      const speed = this.velocity.lengthXZ;
      if (speed > this.data.movement.walkSpeed * 1.05 && this.intent.boost) {
        this.setState(FighterState.Sprint);
      } else if (speed > 0.35) {
        this.setState(FighterState.Move);
      } else {
        this.setState(FighterState.Idle);
      }
      this.faceMoveOrTarget(ctx);
      return;
    }

    if (this.movement.flying) {
      const wantsBoost = this.intent.boost;
      const cost = this.movement.applyFlight(
        this.velocity,
        this.intent,
        spd,
        this.energy.has(1),
        ctx.dt,
      );
      if (cost > 0) this.energy.spend(cost);
      this.setState(
        wantsBoost && this.energy.has(1) ? FighterState.Boost : FighterState.Fly,
      );
      this.faceMoveOrTarget(ctx);
      return;
    }

    // Plain airborne (jumping / falling).
    this.movement.applyAir(
      this.velocity,
      this.intent,
      spd,
      this.input.held('jump'),
      juggleGravityMultiplier(0),
      ctx.dt,
    );
    this.setState(this.velocity.y > 0 ? FighterState.Jump : FighterState.Fall);
    this.faceMoveOrTarget(ctx);
  }

  // =====================================================================
  // Defensive actions
  // =====================================================================

  private tryDefensiveActions(ctx: FighterTickContext): boolean {
    const i = this.input;
    // Dodge (without boost held — that chord is a dash).
    if (!i.held('boost') && i.buffered('dodge', 6) && this.defense.canDodge) {
      i.consume('dodge');
      this.startDodge(ctx);
      return true;
    }
    return false;
  }

  private startDodge(ctx: FighterTickContext): void {
    // Dodge in the input direction; with no input, dodge backward from the
    // target so a panic press always produces the sensible escape.
    if (this.intent.magnitude > 0.2) {
      this.tmpVec.set(this.intent.x, 0, this.intent.z);
    } else if (ctx.opponent) {
      this.tmpVec
        .copy(this.position)
        .sub(ctx.opponent.position)
        .set(this.position.x - ctx.opponent.position.x, 0, this.position.z - ctx.opponent.position.z)
        .normalize();
    } else {
      this.forward(this.tmpVec).scale(-1);
    }
    this.defense.startDodge(this.tmpVec);
    this.setState(FighterState.Dodge);
    ctx.events.emit('dodge', {
      source: this.index,
      position: this.position,
      direction: this.tmpVec,
    });
  }

  private tickDodge(ctx: FighterTickContext): void {
    this.setState(FighterState.Dodge);
    this.defense.dodgeVelocity(this.tmpVec);
    this.velocity.x = this.tmpVec.x;
    this.velocity.z = this.tmpVec.z;
    if (!this.grounded && !this.movement.flying) {
      this.velocity.y -= this.data.movement.gravity * 0.35 * ctx.dt;
    } else if (this.movement.flying) {
      this.velocity.y = damp(this.velocity.y, 0, 10, ctx.dt);
    }
    this.faceTarget(ctx, 1.0);
  }

  // =====================================================================
  // Dash / pursuit
  // =====================================================================

  private tryDash(ctx: FighterTickContext): boolean {
    const spd = this.speedMultiplier;
    const opp = ctx.opponent;

    // Pursuit dash: if the opponent is launched/airborne and far enough away,
    // the dash becomes a long-range chase. This is the mechanic that makes
    // aerial combat continuous rather than a series of disconnected juggles.
    const oppLaunched =
      opp &&
      (opp.state === FighterState.Launched ||
        opp.state === FighterState.Hitstun ||
        !opp.grounded);
    const dist = opp ? this.position.distanceTo(opp.position) : Infinity;

    if (
      opp &&
      oppLaunched &&
      dist > 5 &&
      dist < this.data.movement.pursuitRange &&
      this.energy.has(this.data.movement.pursuitEnergyCost)
    ) {
      this.energy.spend(this.data.movement.pursuitEnergyCost);
      this.tmpVec
        .set(
          opp.position.x - this.position.x,
          opp.position.y + opp.data.visual.height * 0.4 - this.position.y,
          opp.position.z - this.position.z,
        )
        .normalize();
      this.movement.startDash(this.tmpVec, true, spd);
      this.movement.enterFlight(this.velocity);
      this.setState(FighterState.Pursuit);
      ctx.events.emit('dash', {
        source: this.index,
        position: this.position,
        direction: this.tmpVec,
        tag: 'pursuit',
      });
      return true;
    }

    // Ordinary dash. In the air it costs energy and a charge.
    if (!this.grounded && !this.movement.flying) {
      if (!this.energy.has(this.data.movement.airDashEnergyCost)) {
        this.refuse(ctx, AbilityRefusal.NotEnoughEnergy);
        return false;
      }
      if (!this.movement.consumeAirDashCharge()) return false;
      this.energy.spend(this.data.movement.airDashEnergyCost);
    }

    if (this.intent.magnitude > 0.2) {
      this.tmpVec.set(this.intent.x, 0, this.intent.z);
    } else {
      this.forward(this.tmpVec);
    }
    this.movement.startDash(this.tmpVec, false, spd);
    this.setState(FighterState.Dash);
    ctx.events.emit('dash', {
      source: this.index,
      position: this.position,
      direction: this.tmpVec,
      tag: 'dash',
    });
    return true;
  }

  private tickDash(ctx: FighterTickContext): void {
    this.movement.applyDash(this.velocity);
    this.setState(
      this.movement.dashIsPursuit ? FighterState.Pursuit : FighterState.Dash,
    );

    // A pursuit dash re-homes every frame so a moving target can't simply
    // drift out of the path, and terminates on arrival.
    if (this.movement.dashIsPursuit && ctx.opponent) {
      const opp = ctx.opponent;
      this.tmpVec
        .set(
          opp.position.x - this.position.x,
          opp.position.y + opp.data.visual.height * 0.4 - this.position.y,
          opp.position.z - this.position.z,
        );
      const d = this.tmpVec.length;
      if (d < 3.2) {
        this.movement.endDash(this.velocity);
        this.faceTarget(ctx, 100);
        return;
      }
      this.tmpVec.normalize();
      Vec3.lerp(
        this.movement.dashDirection,
        this.tmpVec,
        0.22,
        this.movement.dashDirection,
      );
      this.movement.dashDirection.normalize();
    }

    if (this.movement.dashFrames <= 1) this.movement.endDash(this.velocity);
    this.faceMoveOrTarget(ctx);
  }

  // =====================================================================
  // Offensive actions
  // =====================================================================

  private tryOffensiveActions(ctx: FighterTickContext): boolean {
    const i = this.input;

    if (i.take('ultimate', 10)) {
      if (this.tryActivateAbility(this.data.ultimate, ctx)) return true;
    }
    if (i.take('transform', 10)) {
      if (this.tryTransform(ctx)) return true;
    }
    for (const ab of this.data.abilities) {
      const slot = `ability${ab.slot}` as 'ability1';
      if (i.buffered(slot, 8)) {
        i.consume(slot);
        if (this.tryActivateAbility(ab, ctx)) return true;
      }
    }

    // Launcher — guard + heavy while grounded. This MUST be tested before the
    // plain heavy branch below, otherwise the heavy consumes the buffered
    // press first and the launcher input can never fire.
    if (this.grounded && i.held('guard') && i.buffered('heavy', 8)) {
      i.consume('heavy');
      this.startAttack(this.data.attacks[this.data.launcher], ctx, -1);
      return true;
    }

    // Charge stance: entered by holding heavy, released as an attack.
    //
    // Pressing heavy puts the fighter into the wind-up on the very next frame,
    // so there is immediate visual feedback and no perceived input lag. What
    // the release produces depends on how long it was held:
    //   short hold -> the normal heavy (fast, standard damage)
    //   long hold  -> the charged heavy, scaled by how full the charge got
    if (this.combat.charging) {
      this.combat.tickCharge();
      if (!i.held('heavy') || this.combat.isFullyCharged) {
        const ratio = this.combat.chargeRatio;
        const charged = this.combat.chargeReleasable;
        this.combat.endCharge();
        const base = charged
          ? this.data.attacks[this.data.chargedHeavyAttack]
          : this.data.attacks[this.data.heavyAttack];
        this.startAttack(charged ? applyChargeScaling(base, ratio) : base, ctx, -1);
        ctx.events.emit('chargeRelease', {
          source: this.index,
          position: this.position,
          value: charged ? ratio : 0,
        });
        return true;
      }
      this.setState(FighterState.Charging);
      this.velocity.x = damp(this.velocity.x, 0, 14, ctx.dt);
      this.velocity.z = damp(this.velocity.z, 0, 14, ctx.dt);
      this.faceTarget(ctx, 2.0);
      return true;
    }

    if (i.buffered('heavy', 8)) {
      i.consume('heavy');
      if (this.grounded) {
        // Grounded heavies go through the charge stance so that tap and hold
        // are the same button with two outcomes.
        this.combat.beginCharge();
        this.setState(FighterState.Charging);
        return true;
      }
      // Aerial heavies fire immediately — there is no air charge.
      this.startAttack(this.data.attacks[this.data.airHeavyAttack], ctx, -1);
      return true;
    }

    if (i.buffered('light', 8)) {
      i.consume('light');
      const chain = this.grounded ? this.data.lightChain : this.data.airChain;
      const next = this.nextChainIndex(chain);
      this.startAttack(this.data.attacks[chain[next]], ctx, next);
      return true;
    }

    return false;
  }

  private nextChainIndex(chain: readonly string[]): number {
    if (this.combat.chainWindow > 0 && this.combat.chainIndex >= 0) {
      return Math.min(this.combat.chainIndex + 1, chain.length - 1);
    }
    return 0;
  }

  private startAttack(def: AttackDef, ctx: FighterTickContext, chainIndex: number): void {
    if (!def) return;
    this.combat.begin(
      this.bonusArmor > 0 ? { ...def, armor: def.armor + this.bonusArmor } : def,
      chainIndex,
    );
    this.setState(FighterState.Attack);
    this.defense.setGuarding(false);

    // Attack homing: snap toward the lock-on target so attacks connect at the
    // ranges players expect, without turning into a teleport.
    if (def.homing && ctx.opponent) {
      const d = this.position.distanceTo(ctx.opponent.position);
      if (d < def.homingRange) this.faceTarget(ctx, 100);
    }

    // Forward momentum on startup.
    this.forward(this.tmpVec).scale(def.advance);
    this.velocity.x += this.tmpVec.x;
    this.velocity.z += this.tmpVec.z;
    if (!this.grounded && !this.movement.flying) this.velocity.y *= 0.4;
  }

  private tickAttack(ctx: FighterTickContext): void {
    this.setState(FighterState.Attack);
    const a = this.combat.current!;

    // Attacks bleed momentum rather than stopping dead, so a dash-in attack
    // carries its speed through the swing.
    const drag = this.grounded ? 9 : 4.2;
    this.velocity.x = damp(this.velocity.x, 0, drag, ctx.dt);
    this.velocity.z = damp(this.velocity.z, 0, drag, ctx.dt);
    if (!this.grounded && !this.movement.flying) {
      // Reduced gravity during aerial attacks keeps air combos readable.
      this.velocity.y -= this.data.movement.gravity * 0.45 * ctx.dt;
    } else if (this.movement.flying) {
      this.velocity.y = damp(this.velocity.y, 0, 6, ctx.dt);
    }

    // Chain / special cancels during the attack.
    if (this.combat.connected) {
      const i = this.input;
      const chain = this.grounded ? this.data.lightChain : this.data.airChain;
      if (i.buffered('light', 8) && this.combat.chainIndex >= 0) {
        const nextIdx = Math.min(this.combat.chainIndex + 1, chain.length - 1);
        const nextId = chain[nextIdx];
        if (nextIdx !== this.combat.chainIndex && this.combat.canCancelInto(nextId)) {
          i.consume('light');
          this.startAttack(this.data.attacks[nextId], ctx, nextIdx);
          return;
        }
      }
      if (this.combat.canSpecialCancel()) {
        for (const ab of this.data.abilities) {
          const slot = `ability${ab.slot}` as 'ability1';
          if (i.buffered(slot, 8)) {
            i.consume(slot);
            if (this.tryActivateAbility(ab, ctx)) return;
          }
        }
        if (i.buffered('ultimate', 10)) {
          i.consume('ultimate');
          if (this.tryActivateAbility(this.data.ultimate, ctx)) return;
        }
      }
    }

    if (this.combat.advance()) {
      this.setState(this.grounded ? FighterState.Idle : FighterState.Fall);
    }
    void a;
  }

  // =====================================================================
  // Abilities
  // =====================================================================

  tryActivateAbility(ab: AbilityDef, ctx: FighterTickContext): boolean {
    if (!ab) return false;
    if (this.activeAbility) {
      this.refuse(ctx, AbilityRefusal.Busy);
      return false;
    }
    if (!this.cooldowns.isReady(ab.id)) {
      this.refuse(ctx, AbilityRefusal.OnCooldown, ab.id);
      return false;
    }
    if (this.grounded && !ab.groundOk) {
      this.refuse(ctx, AbilityRefusal.WrongStance, ab.id);
      return false;
    }
    if (!this.grounded && !ab.airOk) {
      this.refuse(ctx, AbilityRefusal.WrongStance, ab.id);
      return false;
    }
    if (ab.kind === AbilityKind.Ultimate && !ctx.opponent) {
      this.refuse(ctx, AbilityRefusal.NoTarget, ab.id);
      return false;
    }
    if (!this.energy.has(ab.energyCost)) {
      this.refuse(ctx, AbilityRefusal.NotEnoughEnergy, ab.id);
      return false;
    }

    this.energy.spend(ab.energyCost);
    this.combat.interrupt();
    this.activeAbility = ab;
    this.abilityFrame = 0;
    this.abilityShotsFired = 0;
    this.lastResolvedAbilityFrame = -1;
    this.counterActive = false;
    this.counterTriggered = false;
    this.setState(
      ab.kind === AbilityKind.Ultimate ? FighterState.Cinematic : FighterState.Ability,
    );
    this.defense.setGuarding(false);
    if (ctx.opponent) this.faceTarget(ctx, 100);

    ctx.events.emit(ab.kind === AbilityKind.Ultimate ? 'ultimateStart' : 'abilityCast', {
      source: this.index,
      target: ctx.opponent?.index ?? -1,
      position: this.position,
      tag: ab.id,
      magnitude: ab.shake,
    });
    return true;
  }

  private tickAbility(ctx: FighterTickContext): void {
    const ab = this.activeAbility!;
    this.abilityFrame++;

    // Movement during abilities is delegated by kind; the Simulation handles
    // spawning projectiles and resolving strikes, since those need both sides.
    switch (ab.kind) {
      case AbilityKind.Rush:
        this.tickRushAbility(ab, ctx);
        break;
      case AbilityKind.Counter:
        this.counterActive =
          this.abilityFrame >= ab.startup &&
          this.abilityFrame < ab.startup + (ab.counterWindow ?? ab.active);
        this.velocity.x = damp(this.velocity.x, 0, 16, ctx.dt);
        this.velocity.z = damp(this.velocity.z, 0, 16, ctx.dt);
        if (!this.grounded && !this.movement.flying) {
          this.velocity.y = damp(this.velocity.y, -2, 6, ctx.dt);
        }
        this.faceTarget(ctx, 3.0);
        break;
      case AbilityKind.Ultimate:
        this.setState(FighterState.Cinematic);
        this.velocity.scale(0.82);
        this.faceTarget(ctx, 4.0);
        break;
      default:
        this.velocity.x = damp(this.velocity.x, 0, 11, ctx.dt);
        this.velocity.z = damp(this.velocity.z, 0, 11, ctx.dt);
        if (!this.grounded && !this.movement.flying) {
          this.velocity.y -= this.data.movement.gravity * 0.3 * ctx.dt;
        } else if (this.movement.flying) {
          this.velocity.y = damp(this.velocity.y, 0, 7, ctx.dt);
        }
        this.faceTarget(ctx, 2.5);
        break;
    }

    const total =
      ab.kind === AbilityKind.Ultimate
        ? (ab.cinematicFrames ?? 120)
        : ab.startup + ab.active + ab.recovery;

    if (this.abilityFrame >= total) this.endAbility(ctx);
  }

  private tickRushAbility(ab: AbilityDef, ctx: FighterTickContext): void {
    if (this.abilityFrame < ab.startup) {
      this.velocity.x = damp(this.velocity.x, 0, 14, ctx.dt);
      this.velocity.z = damp(this.velocity.z, 0, 14, ctx.dt);
      this.faceTarget(ctx, 6.0);
      return;
    }
    if (this.abilityFrame < ab.startup + ab.active) {
      const opp = ctx.opponent;
      const speed = ab.rushSpeed ?? 55;
      if (opp) {
        this.tmpVec.set(
          opp.position.x - this.position.x,
          opp.position.y + opp.data.visual.height * 0.45 - this.position.y,
          opp.position.z - this.position.z,
        );
        const d = this.tmpVec.length;
        this.tmpVec.normalize();
        // Stop short so the strike lands at a readable distance rather than
        // clipping through the opponent.
        if (d > 2.2) {
          this.velocity.copy(this.tmpVec).scale(speed);
        } else {
          this.velocity.scale(0.25);
        }
      } else {
        this.forward(this.tmpVec);
        this.velocity.copy(this.tmpVec).scale(speed);
      }
      this.faceTarget(ctx, 100);
      return;
    }
    this.velocity.scale(0.72);
  }

  endAbility(ctx: FighterTickContext): void {
    const ab = this.activeAbility;
    if (!ab) return;
    this.cooldowns.start(ab.id, ab.cooldown);
    if (ab.kind === AbilityKind.Ultimate) {
      ctx.events.emit('ultimateEnd', { source: this.index, tag: ab.id });
    }
    this.activeAbility = null;
    this.abilityFrame = 0;
    this.abilityShotsFired = 0;
    this.lastResolvedAbilityFrame = -1;
    this.counterActive = false;
    this.counterTriggered = false;
    this.setState(this.grounded ? FighterState.Idle : FighterState.Fall);
  }

  private refuse(ctx: FighterTickContext, why: AbilityRefusal, tag = ''): void {
    this.lastRefusal = why;
    ctx.events.emit('abilityRefused', {
      source: this.index,
      tag,
      value: why === AbilityRefusal.NotEnoughEnergy ? 1 : 0,
    });
  }

  // =====================================================================
  // Transformation
  // =====================================================================

  tryTransform(ctx: FighterTickContext): boolean {
    if (this.transformed || this.transformFrames > 0) return false;
    if (!this.ascension.canTransform) {
      this.refuse(ctx, AbilityRefusal.NotEnoughEnergy, this.transformation.id);
      return false;
    }
    this.combat.interrupt();
    this.activeAbility = null;
    this.transformFrames = this.transformation.frames;
    this.setState(FighterState.Transform);
    // The transformation sequence is fully invulnerable, which is what makes it
    // a legitimate defensive reset — and why it is gated behind a full meter.
    this.defense.grantInvulnerability(this.transformation.frames + 4);
    this.ascension.begin();
    this.transformed = true;
    ctx.events.emit('transformStart', {
      source: this.index,
      position: this.position,
      tag: this.transformation.id,
      magnitude: 0.85,
    });
    return true;
  }

  private tickTransform(ctx: FighterTickContext): void {
    this.transformFrames--;
    this.velocity.x = damp(this.velocity.x, 0, 20, ctx.dt);
    this.velocity.z = damp(this.velocity.z, 0, 20, ctx.dt);
    if (!this.grounded) this.velocity.y = damp(this.velocity.y, 0, 8, ctx.dt);
    this.faceTarget(ctx, 2.0);
    if (this.transformFrames <= 0) {
      this.setState(this.grounded ? FighterState.Idle : FighterState.Fly);
      if (!this.grounded) this.movement.enterFlight(this.velocity);
    }
  }

  private endTransformation(ctx: FighterTickContext): void {
    if (!this.transformed) return;
    this.transformed = false;
    ctx.events.emit('transformEnd', {
      source: this.index,
      position: this.position,
      tag: this.transformation.id,
    });
  }

  /** Force-ends a transformation (match reset, KO). */
  cancelTransformation(): void {
    this.transformed = false;
    this.transformFrames = 0;
    this.ascension.active = false;
  }

  // =====================================================================
  // Reactions — being hit
  // =====================================================================

  /**
   * Applies a resolved hit. Called by the Simulation, which has already decided
   * blocking, damage scaling and so on.
   */
  receiveHit(
    damage: number,
    reaction: ReactionType,
    knockback: Vec3,
    hitstunFrames: number,
    hitstopFrames: number,
    ctx: FighterTickContext,
  ): void {
    if (this.defeated) return;

    this.combat.interrupt();
    // An ability in progress is cancelled unless it is uninterruptible.
    if (this.activeAbility) {
      const policy = this.activeAbility.interrupt;
      if (policy !== 'Uninterruptible') {
        this.activeAbility = null;
        this.abilityFrame = 0;
        this.counterActive = false;
      }
    }
    this.defense.setGuarding(false);
    this.movement.endDash(this.velocity);
    this.movement.dashFrames = 0;

    const applied = this.health.apply(damage);
    this.ascension.onDamageTaken(applied);
    this.energy.gain(this.data.energyPerBar * 0.06);
    this.hitstop = hitstopFrames;

    this.velocity.copy(knockback);
    this.currentReaction = reaction;
    this.reactionFrames = hitstunFrames;

    if (reaction === ReactionType.Launch || reaction === ReactionType.Blowaway) {
      this.setState(FighterState.Launched);
      this.movement.exitFlight();
      this.juggleHits++;
    } else if (reaction === ReactionType.Slam) {
      this.setState(FighterState.Launched);
      this.movement.exitFlight();
      this.juggleHits++;
    } else {
      this.setState(FighterState.Hitstun);
      if (!this.grounded) this.juggleHits++;
    }

    if (this.health.isDead) this.onDefeated(ctx);
  }

  /** Applies a blocked hit: chip damage, guard damage and blockstun. */
  receiveBlockedHit(
    chip: number,
    guardDamage: number,
    blockstunFrames: number,
    hitstopFrames: number,
    pushback: Vec3,
    ctx: FighterTickContext,
  ): void {
    if (this.defeated) return;
    const applied = this.health.apply(chip);
    this.ascension.onDamageTaken(applied * 0.5);
    this.hitstop = hitstopFrames;
    this.defense.applyBlockstun(blockstunFrames);
    this.velocity.x = pushback.x;
    this.velocity.z = pushback.z;
    this.setState(FighterState.GuardStun);

    if (this.guard.applyGuardDamage(guardDamage)) {
      this.defense.applyGuardBreak(this.guard.breakStunFrames);
      this.setState(FighterState.GuardBreak);
      this.reactionFrames = this.guard.breakStunFrames;
      ctx.events.emit('guardBreak', {
        source: this.index,
        position: this.position,
        magnitude: 0.6,
      });
    }
    if (this.health.isDead) this.onDefeated(ctx);
  }

  private tickReaction(ctx: FighterTickContext): void {
    this.reactionFrames--;

    if (this.state === FighterState.GuardBreak) {
      this.velocity.x = damp(this.velocity.x, 0, 6, ctx.dt);
      this.velocity.z = damp(this.velocity.z, 0, 6, ctx.dt);
      if (!this.grounded) this.velocity.y -= this.data.movement.gravity * ctx.dt;
      if (this.reactionFrames <= 0) {
        this.guard.recoverFromBreak();
        this.setState(this.grounded ? FighterState.Idle : FighterState.Fall);
      }
      return;
    }

    if (this.state === FighterState.Downed) {
      this.velocity.x = damp(this.velocity.x, 0, 12, ctx.dt);
      this.velocity.z = damp(this.velocity.z, 0, 12, ctx.dt);
      // Ground recovery: any recovery input rises early with invulnerability.
      const early =
        this.input.take('dodge', 6) ||
        this.input.take('jump', 6) ||
        this.input.take('guard', 6);
      if (early || this.reactionFrames <= 0) {
        this.setState(FighterState.WakeUp);
        this.stateFrames = 0;
        this.reactionFrames = WAKEUP_FRAMES;
        this.defense.grantInvulnerability(WAKEUP_FRAMES + 2);
        this.juggleHits = 0;
        this.airRecoverUsed = false;
      }
      return;
    }

    // Launched / hitstun.
    const juggleGravity = juggleGravityMultiplier(this.juggleHits);
    if (!this.grounded) {
      this.velocity.y -= this.data.movement.gravity * juggleGravity * ctx.dt;
      this.velocity.y = Math.max(this.velocity.y, -this.data.movement.maxFallSpeed);
      this.velocity.x = damp(this.velocity.x, 0, 1.1, ctx.dt);
      this.velocity.z = damp(this.velocity.z, 0, 1.1, ctx.dt);

      // Air recovery — one per juggle, costs nothing, but only after the
      // initial launch frames so it can't nullify the launcher outright.
      const launchElapsed = this.stateFrames;
      if (
        !this.airRecoverUsed &&
        launchElapsed > 12 &&
        this.velocity.y < LAUNCH_SETTLE_SPEED &&
        this.input.take('dodge', 6)
      ) {
        this.airRecoverUsed = true;
        this.setState(FighterState.AirRecover);
        this.stateFrames = 0;
        this.reactionFrames = AIR_RECOVER_FRAMES;
        this.defense.grantInvulnerability(AIR_RECOVER_FRAMES + 2);
        this.velocity.scale(0.2);
        ctx.events.emit('comboEscape', {
          source: this.index,
          position: this.position,
          tag: 'airRecover',
        });
        return;
      }
    } else {
      this.velocity.x = damp(this.velocity.x, 0, 7, ctx.dt);
      this.velocity.z = damp(this.velocity.z, 0, 7, ctx.dt);
    }

    if (this.reactionFrames <= 0 && this.grounded) {
      this.setState(FighterState.Idle);
      this.juggleHits = 0;
      this.airRecoverUsed = false;
    } else if (this.reactionFrames <= 0 && !this.grounded) {
      // Out of hitstun but still airborne: regain control in freefall.
      this.setState(FighterState.Fall);
      this.juggleHits = 0;
    }
  }

  private tickRecoveryState(ctx: FighterTickContext): void {
    this.reactionFrames--;
    this.velocity.x = damp(this.velocity.x, 0, 10, ctx.dt);
    this.velocity.z = damp(this.velocity.z, 0, 10, ctx.dt);
    if (this.state === FighterState.AirRecover) {
      this.velocity.y = damp(this.velocity.y, 0, 9, ctx.dt);
    }
    this.faceTarget(ctx, 3.0);
    if (this.reactionFrames <= 0) {
      if (this.state === FighterState.AirRecover) {
        this.movement.enterFlight(this.velocity);
        this.setState(FighterState.Fly);
      } else {
        this.setState(FighterState.Idle);
      }
    }
  }

  /**
   * Combo escape — "Phase Break". Costs a full bar and grants i-frames.
   * Callable from any hitstun state once the combo is deep enough.
   */
  tryComboEscape(ctx: FighterTickContext): boolean {
    const d = this.data.defense;
    if (!this.isHelpless) return false;
    if (this.state === FighterState.Defeated) return false;
    if (!this.energy.has(d.comboEscapeCost)) {
      this.refuse(ctx, AbilityRefusal.NotEnoughEnergy, 'phaseBreak');
      return false;
    }
    const attacker = ctx.opponent;
    if (attacker && attacker.combo.hits < d.comboEscapeMinHits) return false;

    this.energy.spend(d.comboEscapeCost);
    this.defense.grantInvulnerability(d.comboEscapeIFrames);
    this.reactionFrames = 0;
    this.juggleHits = 0;
    this.airRecoverUsed = false;
    this.hitstop = 0;
    this.velocity.set(0, 0, 0);
    if (attacker) attacker.combo.reset();
    if (this.grounded) {
      this.setState(FighterState.Idle);
    } else {
      this.movement.enterFlight(this.velocity);
      this.setState(FighterState.Fly);
    }
    ctx.events.emit('comboEscape', {
      source: this.index,
      position: this.position,
      tag: 'phaseBreak',
      magnitude: 0.5,
    });
    return true;
  }

  private onDefeated(ctx: FighterTickContext): void {
    this.defeated = true;
    this.cancelTransformation();
    this.combat.interrupt();
    this.activeAbility = null;
    this.setState(FighterState.Defeated);
    ctx.events.emit('knockout', {
      source: this.index,
      position: this.position,
      magnitude: 1,
    });
  }

  private tickDefeated(ctx: FighterTickContext): void {
    this.stateFrames++;
    this.velocity.x = damp(this.velocity.x, 0, 3, ctx.dt);
    this.velocity.z = damp(this.velocity.z, 0, 3, ctx.dt);
    if (!this.grounded) this.velocity.y -= this.data.movement.gravity * ctx.dt;
    this.integrate(ctx);
  }

  // =====================================================================
  // Physics integration
  // =====================================================================

  private integrate(ctx: FighterTickContext): void {
    const dt = ctx.dt;
    this.position.addScaled(this.velocity, dt);

    const r = this.data.visual.radius;
    ctx.arena.resolve(this.position, this.velocity, r, dt, this.boundary);

    if (this.boundary.hitWall && this.boundary.impactSpeed > 3) {
      const launched =
        this.state === FighterState.Launched || this.state === FighterState.Hitstun;
      if (launched && this.boundary.impactSpeed > WALL_SPLAT_SPEED) {
        // Wall splat: bounce off, extend hitstun slightly, big feedback.
        this.velocity.addScaled(this.boundary.normal, this.boundary.impactSpeed * 0.55);
        this.reactionFrames = Math.max(this.reactionFrames, 22);
        this.hitstop = Math.max(this.hitstop, 6);
        ctx.events.emit('wallImpact', {
          source: this.index,
          position: this.position,
          direction: this.boundary.normal,
          magnitude: Math.min(1, this.boundary.impactSpeed / 28),
          tag: 'splat',
        });
      } else if (this.boundary.impactSpeed > 8) {
        ctx.events.emit('wallImpact', {
          source: this.index,
          position: this.position,
          direction: this.boundary.normal,
          magnitude: Math.min(0.5, this.boundary.impactSpeed / 40),
          tag: 'graze',
        });
      }
    }

    // Ground plane and landing.
    const wasGrounded = this.grounded;
    const impactSpeed = -this.velocity.y;
    this.grounded = this.movement.resolveGround(
      this.position,
      this.velocity,
      ctx.arena.def.floor,
    );

    if (this.grounded && !wasGrounded) {
      const launched =
        this.state === FighterState.Launched || this.state === FighterState.Hitstun;
      if (launched && impactSpeed > GROUND_BOUNCE_SPEED && this.juggleHits < 12) {
        // Ground bounce — a combo extender the attacker can capitalise on.
        this.velocity.y = impactSpeed * GROUND_BOUNCE_RESTITUTION;
        this.grounded = false;
        this.position.y = 0.05;
        this.reactionFrames = Math.max(this.reactionFrames, 18);
        ctx.events.emit('groundImpact', {
          source: this.index,
          position: this.position,
          magnitude: Math.min(1, impactSpeed / 30),
          tag: 'bounce',
        });
      } else if (launched) {
        // Knockdown.
        this.setState(FighterState.Downed);
        this.reactionFrames = DOWNED_FRAMES;
        this.velocity.set(0, 0, 0);
        ctx.events.emit('groundImpact', {
          source: this.index,
          position: this.position,
          magnitude: Math.min(1, impactSpeed / 30),
          tag: 'knockdown',
        });
      } else {
        this.movement.exitFlight();
        if (impactSpeed > 6) {
          ctx.events.emit('land', {
            source: this.index,
            position: this.position,
            magnitude: Math.min(1, impactSpeed / 25),
          });
        }
        if (
          this.state === FighterState.Fall ||
          this.state === FighterState.Jump ||
          this.state === FighterState.Fly ||
          this.state === FighterState.Boost
        ) {
          this.setState(FighterState.Idle);
        }
      }
    }

    if (!this.grounded && wasGrounded && this.state === FighterState.Idle) {
      this.setState(FighterState.Fall);
    }

    // Lean is presentation-only: a smoothed read of horizontal acceleration.
    const targetLean = clamp(this.velocity.lengthXZ / 28, 0, 1);
    this.lean = damp(this.lean, targetLean, 8, dt);
  }

  private regenerateEnergy(ctx: FighterTickContext): void {
    const charging = this.state === FighterState.Charging;
    const mult = this.transformed ? this.transformation.energyRegenMultiplier : 1;
    this.energy.regen(ctx.dt, charging, mult);
  }

  // =====================================================================
  // Facing
  // =====================================================================

  private faceTarget(ctx: FighterTickContext, rateScale: number): void {
    const opp = ctx.opponent;
    if (!opp) return;
    const dx = opp.position.x - this.position.x;
    const dz = opp.position.z - this.position.z;
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    const target = Math.atan2(dx, dz);
    this.yaw = this.movement.turnToward(this.yaw, target, ctx.dt, rateScale);
  }

  private faceMoveOrTarget(ctx: FighterTickContext): void {
    // Locked on: always face the target so attacks and camera agree.
    if (this.lockOnEnabled && ctx.opponent) {
      this.faceTarget(ctx, 2.2);
      return;
    }
    if (this.intent.magnitude > 0.15) {
      const target = Math.atan2(this.intent.x, this.intent.z);
      this.yaw = this.movement.turnToward(this.yaw, target, ctx.dt, 1.6);
    } else if (ctx.opponent) {
      this.faceTarget(ctx, 0.8);
    }
  }

  private setState(s: FighterState): void {
    if (this.state !== s) {
      this.state = s;
      this.stateFrames = 0;
    }
  }

  // =====================================================================
  // Invalid-state recovery
  //
  // The brief lists "character becomes permanently stuck" as a P0 blocker and
  // asks explicitly for invalid-state tests. Rather than hoping no such state
  // exists, this watchdog detects and repairs them every frame.
  // =====================================================================

  private validate(ctx: FighterTickContext): void {
    if (!this.position.isFinite() || !this.velocity.isFinite()) {
      console.warn(`[Fighter ${this.index}] non-finite transform; resetting`);
      this.position.set(this.index === 0 ? -6 : 6, 0, 0);
      this.velocity.set(0, 0, 0);
      this.setState(FighterState.Idle);
      return;
    }
    if (!Number.isFinite(this.yaw)) this.yaw = 0;

    // Stuck below the floor or above the ceiling.
    if (this.position.y < ctx.arena.def.floor - 0.5) {
      this.position.y = ctx.arena.def.floor;
      this.velocity.y = 0;
    }

    // Stuck airborne with no vertical motion and no flight: force a fall.
    if (
      !this.grounded &&
      !this.movement.flying &&
      Math.abs(this.velocity.y) < 0.01 &&
      this.stateFrames > 180 &&
      !this.isHelpless &&
      this.state !== FighterState.Cinematic
    ) {
      console.warn(`[Fighter ${this.index}] stuck airborne; forcing fall`);
      this.velocity.y = -1;
      this.setState(FighterState.Fall);
    }

    // Stuck in a reaction state far past its expected duration.
    if (this.isHelpless && this.stateFrames > 600) {
      console.warn(`[Fighter ${this.index}] reaction state overrun; recovering`);
      this.reactionFrames = 0;
      this.juggleHits = 0;
      this.airRecoverUsed = false;
      this.setState(this.grounded ? FighterState.Idle : FighterState.Fall);
    }

    // Ability that never terminated.
    if (this.activeAbility && this.abilityFrame > 900) {
      console.warn(`[Fighter ${this.index}] ability overrun; force-ending`);
      this.endAbility(ctx);
    }

    // Hitstop that never cleared.
    if (this.hitstop > 60) this.hitstop = 0;
  }

  /** Debug snapshot used by tests and the on-screen diagnostics overlay. */
  snapshot(): Record<string, number | string | boolean> {
    return {
      id: this.data.id,
      state: this.state,
      stateFrames: this.stateFrames,
      hp: Math.round(this.health.current),
      energy: Math.round(this.energy.current),
      guard: Math.round(this.guard.current),
      ascension: Math.round(this.ascension.current),
      transformed: this.transformed,
      grounded: this.grounded,
      flying: this.movement.flying,
      x: +this.position.x.toFixed(2),
      y: +this.position.y.toFixed(2),
      z: +this.position.z.toFixed(2),
      speed: +this.velocity.length.toFixed(2),
      combo: this.combo.hits,
      hitstop: this.hitstop,
    };
  }
}

/** Convenience re-export so callers don't need two imports. */
export { FighterState };
