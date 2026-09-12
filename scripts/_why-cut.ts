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

// Walk the facts ladder for one CMA subject and say what happened to ONE named
// sale. Answers "how did the house next door get cut".
async function main() {
  const slug = process.argv[2]!
  const needle = (process.argv[3] ?? '').toLowerCase()
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const { resolveCmaSubject } = await import('@/lib/cma/subject')
  const row = (await getCmaAdminRowBySlug(slug)) as Record<string, unknown> | null
  if (!row) throw new Error('no doc')
  const resolved = await resolveCmaSubject({
    mlsNumber: (row.subject_listing_key as string | null) ?? null,
    rawAddress: (row.subject_address as string | null) ?? null,
    city: (row.subject_city as string | null) ?? null,
  })
  const subject = resolved.subject
  if (!subject) throw new Error('no subject')
  const { selectPricingFactsPool, selectPricingFactsNear, getPricingSubdivisionCells } = await import('@/lib/data')
  const { cmaSubjectToPricing } = await import('@/lib/pricing/select')
  const { walkPricingLadder } = await import('@/lib/pricing/match')
  const { LOCAL_POOL_RADIUS_MILES } = await import('@/lib/pricing/ladder')
  const { resolveMarketArea } = await import('@/lib/cma/market-area')
  const { resolvePriceAnchor } = await import('@/lib/pricing/price-anchor')
  const ps = cmaSubjectToPricing(subject, {})
  const asOf = new Date().toISOString().slice(0, 10)
  const after = new Date(asOf)
  after.setMonth(after.getMonth() - 18)
  const [pool, near] = await Promise.all([
    selectPricingFactsPool({
      citySlug: ps.citySlug,
      closeBefore: asOf,
      closeAfter: after.toISOString().slice(0, 10),
      sqftMin: Math.round(ps.sqft * 0.6),
      sqftMax: Math.round(ps.sqft * 1.4),
      productClass: ps.productClass,
      limit: 800,
    }),
    ps.latitude != null && ps.longitude != null
      ? selectPricingFactsNear({
          latitude: ps.latitude,
          longitude: ps.longitude,
          radiusMiles: LOCAL_POOL_RADIUS_MILES,
          closeBefore: asOf,
          closeAfter: after.toISOString().slice(0, 10),
          sqftMin: Math.round(ps.sqft * 0.6),
          sqftMax: Math.round(ps.sqft * 1.4),
          productClass: ps.productClass,
        })
      : Promise.resolve([]),
  ])
  const merged = new Map(pool.map((s) => [s.listingKey, s]))
  for (const s of near) if (!merged.has(s.listingKey)) merged.set(s.listingKey, s)
  const cells = await getPricingSubdivisionCells(ps.citySlug)
  const sales = [...merged.values()].map((s) => ({ ...s, marketArea: s.marketArea ?? resolveMarketArea(s.latitude, s.longitude) }))
  console.log(`subject ${subject.streetAddress} | ${ps.sqft}sf | ${ps.beds}bd/${ps.baths}ba | city ${ps.citySlug} | area ${ps.marketArea ?? 'none'} | sub ${ps.subdivisionNorm ?? 'none'}`)
  console.log(`citywide ${pool.length} (oldest ${pool[pool.length - 1]?.closeDate}) | local ${LOCAL_POOL_RADIUS_MILES}mi ${near.length} (oldest ${near[near.length - 1]?.closeDate}) | merged ${sales.length}`)
  const { getSubdivisionRing, assignSubdivisionSlugs } = await import('@/lib/data/geo/subdivision-ring')
  console.log(`subject coords: ${subject.latitude} , ${subject.longitude}`)
  const ring = await getSubdivisionRing(subject.latitude, subject.longitude)
  if (ring) {
    ps.subdivisionSlug = ring.homeSlug
    ps.adjacentSubdivisionSlugs = ring.ring.filter((r) => r.inNeighborhood !== false).map((r) => r.slug)
    const slugs = await assignSubdivisionSlugs(sales.map((s) => ({ lat: s.latitude, lng: s.longitude })))
    sales.forEach((s, i) => { s.subdivisionSlug = slugs[i] })
  }
  console.log(`subject plat slug: ${ps.subdivisionSlug ?? 'NONE'} | ring ${ps.adjacentSubdivisionSlugs?.length ?? 0}`)
  const withSlug = sales.filter((s) => s.subdivisionSlug).length
  const inPlat = sales.filter((s) => s.subdivisionSlug && s.subdivisionSlug === ps.subdivisionSlug).length
  console.log(`sales with a plat slug: ${withSlug}/${sales.length} | in the subject's plat: ${inPlat}`)
  const anchor = resolvePriceAnchor(ps, sales)
  console.log(`anchor ${anchor ? `$${Math.round(anchor.ppsf)}/sf over n=${anchor.n} (${anchor.source})` : 'none'}`)

  for (const sale of sales.filter((s) => s.address.toLowerCase().includes(needle))) {
    console.log(`\n${sale.address} | ${sale.sqft}sf | ${sale.beds}bd/${sale.baths}ba | $${sale.closePrice.toLocaleString()} | ${sale.closeDate} | $${Math.round(sale.closePpsf)}/sf | sub ${sale.subdivisionNorm ?? 'none'} | area ${sale.marketArea ?? 'none'}`)
    // The real ladder against a pool of this ONE sale: nothing else can fill
    // the target first, so a miss here is a refusal, not a race.
    const solo = walkPricingLadder(ps, [sale], { asOf, cells })
    if (solo.comps.length > 0) {
      const c = solo.comps[0]!
      console.log(`  SELECTED at ${c.selectionTier}${c.roomDifference?.length ? ` (noted ${c.roomDifference.join('+')})` : ''}`)
    } else {
      console.log('  REFUSED by every rung that ran')
    }
  }
  if (!sales.some((s) => s.address.toLowerCase().includes(needle))) console.log(`\nNOT IN POOL: nothing matching "${needle}"`)

  const full = walkPricingLadder(ps, sales, { asOf, cells })
  console.log(`\nfull ladder: ${full.comps.length} comps, tiers ${full.tiersUsed.join(', ')}`)
  for (const c of full.comps) {
    console.log(`  ${c.address.padEnd(26)} $${String(c.closePrice).padStart(8)} | ${c.sqft}sf | ${c.beds}bd/${c.baths}ba | ${c.selectionTier}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
