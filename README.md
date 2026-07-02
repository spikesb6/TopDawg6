# AgentMatch

A Zillow-style marketplace MVP that matches homeowners who are thinking about
selling with the best-fit local real estate agents — scored on real
performance data instead of advertising spend.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui-style components · Supabase

## Quick start (zero config)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Supabase keys configured, the app runs
against an **in-memory mock database** pre-seeded with 8 agents, 5 sellers,
and generated matches — every flow works out of the box.

### Demo accounts (mock auth)

Sign in at `/login` with any seed email:

| Role   | Email                        | What you'll see                              |
| ------ | ---------------------------- | -------------------------------------------- |
| Seller | `karen.mitchell@example.com` | Seller dashboard + top-3 agent matches       |
| Seller | `luis.herrera@example.com`   | Urgent as-is seller, investor-fit matches    |
| Agent  | `maria.vasquez@example.com`  | Luxury agent with hot central-Austin leads   |
| Agent  | `priya.raman@example.com`    | Investor/fixer agent with east-side leads    |

Or just submit the intake form at `/sell` — you'll be redirected straight to
your ranked matches and signed in as that seller.

## Core workflow

1. **Homeowner** submits a property/seller profile at `/sell`.
2. The app computes a **seller intent score** (timeline + reason + goal) and
   scores every agent 0–100 with the matching algorithm.
3. **Agents** create profiles with performance data at `/agents/signup`.
4. Homeowner sees a **ranked top-3 shortlist** at `/matches/[sellerId]` with
   plain-English match reasons, stats, and contact/interview buttons.
5. Agents see **qualified leads** in their ZIP codes at `/dashboard/agent`
   and track them through a pipeline: new → contacted → appointment set →
   won/lost.
6. `/admin` shows marketplace totals and recent activity.

## Pages

| Route                 | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `/`                   | Landing page                                   |
| `/sell`               | Homeowner intake form                          |
| `/agents/signup`      | Agent signup / profile form                    |
| `/matches/[sellerId]` | Ranked top-3 match results for a seller        |
| `/dashboard/seller`   | Seller dashboard (property profile + matches)  |
| `/dashboard/agent`    | Agent lead pipeline                            |
| `/admin`              | Admin marketplace stats                        |
| `/login`              | Mock email sign-in for sellers and agents      |

## Matching algorithm

`src/lib/matching.ts` scores each agent 0–100 for a given seller:

| Factor                          | Weight |
| ------------------------------- | ------ |
| ZIP / service-area match        | 25     |
| Property-type experience        | 12     |
| Seller-goal specialty match     | 12     |
| Condition + situation specialty | 10     |
| Timeline urgency fit            | 8      |
| Recent sales activity (12 mo)   | 10     |
| Years of experience             | 8      |
| Average days on market          | 8      |
| List-to-sale price ratio        | 7      |

Each scoring factor can also emit a human-readable reason (e.g. *"Averages
just 12 days on market — matches your urgent timeline"*) which is stored on
the match and shown to the homeowner.

## Connecting Supabase (optional)

The app auto-detects Supabase credentials and switches from the mock store to
the real database.

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/schema.sql` (tables: `sellers`, `agents`,
   `matches`, `lead_statuses`, plus indexes and permissive MVP RLS policies).
3. Run `supabase/seed.sql` to load the sample agents, sellers, and matches.
4. Copy the env file and add your keys (Dashboard → Project Settings → API):

   ```bash
   cp .env.example .env.local
   ```

   ```ini
   # .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```

5. Restart `npm run dev`.

> ⚠️ The seeded RLS policies are intentionally permissive so the MVP works
> with the anon key. Replace them with `auth.uid()`-based policies (and swap
> the mock cookie auth in `src/app/actions.ts` for Supabase Auth) before
> going to production.

## Project structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── sell/page.tsx               # Homeowner intake
│   ├── agents/signup/page.tsx      # Agent signup
│   ├── matches/[sellerId]/page.tsx # Match results (top 3)
│   ├── dashboard/seller/page.tsx   # Seller dashboard
│   ├── dashboard/agent/page.tsx    # Agent lead pipeline
│   ├── admin/page.tsx              # Admin dashboard
│   ├── login/page.tsx              # Mock auth
│   └── actions.ts                  # Server actions (forms, auth, leads)
├── components/
│   ├── ui/                         # shadcn/ui-style primitives
│   ├── match-card.tsx              # Agent match card (seller-facing)
│   ├── lead-card.tsx               # Seller lead card (agent-facing)
│   ├── lead-status-select.tsx      # Pipeline status dropdown
│   ├── seller-intake-form.tsx
│   ├── agent-signup-form.tsx
│   └── ...
└── lib/
    ├── matching.ts                 # Scoring algorithm + intent score
    ├── types.ts                    # Domain types + display labels
    ├── db.ts                       # Data layer (Supabase ⇄ mock fallback)
    ├── supabase.ts                 # Supabase client + env var docs
    ├── mock-db.ts                  # Seeded in-memory store
    └── seed-data.ts                # 8 agents, 5 sellers
supabase/
├── schema.sql                      # Tables, indexes, RLS
└── seed.sql                        # Sample data + generated matches
```

## Notes & MVP simplifications

- **Auth is mocked** with an httpOnly cookie holding the profile id; the
  `/login` page looks up profiles by email. Swap for Supabase Auth later.
- **Mock data resets** when the dev server restarts (it lives in memory).
  Configure Supabase for persistence.
- Matches are generated server-side when a seller submits the intake form;
  new agent signups trigger a re-rank so they immediately receive leads.
