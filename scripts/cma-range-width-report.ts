/**
 * How wide is the range on every priced document in the queue?
 *
 * Matt 2026-09-10, on 23 Benaiah: "we should never have a range this wide."
 * The cause was a price-tier cut that could not run (lib/pricing/price-anchor.ts),
 * so every document built before that fix carries a comp set nothing graded on
 * price. This is the blast radius, measured rather than guessed.
 *
 *   npx tsx scripts/cma-range-width-report.ts
 */
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
async function main() {
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { rows } = await listCmaQueue({ limit: 500 })
  const priced = rows.filter((r) => r.valueLow != null && r.valueHigh != null && (r.recommendedList ?? 0) > 0)
  if (priced.length === 0) {
    console.error('UNREADABLE: no priced rows came back — refusing to report a clean sheet.')
    process.exit(2)
  }
  const scored = priced.map((r) => {
    const low = Math.min(r.valueLow!, r.valueHigh!)
    const high = Math.max(r.valueLow!, r.valueHigh!)
    const rec = r.recommendedList!
    return { slug: r.slug, address: r.address, lane: r.origin, low, high, rec, spread: high / low, widest: Math.max((rec - low) / rec, (high - rec) / rec) }
  })
  const band = (min: number, max: number) => scored.filter((s) => s.spread >= min && s.spread < max).length
  console.log(`priced documents in the queue: ${scored.length}`)
  console.log(`  high/low under 1.2x .......... ${band(0, 1.2)}`)
  console.log(`  1.2x to 1.5x ................. ${band(1.2, 1.5)}`)
  console.log(`  1.5x to 2x ................... ${band(1.5, 2)}`)
  console.log(`  2x or wider .................. ${band(2, Infinity)}`)
  const worst = [...scored].sort((a, b) => b.spread - a.spread).slice(0, 10)
  console.log('\nwidest ten:')
  for (const w of worst) {
    console.log(
      `  ${w.spread.toFixed(2)}x  ${String(w.slug).padEnd(34)} $${w.low.toLocaleString()}-$${w.high.toLocaleString()} around $${w.rec.toLocaleString()}  ${w.lane}`,
    )
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
