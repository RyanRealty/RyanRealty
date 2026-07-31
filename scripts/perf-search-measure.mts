/**
 * perf-search-measure.mts — measure the REAL search read paths against
 * production data. This is the measurement half of the search performance
 * budget; the enforcement half is scripts/check-search-perf-budget.mjs, which
 * is static and secret-less so it can run inside `npm run ci:gates`.
 *
 *   npm run perf:search              # all shapes, 6 runs each
 *   npm run perf:search -- --runs=10 # more samples
 *   npm run perf:search -- --json    # machine-readable, for refreshing the baseline
 *
 * WHY IT STUBS next/cache: every search DAL entry point is wrapped in
 * makeResilientCached → unstable_cache. Left in place, run 2..N would measure
 * an in-process memo (sub-millisecond) instead of the query, and a budget
 * built on that number would be meaningless. Stubbing unstable_cache to a
 * passthrough means EVERY run below is a real round trip to Supabase, so
 * "warm" here means a warm database (PostgREST connection reuse, Postgres
 * buffer cache), not a warm Next cache. Production is faster than these
 * numbers whenever the cache hits, never slower.
 *
 * READ ONLY. Every call is a SELECT or a read-only RPC.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ── Stub Next-runtime-only modules in the CJS loader tsx compiles through ────
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}
const originalLoad = Module._load
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'server-only') return {}
  if (request === 'next/cache') {
    return {
      unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
      revalidateTag: () => undefined,
      revalidatePath: () => undefined,
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}

// ── Load .env.local (same var names the app uses) ────────────────────────────
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const envPath = path.join(root, '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const [, key, raw] = m
    if (process.env[key] !== undefined) continue
    process.env[key] = raw.replace(/^["']|["']$/g, '')
  }
}

const args = process.argv.slice(2)
const RUNS = Number(args.find((a) => a.startsWith('--runs='))?.split('=')[1] ?? 6)
const AS_JSON = args.includes('--json')

/** A Bend west-side box, the shape a real drawn search produces. */
const BEND_POLYGON: [number, number][] = [
  [-121.36, 44.02],
  [-121.28, 44.02],
  [-121.28, 44.11],
  [-121.36, 44.11],
]

type Sample = { label: string; group: string; coldMs: number; warmMs: number; p95Ms: number; rows: number }

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[idx]
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

async function measure(
  group: string,
  label: string,
  fn: () => Promise<{ rows: number }>,
  runs = RUNS,
): Promise<Sample> {
  const durations: number[] = []
  let rows = 0
  for (let i = 0; i < runs; i += 1) {
    const started = performance.now()
    const result = await fn()
    durations.push(performance.now() - started)
    rows = result.rows
  }
  const cold = durations[0]
  const warmRuns = durations.slice(1)
  const sorted = [...durations].sort((a, b) => a - b)
  return {
    label,
    group,
    coldMs: Math.round(cold),
    warmMs: Math.round(median(warmRuns.length > 0 ? warmRuns : durations)),
    p95Ms: Math.round(percentile(sorted, 95)),
    rows,
  }
}

async function main() {
  const { searchListingsAll, searchListingsAllCount, getSearchFacetCounts } = await import(
    '../lib/data/index'
  )
  const { getListingsWithAdvanced } = await import('../app/actions/listings')
  const { createClient } = await import('@supabase/supabase-js')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  )

  const samples: Sample[] = []

  // ── searchListingsAll — the MV fast path, five filter shapes ──────────────
  samples.push(
    await measure('searchListingsAll', 'no filters', async () => {
      const r = await searchListingsAll({ limit: 60 })
      return { rows: r.rows.length }
    }),
  )
  samples.push(
    await measure('searchListingsAll', 'city only', async () => {
      const r = await searchListingsAll({ city: 'Bend', limit: 60 })
      return { rows: r.rows.length }
    }),
  )
  samples.push(
    await measure('searchListingsAll', 'city + 2 filters', async () => {
      const r = await searchListingsAll({ city: 'Bend', priceMax: 900000, bedsMin: 3, limit: 60 })
      return { rows: r.rows.length }
    }),
  )
  samples.push(
    await measure('searchListingsAll', 'deep multi-filter', async () => {
      const r = await searchListingsAll({
        city: 'Bend',
        priceMin: 400000,
        priceMax: 1500000,
        bedsMin: 3,
        bathsMin: 2,
        sqftMin: 1500,
        yearBuiltMin: 1990,
        garageMin: 2,
        lotAcresMin: 0.1,
        hasView: true,
        hasFireplace: true,
        sort: 'price_desc',
        limit: 60,
      })
      return { rows: r.rows.length }
    }),
  )
  samples.push(
    await measure('searchListingsAll', 'drawn shape', async () => {
      const r = await searchListingsAll({
        shapes: { include: [{ type: 'polygon', coords: BEND_POLYGON }] },
        limit: 60,
      })
      return { rows: r.rows.length }
    }),
  )

  // ── The count path ────────────────────────────────────────────────────────
  samples.push(
    await measure('searchListingsAllCount', 'city only', async () => {
      const n = await searchListingsAllCount({ city: 'Bend' })
      return { rows: n }
    }),
  )
  samples.push(
    await measure('searchListingsAllCount', 'deep multi-filter', async () => {
      const n = await searchListingsAllCount({
        city: 'Bend',
        priceMin: 400000,
        priceMax: 1500000,
        bedsMin: 3,
        bathsMin: 2,
        sqftMin: 1500,
        yearBuiltMin: 1990,
      })
      return { rows: n }
    }),
  )

  // ── The facet read (live filter counts) ───────────────────────────────────
  samples.push(
    await measure('getSearchFacetCounts', 'all classes', async () => {
      const rows = await getSearchFacetCounts()
      return { rows: rows.length }
    }),
  )

  // ── The shapes RPC, called directly ───────────────────────────────────────
  samples.push(
    await measure('search_listing_keys_in_shapes', 'one polygon', async () => {
      const { data, error } = await supabase
        .rpc('search_listing_keys_in_shapes', {
          p_shapes: { include: [{ type: 'polygon', coords: BEND_POLYGON }] },
        })
        .range(0, 999)
      if (error) throw new Error(error.message)
      return { rows: (data ?? []).length }
    }),
  )

  // ── The RPC fallback (search_listings_advanced) ───────────────────────────
  // Routed through getListingsWithAdvanced with a REACHABLE shape: a closed
  // (sold) scope plus an advanced filter is the combination that falls out of
  // the listing_search_mv gate and into the RPC. Two runs, because as of the
  // last measurement this path exhausts the statement timeout every time.
  samples.push(
    await measure(
      'search_listings_advanced',
      'sold + advanced filter',
      async () => {
        const r = await getListingsWithAdvanced({
          city: 'Bend',
          statusFilter: 'closed',
          includeClosed: true,
          hasView: true,
          limit: 24,
        })
        return { rows: r.listings.length }
      },
      2,
    ),
  )

  if (AS_JSON) {
    console.log(JSON.stringify({ runs: RUNS, measuredAt: new Date().toISOString(), samples }, null, 2))
    return
  }

  const pad = (s: string, n: number) => s.padEnd(n)
  const num = (n: number, w: number) => String(n).padStart(w)
  console.log(`\nSearch read paths, ${RUNS} runs each (unstable_cache stubbed out, so every run is a real query)\n`)
  console.log(`${pad('path', 32)}${pad('shape', 24)}${num(0, 0)}${'cold'.padStart(8)}${'warm'.padStart(8)}${'p95'.padStart(8)}${'rows'.padStart(9)}`)
  console.log('-'.repeat(89))
  for (const s of samples) {
    console.log(
      `${pad(s.group, 32)}${pad(s.label, 24)}${num(s.coldMs, 8)}${num(s.warmMs, 8)}${num(s.p95Ms, 8)}${num(s.rows, 9)}`,
    )
  }
  console.log('\nAll times in milliseconds. cold = first run, warm = median of the rest.')
  console.log('Budgets live in scripts/search-perf-baseline.json (npm run ci:search-perf-budget).\n')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
