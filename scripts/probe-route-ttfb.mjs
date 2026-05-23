#!/usr/bin/env node
/**
 * SITE_SPEC §45-47 — TTFB p50/p95/p99 probe for the public LP families.
 *
 * Fires N requests per route with `Cache-Control: no-cache` headers off
 * (so we measure CDN + warm-cache behavior, not artificially cold). Reports
 * p50 / p95 / p99 along with the spec's pass/fail thresholds.
 *
 * Usage:
 *   node scripts/probe-route-ttfb.mjs [--samples=20] [--base=https://ryanrealty.vercel.app]
 *
 * Default samples=10, default base=production Vercel URL.
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/)
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), 'true']
  }),
)

const SAMPLES = Number(args.samples ?? 10)
const BASE = (args.base ?? 'https://ryanrealty.vercel.app').replace(/\/$/, '')

// Each entry: [label, path, p95_budget_ms]. Budgets pulled from SITE_SPEC §45-47.
const ROUTES = [
  ['homepage', '/', 200],
  ['city/bend', '/cities/bend', 300],
  ['city/redmond', '/cities/redmond', 300],
  ['city/sisters', '/cities/sisters', 300],
  ['neighborhood/awbrey-butte', '/cities/bend/awbrey-butte', 300],
  ['community/tetherow', '/communities/tetherow', 300],
  ['community/sunriver', '/communities/sunriver', 300],
  ['zip/97701', '/zip/97701', 200],
  ['zip/97703', '/zip/97703', 200],
]

function pct(arr, p) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

async function probeOne(url) {
  const t0 = performance.now()
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual' })
    // TTFB = headers arrived. Read ONE byte to confirm body started streaming
    // then bail. Reading the full body would measure total-time, not TTFB.
    const reader = res.body?.getReader()
    if (reader) {
      await reader.read()
      reader.cancel().catch(() => {})
    }
    return { ms: performance.now() - t0, status: res.status, cache: res.headers.get('x-vercel-cache') }
  } catch (err) {
    return { ms: performance.now() - t0, status: 0, cache: null, err: String(err) }
  }
}

async function probeRoute(label, path, budget) {
  const url = `${BASE}${path}`
  const samples = []
  let firstCacheState = null
  let lastCacheState = null
  for (let i = 0; i < SAMPLES; i++) {
    const r = await probeOne(url)
    samples.push(r.ms)
    if (i === 0) firstCacheState = r.cache
    lastCacheState = r.cache
  }
  const p50 = pct(samples, 50)
  const p95 = pct(samples, 95)
  const p99 = pct(samples, 99)
  const verdict = p95 <= budget ? 'PASS' : 'FAIL'
  return { label, path, p50, p95, p99, budget, verdict, firstCacheState, lastCacheState }
}

;(async () => {
  console.log(`Probing ${ROUTES.length} routes × ${SAMPLES} samples each against ${BASE}`)
  console.log('')
  const results = []
  for (const [label, path, budget] of ROUTES) {
    const r = await probeRoute(label, path, budget)
    results.push(r)
    const fmt = (n) => `${Math.round(n)}ms`.padStart(7)
    console.log(
      `${label.padEnd(28)} p50=${fmt(r.p50)}  p95=${fmt(r.p95)}  p99=${fmt(r.p99)}  target<${r.budget}ms  [${r.verdict}]  cache=${r.firstCacheState ?? '?'}→${r.lastCacheState ?? '?'}`
    )
  }
  const failed = results.filter((r) => r.verdict === 'FAIL').length
  console.log('')
  console.log(failed === 0 ? `✓ All ${results.length} routes pass p95 budget.` : `✗ ${failed} of ${results.length} routes FAIL p95 budget.`)
  process.exit(failed === 0 ? 0 : 1)
})()
