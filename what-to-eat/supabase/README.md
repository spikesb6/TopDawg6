# Connecting Supabase

Until these steps are done the app runs in guest mode: everything is saved on the phone and
the sign-in options are hidden.

## 1. Create the project and tables

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste all of `migrations/20261013000000_init.sql`, and run it.
3. Paste all of `seed.sql` and run it. This adds the 28 ideas with the same ids the app uses.
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

## 6. Try it on two phones

1. Phone 1: heart an idea and lock one in. A sheet offers sign-in after the first heart.
2. Sign in. Your guest faves and picks are copied to your account.
3. Phone 2: open the app, go to Faves, tap **Sign in** with the same account. The same faves
   and past picks show up.
