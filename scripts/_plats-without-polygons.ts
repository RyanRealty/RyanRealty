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
// How many plats render through the MLS-name path only (live SFR homes, no recorded
// polygon, no registry alias)? Those are the pages that open with no photo and no atlas.
async function main() {
  const { getListingTiles } = await import('@/lib/data/listings/getListingTiles')
  const { getSubdivisionBoundarySlugs } = await import('@/lib/data/subdivisions/getSubdivisionBoundarySlugs')
  const { slugify } = await import('@/lib/slug')
  const { cmaSubdivisionHref } = await import('@/lib/cma/cma-place-links')
  const tiles = await getListingTiles({ status: 'active', propertySubType: 'Single Family Residence', limit: 1000 })
  const slugs = new Set(await getSubdivisionBoundarySlugs())
  const byName = new Map<string, number>()
  for (const t of tiles as Array<{ subdivisionName?: string | null }>) {
    const name = (t.subdivisionName ?? '').trim()
    if (!name || /^(n\/?a|none|null|—|-|other|not available)$/i.test(name)) continue
    byName.set(name, (byName.get(name) ?? 0) + 1)
  }
  // Plain plats only: a registry community or an area redirect has its own page.
  const missing = [...byName.entries()].filter(([name]) => !slugs.has(slugify(name)) && (cmaSubdivisionHref(name) ?? '').includes('/subdivisions/'))
  console.log(`active SFR tiles read: ${tiles.length}; distinct subdivision names: ${byName.size}; boundary slugs: ${slugs.size}`)
  console.log(`names with live SFR homes but NO recorded polygon: ${missing.length} (${missing.reduce((n, [, c]) => n + c, 0)} homes)`)
  console.log(missing.sort((a, b) => b[1] - a[1]).slice(0, 25).map(([n, c]) => `${n} (${c})`).join(' · '))
}
main().catch((e) => { console.error(e); process.exit(1) })
