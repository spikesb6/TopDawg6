# What to eat?

Dinner, decided. No stress. An Expo (React Native + TypeScript) app that picks dinner in one tap.

See `CLAUDE.md` for the look, rules and build phases, and `reference/` for the brief and prototype.

## Run it on your phone

1. Install [Node.js](https://nodejs.org) 20 or newer on your computer.
2. Install **Expo Go** on your phone (App Store or Google Play).
3. In this folder:

   ```bash
   npm install
   npx expo start
   ```

4. Scan the QR code: on iPhone with the Camera app, on Android from inside Expo Go.
   Your phone and computer need to be on the same Wi-Fi. If they can't see each other,
   use `npx expo start --tunnel`.

Switch your phone to dark mode to see the dark theme.

## Accounts and sync

Without setup the app runs in guest mode and saves everything on the phone. To turn on
sign-in, sync across phones, and real nearby places for Fast food and Dine out, follow
[`supabase/README.md`](supabase/README.md).

## Checks

```bash
npx tsc --noEmit
npx expo lint
npm test
npm run test:functions   # Edge Function tests (Deno)
```
