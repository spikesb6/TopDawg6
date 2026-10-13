# Releasing What to eat?

How to get the app onto TestFlight (iPhone) and Google Play internal testing (Android).
Everything below runs from the `what-to-eat` folder on your computer. You never need Xcode or
Android Studio: EAS builds in the cloud.

## 0. Before anything else: pick the app id

The app id is currently `com.whattoeat.app`. App ids are permanent once an app is in a store,
and this one may already be taken. Pick your own, for example `com.yourname.whattoeat`, and
put it in `app.json` in both places:

- `expo.ios.bundleIdentifier`
- `expo.android.package`

Then use the same id as the Apple client id in Supabase (step 4 in `supabase/README.md`).

## 1. Accounts you need

| Account | Cost | Used for |
| --- | --- | --- |
| [Expo](https://expo.dev/signup) | Free tier is enough | EAS Build and Submit |
| [Apple Developer Program](https://developer.apple.com/programs/) | $99 / year | TestFlight and the App Store |
| [Google Play Console](https://play.google.com/console/signup) | $25 once | Internal testing and Google Play |
| [Sentry](https://sentry.io/signup/) | Free tier | Crash reports |
| [PostHog](https://posthog.com/signup) | Free tier | Which modes people use |

Supabase and Google Places are covered in `supabase/README.md`.

## 2. Link the project to Expo

```bash
npx eas-cli@latest login
npx eas-cli@latest init        # adds your EAS project id to app.json
```

## 3. Give EAS the app's settings

Builds don't read your local `.env`. Add each value to EAS for the `preview` and `production`
environments (repeat with `--environment preview`):

```bash
npx eas-cli env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
npx eas-cli env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
npx eas-cli env:create --environment production --visibility plaintext --name EXPO_PUBLIC_POSTHOG_KEY --value <posthog project key>
npx eas-cli env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SENTRY_DSN --value <sentry dsn>
```

All four are public client keys, designed to ship inside apps. The Google Places key is not
here: it lives only in Supabase secrets.

### Readable crash reports (optional but recommended)

So Sentry shows your real code instead of minified lines, let builds upload source maps:

```bash
npx eas-cli env:create --environment production --visibility plaintext --name SENTRY_ORG --value <your sentry org slug>
npx eas-cli env:create --environment production --visibility plaintext --name SENTRY_PROJECT --value what-to-eat
npx eas-cli env:create --environment production --visibility secret --name SENTRY_AUTH_TOKEN --value <token from Sentry > Settings > Auth Tokens>
```

Then in `eas.json` delete the `"SENTRY_DISABLE_AUTO_UPLOAD": "true"` line. It's there so builds
work before Sentry is set up.

## 4. Deploy the server pieces

```bash
supabase link --project-ref <ref>
supabase db push                      # or run the files in supabase/migrations in the SQL Editor
supabase secrets set GOOGLE_PLACES_API_KEY=<key>
supabase functions deploy places
supabase functions deploy delete-account
```

Then run `supabase/seed.sql` in the SQL Editor (safe to repeat).

## 5. iPhone: TestFlight

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

The first build asks you to sign in with your Apple ID; EAS creates the certificates and the App
Store Connect app for you. After submit, the build appears in
[App Store Connect](https://appstoreconnect.apple.com) under **TestFlight** in about 15 minutes.

- **Internal testers** (up to 100 people on your App Store Connect team): add them under
  TestFlight > Internal Testing. No review needed.
- **External testers** (anyone with an email or a public link): create a group under External
  Testing. The first build goes through a short beta review (usually under a day).

## 6. Android: Google Play internal testing

1. In [Play Console](https://play.google.com/console) create the app (name "What to eat?",
   free, app).
2. Build: `npx eas-cli build --platform android --profile production`
3. Google requires the **first** upload to be done by hand: download the `.aab` from the EAS
   build page, then in Play Console go to **Testing > Internal testing > Create new release** and
   upload it.
4. Add testers under **Internal testing > Testers** (an email list), save, and share the opt-in
   link with them.
5. For later builds, set up a Google service account key once
   ([EAS guide](https://docs.expo.dev/submit/android/)) and then just run
   `npx eas-cli submit --platform android --latest`. `eas.json` already sends builds to the
   internal track as drafts.

## 7. Quick installs without the stores (optional)

`npx eas-cli build --profile preview --platform android` gives an `.apk` link anyone can
install. For iPhone, register test devices first with `npx eas-cli device:create`, then build
the `preview` profile.

`--profile development` builds a development app you can point at `npx expo start`, with every
native feature (Sentry, sign-in) working, unlike Expo Go.

## 8. Every new version

Builds number themselves (`autoIncrement` with versions stored on EAS). Bump `expo.version` in
`app.json` (for example `1.0.1`) when testers should see a new version name, then build and
submit again.

## Before the public store launch (not needed for testing)

- A public **privacy policy URL**. A draft is in `PRIVACY.md`.
- The store listing, screenshots and privacy answers. Drafts are in `STORE.md`.
- The app already meets two App Store rules that often block launches: it offers
  **Sign in with Apple** next to Google sign-in, and people can **delete their account** in the
  app (Faves > Delete account).
