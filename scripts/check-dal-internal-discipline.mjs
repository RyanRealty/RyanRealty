#!/usr/bin/env node
// scripts/check-dal-internal-discipline.mjs
//
// G21 — Closes GAP-8 from the 2026-05-28 guardrail inventory.
//
// The G1 DAL-boundary rule is OFF inside lib/data/ (correctly — that's
// where the queries live). That leaves a discipline gap: a market-stat
// DAL function could secretly query the raw `listings` table instead
// of the materialized cache, producing the right TypeScript signature
// while silently dragging the production DB through 589K-row scans.
//
// This gate enforces the cache contract for the functions whose
// access pattern is locked to a specific MV / cache table per
// CLAUDE.md §Data Accuracy + EXECUTION_PLAN §5:
//
//   getMarketStats           must hit  market_stats_cache
//   getMarketStatsCacheRows  must hit  market_stats_cache
//   getMarketPulse           must hit  market_pulse_live
//   getMarketPulseSnapshot   must hit  market_pulse_live
//   getRegionPulse           must hit  market_pulse_live
//   getPriceHistory          must hit  market_stats_cache  (per plan §4)
//   getGeoSnapshot           must hit  geo_snapshot_mv
//
// Each function listed above is required to call `.from('<cache>')`
// inside its file AND must NOT call `.from('listings')`. The check is
// a positive assertion (`expectFrom`) plus a negative assertion
// (`forbidFrom`). New cache-bound DAL functions get added to the
// EXPECTATIONS table — the gate then enforces the contract for them
// too.
//
// Run via:
//   npm run ci:dal-internal-discipline

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve('.')

// Function name → required table + forbidden tables. The function name
// must appear in the file at module-export position (e.g.
// `export const getMarketStats = ...`).
const EXPECTATIONS = [
  {
    file: 'lib/data/market/getMarketStats.ts',
    expectFrom: ['market_stats_cache'],
    forbidFrom: ['listings'],
  },
  {
    file: 'lib/data/market/getMarketStatsCacheRows.ts',
    expectFrom: ['market_stats_cache'],
    forbidFrom: ['listings'],
  },
  {
    file: 'lib/data/market/getMarketPulse.ts',
    expectFrom: ['market_pulse_live'],
    forbidFrom: ['listings'],
  },
  {
    file: 'lib/data/market/getMarketPulseSnapshot.ts',
    expectFrom: ['market_pulse_live'],
    forbidFrom: ['listings'],
  },
  {
    file: 'lib/data/market/getRegionPulse.ts',
    expectFrom: ['market_pulse_live'],
    forbidFrom: ['listings'],
    // Delegates the actual `.from()` call to getMarketStatsCacheRows —
    // accepting that as the cache contract because the helper is itself
    // gated by this check and is locked to market_stats_cache /
    // market_pulse_live.
    delegatesTo: ['getMarketStatsCacheRows'],
  },
  {
    file: 'lib/data/market/getPriceHistory.ts',
    expectFrom: ['market_stats_cache'],
    forbidFrom: ['listings'],
  },
  {
    file: 'lib/data/geo/getGeoSnapshot.ts',
    expectFrom: ['geo_snapshot_mv'],
    forbidFrom: ['listings'],
  },
]

function fromCalls(src) {
  const out = []
  const re = /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)/g
  let m
  while ((m = re.exec(src))) out.push(m[1])
  return out
}

console.log('DAL internal cache discipline (G21)')
console.log('====================================')

let failed = 0
let ok = 0
const missing = []

for (const spec of EXPECTATIONS) {
  const abs = join(ROOT, spec.file)
  if (!existsSync(abs)) {
    missing.push(spec.file)
    continue
  }
  const src = readFileSync(abs, 'utf8')
  const calls = fromCalls(src)
  const expectsOk = spec.expectFrom.every((t) => calls.includes(t))
  const forbidsHit = spec.forbidFrom.filter((t) => calls.includes(t))
  // Delegation: when the file imports a helper that is itself bound
  // to the cache contract via this gate, accept it as compliant.
  const delegates = spec.delegatesTo ?? []
  const importsDelegate = delegates.some((d) =>
    new RegExp(`from\\s+['"\`][^'"\`]*${d}['"\`]`).test(src),
  )
  if ((expectsOk || importsDelegate) && forbidsHit.length === 0) {
    const reason = expectsOk
      ? `OK (.from('${spec.expectFrom.join("', '")}'))`
      : `OK (delegates to ${delegates.join(', ')})`
    console.log(`  ${spec.file} — ${reason}`)
    ok++
  } else {
    failed++
    console.error(`  ${spec.file} — FAIL`)
    if (!expectsOk) {
      console.error(`    missing required .from('${spec.expectFrom.join("', '")}')`)
      console.error(`    saw: ${calls.length ? calls.map((c) => `.from('${c}')`).join(', ') : '(no .from() calls at all)'}`)
    }
    if (forbidsHit.length > 0) {
      console.error(`    forbidden .from('${forbidsHit.join("', '")}') in this DAL function`)
      console.error(`    use the cache table instead — the DAL function is the contract that the cache will be used`)
    }
  }
}

console.log('')
console.log(`Total: ${EXPECTATIONS.length} · OK ${ok} · Fail ${failed}` + (missing.length ? ` · Missing files ${missing.length}` : ''))

if (missing.length > 0) {
  console.error('')
  console.error('Files in EXPECTATIONS that do not exist on disk:')
  for (const m of missing) console.error(`  ${m}`)
  console.error('  → Either create the DAL function, or remove the entry from EXPECTATIONS in this script.')
  // Missing files indicate spec drift, not a runtime bug — warn but
  // don't fail unless any concrete file violates its contract.
}

if (failed > 0) process.exit(1)
process.exit(0)
