#!/usr/bin/env node
/**
 * MV determinism gate (F7, 2026-07-29).
 *
 * A materialized view body that calls a volatile/stable time or randomness
 * function (`now()`, `current_timestamp`, `current_date`, `clock_timestamp()`,
 * `timeofday()`, `random()`) is not a pure function of its source tables:
 * every row differs on every refresh, so `REFRESH MATERIALIZED VIEW
 * CONCURRENTLY` degenerates from an incremental diff into a full delete+insert
 * of every row plus maintenance of every index.
 *
 * Measured on production before the fix: `listing_tile_mv_src` (593,890 rows,
 * 12 indexes, `now() AS refreshed_at`) showed n_tup_ins = 689,514,161 —
 * 1,161 implied full rewrites — while the control MV without a now() column
 * showed 1.3. The refresh job averaged 580.8s on a 900s cadence, FAILED 72 of
 * 95 runs at the 600s statement timeout, held a 63.9% duty cycle, and left
 * search data 172 minutes stale. Fix: the refresh stamp lives in
 * public.mv_refresh_state (one row), stamped by the refresh function.
 *
 * This gate fails any migration that creates a materialized view whose body
 * contains one of those functions. Freshness stamps belong in
 * mv_refresh_state, never on the MV payload.
 *
 * Baseline: known deliberate exceptions, keyed by MV name. May only shrink.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const MIGRATIONS_DIR = 'supabase/migrations'

// Ratchet baseline: HISTORICAL migrations are immutable records of what ran,
// so existing hits are keyed by exact file:mv pair and may only SHRINK. Any NEW
// migration containing the pattern fails. similar_listings_mv_src keeps now()
// deliberately (76K rows, 2 btree indexes, daily refresh — full rewrite costs
// ~nothing); the tile/geo/search entries are the pre-F7 definitions superseded
// by 20260729193000 or are small MVs tracked for future cleanup.
const BASELINE = new Set([
  '20260522144509_listing_tile_mv.sql:listing_tile_mv',
  '20260522144510_geo_snapshot_mv.sql:geo_snapshot_mv',
  '20260527180000_similar_listings_mv.sql:similar_listings_mv',
  '20260627150000_idx_internet_display_optout.sql:listing_tile_mv',
  '20260627150000_idx_internet_display_optout.sql:similar_listings_mv',
  '20260708090000_geo_snapshot_mv_sfr_medians.sql:geo_snapshot_mv',
  '20260708150000_listing_tile_mv_street_suffix.sql:listing_tile_mv',
  '20260708150000_listing_tile_mv_street_suffix.sql:similar_listings_mv',
  '20260711160000_listing_search_mv.sql:listing_search_mv',
  '20260711190000_listing_search_mv_private_remarks.sql:listing_search_mv',
  '20260712010000_listing_search_mv_private_from_private_table.sql:listing_search_mv',
  '20260721091500_coming_soon_geo_snapshot_mv.sql:geo_snapshot_mv',
  // The F7 fix itself recreates similar_listings_mv_src and leaves its now()
  // deliberately: 76K rows, 2 btree indexes, one daily refresh — the full
  // rewrite costs ~nothing. Documented in the migration body.
  '20260729193000_listing_tile_mv_drop_now_refreshed_at.sql:similar_listings_mv_src',
])

// NB: no trailing \b after the paren alternatives — ")" is a non-word char, so
// a word boundary there can never match and `now()` would be invisible. Caught
// by this gate's own red test.
const VOLATILE = /\b(now\s*\(\s*\)|clock_timestamp\s*\(\s*\)|timeofday\s*\(\s*\)|random\s*\(\s*\))|\b(current_timestamp|current_date)\b/i

/**
 * Pull each `create materialized view <name> as <body>;` out of a migration.
 * Statement bodies never contain plpgsql dollar-quoting (functions do, MVs do
 * not), so scanning to the next semicolon at paren-depth zero is exact enough
 * for SQL this repo writes; a false split would surface as a false POSITIVE,
 * which the baseline handles, never a silent miss.
 */
function extractMatviews(sql) {
  const out = []
  const re = /create\s+materialized\s+view\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)/gi
  let m
  while ((m = re.exec(sql)) !== null) {
    let depth = 0
    let i = re.lastIndex
    while (i < sql.length) {
      const ch = sql[i]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (ch === ';' && depth <= 0) break
      i++
    }
    const name = m[1].replace(/^public\./, '').replaceAll('"', '')
    out.push({ name, body: sql.slice(m.index, i) })
  }
  return out
}

const failures = []
for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
  // strip line comments so a WARNING ABOUT now() cannot trip the gate
  const code = sql.replace(/--[^\n]*/g, '')
  for (const mv of extractMatviews(code)) {
    const hit = mv.body.match(VOLATILE)
    if (hit && !BASELINE.has(`${file}:${mv.name}`)) {
      failures.push(`${file}: materialized view "${mv.name}" body contains ${hit[0]}`)
    }
  }
}

console.log('MV determinism gate (F7)')
console.log('========================')
if (failures.length) {
  console.log(`✗ ${failures.length} non-deterministic materialized view(s):\n`)
  for (const f of failures) console.log(`  ${f}`)
  console.log(
    '\nA volatile column makes every row differ on every refresh, so CONCURRENTLY\n' +
      'rewrites the whole MV (measured: 1,161 full rewrites of 593,890 rows, 76%\n' +
      'of refresh runs dying at the statement timeout, search data 3h stale).\n' +
      'Stamp freshness in public.mv_refresh_state from the refresh function\n' +
      'instead — see supabase migration 20260729193000 and docs/plans/F7-sync-contention.md.'
  )
  process.exit(1)
}
console.log('✓ every materialized view in migrations is a deterministic function of its sources.')
