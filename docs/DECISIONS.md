# KAIRO: ASCENSION — Decision Log

Significant technical and creative decisions, with the reasoning that produced
them. Recorded so future work can tell a deliberate choice from an accident.

---

## D-001 — Build the slice in TypeScript + WebGL, not Unreal Engine 5

**Status:** Accepted (forced) · **Date:** M0

The brief specifies UE5. The development container has no Unreal Engine, no GPU
(`/dev/dri` absent), no display, 4 cores and ~30 GB free disk against UE5's
~200 GB source build. UE5 cannot be installed, compiled, launched, packaged or
tested here.

Two options existed:

1. **Author UE5 C++ that no one can compile.** Every verification requirement in
   the brief — run the game, capture screenshots, automation tests, a
   ten-minute stability session, a packaged build, independent critique of
   gameplay footage — becomes unreachable. The Gauntlet Loop degrades into
   grading unexecuted code, which is precisely the failure mode section 6 of the
   brief exists to prevent.

2. **Build on a stack that actually runs here.** The loop closes: the game
   compiles, runs, renders, is driven by real inputs and produces screenshots
   and measurements.

Chose (2). The brief's own section 14 states the first objective is *"to prove
that controlling Kairo and fighting Veyron is immediately enjoyable"*, and that
cannot be proven by code that has never executed.

**Mitigation:** the architecture is deliberately engine-shaped —
`Fighter`/`AFighterCharacter`, `CharacterData`/`UPrimaryDataAsset`,
`AbilityDef`/`UGameplayAbility`, `EventBus`/Gameplay Cues, `FighterAI`/Behavior
Tree. Character behaviour is entirely data, so a port re-authors two data files
rather than rewriting combat. The mapping table is in `CLAUDE.md`.

**Cost accepted:** this is not a UE5 project and would need a real port.

---

## D-002 — Reject the Dragon Ball IP in the supplied reference sheet

**Status:** Accepted · **Date:** M0

The reference image provided with the brief is a character sheet whose *content*
is Dragon Ball intellectual property: "Race: Saiyan (Pure-Blood)", "Homeworld:
Planet Vegeta (Destroyed)", transformations labelled Super Saiyan / Super Saiyan
2 / Super Saiyan God / Ultra Instinct, and an ability named "Spirit Bomb:
Reborn".

This directly contradicts section 2 of the same brief, which forbids copying
Dragon Ball characters, names, transformations, attack names and story elements.

**Decision:** use only the non-protectable visual mood — a violet/gold energy
palette, dark cinematic tone, and a dossier-style UI aesthetic. Discard all IP.
Kairo is the last celestial warrior of Planet Veyra with the Celestial Surge
transformation, exactly as the brief's own section 2 defines him.

This was flagged to the user before implementation began.

---

## D-003 — Fixed 60Hz simulation, fully decoupled from rendering

**Status:** Accepted · **Date:** M1

The simulation is a pure function of `(state, inputs) → state` with no
dependency on the renderer, DOM, audio or wall clock.

**Why:** it is what makes the Gauntlet Loop's evidence requirements achievable
at all. The entire fight runs in Node at ~19,000 frames/sec, so 59 acceptance
tests exercise the *real* game rather than mocks, and a ten-minute stability
session costs about two seconds. It also guarantees combat feels identical at
60Hz and 144Hz, and is the expensive precondition for rollback netcode.

**Cost:** presentation must be written against an event stream rather than
reading game state directly. Worth it.

---

## D-004 — Make anti-infinite-combo behaviour structural, not tuned

**Status:** Accepted · **Date:** M3

"Infinite combos" and "stunlock loops" are P0 failures in the brief. Rather than
relying on careful frame-data authoring, four independent mechanisms enforce it:
damage scaling, hitstun proration, juggle gravity decay and a hard combo cap —
plus knockdown invulnerability and the Phase Break escape.

**Why:** any one mechanism would break a loop alone, so no future attack, no
matter how aggressively tuned, can reintroduce the failure. Designers get to
author bold frame data without being able to break the game.

**Validated:** an adversarial test mashes light attacks for 4,000 frames against
an invulnerable-health dummy; the combo counter never exceeds the cap of 22, and
the longest continuous helpless run stays under 600 frames.

---

## D-005 — Knockdown grants invulnerability

**Status:** Accepted · **Date:** M3

Discovered by reading a frame trace: the attacker was hitting a `Downed`
opponent on the ground, restarting the combo indefinitely (OTG looping). The
hard cap contained it, but only barely, and the result was a dismal experience.

Adopted the standard fighting-game rule: a knocked-down fighter cannot be hit
until they rise. This forces the attacker to reset to neutral and creates the
wake-up mix-up, which is a *better* game, not merely a safer one.

**Measured effect:** the maximum combo under sustained mashing fell from 22 (the
hard cap) to 4 (the natural chain length) — the anti-infinite system stopped
needing to fire at all in ordinary play.

---

## D-006 — The AI selects abilities by kind, never by id

**Status:** Accepted · **Date:** M6

`FighterAI` looks up `AbilityKind.Projectile`, `AbilityKind.Counter` and so on,
never `'void_spear'`.

**Why:** it is the difference between an AI that drives Veyron and an AI that
drives *any fighter*. Adding a third character requires zero AI work. It also
keeps the "no shared system branches on a character id" rule intact in the one
place where violating it would be most tempting.

---

## D-007 — AI difficulty scales reaction, never knowledge

**Status:** Accepted · **Date:** M6

The brief forbids "constant AI input reading". The AI never touches the
opponent's `InputState`; it reads a ring buffer of observable state delayed by
`reactionFrames` (7–22 depending on tier) — exactly what a human sees, exactly
as late.

Difficulty scales *how quickly and how well it reacts to things a human could
also see*. A harder AI is not a better-informed AI.

**Consequence:** low difficulty tiers genuinely play worse rather than being
artificially handicapped, which reads as fair when the player loses.

---

## D-008 — Combos end when the victim recovers, not on a timer

**Status:** Accepted · **Date:** M3

The original `ComboTracker` reset after 48 frames without a hit. Balance sweeps
then reported 22-hit "combos" that were really fifteen seconds of ordinary
pressure with no gap longer than 0.8 s.

That was not just a cosmetic bug: damage scaling keyed off the same counter, so
neutral-game pokes were being prorated as though they were combo filler.

A combo is now defined as a sequence the victim could not escape, and ends the
moment they can act again.

---

## D-009 — Ultimate cinematic motes are cosmetic

**Status:** Accepted · **Date:** M8

Both ultimates spawn energy motes during the capture sequence. Initially these
went through the normal projectile path and dealt damage — each ultimate landed
~22 extra hits on the held target, which simultaneously produced fake 22-hit
combos, tripped the anti-infinite hard cap mid-cinematic, and caused a severe
balance blowout (Veyron winning 24-0 with 89% health remaining).

Motes are now flagged `cosmetic` and never collide. An ultimate's damage is
delivered exactly once, at its payoff frame.

**Lesson recorded:** spectacle effects must be explicitly non-damaging by
default. Reusing the projectile system for visuals was the mistake.

---

## D-010 — Ability effects resolve once per ability frame

**Status:** Accepted · **Date:** M8

A P0 deadlock: `resolveAbilityEffects` ran every simulation frame, but the
ability clock only advances inside `Fighter.tick`, which returns early during
hitstop. An ultimate's payoff applies hitstop *to its own caster*, so the payoff
frame re-fired forever and the match hung permanently.

Guarding on `hitstop > 0` was tried and was insufficient — `Fighter.tick`
decrements hitstop to zero and returns before advancing the ability clock, so
the effect still re-fired on that frame.

The correct invariant is keyed on the frame number itself:
`lastResolvedAbilityFrame`. Each ability frame resolves exactly once, regardless
of what froze the clock.

---

## D-011 — Fighters have body collision

**Status:** Accepted · **Date:** M3

Found by running the game, not by reading it. Without collision, fighters
interpenetrated to ~0.05 m separation, which placed the target *inside* the
blind spot of a forward-projected hitbox. Attacks whiffed at point-blank range
and combat silently stopped working — three hits landed in fifteen seconds of
continuous mashing.

Bodies now push apart, weighted so a helpless fighter is displaced more than the
attacker, preserving the attacker's spacing advantage during a combo.

**Lesson recorded:** this bug was invisible to code review and obvious after ten
seconds of a frame trace. It is the strongest argument in this project for the
brief's insistence on running the game.

---

## D-012 — Audio is synthesised, never sampled

**Status:** Accepted · **Date:** M9

Every sound is generated at runtime from oscillators and shaped noise. There are
zero audio files in the repository.

**Why:** it makes the originality position unambiguous — there is no third-party
audio in the build to be infringing. It also suits the genre: impact sounds are
generated *per hit* with weight and pitch derived from the attack's own damage
and hitstop, so a jab and a charged heavy differ audibly without anyone
authoring two clips, and a new attack gets a fitting sound for free.

**Cost:** the ceiling is lower than authored audio. Acceptable for a slice, and
the bus architecture is ready for real assets to be swapped in per-tag.

---

## D-013 — The HUD is DOM, not in-world

**Status:** Accepted · **Date:** M9

The brief requires the UI to remain readable during large VFX sequences. A DOM
overlay composited above the canvas is *physically incapable* of being washed
out by additive bloom, however bright the ultimate gets. An in-world or
canvas-drawn HUD would have to fight the tone mapper.

---

## D-014 — Poses are generated from frame data

**Status:** Accepted · **Date:** M9

There are no animation assets, so `FighterRig` derives every pose from
simulation state — attack phase, velocity, grounded-ness, hitstun, guard.

Beyond the obvious cost saving, this makes visual/hitbox desync structurally
impossible: the pose *is* a function of the frame data driving the hitbox. That
is a common and expensive bug class in animation-driven fighters, eliminated
rather than managed.

---

## D-015 — The camera comes off-axis at melee range

**Status:** Accepted · **Date:** M9

Screenshot review of the running game showed the P1 failure "poor camera
framing": with the camera exactly on the player→target axis, Veyron's larger
body completely eclipsed Kairo during every close exchange.

A lateral over-the-shoulder slide was tried first and was insufficient at ~1 m
separation. The camera now also swings up to 36° off the axis as the fighters
close, with the look target biased to the midpoint, so the pair reads as two
separated silhouettes.

**Lesson recorded:** this was invisible to every automated test — all of which
passed — and obvious in a single screenshot. Automated verification and visual
review catch disjoint classes of defect; the brief is right to require both.

---

## D-016 — Evidence capture owns the simulation clock

**Status:** Accepted · **Date:** M10

The first browser capture run produced a match where Kairo dealt **zero**
damage and lost. The cause was the harness, not the game: under SwiftShader the
browser manages ~5 fps while the fixed-timestep loop still advances 6 sim ticks
per rendered frame to keep real time. A script pressing a button "for 3 frames"
once per rendered frame was injecting 3 frames of input out of every ~6 — far
too sparse to play.

The automation hook gained `stepFrames(n)` and `setManualClock(on)`, so captures
advance an exact frame count independent of render speed. Captures are now
deterministic and reproducible.

**Note:** this is a test-harness seam that mirrors what a player can already do;
it grants no capability the player lacks.
