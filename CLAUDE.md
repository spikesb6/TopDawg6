# KAIRO: ASCENSION — Project Guide

An original 3D anime arena fighter. Vertical slice: **Kairo vs Lord Veyron** in
**The Ruins of Veyra**.

---

## Current milestone

**M9 — Presentation** complete; **M10 — Final Gauntlet** in progress.
See `docs/PROGRESS.md` for the live status and `docs/NEXT_ACTIONS.md` for the
next five priorities.

---

## Project constraints (read this first)

This project was specified for **Unreal Engine 5**. It is **not** built on UE5,
and that was a forced call, not a preference:

- The development container has **no Unreal Engine installed** and cannot host
  one — no GPU (`/dev/dri` absent), no display, 4 cores, ~30 GB free disk
  against UE5's ~200 GB source build.
- Every verification requirement in the brief (run the game, capture
  screenshots, automation tests, a ten-minute stability session, a packaged
  build, independent critique of gameplay footage) is **unreachable** on the UE5
  path here. The Gauntlet Loop would degrade into grading unexecuted code.

The slice is therefore built in **TypeScript + WebGL (three.js)**, which
compiles, runs, renders, and is testable and screenshot-able in this
environment. The architecture is deliberately **engine-shaped** so it ports:

| This project | Unreal equivalent |
| --- | --- |
| `Simulation` | `AGameStateBase` + authoritative tick |
| `Fighter` | `AFighterCharacter` (shared base) |
| `CharacterData` | `UPrimaryDataAsset` per fighter |
| `AttackDef` | `UDataTable` row struct |
| `AbilityDef` / `AbilitySystem` | `UGameplayAbility` / GAS |
| `Health` / `Energy` / `Guard` / `Ascension` | `UAttributeSet` |
| `MovementComponent` | `UCharacterMovementComponent` subclass |
| `EventBus` | Gameplay Cues / delegates |
| `VFXSystem` | Niagara systems |
| `FighterAI` | Behavior Tree + Blackboard |
| `CombatCamera` | `UCameraComponent` + camera modifiers |

Character behaviour lives entirely in data, so porting means re-authoring
`kairo.ts` / `veyron.ts` as data assets — not rewriting combat logic.

---

## Commands

All commands run from `game/`.

```bash
npm install            # once

npm run dev            # dev server with HMR      → http://localhost:5173
npm run build          # typecheck + production build → dist/
npm run preview        # serve the production build  → http://localhost:4173
npm run typecheck      # tsc --noEmit

npm test               # 59 acceptance tests (vitest, headless simulation)
npm run test:watch

# Headless simulation CLI — the Gauntlet Loop's RUN step
npm run sim -- match [diffA] [diffB] [seed]   # one AI-vs-AI match, full report
npm run sim -- balance [N]                    # N matches per difficulty tier
npm run sim -- probe                          # per-system diagnostic probes
npm run sim -- stability [minutes]            # the 10-minute stability run

# In-browser evidence capture (requires `npm run preview` running)
npm run evidence       # screenshots + report.json → progress/evidence/
```

---

## Directories

```
game/src/
  core/          Vec3, seeded RNG, Enhanced-Input-style actions, pooled EventBus
  gameplay/      Simulation, Fighter, components, frame data, arena, projectiles
  characters/    CharacterData schema + kairo.ts + veyron.ts (pure data)
  ai/            FighterAI (utility scoring) + difficulty profiles
  camera/        CombatCamera (lock-on, occlusion, cinematic, trauma shake)
  arena/         RuinsOfVeyra — procedural arena geometry and barrier shader
  render/        FighterRig — procedural posing driven by simulation state
  vfx/           Pooled particle/impact system, event-driven
  audio/         Fully synthesised WebAudio — zero sampled assets
  ui/            DOM HUD, menus, results
  headless/      Node match runner + CLI (no renderer, no DOM)
game/tests/      Acceptance tests
game/tools/      Playwright evidence capture
docs/            Vision, architecture, acceptance tests, rubric, decisions…
progress/        index.html dashboard + captured evidence
```

---

## Architecture rules

1. **The simulation never touches the renderer, DOM, or audio.** It emits typed
   events; presentation subscribes. This is what makes the whole game runnable
   headless in Node — and it is the reason the test suite is real evidence
   rather than a mock exercise.
2. **Shared systems never branch on a character id.** If behaviour differs
   between fighters, it belongs in `CharacterData`. Grep for `'kairo'` or
   `'veyron'` outside `characters/` — there should be no gameplay hits.
3. **The AI selects abilities by `AbilityKind`, never by id.** It drives any
   future fighter unmodified.
4. **The simulation is deterministic.** Fixed 60Hz tick, seeded RNG everywhere.
   `Math.random()` is banned in `src/gameplay`, `src/ai`, and `src/core`. A
   failing stability run must be replayable from its seed.
5. **Pools, never unbounded spawning.** Projectiles, VFX and events are all
   fixed-size with round-robin recycling.
6. **Every P0 safety rule is structural, not incidental.** Anti-infinite-combo
   behaviour is enforced by four independent mechanisms (see
   `gameplay/DamageModel.ts`), not by careful frame-data authoring.
7. **Frame data is the source of truth.** Poses are generated from attack
   phase, so what the player sees always agrees with the hitboxes.

## Coding conventions

- TypeScript strict mode; no `any` in gameplay code.
- Comments explain **why**, never what. Assume the reader can read code.
- Units: metres, seconds, m/s. Frames are 60Hz integers. Yaw in radians, 0 = +Z.
- Components own one concern and know nothing about the fighter that holds them.
- New tuning values go in `CharacterData`, not as constants in shared systems.

## Testing rules

- Never disable or weaken a test to make a build pass.
- A system is not "done" because code exists — it is done when a test exercises
  it through the real simulation and a critic pass has reviewed the result.
- Bugs found by running the game get a regression test before the fix lands.

---

## Originality

Original universe, characters, terminology, abilities, visual language and
audio. No Dragon Ball, Naruto, Bleach or other protected franchise material.

The uploaded reference sheet supplied to this project contained Dragon Ball IP
(Saiyan race, Planet Vegeta, Super Saiyan / Ultra Instinct tiers, Spirit Bomb).
**None of it was used.** Only non-protectable visual mood — a violet/gold
energy palette and a dark dossier UI style — was carried across. See
`docs/DECISIONS.md` D-002.

All audio is synthesised at runtime from oscillators and shaped noise. There is
no sampled, licensed or third-party audio in the build.
