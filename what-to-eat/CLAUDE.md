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

## Phases (stop and show a working result after each)
1. Foundation (project, theme, fonts, tabs, wordmark, Home)
2. Prototype port (all screens, 28 seed ideas, local storage)
3. Backend (Supabase tables, RLS, guest mode, Apple and Google sign-in)
4. Real places (Fast food and Dine out near the user)
5. Cook it recipes and grocery list, Delivery deep links
6. Polish, analytics, crash reporting, TestFlight and Play internal testing

## Code map
- `src/theme/theme.ts`: color tokens, light and dark palettes, fonts, radii.
- `src/components/wordmark.tsx`: the crooked wordmark (`scale` prop for smaller uses).
- `src/components/tab-bar.tsx`: custom bottom tabs (Home, Faves, Past picks).
- `src/app/`: routes. `index` is Home, `faves` and `past` are the other tabs.
- See AGENTS.md for Expo commands. Run `npx tsc --noEmit` and `npx expo lint` before finishing.
