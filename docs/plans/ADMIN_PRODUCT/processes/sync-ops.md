# Process: sync-ops — Listing/CRM sync health

## 0. Meta
- Status: deepened
- Cadence: continuous (system); broker looks only when paged or curious
- Verdict: KEEP (proposed; P3 decides) — supervision class: Matt wants the VIEW, not the wake-up (Q1)
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
Every pipeline that feeds the product (MLS sync, MVs, market stats, Gmail mirror, deploys, marketing loops) is either healthy or loudly known-unhealthy, without a human babysitting it.

## 2. Inception (what starts it)
- Trigger type: schedule (the whole cron fleet) | system condition (alarms)
- Concrete triggers (registered in vercel.json, verified this session):
  - MLS: `sync-delta` 4×/hr (`deltaSync.ts:532`), `sync-full` weekly (12 chunks), `sync-history-terminal` hourly backfill
  - Derived data: `refresh-mvs` hourly (4 MVs — `route.ts:59-106`), `refresh-market-stats` daily + monthly recompute weekly, `refresh-subdivision-stats`, `refresh-similar-listings`, `market-history-snapshot` weekly (FRED/PMMS), `warm-sitemaps` hourly
  - CRM: `crm-gmail-sync` 4×/hr, `crm-geo-resolve` daily, `crm-health-check` 2×/hr (vitals: silence, SMS volume, A2P, MV lag — pages broker on alarm — `route.ts:130-208`)
  - Meta audiences: `meta-audience-sync` daily, `meta-westside-audience` daily
  - Meta-monitoring: `loop-health-check` daily (13+ tables → one consolidated alert — `route.ts:368,402`), `market-stat-consistency` daily (DAL-vs-pulse drift >1% → email — `route.ts:58-181`), `deploy-health` 2×/hr (live SHA vs GitHub main >20 min stale → alert), `postmaster-sync` (deliverability)
- Entry evidence: table above from vercel.json enumeration; 21 unregistered routes catalogued (9 snapshot fan-out by design, `detect-expired-listings` manual-only documented, rest dormant).

## 3. Actors
- Human: Matt/broker responds to pages; occasional manual backfill (`start-sync`, `sync-parity` — unregistered, secret-guarded).
- Automated: the fleet above; each self-reports (sync_state, sync_logs, health outputs).
- Accountable: system for detection; Matt for acting on alarms.

## 4. Systems of record
- `sync_state` / `sync_cursor` / `sync_logs` — MLS sync position + history.
- Per-domain health reads: MV freshness RPC, A2P status, deliverability_metrics, marketing_decisions (loop-health writes).
- NOT SoR: dashboards (views over the above); doc prose about cadences (drifted before — vercel.json is canon, CLAUDE.md §5).

## 5. End-to-end path (a health cycle)
1. **Pipelines run** · system · each cron does its job + records state · failure: individual run fails silently unless a checker catches it · n/a
2. **Checkers sweep** · system · crm-health-check (vitals), loop-health-check (cross-pipeline), market-stat-consistency (data truth), deploy-health (ship truth), gbp-health-check (reputation surface) · n/a
3. **Alarm** · system · consolidated email/page — health-check pages broker (supervision alarms currently ride the same SMS rail as wake-ups — mismatch per Q1, see broker-alert §10) · n/a
4. **Broker inspects** · human · `/admin/sync` (+`/spark`), `/admin/crm/health`, `/admin/operations` · desktop · failure: three separate health surfaces, no single "is everything OK" answer
5. **Remediate** · human/system · manual backfill routes, re-run, or accept · n/a
6. **Verify** · system · next checker cycle confirms green · n/a

## 6. Decision points
- Vital out of band? → page vs digest (today: page — Q1 wants digest/view for supervision).
- Stat drift >1%? → email + hard pre-render gate downstream (§0).
- Deploy stale >20 min? → alert.
- MV refresh contention? → known incident class (listing_tile_mv outgrew timeout — memory); accepted risk documented.

## 7. Completion
- Done-when (per cycle): all checkers green, or alarms delivered and acknowledged-by-action.
- Artifacts: health rows, alert emails, sync logs.
- Terminal states per issue: auto-recovered · remediated · accepted (no formal accept ledger — gap).

## 8. Time & SLA
- Detection: ≤30 min (checker cadences). Sync freshness: 15-min delta; hourly MVs.
- "Late": a silent pipeline failure between checker sweeps; loop-health-check is the daily backstop.

## 9. Variants
- Domain: MLS · derived-data · CRM · deploy · marketing · deliverability. One supervision process; per-domain checkers.

## 10. Current implementation map
- Routes: `/admin/sync`, `/admin/sync/spark`, `/admin/crm/health`, `/admin/operations` (+ redirect `/admin/spark-status`).
- Crons: fleet per §2.
- Known defects: (a) supervision alarms share the wake-up SMS rail (Q1 mismatch); (b) health truth split across 3+ surfaces; (c) no accepted-issue ledger (alarm fatigue risk); (d) 10 dormant unregistered cron routes (dead weight or missing schedules — each needs a verdict); (e) MV refresh cost/contention class (memories: MV refresh timeout, sitemap build cost).
- Duplicate paths: operations vs sync vs crm/health overlap.

## 11. Target shape (process-level, not pixels)
- Should exist: YES — as background + ONE supervision view.
- Ideal: single health destination answering "is everything OK, what needs me" (Q1: supervision = view, not interrupt); alarms classed wake-up vs review; accepted-issue ledger; dormant routes deleted or scheduled.
- Data gaps: unified health read; accept ledger.
- UI destination implication: one ops/health destination (weekly glance + alarm landing).

## 12. Acceptance checks
- [ ] Kill Spark creds in test → sync failure visible on health surface ≤30 min + alarm fired.
- [ ] Force MV staleness → crm-health-check flags MV lag vital.
- [ ] Drift a cached stat >1% in test → market-stat-consistency email.
- [ ] Deploy SHA mismatch >20 min → deploy-health alert.
- [ ] Every registered cron ran in its last window (SQL over sync_logs/health rows — the "did the fleet run" question answerable in one query).
