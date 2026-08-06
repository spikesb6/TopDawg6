/**
 * Procedural fighter rig.
 *
 * There are no animation assets in this slice, so every pose is generated from
 * simulation state: attack phase, velocity, grounded-ness, hitstun, guard.
 * That has a real advantage for a fighting game — the pose is guaranteed to
 * agree with the frame data, so what the player sees is exactly what the
 * hitboxes are doing. It is also why hits read clearly without a single
 * imported clip.
 *
 * The silhouettes are built to be distinguishable at a glance and in shadow:
 * Kairo is narrow-shouldered with a tall spiked crest, Veyron is a broad
 * armoured wedge with horns. Neither derives from any existing character.
 */

import * as THREE from 'three';
import type { Fighter } from '../gameplay/Fighter';
import { FighterState } from '../gameplay/CombatTypes';
import { AttackPhase } from '../gameplay/CombatComponent';
import { clamp, damp, lerp } from '../core/Vec3';

interface Limb {
  root: THREE.Group;
  upper: THREE.Mesh;
  lower: THREE.Mesh;
}

export class FighterRig {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly torso: THREE.Mesh;
  private readonly hips: THREE.Mesh;
  private readonly head: THREE.Group;
  private readonly armL: Limb;
  private readonly armR: Limb;
  private readonly legL: Limb;
  private readonly legR: Limb;

  /** Aura shell that scales and brightens with energy / transformation. */
  private readonly aura: THREE.Mesh;
  private readonly auraMat: THREE.MeshBasicMaterial;
  /** Ground shadow blob — cheap, and vital for reading altitude. */
  private readonly shadow: THREE.Mesh;
  /** Energy trail ribbons that appear during boost and pursuit. */
  private readonly trail: THREE.Mesh;
  private readonly trailMat: THREE.MeshBasicMaterial;

  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private readonly energyMats: THREE.MeshBasicMaterial[] = [];

  private phase = 0;
  private smoothedLean = 0;
  private flinch = 0;

  constructor(private readonly fighter: Fighter) {
    const v = fighter.data.visual;
    const heavy = v.build === 'heavy';
    const scale = v.height / 1.82;

    const skin = new THREE.MeshStandardMaterial({
      color: v.primaryColor,
      roughness: heavy ? 0.42 : 0.62,
      metalness: heavy ? 0.72 : 0.18,
      emissive: new THREE.Color(v.rimColor).multiplyScalar(0.06),
    });
    const trim = new THREE.MeshStandardMaterial({
      color: v.secondaryColor,
      roughness: 0.35,
      metalness: 0.8,
      emissive: new THREE.Color(v.secondaryColor).multiplyScalar(0.18),
    });
    const glow = new THREE.MeshBasicMaterial({
      color: v.energyColor,
      transparent: true,
      opacity: 0.95,
    });
    this.materials.push(skin, trim);
    this.energyMats.push(glow);

    const shoulderW = heavy ? 0.62 : 0.44;
    const torsoH = heavy ? 0.72 : 0.66;

    // --- Torso -----------------------------------------------------------
    this.torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(shoulderW * 0.62, torsoH, 4, 10),
      skin,
    );
    this.torso.position.y = 1.16 * scale;
    this.torso.castShadow = true;

    // Chest plate / sash — the strongest silhouette read at distance.
    const chest = new THREE.Mesh(
      heavy
        ? new THREE.BoxGeometry(shoulderW * 1.9, 0.52, 0.46)
        : new THREE.BoxGeometry(shoulderW * 1.25, 0.42, 0.3),
      trim,
    );
    chest.position.y = 0.16;
    chest.castShadow = true;
    this.torso.add(chest);

    // Energy core: a visible tell for the character's power state.
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), glow);
    core.position.set(0, 0.18, heavy ? 0.26 : 0.18);
    this.torso.add(core);

    this.hips = new THREE.Mesh(
      new THREE.CapsuleGeometry(shoulderW * 0.5, 0.24, 4, 8),
      skin,
    );
    this.hips.position.y = 0.78 * scale;
    this.hips.castShadow = true;

    // --- Head ------------------------------------------------------------
    this.head = new THREE.Group();
    this.head.position.y = 1.66 * scale;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), skin);
    skull.scale.set(1, 1.12, 1.02);
    skull.castShadow = true;
    this.head.add(skull);

    if (heavy) {
      // Veyron: a helm with swept horns.
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), trim);
      helm.scale.set(1.02, 0.78, 1.04);
      helm.position.y = 0.06;
      this.head.add(helm);
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.52, 7), trim);
        horn.position.set(side * 0.16, 0.16, -0.02);
        horn.rotation.set(-0.5, 0, side * 0.42);
        this.head.add(horn);
      }
      // Visor slit.
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.045, 0.05), glow);
      visor.position.set(0, 0.02, 0.19);
      this.head.add(visor);
    } else {
      // Kairo: a tall swept crest. Angular, not rounded — reads as motion.
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.055 - t * 0.02, 0.34 + Math.sin(t * Math.PI) * 0.26, 5),
          i % 2 === 0 ? skin : trim,
        );
        const a = -0.9 + t * 1.8;
        spike.position.set(Math.sin(a) * 0.15, 0.19 + Math.cos(a) * 0.05, -0.09 - t * 0.02);
        spike.rotation.set(-0.75, a * 0.5, a * 0.55);
        this.head.add(spike);
      }
      const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.04), glow);
      eyes.position.set(0, 0.02, 0.18);
      this.head.add(eyes);
    }

    // --- Limbs -----------------------------------------------------------
    const limbR = heavy ? 0.115 : 0.082;
    this.armL = this.makeLimb(skin, trim, limbR, 0.42, 0.4, scale);
    this.armR = this.makeLimb(skin, trim, limbR, 0.42, 0.4, scale);
    this.armL.root.position.set(-shoulderW, 1.42 * scale, 0);
    this.armR.root.position.set(shoulderW, 1.42 * scale, 0);

    this.legL = this.makeLimb(skin, trim, limbR * 1.15, 0.44, 0.44, scale);
    this.legR = this.makeLimb(skin, trim, limbR * 1.15, 0.44, 0.44, scale);
    this.legL.root.position.set(-shoulderW * 0.46, 0.8 * scale, 0);
    this.legR.root.position.set(shoulderW * 0.46, 0.8 * scale, 0);

    this.body.add(
      this.torso,
      this.hips,
      this.head,
      this.armL.root,
      this.armR.root,
      this.legL.root,
      this.legR.root,
    );
    this.body.scale.setScalar(scale);
    this.group.add(this.body);

    // --- Aura ------------------------------------------------------------
    this.auraMat = new THREE.MeshBasicMaterial({
      color: v.energyColor,
      transparent: true,
      opacity: 0.0,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.aura = new THREE.Mesh(
      new THREE.CapsuleGeometry(v.radius * 1.5, v.height * 0.62, 6, 14),
      this.auraMat,
    );
    this.aura.position.y = v.height * 0.52;
    this.group.add(this.aura);

    // --- Trail -----------------------------------------------------------
    this.trailMat = new THREE.MeshBasicMaterial({
      color: v.energyColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.trail = new THREE.Mesh(new THREE.ConeGeometry(v.radius * 1.25, 5.5, 8, 1, true), this.trailMat);
    this.trail.rotation.x = -Math.PI / 2;
    this.trail.position.set(0, v.height * 0.5, -2.6);
    this.group.add(this.trail);

    // --- Shadow ----------------------------------------------------------
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(v.radius * 1.9, 20),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
  }

  /** The blob shadow lives in world space, not under the fighter's transform. */
  get shadowMesh(): THREE.Mesh {
    return this.shadow;
  }

  private makeLimb(
    skin: THREE.Material,
    trim: THREE.Material,
    radius: number,
    upperLen: number,
    lowerLen: number,
    scale: number,
  ): Limb {
    const root = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(radius, upperLen, 3, 8), skin);
    upper.position.y = -upperLen * 0.5;
    upper.castShadow = true;
    const elbow = new THREE.Group();
    elbow.position.y = -upperLen;
    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius * 0.86, lowerLen, 3, 8),
      trim,
    );
    lower.position.y = -lowerLen * 0.5;
    lower.castShadow = true;
    elbow.add(lower);
    root.add(upper, elbow);
    void scale;
    return { root, upper, lower };
  }

  /** Advances the procedural pose. Called once per rendered frame. */
  update(dt: number, elapsed: number): void {
    const f = this.fighter;
    const v = f.data.visual;

    this.group.position.set(f.position.x, f.position.y, f.position.z);
    this.group.rotation.y = f.yaw;
    this.group.visible = true;

    // Hitstop freezes the pose entirely — that is what sells the impact.
    const frozen = f.hitstop > 0;
    if (!frozen) this.phase += dt;

    const speed = f.velocity.lengthXZ;
    const moving = speed > 0.6;
    const airborne = !f.grounded;

    // Flinch impulse on taking a hit, decayed over time.
    if (f.state === FighterState.Hitstun && f.stateFrames <= 1) this.flinch = 1;
    this.flinch = damp(this.flinch, 0, 7, dt);

    // Forward lean scales with speed — the single cheapest way to make fast
    // movement read as fast.
    const targetLean = clamp(speed / 26, 0, 1) * (airborne ? 0.85 : 0.55);
    this.smoothedLean = damp(this.smoothedLean, targetLean, 9, dt);

    let torsoPitch = this.smoothedLean;
    let torsoTwist = 0;
    let armLPitch = 0.1;
    let armRPitch = 0.1;
    let armLYaw = 0.18;
    let armRYaw = -0.18;
    let elbowL = 0.35;
    let elbowR = 0.35;
    let legLPitch = 0;
    let legRPitch = 0;
    let kneeL = 0.1;
    let kneeR = 0.1;
    let bodyY = 0;

    const st = f.state;

    if (st === FighterState.Attack && f.combat.current) {
      // Attacks are posed directly from frame data, so the visual and the
      // hitbox can never disagree.
      const ph = f.combat.phase;
      const a = f.combat.current;
      const total = a.startup + a.active + a.recovery;
      const t = clamp(f.combat.frame / Math.max(1, total), 0, 1);
      const isKick = a.id.includes('kick') || a.id.includes('sweep') || a.id.includes('heel');
      const windup = ph === AttackPhase.Startup ? 1 : 0;
      const strike = ph === AttackPhase.Active ? 1 : 0;
      const recover = ph === AttackPhase.Recovery ? 1 - t : 0;

      torsoTwist = (windup ? -0.55 : strike ? 0.7 : 0.28) * (1 - recover * 0.4);
      torsoPitch += strike ? 0.28 : windup ? -0.16 : 0.1;

      if (isKick) {
        legRPitch = windup ? -0.7 : strike ? -2.1 : -0.8;
        kneeR = windup ? 1.3 : strike ? 0.15 : 0.8;
        armLPitch = -0.7;
        armRPitch = 0.5;
      } else {
        armRPitch = windup ? 1.1 : strike ? -2.05 : -0.9;
        elbowR = windup ? 1.6 : strike ? 0.06 : 0.7;
        armLPitch = windup ? -0.5 : 0.5;
        elbowL = 0.9;
      }
      bodyY = strike ? -0.06 : 0.02;
    } else if (st === FighterState.Charging) {
      // Charge stance: braced, arms drawn back, whole body trembling.
      const shake = f.combat.charging ? f.combat.chargeRatio : 0.4;
      const tremor = Math.sin(this.phase * 46) * 0.03 * shake;
      torsoPitch = 0.34 + tremor;
      armLPitch = 1.15;
      armRPitch = 1.15;
      armLYaw = 0.5;
      armRYaw = -0.5;
      elbowL = 1.5;
      elbowR = 1.5;
      kneeL = 0.55;
      kneeR = 0.55;
      bodyY = -0.14 + tremor;
    } else if (st === FighterState.Guard || st === FighterState.GuardStun) {
      torsoPitch = 0.2;
      armLPitch = -1.15;
      armRPitch = -1.15;
      armLYaw = 0.62;
      armRYaw = -0.62;
      elbowL = 1.85;
      elbowR = 1.85;
      kneeL = 0.36;
      kneeR = 0.36;
      bodyY = -0.09;
      if (st === FighterState.GuardStun) {
        const k = Math.sin(this.phase * 40) * 0.05;
        torsoPitch += k;
      }
    } else if (st === FighterState.GuardBreak) {
      torsoPitch = -0.55;
      armLPitch = -1.9;
      armRPitch = -1.9;
      armLYaw = 1.0;
      armRYaw = -1.0;
      kneeL = 0.9;
      kneeR = 0.9;
      bodyY = -0.22;
    } else if (st === FighterState.Dodge) {
      const t = 1 - f.defense.dodgeFrames / Math.max(1, f.data.defense.dodgeFrames);
      torsoPitch = 0.9 - t * 0.5;
      torsoTwist = Math.sin(t * Math.PI) * 1.3;
      kneeL = 1.5;
      kneeR = 1.2;
      armLPitch = -1.2;
      armRPitch = 1.2;
      bodyY = -0.2 + Math.sin(t * Math.PI) * 0.25;
    } else if (st === FighterState.Hitstun || st === FighterState.Launched) {
      const k = st === FighterState.Launched ? 1 : 0.55;
      torsoPitch = -0.85 * k - this.flinch * 0.4;
      armLPitch = -1.5 * k;
      armRPitch = -1.7 * k;
      armLYaw = 0.9;
      armRYaw = -0.9;
      legLPitch = 0.7 * k;
      legRPitch = 0.4 * k;
      kneeL = 0.5;
      kneeR = 0.8;
      // Launched fighters tumble.
      if (st === FighterState.Launched) this.body.rotation.z = Math.sin(this.phase * 5.5) * 0.5;
      bodyY = -0.05;
    } else if (st === FighterState.Downed) {
      torsoPitch = -1.45;
      bodyY = -0.62;
      legLPitch = 1.3;
      legRPitch = 1.1;
      armLPitch = -1.2;
      armRPitch = -1.2;
    } else if (st === FighterState.Transform) {
      // Transformation: arms flung down, head back, body arched — a power pose
      // that reads instantly as "something is happening".
      const t = 1 - f.transformFrames / Math.max(1, f.transformation.frames);
      const surge = Math.sin(t * Math.PI);
      torsoPitch = -0.5 - surge * 0.35;
      armLPitch = 0.9 + surge * 0.5;
      armRPitch = 0.9 + surge * 0.5;
      armLYaw = 0.45 + surge * 0.3;
      armRYaw = -0.45 - surge * 0.3;
      elbowL = 0.5;
      elbowR = 0.5;
      kneeL = 0.5 + surge * 0.3;
      kneeR = 0.5 + surge * 0.3;
      bodyY = surge * 0.35;
      this.head.rotation.x = -0.55 * surge;
    } else if (st === FighterState.Cinematic) {
      torsoPitch = -0.25;
      armLPitch = 0.7;
      armRPitch = -1.4;
      elbowR = 0.3;
      bodyY = 0.05;
    } else if (st === FighterState.Defeated) {
      torsoPitch = -1.5;
      bodyY = -0.66;
      legLPitch = 1.4;
      legRPitch = 1.2;
      armLPitch = -1.0;
      armRPitch = -1.4;
    } else if (airborne) {
      const rising = f.velocity.y > 0;
      const flying = f.movement.flying;
      if (flying) {
        // Flight: a poised hover, arms trailing, legs together.
        torsoPitch = 0.18 + this.smoothedLean * 0.7;
        armLPitch = -0.35;
        armRPitch = -0.35;
        armLYaw = 0.42;
        armRYaw = -0.42;
        legLPitch = -0.22;
        legRPitch = -0.14;
        kneeL = 0.28;
        kneeR = 0.18;
        bodyY = Math.sin(this.phase * 2.1) * 0.05;
      } else {
        torsoPitch = rising ? -0.12 : 0.24;
        legLPitch = rising ? -0.5 : 0.35;
        legRPitch = rising ? -0.15 : 0.12;
        kneeL = rising ? 1.15 : 0.42;
        kneeR = 0.5;
        armLPitch = rising ? -1.1 : -0.6;
        armRPitch = rising ? -0.9 : -0.4;
      }
    } else if (moving) {
      // Run cycle. Stride frequency scales with speed so sprint reads faster.
      const freq = clamp(speed * 0.9, 4, 17);
      const s = Math.sin(this.phase * freq);
      const c = Math.cos(this.phase * freq);
      legLPitch = s * 0.72;
      legRPitch = -s * 0.72;
      kneeL = clamp(0.28 + s * 0.55, 0.05, 1.3);
      kneeR = clamp(0.28 - s * 0.55, 0.05, 1.3);
      armLPitch = -s * 0.62;
      armRPitch = s * 0.62;
      elbowL = 0.55;
      elbowR = 0.55;
      bodyY = Math.abs(c) * 0.055;
      torsoTwist = s * 0.16;
    } else {
      // Idle: a slow breathing bob and a fighting guard.
      const b = Math.sin(this.phase * 1.9);
      bodyY = b * 0.026;
      torsoPitch = 0.08 + b * 0.02;
      armLPitch = -0.42 + b * 0.05;
      armRPitch = -0.52 - b * 0.05;
      armLYaw = 0.36;
      armRYaw = -0.3;
      elbowL = 1.15;
      elbowR = 1.3;
      kneeL = 0.16;
      kneeR = 0.16;
    }

    // Reset tumble when not launched.
    if (st !== FighterState.Launched) {
      this.body.rotation.z = damp(this.body.rotation.z, 0, 10, dt);
    }
    if (st !== FighterState.Transform) {
      this.head.rotation.x = damp(this.head.rotation.x, 0, 8, dt);
    }

    // --- Commit the pose with smoothing so transitions never pop ----------
    const r = frozen ? 60 : 17;
    this.body.position.y = damp(this.body.position.y, bodyY, r, dt);
    this.torso.rotation.x = damp(this.torso.rotation.x, torsoPitch, r, dt);
    this.torso.rotation.y = damp(this.torso.rotation.y, torsoTwist, r, dt);
    this.hips.rotation.x = damp(this.hips.rotation.x, torsoPitch * 0.35, r, dt);

    this.poseLimb(this.armL, armLPitch, armLYaw, elbowL, r, dt);
    this.poseLimb(this.armR, armRPitch, armRYaw, elbowR, r, dt);
    this.poseLimb(this.legL, legLPitch, 0, kneeL, r, dt);
    this.poseLimb(this.legR, legRPitch, 0, kneeR, r, dt);

    // --- Aura -------------------------------------------------------------
    const charging = st === FighterState.Charging;
    const transformed = f.transformed;
    const energyRatio = f.energy.fraction;
    let auraTarget = 0.06 + energyRatio * 0.1;
    if (charging) auraTarget = 0.55 + Math.sin(elapsed * 22) * 0.12;
    if (transformed) auraTarget = 0.42 + Math.sin(elapsed * 9) * 0.1;
    if (st === FighterState.Transform) auraTarget = 0.95;
    if (st === FighterState.Cinematic) auraTarget = 0.7;
    this.auraMat.opacity = damp(this.auraMat.opacity, auraTarget, 9, dt);

    const auraColor = transformed ? f.transformation.auraColor : v.energyColor;
    this.auraMat.color.lerp(new THREE.Color(auraColor), clamp(dt * 6, 0, 1));

    const pulse = 1 + Math.sin(elapsed * (charging ? 20 : 6)) * (charging ? 0.1 : 0.03);
    const auraScale = (transformed ? 1.24 : 1) * pulse * (charging ? 1.2 : 1);
    this.aura.scale.setScalar(damp(this.aura.scale.x, auraScale, 8, dt));

    // Body materials brighten while transformed so the state is unmissable.
    for (const m of this.materials) {
      const targetE = transformed ? 0.42 : 0.06;
      m.emissiveIntensity = damp(m.emissiveIntensity ?? 1, 1, 6, dt);
      m.emissive.lerp(
        new THREE.Color(transformed ? f.transformation.accentColor : v.rimColor).multiplyScalar(
          targetE,
        ),
        clamp(dt * 5, 0, 1),
      );
    }
    for (const m of this.energyMats) {
      m.color.lerp(new THREE.Color(auraColor), clamp(dt * 6, 0, 1));
    }

    // --- Speed trail -------------------------------------------------------
    const fast =
      st === FighterState.Boost ||
      st === FighterState.Pursuit ||
      st === FighterState.Dash ||
      speed > 20;
    this.trailMat.opacity = damp(this.trailMat.opacity, fast ? 0.3 : 0, 12, dt);
    this.trail.visible = this.trailMat.opacity > 0.01;
    this.trailMat.color.set(auraColor);

    // --- Shadow ------------------------------------------------------------
    this.shadow.position.set(f.position.x, 0.03, f.position.z);
    const alt = clamp(f.position.y / 22, 0, 1);
    const sh = this.shadow.material as THREE.MeshBasicMaterial;
    sh.opacity = 0.5 * (1 - alt) * (1 - alt);
    const sc = lerp(1, 2.3, alt);
    this.shadow.scale.setScalar(sc);
    this.shadow.visible = !f.defeated || f.stateFrames < 240;
  }

  private poseLimb(
    limb: Limb,
    pitch: number,
    yaw: number,
    bend: number,
    rate: number,
    dt: number,
  ): void {
    limb.root.rotation.x = damp(limb.root.rotation.x, pitch, rate, dt);
    limb.root.rotation.z = damp(limb.root.rotation.z, yaw, rate, dt);
    const elbow = limb.root.children[1] as THREE.Group;
    elbow.rotation.x = damp(elbow.rotation.x, bend, rate, dt);
  }

  dispose(): void {
    this.group.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.auraMat.dispose();
    this.trailMat.dispose();
  }
}
