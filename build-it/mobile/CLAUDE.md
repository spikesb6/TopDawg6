# Build It (phone app)

Guides people with little or no construction experience through building a home, from buying
the lot to the 11-month warranty walk, without skipping a step. Phone version of the web app in
`../index.html`.

## Stack
Expo SDK 57 (React Native) + TypeScript, Expo Router, AsyncStorage, expo-image-picker and
expo-file-system for photos, Supabase (Postgres, Auth with email codes, Storage) for optional
accounts and sync. Without `.env` keys the app runs local-only and hides sign-in.

## Look
Same as the web app. Tokens in `src/theme/theme.ts`: concrete background, graphite ink,
copper-patina accent, flagging-tape pink only for inspection hold points. Archivo (display),
IBM Plex Sans (body), IBM Plex Mono (figures). Copy is plain, short, sentence case.

## Rules
- Guidance lives in `../content.js` only. `src/data/content.json` is generated from it with
  `npm run gen:content`; a test checks they match. Never edit the JSON by hand.
- The saved state has the same shape as the web app's (`src/lib/state.ts`), and backup codes use
  the same encoding (`src/lib/backup.ts`), so codes move between them. Keep it that way.
- The phone is the source of truth: every change is saved locally first, then synced. Never make a
  screen wait on the network.
- Sync rules live in `src/lib/sync.ts` and are copied in `../sync.js` for the web app; the
  `sync-web` test runs both on the same cases. Change them together.
- Checking a step warns when earlier steps are still open, and hold points ask for inspection
  notes. No step is ever hard-blocked: real builds overlap.
- Keep logic in plain tested functions in `src/lib/`, not in screens.
- Respect accessibility: labels on every control, touch targets at least 44 pt.

## Code map
- `src/lib/`: `progress` (phase stats, current phase, skipped steps), `budget` (all-in total,
  draws, cost split), `land` (lot verdict), `permits` (list from the profile), `payments`
  (waivers, retainage), `backup` (codes), `state` (types, defaults, example payments), `photos`
  (photo list helpers, storage paths), `sync` (plan a sync, merge two builds). Each has a test.
  Not pure: `photo-files` (files on the phone), `supabase` (client), `remote` (sign-in, saved
  build, photo storage, account deletion), `secure-storage` (session in SecureStore).
- `src/store/build-store.tsx`: the saved build plus sync state (`dirty`, `version`).
  `src/store/account-store.tsx`: sign-in and the sync engine (on sign-in, on foreground, 2 s after
  a change; uploads photos). Tested as two phones in `account-store.test.tsx`.
  `src/store/toast-store.tsx`: short messages.
- `src/hooks/use-photo-actions.ts` (take, choose, delete) and `use-photo-uri.ts` (local file, or
  download once from the account).
- `src/hooks/use-step-toggle.ts`: check a step and show the right warning.
- `src/app/(tabs)/`: My build (`index`), `roadmap`, `land`, `money`, `more`.
  `src/app/phase/[id].tsx`: a phase's steps (`?step=` opens one). Also `payments`,
  `payment-new`, `permits`, `team`, `built-to-last`, `project` (profile, backup, start over),
  `account` (email code sign-in, sync status, sign out, delete account), `photo` (viewer).
- `src/components/`: `ui.tsx` (shared pieces), `step-card`, `photo-strip`, `screen`, `tab-bar`,
  `wordmark`, `dim-line`, `icons`, `error-screen`.
- `supabase/`: migration (builds table, photos bucket, RLS, version rule), `tests/rls.test.sql`,
  `functions/delete-account` (handler tested with Deno), setup steps in `supabase/README.md`.
- Icons come from `scripts/make-icons.py`. `ios/` and `android/` are generated, never committed.
- See AGENTS.md for Expo commands. Run `npx tsc --noEmit`, `npx expo lint`, `npm test` and
  `npm run test:functions` before finishing.
