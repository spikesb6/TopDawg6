# What to eat?

Mobile app that ends the nightly dinner debate: one fun tap gives one dinner
idea (Cook it, Fast food, Dine out, Delivery).

## Source of truth
reference/prototype.html is a working prototype. Match its colors, copy,
layout, and behavior unless told otherwise.

Until prototype.html is added, reference/prototype-home.pdf (a print of the
prototype's Home screen) and reference/build-brief.pdf are the references.
The print drops background fills, so tile and button colors come from the
tokens below.

## Stack
Expo (React Native) + TypeScript, Expo Router, Reanimated, Supabase
(Postgres, Auth, RLS), Google Places API (New) via a Supabase Edge Function,
TanStack Query, EAS Build.

## Look
- Colors: cream #FFF4DC, ink #2B1B3D, tomato #FF4D3D, grape #7B4DFF, mint
#14B38A, sunny #FFC93C, coral #FF8A7A, lavender #B9A2FF, seafoam #6FE0BF.
Dark background #1D1230.
- Fonts: Fredoka for headings and buttons, Nunito for body.
- Wordmark is always crooked: What (-7 deg), to (6 deg, smaller), eat? (-3
deg, largest).
- Thick 3px ink borders on main buttons, rounded corners, tiles slightly
rotated.
- Copy is short, warm, sentence case.

## Rules
- Surprise me skips anything locked in during the last 7 days.
- Spin again never repeats the current idea.
- Only the Let's eat this button writes to Past picks.
- Keep logic (pick, filter, 7-day rule) in plain tested functions, not in
screens.
- Never put API keys in the app. Google calls go through the Edge Function.
- Respect reduce-motion and add accessibility labels on every control.
- Touch targets are at least 44 pt (use `linkHitSlop` for small text links).
- New user actions get an event in `src/lib/analytics.ts`: ids and choices only, never
  names, emails, places or location.

## Phases (stop and show a working result after each)
1. Foundation (project, theme, fonts, tabs, wordmark, Home)
2. Prototype port (all screens, 28 seed ideas, local storage)
3. Backend (Supabase tables, RLS, guest mode, Apple and Google sign-in)
4. Real places (Fast food and Dine out near the user)
5. Cook it recipes and grocery list, Delivery deep links
6. Polish, analytics, crash reporting, TestFlight and Play internal testing

## Code map
- `src/theme/theme.ts`: color tokens, light and dark palettes, fonts, radii.
- `src/data/seed-ideas.json`: the 28 seed ideas (placeholder set until prototype.html is added).
  `supabase/seed.sql` is generated from it with `npm run gen:seed`; a test checks they match.
  `src/data/ideas.ts`: idea types, moods, budgets. `src/data/modes.ts`: the four modes.
- `src/lib/picker.ts`: filters, Surprise me pool (7-day rule), spin picking, relative days,
  faves and picks for ideas and places.
- `src/lib/grocery.ts`: grocery list (add a recipe once, check, clear, share text).
  `src/lib/delivery.ts`: DoorDash, Uber Eats and Grubhub search links. Both pure and tested.
- `src/lib/places.ts`: place moods from Google cuisine types, place filters, distance labels,
  directions links (pure, tested).
- `src/lib/analytics.ts`: PostHog events (typed list; ids and choices only, never names, emails
  or location). `src/lib/monitoring.ts`: Sentry. Both no-ops without their keys.
- `src/lib/sync.ts`: Supabase row mapping and guest-to-account upload rows (pure, tested).
- `src/lib/supabase.ts`: client; `backendConfigured` is false until `.env` has the keys, and the
  app then stays in guest mode. `src/lib/auth.ts`: Apple and Google sign-in.
  `src/lib/remote.ts`: queries, including `fetchPlaces` (calls the `places` Edge Function).
  `src/lib/secure-storage.ts`: session storage in SecureStore.
- `src/store/dinner-store.tsx`: ideas, faves and picks. Guests keep them in AsyncStorage; after
  sign-in they're uploaded once, then read from Supabase with TanStack Query. Tested as two
  phones in `dinner-store.test.tsx`. `src/store/location-store.tsx`: location permission and the
  typed-city fallback. `src/store/grocery-store.tsx`: grocery list, on this phone only.
  `src/hooks/use-places.ts`: nearby open-now places for a mode.
- `src/app/(tabs)/`: Home (`index`), `faves`, `past`. `src/app/mode/[mode].tsx`: mode list.
  `src/app/result.tsx`: idea result card. `src/app/place.tsx`: place card with Get directions.
  Both use `useSpin` and `components/result-parts.tsx`. `src/app/recipe.tsx`: ingredients,
  steps and Add to grocery list. `src/app/grocery.tsx`: the list (Home shows a shortcut once
  it has items).
- `src/components/`: wordmark, tab bar, header, chips, idea rows, bouncy buttons, icons,
  sign-in sheet (offered after the first fave), account card on Faves (sign out, delete account),
  error screen (root `ErrorBoundary`), nearby places list with
  the location ask and city form, delivery buttons.
- `supabase/`: migrations (tables + RLS), seed, `tests/rls.test.sql`, setup steps in README.
  `supabase/functions/places/`: Edge Function for Google Places. `logic.ts` (pure) and
  `handler.ts` are tested with Deno (`npm run test:functions`); `index.ts` wires in the secret
  key and the `places_cache` table. `supabase/functions/delete-account/`: deletes the caller's
  own account (App Store rule), same handler/index split and tests. `_shared/http.ts`: CORS + JSON.
- Release: `eas.json` (development / preview / production), `app.config.js` (Sentry plugin from
  env), `RELEASE.md`, `TESTING.md`, `STORE.md`, `PRIVACY.md`. Icons come from
  `scripts/make-icons.py`. `ios/` and `android/` are generated, never committed.
- See AGENTS.md for Expo commands. Run `npx tsc --noEmit`, `npx expo lint`, `npm test` and
  `npm run test:functions` before finishing.
