# Build It (phone app)

The Build It guide as an iPhone and Android app: an Expo (React Native + TypeScript) app that
walks a first-time builder from an empty lot to keys in hand. Same guidance, budget, land check,
permits and payment log as the web app in `../index.html`.

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

## Your data

Everything is saved on the phone first, so the app works with no signal on a job site.

- **Photos:** open any step and tap *Take photo* or *Choose photo*. Hold points (inspections) ask
  for a photo, like rebar before a pour or walls before drywall.
- **Account (optional):** under **More → Account**, sign in with your email and a 6-digit code.
  Your build and photos then back up and sync with your other phones and the Build It web app.
  Accounts need a one-time Supabase setup: see [`supabase/README.md`](supabase/README.md). Without
  it, sign-in is hidden and everything stays on the phone.
- **Backup codes:** on **More → About your project**, *Share backup code* sends a code you can keep
  and *Restore from a code* brings a build back. Codes work between the phone app and the web app.
  They carry everything except the photo files.

## Changing the guidance

All steps, land checks, permits and contract terms live in `../content.js`, shared with the web
app. After editing it, run `npm run gen:content` to rebuild `src/data/content.json`. A test
fails if you forget.

## Building for the stores

`eas.json` has `preview` (internal test builds, Android APK) and `production` profiles. With an
[Expo account](https://expo.dev):

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform all
```

Change `bundleIdentifier` and `package` in `app.json` to your own before a store release.

## Checks

```bash
npx tsc --noEmit
npx expo lint
npm test
npm run test:functions   # the delete-account Edge Function (Deno)
```

The database rules have their own test, `supabase/tests/rls.test.sql`; see `supabase/README.md`.
