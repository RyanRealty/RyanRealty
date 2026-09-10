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

// Of the documents whose MLS row names no subdivision, how many sit inside a
// RECORDED plat? That number decides whether matching on the polygon is worth
// building. Nothing here guesses a coordinate.
async function main() {
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const { assignSubdivisionSlugs } = await import('@/lib/data/geo/subdivision-ring')
  const { realSubdivision } = await import('@/lib/cma/comp-tiers')
  const { rows } = await listCmaQueue({ limit: 500 })
  const cases: Array<{ slug: string; lat: number; lng: number; hasName: boolean }> = []
  for (const r of rows) {
    const row = (await getCmaAdminRowBySlug(r.slug)) as Record<string, unknown> | null
    const args = (row?.render_args ?? {}) as Record<string, unknown>
    const subj = (args.subject ?? {}) as Record<string, unknown>
    const lat = Number(subj.latitude)
    const lng = Number(subj.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    cases.push({ slug: r.slug, lat, lng, hasName: realSubdivision(String(subj.subdivision ?? '')) != null })
  }
  const slugs = await assignSubdivisionSlugs(cases.map((c) => ({ lat: c.lat, lng: c.lng })))
  let named = 0, namedInPlat = 0, unnamed = 0, unnamedInPlat = 0
  cases.forEach((c, i) => {
    const inPlat = slugs[i] != null
    if (c.hasName) { named++; if (inPlat) namedInPlat++ }
    else { unnamed++; if (inPlat) unnamedInPlat++ }
  })
  console.log(`documents with usable coordinates: ${cases.length}`)
  console.log(`  MLS names a subdivision ......... ${named}  (also inside a recorded plat: ${namedInPlat})`)
  console.log(`  MLS names none .................. ${unnamed}  (inside a recorded plat: ${unnamedInPlat})`)
  console.log(`\nmatching on the recorded plat would give a plat to ${unnamedInPlat} document(s) that have none today.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
