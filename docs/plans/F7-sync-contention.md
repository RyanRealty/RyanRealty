> **STATUS: APPLIED TO PRODUCTION 2026-07-29 ~22:5x UTC — swap committed, measured, gated.**
>
> Channel that worked: a self-unscheduling pg_cron one-shot whose FIRST
> statements are `select cron.unschedule(...)` then
> `set local statement_timeout = '1800s'` — the set-local-first pattern was
> PROVEN by a probe (pg_sleep(630) survived past the 600s barrier) before the
> second attempt. Attempt 1 (timeout set inside the function) died at exactly
> 600.0s and rolled back atomically; no blackout either way, readers keep the
> old view until commit.
>
> | metric | before | after |
> |---|---|---|
> | refresh outcome (24h) | 72 of 95 runs FAILED at 600s | succeeds |
> | rows written per refresh | ~593,890 (full rewrite) | **~70** (real deltas) |
> | first post-fix refresh | — | 362.8s (cold diff) |
> | steady-state refresh (measured 23:05Z run) | 580.8s avg, mostly FAILING | tile 389.6s / 4-MV chain 478.7s, SUCCEEDS |
> | autovacuums | 1,168 (one per rewrite) | 1 |
> | data staleness observed | 172 min | stamped 23:00:02Z |
> | indexes on the MV | 12 (incl. a never-scanned GIST) | 11 (GIST dropped, evidence in 20260729231500) |
>
> Honest residual: the duration win is modest because REFRESH CONCURRENTLY
> still RE-RUNS the full MV query (589K-row scan + 594K tsvector builds) to
> compute its diff — the now() fix eliminated the WRITE side (594K-row
> delete+insert, 12-index maintenance, vacuum-per-run), which is what starved
> readers and failed runs. Cutting the remaining ~390s read cost is an
> instance-size / query-cost question (2 cores, 1GB shared_buffers), not an MV
> hygiene one. Telemetry proof: the first pipeline run after the
> clock_timestamp() fix recorded 37.5s against a 37.5s wall clock.
>
> Also fixed while in here: `run_post_sync_pipeline` telemetry recorded every
> duration as 0.000000 (`now()` is transaction-fixed); its 9 timing call sites
> now use `clock_timestamp()`. New gate `ci:mv-determinism` fails any NEW
> migration whose materialized view body contains a volatile time/random
> function — the class, not the instance. The migration lives at
> `supabase/migrations/20260729193000_...` and matches production.

> ### Apply attempt 1 (2026-07-29 21:00Z) — FAILED at the documented trap, rolled back clean
>
> The swap ran as a one-shot pg_cron job calling one plpgsql function. It died at
> exactly **600.0s** ("canceling statement due to statement timeout", mid
> `create index listing_tile_mv_list_number`) — the migration's own section-8
> warning in action: the timer is armed when the enclosing statement starts, so
> `set_config('statement_timeout', ...)` INSIDE the function cannot extend it.
> The transaction rolled back atomically; verified afterwards: 593,876 rows, 12
> indexes, both views, the now() column still present, site serving normally
> throughout (864ms-2.6s page loads mid-rebuild, no blackout — readers keep the
> old view until commit, so the 8-minute-blackout fear in the earlier banner was
> wrong for the single-transaction form).
>
> Retry in progress with two changes: (1) an empirical PROBE first — a pg_cron
> command of `unschedule-self; set local statement_timeout='700s';
> select pg_sleep(630)` proves or disproves that the set-local-first pattern
> extends the budget before betting another 10-minute build on it; (2) the job
> unschedules itself as its FIRST statement so it can fire exactly once, and the
> swap is wrapped in `_f7_swap_guarded()` which no-ops if the column is already
> gone. If the probe fails, fallback is a temporary role-level timeout window or
> a decomposed per-statement build, chosen on the probe evidence.

> ### Measured again at apply time (2026-07-29 ~20:30Z) — WORSE than the diagnosis above
>
> `cron.job_run_details` for jobid 151 (`refresh_dal_mvs_15min`), last 24h:
>
> | runs | failed | avg | max | duty cycle |
> |---|---|---|---|---|
> | 95 | **72 (76%)** | 580.8s | 601.4s | **63.9%** |
>
> The job does not merely run long, it **mostly fails**, every failure pinned at
> the 600s statement timeout. So the database spends 64% of its time on work that
> is then discarded. Consequence found by checking the stamp directly:
> `max(refreshed_at)` on `listing_tile_mv` was **172 minutes old** while the job
> was nominally running every 15 minutes. Search pages were serving listing data
> up to ~3 hours stale, with nothing surfacing that fact — the same silent-
> staleness class as the 2026-07-16 incident.
>
> **Immediate mitigation applied** (reversible, one call): cadence halved from
> `5,20,35,50` to `5,35` via `select cron.alter_job(151, schedule => '5,35 * * * *')`.
> Since 76% of runs were already being thrown away, this discards almost no real
> refresh work and returns roughly half the database's capacity. It does NOT fix
> the timeout: each run still rewrites all 593,890 rows and still exceeds 600s.
> Only removing the `now()` column makes the refresh incremental (seconds, not
> minutes), which is what the staged migration does.
>
> **Why the migration was still not applied from this session:** it is one ~8
> minute transaction, and the Supabase MCP connector demonstrably times out on
> far smaller DDL against this exact table (a single index build on
> `listing_tile_mv_src` timed out twice earlier in the same session and had to be
> done with `CREATE INDEX CONCURRENTLY`). Pushing an 8-minute transaction through
> that connector would abort and change nothing. It needs a channel that can hold
> a long transaction (Supabase dashboard SQL editor, or a one-shot `pg_cron` job),
> which is an operator action.



# F7 — search pages degrade to 20-50s while background sync runs

Status: diagnosed, migration written, **not applied**.
Migration: `supabase/migrations/20260729193000_listing_tile_mv_drop_now_refreshed_at.sql`
Severity: P2. Found by the live production audit 2026-07-29.

---

## 1. What the audit saw

| Observation | Value |
|---|---|
| `/homes-for-sale/redmond/multi-family`, three consecutive loads | 51.6s · 4.4s · 36.7s (domcontentloaded) |
| Same URL, earlier the same day | 799ms |
| `EXPLAIN ANALYZE` of that page's tile query | 106ms, index scan on `listing_tile_mv_city_sub_status` |
| `pg_stat_activity` during the slow loads | `SELECT public.run_post_sync_pipeline('cron-15min')` active 51s, ~8 PostgREST calls at 18-25s |

The query is fast. The database is busy. Those are two different problems and only the second one is real here.

## 2. What the pipeline actually does

`public.run_post_sync_pipeline(text)` — pg_cron job `post_sync_pipeline_15min`, `*/15 * * * *`, guarded by
`pg_try_advisory_lock(hashtext('run_post_sync_pipeline'))`, `statement_timeout=300s`, `lock_timeout=10s`.
Three steps, all UPSERTs into cache tables:

1. `refresh_market_pulse()` — loops 17 geographies; per geography runs 5 sequential aggregate scans over
   `listings` (589K rows), each with a PostGIS `ST_Within` predicate against the city polygon. 85 aggregate
   queries per run. Upserts 17 rows into `market_pulse_live`.
2. `refresh_community_market_pulse()` — one CTE over `listing_boundary_xref_mv` + `listings` +
   `neighborhood_subdivisions`, upserts 28 neighborhood rows.
3. `refresh_current_period_stats()` — 15 geographies × 4 period types = 60 calls to
   `compute_and_cache_period_stats`, each capped at 60s, upserting into `market_stats_cache`.

It is real work, and it is **not the dominant cost**.

## 3. The dominant cost is the other 15-minute job

`cron.job_run_details`, last 3 days:

| job | status | runs | avg | p50 | p95 | max | total seconds burned |
|---|---|---|---|---|---|---|---|
| `refresh_dal_mvs_15min` | succeeded | 181 | 492.4s | 484.4s | 564.8s | 596.0s | 89,117 |
| `refresh_dal_mvs_15min` | **failed** | 107 | 600.2s | 600.1s | 601.1s | 602.0s | 64,226 |
| `post_sync_pipeline_15min` | succeeded | 281 | 90.1s | 42.2s | 447.6s | 592.5s | 25,324 |
| `post_sync_pipeline_15min` | failed | 6 | 600.1s | — | — | 600.2s | 3,600 |

Duty cycle over the last 2 days (172,501s of wall clock):

- `refresh_dal_mvs_15min` busy **104,528s = 60.6%**
- `post_sync_pipeline_15min` busy **23,423s = 13.6%**

The MV job is scheduled `5,20,35,50` and averages 492s, so it is still running when the pipeline starts at
`:00/:15/:30/:45`. They overlap by design of the clock, not by accident.

`pg_stat_statements`:

| statement | calls | total | mean | `shared_blks_read` | cache hit |
|---|---|---|---|---|---|
| `select refresh_listing_tile_mv(), refresh_geo_snapshot_mv(), refresh_listing_boundary_xref_mv(), refresh_listing_search_mv()` | 1,073 | 500,805s | 466.7s | **1,976,053,144** | 89.5% |
| `SELECT run_post_sync_pipeline($1)` | 4,068 | 115,772s | 28.5s | 143,013,684 | 98.3% |
| user-facing PostgREST tile/search queries | 11.8M | — | 0.10-0.12s | — | 99.7-99.8% |

1.98 billion 8KB blocks = **15.8 TB read from disk** by that one statement.

## 4. Root cause

`listing_tile_mv_src` ends with:

```sql
now() AS refreshed_at
```

`REFRESH MATERIALIZED VIEW CONCURRENTLY` builds the new snapshot, diffs it against the live table on the
unique index, and applies only the rows that differ. A `now()` column makes **every row differ on every
refresh**, so the "concurrent, incremental" refresh degenerates into a full delete + insert of all 593,890
rows, plus maintenance of all **12 indexes** (including a GIN tsvector index, the most expensive kind to
maintain), plus the autovacuum that follows.

`pg_stat_user_tables` proves it, and the MV next door is the control case:

| MV | live rows | `n_tup_ins` | `n_tup_del` | implied | has `now()` |
|---|---|---|---|---|---|
| `listing_tile_mv_src` | 593,890 | **689,514,161** | 701,737,984 | **1,161 full rewrites** | yes |
| `listing_boundary_xref_mv_src` | 21,580 | 27,346 | 14,507 | a real diff, ~25 rows/refresh | **no** |

689,514,161 ÷ 593,890 = 1,160.9. The tile MV has been rewritten end to end on every one of ~1,161 refreshes.
`autovacuum_count` on it is 1,168 — one cleanup per rewrite.

`geo_snapshot_mv`, `listing_search_mv_src`, `similar_listings_mv_src` and `listing_detail_mv` carry the same
`now()` defect, but they hold 6,903 / 9,701 / 75,842 rows. Their full rewrites are cheap. Only the tile MV matters.

## 5. Lock blocking or resource starvation?

**Resource starvation. Not locks.** Evidence:

- All six refresh functions use `REFRESH MATERIALIZED VIEW CONCURRENTLY` (verified across
  `refresh_listing_tile_mv`, `refresh_geo_snapshot_mv`, `refresh_listing_boundary_xref_mv`,
  `refresh_listing_search_mv`, `refresh_listing_detail_mv`, `refresh_similar_listings_mv`). None takes
  `ACCESS EXCLUSIVE`; none blocks a reader.
- `pg_stat_database`: `deadlocks = 0`, `conflicts = 0`. `pg_locks`: 0 ungranted locks.
- The pipeline's writes are `INSERT ... ON CONFLICT` into `market_pulse_live` (17+28 rows) and
  `market_stats_cache`. Row locks on cache rows, invisible to `SELECT` under MVCC.

The starvation mechanism, precisely:

- `shared_buffers = 1GB`. `listing_tile_mv_src` alone is **812 MB** (525 MB heap + 287 MB of indexes).
- A full rewrite streams the new snapshot, the diff, the heap churn and 12 index rebuilds through that 1 GB
  buffer pool. It evicts the entire working set that keeps the 106ms tile query at 106ms.
- `work_mem = 7MB`. `pg_stat_database` shows `temp_files = 152,599` and `temp_bytes = 1,708 GB` — the sorts
  and hashes spill to disk continuously.
- The refresh statement's own cache hit rate is 89.5% against 99.7-99.8% for user queries. It is the thing
  reading cold.

So the 799ms page and the 51.6s page run the identical plan. The difference is whether the pages it needs are
in a buffer pool that a 15.8 TB background rewrite has just flushed, on a disk that rewrite is saturating.

## 6. A second, independent defect found on the way

The 900s ceiling added by `20260716043000_mv_refresh_timeout_and_pg_cron.sql` **never took effect on the
pg_cron path.** `statement_timeout` is armed when a statement begins; a per-function `SET` cannot extend a
timer already running for the enclosing statement. The enclosing `select f(), g(), h(), i()` inherited the
database-level `statement_timeout=10min` on database `postgres` (confirmed in `pg_db_role_setting`). That is
exactly where the 107 failures cluster: 600.1s, 600.2s, max 602.0s.

Worse, all four refreshes shared that one budget in one statement, so when the tile refresh ate it, the MVs
after it did not refresh at all — 37% of runs. This is the same class of silent failure as the 2026-07-16
incident where `listing_tile_mv` sat 8 days stale.

## 7. A third defect: the pipeline's own telemetry reads zero

`run_post_sync_pipeline` times every step with `EXTRACT(EPOCH FROM (now() - v_started_at))`. `now()` is
`transaction_timestamp()` and does not advance inside a transaction. Every row in
`post_sync_pipeline_runs` therefore stores `0.000000` for `total_seconds`, `pulse_seconds` and
`stats_seconds`, and `completed_at` equals `started_at` to the microsecond — 662 consecutive rows over 7
days, including runs `cron.job_run_details` clocked at 592s.

Nobody could have seen this pipeline getting slow from its own instrumentation. Fix is `clock_timestamp()` in
the five `EXTRACT` expressions. Deliberately **not** bundled into this migration, to keep it reviewable.
Until it lands, measure from `cron.job_run_details`, never from `post_sync_pipeline_runs`.

## 8. Options weighed

| Option | Effect | Risk | Verdict |
|---|---|---|---|
| **Remove `now() AS refreshed_at` from `listing_tile_mv_src`** | Diff collapses from 593,890 rows to the ~tens changed per 15 min. Attacks the cause. | MVs cannot `ALTER ... DROP COLUMN`; needs DROP + CREATE, ~8 min rebuild, and 2 dependents. Mitigated by the documented v2-swap. | **CHOSEN** |
| `REFRESH ... CONCURRENTLY` | Already in use on all six functions, and the unique index `listing_tile_mv_key` already exists. | — | Already done; not the problem |
| Lower the refresh frequency (hourly instead of 15 min) | Cuts duty cycle ~4x. | Listings go up to an hour stale on a site whose value proposition is live data. Treats the symptom; each refresh still wastes 1000x the work it needs to. | Rejected as the primary; unnecessary once the cause is fixed |
| Move the job off-peak | Search traffic is all day. Would not have prevented the 51.6s load. | — | Rejected |
| Raise the database `statement_timeout` above 10 min | Lets the 492s refresh finish instead of dying at 600s. | Makes it **worse** — longer overlap, higher duty cycle. Cures the alarm, not the fire. | Rejected |
| Add `statement_timeout` / `lock_timeout` so it cannot wedge readers | Both are already set on every function in the chain, and there is no lock wedge to prevent (§5). | — | Not applicable |
| Make the page path resilient (stale-while-revalidate, longer ISR) | Hides a 51s DB under a cache. | The DB is still 60.6% saturated; every uncached path, admin surface and cron still pays. `ISR caches empty fallback` is a known trap in this repo. | Rejected |
| Split the cron chain + fix the ineffective timeout | Each refresh gets its own 900s budget instead of sharing one 600s. | Low. | **Bundled** as a secondary |

### Why the chosen option, over lowering the frequency

Lowering the frequency is the tempting low-risk move, and it is the wrong one. It would take the duty cycle
from 60.6% to ~15% while leaving every refresh doing 1,161x the work it needs to — the same defect, throttled.
It also trades data freshness on the primary revenue surface for database headroom, which is a bad trade when
the underlying waste is removable outright. Removing `refreshed_at` from the row payload makes the 15-minute
cadence genuinely cheap, so freshness and headroom stop competing.

The risk in the chosen option is entirely in the *apply*, not the end state: a naive `DROP` + `CREATE` blanks
the search pages for ~8 minutes. That risk is already solved in this repo — the `_v2`-alongside-then-rename
swap documented in the migration header and used for the `street_suffix` rebuild on 2026-07-08. The end state
is identical either way.

## 9. What the migration does

1. New one-row-per-MV table `public.mv_refresh_state` (RLS on, `SELECT` policy for `anon`/`authenticated`/`service_role`).
2. Drops the dependency chain (`similar_listings_mv` → `similar_listings_mv_src` → `listing_tile_mv` → `listing_tile_mv_src`).
3. Recreates `listing_tile_mv_src` byte-identical **minus** the `now() AS refreshed_at` column.
4. Recreates all 12 indexes verbatim, unique index first.
5. Recreates the `listing_tile_mv` view with the same 38 columns in the same order — `refreshed_at` now an
   uncorrelated scalar subquery over `mv_refresh_state`, evaluated once per statement as an InitPlan.
6. Recreates `similar_listings_mv_src` + `similar_listings_mv` unchanged, with grants restored.
7. `refresh_listing_tile_mv()` stamps `mv_refresh_state` after each refresh. Same advisory lock 7101, same body otherwise.
8. Reschedules `refresh_dal_mvs_15min` as four statements behind `set local statement_timeout = '900s'`.

`/api/cron/loop-health-check` reads `listing_tile_mv.refreshed_at` via
`mvRefreshStamp('listing_tile_mv')`, and `evalSyncDelta` uses it to tell a dead ingest apart from a dead
refresh. That probe keeps working unchanged — same column name, type and position on the view.

## 10. Expected effect

| Metric | Now | Expected |
|---|---|---|
| Rows rewritten per tile refresh | 593,890 | tens to low hundreds |
| `refresh_dal_mvs_15min` mean | 492.4s | single-digit seconds |
| Its failure rate | 37% (107/288) | ~0 |
| Its duty cycle | 60.6% | ~1% |
| `shared_blks_read` for that statement | 1.98B (15.8 TB) | 3 orders of magnitude lower |
| `/homes-for-sale/*` p95 | 20-50s | at or near the uncontended 799ms |

Verification after apply, in order:

```sql
-- audit: F7 verification
select status, count(*), round(avg(extract(epoch from (end_time-start_time)))::numeric,1) as avg_sec
from cron.job_run_details d join cron.job j using (jobid)
where j.jobname='refresh_dal_mvs_15min' and d.start_time > now() - interval '2 hours'
group by 1;

-- audit: F7 verification - churn must now be ~ the delta-sync row count
select n_tup_ins, n_tup_del, n_live_tup from pg_stat_user_tables
where schemaname='public' and relname='listing_tile_mv_src';
```

Then reload `/homes-for-sale/redmond/multi-family` three times *while* `refresh_dal_mvs_15min` is running.

## 11. Not verified

- The migration SQL has **not** been executed anywhere. No syntax check against a live parser, no `_v2` swap rehearsal.
- The predicted post-fix numbers in §10 are inferred from the `listing_boundary_xref_mv_src` control case and
  from the standalone `refresh_listing_tile_mv()` timings in `pg_stat_statements` (832 calls, mean 44.0s
  uncontended). They are **not** measured for the fixed MV.
- `run_post_sync_pipeline` itself is untouched. At p50 42s / p95 448s it is a genuine secondary contributor,
  and the 85 `ST_Within` aggregate scans in `refresh_market_pulse` are the obvious next target. Not analysed
  in depth here.
- The `now()` defect in `geo_snapshot_mv`, `listing_search_mv_src`, `similar_listings_mv_src` and
  `listing_detail_mv` is identified but left in place, on the argument that their row counts make it cheap.
  That argument is reasoned, not measured per-MV.
- `/api/cron/refresh-mvs` (Vercel, hourly at `:08`) is a second refresher racing the pg_cron job at `:05`.
  The advisory locks make it safe, but the duplication was not chased down.
