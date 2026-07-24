#!/usr/bin/env node
/**
 * backfill-market-history.mjs — extend market_stats_cache monthly depth backwards
 * to the ten-year floor for cities + region (W2.6 / W8.5 data leg).
 *
 * The refresh crons only keep recent months current; the cache floor sat at
 * 2019-02. W8.5's ten-year archive pages need monthly rows back to ~2016. This
 * one-shot fills the gap by calling the SAME RPC the crons use
 * (compute_and_cache_period_stats), so the numbers are computed identically.
 *
 * §0: city geo_slug is the lowercased SPACE form (lower("City")) — the same
 * canonical form the fixed refresh writers use. slugify would silently produce
 * empty rows for multi-word cities (see ci:market-city-slug-canon).
 *
 * Idempotent: the RPC upserts on (geo_type, geo_slug, period_type, period_start),
 * so re-running only refreshes. Bounded and resumable — pass --from / --to to
 * narrow the window, --dry-run to preview.
 *
 * Usage:
 *   node scripts/backfill-market-history.mjs --dry-run
 *   node scripts/backfill-market-history.mjs --from 2016-07 --to 2019-01
 *   node scripts/backfill-market-history.mjs                  # full: to the 10yr floor
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(REPO_ROOT, '.env.local') })

// The canonical city set — display names whose lower() equals listings."City".
const CITY_NAMES = [
  'Bend', 'Redmond', 'Sisters', 'La Pine', 'Sunriver', 'Tumalo',
  'Terrebonne', 'Madras', 'Prineville', 'Powell Butte', 'Crooked River Ranch',
]

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const argVal = (flag) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : null
}
// Default window: ten years ago through the month before the current cache floor.
const FLOOR = '2016-07' // ~10 years; earliest dense closed data
const fromArg = argVal('--from') ?? FLOOR
const toArg = argVal('--to') ?? '2019-01' // current cache floor is 2019-02

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

/** Every YYYY-MM-01 from `from` to `to` inclusive. */
function monthStarts(from, to) {
  const out = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}-01`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

const geoEntries = [
  ...CITY_NAMES.map((name) => ({ geo_type: 'city', geo_slug: name.toLowerCase() })),
  { geo_type: 'region', geo_slug: 'central-oregon' },
]
const months = monthStarts(fromArg, toArg)

console.log(
  `Backfill market_stats_cache monthly: ${geoEntries.length} geos × ${months.length} months ` +
    `(${fromArg} … ${toArg}) = ${geoEntries.length * months.length} RPC calls${dryRun ? ' [DRY RUN]' : ''}`,
)
if (dryRun) {
  console.log('geos:', geoEntries.map((g) => g.geo_slug).join(', '))
  console.log('months:', months[0], '…', months[months.length - 1])
  process.exit(0)
}

let ok = 0
let failed = 0
const failures = []
for (const period_start of months) {
  for (const { geo_type, geo_slug } of geoEntries) {
    const { error } = await supabase.rpc('compute_and_cache_period_stats', {
      p_geo_type: geo_type,
      p_geo_slug: geo_slug,
      p_period_type: 'monthly',
      p_period_start: period_start,
    })
    if (error) {
      failed++
      failures.push(`${geo_slug} ${period_start}: ${error.message}`)
    } else {
      ok++
    }
  }
  process.stdout.write(`\r  ${period_start}: ${ok} ok, ${failed} failed`)
}
process.stdout.write('\n')
console.log(`\ndone. ${ok} rows computed, ${failed} failed.`)
if (failures.length) {
  console.log('first failures:')
  for (const f of failures.slice(0, 10)) console.log('  ' + f)
}
