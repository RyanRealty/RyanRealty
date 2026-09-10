/**
 * The unpriced rows for one city, each with its subject facts and the full
 * refusal text, so a cause can be read rather than guessed.
 *
 *   npx tsx scripts/cma-unpriced-sample.ts Bend 8
 */
import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}
async function main() {
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const { rows } = await listCmaQueue({ limit: 500 })
  const city = process.argv[2] ?? 'Bend'
  const n = Number(process.argv[3] ?? 10)
  const unpriced = rows.filter((r) => r.valueLow == null && r.buildError && String(r.city) === city).slice(0, n)
  let missingSqft = 0, acreage = 0
  for (const r of unpriced) {
    const row = (await getCmaAdminRowBySlug(r.slug)) as Record<string, unknown> | null
    if (!row) continue
    const sqft = row.subject_sqft as number | null
    const summary = row.build_summary as Record<string, unknown> | null
    const site = (summary?.site ?? null) as Record<string, unknown> | null
    const acres = site?.acreage as number | null
    if (!sqft) missingSqft++
    if (typeof acres === 'number' && acres >= 1) acreage++
    console.log(
      `${String(r.address).slice(0, 34).padEnd(34)} sqft=${sqft ?? '—'} beds=${row.subject_beds ?? '—'} acres=${acres ?? '—'} sub=${String(row.subject_subdivision ?? '—').slice(0, 20).padEnd(20)}`,
    )
    console.log(`   ${String(r.buildError).replace(/\s+/g, ' ').slice(0, 230)}`)
  }
  console.log(`\n${city}: sampled ${unpriced.length} · missing sqft ${missingSqft} · acreage >= 1 ${acreage}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
