# Company scoreboard — weekly packet

**Process:** [COMPANY_IMPROVEMENT.md](COMPANY_IMPROVEMENT.md) (THE LOOP v1.5.1)  
**Version target:** [ENTERPRISE_MAP/VERSION-1.md](ENTERPRISE_MAP/VERSION-1.md) — lead with version progress.  
**Session boot:** `npx tsx scripts/loop-brief.ts` — the work graph (`loop_work_nodes`) is the source of record for in-flight work.  
**Overwrite this file each week.** Do not start a dated novel.  
**Rule:** if a domain has no number, write **UNKNOWN** and the query that failed. Unreadable ≠ 0.

**Week of:** 2026-08-15  
**Fetched at:** 2026-08-15T14:45:03.140Z  
**Probe:** `npx tsx scripts/company-scoreboard-probe.ts`  
**DAL:** `collectCompanyScoreboardSignals` in `lib/data/loop/signals.ts`

---

## 0. Company version progress (probe 2026-08-15T15:3xZ)

| Figure | Value | Source |
|---|---|---|
| Version | **v1 OPEN** — 2 of 29 agent gaps closed (G1, G14; G15–G25 from the requirements harvest, G26–G28 from the adversarial audit, G29 fleet stand-up), 0 of 6 Matt moves done | `ENTERPRISE_MAP/VERSION-1.md` gap list (Max-pinned) |
| Loop sentinel | **SELF-CHAINING** as of 2026-08-15: a finishing iteration's last act is `loop-sentinel?handoff=1` — the successor launches the moment completion is marked (zero gap). The 10-min heartbeat (token-free code, state-based busy check) backstops crashes and env gaps. Guards always: kill switch (`LOOP_SENTINEL=off`), fresh-activity standdown, 12/day cost cap. Saying "Run the loop" still works. | R-206 VERIFIED |
| Verification fleet | **Machinery live incl. the flows lane, bots pending Matt setup**: endpoint + intake (reproduce-or-reject) + 4 case packs (core/regression/preflight/flows) + **6** paste-ready bot briefs. Flow Prover may SUBMIT real forms using the designated fleet identity — all four side-effect guards proven live 2026-08-15 (fixture person 61855: tagged, suppressed, no wake, no enroll, excluded from counts). Certification requires a clean fleet pass. | THE LOOP v1.6.0 + G30 |
| Requirements coverage | **207 directives dispositioned**: 92 LOCKED · 38 VERIFIED · 44 PARTIAL · 25 MISSING (all gap-covered) · 7 GATED · 1 PARKED. Four rows demoted VERIFIED→PARTIAL by adversarial audit (R-025, R-095, R-137, R-203); R-207 fleet added | `ENTERPRISE_MAP/REQUIREMENTS.md` + G57 (Max-pinned; that gate's output is the count SoR) |
| Stranded ledger windows | **0** (was 11 — all closed 2026-08-15 with §0 traces; `seo-aeo` unfrozen). Work graph: G2 identity stitch **DONE 2026-08-16** (32/166 mapped). Next served node is whatever `loop-brief` prints. | probe `ledger.expiredUnlearned` + G2 accept 2026-08-16 |
| Adversarial audit (first R-040 pass) | **17 defects found by the machine, 0 by Matt**: 2 gate blind spots (fixed: Max pins), 3 enforcement bypasses (fixed: DB triggers + fail-closed DAL), 4 overstated register rows (corrected, product gaps G26–G28 opened), 8 stale packet/manifest claims (corrected). Escape recorded. | audit agents 2026-08-15 + `process_escape_ledger` |
| Capabilities below Working floor | **7** (TC, video, social OAuth, broker platform, westside, Grok memory, SMS agent) | `ENTERPRISE_MAP/matrix/CAPABILITIES.md` 2026-08-08 close |
| Needs-reauth integrations | **0 active** — GBP/YouTube/X/TikTok auto-refresh from stored refresh tokens via the daily 12:00Z heartbeat (verified live 2026-08-15, scheduled run all OK + on-demand trigger rolled expiries). LinkedIn is `needs-reauth` and **PARKED** (provider issued no refresh token). No Matt reconnect task exists. | heartbeat `sync_logs` 2026-08-15T12:00:03Z + probe `social.tokens` (`auto-refresh` vs `needs-reauth`) |
| Meta audience heartbeat | first green run **2026-08-15T14:03Z** — hold 7 days then flip FIX→KEEP (gap G11) | `meta_audience_log.ran_at` |

## 1. Money and license

| Figure | Value | Source |
|---|---|---|
| CRM people (not deleted) | **22,672** | `crm_people` where `deleted=false` (paginated stage scan) |
| People created last 7d | **24** | `crm_people.created_at >= now-7d`, `deleted=false`, exact count |
| Stage mix | Nurture 20,287 · Sphere 2,338 · Past Client 32 · Active Client 12 · Trash 2 · Vendor 1 · **Lead 1** | `crm_people.stage` (G3: native-create writer; person 61917; ex-fleet:test) |
| GCI settlement_verified | **$384,393.35** | `tc_commissions.gci` where `status='settlement_verified'` (22 rows) |
| GCI projected | **$15,570.00** | `tc_commissions.gci` where `status='projected'` |
| vs $1M year-1 target | **38.4%** | 384393.35 / 1000000; target in `docs/MASTER_SPEC.md` |
| Pulse methodology | **v3-2026-05-07 on 45/45 rows** | `market_pulse_live.methodology_version` — do not claim v4 |
| Delta last success | **2026-08-15T14:33:37Z** (~11 min before this fetch) | `sync_state.id='default'.last_delta_sync_at` |
| Full last success | **2026-08-09T02:04:03Z** | `sync_state.last_full_sync_at` |
| §0 / money-path miss | none recorded this fill | — |

## 1b. Search, alerts, polygons, identity, CMA

| Figure | Value | Source |
|---|---|---|
| Listing alerts | **7** total · **6** active · **7** with `crm_person_id` | `listing_alerts` |
| Legacy `saved_searches` | **2** | public-share leftover. Do not send from this table. |
| Search areas (drawn) | **0** | `search_areas` |
| Boundaries (polygons) | **3,312** | `boundaries` |
| Facet counts refreshed | **2026-08-15T14:42:00Z** (~3 min before fetch) | `search_facet_counts.refreshed_at` |
| Filter registry | **131** fields | `lib/search/field-registry.ts` `SEARCH_FIELDS` (`key:` count). Honest Spark-visible target is still the completeness plan, not this count alone. |
| Identity map | **166** | `visitor_identity_map` |
| Identity mapped to CRM | **32** | `visitor_identity_map.crm_person_id` is not null. G2 class: stitch now writes `crm_person_id` in lockstep (was 1 because only `fub_person_id` was set). Hosted backfill + fleet-test form-submit accept 2026-08-16 (`rr_vid=g2-accept-ea08a60f-3cbc-4769-9353-c56e686588fc`, person 61855). |
| Visitor events 7d | **11,233** | `visitor_events.event_at >= now-7d` |
| Email events 7d | **113** · opens **11** · clicks **0** | `email_events` `event` = `open` / `click` |
| Meta audience last run | **2026-08-15T14:03:29Z** | `meta_audience_log.ran_at` (heartbeat is live this week) |
| CMAs | **294** | `cmas` count. Look/feel is UNKNOWN until a rendered pass. |

## 2. What shipped

| Class | Domain | Predicted delta | Commit |
|---|---|---|---|
| Company ingest + `site_improvement_ledger.domain` | factory | Non-SEO classes can take a ledger row | `7c2bca5c` |
| Holistic blast-radius + named surfaces | factory | Search, alerts, polygons, identity, CMA, Spark, ads keys are scored on the same packet | `2ac16199` |

## 3. What is measuring

| Ledger row | Domain | Window state | Metric |
|---|---|---|---|
| 11 `seo-aeo` rows | seo-aeo | **CLOSED 2026-08-15** (Learn): 1 win — Tetherow LCP p75 60,768→4,156ms (38 samples) · 1 loss — overlay discipline engagement 0.144→0.119 · 1 flat — llms.txt +3 AI sessions vs +10 · 8 inconclusive — GSC page series not live in the June window (per-row gap named). Confidence now learned per class. | `actual_delta` + verdict written |
| `ba3435dd` factory | factory | open, inside window (14d from `7c2bca5c`) — this v1.2→1.4 machinery wave rides it; Learn due 2026-08-29 | `non_seo_domains_in_ledger` |

## 4. What is rotting (top residuals)

Scored from this fetch + COMPANY_IMPROVEMENT.md. Not vibes.

1. **nurture** — 20,287 Nurture / **1 Lead** (G3 writer live) / 12 Active Client. **6** active listing alerts against 22,672 people. Alerts remain the rotting row.
2. **leads / identity** — stitch class closed 2026-08-16: **32/166** map rows now carry `crm_person_id` (was 1/164). Residual: 1 stale FUB-only row with no `crm_people` match, plus visitors who never identified. CAPI `external_id` and alert stamps ride the same person.
3. **recruit-retain** — **3** brokers. `/join` convert UNKNOWN.
4. **social-presence** — tokens are NOT the rot (corrected 2026-08-15: TikTok/YouTube/X/GBP auto-refresh via the daily heartbeat; LinkedIn parked, no provider refresh token). The rot is the pipeline: brain `measured=2`, `ready` 420, no fan-out calendar (G25).
5. **public-ux / polygons** — **3,312** boundaries live. **0** `search_areas`. Filter facets are fresh. Whether every `geo_type` is on the map is UNKNOWN (probe does not walk pages). Do not `ST_Within` at request time.

Not in the top 5 this week: **data-sync** (delta ~11 min). **license-voice** (pulse all v3). **sales-insights** (GCI live; audience cron ran this morning). **transactions** (SkySlope still 2026-06-10). **broker-tools** (294 CMAs; look UNKNOWN).

## 5. Matt-only

- Newsletter first cohort send (5,346 subscribers)
- Ad spend (Demand parked). Audience *wiring* may be fixed without spend.
- Taste stops (packets, posts, CMA look)
- SkySlope mutation / Closings cutover
- First listing-alert send to a real person who is not already in a measured test

---

## Domain snapshot

| Domain | Status | Notes |
|---|---|---|
| public-ux | watch | 131 registry fields. 3,312 polygons. 0 drawn search areas. Look still a grind. |
| seo-aeo | unfrozen | 180 GSC benchmark rows in 28d. All 11 windows CLOSED 2026-08-15 with verdicts (1 win, 1 loss, 1 flat, 8 telemetry-gap). |
| leads | watch | Identity stitch 32/166 after G2 (was 1/164). Stage/journey is G3 (Lead = 2). |
| nurture | watch | Lead = 2 after G3. 6 active alerts remain the rotting row. |
| social-presence | rotting (pipeline, not tokens) | Tokens self-renew (LinkedIn parked). Rot = measured 2 / ready 420, no calendar (G25). |
| sales-insights | watch | GCI live. Audience log ran today. |
| transactions | rotting | SkySlope 66+ days stale. |
| broker-tools | UNKNOWN look | 294 CMA rows. Ease / Today queue not in this probe. |
| recruit-retain | rotting | 3 brokers. `/join` UNKNOWN. |
| data-sync | ok | Delta ~11 min. Spark remains ingest-only. |
| factory | shipped | THE LOOP v1.5.x: work graph, loop-brief, G56/G57, DB triggers, adversarial verification standing. |
| license-voice | ok this fill | Pulse v3 on 45/45. One-stat process still CAP-006 / marts / §0. |

---

## How to refresh

1. `npx tsx scripts/company-scoreboard-probe.ts`
2. Replace every figure with the printed value + the `source` field from the JSON
3. Re-score §4 from the diagnose rules in COMPANY_IMPROVEMENT.md
4. Close ledger windows whose `shipped_at + window_days` has passed
5. A change this week must name its blast-radius planes before it starts
