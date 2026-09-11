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

// How local are the sold comps, actually? Reads stored diagnostics only.
async function main() {
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const { rows } = await listCmaQueue({ limit: 500 })
  const priced = rows.filter((r) => r.valueLow != null && r.valueHigh != null)
  let noPlat = 0
  let platRanNoneKept = 0
  let platKept = 0
  let adjacentOnly = 0
  let leftBoundary = 0
  let n = 0
  const cutsWhenPlatRanEmpty = new Map<string, number>()
  for (const r of priced) {
    const row = (await getCmaAdminRowBySlug(r.slug)) as Record<string, unknown> | null
    const sel = ((row?.build_summary as Record<string, unknown>)?.comp_selection ?? {}) as Record<string, unknown>
    const counts = (sel.final_tier_counts ?? {}) as Record<string, number>
    const ladder = (sel.ladder ?? []) as Array<Record<string, unknown>>
    if (Object.keys(counts).length === 0) continue
    n++
    const tiers = Object.keys(counts)
    const fromPlat = tiers.filter((t) => t.startsWith('subdivision')).reduce((a, t) => a + Number(counts[t] ?? 0), 0)
    const fromAdjacent = tiers.filter((t) => t.startsWith('adjacent')).reduce((a, t) => a + Number(counts[t] ?? 0), 0)
    const outside = tiers
      .filter((t) => /city-|beyond-|similar-|widened|rural-|like-community|nearby-/.test(t))
      .reduce((a, t) => a + Number(counts[t] ?? 0), 0)
    const platRungs = ladder.filter((t) => String(t.tier).startsWith('subdivision'))
    const platRan = platRungs.some((t) => t.ran === true)
    if (fromPlat > 0) platKept++
    else if (!platRan) noPlat++
    else {
      platRanNoneKept++
      // What did the plat rungs cut, when they ran and kept nothing?
      for (const t of platRungs) {
        const ex = (t.excluded ?? {}) as Record<string, number>
        for (const [k, v] of Object.entries(ex)) {
          if (Number(v) > 0) cutsWhenPlatRanEmpty.set(k, (cutsWhenPlatRanEmpty.get(k) ?? 0) + Number(v))
        }
      }
    }
    if (fromPlat === 0 && fromAdjacent > 0) adjacentOnly++
    if (fromPlat === 0 && fromAdjacent === 0 && outside > 0) leftBoundary++
  }
  console.log(`priced documents with a readable ladder: ${n}\n`)
  console.log(`  kept at least one sale from their OWN plat ...... ${platKept}`)
  console.log(`  no plat to search (MLS placeholder or blank) .... ${noPlat}`)
  console.log(`  plat rungs RAN and kept nothing ................. ${platRanNoneKept}`)
  console.log(`  nothing from the plat, something adjacent ....... ${adjacentOnly}`)
  console.log(`  nothing from plat or adjacent, priced outside ... ${leftBoundary}`)
  if (cutsWhenPlatRanEmpty.size > 0) {
    console.log(`\nwhat the plat rungs cut when they ran and kept nothing:`)
    for (const [k, v] of [...cutsWhenPlatRanEmpty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`  ${String(v).padStart(6)}  ${k}`)
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
