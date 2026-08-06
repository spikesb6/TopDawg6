# KAIRO: ASCENSION — Progress

**Current milestone:** M10 — Final Gauntlet
**Build:** passing (`tsc` clean, `vite build` clean)
**Live dashboard:** `progress/index.html` (regenerate with `npm run dashboard`)

---

## Milestone status

| # | Milestone | Status |
|---|---|---|
| M0 | Repository inspection | ✅ Complete |
| M1 | Project foundation | ✅ Complete |
| M2 | Greybox movement | ✅ Complete |
| M3 | Melee foundation | ✅ Complete |
| M4 | Defense | ✅ Complete |
| M5 | Energy combat | ✅ Complete |
| M6 | AI | ✅ Complete |
| M7 | Character identity | ✅ Complete |
| M8 | Transformations and ultimates | ✅ Complete |
| M9 | Presentation | ✅ Complete |
| M10 | Final Gauntlet | 🔄 In progress — one criterion blocked on hardware |

---

## Completed systems

**Core** — deterministic fixed-60Hz simulation, seeded RNG throughout, pooled
allocation-free event channel, Enhanced-Input-style action mapping with an
8-frame buffer, headless Node runner and CLI.

**Movement** — ground, sprint, jump with variable height, fall, free flight,
boost flight, ground dash, air dash, pursuit dash, air recovery, ground
recovery, three-zone soft arena boundary.

**Camera** — lock-on with off-axis melee framing, free-look, gap-scaled
distance, pillar occlusion, floor clearance, speed-scaled FOV, pursuit framing,
cinematic ultimate orbit, trauma-based shake with an adjustable scale.

**Melee** — full frame-data model (startup/active/recovery, cancel windows
gated on connect, hitstop, input buffering), 4-link chain for Kairo and 3 for
Veyron, heavy, charged heavy with continuous scaling, launcher, aerial chains,
ground bounce, wall splat, combo counter, damage scaling.

**Defense** — guard with a breakable meter, 6-frame perfect guard with a
26-frame punish, dodge with front-loaded i-frames, guard break, Phase Break
combo escape, super armor as a character trait, knockdown invulnerability.

**Energy** — segmented bars, passive regen, active charging, per-ability costs,
cooldowns with HUD sweeps, refusal feedback, boost drain.

**Abilities** — all ten implemented and tested: Celestial Bolt, Nova Rush,
Ascension Breaker, Starfall Barrage, Final Horizon; Void Spear, Dominion Crush,
Rift Counter, Black Star Detonation, End of Worlds.

**Transformations** — Celestial Surge and Tyrant Unbound. Meter-gated,
invulnerable entry, temporary by construction, and they modify damage, defense,
speed, attack speed, energy regen, armor, aura colour, camera FOV and audio.

**AI** — utility scoring across 18 tactics, four difficulty tiers, delayed
observable-only perception, recency-based anti-repetition, opponent pattern
adaptation, self-recovery from invalid states, ability selection by kind.

**Presentation** — procedural Ruins of Veyra with a reactive energy barrier,
destructible monoliths, dust and embers; procedurally posed fighter rigs driven
by frame data; pooled VFX; fully synthesised audio; DOM HUD; pause, restart,
victory and defeat.

---

## Test results

| Suite | Result |
|---|---|
| Acceptance tests (`npm test`) | **59 / 59 passing** |
| Browser scenarios (`npm run evidence`) | **12 / 12 passing** |
| 10-minute stability (`npm run sim -- stability 10`) | **PASS** — 36,000 frames, 21 complete matches with restarts, **0 warnings** |
| Balance sweep (`npm run sim -- balance 20`) | Kairo/Veyron — Cadet 16/4 · Warrior 12/8 · Warlord 9/11 · Tyrant 9/11 |
| Headless throughput | 55,000–75,000 simulation frames/sec |
| Combat rubric | **8.1 / 10**, no P0 category below 7 |

---

## Accepted work

Everything listed under "Completed systems" has passed both an automated suite
and a critic pass against `ACCEPTANCE_TESTS.md`.

## Rejected work, and what came of it

The Gauntlet Loop rejected five items this cycle. All were found by *running*
the game — none by reading it.

| Severity | Issue | Outcome |
|---|---|---|
| P0 | Fighters had no body collision; targets sat in the hitbox blind spot and combat silently stopped working | Fixed — capsule push-apart |
| P0 | Ultimate cinematic motes dealt damage — fake 22-hit combos, 24–0 balance blowout | Fixed — cosmetic projectile flag |
| P0 | Frame-keyed ability effects re-fired during hitstop; the ultimate deadlocked the match permanently | Fixed — resolve each ability frame exactly once |
| P1 | Camera fully eclipsed the player at melee range (rubric 4 → rejection) | Fixed — off-axis framing, re-scored 7 |
| P1 | Knockdown could be looped OTG | Fixed — knockdown invulnerability |

Plus four harness/AI defects that were corrupting the *evidence* rather than the
game: hardcoded AI seeds making every balance match identical, an AI that could
never chain-cancel, a stuck-detector firing during intro and KO, and a capture
script that could not drive the game under software rendering.

**The pattern worth recording:** the two most damaging bugs in this cycle — body
collision and camera occlusion — were invisible to a passing test suite. One was
caught by a frame trace within ten seconds, the other by a single screenshot.
Automated verification and direct observation catch disjoint classes of defect.

---

## Current blockers

**K-001 · 60 fps on target hardware is unverified.** Not verifiable in this
container: no GPU, so Chromium falls back to software rasterisation and the
captured ~5 fps measures SwiftShader, not the game. Everything measurable says
the simulation is free and nothing spawns without bound, so any problem would be
GPU-side — but that is an argument, not a measurement. Needs one manual run on a
GPU machine (`ACCEPTANCE_TESTS.md` P6).

No other P0 issues are open. Remaining P1/P2 items are in `KNOWN_ISSUES.md`.

---

## Definition-of-Done audit

| Criterion | Status |
|---|---|
| Project compiles | ✅ |
| Development build launches | ✅ Vite dev + production preview |
| Packaged build launches | ✅ `vite build` → `dist/`, verified via preview |
| Kairo fully player controlled | ✅ |
| Veyron controlled by functional AI | ✅ |
| A complete match can be played | ✅ Verified in-browser; player can win |
| Ground movement | ✅ |
| Aerial movement | ✅ |
| Lock-on | ✅ |
| Camera collision | ✅ |
| Melee combat | ✅ |
| Defense | ✅ |
| Energy attacks | ✅ |
| Distinct abilities per fighter | ✅ |
| Both transformations | ✅ |
| Both ultimate attacks | ✅ |
| Victory and defeat states | ✅ |
| Pause and restart | ✅ |
| Automated P0 tests pass | ✅ 59/59 |
| Ten-minute session without a crash | ✅ 0 warnings, 21 matches |
| No character permanently stuck | ✅ Watchdog + longest-helpless-run test |
| No unresolved P0 bugs | ⚠️ K-001 open, blocked on hardware only |
| No copyrighted design elements | ✅ |
| Originality critic approves | ✅ |
| Combat critic ≥ 7 in every P0 category | ✅ Lowest P0 is Camera at 7 |
| Integration critic finds no release blocker | ⚠️ K-001 |
| Documentation reflects reality | ✅ |
| `progress/index.html` has current evidence | ✅ Generated from captured runs |

**26 of 28 met. Both exceptions are the same item** — performance verification,
which requires hardware this environment does not have.

---

## Next milestone

**M11 — Combat depth.** Raise the practical combo ceiling from 4 to ~10, add
post-processing, verify performance on real hardware, and teach the new routes
through the AI. See `docs/NEXT_ACTIONS.md`.
