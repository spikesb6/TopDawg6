# KAIRO: ASCENSION — Game Vision

## Core fantasy

You are the last of a people who no longer exist, and the only thing you
inherited is the power that got them killed.

The fantasy is not "be the strongest". It is the specific feeling of a fight
that keeps escalating past the point where it should have ended — where the
ground stops mattering, where the arena starts breaking, and where both fighters
keep finding another gear. The player should finish a match slightly out of
breath.

Mechanically that means: you are always allowed to close distance. Every retreat
can be answered, every launch can be chased, and no exchange ends because
someone walked away.

## Target audience

Players who love the spectacle of anime combat but want it to hold up as a
fighting game. People who will notice that a jab is 5 frames and a heavy is 12,
and who want that difference to be legible without reading a frame table.

Secondary: players who mainly want to feel powerful. They are served by
generous input buffering, a forgiving lock-on, and the fact that every defensive
option is one button.

## Pillars

1. **Nothing is out of reach.** Distance is a temporary condition. Flight,
   boost, dash and the pursuit dash exist so the answer to "they got away" is
   always an input, never a wait.

2. **Weight is earned, not asserted.** Impact comes from hitstop, knockback and
   camera trauma that scale with the attack, not from louder effects. A jab
   should feel like a jab.

3. **Every defence has a cost and a window.** Guard drains a meter. Perfect
   guard is 6 frames. Dodge has i-frames on the front only. Phase Break costs a
   full bar. The player can always answer pressure, and never for free.

4. **You can always tell what happened.** Colour separates the fighters, frame
   data drives the poses, and the HUD is DOM-composited so no ultimate can wash
   it out. Losing should never feel confusing.

5. **The spectacle serves the read.** Transformations and ultimates are the
   loudest moments in the game and are still bound by the same rules: the
   ultimate has a visible, escapable capture window; the transformation always
   expires.

## Original universe

**Planet Veyra** drew its power from celestial energy running through the
planet's core — a current its people learned to channel rather than mine.

**Lord Veyron** came looking for the **Celestial Core**, the concentration at
the planet's heart, capable of reshaping star systems. When Veyra's people would
not surrender it, he unmade the world to take it.

**Kairo** was launched off-world as an infant in the minutes before the planet
broke. He grew up not knowing what he was, only that something in him answered
to nothing he could name.

Years later, that fragment of the Celestial Core woke up. Veyron felt it happen
from across the void, and came to finish what he started.

The vertical slice is the moment they meet: one duel, in the ruins of the world
Veyron destroyed, standing on the evidence of what he is.

### Terminology

| Term | Meaning |
| --- | --- |
| **Celestial Force** | Kairo's energy. Warm violet edged in gold. |
| **Void Dominion** | Veyron's energy. Cold teal fracture-light over black. |
| **The Celestial Core** | The energy source at Veyra's heart. Kairo carries a fragment. |
| **Ascension** | The threshold where a fighter's energy briefly overtakes their body. |
| **Celestial Surge** | Kairo's ascension: faster, sharper, more fragile. |
| **Tyrant Unbound** | Veyron's ascension: armoured, heavier, harder to stop. |
| **Phase Break** | Burning a full bar to tear out of a combo. |
| **The Veyra Barrier** | The energy wall containing the arena. |

## Character identities

### KAIRO — the last celestial warrior

Fast, aggressive, mobile, adaptable. The fastest startup in the game (5-frame
jab), a four-link ground chain, the highest mobility ceiling, and the lowest
health pool with no innate armor.

Kairo's game is *tempo*. He wins by being somewhere before Veyron expects him
and by turning every knockdown into another approach. He loses by getting
predictable, because a single armored heavy erases everything he built.

Abilities: Celestial Bolt · Nova Rush · Ascension Breaker · Starfall Barrage ·
Celestial Surge · **Final Horizon**.

### LORD VEYRON — the armored warlord

Powerful, deliberate, armored, long-reaching. Slower startup everywhere, far
greater reach and damage, super armor on his heavy and specials, the largest
health pool and guard meter, and the worst mobility in the game.

Veyron's game is *space*. He wins by making a region of the arena unprofitable
and punishing anyone who enters it. His answer to pressure is Rift Counter, not
footwork — he does not evade, he makes you regret committing.

Abilities: Void Spear · Dominion Crush · Rift Counter · Black Star Detonation ·
Tyrant Unbound · **End of Worlds**.

The matchup is deliberately a clean triangle: Kairo beats patience, Veyron beats
recklessness, and both lose to their own repetition.

## Visual direction

Dark, high-contrast, and built around **hue separation as a gameplay system**.

- **Kairo** is warm: violet core, gold edge. Narrow silhouette, tall swept crest,
  reads as *motion*.
- **Veyron** is cold: teal fracture-light, black warplate. Broad wedge silhouette
  with swept horns, reads as *mass*.

The two energy colours are over 90° apart in hue — enforced by a test — so at
any moment during a chaotic exchange the player can tell whose energy is on
screen. Transformations shift hue rather than just brightening (violet → gold,
teal → white-cyan), so an ascended fighter is unmistakable at a glance.

The arena is deliberately desaturated so the fighters own every saturated pixel.

**The Ruins of Veyra**: a shattered plateau under a dying sky. The planet's core
light bleeds up through fractures in the rock. Snapped monoliths that once
channelled celestial energy stand dark. On the horizon hangs the debris field of
the world itself — the thing they are fighting about, visible from the fight.

## Combat philosophy

**Readable first, fast second, spectacular third.** In that order, always.
When an effect and a read conflict, the read wins.

**Structural safety over careful tuning.** The rules that prevent infinite
combos and stunlock are enforced by four independent mechanisms, so no future
attack — no matter how it is tuned — can reintroduce them. Designers should be
free to author aggressive frame data without being able to break the game.

**Defence is interesting, not mandatory.** Blocking is never the correct default
because the guard meter breaks. Turtling loses to Dominion Crush; mashing loses
to Rift Counter.

**The AI plays the same game you do.** It reads only delayed, observable state —
never inputs — and presses the same buttons through the same buffer. When it
beats you, it beat you.

## Long-term roadmap

**Now (vertical slice)** — Kairo vs Veyron, one arena, full combat loop,
transformations, ultimates, AI, four difficulty tiers.

**Next**
- Local versus (the architecture already supports two human controllers; only
  input routing and a split HUD are missing).
- Training mode — frame data display, hitbox visualisation, recording dummy.
  The deterministic simulation makes this nearly free.
- Two more fighters, exercising the data-driven roster claim. A zoner and a
  grappler would stress the AI's ability-by-kind selection hardest.

**Later**
- Story battles through Veyra's fall, with win conditions beyond a health bar.
- A second arena with different vertical space, to prove the arena is data.
- Rollback netcode. The simulation is already deterministic, fixed-timestep and
  input-driven, which is the hard 80% of that work.

**Explicitly not planned**: a large roster before the combat is proven, cosmetic
monetisation, or any system that dilutes the one-on-one duel.
