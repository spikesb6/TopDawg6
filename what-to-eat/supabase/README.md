# Connecting Supabase

Until these steps are done the app runs in guest mode: everything is saved on the phone and
the sign-in options are hidden.

## 1. Create the project and tables

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run each file in `migrations/`, oldest first:
   `20261013000000_init.sql`, `20261014000000_places.sql`, then `20261015000000_recipes.sql`.
3. Paste all of `seed.sql` and run it. This adds the 28 ideas (with Cook it recipes) using the
   same ids as the app. It's safe to run again after the seed changes.
4. Optional check: paste `tests/rls.test.sql` and run it. The last result should say
   `rls tests passed`. It runs inside a transaction and leaves nothing behind.

With the Supabase CLI instead: `supabase link --project-ref <ref>`, `supabase db push`, then run
`seed.sql` against the database.

## 2. Put the keys in the app

1. In Supabase open **Project Settings > API**.
2. Copy `.env.example` to `.env` in the `what-to-eat` folder and fill in the **Project URL** and
   the **anon / publishable** key. Never use the `service_role` key in the app.
3. Restart `npx expo start` so the new values load.

The anon key is designed to ship inside apps. Row Level Security makes sure each person can
only read and change their own faves and picks.

## 3. Turn on Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an
   **OAuth client ID** of type **Web application**.
2. Under **Authorized redirect URIs** add `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase open **Authentication > Providers > Google**, turn it on, and paste the client ID
   and secret.

## 4. Turn on Sign in with Apple (iPhone)

Needs an Apple Developer account.

1. In Supabase open **Authentication > Providers > Apple** and turn it on.
2. Under **Client IDs** add `com.whattoeat.app` (the app's bundle id). While testing in Expo Go,
   also add `host.exp.Exponent`.
3. Sign in with Apple on the web needs a Services ID and key from Apple as well. The phone app
   doesn't.

## 5. Allow the app to come back after sign-in

In Supabase open **Authentication > URL Configuration** and add these **Redirect URLs**:

- `whattoeat://**` for the real app
- `exp://**` while testing in Expo Go

## 5b. Let people delete their account

Apple requires apps with sign-in to offer account deletion. The app has it under
Faves > Delete account; it calls a small Edge Function that you deploy once:

```bash
supabase link --project-ref <your-project-ref>
supabase functions deploy delete-account
```

It only ever deletes the signed-in person who called it. Their faves, picks and profile go
with the account.

## 6. Try it on two phones

1. Phone 1: heart an idea and lock one in. A sheet offers sign-in after the first heart.
2. Sign in. Your guest faves and picks are copied to your account.
3. Phone 2: open the app, go to Faves, tap **Sign in** with the same account. The same faves
   and past picks show up.

## 7. Real places for Fast food and Dine out

Without this, Fast food and Dine out ask for your location and then say "Couldn't load places".

1. In [Google Cloud Console](https://console.cloud.google.com) pick a project with billing on, open
   **APIs & Services > Library**, and enable **Places API (New)**.
2. Under **APIs & Services > Credentials** create an **API key**. Under **API restrictions**
   choose **Restrict key** and tick only **Places API (New)**. Leave application restrictions
   off: the key is only ever used from Supabase's servers.
3. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from the
   `what-to-eat` folder:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase secrets set GOOGLE_PLACES_API_KEY=<the key from step 2>
   supabase functions deploy places
   ```

4. Open Fast food on your phone, tap **Use my location**, and allow it. You should see places
   near you that are open right now. Tap **Type a city instead** to try another city.

The key lives only in Supabase secrets, never in the app or the repo. Results are cached for
15 minutes per area (about 100 m) or city in the `places_cache` table, which the app itself
can't read, so repeat visits don't cost another Google call.

