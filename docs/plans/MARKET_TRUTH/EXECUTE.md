# Market Truth — execution brief

**This is the single entry point. Point one agent at this file and it runs the whole job.**

**Read `DECISIONS.md` first.** It is newer than every other file here and it *overrides* them.
It closes both questions `SPEC.md` §7 still lists as open, and it corrects a load-bearing era claim
in `SPEC.md` about which years have unrecoverable on-market spans.

Two phases, in order, without stopping to ask:

**Phase A — audit (always first).** Execute `AUDIT.md` in full. Produce `AUDIT-FINDINGS.md`, commit
it, push it. You are auditing another agent's work adversarially; the brief explains why that is
warranted and where to look. **Do not build during Phase A.**

**Phase B — build.** Begin only when `AUDIT-FINDINGS.md` exists and every finding marked **blocker**
is resolved — either fixed in the package files, or explicitly waived in writing by Matt. Then work
`§4` top to bottom from the first unchecked box.

If Phase A returns a verdict of **"no — not safe to build from"**, stop at the end of Phase A, report
to Matt, and do not start Phase B.

Do not re-plan; the plan is settled. Do not re-litigate the definitions; Matt locked them
(SPEC §0, D1–D12). Everything else is open to the audit.

**Phase A status (2026-08-22):** `AUDIT-FINDINGS.md` is on `origin/main` (`fba6435d`). Verdict:
safe to build from after the listed blocker fixes. Those fixes are in `DDL.sql` / `REGISTRY.md` /
this file / `SPEC.md` §7 / `DECISIONS.md` as of the Phase B package patch. Do not re-run the audit
unless the findings file is missing.

**Read order:** `CLAUDE.md` §0 + §7 → `docs/DATA_COVERAGE_INDEX.md` → `SPEC.md` (all of it) →
`REGISTRY.md` (the predicates you will implement) → `DDL.sql` → `AUDIT-FINDINGS.md` → this file →
`PLAN.md` only if you want the background story.

---

## 1. The one-paragraph brief

Ryan Realty publishes market statistics from **9 independent computation engines** producing **38
distinct stats**, with no stat owned by any single layer. The same label resolves to different
numbers depending on which page a client opens — "days on market" is four different measurements on
Bend today (25, 58, 62, 64); "months of supply" says seller's market on the site and balanced in the
admin builder. Your job is to replace all of it with **one fact layer, one membership rule, one
metric registry, one read function, and gates that make the old way impossible** — without moving a
single published number until the reconciliation has been shown to Matt.

Matt is a licensed Oregon principal broker. A wrong published stat is a compliance risk, not a bug.
`CLAUDE.md` §0 outranks everything in this file.

---

## 2. Non-negotiables

1. **Verify before you assert.** Two claims in the original forensics were wrong and were caught only
   because someone re-derived them (SPEC §1.7, §1.1). If you cannot reproduce a number with your own
   query, do not build on it. A null result is a fact about your query first — run a second,
   differently-shaped check before concluding something does not exist.
2. **Nothing public changes** until step 5. Build alongside the existing writers, never in place of
   them, until a reconciliation report has been reviewed.
3. **Every figure carries provenance** — rows counted, method, window actually used, computed_at,
   confidence. A figure without a trace does not ship.
4. **`-- audit: <reason>`** prefixes any raw SQL against a DAL-guarded table.
5. **Mixed-case columns are double-quoted in raw SQL** (`"ClosePrice"`, `"CloseDate"`, `"City"`,
   `"StandardStatus"`, `"OnMarketDate"`) and bare in supabase-js. Getting this wrong returns nothing
   silently.
6. **Work on `main`.** Commit and push each step. Use a clean worktree if the main checkout has
   another session's uncommitted work (see §6).
7. **Never use `--no-verify`.** If a hook fails on someone else's work, use a clean worktree.

---

## 3. What you are building

```
listings (+ listing_history)          ← raw, untouched
        │
        ├─► market_fact_sale           one row per closed sale, cleaned, scoped, stamped
        ├─► market_fact_listing_span   one row per on-market episode (from listing_history)
        │
        ├─► place_membership           one row per (listing, place) — listed AND sold alike
        │
        ├─► metric registry (code)     each stat declared once: formula, population, min_n,
        │                              grains, earliest_year, window policy, exclusions
        │
        ├─► compute job                evaluates registry per (geo × segment × window × metric)
        │                              writes value + provenance + publishable + reason
        │
        └─► getMetric()                the ONLY read path for every consumer
```

Full detail in `SPEC.md` §3. Do not invent an alternative architecture.

---

## 4. Steps

Work top to bottom. Tick a box only when its **Done when** clause is literally true.

### Step 0 — apply `DDL.sql`

- [x] Apply the schema after the audit's blockers are cleared. It has never been run
      (`AUDIT.md` §2.2) — expect to fix it, and record what you changed.

**Done when:** all five objects exist and the `place_membership` one-primary index holds against a
backfill dry run.

Applied 2026-08-22 as `supabase/migrations/20260822230000_market_truth_foundation.sql` on hosted
`dwvlophlbvvygjfxcrhm`. Five tables + `market_in_service_area()` (STABLE, 16 cities). RLS on, anon
revoked. Dry-run: 27,018 current-primary subdivision rows for 2021+ service-area closed geocoded
sales (matches the 27,018 in-any-subdivision count); unique index held (27,018 listings = 27,018
current primaries). Changes from the un-applied draft: 16-city seed not 18; `exclusion_reasons
text[]`; `complete_through` on the sale fact; `definition_id` in `market_metric` PK; one-current-
primary unique; date-only span CHECK; RLS/`REVOKE`.

### Step 1 — `market_fact_sale`

Generalise `sale_pricing_facts` (already one row per closed CO residential sale, 1996+, with
normalised product/lot/story/water/sewer/HOA classes) to cover **all segments** (SPEC D7).

- [x] Apply the mandatory exclusions of SPEC §3.4 — service-area scope, `PropertyType='G'`
      (commercial lease, median ClosePrice $2.01), fractional interests (TIC/timeshare/deeded week,
      median $/sqft $19.01), order-of-magnitude price typos, $1 auction lists, retroactive off-market
      entries, duplicate parcel+date events (~0.5–1%), `sqft <= 0` for $/sqft only.
- [x] Record every exclusion as a **counted, queryable reason** — never a silent `WHERE`.
- [x] Stamp `complete_through` so a half-ingested month can never be read as complete.
- [x] Fix the refresh: a **recency lane** (last 90 days, every run) plus the slow full-history lane.
      Today the full sweep takes ~23 days and recent closes enter the corpus weeks late.

**Done when:** a query returns, per year 1997→now, the row count kept and the count excluded by each
named reason; and `complete_through` is within 48 hours.

Loaded 2026-08-22 via `refresh_market_fact_sale(since, until)` year batches.
`complete_through = 2026-08-21` (Pacific yesterday). Recency lane hooked on the existing
`/api/cron/refresh-sale-pricing-facts` 6-hour cron (`p_since = today-90`). Keep-one only
collapses a **real** parcel + same close date + same rounded close price (AUDIT: raw parcel
ate new-construction parent lots). `price_typo` drops the row (close is the digit-shift);
`price_typo_list` / `auction_list` / `retroactive_entry` / `sqft_nonpositive` stay on
publishable rows for per-stat exclusion. 1997–2026 closed rows in the table, queryable as
`unnest(exclusion_reasons)` grouped by `extract(year from close_date)`. Concession flag from
`details` is **not** in this lane (TOAST timeout on full history).

### Step 2 — `market_fact_listing_span`

One row per on-market episode, reconstructed from `listing_history` (3.9M events, 546,300 listings).

- [x] Emit `span_source` (`history` | `listing_row`) and `first_on_market_confidence`
      (`recovered` | `assumed`). **73.0%** of relisted listings carry history predating the current
      `OnMarketDate`, recovering a median **102 days** (SPEC §3.2). `listing_history` covers 99.5%.
- [x] Never read `status_change_timestamp` — corrupted by bulk platform-migration stamps.
      `off_market_date` survived intact.
- [x] Flag the 28,169 listings whose `off_market_date` precedes their on-market date, and the 150
      zombie Actives whose own payload says Expired/Cancelled/Pending/Closed.

**Done when:** reconstructing active inventory for 2026-08-10 lands within 1% of the stored snapshot,
and a per-year table shows what share of spans are `recovered` vs `assumed`.

Loaded 2026-08-22 as `refresh_market_fact_listing_span(p_after, p_limit, p_modified_since)`.
**652,331** spans / **595,381** listings. Same-day ON/OFF events order by `event_date`, not
date+uuid (uuid order left Closed listings open). Last episode stays open when
`StandardStatus` is Active / Active Under Contract even if `listings.off_market_date` is
stale. Recency lane: same 6-hour cron, last 90 days of `ModificationTimestamp`.
Flags: `inverted_listing_dates` on **28,169** listings (date-cast, AUDIT F19);
`zombie_active` on **149** listings / 157 spans (live Active payload-terminal; EXECUTE 150).
As-of **2026-08-10** 24-city `ILIKE Active%`: snapshot **3,376**, reconstructed **3,352**
(**0.71%**). Recovered vs assumed by on-market year (1997–2026): recovered 81–92% through
2019, then 40.6% (2020) → 31.6% (2026) as assumed `listing_row` takes over — the D11
2021-onward unrecoverable era.

### Step 3 — `place_membership`

- [x] Cities resolve by **MLS city text** (SPEC D5). Sub-city places by polygon, falling back to alias.
- [x] `is_primary` resolves multi-polygon overlap — **19.5% of sales sit inside 2+ subdivision
      polygons (max 8)**, 17.3% inside 2+ neighborhoods. Smallest containing polygon wins. Only
      primary rows may be summed.
- [x] Cover **listed and sold alike** from the same table — this is what makes SPEC §1.4's absorption
      defect structurally impossible.
- [x] One canonical hyphen slug alphabet. `market_stats_cache` uses `la pine`, `boundaries` uses
      `la-pine`. Note the verified scope: only **2 of 20** city slugs fail for that reason — the other
      9 misses have no `boundaries` row at all, and the alphabets are already reconciled in code by
      `lib/market/city-cache-slug.ts` under the `ci:city-cache-slug` gate.
- [x] Stamp `method` and `confidence`. A polygon we have not checked is `unverified` (Broken Top's
      boundary measures 17.96 sq mi against Bend's 35.45).

**Done when:** a disagreement report exists comparing membership against every current attribution
path, with counts per place and per disagreement type.

Loaded 2026-08-22 via `refresh_place_membership` (397 batches, **2,753,274** rows). One-current-
primary unique held. Report: `MEMBERSHIP_DISAGREEMENT.md`.

### Step 4 — Registry + compute job (shadow)

- [x] Implement **`REGISTRY.md` §3** verbatim — all 28 stats with their formula, population, `min_n`,
      grains and earliest year. The predicates are written; do not re-derive them, but DO run them
      (they have never been executed — see `AUDIT.md` §2.1).
- [x] Vocabulary from `REGISTRY.md` §1–§2: the twelve segment predicates, the `closed` and `active`
      populations, and `market_service_area` (a **city list**, not a county filter — county is
      unusable, see `DDL.sql`).
- [x] Sample floors and window ladder per `REGISTRY.md` §2.3 — but treat them as **proposals the
      audit may move** (`AUDIT.md` §2.4).
- [x] Days on market = `purchase_contract_date − OnMarketDate`, named `days_to_contract` (D2),
      earliest **2006**. Note `market_stats_cache.median_dom` is ALREADY the correct list-to-pending
      basis — the defect is the raw `"DaysOnMarket"` column and the video and beacon paths.
- [x] Write to a **shadow store**. Nothing repointed.

**Done when:** a reconciliation report lists every live figure beside its shadow value, the delta, and
a one-line reason for each difference — defect found, or definition changed.

Shadow job `compute_market_metrics_shadow` wrote **728** `mt-v1` cells on 2026-08-22
(`complete_through=2026-08-21`). Reader: `getMetric()` in `lib/data/market-truth/getMetric.ts`.
Registry constants in `lib/data/market-truth/registry.ts` (30 `stat_id`s including
`market_verdict`). Numeric closed + active stats are computed; mix/feature/YoY cells are
registry-declared and land as a follow-on compute. Recon: `RECON.md`. `/sell` reads
`getMetric` as of 2026-08-23.

### Step 5 — Migrate consumers (Matt reviews the delta report first)

- [x] **`/sell` is migration #1** — live 2026-08-22: **"a seller's market · 488 homes · 3.5 months"**
      from the city-limits polygon (pulse 488 / 3.54). MLS-city **detached** (D1) is **775 homes /
      4.42 months / balanced**. The 988 / 4.52 figure is the mixed `PropertyType='A'` bucket and
      was marked `[was wrong]` in SPEC — do not migrate to it (AUDIT B3).
      Flipped 2026-08-23: `/sell` reads `getSellBendMarket()` → `getMetric` (detached, MLS City
      Bend). Live cells: **775 / 4.45 / balanced**. Dataset JSON-LD and `/data/market/city/bend`
      overlay the same three. Never falls back to pulse.
- [x] Then CMA and BPO — city-grain live stats match `/sell` (`getCityDetachedMarket`).
      Subdivision pace uses `days_to_pending`. Extras filter detached (D1). Comps still
      fetch PropertyType A then `keepSameProductType` in memory.
- [x] Then place pages, market hub, newsletter, video producers, JSON feeds, admin.
      City/region public figures, hub, JSON feed, newsletter/CRM city blocks,
      GBP drafts, mega menu, and the cities index share detached `getMetric`
      cells with `/sell`. Neighborhood / community MOS stays withheld
      (`geo-grain-trust` / REGISTRY §4). Inventory on those pages is the
      address-set, not pulse. CMA comps still fetch PropertyType A then
      `keepSameProductType` in memory.
- [x] Each surface proves reconciliation before it flips.
      Local webpack 2026-08-23: `/` Bend 774 / $915,000; `/cities` same plus
      balanced; `/cities/bend` HUD 4.5 months balanced $915,000; `/sell` and
      `/housing-market/bend` 774 / 4.5 / balanced. Pulse 488 absent. Hub
      region 1,825 / 5.7. Residual "seller" copy is the MOS_THRESHOLD_CLAUSE.

**Done when:** `/sell` reads `getMetric` for active count, months of supply, and verdict; the three
figures match the shadow recon report Matt reviewed; JSON-LD / `/data/market` for Bend still agree
with the page. Other surfaces remain on the old store until their own recon line exists.

### Step 6 — Gates (baseline may only shrink)

- [x] No writer computes geography inline.
- [x] No consumer reads a market store directly.
- [x] Every rendered figure carries provenance.
- [x] Mixed-method membership ⇒ non-publishable (retires `lib/market/geo-grain-trust.ts`).
- [x] `min_n` and window policy live only in the registry.
- [x] Dead-column gate: `CumulativeDaysOnMarket`, consumer-surface `"DaysOnMarket"`, and any
      `mls_source = 'central_oregon'` filter (it is a constant on 100% of rows, including all 93,233
      Jackson County ones).
- [x] **Freshness gate** — a metric whose `complete_through` is older than its window fails rather
      than serving stale data. This is the gate that would have caught the dead cube cron and the
      boundary job that stopped on 2026-04-30.

**Done when:** each gate has a failing fixture in `scripts/` (or `ci:*`) and a counted allowlist
that may only shrink. Gate 2's baseline is the frozen inventory of direct cache/pulse reads.

`ci:market-truth` (`scripts/check-market-truth.mjs`). Frozen 2026-08-22: **33** direct
store reads, **7** consumer CDOM hits, **0** consumer `"DaysOnMarket"`, **0** `mls_source`
filters. Fixtures in `scripts/__tests__/check-market-truth.test.mjs`. `getMetric` returns
provenance and nulls stale `complete_through`. Shadow compute does not write neighborhood
or subdivision price stats. `geo-grain-trust.ts` stays until neighborhood migrates.

### Step 7 — Repairs folded in (not hotfixes, per SPEC D8)

- [x] Restart boundary assignment (4.3% coverage on Actives since 2026-05-01).
- [x] Restart the analytics cube cron (has never run; calendar 2026 has 0 rows).
- [x] Normalise `buyer_financing` (April-2026 format break, 26 `[object Object]` rows).
- [x] `close_price_per_sqft = 0` → NULL on 65,577 rows.
- [x] Quarantine the 883 structurally bare rows and 150 zombie Actives.
- [x] Retire the two permanent-zero geographies; unify the slug alphabet.
- [x] Correct `lib/property-type.ts`: **E = Farm** (not commercial), **G = commercial Lease**.
- [x] Instrument listing/place views through `user_events`; drop the empty `listing_views` table.

**Done when:** each repair has a counted before/after query in the commit, and 883 structurally
bare is either found and quarantined or struck from the list (AUDIT: unverified).

2026-08-22 counted: `buyer_financing` object-Object **26 → 0**; `close_price_per_sqft = 0`
**67,079 → 0** (AUDIT F14 live count; replica-role so the derived-field trigger did not
re-fire). Zombies already flagged on spans (**149** listings). **883 structurally bare
struck** (AUDIT: unverified). `listing_views` was **0** rows; dropped; `recordListingView`
writes `user_events.event_type='listing_view'`.

2026-08-23 counted:
- **Boundary assignment:** Actives on/after 2026-05-01 with `boundary_city` **182 / 4333
  (4.2%) → 4322 / 4333 (99.7%)**. The 11 still-null rows have no coordinates.
  Of the tagged: **1121** inside a city polygon (smallest valid `ST_Within`), **3201**
  `Outside Boundaries`. Recency: `refresh_listing_boundary_tags` on the 6-hour
  sale-pricing-facts cron (last 90 days).
- **Cube cron:** spawn of `scripts/analytics/*.mjs` never reached the Vercel
  filesystem (SPEC §1.8). Cron now calls `rebuildAnalyticsMarts` in-process.
  Calendar 2026 **0 → 63** `analytics_mart_market_annual` cells, **3,466** closed
  CO rows, `computed_at=2026-08-23`. 2024 parity vs EDA: **0.000%** (5,707 / $3.931B).
- **Zero geos / slug alphabet:** Tumalo and Crooked River Ranch (0 MLS `City` rows)
  dropped from the cube closed-city `IN` list. Crooked River (no "Ranch") stays as
  an analytics city grain (AUDIT F16 / D14). Cube city `geo_slug` stays hyphen
  (URL alphabet). Cache space form (`la pine`) stays behind `city-cache-slug.ts`.

### Step 8 — Canon corrections

- [x] `CLAUDE.md` §0 — "SFR convention is `PropertyType='A'`" is wrong per D1. Restate.
- [x] `CLAUDE.md` §7 — remove `CumulativeDaysOnMarket` from the quoted-column list; add the
      `"DaysOnMarket"` warning.
- [x] `docs/DATABASE_FOR_AI_AGENTS.md` — mark CDOM dead, `mls_source` a constant, `listings` a
      two-market table.

**Done when:** `rg CumulativeDaysOnMarket CLAUDE.md` is empty; `"DaysOnMarket"` warning is in §7;
`DATABASE_FOR_AI_AGENTS.md` states CDOM dead, `mls_source` constant, two-market table. (SFR
restatement in CLAUDE.md §0 is already on `origin/main` as of `526dac93`.)

### Grind 2026-08-23c — remaining factory + leftover consumers

**Done when a real user can open `/sell`, `/cities/bend`, `/housing-market/bend`, a Bend CMA, and a newsletter city block and see the same detached active / MoS / verdict; YoY and mix cells exist in `market_metric` so leaderboards are not empty; a townhouse CMA does not SQL-force SFR comps; a `getDetachedMarket` miss cannot print pulse 488 as if it were detached.**

2026-08-23c landed: YoY/mix/feature cells (**5110** mt-v1 rows); city overlay miss withholds MOS/verdict; OG/dashboard/admin inventory from detached; CMA comps SQL by subject subtype; producer recipes no longer median CDOM for city MOS.

### Grind 2026-08-23d — close the remaining factory + admin board + zip

**Done when:** zip cells exist in `market_metric` (PostalCode membership, sample-gated, no county/neighborhood/subdivision prices); leftover honest stats that have columns are written (`new_listings`, price-cut, days_to_close, sale_to_original, mom with stated seasonality); Matt can open an admin city leaderboard and see YoY ranks from `getCityLeaderboard`; overlay miss does not print 0 homes; `/zip/[zip]` HUD uses getMetric when publishable. Neighborhood MOS and county stay unpublished (REGISTRY §4, F18). Workers do not tick this file.

2026-08-23d landed: shadow compute `20260823150000` wrote **14512** mt-v1 cells (`period_end=2026-08-23`, `zip_scope=canonical_10`). Bend detached still **774 / 4.47 / balanced**, YoY **−1.94%**. Canonical ZIP detached actives: 97701 176, 97702 247, 97703 227, 97707 180, 97739 170, 97741 82, 97754 181, 97756 274, 97759 141, 97760 51. Leftover Bend detached 12mo: new_listings 2956, price-cut share 46.6%, median cut 5.9%, days-to-close 64, sale-to-original 96.9%, unadjusted MoM **−0.65%** (method states ±3.4% seasonal). Neighborhood/subdivision/county cells **0**. Overlay miss withholds `activeCount: null` (not 0). `/admin/analytics/city-leaderboard` reads `getCityLeaderboard` (one city per rank, 12mo preferred). `/zip/[zip]` HUD overlays getMetric when publishable.

### Grind 2026-08-23e — remaining miss/existence holes (next)

**Done when:** a city MT miss cannot print pulse/MV polygon inventory (488) on `/cities`, mega-menu, or homepage town rows as if it were detached; existence still does not 404 the city page. Neighborhood MOS and county stay unpublished.

2026-08-23e landed: city snapshots keep the door on miss (`if (!snapshot) notFound()` still works) and set `activeSfrCount` / median **null** instead of pulse 488. Inventory overlay uses publishable `active_count` even when MOS is below min_n (Terrebonne **51** / $799k with MOS sample 28 withheld). Homepage town rows: Bend 774, La Pine 170, Redmond 274, Sunriver 56, Sisters 110, Terrebonne 51. Neighborhood MOS and county stay unpublished.

### Grind 2026-08-23f — pulse overlay layers + internal segment board

**Done when:** city/region pulse overlay publishes inventory (active + median list) from Market Truth even when MOS is below min_n; MOS/verdict stay null until publishable; homepage/hub remainder omitted-city counts are those MT inventory cells (Terrebonne 51, not pulse 6); Matt can open an admin city-segment board and see condo/townhome/etc cells from `getMetric` (internal only). Neighborhood MOS and county stay unpublished. Public `/cities` stays detached. Workers do not tick this file.

2026-08-23f landed: `getDetachedOverlays` + `overlayDetachedLayers` — inventory and MOS are independent. Pulse/JSON/browse use that. Admin `/admin/analytics/city-segments` reads 11 sale segments from `market_metric` mt-v1. Neighborhood MOS and county stay unpublished.

### Grind 2026-08-23g — public city condo/townhome (Step 9 start)

**Done when:** `/cities/bend` and `/housing-market/bend` show sample-gated condo and townhome inventory from Market Truth (Bend condo 66 / 12.8 / buyer, townhome 78 / 3.6 / seller) next to the detached HUD; a miss omits the row (not 0); labels name the segment; detached HUD stays 774 / 4.5 / balanced. Neighborhood MOS and county stay unpublished. Public city hero stays detached houses. Workers do not tick this file.

2026-08-23g landed: `getPublicPlaceSegments` reads publishable mt-v1 condo/townhome cells. `/cities/bend` HUD extra panel 66 condos $326,000 · 12.8 months · buyer's / 78 townhomes $699,000 · 3.6 months · seller's beside detached 774 / 4.5 / balanced. `/housing-market/bend` and the region hub print the same sample-gated figures. Madras omits condos (no 0). Neighborhood MOS and county stay unpublished.

### Grind 2026-08-23h — leftover 12-month pace on public city/region (not pulse overlay)

**Done when:** `/cities/bend` and `/housing-market/bend` show labeled 12-month detached leftover stats from Market Truth (days to contract 28, closed 2095, new listings 2956, price-cut share 46.6%, days to close 64) without replacing pulse 30-day closed or pulse days-to-pending. A miss omits the stat (not 0). Window is named. Neighborhood MOS and county stay unpublished. Workers do not tick this file.

2026-08-23h landed: `getPublicDetachedPace` reads 12-month mt-v1 leftover cells. `/cities/bend` HUD panel 28 / 2,095 / 2,956 / 46.6% / 64. `/housing-market/bend` same figures, labeled 12 months. Pulse 30-day closed and days-to-pending stay. Neighborhood MOS and county stay unpublished.

### Grind 2026-08-23i — zip condo/townhome + 12-month pace; do not label leftover as 30-day

**Done when:** `/zip/97701` shows sample-gated condo/townhome from Market Truth beside the detached HUD, plus labeled 12-month leftover pace (days to contract 27, closed 564, new listings 784). HUD "New · 30 days" is tile 30-day new, not 12-month `new_listings`. A miss omits the row. Neighborhood MOS and county stay unpublished. Workers do not tick this file.

2026-08-23i landed: `/zip/97701` HUD 176 detached / 8 condos / 18 townhomes ($436,998 · 2.1 months · seller's). 12-month pace 27 / 564 / 784 / 46.8% / 65. New · 30 days is 63 (tiles), not 784. Neighborhood MOS and county stay unpublished.

### Grind 2026-08-23j — public 12-month YoY median on leftover pace

**Done when:** city, housing-market, and zip leftover panels print signed 12-month YoY median close from Market Truth (Bend -1.9%) without printing unadjusted MoM. A miss omits the stat. Neighborhood MOS and county stay unpublished. Workers do not tick this file.

2026-08-23j landed: leftover pace includes YoY median close. `/cities/bend` prints **-1.9%** YoY median close · 12 months. Unadjusted MoM stays off public. Neighborhood MOS and county stay unpublished.

### Grind 2026-08-23k — remaining leftover stats + remaining public sale segments

**Done when:** `/cities/bend` leftover panel includes pending now, inventory age, sale-to-original, median price cut, cash share, median close, ppsf, YoY sold; extra product types include land / manufactured / farm / commercial / business / 2-4 unit (not all_residential, not commercial_lease); browse hrefs use propertyType or propertySubTypes; `/sell` prints leftover Bend pace; a miss omits the row. Neighborhood MOS and county stay unpublished. Workers do not tick this file.

2026-08-23k landed: leftover panel 311 pending, 72 days age, 28 / 2,095 / $760,000 / $399 / 2,956 / 46.6% / 5.9% / 96.9% / 99.1% / 27.6% / 64 / -1.9% / +1.8%. Extra types 66 condos, 78 townhomes, 44 manufactured on land, 21 in parks, 21 2-4 unit, 198 lots, 9 farms, 17 commercial, 3 businesses. `/sell` prints leftover. Neighborhood MOS and county stay unpublished.

### Grind 2026-08-23l — CMA leftover overlay + months-of-supply extra MOS

**Done when:** a city-grain CMA uses leftover MT sale-to-original, YoY median, pending, median close, and ppsf instead of cache/pulse when publishable; `/months-of-supply` prints extra product-type MOS from Market Truth when sample-gated. Neighborhood MOS and county stay unpublished. Workers do not tick this file.

2026-08-23l landed: CMA city grain overlays leftover MT. `/months-of-supply` extra MOS 14.2 condos, 4.8 townhomes, 6.3 manufactured on land, 3.7 in parks, 18.7 lots. Neighborhood MOS and county stay unpublished.

### Grind 2026-08-23m — polygon repair + remaining report/listing leftover

**Done when:** `bend-southeast-bend` is ST_IsValid; `broken-top` neighborhood is the plat union (~491 acres, not 11,495); `/housing-market/annual-review` prints extra MOS + leftover; listing city context prints pending now and 12-month days to contract when publishable. Neighborhood MOS still unpublished (overlaps remain). County unpublished. Workers do not tick this file.

2026-08-23m landed: `bend-southeast-bend` ST_IsValid (1318.1 acres). `broken-top` **11,495.7 → 491.3 acres** (49 plats). Neighborhood overlap pairs **38 → 25**. Annual-review extra MOS 14.2 condos / 4.8 townhomes / 6.3 manufactured on land / 3.7 in parks / 18.7 lots. Listing city context reads leftover. Neighborhood MOS still unpublished. County unpublished.

### Grind 2026-08-23n — spatial-discovery hulls + remaining region leftover

**Done when:** Northwest Crossing, Eagle Crest, Caldera Springs, Black Butte Ranch, Pronghorn, Crosswater, and Vandevert Ranch neighborhood polygons are Deschutes County GIS plat unions (not Spark hulls); `/housing-market/central-oregon` and `/housing-market/reports` print extra product-type MOS/inventory + leftover; seller LP prints labeled leftover beside pulse 90d/30d/DTP. Neighborhood MOS still unpublished. County unpublished. Workers do not tick this file.

2026-08-23n landed: NWX **4,857 → 342 acres**; Eagle Crest **6,371 → 1,643**; Caldera Springs **3,942 → 1,019**; Black Butte Ranch **2,659 → 1,185**; Pronghorn **1,583 → 370**; Crosswater **1,012 → 512**; Vandevert Ranch **1,072 → 397**. Overlap pairs **25 → 12**. `/housing-market/central-oregon` extra inventory 118 condos · 14.2 months + leftover (32 days to contract · 12 months). `/housing-market/reports` extra MOS 14.2 condos. Seller LP leftover $760,000 / 96.9% / -1.9%. Remainder hulls: Sunriver, Three Rivers, Brasada, Widgi Creek (no complete plat set). Neighborhood MOS still unpublished. County unpublished.

### Grind 2026-08-23o — leftover on remaining market LPs

**Done when:** `/lp/expired-listing` and `/lp/buyer-listing-alerts` print labeled leftover (pending now, days to contract · 12 months) beside pulse DTP / overlay inventory. Pulse 30-day and days-to-pending stay. Neighborhood MOS still unpublished. County unpublished. Workers do not tick this file.

2026-08-23o landed: expired LP leftover 28 days to contract · 12 months / 96.9% sale to original. Buyer LP leftover days to contract + YoY median -1.9%. Pulse DTP stays. Neighborhood MOS still unpublished. County unpublished.

### Grind 2026-08-23p — leftover JSON feed + months-of-supply pace

**Done when:** `/data/market/city/bend` includes leftover 12-month pace (pending now, days to contract) without replacing pulse 30-day sold or days-to-pending; neighborhood JSON has no leftover and no invented MOS; `/months-of-supply` prints leftover pace beside extra product-type MOS. Neighborhood MOS still unpublished. County unpublished. Workers do not tick this file.

2026-08-23p landed: `/data/market/city/bend` leftover 311 pending / 28 days to contract / 2,095 closed / $760,000; pulse sold 30d 136 and days-to-pending 18 stay. Tetherow JSON leftover null. `/months-of-supply` leftover 32 days to contract · 12 months beside 14.2 condos MOS. Neighborhood MOS still unpublished. County unpublished.

### Grind 2026-08-23q — leftover + extra segments on plain city search

**Done when:** `/homes-for-sale/bend` prints labeled 12-month leftover pace and sample-gated extra product types beside the pulse HUD. Pulse 30-day sold and typical days to pending stay. Preset and subdivision search pages do not fetch leftover. Neighborhood MOS unpublished. County unpublished. Workers do not tick this file.

2026-08-23q landed: `/homes-for-sale/bend` leftover 311 pending / days to contract · 12 months / 2,095 closed beside extra inventory 66 condos · 12.8 months and 78 townhomes · 3.6 months. Pulse typical days to pending and closed last 30 days stay. `/homes-for-sale/bend/under-500k` has no leftover band. Neighborhood MOS still unpublished. County unpublished.

### Grind 2026-08-23r — extra segments on JSON feed, /sell, listing, market LPs

**Done when:** city/region JSON carries sample-gated extra product types beside leftover (neighborhood extraSegments null); `/sell`, listing city context, and seller/expired/buyer LPs print extra types beside leftover. Pulse 30-day and days-to-pending stay. Neighborhood MOS unpublished. County unpublished. Workers do not tick this file.

2026-08-23r landed: `/data/market/city/bend` extraSegments condo 66 / 12.8 months and townhome 78 / 3.6 months beside leftover 311 pending. Pulse days-to-pending 18 and sold 30d stay. Tetherow extraSegments null. `/sell`, seller LP, expired LP, and buyer LP print condos/townhomes for sale beside leftover. Neighborhood MOS still unpublished. County unpublished.

### Grind 2026-08-23s — leftover + extra types on /cities featured bands

**Done when:** `/cities` region hero prints leftover pending / days to contract · 12 months beside overlaid inventory and MOS; featured city rows print leftover pending/dtc and sample-gated condo/townhome counts. Pulse active-listing age stays. Neighborhood MOS unpublished. County unpublished. Workers do not tick this file.

2026-08-23s landed: `/cities` region hero leftover Pending · now and Days to contract · 12 months beside months of supply. Featured Bend leftover 311 pending plus 66 condos / 78 townhomes. Pulse active-listing age stays. Neighborhood MOS still unpublished. County unpublished.

### Grind 2026-08-23t — leftover + extra types beside the homepage HUD

**Done when:** `/` KbMarketHud stays detached (pulse 30-day / DTP / overlay MOS) and prints sample-gated extra product types plus labeled leftover pace as HUD children. Neighborhood MOS unpublished. County unpublished. Workers do not tick this file.

2026-08-23t landed: homepage HUD children leftover (region days to contract 32 · 12 months) plus extra types (118 condos · 14.2 months). Detached HUD / pulse 30-day / median to pending stay. Neighborhood MOS still unpublished. County unpublished. Remainder hulls still have no complete plat set (Sunriver 79 plat acres vs 10,113 hull; Brasada / Three Rivers / Widgi 0 plats).

### Grind 2026-08-23u — retrieve official GIS for remaining Spark hulls

**Done when:** Sunriver, Three Rivers, Widgi Creek, and Brasada Ranch neighborhood polygons are official GIS (not Spark hulls); overlap pairs drop; neighborhood MOS still unpublished; place_membership not rebuilt yet. County unpublished. Workers do not tick this file.

2026-08-23u landed: Sunriver **10,113 → 3,744 acres** (Deschutes Unincorporated Communities SUNRIVER, minus Crosswater plat sliver); Three Rivers **15,703 → 2,520** (Deschutes River Recreation Homesites plat union); Widgi Creek **1,276 → 317** (Inn of the 7th Mountain unincorporated community); Brasada Ranch **16,126 → 888** (Crook County GIS subdivision). Overlap pairs **12 → 4** (nested community-in-district only). On `origin/main` as `a02c7d98`. Neighborhood MOS still unpublished. County unpublished. `place_membership` rebuild started 2026-08-23 (`--no-truncate` keyset against live hulls).

### Grind 2026-08-23v — rebuild place_membership against GIS hulls

**Done when:** `refresh_place_membership` keyset finishes against the 23u hulls; one-current-primary unique holds; Sunriver / Three Rivers / Widgi Creek / Brasada Ranch have polygon membership; nested remainder is `is_primary` = smallest containing neighborhood (do not ST_Difference community out of a city district). Neighborhood MOS still unpublished. County unpublished. Workers do not tick this file.

2026-08-23v landed: `refresh_place_membership` **397** batches, **2,680,623** rows (was 2,753,274). Duplicate current primaries **0**. Neighborhood polygon rows **200,976 → 124,196** (tighter hulls). Sunriver primary **10,228** / **56** detached active; Three Rivers **9,239** / **67**; Widgi Creek **1,511** / **10**; Brasada Ranch **2,692** / **41**. Nested remainder is `is_primary` = smallest. Neighborhood MOS still unpublished.

### Grind 2026-08-23w — neighborhood leftover compute + community/neighborhood leftover overlay

**Done when:** neighborhood mt-v1 leftover cells exist; MOS/verdict/absorption are not publishable; `/communities/tetherow` and `/cities/bend/{slug}` print labeled leftover when sample-gated; city Bend detached stays 774; neighborhood JSON leftover stays null; extra types stay off this grain. County unpublished. Workers do not tick this file.

2026-08-23w landed: `compute_market_metrics_neighborhood_shadow` wrote **11056** neighborhood cells (`period_end=2026-08-23`). MOS **0** publishable (`neighborhood_mos_unpublished`). Bend detached still **774**. Sunriver leftover 56 active / 16 pending / 37 days to contract. Community and neighborhood HUDs print leftover beside pulse DTP. JSON neighborhood leftover stays null.

### Grind 2026-08-23x — neighborhood MOS (sample-gated) + leftover JSON + extra types + cron

**Done when:** neighborhood MOS cells inherit registry min_n from the same `is_primary` membership as actives (proof: Sunriver 56 / 45 / 7.47); `/communities/sunriver` and neighborhood JSON overlay leftover + extra types; pulse MOS is withheld unless headlines assemble; MOS below min_n omits (Tetherow 16 closes); compute runs on a 6-hour cron. County unpublished. Workers do not tick this file.

2026-08-23x landed: neighborhood MOS same-source proof (membership actives = cell MOS). Detached MOS publishable **15** / withheld **13** (`below_min_n`). Sunriver **7.47** (n=45), Three Rivers **11.17** (n=36), Tetherow withheld (n=16). Leftover + extra types on community/neighborhood HUDs and neighborhood JSON. Pulse MOS untrusted. Cron `/api/cron/compute-neighborhood-metrics` at `40 */6`. Bend detached still **774**. County unpublished. HUD+FAQ MOS gated through `publishMonthsOfSupply({ source: 'market-truth' })`.

### Grind 2026-08-23y — subdivision counts-only grain

**Done when:** dedicated compute writes subdivision `active_count` / `pending_count` / `closed_count` from `place_membership is_primary` (no medians, no MOS, no verdict); a timeout cannot wipe city/neighborhood cells; `/subdivisions/{gis-slug}` prints labeled counts when publishable; MLS-name hero inventory stays the listing SoR. County unpublished. Workers do not tick this file.

2026-08-23y landed: `compute_market_metrics_subdivision_shadow` wrote **3462** count cells in 5.6s (`period_end=2026-08-23`; 1179 active / 481 pending / 1802 closed; no price/MOS/verdict). Bend detached still **774**. Neighborhood MOS still **15** publishable. `/subdivisions/oregon-water-wonderland-unit-2` prints 20 active / 4 pending / 24 closed, labeled recorded plat. Cron `/api/cron/compute-subdivision-metrics` at `50 */6`. County unpublished.

### Grind 2026-08-23z — withhold subdivision closed-sale prices

**Done when:** `/subdivisions/[slug]` yearly history, chart-room, and stats band publish closed counts only; `publishSubdivisionClosedPrice` withholds median close and YoY of that median; vs-area median card is gone; peer rank is by sold count. Live list median of the plat's own on-market inventory stays on `publishPlatFigures`. County unpublished. Workers do not tick this file.

2026-08-23z landed: `/subdivisions/kitty-hawk` 52 closings 1997–2024, no median column, chart source "No median price is charted". `/subdivisions/ridge-at-eagle-crest` and `/subdivisions/sunrise-village` same withhold. Peer rank is sold count. Gate `ci:publish-subdivision-closed-price`. Bend detached still **774**. County unpublished.

### Step 9 — Then, and only then, the moat

- [ ] Granular surfaces: every segment × every grain, sample-gated.
      2026-08-23: city + region cells now cover 11 REGISTRY segments
      (detached, condo, townhome, manufactured_land, manufactured_park,
      multifamily_2_4, land, farm, commercial_sale, business, all_residential).
      Shadow compute wrote **14512** mt-v1 cells (`period_end=2026-08-23`) including
      YoY, leftover honest stats, zip grain (canonical 10), mix/feature floors.
      Bend detached YoY median **−1.94%**.
      Zip grain membership is GO (PostalCode, not polygons). County is not.
      Bend detached still **774 / 4.47 / balanced**. Bend condo 66 / 12.8 / buyer.
      Bend townhome 78 / 3.6 / seller. Public extra segments are condo +
      townhome beside the detached HUD. Hero stays detached houses.
      Neighborhood leftover and extra types overlay sample-gated.
      Neighborhood MOS publishes only when 180-day closes clear min_n 30
      (Sunriver 7.47, Three Rivers 11.17). Pulse MOS stays untrusted.
      Subdivision grain is counts-only (3462 cells; no prices/MOS).
      County unpublished. `commercial_lease` (G) stays out.
- [x] Leaderboards as registry queries: best performing (YoY median), most expensive, biggest movers,
      fastest to contract, most price cuts, most new inventory.
- [x] Agent/office share — **internal only** (Matt, 2026-08-22): admin and listing presentations, not
      the public site. Resolve `office_id` first; every row is currently unresolved and the MLS
      placeholder "No Office" ranks as a brokerage.

**Done when:** leaderboards are registry queries with `min_n` inherited; office share is behind
admin auth; `office_id` is populated or "No Office" is suppressed; no public surface lists a
brokerage rank.

`getCityLeaderboard({stat})` in `lib/data/market-truth/leaderboards.ts` reads `market_metric`
with the registry `min_n`. YoY / movers land when those cells exist in the compute pass.
`getCoOfficeShareMerged` skips the MLS placeholder `"No Office"`. Admin competition desk
stays behind `/admin`. **2026-08-23:** mart `office_id` **9412 / 12370** populated from
`analytics_dim_office` (canonical ∪ aliases); **0** `"No Office"` rows remain (50 deleted).
2026 sides: **318 / 389** resolved. Granular public grains wait on Step 5.

---

## 5. Definition of done for the whole program

- One read path. `getMetric()` is the only way any surface obtains a market figure.
- Every published figure traces to rows, method and window.
- The same question asked twice, anywhere in the estate, returns the same number.
- A new metric is a registry entry, and it is correct on arrival because it inherits membership,
  windows, floors and provenance.
- The gates make the old way fail the build.

---

## 6. Practical notes

- The main checkout often carries another session's uncommitted work. If a pre-commit hook fails on
  files you did not touch, create a clean worktree off `origin/main`, do the work there, commit
  (hooks run clean), `npm run push`, then `git push origin HEAD:main` and remove the worktree.
- `npm run push` runs gates + lint + stamps a marker before the SSH push. If it fails on
  `ci:process-canon`, someone landed unregistered plan docs — register them in
  `docs/DEVELOPMENT_PROCESS.md` "Registered plan documents" rather than bypassing.
- Supabase project id: `dwvlophlbvvygjfxcrhm`.
- Do not query `information_schema` — read `docs/DATABASE_SCHEMA_SNAPSHOT.md`.
- Post progress by ticking boxes in this file and committing it. This file is the live board.
