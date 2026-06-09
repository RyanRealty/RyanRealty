#!/usr/bin/env node
/**
 * check-measurement-loop.mjs — CI gate: the marketing measurement loop stays wired.
 *
 * The loop (publisher-sweep -> performance-pull-48h/7d/30d -> seller-lead-attribution
 * -> content_performance.north_star_attributed_seller_leads) silently produced ZERO
 * rows for weeks because the writer/reader contract drifted with nothing checking it:
 *   - publisher-sweep wrote executor_response.publish_result but the pulls read
 *     executor_response.published_to (a key nobody wrote).
 *   - the pulls upserted ON CONFLICT (action_id,platform,post_external_id) with no
 *     matching unique index, so every upsert threw (and was swallowed).
 *   - fetchMetaPostMetrics was a hard-throw stub, so no post ever got real metrics.
 *   - FUB exposes sourceUrl but NOT utmContent, so attribution matched on a field
 *     that is always undefined.
 *
 * This gate asserts each of those load-bearing invariants so the loop cannot
 * regress to "wired but dead" again. It is a hard assertion gate (not baselined):
 * every invariant must hold.
 *
 * Usage: node scripts/check-measurement-loop.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const read = (p) => {
  const full = resolve(ROOT, p)
  return existsSync(full) ? readFileSync(full, 'utf8') : null
}

const failures = []
const check = (desc, cond) => {
  if (!cond) failures.push(desc)
}

const PULLS = [
  'app/api/cron/performance-pull-48h/route.ts',
  'app/api/cron/performance-pull-7d/route.ts',
  'app/api/cron/performance-pull-30d/route.ts',
]

// 1. publisher-sweep must emit executor_response.published_to (the post-identity
//    shape every pull reads). Without it the pulls iterate an empty array.
const sweep = read('app/api/cron/publisher-sweep/route.ts')
check('publisher-sweep/route.ts is missing', sweep !== null)
if (sweep) {
  check('publisher-sweep must write executor_response.published_to', /published_to\s*:/.test(sweep))
  check('publisher-sweep must upsert content_performance with onConflict action_id,platform',
    /onConflict:\s*['"]action_id,platform['"]/.test(sweep))
  check('publisher-sweep must stamp utm_content=action_id onto post links (attribution sender side)',
    /utm_content/.test(sweep))
}

// 2. Each performance-pull cron must read published_to and upsert on the SAME key
//    backed by the content_performance_action_platform_key unique index. The
//    3-column onConflict has no matching index and throws at runtime.
for (const p of PULLS) {
  const src = read(p)
  check(`${p} is missing`, src !== null)
  if (!src) continue
  check(`${p} must read executor_response.published_to`, /published_to/.test(src))
  check(`${p} must upsert with onConflict 'action_id,platform'`,
    /onConflict:\s*['"]action_id,platform['"]/.test(src))
  check(`${p} must NOT use the unindexed onConflict 'action_id,platform,post_external_id'`,
    !/action_id,platform,post_external_id/.test(src))
}

// 3. The three pulls must be scheduled in vercel.json, or the loop never fires.
const vercel = read('vercel.json')
check('vercel.json is missing', vercel !== null)
if (vercel) {
  for (const cron of ['performance-pull-48h', 'performance-pull-7d', 'performance-pull-30d']) {
    check(`vercel.json must schedule /api/cron/${cron}`, vercel.includes(`/api/cron/${cron}`))
  }
}

// 4. The Meta per-post fetcher must be implemented (not the throwing stub) — IG/FB
//    are the only platforms with a live token, so without it no post gets metrics.
const meta = read('lib/meta-graph.ts')
check('lib/meta-graph.ts is missing', meta !== null)
if (meta) {
  check('fetchMetaPostMetrics must be implemented (the fetcher_not_implemented stub is gone)',
    !/platform_skipped:meta:fetcher_not_implemented/.test(meta))
  check('fetchMetaPostMetrics must call the Graph insights endpoint',
    /\/insights/.test(meta) && /fetchMetaPostMetrics/.test(meta))
}

// 5. Attribution must match on utm parsed from sourceUrl (FUB exposes sourceUrl but
//    NOT utmContent), and the seller LP must forward the inbound utm into sourceUrl.
const attr = read('app/api/cron/seller-lead-attribution/route.ts')
check('seller-lead-attribution/route.ts is missing', attr !== null)
if (attr) {
  check('seller-lead-attribution must recover utm from sourceUrl (FUB has no utmContent field)',
    /utmFromSourceUrl|searchParams\.get\(\s*['"]utm_content['"]\s*\)/.test(attr))
}
const lp = read('app/lp/seller-home-value/actions.ts')
check('seller LP actions.ts is missing', lp !== null)
if (lp) {
  check('seller LP must forward inbound utm into the FUB sourceUrl (leadSourceUrl)',
    /leadSourceUrl/.test(lp) && /utm_content/.test(lp))
}

// ── Report ────────────────────────────────────────────────────────────────
console.log('Measurement-loop wiring check')
console.log('=============================\n')
if (failures.length === 0) {
  console.log('OK — measurement loop is fully wired:')
  console.log('  publisher-sweep -> published_to + utm stamp')
  console.log('  performance-pull-48h/7d/30d -> read published_to, upsert (action_id,platform)')
  console.log('  3 pulls scheduled in vercel.json')
  console.log('  fetchMetaPostMetrics implemented')
  console.log('  attribution parses utm from sourceUrl; LP forwards it')
  process.exit(0)
}
console.log(`BROKEN — ${failures.length} measurement-loop invariant(s) violated:\n`)
for (const f of failures) console.log(`  ✗ ${f}`)
console.log('\nThe loop will silently produce zero rows if any of these regress.')
console.log('See scripts/check-measurement-loop.mjs header for the failure history.')
process.exit(1)
