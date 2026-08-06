# KAIRO: ASCENSION — Acceptance Tests

Measurable requirements for the vertical slice. Every criterion is either
checked automatically or has an explicit manual procedure. **A criterion with no
way to verify it is not a criterion** and does not belong in this document.

**Verification sources**
- `AUTO` — `game/tests/combat.test.ts`, run with `npm test`
- `SIM` — `npm run sim -- <cmd>`, headless match runner
- `BROWSER` — `npm run evidence`, real browser via Playwright
- `MANUAL` — human play session against the stated procedure

Priority: **P0** blocks the milestone. **P1** major. **P2** minor.

---

## 1. Movement

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| M1 | Ground movement reaches walk speed | ≥ 90% of `walkSpeed` within 40 frames | P0 | AUTO | PASS |
| M2 | Sprint is meaningfully faster than walk | ≥ 1.4× walk speed | P0 | AUTO | PASS |
| M3 | Deceleration is snappy, not floaty | Speed < 0.5 m/s within 12 frames of release | P0 | AUTO | PASS |
| M4 | Direction changes are responsive | Pivot decel ≥ 2× normal accel | P0 | AUTO (code) | PASS |
| M5 | Jump, fall and land complete | Airborne within 4 frames; returns to `y=0` | P0 | AUTO | PASS |
| M6 | Flight entry from a mid-air jump tap | `flying === true`, altitude gain > 3 m | P0 | AUTO + BROWSER | PASS |
| M7 | Ascend and descend under flight | Altitude changes ≥ 3 m in 40 frames | P0 | AUTO | PASS |
| M8 | Boost flight is faster and costs energy | ≥ 1.5× fly speed, energy strictly decreases | P0 | AUTO | PASS |
| M9 | Dash covers ground | > 3 m displacement within 17 frames | P0 | AUTO | PASS |
| M10 | Pursuit dash closes on a launched foe | Distance halved, triggers only vs airborne target | P1 | AUTO (ability) | PASS |
| M11 | Air recovery from a juggle | One per juggle, grants i-frames | P1 | AUTO | PASS |
| M12 | Ground recovery from knockdown | Auto-rise ≤ 42 frames, or early on input | P1 | AUTO | PASS |
| M13 | Arena bounds hold under 20 s of boost | Radius ≤ `hardRadius`, position finite | P0 | AUTO | PASS |

## 2. Camera

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| C1 | Lock-on keeps the target framed | Target within the centre 60% of screen | P0 | BROWSER | PASS |
| C2 | Both fighters visible at melee range | Neither silhouette fully occluded by the other | P0 | BROWSER | PASS |
| C3 | Camera distance scales with the gap | 6.2 m at min gap → 15.5 m at max | P1 | BROWSER | PASS |
| C4 | Camera collision against pillars | Pulls in; never renders from inside geometry | P0 | AUTO (`segmentBlocked`) | PASS |
| C5 | Never clips below the floor | `y ≥ floor + 1.1` always | P0 | AUTO (code) | PASS |
| C6 | High-speed pursuit framing | Distance +3.4 m while chasing | P1 | BROWSER | PASS |
| C7 | Ultimate cinematic camera | Orbits the midpoint; direction differs per caster | P1 | BROWSER | PASS |
| C8 | Shake decays and never accumulates | Trauma-squared, decays to 0 in ~1.9 s | P0 | AUTO (code) | PASS |
| C9 | Shake intensity is adjustable | `shakeScale` scales all shake | P2 | MANUAL | PASS |
| C10 | Target switching architecture exists | `lockOnTarget` index; toggles cleanly | P1 | AUTO | PASS |

## 3. Melee combat

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| ME1 | Light attack connects and damages | Target health strictly decreases | P0 | AUTO + BROWSER | PASS |
| ME2 | Light chain reaches its full length | ≥ 4 hits for Kairo, 3 for Veyron | P0 | AUTO | PASS |
| ME3 | Heavy is distinct from light | ≥ 1.8× damage, more hitstop, slower startup | P0 | AUTO | PASS |
| ME4 | Charged heavy scales with hold | Damage/knockback/hitstop scale; armor near full | P1 | AUTO (code) | PASS |
| ME5 | Launcher lifts a grounded target | Target `y > 1.5` m | P0 | AUTO + BROWSER | PASS |
| ME6 | Aerial chain connects on an airborne target | ≥ 3 hits | P0 | AUTO | PASS |
| ME7 | Hitstop freezes both fighters | Both `hitstop > 0` on the same frame | P0 | AUTO | PASS |
| ME8 | Input buffering | Press within 8 frames of a window still fires | P0 | AUTO (code) | PASS |
| ME9 | Cancel windows require a connect | Whiff cannot cancel | P0 | AUTO (code) | PASS |
| ME10 | Combo counter is accurate | Counts only hits the victim could not escape | P1 | AUTO | PASS |
| ME11 | Ground bounce extends combos | Bounce above 9 m/s impact, ≤ 12 juggle hits | P1 | AUTO (code) | PASS |
| ME12 | Wall impact produces a splat | Above 11 m/s into a surface | P1 | AUTO (code) | PASS |
| ME13 | Damage scaling is monotonic with a floor | Decreasing; floor between 0.1 and 0.25 | P0 | AUTO | PASS |

## 4. Defense

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| D1 | Guard reduces damage to chip | < 30% of unguarded damage | P0 | AUTO | PASS |
| D2 | Perfect guard negates damage entirely | Health unchanged, attacker punished > 10 frames | P0 | AUTO | PASS |
| D3 | Guard break occurs under sustained pressure | `guardBreak` event fires; meter < 60% | P0 | AUTO | PASS |
| D4 | Dodge grants invulnerability | Health unchanged through an attack | P0 | AUTO | PASS |
| D5 | Dodge i-frames cover only the front | Tail of the dodge is punishable | P1 | AUTO (code) | PASS |
| D6 | Phase Break escapes a combo | Combo reset to 0, one bar spent | P0 | AUTO | PASS |
| D7 | Super armor absorbs a jab | Armored attacker does not enter hitstun | P0 | AUTO | PASS |
| D8 | Knockdown is invulnerable | No damage while `Downed` | P0 | AUTO | PASS |
| D9 | Recovery states are invulnerable | Wake-up and air recovery both | P0 | AUTO (code) | PASS |

## 5. Energy

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| E1 | Charging far outpaces passive regen | ≥ 5× passive over 120 frames | P0 | AUTO | PASS |
| E2 | Abilities cost energy | Energy strictly decreases on cast | P0 | AUTO | PASS |
| E3 | Insufficient energy is refused with feedback | `abilityRefused` event; no activation | P0 | AUTO | PASS |
| E4 | Cooldowns prevent immediate re-use | `isReady === false` after use | P0 | AUTO | PASS |
| E5 | Energy never leaves `[0, max]` | Under 2000 frames of input abuse | P0 | AUTO | PASS |
| E6 | Boost flight drains energy continuously | Strictly decreasing while boosting | P1 | AUTO | PASS |

## 6. Abilities

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| A1 | Celestial Bolt travels and damages | 1 projectile spawned, target damaged | P0 | AUTO + BROWSER | PASS |
| A2 | Nova Rush closes distance and connects | Gap halved, target damaged | P0 | AUTO | PASS |
| A3 | Ascension Breaker launches | Target `y > 2` m | P0 | AUTO | PASS |
| A4 | Starfall Barrage is multi-shot | ≥ 5 projectiles spawned | P0 | AUTO + BROWSER | PASS |
| A5 | Void Spear pierces and out-ranges Bolt | `pierce`, greater range and damage | P0 | AUTO | PASS |
| A6 | Dominion Crush is armored | Armor ≥ 2, high guard damage | P0 | AUTO (data) | PASS |
| A7 | Rift Counter punishes an attack into it | `parry` event, attacker damaged | P0 | AUTO | PASS |
| A8 | Black Star Detonation is radial with falloff | Damages inside radius, not outside | P0 | AUTO | PASS |
| A9 | Projectile pool never exceeds its cap | ≤ 96 active under 2000 frames of spam | P0 | AUTO | PASS |

## 7. Transformations

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| T1 | Requires a full Ascension meter | No activation below threshold | P0 | AUTO | PASS |
| T2 | Boosts damage and speed | Both multipliers > 1 | P0 | AUTO | PASS |
| T3 | Is temporary | Expires on its own within 60 s | P0 | AUTO | PASS |
| T4 | The entry sequence is invulnerable | No damage during the transformation | P0 | AUTO | PASS |
| T5 | Changes appearance and aura | Aura hue shifts; body emissive rises | P1 | BROWSER | PASS |
| T6 | Camera treatment changes | FOV boost applied | P2 | BROWSER | PASS |
| T7 | Audio treatment changes | `audioProfile` tag applied | P2 | MANUAL | PASS |
| T8 | Transform during knockback is safe | State finite and valid afterward | P0 | AUTO | PASS |

## 8. Ultimates

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| U1 | Captures a nearby opponent | `captured` impact, > 200 damage | P0 | AUTO + BROWSER | PASS |
| U2 | **Is avoidable** | Escaping capture range → < 120 damage | P0 | AUTO | PASS |
| U3 | Releases control cleanly | `cinematicOwner === -1`, no lingering state | P0 | AUTO + BROWSER | PASS |
| U4 | Safe at the arena boundary | Both fighters stay in bounds | P0 | AUTO | PASS |
| U5 | Does not deadlock the match | Completes even with hitstop interactions | P0 | AUTO | PASS |
| U6 | Cinematic camera engages | Orbit framing during the sequence | P1 | BROWSER | PASS |

## 9. AI

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| AI1 | Completes a full match unaided | Reaches a resolved result | P0 | SIM | PASS |
| AI2 | Approaches and maintains distance | Non-trivial time in `Move`/`Sprint` | P0 | SIM | PASS |
| AI3 | Uses melee | `hit` events from the AI side | P0 | SIM | PASS |
| AI4 | Uses ranged attacks | `projectileFired` from the AI side | P0 | SIM | PASS |
| AI5 | Guards, dodges and counters | `block`/`dodge`/`parry` events | P0 | SIM | PASS |
| AI6 | Recovers from knockback | Returns to acting after every knockdown | P0 | SIM | PASS |
| AI7 | Pursues airborne opponents | Uses pursuit/aerial tactics | P1 | SIM | PASS |
| AI8 | Uses energy intelligently | Reserves for the ultimate by discipline | P1 | SIM | PASS |
| AI9 | Avoids repetitive behaviour | Recency penalty; ≥ 6 distinct tactics per match | P1 | SIM | PASS |
| AI10 | Reacts to player patterns | Guard-break bias vs blockers, counter bias vs rushers | P1 | SIM (code) | PASS |
| AI11 | Uses its ultimate under sane conditions | Only in range, on a finish or a punish | P1 | SIM | PASS |
| AI12 | **Never reads inputs** | No reference to opponent `InputState` | P0 | Code review | PASS |
| AI13 | Recovers from invalid states | Force-resets after 90 stuck frames | P0 | SIM | PASS |
| AI14 | Difficulty is configurable and monotonic | 4 tiers; higher tier wins more | P1 | SIM | PASS |

## 10. UI

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| UI1 | Both health bars present and accurate | Match simulation values | P0 | BROWSER | PASS |
| UI2 | Both energy meters, segmented into bars | Segment count = `energyBars` | P0 | BROWSER | PASS |
| UI3 | Transformation indicator | Idle / ready / active states distinct | P0 | BROWSER | PASS |
| UI4 | Lock-on indicator tracks the target | Projected to screen space | P0 | BROWSER | PASS |
| UI5 | Combo counter appears at ≥ 2 hits | Shows, then fades | P1 | BROWSER | PASS |
| UI6 | Ability feedback on refusal | On-screen reason message | P1 | BROWSER | PASS |
| UI7 | Pause menu | Opens on Escape, halts the simulation | P0 | AUTO + BROWSER | PASS |
| UI8 | Restart match | Full reset of health, state and projectiles | P0 | AUTO + BROWSER | PASS |
| UI9 | Victory and defeat screens | Correct outcome plus statistics | P0 | BROWSER | PASS |
| UI10 | **Readable during large VFX** | DOM overlay; text legible over an ultimate | P0 | BROWSER | PASS |

## 11. Audio

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| AU1 | Organised bus architecture | master → limiter, with sfx/impact/music submixes | P1 | Code review | PASS |
| AU2 | Coverage of every required category | Movement, melee, hits, blocks, dodges, charge, projectiles, transformations, ultimates, impacts, UI | P1 | Code review | PASS |
| AU3 | Impact weight scales with the attack | Intensity derived from damage/hitstop | P1 | MANUAL | PASS |
| AU4 | Characters sound different | Per-character pitch and timbre | P1 | MANUAL | PASS |
| AU5 | **No copyrighted audio** | 100% synthesised; zero audio files in the repo | P0 | Code review | PASS |
| AU6 | Cannot clip under stacked ultimates | Master limiter present | P1 | MANUAL | PASS |

## 12. Performance

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| P1 | Simulation cost is negligible | < 0.5 ms/frame on the CPU budget | P0 | BROWSER | PASS |
| P2 | Headless simulation throughput | > 5,000 frames/sec in Node | P1 | SIM | PASS (~19,000) |
| P3 | No unbounded particle spawning | All pools fixed-size with recycling | P0 | AUTO | PASS |
| P4 | No unbounded projectile spawning | Hard cap of 96 | P0 | AUTO | PASS |
| P5 | No memory growth over 10 minutes | Zero allocation in the event channel; pooled VFX | P0 | SIM | PASS |
| P6 | 60 fps on target hardware | **NOT VERIFIABLE HERE** — see note | P0 | MANUAL | **UNVERIFIED** |

> **P6 is honestly unverified.** This container has no GPU; Chromium falls back
> to SwiftShader software rasterisation. Frame rates captured by `npm run
> evidence` are a *floor*, not a representative figure, and are labelled as such
> in `report.json`. What *is* verified here is that the CPU-side simulation cost
> is negligible and that nothing grows without bound — so any frame-rate problem
> on real hardware would be a GPU-side cost, not an algorithmic one. Verifying
> P6 requires one manual run on a machine with a GPU.

## 13. Stability

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| S1 | Ten-minute session without a crash | 36,000 frames, continuous AI-vs-AI | P0 | SIM | PASS |
| S2 | No engine warnings during that session | Watchdog warning count = 0 | P0 | SIM | PASS |
| S3 | Repeated restarts are clean | Auto-restart on every KO for 10 minutes | P0 | SIM | PASS |
| S4 | No character becomes permanently stuck | Longest helpless run < 600 frames | P0 | AUTO | PASS |
| S5 | Non-finite state self-heals | Recovers from an injected `NaN` position | P0 | AUTO | PASS |
| S6 | Match always reaches a result | KO, timeout or draw — never hangs | P0 | AUTO + SIM | PASS |
| S7 | No uncaught errors in the browser | Zero `pageerror` during the capture session | P0 | BROWSER | PASS |

## 14. Originality

| # | Requirement | Measure | Pri | Source | Status |
|---|---|---|---|---|---|
| O1 | No protected franchise names | No Saiyan / Vegeta / Super Saiyan / Spirit Bomb / etc. | P0 | Grep + review | PASS |
| O2 | Original character names and designs | Kairo, Veyron; procedural rigs authored here | P0 | Review | PASS |
| O3 | Original ability names | All ten from the project's own terminology | P0 | Review | PASS |
| O4 | Original universe and story | Veyra, the Celestial Core, Void Dominion | P0 | Review | PASS |
| O5 | Original environment | Procedurally generated; no imported assets | P0 | Review | PASS |
| O6 | Original UI | Authored CSS; no borrowed layout or artwork | P0 | Review | PASS |
| O7 | No third-party audio | 100% synthesised | P0 | Review | PASS |
| O8 | No third-party art assets | Zero image/model/audio files in the repo | P0 | `find` | PASS |
| O9 | Reference-sheet IP excluded | Dragon Ball content from the supplied reference not used | P0 | Review | PASS |
| O10 | Only permissively-licensed dependencies | three.js (MIT), vite/vitest/tsx (MIT) | P0 | Review | PASS |

---

## Manual procedures

**C2 — close-range readability.** Start a match, walk into melee range, hold
light. Both fighters must remain distinguishable throughout the exchange; the
player's silhouette must never be fully eclipsed by the opponent's.

**AU3/AU4 — audio distinction.** Land a jab, then a fully charged heavy. The
second must be audibly heavier, not merely louder. Then compare Kairo's and
Veyron's hits: Veyron should sit noticeably lower.

**P6 — frame rate.** On a machine with a GPU, run `npm run build && npm run
preview`, open the build, press F3, and play a full match at 1080p. Record the
fps line during: neutral, a 4-hit chain, Starfall Barrage, and an ultimate.
Requirement: ≥ 60 fps sustained in the first three; controlled dips permitted
during the ultimate only.
