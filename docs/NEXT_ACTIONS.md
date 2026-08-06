# KAIRO: ASCENSION — Next Five Actions

Ordered by value. Reviewed at the end of every Gauntlet cycle.

---

## 1 · Raise the practical combo ceiling from 4 to ~10 · **P1**

**Why this is first.** Every system needed for long aerial routes already exists
and is covered by tests — launcher, aerial chain, pursuit dash, ground bounce,
juggle gravity decay, the 22-hit safety cap. None of it is reachable in real
play, because the ground chain ends in a blow-away and nothing bridges into the
air. The anti-infinite machinery is currently protecting against combos that
ordinary play never approaches. This is the single largest gap between the
current build and the genre bar, and almost all of the work is already paid for.

**Do:**
- Allow chain link 2 or 3 to cancel into the launcher on hit (data change:
  add `k_launcher` / `v_launcher` to `cancelInto`).
- Give the aerial finisher a short cancel window into the pursuit dash.
- Retune juggle decay so a full route lands ~8–10 hits before dropping, rather
  than being cut short by the finisher's knockback.
- Add an acceptance test that executes a full launcher → air chain → pursuit →
  finisher route and asserts a hit count in the 8–12 band.

**Done when:** a scripted route reliably lands 8+ hits, the adversarial mashing
test still cannot exceed 22, and the longest helpless run is still under 600
frames.

## 2 · Add post-processing · **P1**

**Why.** The largest remaining spectacle gap, and close to mandatory for the
genre — emissive energy reads as flat colour without bloom. The build currently
relies on additive blending alone.

**Do:**
- `EffectComposer` with `UnrealBloomPass`, threshold tuned so only energy and
  impacts bloom and the arena does not.
- A brief radial blur on ultimate payoff frames only.
- A quality setting (off / low / high) defaulting by detected renderer, since
  bloom at 1080p is a real GPU cost this environment cannot measure.

**Done when:** the ultimate payoff screenshot reads as an event, the HUD is
still legible over it, and the quality toggle demonstrably changes cost.

## 3 · Verify performance on real hardware · **P0 for release**

**Why.** The one acceptance criterion this environment genuinely cannot check.
Everything measurable here says the simulation is free (0.00 ms/frame in the
browser, ~55–75k frames/sec headless) and that nothing spawns without bound —
so any problem would be GPU-side. That is an argument, not a measurement.

**Do:** run the manual procedure in `ACCEPTANCE_TESTS.md` P6 on a GPU machine
and record fps during neutral, a 4-hit chain, Starfall Barrage and an ultimate.
Then profile whichever is worst.

**Done when:** K-001 closes with real numbers, or a specific GPU-side bottleneck
is identified and filed.

## 4 · Teach the combo routes through the AI · **P1**

**Why.** The AI is how most players learn what is possible. It currently never
converts a launcher into an air combo, so it teaches that aerial combat is for
repositioning. Blocked on action 1.

**Do:**
- Add a `juggle` tactic scoring highly when the opponent is `Launched` and above
  the AI, executing the route from action 1.
- Add a `bait` tactic at Warlord and Tyrant that deliberately whiffs at the edge
  of range to draw a punish — the AI currently reacts and pressures but never
  sets traps.
- Extend the balance sweep to cross-difficulty pairings, not just mirrors.

**Done when:** AI matches show max combos of 6+, and the balance sweep still
lands within roughly 45–60% at Warlord and Tyrant.

## 5 · Local versus, then a training mode · **P1**

**Why.** Local versus is nearly free — the architecture already routes two
independent `InputFrame` streams, and `HeadlessMatch` proves it by running two
AIs. What is missing is input routing and a split HUD. It is also the fastest
way to get real balance data from humans rather than from AI mirrors.

Training mode is the natural follow-on and is unusually cheap here because the
simulation is deterministic and frame-data driven: frame display, hitbox
visualisation and a recording dummy are all reads of state that already exists.

**Do:**
- Route a second controller / keyboard half into fighter 1; add a character
  select; make the HUD symmetric (it already is, structurally).
- Then: frame-data overlay, hitbox rendering, input display, recording dummy.

**Done when:** two humans can play a full match, and training mode can display
startup/active/recovery and advantage for any attack.

---

## Deliberately NOT next

- **Online multiplayer.** The determinism groundwork is done and that was the
  expensive part, but shipping netcode before the combat is proven is the wrong
  order.
- **More fighters.** The roster claim is architecturally sound (adding a fighter
  is authoring one data object) but adding characters before the combo ceiling
  is fixed multiplies an unfinished system.
- **A second arena.** Cheap and low-value right now; the current arena is not
  the limiting factor on anything.
- **Menus, stores, progression.** Explicitly out of scope for the slice.
