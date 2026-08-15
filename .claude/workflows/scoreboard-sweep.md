---
name: scoreboard-sweep
description: W2.1 — parallel ingest for the weekly company packet. One agent per signal domain, freshness-checked sources, one ranked candidate list out. Doctrine - docs/plans/AGENTIC_GRAPH_ENGINEERING_2026-07-30.md §3 + G.2 telemetry freshness.
---

# /scoreboard-sweep

Fan out -> freshness check -> pull -> synthesize ONE ranked list for the loop iteration.
Replaces serial ingest. Stale telemetry BLOCKS the iteration (a stale scoreboard produces
a wrong iteration, not a slower one).

## Nodes

1. **split (code)** — the signal domains, fixed set: GA4/GSC (`site_signal`,
   `target_query_benchmark`), web vitals (`web_vitals`), CRM stages + speed-to-lead
   (`crm_people`), alerts + identity (`listing_alerts`, `visitor_identity_map`,
   `email_events`), brain pipeline (`marketing_brain_actions`), sync + tokens
   (`sync_state`, heartbeat `sync_logs`), money (`tc_commissions`).
   Baseline puller already exists: `collectCompanyScoreboardSignals`
   (lib/data/loop/signals.ts) — nodes go DEEPER per domain, not instead of it.

2. **domain-pull ×7 (parallel, cheap model)** — contract per node:
   - FIRST verify the source's freshness (its cron's last success age). Stale source =
     return `{ domain, stale: true, failing_cron }` and STOP — do not pull stale data.
   - Then pull the 28d window, compute deltas vs prior window.
   - output: `{ domain, fresh, headline_figures[], candidates[] }` where each candidate
     names `{ class, surface, metric, baseline, expected_direction }`.

3. **synthesize (strong model)** — merge candidates into ONE ranked list using the loop
   score (reach × gap-to-benchmark × confidence ÷ effort, confidence from
   `getChangeClassConfidence`). Learn-first rule: expired unlearned ledger windows
   outrank every new candidate in their domain.

4. **emit (code)** — write the ranked list into `docs/plans/COMPANY_SCOREBOARD.md`
   (overwrite the packet sections, additive on history). Any stale domain is listed
   with its failing cron in §0 — named, never silently skipped.

## Stop conditions

All 7 domains fresh-or-named-stale; exactly one ranked list; packet updated.
