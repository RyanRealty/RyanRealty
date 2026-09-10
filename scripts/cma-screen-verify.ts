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
/**
 * A SECOND QUERY SHAPE over the screen's verdict (§0). The screen decides from
 * an ADDRESS match; this checks every row it cleared by the subject's own
 * ListingKey, and separately asks whether that key's status is live.
 * Any disagreement is a screen defect and prints loudly.
 */
async function main() {
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const { findCmaSubjectByMls } = await import('@/lib/data')
  const { rows } = await listCmaQueue({ limit: 500 })
  const lanes = rows.filter((r) => (r.origin === 'expired' || r.origin === 'fsbo') && r.state !== 'archived')
  if (lanes.length === 0) {
    console.error('UNREADABLE: no lane rows came back.')
    process.exit(2)
  }
  const LIVE = new Set(['Active', 'Active Under Contract', 'Coming Soon', 'Pending'])
  let checked = 0
  let noKey = 0
  const problems: string[] = []
  for (const r of lanes) {
    const full = (await getCmaAdminRowBySlug(r.slug)) as Record<string, unknown> | null
    const key = (full?.subject_listing_key as string | null) ?? null
    if (!key) {
      noKey++
      continue
    }
    const own = await findCmaSubjectByMls(key)
    const row = own[0] as unknown as Record<string, unknown> | undefined
    if (!row) continue
    checked++
    const status = String(row.StandardStatus ?? '')
    if (LIVE.has(status)) {
      problems.push(`${r.slug} — its own listing ${key} is ${status}`)
    }
  }
  console.log(`lane rows in the queue: ${lanes.length}`)
  console.log(`verified by their own MLS key: ${checked} · no key on the row: ${noKey}`)
  if (problems.length === 0) {
    console.log('AGREES: no cleared row has a live listing of its own.')
  } else {
    console.log(`DISAGREES on ${problems.length}:`)
    for (const p of problems) console.log('  ', p)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
