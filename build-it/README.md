# Build It

A guided web app that takes someone with little or no construction experience from an empty
lot to keys in hand, without skipping a step.

Open `index.html` in a browser. No build step or dependencies. Progress is saved in the browser
(localStorage), and a backup code on the My build tab moves it to another device.

The phone app (iPhone and Android, built with Expo) is in [`mobile/`](mobile/). It uses the same
guidance from `content.js`, adds inspection photos, and has optional accounts that sync a build
between phones and this web app. To switch accounts on, follow
[`mobile/supabase/README.md`](mobile/supabase/README.md) and put the keys in `config.js`. Signed in
here, you also see the photos taken on the phone. Backup codes move a build between the two too.

## What's in it

- **Roadmap**: 14 phases and 97 steps in build order, from financing and land to the
  11-month warranty walk. Each step explains what to do and how top builders do it. Inspection
  hold points are flagged, and the app warns when an earlier step is still open.
- **Land check**: a 20-point due diligence scorecard (zoning, soils, perc, flood, utilities,
  title, costs) with a buy / walk-away verdict.
- **Permits**: a permit list built from the project profile (well and septic, HOA, flood zone,
  acreage disturbed, demolition, gas).
- **Budget**: all-in cost calculator with soft costs, contingency and construction-loan
  interest, a typical cost split, and a milestone draw schedule.
- **Paying people**: payment log that tracks lien waivers, inspections and retainage, plus the
  rules for paying contractors.
- **Your team**: GC versus owner-builder, a vetting checklist, contract must-haves and red flags.
- **Built to last**: durability principles from building science and long-lived building
  traditions, linked to the phase where each applies.

## Files

- `index.html`: layout, styles and app logic.
- `config.js`: Supabase keys for accounts. Empty means accounts are off.
- `sync.js`: cloud sync rules, matching `mobile/src/lib/sync.ts` (a test checks they agree).
- `content.js`: all guidance content (phases, steps, land checks, permits, contract terms).
  Edit this file to change or add guidance, then run `npm run gen:content` in `mobile/`.
- `mobile/`: the phone app.

Build It is a guide, not legal, financial or engineering advice. Codes, permits and lien laws
are local; the user's building department and licensed professionals have the final word.
