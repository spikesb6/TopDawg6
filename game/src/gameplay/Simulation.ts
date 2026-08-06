/**
 * Simulation — the authoritative game state.
 *
 * Runs at a fixed 60Hz with no dependency on the renderer, the DOM or a GPU.
 * The entire vertical slice can therefore be executed in Node at thousands of
 * frames per second for automated testing, which is what makes the Gauntlet
 * Loop's evidence requirements achievable.
 *
 * Owns everything that needs to see both fighters at once:
 *   - melee hit resolution (block / parry / armor / i-frames / scaling)
 *   - projectile integration and collision
 *   - ability effect scheduling
 *   - match flow (timer, KO, victory, restart)
 */

import { Vec3, clamp } from '../core/Vec3';
import { Rand } from '../core/Rand';
import { EventBus } from '../core/Events';
import type { InputFrame } from '../core/Input';
import { Fighter, type FighterTickContext } from './Fighter';
import { Arena, RUINS_OF_VEYRA, emptyBoundaryContact, type ArenaDef } from './Arena';
import { ProjectilePool, type Projectile } from './Projectile';
import { AbilityKind, InterruptPolicy, type AbilityDef } from './Ability';
import {
  FighterState,
  ReactionType,
  TICK_DT,
  emptyHitResult,
  type AttackDef,
  type HitResult,
} from './CombatTypes';
import { damageScaling, hitstunScaling, juggleLaunchScaling } from './DamageModel';
import type { CharacterData } from '../characters/CharacterData';

export enum MatchPhase {
  Intro = 'Intro',
  Fighting = 'Fighting',
  KO = 'KO',
  Victory = 'Victory',
  Paused = 'Paused',
}

export interface MatchResult {
  winnerIndex: number;
  /** 'ko' | 'timeout' | 'draw' */
  reason: 'ko' | 'timeout' | 'draw';
  durationFrames: number;
  bestCombo: [number, number];
  damageDealt: [number, number];
}

/** Frames the intro plays before control is handed over. */
const INTRO_FRAMES = 72;
/** Frames the KO slow-motion lasts before the victory screen. */
const KO_FRAMES = 150;
/** Default match length in seconds. */
export const DEFAULT_MATCH_SECONDS = 180;

export interface SimulationOptions {
  arena?: ArenaDef;
  seed?: number;
  matchSeconds?: number;
  /** Skip the intro — used by tests that want frame 0 to be live. */
  skipIntro?: boolean;
}

export class Simulation {
  readonly fighters: Fighter[] = [];
  readonly arena: Arena;
  readonly projectiles = new ProjectilePool();
  readonly events = new EventBus();
  readonly rand: Rand;

  phase: MatchPhase = MatchPhase.Intro;
  /** Frames elapsed since the match began (excludes pause). */
  frame = 0;
  /** Frames remaining on the match clock. */
  timerFrames: number;
  result: MatchResult | null = null;

  /** Global hitstop applied to the whole scene (ultimates). */
  globalHitstop = 0;
  /** Set while an ultimate cinematic owns the camera. */
  cinematicOwner = -1;
  cinematicFrames = 0;

  /** Accumulated damage dealt per fighter, for the results screen. */
  readonly damageDealt: [number, number] = [0, 0];

  private readonly ctxA: FighterTickContext;
  private readonly ctxB: FighterTickContext;
  private readonly tmp = new Vec3();
  private readonly tmp2 = new Vec3();
  private readonly hitOut: HitResult = emptyHitResult();
  private readonly matchSeconds: number;
  private readonly skipIntro: boolean;

  constructor(
    charA: CharacterData,
    charB: CharacterData,
    opts: SimulationOptions = {},
  ) {
    this.arena = new Arena(opts.arena ?? RUINS_OF_VEYRA);
    this.rand = new Rand(opts.seed ?? 0x1a2b3c4d);
    this.matchSeconds = opts.matchSeconds ?? DEFAULT_MATCH_SECONDS;
    this.skipIntro = opts.skipIntro ?? false;
    this.timerFrames = Math.round(this.matchSeconds * 60);

    this.fighters.push(new Fighter(0, charA), new Fighter(1, charB));
    this.ctxA = {
      arena: this.arena,
      opponent: this.fighters[1],
      events: this.events,
      dt: TICK_DT,
      cinematicLock: false,
    };
    this.ctxB = {
      arena: this.arena,
      opponent: this.fighters[0],
      events: this.events,
      dt: TICK_DT,
      cinematicLock: false,
    };
    this.reset();
  }

  get player(): Fighter {
    return this.fighters[0];
  }

  get enemy(): Fighter {
    return this.fighters[1];
  }

  // =====================================================================
  // Match lifecycle
  // =====================================================================

  reset(): void {
    this.fighters[0].resetForMatch(0, -7.5, 0);
    this.fighters[1].resetForMatch(0, 7.5, Math.PI);
    // Both fighters start locked on: this is a 1v1, and forcing the player to
    // press lock-on before the fight is readable would be hostile.
    for (const f of this.fighters) {
      f.lockOnEnabled = true;
      f.lockOnTarget = f.index === 0 ? 1 : 0;
    }
    this.projectiles.clear();
    this.arena.reset();
    this.phase = this.skipIntro ? MatchPhase.Fighting : MatchPhase.Intro;
    this.frame = 0;
    this.timerFrames = Math.round(this.matchSeconds * 60);
    this.result = null;
    this.globalHitstop = 0;
    this.cinematicOwner = -1;
    this.cinematicFrames = 0;
    this.damageDealt[0] = 0;
    this.damageDealt[1] = 0;
    this.events.emit('roundReset', {});
  }

  pause(): void {
    if (this.phase === MatchPhase.Fighting) this.phase = MatchPhase.Paused;
  }

  resume(): void {
    if (this.phase === MatchPhase.Paused) this.phase = MatchPhase.Fighting;
  }

  get isPaused(): boolean {
    return this.phase === MatchPhase.Paused;
  }

  // =====================================================================
  // Frame
  // =====================================================================

  /** Advances the simulation one fixed frame. */
  tick(inputA: InputFrame, inputB: InputFrame): void {
    this.events.beginFrame();

    if (this.phase === MatchPhase.Paused) return;

    if (this.phase === MatchPhase.Intro) {
      this.frame++;
      // Feed neutral input so buffers stay coherent through the intro.
      this.fighters[0].input.tick(inputA);
      this.fighters[1].input.tick(inputB);
      if (this.frame >= INTRO_FRAMES) {
        this.phase = MatchPhase.Fighting;
        this.frame = 0;
        for (const f of this.fighters) f.input.clearBuffer();
        this.events.emit('matchStart', {});
      }
      return;
    }

    if (this.phase === MatchPhase.KO) {
      this.frame++;
      this.tickKO();
      return;
    }

    if (this.phase === MatchPhase.Victory) return;

    // --- Live frame -------------------------------------------------------
    this.frame++;
    this.timerFrames = Math.max(0, this.timerFrames - 1);

    if (this.globalHitstop > 0) {
      this.globalHitstop--;
      // Still advance projectiles' visual age so trails don't freeze oddly,
      // but no movement or collision occurs during global hitstop.
      return;
    }

    this.fighters[0].input.tick(inputA);
    this.fighters[1].input.tick(inputB);

    // Combo-escape check runs before the fighter tick so an escape takes
    // effect on the same frame it was pressed — defensive inputs must never
    // feel delayed.
    this.checkComboEscapes();

    this.ctxA.cinematicLock = this.cinematicOwner === 1;
    this.ctxB.cinematicLock = this.cinematicOwner === 0;
    this.fighters[0].tick(this.ctxA);
    this.fighters[1].tick(this.ctxB);

    this.resolveFighterCollision();
    this.resolveComboContinuity();
    this.resolveMeleeHits();
    this.resolveAbilityEffects();
    this.tickProjectiles();
    this.tickCinematic();
    this.checkMatchEnd();
  }

  private tickKO(): void {
    // KO slow-motion: fighters keep simulating so bodies settle naturally.
    this.fighters[0].tick(this.ctxA);
    this.fighters[1].tick(this.ctxB);
    this.tickProjectiles();
    if (this.frame >= KO_FRAMES) {
      this.phase = MatchPhase.Victory;
      this.events.emit('matchEnd', {
        source: this.result?.winnerIndex ?? -1,
        tag: this.result?.reason ?? 'draw',
      });
    }
  }

  private checkMatchEnd(): void {
    if (this.result) return;
    const a = this.fighters[0];
    const b = this.fighters[1];
    const aDead = a.health.isDead;
    const bDead = b.health.isDead;

    if (aDead || bDead) {
      const winner = aDead && bDead ? -1 : aDead ? 1 : 0;
      this.result = {
        winnerIndex: winner,
        reason: 'ko',
        durationFrames: this.frame,
        bestCombo: [a.combo.best, b.combo.best],
        damageDealt: [this.damageDealt[0], this.damageDealt[1]],
      };
      this.phase = MatchPhase.KO;
      this.frame = 0;
      this.globalHitstop = 14;
      this.cinematicOwner = -1;
      this.events.emit('cameraShake', { magnitude: 0.9 });
      return;
    }

    if (this.timerFrames <= 0) {
      const fa = a.health.fraction;
      const fb = b.health.fraction;
      const winner = Math.abs(fa - fb) < 1e-4 ? -1 : fa > fb ? 0 : 1;
      this.result = {
        winnerIndex: winner,
        reason: 'timeout',
        durationFrames: this.frame,
        bestCombo: [a.combo.best, b.combo.best],
        damageDealt: [this.damageDealt[0], this.damageDealt[1]],
      };
      this.phase = MatchPhase.KO;
      this.frame = 0;
    }
  }

  private checkComboEscapes(): void {
    for (const f of this.fighters) {
      if (!f.isHelpless) continue;
      // Phase Break is guard+dodge together — impossible to press by accident
      // while mashing, but reachable under pressure.
      if (f.input.held('guard') && f.input.buffered('dodge', 6)) {
        const ctx = f.index === 0 ? this.ctxA : this.ctxB;
        if (f.tryComboEscape(ctx)) f.input.consume('dodge');
      }
    }
  }

  // =====================================================================
  // Fighter-vs-fighter collision
  //
  // Without this, fighters interpenetrate to near-zero separation, which puts
  // the target INSIDE the blind spot of a forward-projected hitbox — attacks
  // whiff at point-blank range and the fight silently stops working. Bodies
  // pushing apart is also what gives melee its sense of physical presence.
  //
  // Vertical spans must overlap, so flying directly above an opponent is still
  // legitimate positioning rather than a collision.
  // =====================================================================

  private resolveFighterCollision(): void {
    const a = this.fighters[0];
    const b = this.fighters[1];
    if (a.defeated || b.defeated) return;

    const ha = a.data.visual.height;
    const hb = b.data.visual.height;
    // No push if one is clearly stacked above the other.
    if (a.position.y >= b.position.y + hb || b.position.y >= a.position.y + ha) return;

    const dx = b.position.x - a.position.x;
    const dz = b.position.z - a.position.z;
    const minSep = a.data.visual.radius + b.data.visual.radius;
    let d = Math.hypot(dx, dz);

    if (d >= minSep) return;

    let nx: number;
    let nz: number;
    if (d < 1e-4) {
      // Exactly coincident: separate along the arena's radial axis so the
      // resolution is deterministic rather than dependent on float noise.
      const rl = Math.hypot(a.position.x, a.position.z);
      nx = rl > 1e-4 ? a.position.x / rl : 1;
      nz = rl > 1e-4 ? a.position.z / rl : 0;
      d = 1e-4;
    } else {
      nx = dx / d;
      nz = dz / d;
    }

    const overlap = minSep - d;

    // Weighting: a fighter who cannot act (hitstun, launched, downed) is pushed
    // more, so the attacker keeps their spacing advantage rather than being
    // shoved out of their own combo.
    const aFixed = a.isHelpless || a.state === FighterState.Cinematic;
    const bFixed = b.isHelpless || b.state === FighterState.Cinematic;
    let wa = 0.5;
    let wb = 0.5;
    if (aFixed && !bFixed) {
      wa = 0.15;
      wb = 0.85;
    } else if (bFixed && !aFixed) {
      wa = 0.85;
      wb = 0.15;
    }

    a.position.x -= nx * overlap * wa;
    a.position.z -= nz * overlap * wa;
    b.position.x += nx * overlap * wb;
    b.position.z += nz * overlap * wb;

    // Cancel only the closing component of velocity, so fighters slide around
    // each other instead of sticking together.
    const closing = (b.velocity.x - a.velocity.x) * nx + (b.velocity.z - a.velocity.z) * nz;
    if (closing < 0) {
      a.velocity.x += nx * closing * wa;
      a.velocity.z += nz * closing * wa;
      b.velocity.x -= nx * closing * wb;
      b.velocity.z -= nz * closing * wb;
    }

    // Keep both inside the arena after the push.
    this.arena.resolve(a.position, a.velocity, a.data.visual.radius, TICK_DT, this.collisionContact);
    this.arena.resolve(b.position, b.velocity, b.data.visual.radius, TICK_DT, this.collisionContact);
  }

  private readonly collisionContact = emptyBoundaryContact();

  /**
   * Ends each attacker's combo the moment their victim can act again, so the
   * combo counter measures what it claims to measure.
   */
  private resolveComboContinuity(): void {
    for (const attacker of this.fighters) {
      if (!attacker.combo.active) continue;
      const victim = attacker.index === 0 ? this.fighters[1] : this.fighters[0];
      const victimCanAct =
        !victim.isHelpless &&
        victim.defense.blockstunFrames <= 0 &&
        victim.hitstop <= 0 &&
        victim.state !== FighterState.Cinematic;
      attacker.combo.endIfVictimRecovered(victimCanAct);
    }
  }

  // =====================================================================
  // Melee hit resolution
  // =====================================================================

  private resolveMeleeHits(): void {
    for (const attacker of this.fighters) {
      const defender = attacker.index === 0 ? this.fighters[1] : this.fighters[0];
      if (!attacker.combat.hitboxLive) continue;
      const def = attacker.combat.current!;
      if (attacker.combat.hasHit(defender.index)) continue;
      if (!this.testHitbox(attacker, defender, def)) continue;
      attacker.combat.markConnected(defender.index);
      this.applyHit(attacker, defender, def, 1);
    }
  }

  /** Sphere-vs-capsule test with an angular arc constraint. */
  private testHitbox(attacker: Fighter, defender: Fighter, def: AttackDef): boolean {
    const hb = def.hitbox;
    attacker.forward(this.tmp);
    // Hitbox centre.
    const cx = attacker.position.x + this.tmp.x * hb.reach;
    const cy = attacker.position.y + hb.height;
    const cz = attacker.position.z + this.tmp.z * hb.reach;

    // Defender capsule: vertical segment from feet to head.
    const dh = defender.data.visual.height;
    const dy = clamp(cy, defender.position.y, defender.position.y + dh);
    const dx = defender.position.x - cx;
    const dz = defender.position.z - cz;
    const ddy = dy - cy;
    const distSq = dx * dx + ddy * ddy + dz * dz;
    const reach = hb.radius + defender.data.visual.radius;
    if (distSq > reach * reach) return false;

    // Arc constraint keeps attacks directional; PI means omnidirectional.
    if (hb.arc < Math.PI - 1e-3) {
      const tx = defender.position.x - attacker.position.x;
      const tz = defender.position.z - attacker.position.z;
      const len = Math.hypot(tx, tz);
      if (len > 1e-4) {
        const dot = (this.tmp.x * tx + this.tmp.z * tz) / len;
        if (Math.acos(clamp(dot, -1, 1)) > hb.arc) return false;
      }
    }
    return true;
  }

  /**
   * The single funnel through which ALL damage passes — melee, projectiles,
   * explosions and ultimates. Centralising it is what guarantees that combo
   * scaling, parries, armor and i-frames behave identically everywhere.
   */
  applyHit(
    attacker: Fighter,
    defender: Fighter,
    def: AttackDef,
    damageMultiplier: number,
    overridePosition?: Vec3,
    /**
     * Bypasses invulnerability. Used ONLY by an ultimate's payoff frame
     * against a target it has already captured — the capture itself was the
     * avoidable moment, so the payoff must not then be nullified by the
     * i-frames the capture state grants.
     */
    ignoreInvulnerability = false,
  ): HitResult {
    const out = this.hitOut;
    out.connected = false;
    out.blocked = false;
    out.parried = false;
    out.armored = false;
    out.evaded = false;
    out.damage = 0;
    out.comboIndex = 0;
    out.scaling = 1;
    out.position = overridePosition ?? defender.position;

    if (defender.defeated) return out;

    // --- Invulnerability -------------------------------------------------
    // A fighter held inside an ultimate cinematic is untouchable by anything
    // except that ultimate, so a stray projectile can't interrupt or steal it.
    if (
      !ignoreInvulnerability &&
      (defender.isInvulnerable || defender.state === FighterState.Cinematic)
    ) {
      out.evaded = true;
      this.events.emit('dodge', {
        source: defender.index,
        target: attacker.index,
        position: defender.position,
        tag: 'evade',
      });
      return out;
    }

    // --- Counter abilities (Rift Counter) --------------------------------
    if (defender.counterActive && !defender.counterTriggered) {
      defender.counterTriggered = true;
      const ctx = defender.index === 0 ? this.ctxA : this.ctxB;
      this.triggerCounter(defender, attacker, ctx);
      out.parried = true;
      return out;
    }

    // --- Guard / perfect guard -------------------------------------------
    const facingAttacker = this.isFacing(defender, attacker);
    if (defender.defense.guarding && facingAttacker && !defender.guard.broken) {
      if (defender.defense.inParryWindow) {
        // Perfect guard: no damage, no guard drain, attacker is punished.
        defender.defense.registerParry();
        defender.energy.gain(defender.data.defense.parryEnergyReward);
        attacker.combat.interrupt();
        attacker.hitstop = defender.data.defense.parryPunishFrames;
        attacker.defense.applyBlockstun(defender.data.defense.parryPunishFrames);
        defender.hitstop = Math.min(8, def.hitstop);
        out.parried = true;
        this.events.emit('parry', {
          source: defender.index,
          target: attacker.index,
          position: defender.position,
          magnitude: 0.55,
        });
        this.events.emit('cameraShake', { magnitude: 0.4 });
        return out;
      }

      // Normal block.
      const chip = def.chipDamage * damageMultiplier * attacker.damageMultiplier;
      this.tmp2.set(0, 0, 0);
      this.directionTo(attacker, defender, this.tmp2);
      this.tmp2.scale(def.knockbackForward * 0.35);
      const ctx = defender.index === 0 ? this.ctxA : this.ctxB;
      defender.receiveBlockedHit(
        chip,
        def.guardDamage,
        def.blockstun,
        Math.max(2, Math.round(def.hitstop * 0.6)),
        this.tmp2,
        ctx,
      );
      attacker.hitstop = Math.max(2, Math.round(def.hitstop * 0.6));
      attacker.energy.gain(def.energyOnHit * 0.35);
      this.damageDealt[attacker.index] += chip;
      out.blocked = true;
      out.connected = true;
      out.damage = chip;
      this.events.emit('block', {
        source: attacker.index,
        target: defender.index,
        position: out.position,
        magnitude: 0.25,
        tag: def.id,
      });
      return out;
    }

    // --- Super armor ------------------------------------------------------
    if (defender.combat.consumeArmorHit()) {
      const armorDamage =
        def.damage * damageMultiplier * attacker.damageMultiplier *
        defender.defenseMultiplier * 0.55;
      defender.health.apply(armorDamage);
      defender.ascension.onDamageTaken(armorDamage);
      defender.hitstop = Math.max(2, Math.round(def.hitstop * 0.5));
      attacker.hitstop = Math.max(3, Math.round(def.hitstop * 0.7));
      this.damageDealt[attacker.index] += armorDamage;
      out.armored = true;
      out.connected = true;
      out.damage = armorDamage;
      this.events.emit('hit', {
        source: attacker.index,
        target: defender.index,
        position: out.position,
        magnitude: 0.3,
        tag: 'armor',
      });
      if (defender.health.isDead) {
        const ctx = defender.index === 0 ? this.ctxA : this.ctxB;
        defender.receiveHit(0, ReactionType.Blowaway, new Vec3(), 0, 0, ctx);
      }
      return out;
    }

    // --- Clean hit --------------------------------------------------------
    const comboIndex = attacker.combo.hits + 1;
    const dScale = damageScaling(comboIndex);
    const hScale = hitstunScaling(comboIndex);

    let damage =
      def.damage *
      damageMultiplier *
      dScale *
      attacker.damageMultiplier *
      defender.defenseMultiplier;

    let hitstun = Math.max(6, Math.round(def.hitstun * hScale));
    let reaction = def.reaction;

    // Juggle decay: a launcher used deep in an air combo pops much lower.
    const launchScale = juggleLaunchScaling(defender.juggleHits);
    let kbUp = def.knockbackUp * launchScale;
    const kbFwd = def.knockbackForward;

    // Hard cap: force the defender out with invulnerability. This is the
    // structural guarantee that no infinite combo can exist.
    if (attacker.combo.atHardCap) {
      const ctx = defender.index === 0 ? this.ctxA : this.ctxB;
      defender.defense.grantInvulnerability(48);
      defender.reactionFrames = 0;
      defender.juggleHits = 0;
      defender.airRecoverUsed = false;
      defender.velocity.set(0, 6, 0);
      defender.movement.enterFlight(defender.velocity);
      attacker.combo.reset();
      this.events.emit('comboEscape', {
        source: defender.index,
        position: defender.position,
        tag: 'hardCap',
        magnitude: 0.7,
      });
      void ctx;
      return out;
    }

    // Knockback vector: away from the attacker, plus the attack's lift.
    this.directionTo(attacker, defender, this.tmp2);
    const kb = new Vec3(
      this.tmp2.x * kbFwd,
      kbUp,
      this.tmp2.z * kbFwd,
    );
    // A grounded victim hit by a non-launcher shouldn't pop into the air.
    if (defender.grounded && reaction === ReactionType.Flinch) kb.y = 0;
    // Airborne victims of a flinch get a small lift so juggles stay connected.
    if (!defender.grounded && reaction === ReactionType.Flinch && kb.y < 1) {
      kb.y = 1.4 * launchScale;
    }

    const applied = damage;
    const ctx = defender.index === 0 ? this.ctxA : this.ctxB;
    defender.receiveHit(applied, reaction, kb, hitstun, def.hitstop, ctx);

    attacker.hitstop = def.hitstop;
    attacker.energy.gain(def.energyOnHit);
    attacker.ascension.onDamageDealt(applied);
    this.damageDealt[attacker.index] += applied;
    const n = attacker.combo.registerHit(applied, !defender.grounded);

    out.connected = true;
    out.damage = applied;
    out.comboIndex = n;
    out.scaling = dScale;

    this.events.emit('hit', {
      source: attacker.index,
      target: defender.index,
      position: out.position,
      direction: this.tmp2,
      magnitude: def.shake,
      tag: def.fx,
      value: n,
    });
    this.events.emit('cameraShake', { magnitude: def.shake });
    void reaction;
    void hitstun;
    void kbUp;
    return out;
  }

  private triggerCounter(counterer: Fighter, victim: Fighter, ctx: FighterTickContext): void {
    const ab = counterer.activeAbility;
    const strike = ab?.strike;
    this.events.emit('parry', {
      source: counterer.index,
      target: victim.index,
      position: counterer.position,
      magnitude: 0.7,
      tag: 'counter',
    });
    counterer.defense.grantInvulnerability(20);
    counterer.hitstop = 8;
    victim.hitstop = 10;
    victim.combat.interrupt();
    if (!strike) return;
    // The counter's punish is applied through the normal funnel so it obeys
    // scaling, i-frames and armor like any other hit.
    this.applyHit(counterer, victim, strike, 1);
    void ctx;
  }

  private isFacing(defender: Fighter, attacker: Fighter): boolean {
    defender.forward(this.tmp);
    const dx = attacker.position.x - defender.position.x;
    const dz = attacker.position.z - defender.position.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    const dot = (this.tmp.x * dx + this.tmp.z * dz) / len;
    // Guarding covers a generous 200-degree frontal cone. Cross-ups exist but
    // aren't a coin flip.
    return dot > -0.17;
  }

  private directionTo(from: Fighter, to: Fighter, out: Vec3): Vec3 {
    const dx = to.position.x - from.position.x;
    const dz = to.position.z - from.position.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) {
      from.forward(out);
      return out;
    }
    return out.set(dx / len, 0, dz / len);
  }

  // =====================================================================
  // Ability effects
  // =====================================================================

  private resolveAbilityEffects(): void {
    for (const attacker of this.fighters) {
      const ab = attacker.activeAbility;
      if (!ab) continue;
      // Resolve each ability frame exactly once.
      //
      // The ability clock only advances inside Fighter.tick, which returns
      // early during hitstop. Any frame on which it fails to advance would
      // otherwise re-run that frame's effects — and because an ultimate's
      // payoff applies hitstop to its own caster, that is a closed loop that
      // hangs the match permanently. Keying on the frame number rather than on
      // hitstop makes this correct regardless of what froze the clock.
      if (attacker.abilityFrame === attacker.lastResolvedAbilityFrame) continue;
      attacker.lastResolvedAbilityFrame = attacker.abilityFrame;
      const defender = attacker.index === 0 ? this.fighters[1] : this.fighters[0];
      const ctx = attacker.index === 0 ? this.ctxA : this.ctxB;
      const f = attacker.abilityFrame;

      switch (ab.kind) {
        case AbilityKind.Projectile:
        case AbilityKind.Barrage:
          this.tickProjectileAbility(attacker, ab, f);
          break;
        case AbilityKind.Strike:
        case AbilityKind.Rush:
          this.tickStrikeAbility(attacker, defender, ab, f);
          break;
        case AbilityKind.AreaBlast:
          this.tickBlastAbility(attacker, defender, ab, f);
          break;
        case AbilityKind.Ultimate:
          this.tickUltimateAbility(attacker, defender, ab, f, ctx);
          break;
        case AbilityKind.Counter:
        default:
          break;
      }
    }
  }

  private tickProjectileAbility(attacker: Fighter, ab: AbilityDef, f: number): void {
    const p = ab.projectile;
    if (!p) return;
    if (f < ab.startup) return;
    const since = f - ab.startup;
    if (since % Math.max(1, p.interval) !== 0) return;
    if (attacker.abilityShotsFired >= p.count) return;
    const shotIndex = attacker.abilityShotsFired;
    attacker.abilityShotsFired++;
    this.spawnProjectile(attacker, p, shotIndex, ab.id);
  }

  private spawnProjectile(
    owner: Fighter,
    params: NonNullable<AbilityDef['projectile']>,
    shotIndex: number,
    tag: string,
  ): void {
    const pr = this.projectiles.spawn();
    pr.ownerIndex = owner.index;
    pr.params = params;

    owner.forward(this.tmp);
    pr.position.set(
      owner.position.x + this.tmp.x * 1.1,
      owner.position.y + owner.data.visual.height * 0.62,
      owner.position.z + this.tmp.z * 1.1,
    );

    // Aim: at the lock-on target's centre of mass when locked on, else forward.
    const target = this.fighters[owner.index === 0 ? 1 : 0];
    if (owner.lockOnEnabled && target && !target.defeated) {
      this.tmp2.set(
        target.position.x - pr.position.x,
        target.position.y + target.data.visual.height * 0.5 - pr.position.y,
        target.position.z - pr.position.z,
      ).normalize();
    } else {
      this.tmp2.copy(this.tmp);
    }

    // Spread for multi-shot: alternate left/right so the fan reads clearly.
    if (params.spread > 0 && params.count > 1) {
      const half = (params.count - 1) / 2;
      const offset = ((shotIndex - half) / Math.max(1, half)) * params.spread;
      const c = Math.cos(offset);
      const s = Math.sin(offset);
      const nx = this.tmp2.x * c - this.tmp2.z * s;
      const nz = this.tmp2.x * s + this.tmp2.z * c;
      this.tmp2.x = nx;
      this.tmp2.z = nz;
    }
    if (params.arc !== 0) {
      this.tmp2.y += params.arc;
      this.tmp2.normalize();
    }

    pr.velocity.copy(this.tmp2).scale(params.speed);
    this.events.emit('projectileFired', {
      source: owner.index,
      position: pr.position,
      direction: this.tmp2,
      tag,
      value: params.color,
    });
  }

  private tickStrikeAbility(
    attacker: Fighter,
    defender: Fighter,
    ab: AbilityDef,
    f: number,
  ): void {
    const strike = ab.strike;
    if (!strike) return;
    if (f < ab.startup || f >= ab.startup + ab.active) return;
    if (attacker.combat.hasHit(defender.index)) return;
    if (!this.testAbilityHitbox(attacker, defender, strike)) return;
    attacker.combat.markConnected(defender.index);
    this.applyHit(attacker, defender, strike, 1);
    // A rush that connects stops advancing so the strike reads as an impact
    // rather than the attacker sliding through the target.
    if (ab.kind === AbilityKind.Rush) attacker.velocity.scale(0.12);
  }

  private testAbilityHitbox(
    attacker: Fighter,
    defender: Fighter,
    strike: AttackDef,
  ): boolean {
    const hb = strike.hitbox;
    attacker.forward(this.tmp);
    const cx = attacker.position.x + this.tmp.x * hb.reach;
    const cy = attacker.position.y + hb.height;
    const cz = attacker.position.z + this.tmp.z * hb.reach;
    const dh = defender.data.visual.height;
    const dy = clamp(cy, defender.position.y, defender.position.y + dh);
    const dx = defender.position.x - cx;
    const dz = defender.position.z - cz;
    const ddy = dy - cy;
    const reach = hb.radius + defender.data.visual.radius;
    return dx * dx + ddy * ddy + dz * dz <= reach * reach;
  }

  private tickBlastAbility(
    attacker: Fighter,
    defender: Fighter,
    ab: AbilityDef,
    f: number,
  ): void {
    if (f !== ab.startup) return;
    const strike = ab.strike;
    const radius = ab.blastRadius ?? 8;
    this.events.emit('explosion', {
      source: attacker.index,
      position: attacker.position,
      magnitude: radius,
      tag: ab.id,
      value: ab.projectile?.color ?? 0x8a5cff,
    });
    this.events.emit('cameraShake', { magnitude: ab.shake });
    if (!strike) return;
    const d = attacker.position.distanceTo(defender.position);
    if (d > radius + defender.data.visual.radius) return;
    // Falloff: full damage at the centre, 45% at the rim.
    const falloff = clamp(1 - (d / (radius + 0.001)) * 0.55, 0.45, 1);
    this.applyHit(attacker, defender, strike, falloff);
  }

  // =====================================================================
  // Ultimates
  //
  // Structure (frames are relative to activation):
  //   0 .. captureFrame          windup — caster invulnerable, camera closes in
  //   captureFrame               capture test: is the target in range and not
  //                              invulnerable? The window before this is the
  //                              opponent's chance to escape, which is what
  //                              keeps the brief's "no unavoidable ultimate"
  //                              requirement true.
  //   capture .. payoffFrame     cinematic; captured targets are held
  //   payoffFrame                damage burst
  //   payoff .. end              recovery
  // =====================================================================

  private ultimateCaptured = [false, false];

  private tickUltimateAbility(
    attacker: Fighter,
    defender: Fighter,
    ab: AbilityDef,
    f: number,
    ctx: FighterTickContext,
  ): void {
    const total = ab.cinematicFrames ?? 150;
    const captureFrame = Math.round(total * 0.28);
    const payoffFrame = Math.round(total * 0.66);

    if (f === 1) {
      this.cinematicOwner = attacker.index;
      this.cinematicFrames = total;
      this.ultimateCaptured[attacker.index] = false;
      // The caster is invulnerable through the windup: an ultimate that can be
      // stuffed by a jab would never be worth its cost.
      attacker.defense.grantInvulnerability(payoffFrame + 6);
    }

    if (f === captureFrame) {
      const range = ab.captureRange ?? 14;
      const d = attacker.position.distanceTo(defender.position);
      const captured = d <= range && !defender.isInvulnerable && !defender.defeated;
      this.ultimateCaptured[attacker.index] = captured;
      this.events.emit('ultimateImpact', {
        source: attacker.index,
        target: defender.index,
        position: defender.position,
        tag: captured ? 'captured' : 'whiffed',
        value: captured ? 1 : 0,
      });
      if (captured) {
        // Held in place for the cinematic — but this only happens if they
        // failed to escape the windup.
        defender.velocity.set(0, 0, 0);
        defender.combat.interrupt();
        defender.activeAbility = null;
        defender.state = FighterState.Cinematic;
        defender.reactionFrames = payoffFrame - captureFrame + 8;
      }
    }

    if (f > captureFrame && f < payoffFrame && this.ultimateCaptured[attacker.index]) {
      // Hold the target near the caster through the sequence.
      defender.velocity.set(0, 0, 0);
      defender.state = FighterState.Cinematic;
      if (f % 8 === 0 && ab.projectile) {
        // Cosmetic only — the ultimate's damage is delivered once, at the
        // payoff frame. Letting these motes deal damage turned every ultimate
        // into a 22-hit combo that ran straight into the anti-infinite cap.
        this.spawnProjectile(
          attacker,
          { ...ab.projectile, count: 1, cosmetic: true },
          0,
          ab.id,
        );
      }
    }

    if (f === payoffFrame) {
      const strike = ab.strike;
      const captured = this.ultimateCaptured[attacker.index];
      this.globalHitstop = 18;
      this.events.emit('cameraShake', { magnitude: 1 });
      this.events.emit('explosion', {
        source: attacker.index,
        position: captured ? defender.position : attacker.position,
        magnitude: 22,
        tag: ab.id,
        value: ab.projectile?.color ?? 0xffffff,
      });
      if (strike) {
        if (captured) {
          defender.state = FighterState.Launched;
          defender.reactionFrames = 0;
          defender.defense.invulnFrames = 0;
          this.applyHit(attacker, defender, strike, 1, undefined, true);
        } else {
          // A whiffed ultimate still detonates, but only as a weak AoE. Missing
          // it must be a real, felt loss.
          const d = attacker.position.distanceTo(defender.position);
          if (d < 16) this.applyHit(attacker, defender, strike, 0.28);
        }
      }
    }

    if (f >= total - 1) {
      this.cinematicOwner = -1;
      this.cinematicFrames = 0;
      if (defender.state === FighterState.Cinematic) {
        defender.state = defender.grounded ? FighterState.Idle : FighterState.Fall;
        defender.reactionFrames = 0;
      }
    }
    void ctx;
  }

  // =====================================================================
  // Projectiles
  // =====================================================================

  private tickProjectiles(): void {
    const dt = TICK_DT;
    for (const pr of this.projectiles.items) {
      if (!pr.active) continue;
      pr.age++;
      const p = pr.params;
      const owner = this.fighters[pr.ownerIndex];
      const target = this.fighters[pr.ownerIndex === 0 ? 1 : 0];

      // Homing.
      if (p.homingStrength > 0 && target && !target.defeated) {
        this.tmp.set(
          target.position.x - pr.position.x,
          target.position.y + target.data.visual.height * 0.5 - pr.position.y,
          target.position.z - pr.position.z,
        ).normalize();
        const speed = pr.velocity.length || p.speed;
        Vec3.lerp(
          pr.velocity.clone().normalize(),
          this.tmp,
          clamp(p.homingStrength * dt * 6, 0, 1),
          this.tmp2,
        );
        pr.velocity.copy(this.tmp2.normalize()).scale(speed);
      }

      const step = pr.velocity.length * dt;
      pr.position.addScaled(pr.velocity, dt);
      pr.travelled += step;

      // Collision with the opposing fighter. Cosmetic motes never collide.
      if (!p.cosmetic && target && !target.defeated && !pr.hitTargets.has(target.index)) {
        const dh = target.data.visual.height;
        const cy = clamp(pr.position.y, target.position.y, target.position.y + dh);
        const dx = target.position.x - pr.position.x;
        const dz = target.position.z - pr.position.z;
        const dy = cy - pr.position.y;
        const r = p.radius + target.data.visual.radius;
        if (dx * dx + dy * dy + dz * dz <= r * r) {
          pr.hitTargets.add(target.index);
          this.applyProjectileHit(owner, target, pr);
          if (!p.pierce) {
            this.detonate(pr, owner, target);
            continue;
          }
        }
      }

      // Expiry: range, arena bounds or ground.
      const outOfBounds =
        Math.hypot(pr.position.x, pr.position.z) > this.arena.def.hardRadius + 3 ||
        pr.position.y < this.arena.def.floor ||
        pr.position.y > this.arena.def.ceiling + 6;
      if (pr.travelled >= p.range || outOfBounds) {
        this.detonate(pr, owner, target);
      }
    }
  }

  private applyProjectileHit(owner: Fighter, target: Fighter, pr: Projectile): void {
    const p = pr.params;
    // Projectiles reuse the melee AttackDef shape so they pass through exactly
    // the same block / parry / armor / scaling funnel.
    const asAttack: AttackDef = {
      id: p.fx,
      name: p.fx,
      kind: 'Ability' as AttackDef['kind'],
      startup: 0,
      active: 1,
      recovery: 0,
      hitbox: { reach: 0, radius: p.radius, height: 1, arc: Math.PI },
      damage: p.damage,
      chipDamage: p.chipDamage,
      guardDamage: p.guardDamage,
      hitstun: p.hitstun,
      blockstun: p.blockstun,
      hitstop: p.hitstop,
      reaction:
        p.knockbackUp > 3
          ? ReactionType.Launch
          : p.knockbackForward > 9
            ? ReactionType.Blowaway
            : ReactionType.Knockback,
      knockbackForward: p.knockbackForward,
      knockbackUp: p.knockbackUp,
      advance: 0,
      energyOnHit: 12,
      energyOnTakeHit: 8,
      energyCost: 0,
      cancelFrom: 0,
      cancelInto: [],
      armor: 0,
      airOk: true,
      groundOk: true,
      homing: false,
      homingRange: 0,
      shake: 0.22,
      fx: p.fx,
      sfx: p.fx,
    };
    this.applyHit(owner, target, asAttack, 1, pr.position);
  }

  private detonate(pr: Projectile, owner: Fighter, target: Fighter): void {
    const p = pr.params;
    if (p.splashRadius > 0) {
      this.events.emit('explosion', {
        source: pr.ownerIndex,
        position: pr.position,
        magnitude: p.splashRadius,
        tag: p.fx,
        value: p.color,
      });
      if (target && !target.defeated && !pr.hitTargets.has(target.index)) {
        const d = pr.position.distanceTo(target.position);
        if (d <= p.splashRadius + target.data.visual.radius) {
          pr.hitTargets.add(target.index);
          this.applyProjectileHit(owner, target, pr);
        }
      }
    } else {
      this.events.emit('projectileImpact', {
        source: pr.ownerIndex,
        position: pr.position,
        tag: p.fx,
        value: p.color,
      });
    }
    pr.reset();
  }

  private tickCinematic(): void {
    if (this.cinematicFrames > 0) this.cinematicFrames--;
    if (this.cinematicFrames === 0 && this.cinematicOwner >= 0) {
      const owner = this.fighters[this.cinematicOwner];
      if (!owner.activeAbility) this.cinematicOwner = -1;
    }
  }

  // =====================================================================
  // Diagnostics
  // =====================================================================

  snapshot(): Record<string, unknown> {
    return {
      phase: this.phase,
      frame: this.frame,
      timer: Math.ceil(this.timerFrames / 60),
      projectiles: this.projectiles.activeCount,
      cinematic: this.cinematicOwner,
      fighters: this.fighters.map((f) => f.snapshot()),
      result: this.result,
    };
  }
}

export { InterruptPolicy };
