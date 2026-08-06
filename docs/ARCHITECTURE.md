# KAIRO: ASCENSION — Architecture

## The one rule everything else follows

**The simulation has no dependency on the renderer, the DOM, audio or a GPU.**

It is a pure function of `(previous state, two input frames) → next state`,
running at a fixed 60Hz, driven by seeded randomness.

Every other architectural decision falls out of that:

- The whole fight runs in Node at ~19,000 frames/sec, so the acceptance tests
  exercise the *real* game rather than mocks, and a ten-minute stability session
  costs about two seconds of wall clock.
- Presentation subscribes to typed events. With no subscribers, the game still
  plays perfectly — it just makes no light or sound.
- Determinism means a failing run is replayable from its seed.
- It is also the hard 80% of rollback netcode, should that ever be wanted.

```
            ┌──────────────── inputs ────────────────┐
            │                                        │
      keyboard/mouse                            FighterAI
      Playwright bot                        (delayed perception)
            │                                        │
            └──────────► InputFrame ◄────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │    Simulation      │  fixed 60Hz, deterministic
                    │  ┌──────────────┐  │
                    │  │  Fighter x2  │  │
                    │  └──────────────┘  │
                    │   Arena, Projectiles│
                    └─────────┬──────────┘
                              │ typed events (pooled, no allocation)
              ┌───────────────┼───────────────┬──────────────┐
              ▼               ▼               ▼              ▼
        FighterRig       VFXSystem       AudioSystem       HUD
        CombatCamera     (pooled)        (synthesised)     (DOM)
```

---

## Core classes

### `Simulation` — `gameplay/Simulation.ts`

The authoritative state. Owns everything requiring both fighters at once:

- **Melee hit resolution.** `applyHit` is the single funnel through which *all*
  damage passes — melee, projectiles, explosions and ultimates. Centralising it
  is what guarantees combo scaling, parries, armor and i-frames behave
  identically everywhere. A new damage source gets correct behaviour for free.
- **Fighter-vs-fighter collision.** Bodies push apart, weighted so a helpless
  fighter is pushed more than the attacker.
- **Combo continuity.** A combo ends the moment the victim can act again.
- **Projectile integration.**
- **Ability effect scheduling**, keyed so each ability frame resolves exactly once.
- **Match flow** — intro, fighting, KO, victory, pause, reset.

### `Fighter` — `gameplay/Fighter.ts`

The shared base entity. Contains **zero** character-specific logic; everything
that differs comes from its `CharacterData`. Runs the state machine, translates
input into actions (identical path for humans and AI), integrates physics, and
receives hits.

It also runs a per-frame **watchdog** (`validate`) that detects and repairs
non-finite transforms, fighters wedged airborne, reaction states that overran,
abilities that never terminated and hitstop that never cleared. The brief lists
"character becomes permanently stuck" as a P0; this makes that class of bug
self-healing rather than merely unlikely.

---

## Component responsibilities

Each component owns exactly one concern and knows nothing about the fighter
holding it, so all are reusable by any future character.

| Component | Owns | Deliberately does not |
| --- | --- | --- |
| `MovementComponent` | Ground/air/flight physics, dash, pursuit, landing | Know why it is moving |
| `CombatComponent` | Which attack, what frame, what is legal | Hit detection (needs both fighters) |
| `DefenseComponent` | Guard, parry window, dodge i-frames, blockstun | Decide whether to defend |
| `Health` / `Energy` / `Guard` / `Ascension` | One resource each | Anything else |
| `ComboTracker` | Hit count and proration state | Damage numbers |
| `CooldownTracker` | Ability cooldown frames | Ability logic |
| `InputState` | Edge detection, the 8-frame press buffer | Where input came from |

## Gameplay framework

**Frame data is the source of truth.** Attacks are `startup / active / recovery`
in 60Hz frames, plus damage, hitstun, blockstun, hitstop, knockback, cancel
windows and armor. Poses are generated *from* the current attack phase, so what
the player sees can never disagree with what the hitboxes are doing.

**Hitstop** freezes both fighters completely — not slowed, stopped. It is the
single largest contributor to impact feel.

**Input buffering** remembers a press for 8 frames so an input made during
recovery fires the instant the window opens. Without it, the game feels
unresponsive no matter how fast the animations are.

### The anti-infinite ruleset

Four independent mechanisms, any one of which would break a loop alone:

1. **Damage scaling** — later hits deal progressively less, floor 18%.
2. **Hitstun proration** — later hits stun for less, floor 42%, so eventually
   the victim recovers before the next hit can connect.
3. **Juggle gravity decay** — each aerial hit increases the victim's gravity and
   reduces launch power, so juggles inevitably drop out of range.
4. **Hard cap** — at 22 hits the victim is forcibly ejected with invulnerability.

Plus two structural rules: **knockdown is invulnerable** (forcing a reset to
neutral, which is what creates the wake-up mix-up), and **Phase Break** lets any
player escape for a full energy bar.

Mechanism 4 is the guarantee; 1–3 exist so combos taper naturally and the cap is
rarely what the player notices.

## Ability framework

Modelled on GAS, reduced to what a fighting game needs. An ability is **pure
data plus a `kind` tag**; the Simulation interprets the tag. Abilities contain no
logic, so a designer can author a new special without touching system code.

Kinds: `Projectile`, `Rush`, `Strike`, `Barrage`, `Counter`, `AreaBlast`,
`Ultimate`.

**Ultimates** run a four-phase cinematic: windup → **capture test** → held
sequence → payoff → recovery. The capture test is the whole design: it happens
at 28% of the way through, and the window before it is the opponent's chance to
escape. That is what keeps "no unavoidable ultimate attacks" true. Missing the
capture still detonates, but for 28% damage — a real, felt loss.

## Character data structure

`CharacterData` is the contract that makes the roster expandable. It carries
health/energy/ascension values, a `MovementProfile`, a `DefenseProfile`, the
attack table, chain definitions, abilities, ultimate, transformation, and visual
and audio profiles.

**Adding a fighter is authoring one object.** No shared system may branch on a
character id — grep for `'kairo'` or `'veyron'` outside `characters/` and there
should be no gameplay hits.

## Animation architecture

No animation assets exist in this slice, so `FighterRig` generates every pose
procedurally from simulation state: attack phase, velocity, grounded-ness,
hitstun, guard, charge ratio.

This is not purely a cost saving. Because the pose derives from frame data, the
visual and the hitbox cannot drift apart — a common and expensive bug class in
animation-driven fighters. In a UE5 port these become montages, with the frame
data still authoritative and notifies driving the same phases.

## AI architecture

`FighterAI` is a **utility-scored** system, not a behaviour tree, because tactic
selection here is a continuous trade-off rather than a decision sequence.

Three properties the brief demands explicitly:

- **No input reading.** The AI never touches the opponent's `InputState`. It
  reads a ring buffer of *observable* state delayed by `reactionFrames`
  (7–22 by difficulty) — exactly what a human sees, exactly as late.
- **No repetition.** Every tactic carries decaying recency heat, so a tactic
  that just fired scores lower until it cools.
- **Pattern adaptation.** A rolling profile of the opponent's habits
  (blockiness, aggression, airiness, zoning) biases scores. A turtling player
  starts eating guard-breaks; a rushdown player starts eating counters.

It selects abilities **by kind, never by id**, so it drives any future fighter
unmodified. It also watches its own position and force-resets if it stops making
progress, satisfying the "recovers from losing navigation" requirement.

Difficulty scales *how quickly and how well it reacts to things a human could
also see* — never what it is allowed to know.

## UI architecture

DOM overlay, not in-world. The brief requires the UI to stay readable during
large VFX sequences, and a DOM layer composited above the canvas is physically
incapable of being washed out by additive bloom.

Layout follows fighting-game convention (opposed bars, centre timer) because
that convention is load-bearing — players read those positions peripherally.

Health bars use a delayed **chip layer** that drains behind the real bar, so
damage reads as an event rather than a number changing.

## Audio architecture

Everything is synthesised at runtime from oscillators and shaped noise. Nothing
is sampled or licensed, which makes the originality position unambiguous.

It also suits the genre: impact sounds are generated *per hit* with weight and
pitch derived from the attack's own damage and hitstop, so a jab and a charged
heavy differ audibly without anyone authoring two clips — and a new attack gets
a fitting sound for free. Character timbre is a pitch offset in `CharacterData`.

Bus structure mirrors a normal game setup: master → limiter → destination, with
sfx / impact / music submixes. The limiter is why overlapping ultimates cannot
clip.

## Save-data considerations

Nothing is persisted in this slice. When it is, the boundary is already clean:
`CharacterData` and `DifficultyProfile` are plain serialisable objects, and
nothing in the simulation holds a reference to a DOM node or a GPU resource.

Settings (shake intensity, volumes, difficulty) are the first candidates, and
already live in plain fields rather than being scattered through systems.

## Networking considerations

The simulation is already deterministic, fixed-timestep, input-driven and
free of wall-clock dependencies — which is the expensive precondition for
rollback netcode.

What remains: a `serialize()` / `restore()` pair on `Simulation` for confirmed
frames (all state is plain numbers, so this is mechanical), an input delay
buffer, and desync detection via state hashing. `Math.random()` is banned in
simulation code precisely to keep this door open.

Not attempted in this slice, because online play before the combat is proven is
the wrong order.

## Dependency map

```
core/Vec3, core/Rand          → no dependencies
core/Input, core/Events       → core/Vec3
gameplay/CombatTypes          → core/Vec3
gameplay/{Attributes, DamageModel, Ability, Projectile, Arena}
                              → core/*, CombatTypes
gameplay/{Movement, Combat, Defense}Component
                              → core/*, CombatTypes, CharacterData (types only)
gameplay/Fighter              → all gameplay components, CharacterData
gameplay/Simulation           → Fighter, Arena, Projectile, CharacterData
characters/{kairo, veyron}    → CombatTypes, Ability  (data only, no systems)
ai/FighterAI                  → Fighter (read-only), Ability, Difficulty
headless/{Match, cli}         → Simulation, FighterAI, characters
─────────────────── the line below is presentation ───────────────────
camera/CombatCamera           → Fighter (read-only), Arena
render/FighterRig             → three.js, Fighter (read-only)
arena/RuinsOfVeyra            → three.js, ArenaDef
vfx/VFXSystem                 → three.js, EventBus
audio/AudioSystem             → WebAudio only
ui/HUD                        → Simulation (read-only), DOM
main.ts                       → everything
```

**No arrow ever points upward across the presentation line.** That is the
invariant that keeps the game headlessly testable, and it is worth defending in
review.
