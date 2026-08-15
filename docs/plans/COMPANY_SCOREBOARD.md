# Company scoreboard — weekly packet

**Process:** [COMPANY_IMPROVEMENT.md](COMPANY_IMPROVEMENT.md) (THE LOOP v1.3.0)  
**Version target:** [ENTERPRISE_MAP/VERSION-1.md](ENTERPRISE_MAP/VERSION-1.md) — lead with version progress.  
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
| Version | **v1 OPEN** — 0 of 14 agent gaps closed, 0 of 7 Matt moves done | `ENTERPRISE_MAP/VERSION-1.md` gap list |
| Stranded ledger windows | **11** expired unlearned, all `seo-aeo` (domain frozen by the insert guard until Learn closes them) | probe `ledger.expiredUnlearned` / `expiredByDomain` |
| Capabilities below Working floor | **7** (TC, video, social OAuth, broker platform, westside, Grok memory, SMS agent) | `ENTERPRISE_MAP/matrix/CAPABILITIES.md` 2026-08-08 close |
| Red integrations | **4** — GBP, LinkedIn, YouTube, X (all Matt OAuth) | `ENTERPRISE_MAP/matrix/INTEGRATIONS.md` + probe tokens |
| TikTok token | valid, **expires 2026-08-16T12:00Z** — verify auto-refresh (gap G14) | probe `social.tokens` |
| Meta audience heartbeat | first green run **2026-08-15T14:03Z** — hold 7 days then flip FIX→KEEP (gap G11) | `meta_audience_log.ran_at` |

## 1. Money and license

| Figure | Value | Source |
|---|---|---|
| CRM people (not deleted) | **22,672** | `crm_people` where `deleted=false` (paginated stage scan) |
| People created last 7d | **24** | `crm_people.created_at >= now-7d`, `deleted=false`, exact count |
| Stage mix | Nurture 20,287 · Sphere 2,338 · Past Client 32 · Active Client 12 · Trash 2 · Vendor 1 · **Lead 0** | `crm_people.stage` (Lead absent = 0) |
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
| Identity map | **164** | `visitor_identity_map` |
| Identity mapped to CRM | **1** | `visitor_identity_map.crm_person_id` is not null |
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
| 11 open `seo-aeo` | seo-aeo | **EXPIRED unlearned** (probe 2026-08-15T15:3xZ) — Learn is the only legal next `seo-aeo` work; the insert guard refuses new classes | `actual_delta` is null |
| `ba3435dd` factory | factory | open, inside window (14d from `7c2bca5c`) | `non_seo_domains_in_ledger` |

## 4. What is rotting (top residuals)

Scored from this fetch + COMPANY_IMPROVEMENT.md. Not vibes.

1. **nurture** — 20,287 Nurture / **0 Lead** / 12 Active Client. **6** active listing alerts against 22,672 people. The journey and the alert engine are unused at company scale.
2. **leads / identity** — 11,233 visitor events in 7d and **164** identity-map rows, but only **1** row has `crm_person_id`. Tracking is alive. The stitch to `crm_people` (and therefore ads audiences) is not. This is the “do not lose the Google / match / ads path” class.
3. **recruit-retain** — **3** brokers. `/join` convert UNKNOWN.
4. **social-presence** — TikTok valid through 2026-08-16T12:00Z. YouTube, LinkedIn, X, GBP **expired**. Brain `measured=2`, `ready` 420.
5. **public-ux / polygons** — **3,312** boundaries live. **0** `search_areas`. Filter facets are fresh. Whether every `geo_type` is on the map is UNKNOWN (probe does not walk pages). Do not `ST_Within` at request time.

Not in the top 5 this week: **data-sync** (delta ~11 min). **license-voice** (pulse all v3). **sales-insights** (GCI live; audience cron ran this morning). **transactions** (SkySlope still 2026-06-10). **broker-tools** (294 CMAs; look UNKNOWN).

## 5. Matt-only

- Newsletter first cohort send (5,346 subscribers)
- Social OAuth reconnect: YouTube, LinkedIn, X, GBP
- Ad spend (Demand parked). Audience *wiring* may be fixed without spend.
- Taste stops (packets, posts, CMA look)
- SkySlope mutation / Closings cutover
- First listing-alert send to a real person who is not already in a measured test

---

## Domain snapshot

| Domain | Status | Notes |
|---|---|---|
| public-ux | watch | 131 registry fields. 3,312 polygons. 0 drawn search areas. Look still a grind. |
| seo-aeo | ok ingest / UNKNOWN gap | 180 GSC benchmark rows in 28d. 11 open windows. |
| leads | rotting | Identity stitch 1/164. Visitor events are not becoming people. |
| nurture | rotting | Lead = 0. 6 active alerts. |
| social-presence | rotting | 4 expired tokens. |
| sales-insights | watch | GCI live. Audience log ran today. |
| transactions | rotting | SkySlope 66+ days stale. |
| broker-tools | UNKNOWN look | 294 CMA rows. Ease / Today queue not in this probe. |
| recruit-retain | rotting | 3 brokers. `/join` UNKNOWN. |
| data-sync | ok | Delta ~11 min. Spark remains ingest-only. |
| factory | shipped | v1.2.1 blast-radius. |
| license-voice | ok this fill | Pulse v3 on 45/45. One-stat process still CAP-006 / marts / §0. |

---

## How to refresh

1. `npx tsx scripts/company-scoreboard-probe.ts`
2. Replace every figure with the printed value + the `source` field from the JSON
3. Re-score §4 from the diagnose rules in COMPANY_IMPROVEMENT.md
4. Close ledger windows whose `shipped_at + window_days` has passed
5. A change this week must name its blast-radius planes before it starts
