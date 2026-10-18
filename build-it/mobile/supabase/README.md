# Switching on accounts (Supabase)

Until these steps are done, Build It keeps everything on the phone (or in the browser) and hides
sign-in. Nothing breaks without them. One Supabase project serves both the phone app and the web app.

## 1. Create the project and tables

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste all of `migrations/20261018000000_builds.sql` and run it. This adds the
   `builds` table (one saved build per person) and a private `photos` storage bucket, each
   locked so people can only reach their own.
3. Optional check: paste `tests/rls.test.sql` and run it. The last result should say
   `rls tests passed`. It runs inside a transaction and leaves nothing behind.

With the Supabase CLI instead: `supabase link --project-ref <ref>`, then `supabase db push`.

## 2. Send a 6-digit code instead of a link

Build It signs people in with a code they type into the app, which works on any phone with no extra
setup.

1. Open **Authentication > Emails > Templates > Magic Link**.
2. Replace the body with something like:

   ```html
   <h2>Your Build It code</h2>
   <p>Enter this code in Build It to sign in: <strong>{{ .Token }}</strong></p>
   <p>It expires in an hour. If you didn't ask for it, ignore this email.</p>
   ```

3. Do the same for **Confirm signup**, so first-time sign-ins get a code too.
4. Supabase's built-in email sender is limited to a few emails an hour and is meant for testing.
   Before inviting real users, connect your own email provider under
   **Authentication > Emails > SMTP Settings** (for example Resend, Postmark or Amazon SES).

## 3. Put the keys in the apps

In Supabase open **Project Settings > API** and copy the **Project URL** and the
**anon / publishable** key. Never use the `service_role` key in either app.

- **Phone app:** copy `.env.example` to `.env` in `build-it/mobile` and fill both in. Restart
  `npx expo start`. For store builds, add the same two values with `npx eas-cli env:create`.
- **Web app:** fill the same two values into `build-it/config.js`.

The anon key is designed to ship inside apps. Row Level Security makes sure each person can only
read and change their own build and photos.

## 4. Let people delete their account

Apple requires apps with sign-in to offer account deletion. Build It has it under
More > Account (and on the web app's My build tab). It calls a small Edge Function you deploy once:

```bash
supabase link --project-ref <your-project-ref>
supabase functions deploy delete-account
```

It only ever deletes the signed-in person who called it: first their photos, then their account,
which takes their saved build with it.

## 5. Try it

1. Phone 1: check a few steps and add a photo to a hold point. Go to **More > Account**, enter your
   email, then the code from the email. The status says **Up to date**.
2. Phone 2 (or the web app): sign in with the same email. The same steps, notes and payments show
   up, and the photo downloads when you open that step.
3. Change something on each device. Both changes end up on both: Build It merges them rather than
   keeping only one.

## How sync works

- Each account has one saved build with a version number. Every save raises it by exactly one (a
  database rule enforces this), so a device can tell when another device saved since it last
  looked.
- A device saves about 2 seconds after a change, and checks for news when the app opens or comes
  back to the front.
- If two devices changed things before either saved, the build is merged: checked steps, notes,
  payments and photos from both are kept, and where both changed the same thing, the device saving
  last wins.
- Photos upload to `photos/<user id>/<photo id>.jpg` and download on other phones the first time
  they're opened. Backup codes carry the photo list but not the photo files.
