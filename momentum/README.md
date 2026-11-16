# Momentum

Job control for project managers. It tracks every job's schedule, cost and crew load, and warns you about delays and bottlenecks before they happen.

Open `index.html` in a browser. There's no build step and nothing to install. Data saves in your browser (localStorage). Use **Shortcuts & data** to export or import a backup.

## Views

| View | What it's for |
|---|---|
| **Pulse** (1) | Momentum score, 8 KPI tiles, today's moves, planned vs earned hours, throughput, where work waits, job health, what's due this week |
| **Jobs** (2) | Every job as a card: progress against plan, forecast finish, budget burn, blockers. Click one for the full job panel |
| **Board** (3) | Kanban across all jobs: Backlog, Ready, In progress, Review, Done. WIP limits flag a stage as it fills. Dots show how long a card has sat |
| **Timeline** (4) | Plan bars with earned progress, today line, and hatched forecast slip past the due date |
| **Radar** (5) | Queue forecasts per stage and every early warning, with one-click fixes |
| **Team** (6) | Hours due in the next 14 days against capacity, plus rebalance suggestions |

Press `⌘K` / `Ctrl+K` or `/` for search and commands, `N` for a new task, `J` for a new job, `?` for help.

## KPIs

- **On-time delivery**: share of tasks finished by their due date, last 30 days
- **SPI** (schedule performance index): earned hours ÷ planned hours to date
- **CPI** (cost performance index): earned value ÷ actual cost
- **Forecast overrun**: estimate at completion (budget ÷ CPI) minus budget, across active jobs
- **Throughput**: tasks finished per week
- **Cycle time**: days from starting a task to finishing it
- **Blocked work**: tasks waiting on clients, permits, materials, inspections or subs
- **Team load**: hours due in the next 14 days ÷ capacity

Earned hours give full credit for Done, 90% for Review and 50% for In progress.

## Early-warning rules

| Warning | Fires when |
|---|---|
| Slip forecast | The earned-schedule forecast lands 3+ days after the due date |
| Cost | CPI drops below 0.93 once a job is 10% done |
| Blocked | A task is waiting on someone outside the crew. Ranked by age and by how many downstream tasks wait on it |
| Queue growth | A stage is over its WIP limit, or arrivals are outpacing departures enough to hit the limit within 10 days |
| Aging | A task has sat in a stage far longer than usual (1.6× its expected time) |
| Due soon | A task due within 3 days hasn't started |
| Overdue | A job has 2+ tasks past due |
| Stale job | Nothing on an active job has moved in 6 days |
| Throughput drop | This week's finishes fall below 60% of the 7-week average |
| Overload | Someone is booked past 110% for the next 2 weeks. Suggests a task to move and who has room |

Each warning comes with an action (Nudge, Mark unblocked, Move forward, Start now, Reassign, Snooze). Clearing work earns XP and keeps your daily streak going, from Pup all the way to Top Dawg.

## Templates

New jobs can start from Remodel, Fix & flip, New build, Commercial fit-out or General project. Tasks are spread across the job's dates in proportion to their hours and assigned by role (see each teammate's "Takes template tasks for" setting).

## Files

- `index.html`: page shell
- `styles.css`: design tokens (light and dark) and components
- `seed.js`: templates and the sample portfolio (regenerated daily until you edit it)
- `app.js`: state, metrics, warning rules, views and interactions
