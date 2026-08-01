# TOAST read discipline — never read `listings.details` over a broad candidate set

**Status:** reference doc. Read before writing any query, DAL function, matview, or cron that
touches `public.listings`. Companion to [`DATABASE_FOR_AI_AGENTS.md`](DATABASE_FOR_AI_AGENTS.md)
§ the mixed-case column trap — this is the second trap, and it is more expensive.

All numbers below were measured against production (`dwvlophlbvvygjfxcrhm`) on 2026-07-31.

---

## The class

`public.listings.details` is a `jsonb` column carrying the raw RETS payload. Measured:

| Fact | Value |
|---|---|
| Rows | 594,186 |
| `pg_total_relation_size` | 14 GB |
| Heap (`pg_relation_size`) | 1,297 MB |
| **TOAST relation** | **12 GB** |
| `avg(pg_column_size(details))` | 10,074 bytes |
| `max(pg_column_size(details))` | 21,471 bytes |
| `shared_buffers` | 1 GB |

86% of the table's bytes live in TOAST, and TOAST is 12× larger than `shared_buffers`.

**Postgres cannot read one key out of a TOASTed value.** `details->>'StreetSuffix'` does not
fetch a suffix. It reassembles the entire ~10 KB document from its TOAST chunks, parses it,
then discards everything but one string. There is no partial-detoast path, no per-key index
that avoids it, and no expression index that helps a predicate the planner must still evaluate
per row.

So the cost of touching `details` is **per candidate row**, not per returned row. `LIMIT 60`
does not save you if the predicate that feeds the limit reads `details` — every row the
predicate examines pays. This is why the class is invisible in code review and invisible on
small result sets, and only explodes on broad candidate sets: sold/closed searches, whole-city
queries, matview refreshes, and cron sweeps over all listings.

---

## How to recognize it

Any of these, where the candidate set is not already tiny and bounded:

- SQL: `details->`, `details->>`, `details ?`, `details ?|`, `jsonb_array_length(details->...)`
  in a `WHERE`, `ORDER BY`, `COUNT(*) OVER ()`, or a matview's `SELECT` list.
- supabase-js: `.select(...)` whose column list contains `details` (or `details->>X` aliased,
  e.g. `'StreetSuffix:details->>StreetSuffix'`).
- supabase-js: **`.select('*')` on `listings`** — this is the bug wearing a disguise, because
  `*` includes `details`.
- supabase-js: `.contains('details', ...)`, `.filter('details->>X', ...)`, `.or('details...')`,
  `.order('details...')`, `.not('details', ...)`.
- A helper that takes `columns: string` as a parameter — check every call site, not the helper.

A read is **safe** when the candidate set is bounded to a handful of rows by a unique or
near-unique indexed predicate first (`.eq('ListingKey', k).maybeSingle()`, `.in('ListNumber',
smallArray)`). Single-row detail pages are fine. Sweeps are not.

**The matviews are already narrow on purpose.** `listing_tile_mv`, `listing_search_mv`, and
`listing_boundary_xref_mv` carry no `details` column, which is why reading them is cheap.
`lib/listing-tile-projections.ts` says so in a comment: do not add `details` there.

---

## How to measure it

The benchmark is a controlled A/B over the **same rows**, one side reading only typed columns,
the other adding a single `details` key. The delta is the detoast cost. Use
`EXPLAIN (ANALYZE, BUFFERS)` — the buffer delta is the proof, because it shows the TOAST chunk
fetches directly.

### Seq-scan shaped (what a matview refresh or full sweep actually does)

`TABLESAMPLE SYSTEM (n) REPEATABLE (seed)` gives both sides an identical block sample.

```sql
-- A: typed columns only
EXPLAIN (ANALYZE, BUFFERS)
SELECT count("StreetName"), count("StreetNumber")
FROM public.listings TABLESAMPLE SYSTEM (5) REPEATABLE (42);

-- B: same rows, plus ONE key out of details
EXPLAIN (ANALYZE, BUFFERS)
SELECT count("StreetName"), count(NULLIF(btrim(details->>'StreetSuffix'),''))
FROM public.listings TABLESAMPLE SYSTEM (5) REPEATABLE (42);
```

Measured, 29,135 rows both sides:

| | Execution time | Per row | Buffers |
|---|---|---|---|
| A — typed columns | 3,115.7 ms | 0.107 ms | 8,300 |
| B — plus one `details` key | **115,145.1 ms** | **3.953 ms** | 158,883 |
| **Delta** | +112,029 ms | **+3.845 ms/row** | **+5.17 blocks/row** |

**36.9× slower.** The +5.17 blocks per row is the smoking gun: a 10 KB document stored in
2 KB TOAST chunks needs ~5 chunk fetches, and that is exactly what appears.

### Index-scan shaped, warm cache (the optimistic floor)

Same method over 5,000 rows joined by `ListingKey`: 629.8 ms (0.126 ms/row) vs 7,677.7 ms
(1.536 ms/row), a **+1.41 ms/row** delta and 12.2×, buffers 24,188 → 49,789.

**Use 1.4 ms/row as the floor and ~3.8 ms/row as the realistic planning number.** Both are
per-`details`-touch; an expression that extracts N keys separately can pay closer to N times
that (see below).

### Doing the arithmetic

Multiply the measured per-row cost by the **candidate set**, which you must also measure, not
estimate:

```sql
SELECT count(*) FROM public.listings WHERE <your predicate>;
```

Reference candidate sets, measured 2026-07-31:

| Set | Rows |
|---|---|
| All listings | 594,186 |
| IDX-permitted (the `listing_tile_mv_src` scope) | 594,086 |
| All closed | 378,565 |
| Bend, all statuses | 134,096 |
| Bend, closed | 96,682 |
| On-market (Active / AUC / Coming Soon / Pending) | 9,744 |

96,682 Bend closed rows × 3.8 ms/row ≈ **6 minutes** against a 12 s PostgREST timeout. That is
the shape of the failure: not slow, but categorically impossible.

---

## The two correct remedies

### 1. Narrow, trigger-maintained side table (preferred for predicates)

Extract the keys you filter on into a skinny table keyed by `list_number`, maintained by an
`AFTER INSERT OR UPDATE` trigger on `listings`, and join to it. The predicate then runs against
a few hundred bytes per row instead of 10 KB, and can be indexed normally.

This pattern is already live in this database:

- `public.listing_feature_flags` — `view_yn`, `pool_yn`, `waterfront_yn`, `fireplace_yn`,
  `has_open_house`, `property_sub_type_lower`
- `public.listing_remarks_search` — `public_remarks`
- Trigger function `public.sync_listing_feature_flags()`, which calls
  `public.listing_feature_flags_of(NEW.details)` to compute the row.

Use it. Do not invent a second parallel mechanism. When you need a new filterable field, add a
column to the existing side table and extend `listing_feature_flags_of`.

**A side table is only as good as its backfill.** As of 2026-07-31 the two tables above hold
260,042 and 260,019 rows against 594,186 listings (~44%), with backfill still running. A
predicate that assumes full coverage silently under-returns until the backfill completes. Check
coverage before you rely on it.

### 2. A typed column, but ONLY after proving equivalence across the whole table

`listings` already carries typed columns that mirror some `details` keys (`pool_yn`,
`has_virtual_tour`, `public_remarks`, `property_sub_type`, `year_built`, `lot_size_acres`,
`fireplace_yn`, `waterfront_yn`, `photos_count`, `virtual_tour_url`, …). Reading those is free.

**They are backfilled artifacts, not guaranteed mirrors, and several of them disagree with the
jsonb.** A naive swap silently changes results. Two counterexamples:

- **`has_virtual_tour`** (measured 2026-07-31 over the 7,775 active / coming-soon / AUC rows):
  typed says 1,088 true, the jsonb expression `details->>'VirtualToursCount' NOT IN (NULL,'0')`
  says 1,603 true, and they disagree **in both directions** — 454 rows typed-only, 969 rows
  jsonb-only. This is precisely the drift `scripts/backfill-virtual-tours.mjs` exists to
  reconcile, so that script's predicate must **not** be "optimized" onto the typed column.
- **`pool_yn`** (reported from a prior investigation, not re-verified here): returns 167 rows
  where the equivalent jsonb expression returns 15,763. Note that these booleans are widely
  `NULL`, and `NULL` is not `false` — a `WHERE pool_yn` predicate silently drops every
  un-backfilled row. Always `COALESCE(col, false)` when comparing, or the proof itself is wrong.

So the swap is legal only with a proof, run over the whole table, that the disagreement is
exactly zero in both directions:

```sql
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE <typed_expr>)                      AS typed_true,
  count(*) FILTER (WHERE <jsonb_expr>)                      AS jsonb_true,
  count(*) FILTER (WHERE <typed_expr> AND NOT <jsonb_expr>) AS typed_only,
  count(*) FILTER (WHERE NOT <typed_expr> AND <jsonb_expr>) AS jsonb_only
FROM public.listings;
```

**`typed_only` and `jsonb_only` must both be 0.** If either is non-zero, do not swap — the
field needs the side-table treatment instead, and the disagreement is itself a data-quality
defect worth reporting. Paste the proof into the PR or commit message; this is a §0 figure like
any other.

### Non-remedies

- Adding a GIN index on `details`. It can help a `?`/`@>` containment lookup pick rows, but any
  `->>` extraction in the select list or a later predicate still detoasts every surviving row.
- `LIMIT`. It bounds output, never the rows the predicate examined.
- Raising `statement_timeout`. This converts a fast failure into a long one that saturates a
  connection and starves everything sharing the pool. See below.
- Narrowing `.select('details')` to `.select('details->>Key')`. This is still a full detoast.
  It does cut the wire payload substantially, which is worth doing, but it is not the fix.

---

## Why this keeps surfacing as "the cron is stale"

A page that blows a 12 s timeout gets noticed. A cron that blows one returns HTTP 200 with an
error buried in a summary object, and the data quietly goes stale. Two live examples:

**Matview refresh.** `listing_search_mv_src` extracts roughly 100 separate keys out of
`details` per row (`rr_feature_keys(l.details->'…')` and friends). Its `pg_cron` job
`refresh_dal_mvs_15min` (jobid 163, every 15 min, `statement_timeout = 900s`) **failed at
2026-07-31 23:35:00Z after 950.9 s** with:

```
ERROR:  canceling statement due to statement timeout
CONTEXT:  SQL function "rr_feature_keys" statement 1
          SQL statement "REFRESH MATERIALIZED VIEW CONCURRENTLY …"
```

Over only 9,666 source rows, that is ~98 ms/row — consistent with ~25 effective detoasts per
row. Successful runs in the preceding hours ranged 264 s to 884 s, so the job sits right at its
ceiling and fails intermittently.

`listing_tile_mv_src` is worse in scope: it reads `details->>'StreetSuffix'` over **all 594,086**
IDX-permitted rows for one string. Its job (jobid 164, every 30 min, `statement_timeout = 1800s`)
ran 469 s to 836 s over the same window.

The historical "listing_tile_mv outgrew 300 s and went 8 days stale" incident is this class.
Raising the timeout to 900 s and then 1800 s treated the symptom; the single `details` read in
the matview definition is the cause.

**Retry amplification.** A cron that catches a timeout and retries *wider* converts one failure
into a guaranteed permanent one. Fixed in `app/actions/sync-spark.ts` on 2026-07-31: the
terminal-history fallback retried a `details`-selecting query at `rangeLimit * 5` (up to 10,000
rows × ~10 KB) after the primary died on a statement timeout. **On a detoast timeout, retry
narrower, never wider.**

---

## Checklist before you ship a query touching `listings`

1. Does the column list contain `details`, a `details->>` alias, or `*`? If yes, continue.
2. Measure the candidate set with `count(*)` and the real predicate. Not an estimate.
3. Multiply by 3.8 ms/row. If the product exceeds the surface's timeout (12 s for PostgREST,
   the `statement_timeout` for a `pg_cron` job), it does not ship.
4. Pick a remedy: side table for predicates, typed column for projections **with the
   equivalence proof**, or narrow the candidate set with an indexed typed predicate first.
5. If it is a cron, make the failure loud. A silent stale-data path is worse than a 500.
