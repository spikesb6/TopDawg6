# Build It (phone app)

Guides people with little or no construction experience through building a home, from buying
the lot to the 11-month warranty walk, without skipping a step. Phone version of the web app in
`../index.html`.

## Stack
Expo SDK 57 (React Native) + TypeScript, Expo Router, AsyncStorage. No backend: the build is
saved on the phone and moved with backup codes.

## Look
Same as the web app. Tokens in `src/theme/theme.ts`: concrete background, graphite ink,
copper-patina accent, flagging-tape pink only for inspection hold points. Archivo (display),
IBM Plex Sans (body), IBM Plex Mono (figures). Copy is plain, short, sentence case.

## Rules
- Guidance lives in `../content.js` only. `src/data/content.json` is generated from it with
  `npm run gen:content`; a test checks they match. Never edit the JSON by hand.
- The saved state has the same shape as the web app's (`src/lib/state.ts`), and backup codes use
  the same encoding (`src/lib/backup.ts`), so codes move between them. Keep it that way.
- Checking a step warns when earlier steps are still open, and hold points ask for inspection
  notes. No step is ever hard-blocked: real builds overlap.
- Keep logic in plain tested functions in `src/lib/`, not in screens.
- Respect accessibility: labels on every control, touch targets at least 44 pt.

## Code map
- `src/lib/`: `progress` (phase stats, current phase, skipped steps), `budget` (all-in total,
  draws, cost split), `land` (lot verdict), `permits` (list from the profile), `payments`
  (waivers, retainage), `backup` (codes), `state` (types, defaults, example payments). Each has
  a test.
- `src/store/build-store.tsx`: the saved build. `src/store/toast-store.tsx`: short messages.
- `src/hooks/use-step-toggle.ts`: check a step and show the right warning.
- `src/app/(tabs)/`: My build (`index`), `roadmap`, `land`, `money`, `more`.
  `src/app/phase/[id].tsx`: a phase's steps (`?step=` opens one). Also `payments`,
  `payment-new`, `permits`, `team`, `built-to-last`, `project` (profile, backup, start over).
- `src/components/`: `ui.tsx` (shared pieces), `step-card`, `screen`, `tab-bar`, `wordmark`,
  `dim-line`, `icons`, `error-screen`.
- Icons come from `scripts/make-icons.py`. `ios/` and `android/` are generated, never committed.
- See AGENTS.md for Expo commands. Run `npx tsc --noEmit`, `npx expo lint` and `npm test` before
  finishing.
