import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import path from 'node:path'
import Module from 'node:module'
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}
/**
 * THE CLASS LIST for SITE-56: which plat pages can draw a recorded outline, and
 * which are genuinely unrecorded and fall to the drawn-ground path.
 *
 * Before 2026-09-09 a page resolved its polygon by EXACT slug only, and this
 * script counted every name that missed as "no recorded polygon". Most of them
 * had one. The resolver (public.subdivision_footprint, wired through
 * lib/data/subdivisions/getSubdivisionFootprint) tries three shapes, and the
 * three counts below MIRROR ITS RULES against one read of the plat slugs, so a
 * class list costs one query instead of a thousand RPC calls:
 *
 *   exact    slugify(SubdivisionName) is a recorded plat slug.
 *   phases   recorded plat slugs START WITH it — the county's phases and
 *            additions, unioned into the development's footprint.
 *   members  the plat slugs the homes' own `boundary_subdivision` names, written
 *            by the point-in-polygon classifier.
 *
 * Anything left resolves to no polygon at all and opens on its own drawn ground.
 */
async function main() {
  const { getListingTiles } = await import('@/lib/data/listings/getListingTiles')
  const { getSubdivisionBoundarySlugs } = await import('@/lib/data/subdivisions/getSubdivisionBoundarySlugs')
  const { slugify } = await import('@/lib/slug')
  const { cmaSubdivisionHref } = await import('@/lib/cma/cma-place-links')
  // PostgREST caps a range at 1,000 rows however large the limit, so the read
  // is paged — a class list built from a 1,000-row sample undercounts the class.
  const tiles: Array<{ subdivisionName?: string | null; boundarySubdivision?: string | null }> = []
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const page = await getListingTiles({
      status: 'active',
      propertySubType: 'Single Family Residence',
      limit: 1000,
      offset,
      // Statewide: the unresolved class is the plats outside Deschutes.
      // The default service-area guard would hide Klamath/Jefferson/Crook,
      // which is the class SITE-58 exists to shrink.
      scope: 'all',
    })
    tiles.push(...page)
    if (page.length < 1000) break
  }
  const platSlugs = await getSubdivisionBoundarySlugs()
  const slugs = new Set(platSlugs)
  const byName = new Map<string, { homes: number; members: Set<string> }>()
  for (const t of tiles) {
    const name = (t.subdivisionName ?? '').trim()
    if (!name || /^(n\/?a|none|null|—|-|other|not available)$/i.test(name)) continue
    let e = byName.get(name)
    if (!e) { e = { homes: 0, members: new Set() }; byName.set(name, e) }
    e.homes += 1
    const member = (t.boundarySubdivision ?? '').trim()
    if (member) e.members.add(slugify(member))
  }
  // Plain plats only: a registry community or an area redirect has its own page.
  const platPage = (name: string) => (cmaSubdivisionHref(name) ?? '').includes('/subdivisions/')
  const shape = (name: string, e: { members: Set<string> }): 'exact' | 'phases' | 'members' | 'none' => {
    const slug = slugify(name)
    if (slugs.has(slug)) return 'exact'
    if (platSlugs.some((p) => p.startsWith(`${slug}-`))) return 'phases'
    if ([...e.members].some((m) => slugs.has(m))) return 'members'
    return 'none'
  }
  const rows = [...byName.entries()].filter(([name]) => platPage(name)).map(([name, e]) => ({ name, homes: e.homes, shape: shape(name, e) }))
  const count = (s: string) => rows.filter((r) => r.shape === s).length
  const homes = (s: string) => rows.filter((r) => r.shape === s).reduce((n, r) => n + r.homes, 0)
  console.log(`active SFR tiles read: ${tiles.length}; distinct subdivision names on a /subdivisions/ page: ${rows.length}; recorded plat polygons: ${platSlugs.length}`)
  for (const s of ['exact', 'phases', 'members', 'none'] as const) {
    console.log(`  ${s}: ${count(s)} names, ${homes(s)} homes`)
  }
  console.log(`RESOLVES BY EXACT SLUG ALONE (the rule before SITE-56): ${count('exact')}`)
  console.log(`RESOLVES THROUGH public.subdivision_footprint: ${count('exact') + count('phases') + count('members')}`)
  const missing = rows.filter((r) => r.shape === 'none').sort((a, b) => b.homes - a.homes)
  console.log(`\nNO RECORDED POLYGON ON ANY SHAPE — the drawn-ground class: ${missing.length} names (${missing.reduce((n, r) => n + r.homes, 0)} homes)`)
  console.log(missing.slice(0, 25).map((r) => `${r.name} (${r.homes})`).join(' · '))
  console.log('\nSLUGS: ' + missing.slice(0, 25).map((r) => slugify(r.name)).join(' '))
}
main().catch((e) => { console.error(e); process.exit(1) })
