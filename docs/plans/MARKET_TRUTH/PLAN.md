# Market Truth — one computation path for every figure

**Status:** open · opened 2026-08-22 · owner: this repo's agents
**Directive (Matt, 2026-08-22):** "we must stop the inconsistent data at its root and get it
fixed permanently and in a way that is scalable, as we add new data metrics everything must be
accurately computed" · "all data for charts, market reports, etc must come through the same
process."

This package is the plan of record for that directive. It supersedes nothing; it gives the
market-data plane the single spine it never had.

---

## 1. The problem, measured

**Twelve writers, five stores, no shared membership primitive.** Every writer re-implements
"which listings belong to this place", "what counts as active", "what counts as single-family"
and "what the window is" in its own inline SQL. There is no function anywhere that answers
*give me the listing keys belonging to (geo_type, geo_slug)* — so there is nothing for a writer
to call even if it wanted to agree with its neighbours.

**Consumption is just as split:** 18 distinct market read paths under `lib/data/market/`, and
126 modules across `lib/` and `app/` touching `market_stats_cache`, `market_pulse_live` or
`market_history_weekly` directly.

### 1.1 The absorption defect (root cause, live, withheld)

`public.refresh_community_market_pulse()`
(`supabase/migrations/20260727180000_bl016_community_pulse_and_yearly.sql`) computes, for the
same `geo_slug`, in the same row:

- **actives** by point-in-polygon — `listing_boundary_xref_mv`, built with
  `ST_Within(ST_SetSRID(ST_MakePoint(l."Longitude", l."Latitude"), 4326), b.polygon)`
- **closes** by exact text join — `JOIN public.neighborhood_subdivisions ns
  ON ns.subdivision_label = l."SubdivisionName"`

and then divides one by the other into `months_of_supply`. Numerator and denominator describe
different sets of homes. It also applies a *permissive* SFR test on the active side
(`property_sub_type IS NULL OR = 'Single Family Residence'`) and a *strict* one on the closed
side. Measured 2026-08-19: neighborhood rows held 1,192 actives against 79 closes in 30 days
(avg 17.94 months) while every city combined held 1,164 actives against 272 (Bend 3.49) —
arithmetically impossible, since Bend's neighborhoods sit inside Bend.
`/cities/bend/century-west` published **48.0 months**.

Currently withheld at read time by `lib/market/geo-grain-trust.ts`; not repaired at source.

### 1.2 The definition spread (the everyday problem)

The same nominal metric — *median close, Central Oregon, trailing 365 days* — yields a
**$191,000 spread** depending on which definition a writer happens to use. Verified live
2026-08-22 against the cached row's own window:

| Definition | Sales | Median |
|---|---|---|
| A · all closed rows, no filters | 11,680 | $459,250 |
| B · `PropertyType = 'A'` | 9,736 | $495,000 |
| C · SFR sub-type only | 8,012 | $528,250 |
| D · Central Oregon cities only | 5,601 | $584,000 |
| **E · CO cities + `PropertyType='A'` + SFR sub-type** | **3,907** | **$650,000** |

The published `market_stats_cache` region row is **E — reproduced exactly** (3,907 / $650,000,
`methodology_version = v3-2026-05-07`). *The live region figure is correct.* The defect is that
five defensible definitions exist and nothing structural forces the next writer, the next chart
or the next report onto E.

> **Audit correction (2026-08-22):** the automated audit reported the region arm as having *no*
> geographic predicate ("the median of every row in `listings`"). That is **false** for the live
> row — checked before acting. Recorded here because the audit's other structural findings are
> quoted SQL and stand; this one did not survive verification.

### 1.3 Other confirmed structural faults

- `market_stats_cache` has **three writers** (`compute_and_cache_period_stats`,
  `compute_subdivision_period_stats`, `backfill_rolling`) with three property-type scopes and
  three methodology stamps, UPSERTing into **one** primary-key space. Last writer wins, and a
  consumer cannot tell from the row which one produced it.
- **"Active" means five different things** across writers; at least one counts under-contract
  listings as inventory.
- `geo_slug` is not a geography: 13 slugs exist under more than one `geo_type`; `sunriver`
  exists under three. Held today by `ci:market-cache-geo-scope`.
- Subdivision grain is a stub: 100 rows, only 26 carrying a median, against ~3,213 subdivisions
  in `boundaries`.
- Engagement has two paths and one is dead: `listing_views` holds **0 rows**;
  `user_events.listing_view` holds 192 (142 in 30 days). Any "most viewed" surface is unbacked
  until instrumentation lands.

---

## 2. The architecture

One membership rule → one metric registry → one compute job → one read function → gates.

### M1 · `place_membership` — the single answer to "is this home in this place"

One row per (listing, place), covering **on-market and closed alike**, written by one job.

| Column | Meaning |
|---|---|
| `listing_key` | the home |
| `geo_type`, `geo_slug` | the place (slug is never unique alone — always paired) |
| `method` | `polygon` · `alias` · `city_text` — how membership was decided |
| `confidence` | `verified` · `unverified` (a polygon we have not checked is not verified) |
| `effective_from` / `effective_to` | so a closed sale is attributed to the place it was in at close |

Rules that follow by construction:
- Actives and closes for a place resolve through the **same** rows, so §1.1 cannot recur.
- A place whose members were resolved by more than one `method` is **not publishable** for
  ratio metrics — the layer marks it, no reviewer has to remember.
- Polygons stay `unverified` until checked against an authoritative source (Broken Top's
  boundary measures 17.96 sq mi against Bend's 35.45 — it is not verified today).

### M2 · The metric registry — declared once, in code

Each metric is one entry: name, formula, required inputs, minimum sample size, allowed grains,
and rounding. Adding a metric is adding an entry; it inherits membership, windowing, sample
floors, provenance and publishability automatically. That is the scalable half of the directive.

Vocabulary is defined **once** here, not per writer: what `active` means, what `SFR` means
(`PropertyType='A'` is a bucket that mixes townhomes and condos — see
`reference_property_type_a_is_a_bucket`), what a window's boundaries are.

### M3 · One compute job

Reads `place_membership` + `listings`, evaluates the registry per (geo, window, metric), writes
one row per figure carrying its provenance: rows counted, method, definition id, `computed_at`,
confidence, publishable.

### M4 · One read function

`getMetric({ metric, geoType, geoSlug, window })` → `{ value, provenance, publishable }`.
Every consumer — place pages, charts, market reports, CMAs, BPOs, the newsletter, the video
producers, the JSON feed — reads this. The 18 paths collapse into one; the 126 direct
touchpoints migrate behind it.

### M5 · Gates (the part that makes it permanent)

1. **No writer computes geography inline** — fails any migration whose market-metric SQL
   references `boundaries`, `SubdivisionName` or `"City"` for membership instead of
   `place_membership`.
2. **No consumer reads a market store directly** — extends the existing DAL-boundary gate to
   `market_stats_cache` / `market_pulse_live` / `market_history_weekly` outside the layer.
3. **Every rendered figure carries provenance** — a figure without a trace fails.
4. **Mixed-method membership ⇒ non-publishable** — enforced in the layer, so §1.1 is
   structurally impossible rather than remembered.
5. **Sample-size floors live in the registry**, not per surface.

Gate 4 is the one that retires `geo-grain-trust.ts` as a compensating control.

---

## 3. Sequencing (nothing on the live site goes dark)

1. **M1 built and backfilled in parallel with today's writers.** No reads switched. Compare
   membership against current attribution and record every disagreement.
2. **M2 + M3 write to a shadow store.** Reconcile every live figure against the shadow; a
   difference is either a defect found or a definition to record. Nothing publishes yet.
3. **M4 introduced; consumers migrate one surface at a time**, highest-traffic last. Each
   migration proves reconciliation before it flips.
4. **Gates land as each class of bypass reaches zero** — a gate that would fail on day one
   gets its baseline, and the count may only shrink (same ratchet as `ci:gates-wired`).
5. **Then** the grain work Matt asked for: subdivision coverage, and the leaderboard sections
   (best performing, most expensive, biggest movers) — which become a query against the layer,
   not a new pipeline.

---

## 4. What the leaderboards can stand on today

Verified live 2026-08-22, `geo_type='neighborhood'`, `period_type='rolling_365d'`, 27 places:
median, price per sq ft, sale-to-list, days on market, sold count, YoY and MoM deltas — all
present and fresh. A ranked board is real today (Orchard District +8.8% YoY through Tetherow
−26.1%, sold_count ≥ 8).

**Months of supply / absorption at neighborhood grain stays withheld** until M1 lands.

`activity_events` backs motion sections now — 11,024 price drops, 10,483 new listings, 6,179
pendings, 5,172 closings, fresh to 2026-08-22: *most price cuts*, *fastest to pending*,
*most new inventory*, *biggest movers*.

---

## 5. Open questions for Matt

1. **Subdivision coverage.** ~3,213 subdivisions exist; most will never have a publishable
   sample. Do we publish only those clearing the floor, or show the parent place with a stated
   reason?
2. **`PropertyType='A'` is a bucket.** It mixes townhomes and condos with detached homes. Does
   "single family" on the public site mean the bucket, or detached only? This changes every
   median.
3. **View instrumentation.** "Most viewed" needs real volume. Turn on listing-view tracking
   through `user_events` and retire the dead `listing_views` table?
