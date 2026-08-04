# Process: reporting-truth — Metric definition → dashboard

## 0. Meta
- Status: deepened
- Cadence: weekly (human reads); daily digests automated
- Verdict: KEEP with heavy MERGE/KILL inside (proposed; P3 decides) — the process is sound, the 35-surface sprawl is the defect
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
Every number a broker sees means one defined thing, traceable to source, rendered once — so decisions ride data, not placebo (§0 applied to internal surfaces).

## 2. Inception (what starts it)
- Trigger type: schedule (digests) | broker action (opens a report)
- Concrete triggers: `analytics-daily-digest` (visitor/spend/lead + anomalies — `route.ts:81-108,177`), `marketing-optimization-report` weekly, `gbp-monthly-digest`, digests in content-approve; broker opens any of 35 report surfaces.
- Entry evidence: 13 `/admin/crm/reporting/*` (one DAL fn each, view-only, broker-scoped); 13 `/admin/analytics/*`; 9 `/admin/reports/*`; `market-stat-consistency` cron as the truth-checker (`route.ts:58-181`).

## 3. Actors
- Human: Matt (company), brokers (own book — `scopeBroker` everywhere).
- Automated: digest crons, DAL definitions, consistency checker.
- Accountable: whoever ships a definition (dev-time); Matt for reading them.

## 4. Systems of record
- DAL functions ARE the definitions (`getLeadIntake`, `getSpeedToLeadReport`, …, DAL_INDEX.md); `market_pulse_live`/`market_stats_cache` for market figures (methodology stamp v3-2026-05-07 — cite the stamp); GA4 via cached fetchers; dashboard-lead source of truth = crm_people-derived counts (memory).
- NOT SoR: any number typed into a page; chart values from memory (§0).

## 5. End-to-end path
1. **Definition shipped** · dev · DAL fn with cache key/TTL (G16 index) · failure: second definition of the same concept ships elsewhere → divergence (the live defect: `getLeadIntake` rendered 5 ways; raw-Supabase analytics pages bypass DAL entirely — `createClient` direct in google-search, listing-performance, lp-leaderboard, funnel-breakdown, gbp, meta-health) · n/a
2. **Data refreshes** · system · caches per sync-ops · n/a
3. **Truth check** · system · market-stat-consistency cross-checks DAL vs pulse vs cache daily, emails on >1% drift · n/a
4. **Digest or view** · system/human · daily digest email; or broker opens a report · desktop
5. **Decision** · human · acts (weekly-sla-review, growth calls) · n/a

## 6. Decision points
- Same concept, two surfaces? → today both live (defect); target: one definition, N projections.
- Drift detected? → email alarm; §0 hard gate pre-render for outbound deliverables.
- Broker scope? → scopeBroker on every CRM report.

## 7. Completion
- Done-when (per read): question answered from a single-definition surface; (per cycle): digests delivered, consistency green.
- Terminal states: n/a (continuous).

## 8. Time & SLA
- Digests daily 14:00/14:30 UTC; consistency daily. Report freshness rides cache TTLs.
- "Late": stale cache renders silently (ISR empty-fallback class — memory).

## 9. Variants
- CRM reports (13, DAL-clean) · analytics (13, mixed DAL/raw) · reports namespace (9, overlaps analytics) · digests (email projections).

## 10. Current implementation map
- Routes: 35 surfaces across 3 namespaces (P1 inventory maps each).
- Known defects: (a) `getLeadIntake` rendered 5 ways across 2 namespaces; (b) `/admin/reports/custom` + `/reports/market` + `/analytics` duplicate the same builder; (c) 6 analytics pages bypass DAL with raw Supabase (G1 boundary exempt today — inconsistent trust); (d) three namespaces for one job; (e) no per-metric definition registry a reader can consult ("what does this count?").
- Duplicate paths: the whole namespace triplication.

## 11. Target shape (process-level, not pixels)
- Should exist: YES — but as ONE reporting home: definition registry (name → DAL fn → source → scope), each metric rendered once, projections composed not re-queried; raw-Supabase pages migrated behind the DAL.
- Data gaps: definition registry; digest/read parity (email says what the page says).
- UI destination implication: one reports destination; digests are projections of it.

## 12. Acceptance checks
- [ ] Pick any figure on any report → trace to one named DAL fn + source table in one hop (fails today on raw-supabase pages).
- [ ] `getLeadIntake` weekly total identical across all 5 current renderings (measure; divergence = bug evidence for P3).
- [ ] market-stat-consistency green on live data.
- [ ] Broker A cannot see broker B's numbers on any scoped report.
- [ ] Daily digest numbers equal the dashboard for the same window.
