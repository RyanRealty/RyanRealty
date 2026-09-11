import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const rf = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return rf.call(this, req, ...args)
}

// What is left, and why. Reads stored diagnostics only — no rebuild.
async function main() {
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const { rows } = await listCmaQueue({ limit: 500 })
  const wide = rows
    .filter((r) => r.valueLow != null && r.valueHigh != null && (r.recommendedList ?? 0) > 0)
    .map((r) => ({ slug: r.slug, spread: Math.max(r.valueLow!, r.valueHigh!) / Math.min(r.valueLow!, r.valueHigh!) }))
    .filter((r) => r.spread >= 1.2)
    .sort((a, b) => b.spread - a.spread)
  let lastResort = 0
  let ownPlatOnly = 0
  let customNew = 0
  let noAnchor = 0
  console.log(`wider than 1.2x: ${wide.length}\n`)
  for (const w of wide) {
    const row = (await getCmaAdminRowBySlug(w.slug)) as Record<string, unknown> | null
    const sel = ((row?.build_summary as Record<string, unknown>)?.comp_selection ?? {}) as Record<string, unknown>
    const counts = (sel.final_tier_counts ?? {}) as Record<string, number>
    const tiers = Object.keys(counts)
    const total = Object.values(counts).reduce((a, b) => a + Number(b), 0) || 1
    const widened = tiers.filter((t) => t.includes('widened')).reduce((a, t) => a + Number(counts[t] ?? 0), 0)
    const ownPlat = tiers.filter((t) => t.startsWith('subdivision')).reduce((a, t) => a + Number(counts[t] ?? 0), 0)
    const anchor = sel.price_anchor as { ppsf: number } | null | undefined
    const custom = sel.custom_or_new === true
    const flags: string[] = []
    if (widened / total >= 0.5) { lastResort++; flags.push('last-resort rung is most of the set') }
    if (ownPlat / total >= 0.8) { ownPlatOnly++; flags.push('every sale is in the subject own plat') }
    if (custom) { customNew++; flags.push('custom/new') }
    if (anchor == null) { noAnchor++; flags.push('no price tier resolved') }
    console.log(`  ${w.spread.toFixed(2)}x  ${String(w.slug).padEnd(36)} ${flags.join(' | ') || 'mixed'}`)
  }
  console.log(`\nof ${wide.length} wide documents:`)
  console.log(`  the last-resort widening supplied most of the set .. ${lastResort}`)
  console.log(`  every sale came from the subject's own plat ........ ${ownPlatOnly}`)
  console.log(`  custom or new construction ........................ ${customNew}`)
  console.log(`  no price tier could be resolved ................... ${noAnchor}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
