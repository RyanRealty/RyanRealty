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
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const row = (await getCmaAdminRowBySlug(process.argv[2]!)) as Record<string, unknown>
  const args = (row.render_args ?? {}) as Record<string, unknown>
  const pricing = (args.pricing ?? {}) as Record<string, unknown>
  const adj = (args.adjustedComps ?? pricing.adjustedComps ?? []) as Array<Record<string, unknown>>
  console.log('value', row.value_low, '-', row.value_high, '| rec', row.recommended_list)
  for (const k of Object.keys(pricing)) {
    const v = pricing[k]
    if (typeof v === 'number' || typeof v === 'string') console.log(`  ${k}: ${v}`)
  }
  console.log(`\nadjusted comps (${adj.length}):`)
  for (const c of adj) {
    console.log(`  ${String(c.address).padEnd(24)} close $${Number(c.closePrice ?? 0).toLocaleString().padStart(9)} -> adj $${Number(c.adjustedPrice ?? c.adjusted ?? 0).toLocaleString().padStart(9)} | time ${c.timeAdjustment ?? '-'} | size ${c.sizeAdjustment ?? '-'} | ${c.keepTier ?? c.tier ?? ''} | rooms ${JSON.stringify(c.roomDifference ?? null)}`)
  }
  const rr = (pricing.rangeRule ?? {}) as Record<string, unknown>
  if (Object.keys(rr).length) console.log('\nrangeRule', JSON.stringify(rr))
}
main().catch((e) => { console.error(e); process.exit(1) })
