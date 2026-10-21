# Top Dawg Ops

A solo, browser-based 3D shooter. The gunplay is modeled on Call of Duty: fast time-to-kill, snappy aim-down-sights, sprint, slide, hitmarkers and kill streaks. The progression borrows from Battlefield: loot, attachments and tiered challenges. You defend a walled compound against waves of AI soldiers, and your guns get stronger from kill streaks and from the gear you find.

Open `index.html` in a desktop browser (Chrome, Edge or Firefox). There is no build step. Three.js r149 is vendored in `vendor/`. Click **Deploy** to capture the mouse, and press Esc to pause.

## Controls

| Key | Action |
| --- | --- |
| WASD, mouse | Move, look |
| Left / right mouse | Fire / aim down sights |
| Shift | Sprint |
| C | Crouch (slide while sprinting) |
| Space | Jump (cancels a slide) |
| R | Reload |
| 1, 2, Q, wheel | Switch weapon |
| V | Melee |
| G | Frag grenade |
| F | Armor plate (hold to chain) |
| E | Pick up gear, hold to open crates |
| 3–7 | Kill streak rewards |
| Tab | Inventory (swap attachments mid-run) |
| Enter | Skip the break between waves |

## How guns get better

- **Field Upgrades (kill streaks).** Every 5 kills in a streak you pick 1 of 3 upgrades for the gun you're holding, such as damage, fire rate, magazine size, recoil, Vampire Rounds or Explosive Tips. Upgrades roll a rarity and stay on that gun for the rest of the run.
- **Kill streak rewards.** At 3, 6, 9, 13 and 18 kills you earn UAV, Precision Airstrike, Sentry Gun, Overdrive and Hellstorm. Kills from these rewards don't extend your streak. Going down resets the streak, and a longer streak also raises loot luck.
- **Loot.** Enemies, supply crates, the supply drop after each wave, HVT Commanders and Juggernauts drop attachments and weapons in five rarities, from Common to Legendary. Higher rarity means bigger bonuses and smaller drawbacks. There are 6 attachment slots and 23 attachments, and they show up on the gun model.
- **Persistence.** Every attachment you pick up goes into your Armory at the end of a run. Finding a gun unlocks that weapon and its rarity blueprint. Salvage upgrades the rarity of attachments and weapons. Weapon kills raise mastery, which adds damage, and unlock camos.
- **Challenges.** Tiered goals (Close Quarters, Hold the Line, Long Shot and others) unlock the LMG, DMR, shotgun and sniper rifle, and pay out XP, Salvage and gear. Each wave also offers an optional contract that drops a loot cache when you finish it.

Progress is saved in `localStorage`, under the key `topdawg_ops_save_v1`.

## Code layout

| File | Contents |
| --- | --- |
| `js/data.js` | Weapons, attachments, rarities, enemies, streaks, upgrades, contracts, challenges |
| `js/save.js` | Persistent progression |
| `js/world.js` | Map, textures, colliders, ray casts, enemy navigation flow field |
| `js/player.js` | Input, movement, shooting, recoil, viewmodel animation |
| `js/weapons.js` | Stat calculation and procedural gun models |
| `js/enemies.js` | Enemy models and AI |
| `js/loot.js` | Drops, crates and pickups |
| `js/hud.js` | HUD, minimap and menus |
| `js/game.js` | Main loop, waves, streaks, explosives and run lifecycle |

Opening `index.html?test` exposes `window.TD` with a `step(frames)` function, which advances the simulation without rendering for automated tests.
