# KAIRO: ASCENSION — Combat Rubric

Scored 1–10 by an independent critic pass reviewing the running build,
screenshots, frame data, test results and balance sweeps — not the source alone.

**A score below 7 in any P0 category is a rejection.**

| # | Category | P0? | Score | Verdict |
|---|---|---|---|---|
| 1 | Responsiveness | ✅ | **8** | Accept |
| 2 | Movement freedom | ✅ | **9** | Accept |
| 3 | Melee feel | ✅ | **8** | Accept |
| 4 | Defensive depth | ✅ | **8** | Accept |
| 5 | Impact | ✅ | **8** | Accept |
| 6 | Camera behaviour | ✅ | **7** | Accept (was 4 — see below) |
| 7 | VFX readability | ✅ | **8** | Accept |
| 8 | Fighter identity | ✅ | **9** | Accept |
| 9 | AI behaviour | ✅ | **8** | Accept |
| 10 | Balance | — | **8** | Accept |
| 11 | Spectacle | — | **7** | Accept |
| 12 | Originality | ✅ | **9** | Accept |

**Overall: 8.1 / 10. No P0 category below 7. Build accepted for the slice.**

---

## 1. Responsiveness — 8

Light attack startup is 5 frames (83 ms). Input buffering holds a press for 8
frames so an input made during recovery fires the instant the window opens.
Defensive options are checked before offensive ones every frame, so guard and
dodge can always interrupt neutral. The simulation is a fixed 60Hz independent
of display refresh.

*Evidence:* `npm test` movement and melee suites; frame data in
`characters/*.ts`; `InputState.BUFFER_FRAMES`.

*Why not higher:* the grounded heavy resolves on button *release* rather than
press, so a tapped heavy carries one frame of latency that a light does not.
The charge stance provides immediate visual feedback, which masks it, but it is
measurably there.

## 2. Movement freedom — 9

Ground, sprint, jump, variable jump height, free flight, boost flight, ground
and air dash, pursuit dash, air recovery, ground recovery. Flight is entered by
tapping jump in mid-air — one button, no charge — and is a genuine first-class
state rather than an extended jump. Ground deceleration is 1.6× acceleration and
opposing input doubles it, which is what keeps direction changes from feeling
mushy. Gravity is ~3.5× real-world specifically to avoid float.

*Evidence:* six movement acceptance tests; `05-flight.png`, `06-boost.png`.

*Why not 10:* there is no wall interaction beyond the splat, and no vertical
traversal that uses the monoliths.

## 3. Melee feel — 8

Frame-data driven throughout. Four-link chain for Kairo, three for Veyron, with
cancels gated on connect so whiffs cannot be cancelled. Launcher into aerial
chain, ground bounce, wall splat, charged heavy with continuous scaling.

*Evidence:* melee acceptance suite; `07-combo.png` showing the combo counter,
hit sparks and hitstop.

*Why not higher:* max observed combo in real play is 4. The systems support
much longer routes — launcher, air chain, pursuit dash, re-launch — but nothing
in the current tuning *rewards* discovering them, so the combo ceiling is
theoretical rather than practiced. This is the single biggest remaining gap
between "good" and "excellent" in the melee layer.

## 4. Defensive depth — 8

Five distinct options, each with an explicit cost and window: guard (drains a
meter, breaks), perfect guard (6 frames, punishes 26), dodge (i-frames on the
front only, so mashing it loses to a delayed attack), Phase Break (a full energy
bar), and super armor as a character-specific trade.

The counterplay triangle is clean and legible: turtling loses to Dominion Crush,
mashing loses to Rift Counter, and both lose to patience.

*Evidence:* seven defence acceptance tests including guard break and Phase
Break; 58 parries and 52 blocks recorded across a 10-minute AI session.

*Why not higher:* there is no throw or equivalent to beat a purely passive
guard outside of Veyron's guard-break special, so Kairo's answer to a turtle is
narrower than Veyron's.

## 5. Impact — 8

Hitstop is the primary mechanism and scales from 4 frames on a jab to 22 on an
ultimate — both fighters *stop*, not slow. Camera trauma is squared so a jab
ticks and an ultimate slams, and decays rather than being set, so rapid hits
never accumulate into a constant rumble. Knockback, ground bounce and wall
splat all carry through. The rig freezes its pose during hitstop, which is what
makes the freeze read as force rather than as a hitch.

*Evidence:* hitstop acceptance test; `CombatCamera.applyShake`.

*Why not higher:* no per-hit time dilation or directional impact-frame zoom,
both of which are cheap and would add a lot.

## 6. Camera behaviour — 7 *(previously 4 — rejected, then fixed)*

**This category was initially a rejection.** Screenshot review of the running
game showed the P1 failure "poor camera framing": with the camera solved onto
the player→target axis, Veyron's larger body completely eclipsed Kairo during
every close exchange. The fight was unreadable at exactly the moment readability
matters most.

Notably, **every automated test passed while this was true.** It was invisible
to the test suite and obvious in one screenshot.

Two corrections were applied: a lateral over-the-shoulder slide (insufficient
alone at ~1 m separation), then swinging the camera up to 36° off the axis as
the fighters close, with the look target biased to the midpoint. Distance now
also increases at close range rather than decreasing.

Camera collision against pillars, floor clearance, speed-scaled FOV, pursuit
framing and a cinematic ultimate orbit are all in place.

*Why not higher:* the off-axis swing is a heuristic, not a solve — it does not
verify that both silhouettes are actually unoccluded, so contrived geometry
could still stack them. A proper screen-space separation solve would earn a 9.

## 7. VFX readability — 8

Every effect is coloured by its **owner**, and the two energy palettes are over
90° apart in hue — enforced by a test, not by convention. Impact flashes are
bright and brief rather than large and lingering, so they never bury the
fighters. All pools are fixed-size, so density has a hard ceiling by
construction. The HUD is a DOM overlay and physically cannot be washed out.

*Evidence:* hue-separation test; `11-starfall.png`, `16-ultimate-payoff.png`
with the HUD legible over a full-screen detonation.

*Why not higher:* the arena is dark enough that Veyron's black warplate can lose
its silhouette against unlit ground when he is not emitting; his rim light
carries most of that read and it is thinner than Kairo's.

## 8. Fighter identity — 9

The two fighters differ on every axis simultaneously, and every difference is
data: startup (5f vs 7f), chain length (4 vs 3), reach, health, guard meter,
armor, turn rate, air dash charges, flight speed, ability kinds, and the entire
strategic posture. Kairo wins by tempo; Veyron wins by space. Neither is a
reskin in any respect.

Colour, silhouette, audio pitch and timbre all reinforce the mechanical split.

*Evidence:* the fighter-identity acceptance suite asserts the differences
numerically rather than trusting them.

*Why not 10:* Veyron's aerial game is deliberately weak, which is correct for
his identity but means aerial combat is largely a Kairo-only system in this
slice.

## 9. AI behaviour — 8

Utility-scored across 18 tactics, with recency penalties preventing repetition,
commitment timers preventing flip-flopping, and a rolling opponent profile that
biases toward guard-breaks against blockers and counters against rushers.
Reads only *delayed observable state* — never inputs — with the delay set by
difficulty (7–22 frames). Four tiers that measurably differ.

Completes full matches unaided; 21 consecutive matches with restarts over 10
minutes and zero warnings.

*Evidence:* `npm run sim -- stability 10`; `npm run sim -- balance`.

*Why not higher:* it does not currently execute launcher→aerial routes, so it
never demonstrates the combo ceiling to the player. It also does not bait — it
reacts and pressures, but never deliberately whiffs to draw a punish.

## 10. Balance — 8

Measured over 80 matches per pass, not asserted:

| Difficulty | Kairo | Veyron |
|---|---|---|
| Cadet | 16 | 4 |
| Warrior | 12 | 8 |
| Warlord | 9 | 11 |
| Tyrant | 9 | 11 |

Near-even at the top two tiers with a player-favourable curve at the bottom,
which is the correct shape. Average match length 24–29 s.

An earlier pass measured 24–0 in Veyron's favour and was traced to a real bug
(ultimate motes dealing damage), not to tuning — a good illustration of why
balance measurement belongs in the loop.

*Why not higher:* only mirrored difficulties were swept, and only AI-vs-AI. AI
balance is a proxy for player balance, not a substitute.

## 11. Spectacle — 7

Transformations shift hue rather than merely brightening, with a beam pillar, a
full-body power pose and an audio swell. Ultimates take over the camera with an
orbit, hold the opponent, stream cosmetic motes inward, and detonate with global
hitstop. The arena has a reactive energy barrier, destructible monoliths, drifting
dust and rising embers.

*Why not higher:* there is no post-processing — no bloom, no radial blur, no
chromatic aberration on impact. For a genre defined by excess, additive blending
alone leaves real spectacle on the table. This is the highest-value remaining
visual work and is deliberately deferred, not overlooked.

## 12. Originality — 9

Original universe, characters, terminology, abilities, arena, UI and audio. All
ten ability names, both transformations and both ultimates use the project's own
terminology. The arena is generated procedurally; there are **zero** image,
model or audio files in the repository. All audio is synthesised at runtime.

The Dragon Ball IP present in the supplied reference sheet — Saiyan race, Planet
Vegeta, the Super Saiyan / Ultra Instinct ladder, Spirit Bomb — was explicitly
excluded and the exclusion documented (`DECISIONS.md` D-002).

*Why not 10:* the genre itself is derivative by design — energy projectiles,
flight, transformations and beam ultimates are the vocabulary of anime arena
fighters. The execution is original; the form is a homage, as the brief intends.

---

## Rejections issued and resolved this cycle

1. **Camera framing (P1 → rejection at score 4).** Close-range occlusion made
   melee unreadable. Fixed with off-axis framing. Re-scored 7.
2. **Fighter collision (P0).** Bodies interpenetrated, putting targets in the
   hitbox blind spot; combat silently stopped working. Fixed.
3. **Ultimate damage model (P0).** Cinematic motes dealt damage, producing fake
   22-hit combos and a 24–0 balance blowout. Fixed.
4. **Ultimate deadlock (P0).** Frame-keyed effects re-fired during hitstop,
   hanging the match permanently. Fixed.
5. **Knockdown looping (P1).** OTG hits allowed knockdown loops. Fixed by making
   knockdown invulnerable.

## Outstanding, accepted into the next milestone

- Combo ceiling is 4 in practice; the systems support far more (P1).
- No post-processing (P1, spectacle).
- Frame rate on GPU hardware is unverified — see `ACCEPTANCE_TESTS.md` P6 (P0
  for release, not verifiable in this environment).
