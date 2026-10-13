# Tester sessions

Goal from the build brief: **10 real testers pick a dinner without help.**

## Who

Ten people who ask "what should we eat?" most evenings: a mix of people who live alone, couples
and parents, iPhone and Android. They shouldn't have seen the app before.

## Setup (before each session)

1. Install the latest TestFlight or Play internal testing build on the tester's own phone.
2. Don't explain the app. Don't show them around.
3. If you can, sit beside them (or screen share) and only watch. Note where they pause.

## Tasks

Read each task out loud, exactly as written. Don't help. If they ask a question, answer "What
would you try?"

1. **The main test.** "It's 6pm and you don't know what to have for dinner. Use this app to
   decide." It passes when they reach an idea or place they're happy with and tap
   **Let's eat this**, without asking for help, in under 2 minutes.
2. "You'd rather cook tonight. Find something and get a shopping list for it."
3. "You want to go out. Find somewhere near you that's open right now and get directions."
4. "You're on the couch. Get something delivered."
5. "Save one idea you'd like to try another night, then find it again."

## Record for each tester

| Tester | Phone | Task 1 passed? | Time to Let's eat this | Asked for help on | Confusing moments |
| --- | --- | --- | --- | --- | --- |
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |

**Done when** 10 of 10 pass task 1. If someone fails, fix what tripped them up, ship a new build,
and test that step with a new person.

## Afterwards, ask

- "What did you have for dinner in the end?"
- "Was anything confusing or slow?"
- "Would you open this again tomorrow night? Why or why not?"
- "Anything you expected it to do that it didn't?"

## What to check in PostHog

With `EXPO_PUBLIC_POSTHOG_KEY` set, build a funnel from `Application Opened` →
`surprise_me` or `mode_opened` → `locked_in`. That's the same journey as task 1, for everyone,
not just people you watched. Other useful events: `spin_again` (how many spins before a pick),
`fave_toggled`, `grocery_added`, `delivery_opened`, `directions_opened`, and `location_choice`
(how many people decline location).

Crashes show up in Sentry with the screen and the anonymous account id. No names or emails are
sent to either tool.
