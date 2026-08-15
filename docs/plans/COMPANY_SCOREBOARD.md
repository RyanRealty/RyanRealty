# Company scoreboard — weekly packet

**Process:** [COMPANY_IMPROVEMENT.md](COMPANY_IMPROVEMENT.md) (THE LOOP v1.2.0)  
**Overwrite this file each week.** Do not start a dated novel.  
**Rule:** if a domain has no number, write **UNKNOWN** and the query that failed. Unreadable ≠ 0.

**Week of:** 2026-08-15  
**Fetched at:** 2026-08-15T14:14:00.319Z  
**Probe:** `npx tsx scripts/company-scoreboard-probe.ts`  
**DAL:** `collectCompanyScoreboardSignals` in `lib/data/loop/signals.ts`

---

## 1. Money and license

| Figure | Value | Source |
|---|---|---|
| CRM people (not deleted) | **22,672** | `crm_people` where `deleted=false` (paginated stage scan) |
| People created last 7d | **24** | `crm_people.created_at >= now-7d`, `deleted=false`, exact count |
| Stage mix | Nurture 20,287 · Sphere 2,338 · Past Client 32 · Active Client 12 · Trash 2 · Vendor 1 · **Lead 0** | `crm_people.stage` (Lead absent from the result = 0, not UNKNOWN) |
| GCI settlement_verified | **$384,393.35** | `tc_commissions.gci` where `status='settlement_verified'` (22 rows total) |
| GCI projected | **$15,570.00** | `tc_commissions.gci` where `status='projected'` |
| GCI all statuses | **$399,963.35** | sum of the two rows above |
| vs $1M year-1 target | **38.4%** of target on settlement_verified | target in `docs/MASTER_SPEC.md`; math = 384393.35 / 1000000 |
| Pulse methodology | **v3-2026-05-07 on 45/45 rows** | `market_pulse_live.methodology_version` — do not claim v4 |
| Delta last success | **2026-08-15T14:03:08.313Z** (~11 min before this fetch) | `sync_state.id='default'.last_delta_sync_at` |
| Full last success | **2026-08-09T02:04:03.978Z** | `sync_state.last_full_sync_at` |
| §0 / money-path miss | none recorded this fill | — |

## 2. What shipped

| Class | Domain | Predicted delta | Commit |
|---|---|---|---|
| Company ingest + `site_improvement_ledger.domain` | factory | Non-SEO classes can take a ledger row and a score | this land |

## 3. What is measuring

| Ledger row | Domain | Window closes | Metric |
|---|---|---|---|
| **11 open windows, all `seo-aeo`** | seo-aeo | UNKNOWN per-row until a Learn pass writes `actual_delta` | `site_improvement_ledger` where `actual_delta` is null. 11/11 rows. Hosted `domain` defaulted existing rows to `seo-aeo` on 2026-08-15 apply. |

No new measurement window was opened for this factory class in the same probe. Open the row when this commit lands.

## 4. What is rotting (top residuals)

Scored from this fetch + the diagnose rules in COMPANY_IMPROVEMENT.md. Not vibes.

1. **nurture** — 20,287 Nurture / **0 Lead** / 12 Active Client. Sequence table has 7 rows. The journey model is unused. Highest reach, clear gap.
2. **recruit-retain** — **3** brokers (`brokers` count). `/join` convert is **UNKNOWN** (not instrumented — not zero). No day-one scoreboard (CAP-022).
3. **social-presence** — TikTok valid through 2026-08-16T12:00Z. YouTube, LinkedIn, X, GBP **expired**. Threads / Pinterest / Nextdoor **empty**. Brain `measured=2` of 693 action rows (`ready` 420). Learn path is no longer zero; publish identity is still the class.
4. **transactions** — `tc_deals` 33. SkySlope latest `synced_at` **2026-06-10T00:35:10Z** (66 days before this fetch). Form catalog `disposition=updated` **0**. SkySlope is still the live file.
5. **sales-insights** — settlement_verified GCI **$384,393.35** vs $1M target. The number exists; the weekly packet is the first place the loop reads it.

Not in the top 5 this week: **data-sync** (delta 11 min old, healthy). **license-voice** (pulse all v3, no §0 miss this fill). **seo-aeo** (180 `target_query_benchmark` rows in 28d — ingest is alive; no CTR/position rollup in this probe, so depth candidates stay UNKNOWN until the Growth ingest step).

## 5. Matt-only

- Newsletter first cohort send (5,346 subscribers — `newsletter_subscribers` count)
- Social OAuth reconnect: YouTube, LinkedIn, X, GBP (TikTok still valid as of this fetch)
- Ad spend (Demand parked)
- Taste stops (packets, posts)
- SkySlope mutation / Closings cutover

---

## Domain snapshot

| Domain | Status | Notes |
|---|---|---|
| public-ux | UNKNOWN | Probe does not walk pages. Look is a standing grind. |
| seo-aeo | ok ingest / UNKNOWN gap | 180 GSC benchmark rows in 28d. 11 open ledger windows, all this domain, none closed. |
| leads | watch | 24 people created in 7d. That is not the same as 24 attributable leads (`classifyLeadSource` not applied in this probe). |
| nurture | rotting | Lead = 0. Nurture = 20,287. |
| social-presence | rotting | 4 expired tokens. `measured` 2. Ready backlog 420. |
| sales-insights | watch | GCI live. Not yet in a scored experiment. |
| transactions | rotting | SkySlope mirror 66 days stale. |
| broker-tools | UNKNOWN | No Today-queue count in this probe. |
| recruit-retain | rotting | 3 brokers. `/join` convert UNKNOWN. |
| data-sync | ok | Delta ~11 min old. |
| factory | shipped | This packet + domain column. |
| license-voice | ok this fill | Pulse stamp v3 on 45/45. No untraced public number in this packet. |

---

## How to refresh

1. `npx tsx scripts/company-scoreboard-probe.ts`
2. Replace every figure with the printed value + the `source` field from the JSON
3. Re-score §4 from the diagnose rules in COMPANY_IMPROVEMENT.md
4. Close ledger windows whose `shipped_at + window_days` has passed
