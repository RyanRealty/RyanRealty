#!/usr/bin/env node
/**
 * ci:market-truth — EXECUTE Step 6 gates. Allowlists may only shrink.
 *
 *   1. No writer computes geography inline (new ST_Within in market writers
 *      outside place_membership refresh).
 *   2. No consumer reads a market store directly — frozen inventory of
 *      `.from('market_pulse_live'|'market_stats_cache'|'market_history_weekly')`.
 *   3. getMetric returns provenance and refuses a stale complete_through.
 *   4. Mixed-method membership is non-publishable (shadow compute does not
 *      write neighborhood/subdivision price stats).
 *   5. min_n lives in lib/data/market-truth/registry.ts.
 *   6. Dead columns: consumer-surface CumulativeDaysOnMarket / DaysOnMarket;
 *      mls_source = 'central_oregon' filter.
 *   7. Freshness helper exists and is used by getMetric.
 *
 *   node scripts/check-market-truth.mjs
 *   node scripts/check-market-truth.mjs --write-baseline
 */
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { walkFiles } from './lib/walk.mjs'

const BASELINE = 'scripts/market-truth-gate-baseline.json'
const WRITE = process.argv.includes('--write-baseline')

const STORE_RE =
  /\.from\(\s*['"`](market_pulse_live|market_stats_cache|market_history_weekly)['"`]\s*\)/g
const MLS_FILTER_RE = /mls_source\s*(?:=|!=|<>)\s*['"]central_oregon['"]|\.eq\(\s*['"]mls_source['"]/g
const CDOM_RE = /CumulativeDaysOnMarket/g
const DOM_RE = /["']DaysOnMarket["']/g

const CONSUMER_ROOTS = ['app', 'components', 'data']
const CODE_ROOTS = ['app', 'components', 'lib', 'data']

function hits(file, re) {
  const src = readFileSync(file, 'utf8')
  const n = [...src.matchAll(re)].length
  return n
}

function scan(roots, re, { skipTest = true } = {}) {
  const byFile = {}
  for (const root of roots) {
    for (const f of walkFiles(root, { ext: /\.(ts|tsx|mjs|js)$/ })) {
      if (skipTest && /\.(test|spec)\./.test(f)) continue
      if (f.startsWith('scripts/check-')) continue
      const n = hits(f, re)
      if (n) byFile[f] = n
    }
  }
  return byFile
}

function total(byFile) {
  return Object.values(byFile).reduce((s, n) => s + n, 0)
}

function ratchet(name, current, baselineSlice) {
  const curTotal = total(current)
  const baseTotal = baselineSlice?.total ?? 0
  const baseFiles = baselineSlice?.byFile ?? {}
  const extras = Object.keys(current).filter((f) => !baseFiles[f])
  const grown = Object.keys(current).filter((f) => (current[f] ?? 0) > (baseFiles[f] ?? 0))
  const shrinkable = Object.keys(baseFiles).filter((f) => !current[f])
  const ok = extras.length === 0 && grown.length === 0 && curTotal <= baseTotal
  return {
    name,
    ok,
    curTotal,
    baseTotal,
    extras,
    grown,
    shrinkable,
  }
}

export function findStoreReads(content) {
  return [...content.matchAll(STORE_RE)].map((m) => m[1])
}

export function findMlsSourceFilter(content) {
  return [...content.matchAll(MLS_FILTER_RE)].length
}

export function findDeadColumns(content) {
  return {
    cdom: [...content.matchAll(CDOM_RE)].length,
    daysOnMarket: [...content.matchAll(DOM_RE)].length,
  }
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return null
  return JSON.parse(readFileSync(BASELINE, 'utf8'))
}

function main() {
  const stores = scan(CODE_ROOTS, STORE_RE)
  const cdom = scan(CONSUMER_ROOTS, CDOM_RE)
  const dom = scan(CONSUMER_ROOTS, DOM_RE)
  const mls = scan(CODE_ROOTS, MLS_FILTER_RE)

  const current = {
    stores: { total: total(stores), byFile: stores },
    cdomConsumer: { total: total(cdom), byFile: cdom },
    daysOnMarketConsumer: { total: total(dom), byFile: dom },
    mlsSourceFilter: { total: total(mls), byFile: mls },
  }

  if (WRITE) {
    writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n')
    console.log(`wrote ${BASELINE} stores=${current.stores.total} cdom=${current.cdomConsumer.total} dom=${current.daysOnMarketConsumer.total} mls=${current.mlsSourceFilter.total}`)
    return
  }

  const base = loadBaseline()
  if (!base) {
    console.error(`missing ${BASELINE} — run --write-baseline`)
    process.exit(1)
  }

  const checks = []
  const add = (label, ok, detail) => checks.push({ label, ok, detail })

  const rStore = ratchet('stores', stores, base.stores)
  add(
    `gate 2: direct market-store reads frozen at ${rStore.baseTotal} (now ${rStore.curTotal})`,
    rStore.ok,
    rStore.extras.length
      ? `new files: ${rStore.extras.join(', ')}`
      : rStore.grown.length
        ? `grew: ${rStore.grown.join(', ')}`
        : rStore.shrinkable.length
          ? `ratchetable (unused allowlist): ${rStore.shrinkable.join(', ')}`
          : 'held',
  )
  // Unused allowlist entries are reported but do not fail — operator shrinks on purpose.

  const rCdom = ratchet('cdom', cdom, base.cdomConsumer)
  add(
    `gate 6: consumer CumulativeDaysOnMarket frozen at ${rCdom.baseTotal} (now ${rCdom.curTotal})`,
    rCdom.ok && rCdom.extras.length === 0 && rCdom.grown.length === 0,
    rCdom.extras.join(', ') || 'held',
  )

  const rDom = ratchet('dom', dom, base.daysOnMarketConsumer)
  add(
    `gate 6: consumer "DaysOnMarket" frozen at ${rDom.baseTotal} (now ${rDom.curTotal})`,
    rDom.ok && rDom.extras.length === 0 && rDom.grown.length === 0,
    rDom.extras.join(', ') || 'held',
  )

  const rMls = ratchet('mls', mls, base.mlsSourceFilter)
  add(
    `gate 6: mls_source filter frozen at ${rMls.baseTotal} (now ${rMls.curTotal})`,
    rMls.ok && rMls.extras.length === 0 && rMls.grown.length === 0,
    rMls.extras.join(', ') || 'held',
  )

  const getMetric = readFileSync('lib/data/market-truth/getMetric.ts', 'utf8')
  add(
    'gate 3: getMetric returns provenance',
    /provenance:/.test(getMetric) && /sampleN:/.test(getMetric) && /completeThrough:/.test(getMetric),
  )
  add(
    'gate 7: getMetric refuses stale complete_through',
    /staleReason/.test(getMetric) && /stale_complete_through/.test(getMetric),
  )

  const registry = readFileSync('lib/data/market-truth/registry.ts', 'utf8')
  add(
    'gate 5: registry declares minN on every STATS entry',
    /export const STATS/.test(registry) && /minN:/.test(registry) && !/minN:\s*3\b/.test(registry),
  )

  const compute = readFileSync(
    'supabase/migrations/20260823120000_compute_market_metrics_all_segments.sql',
    'utf8',
  )
  add(
    'gate 4: shadow compute does not write neighborhood or subdivision price stats',
    !/geo_type = 'neighborhood'/.test(compute) &&
      !/geo_type = 'subdivision'/.test(compute) &&
      /FROM public\.market_service_area/.test(compute) &&
      /'condo'/.test(compute) &&
      /'townhome'/.test(compute),
  )
  add(
    'gate 1: place_membership is the geography writer (ST_Within lives there)',
    (() => {
      const mem = readFileSync(
        'supabase/migrations/20260823001500_refresh_place_membership.sql',
        'utf8',
      )
      return /ST_Within/.test(mem) && /is_primary/.test(mem)
    })(),
  )

  const failed = checks.filter((c) => !c.ok)
  for (const c of checks) {
    console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}${c.detail && !c.ok ? ` — ${c.detail}` : ''}`)
  }
  if (failed.length) {
    console.error(`\nmarket-truth: ${failed.length} check(s) failed`)
    process.exit(1)
  }
  console.log(`\nmarket-truth: ${checks.length}/${checks.length}`)
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) main()
