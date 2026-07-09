# ServiceOS

**The live operating system for dealership service departments.**

ServiceOS tracks every vehicle from the moment it hits the service drive to the
moment the customer drives away — and surfaces bottlenecks in real time so
managers can act before the customer calls.

Dark-mode, command-center feel: Linear meets an airport departures board.

## Run it

No build step, no dependencies. It's a static app:

```bash
# any static server works
python3 -m http.server 8080
# then open http://localhost:8080
```

Or just open `index.html` in a browser.

## Pages

| Page | Who it's for | What it does |
|---|---|---|
| **Login** | Everyone | Pick a name + role (Manager, Advisor, Dispatcher, Technician, Parts). Role sets your landing page. |
| **Command Center** | Manager | 11 live KPI tiles + a 12-column Kanban board (Arrived → Delivered). Cards show RO, customer, vehicle, concern, time-in-stage, advisor, tech, and priority; left border color = SLA health. |
| **Intake** | Advisor | Full write-up form. Submitting creates a live vehicle card in Arrived or Checked In. |
| **Vehicle Detail** | Everyone | Complete 17-milestone timeline (arrival → delivery) with timestamps and per-step durations, plus one-click buttons to move the vehicle to its next stage. |
| **Dispatch** | Dispatcher | Waiting vehicles (oldest first) on the left, technician roster with live status on the right. Assign any vehicle to any tech. |
| **Technician View** | Technician | Tablet-style screen: current job, concern, big Start/Complete Diagnosis & Repair buttons, Flag Issue. |
| **Parts** | Parts dept | Every vehicle in Waiting Parts with one-tap status: Ordered / Delayed / Received / Ready for Tech. |
| **Alerts** | Manager | Auto-generated bottleneck alerts: dispatch > 15m, tech-start > 20m, approval > 30m, parts > 30m, QC > 20m, wash > 20m. Red = over SLA, yellow = approaching. |
| **Analytics** | Manager | Avg check-in, time-to-tech, approval, parts wait, repair, and total cycle time vs. targets; technician throughput meters; bottlenecks by department. |

## How it works

- **State**: plain JavaScript objects persisted to `localStorage` — every stage
  change is a timestamped milestone event on the vehicle, so timers, timelines,
  alerts, and analytics are all *computed* from the same event log (the same
  shape a real backend would store).
- **Live timers**: timestamps are real; time-in-stage badges, SLA colors, and
  alerts re-evaluate every 30 seconds.
- **Seed data**: the app loads with a realistic mid-morning floor — 16 vehicles
  across all stages including delivered units (so cycle-time analytics have
  data) and several vehicles intentionally over SLA (so alerts have teeth).
  **Reset Demo** in the sidebar reseeds the floor.

## Workflow

```
Arrived → Checked In → Waiting Dispatch → Assigned → Diagnosis
   → Waiting Approval → (Waiting Parts) → Repair → QC → Wash → Ready → Delivered
```

Approval can branch straight to Repair when no parts are needed; the timeline
marks skipped steps.

## Next steps toward production

- Swap `localStorage` for a real API — the event-log data model maps 1:1 to a
  `vehicles` + `events` schema.
- Real auth per role, DMS/RO-system integration, SMS notifications on Ready.
- WebSocket push instead of the 30-second refresh tick.
