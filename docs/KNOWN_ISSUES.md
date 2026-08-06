# KAIRO: ASCENSION — Known Issues

Open issues only. Resolved issues move to the bottom section with their fix, so
the record of what broke and why survives.

| Severity | Meaning |
| --- | --- |
| **P0** | Blocker. Does not ship. |
| **P1** | Major. Damages the experience. |
| **P2** | Minor. Polish. |

---

## OPEN

### K-001 · P0 (release only) · 60 fps on target hardware is unverified
**System:** Performance
**Assigned:** Performance critic
**Repro:** Not reproducible here. This container has no GPU (`/dev/dri` absent),
so Chromium falls back to SwiftShader software rasterisation. Captured frame
rates (~5 fps) measure the software rasteriser, not the game.
**What *is* known:** CPU-side simulation cost is effectively 0.00 ms/frame in
the browser and 55,000–75,000 frames/sec headless. All spawning is pooled with
hard caps. Any frame-rate problem on real hardware would therefore be GPU-side,
not algorithmic.
**Proposed fix:** Run the manual procedure in `ACCEPTANCE_TESTS.md` P6 on a
machine with a GPU: `npm run build && npm run preview`, press F3, play a full
match at 1080p, record fps during neutral / 4-hit chain / Starfall Barrage /
ultimate.
**Status:** Open — blocked on hardware, not on code.

### K-002 · P1 · Practical combo ceiling is 4 hits
**System:** Combat
**Assigned:** Combat builder
**Repro:** Play or run `npm run sim -- balance 20`. Max combo across 80 matches
is 4 — exactly the length of Kairo's ground chain.
**Why it matters:** every system needed for long aerial routes already exists
and is tested — launcher, aerial chain, pursuit dash, ground bounce, juggle
gravity decay, the 22-hit cap. None of it is reachable in practice because the
chain finisher blows the opponent away and nothing bridges into the air.
The anti-infinite machinery is doing work that ordinary play never approaches.
**Proposed fix:** allow the launcher to be cancelled into from chain link 2 or 3
on hit, and give the pursuit dash a small cancel window out of an air finisher.
Then teach the route through the AI so players see it used against them.
**Status:** Open — accepted into the next milestone.

### K-003 · P1 · No post-processing
**System:** VFX
**Assigned:** VFX builder
**Repro:** Any ultimate. Energy effects rely on additive blending alone.
**Why it matters:** this is the largest remaining gap between the current build
and the "premium anime fighter" bar. Bloom in particular is close to mandatory
for the genre — emissive energy reads as flat colour without it.
**Proposed fix:** `UnrealBloomPass` via `EffectComposer`, plus a brief radial
blur on ultimate payoff frames. Must be quality-gated: bloom at 1080p is a real
GPU cost and this project cannot measure it here.
**Status:** Open — deliberately deferred, not overlooked.

### K-004 · P2 · Veyron's silhouette can be lost against unlit ground
**System:** VFX / readability
**Assigned:** Readability critic
**Repro:** Move Veyron away from the fractures onto dark terrain while he is not
emitting energy. His black warplate approaches the ground value.
**Proposed fix:** raise `rimColor` intensity on the heavy build, or add a
constant low-level fresnel rim to the fighter shader independent of energy state.
**Status:** Open.

### K-005 · P2 · Tapped heavy costs one frame relative to a light
**System:** Combat / input
**Assigned:** Combat builder
**Repro:** Press and release heavy. The attack resolves on release, so a tapped
heavy starts one frame later than a light pressed on the same frame.
**Why it is like this:** the grounded heavy routes through the charge stance so
tap and hold are the same button with two outcomes. The stance provides
immediate visual feedback, which masks the frame.
**Proposed fix:** start the heavy's wind-up on press and extend its startup
while held, releasing into the swing — same feel, no latency. Requires
`CombatComponent` to support a held startup frame.
**Status:** Open.

### K-006 · P2 · AI never demonstrates aerial routes
**System:** AI
**Assigned:** AI builder
**Repro:** Watch any AI match. It uses `aerial` and `pursue` tactics for
positioning but never converts a launcher into an air combo.
**Why it matters:** the AI is how most players learn what is possible. It
currently teaches that aerial combat is for repositioning.
**Proposed fix:** dependent on K-002. Once routes exist, add a `juggle` tactic
that scores highly when the opponent is `Launched` and above the AI.
**Status:** Open — blocked on K-002.

---

## RESOLVED

### K-100 · P0 · Fighters had no body collision — combat silently stopped working
**System:** Simulation
**Repro (was):** Approach the opponent and mash light. After the first chain,
three hits landed in fifteen seconds and then nothing.
**Root cause:** fighters interpenetrated to ~0.05 m separation. A hitbox is
projected *forward* from the attacker, so at zero separation the target sat
inside the hitbox's blind spot and every attack whiffed.
**Fix:** `Simulation.resolveFighterCollision` — capsule push-apart weighted so a
helpless fighter is displaced more than the attacker, preserving the attacker's
spacing advantage during a combo.
**Note:** invisible to code review; obvious within ten seconds of a frame trace.
**Status:** Fixed · verified by the melee acceptance suite.

### K-101 · P0 · Ultimate cinematic motes dealt damage
**System:** Abilities
**Repro (was):** Land any ultimate. The combo counter ran to 22 and the
anti-infinite hard cap fired mid-cinematic.
**Root cause:** the energy motes streaming inward during the capture sequence
were spawned through the normal projectile path, so each one dealt damage and
registered a combo hit — roughly 22 extra hits per ultimate. It also caused a
severe balance blowout (Veyron 24–0 with 89% health remaining).
**Fix:** `cosmetic` flag on `ProjectileParams`; cosmetic projectiles render and
travel but never collide. An ultimate's damage is delivered once, at its payoff.
**Status:** Fixed · verified by the ultimate acceptance suite and balance sweep.

### K-102 · P0 · Ultimate deadlocked the match permanently
**System:** Abilities
**Repro (was):** Land Final Horizon. The match hung forever at the payoff frame.
**Root cause:** `resolveAbilityEffects` ran every simulation frame, but the
ability clock only advances inside `Fighter.tick`, which returns early during
hitstop. The ultimate's payoff applies hitstop *to its own caster*, so the payoff
frame re-fired every frame in a closed loop.
**First attempted fix (insufficient):** guarding on `hitstop > 0`.
`Fighter.tick` decrements hitstop to zero and returns *before* advancing the
ability clock, so the effect still re-fired on that frame.
**Actual fix:** `lastResolvedAbilityFrame` — each ability frame resolves exactly
once, keyed on the frame number, regardless of what froze the clock.
**Status:** Fixed · verified by "the ultimate ends cleanly" acceptance test.

### K-103 · P1 · Camera fully eclipsed the player at melee range
**System:** Camera
**Repro (was):** Walk into melee range. Veyron's larger body completely covered
Kairo; the exchange was unreadable.
**Root cause:** the lock-on solve placed the camera exactly on the
player→target axis, putting the player between the lens and the opponent.
**Fix:** camera swings up to 36° off the axis as the fighters close, with the
look target biased toward the midpoint, plus a lateral over-the-shoulder slide
and increased distance at close range.
**Note:** every automated test passed while this was true. Caught by screenshot
review. Rubric score went 4 → 7.
**Status:** Fixed · verified by screenshot.

### K-104 · P1 · Knockdown could be looped
**System:** Combat
**Root cause:** downed fighters were not invulnerable, so an attacker could hit
them on the ground and restart the combo indefinitely (OTG looping). Only the
hard cap contained it.
**Fix:** `Downed` grants invulnerability, per standard fighting-game convention.
Forces the attacker to reset to neutral and creates the wake-up mix-up.
**Measured effect:** max combo under sustained mashing fell from 22 (the cap) to
4 (the natural chain length).
**Status:** Fixed.

### K-105 · P1 · AI could never chain-cancel
**System:** AI
**Root cause:** `FighterAI.think()` returned early whenever `canAct` was false,
which is true for the entire duration of an attack — so the AI could never press
the next link and its longest combo was two hits.
**Fix:** chain continuation while an attack has already connected and the
current tactic is `melee`.
**Measured effect:** AI max combo 2 → 4; balance moved from 24–0 to near-even.
**Status:** Fixed.

### K-106 · P1 · Balance sweeps were measuring one match repeatedly
**System:** Test harness
**Root cause:** `HeadlessMatch` constructed both `FighterAI` instances with
hardcoded seeds, so every match at a given difficulty was byte-identical. A
24-match sweep reported one match 24 times, producing meaningless 24–0 results.
**Fix:** AI seeds derived from the run seed.
**Status:** Fixed.

### K-107 · P1 · Combo counter measured pressure, not combos
**System:** Combat
**Root cause:** `ComboTracker` reset on a 48-frame timer, so sustained pressure
with no gap longer than 0.8 s reported as a single 22-hit combo. Damage scaling
keyed off the same counter, so neutral-game pokes were being prorated as combo
filler.
**Fix:** a combo now ends the moment the victim can act again.
**Status:** Fixed.

### K-108 · P1 · AI stuck-detector fired constantly during long sessions
**System:** AI
**Repro (was):** `npm run sim -- stability 10` produced 12 `[AI] stuck` warnings.
**Root cause:** the detector counted frames in which the AI wanted to move but
did not. During the match intro and the KO sequence the simulation deliberately
does not advance fighters at all, so the AI accumulated stuck frames while
behaving perfectly correctly. Being held against the opponent by body collision
had the same effect.
**Fix:** only count stuck frames when out of range, the opponent is alive, and
the simulation is demonstrably advancing.
**Status:** Fixed · 10-minute stability run now reports zero warnings.

### K-109 · P1 · Browser capture could not drive the game
**System:** Test harness
**Repro (was):** The first capture run produced a match in which Kairo dealt
**zero** damage and lost.
**Root cause:** under software rasterisation the browser manages ~5 fps while
the fixed-timestep loop still advances 6 sim ticks per rendered frame to keep
real time. A script pressing a button "for 3 frames" once per rendered frame was
injecting 3 frames of input out of every ~6.
**Fix:** `KAIRO.stepFrames(n)` and `KAIRO.setManualClock(on)` — captures own the
clock and advance an exact frame count independent of render speed.
**Status:** Fixed · captures are now deterministic.

### K-110 · P2 · Launcher input was unreachable
**System:** Combat / input
**Root cause:** the launcher (guard + heavy) was checked *after* the plain heavy
branch, which consumed the buffered heavy press first. The launcher could never
fire.
**Fix:** launcher is tested before the heavy branch.
**Status:** Fixed · verified by the launcher acceptance test.

### K-111 · P2 · A tapped heavy used the charged variant's frame data
**System:** Combat
**Root cause:** releasing the charge stance always used `chargedHeavyAttack`
regardless of hold duration, so a tap produced a slow attack with charged
properties at no charge benefit.
**Fix:** releases below `MIN_CHARGE_FRAMES` use the normal heavy.
**Status:** Fixed.
