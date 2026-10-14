import { describe, expect, it } from 'vitest'
import {
  ANCHOR_MIN_N,
  anchorFromSamples,
  anchorPlaceNames,
  anchorPlacePhrase,
  anchorSampler,
  resolvePriceAnchor,
  sameSubdivisionFamily,
  subdivisionFamilyKey,
  type AnchorSample,
} from '@/lib/pricing/price-anchor'

const subject = {
  listingKey: 'SUBJ',
  streetAddress: '23 Benaiah',
  city: 'Bend',
  citySlug: 'bend',
  subdivision: 'N/A',
  subdivisionNorm: null,
  latitude: 44.02,
  longitude: -121.3,
  beds: 5,
  baths: 4,
  sqft: 2080,
  lotAcres: 0.14,
  yearBuilt: 2005,
  storyClass: 'two' as const,
  productClass: 'detached',
  waterClass: null,
  sewerClass: null,
  hoaClass: null,
  lotClass: null,
  ruralAcreage: false,
  marketArea: 'larkspur',
  newConstruction: null,
} as never

function sale(over: Record<string, unknown>) {
  return {
    listingKey: String(over.listingKey ?? Math.random()),
    address: '1 Test',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: null,
    subdivisionNorm: null,
    latitude: 44.02,
    longitude: -121.3,
    sqft: 2000,
    closePrice: 600_000,
    closePpsf: 300,
    closeDate: '2026-05-01',
    lotAcres: 0.15,
    ...over,
  } as never
}

describe('the subject always has a price tier (Matt 2026-09-10)', () => {
  it('reads the neighborhood around a home whose plat says N/A', () => {
    const pool = [
      ...Array.from({ length: 6 }, (_, i) => sale({ listingKey: `L${i}`, marketArea: 'larkspur', closePpsf: 300 + i })),
      // Downtown sales, a different tier, must not move the anchor.
      ...Array.from({ length: 6 }, (_, i) => sale({ listingKey: `D${i}`, marketArea: 'downtown', closePpsf: 560 })),
    ]
    const anchor = resolvePriceAnchor(subject, pool)
    expect(anchor?.source).toBe('neighborhood')
    expect(anchor!.ppsf).toBeGreaterThan(295)
    expect(anchor!.ppsf).toBeLessThan(310)
  })

  it('falls to the mile around the home when no polygon holds it', () => {
    const unmapped = { ...(subject as object), marketArea: null } as never
    const pool = [
      ...Array.from({ length: 5 }, (_, i) => sale({ listingKey: `N${i}`, latitude: 44.021, longitude: -121.301, closePpsf: 280 })),
      // Ten miles away: outside the radius, so it cannot set the tier.
      ...Array.from({ length: 5 }, (_, i) => sale({ listingKey: `F${i}`, latitude: 44.18, longitude: -121.3, closePpsf: 700 })),
    ]
    const anchor = resolvePriceAnchor(unmapped, pool)
    expect(anchor?.source).toBe('within-a-mile')
    expect(anchor!.ppsf).toBe(280)
  })

  it('says nothing rather than inventing a tier from a thin sample', () => {
    const pool = Array.from({ length: ANCHOR_MIN_N - 1 }, (_, i) =>
      sale({ listingKey: `T${i}`, marketArea: 'larkspur', latitude: 44.9, longitude: -121.9 }),
    )
    expect(resolvePriceAnchor(subject, pool)).toBeNull()
  })

  it('never anchors to what the home asked, which is the price that failed', () => {
    const src = require('node:fs').readFileSync('lib/pricing/price-anchor.ts', 'utf8')
    expect(src).not.toMatch(/lastAsk|originalAsk/)
  })
})

/**
 * THE NARROWEST LEVEL THAT HOLDS A FAIR MEDIAN (Matt 2026-10-08, "One 20%
 * line"): plat, then subdivision family, then MLS subdivision name, then
 * community, then neighborhood, then the rings, then the city. Each level is
 * taken only with ANCHOR_MIN_N sales; under that it falls through.
 */
describe('the anchor reads the narrowest level with enough sales', () => {
  function sample(ppsf: number, over: Partial<AnchorSample> = {}): AnchorSample {
    return {
      ppsf,
      inPlat: false,
      inFamily: false,
      sameSubdivisionName: false,
      inCommunity: false,
      inNeighborhood: false,
      miles: null,
      inCity: true,
      ...over,
    }
  }
  const many = (count: number, ppsf: number, over: Partial<AnchorSample>) =>
    Array.from({ length: count }, () => sample(ppsf, over))
  const names = {
    plat: 'Westside Meadows II',
    family: 'Westside Meadows',
    subdivision: 'Westside Meadows',
    community: 'Broken Top',
    neighborhood: 'Summit West',
    city: 'Bend',
  }
  // Every level holds its own price, so the anchor says which level answered.
  const levels = (n: { plat: number; family: number; name: number; community: number; area: number; mile: number; ring: number }) => [
    ...many(n.plat, 100, { inPlat: true, inFamily: true }),
    ...many(n.family, 200, { inFamily: true }),
    ...many(n.name, 300, { sameSubdivisionName: true }),
    ...many(n.community, 400, { inCommunity: true }),
    ...many(n.area, 500, { inNeighborhood: true }),
    ...many(n.mile, 600, { miles: 0.5 }),
    ...many(n.ring, 700, { miles: 4 }),
    ...many(20, 800, {}),
  ]

  it('takes the plat when it holds five sales', () => {
    const a = anchorFromSamples(levels({ plat: 5, family: 5, name: 5, community: 5, area: 5, mile: 5, ring: 5 }), names)
    expect(a).toMatchObject({ source: 'plat', ppsf: 100, n: 5, where: 'Westside Meadows II' })
  })

  it('falls to the family at four plat sales, and the family counts the plat too', () => {
    const a = anchorFromSamples(levels({ plat: 4, family: 1, name: 5, community: 5, area: 5, mile: 5, ring: 5 }), names)
    expect(a).toMatchObject({ source: 'family', n: 5, where: 'Westside Meadows' })
    expect(a!.ppsf).toBe(100)
  })

  it('falls to the MLS subdivision name, then the community, then the neighborhood', () => {
    expect(
      anchorFromSamples(levels({ plat: 2, family: 2, name: 5, community: 5, area: 5, mile: 5, ring: 5 }), names),
    ).toMatchObject({ source: 'subdivision', ppsf: 300, where: 'Westside Meadows' })
    expect(
      anchorFromSamples(levels({ plat: 2, family: 2, name: 4, community: 5, area: 5, mile: 5, ring: 5 }), names),
    ).toMatchObject({ source: 'community', ppsf: 400, where: 'Broken Top' })
    expect(
      anchorFromSamples(levels({ plat: 2, family: 2, name: 4, community: 4, area: 5, mile: 5, ring: 5 }), names),
    ).toMatchObject({ source: 'neighborhood', ppsf: 500, where: 'Summit West' })
  })

  it('then the mile, then the rural rings, then the city', () => {
    expect(
      anchorFromSamples(levels({ plat: 0, family: 0, name: 0, community: 0, area: 4, mile: 5, ring: 5 }), names),
    ).toMatchObject({ source: 'within-a-mile', ppsf: 600, radiusMiles: 1 })
    expect(
      anchorFromSamples(levels({ plat: 0, family: 0, name: 0, community: 0, area: 0, mile: 2, ring: 5 }), names),
    ).toMatchObject({ source: 'rural-radius', radiusMiles: 5 })
    const city = anchorFromSamples(levels({ plat: 0, family: 0, name: 0, community: 0, area: 0, mile: 0, ring: 0 }), names)
    expect(city).toMatchObject({ source: 'city', ppsf: 800, n: 20, where: 'Bend' })
  })

  it('returns no anchor when no level holds five sales', () => {
    const thin = [sample(300, { inPlat: true, inFamily: true, inNeighborhood: true, miles: 0.1 })]
    expect(anchorFromSamples([...thin, ...thin, ...thin, ...thin].map((s) => ({ ...s })), names)).toBeNull()
    expect(ANCHOR_MIN_N).toBe(5)
  })

  it('names the place it read, and a ring by its reach', () => {
    expect(anchorPlacePhrase({ source: 'family', where: 'Westside Meadows' })).toBe('in Westside Meadows')
    expect(anchorPlacePhrase({ source: 'within-a-mile', radiusMiles: 1, where: null })).toBe('within 1 mile')
    expect(anchorPlacePhrase({ source: 'rural-radius', radiusMiles: 3, where: null })).toBe('within 3 miles')
    // A level with no publishable name still says what kind of place it was.
    expect(anchorPlacePhrase({ source: 'neighborhood', where: null })).toBe("in your home's neighborhood")
    for (const source of ['plat', 'family', 'subdivision', 'community', 'neighborhood', 'city'] as const) {
      expect(anchorPlacePhrase({ source, where: null })).not.toMatch(/—/)
    }
  })

  it('reads the family name off the county label of the home plat', () => {
    const n = anchorPlaceNames({
      platSlug: 'westside-meadows-ii',
      platLabel: 'Westside Meadows II',
      subdivision: 'Westside Meadows',
      marketArea: 'bend-summit-west',
      city: 'Bend',
    })
    expect(n).toMatchObject({
      plat: 'Westside Meadows II',
      family: 'Westside Meadows',
      subdivision: 'Westside Meadows',
      neighborhood: 'Summit West',
      city: 'Bend',
    })
  })
})

describe('a subdivision family is its phases and numbered plats, read from the recorded plat', () => {
  it('groups Westside Meadows and Westside Meadows II', () => {
    expect(subdivisionFamilyKey('westside-meadows-ii')).toBe('westside meadows')
    expect(sameSubdivisionFamily('westside-meadows-ii', 'westside-meadows')).toBe(true)
  })

  it('groups the phases the walk already treats as one plat', () => {
    expect(sameSubdivisionFamily('hampton-park-subdivision-phase-ii', 'hampton-park-subdivision-phase-i')).toBe(true)
    expect(sameSubdivisionFamily('awbrey-butte-homesites-phase-thirty-two', 'awbrey-butte-homesites-phase-i')).toBe(true)
  })

  it('does not group a touching plat of another name', () => {
    expect(sameSubdivisionFamily('westside-meadows-ii', 'shevlin-ridge-phase-1')).toBe(false)
    expect(sameSubdivisionFamily('westside-meadows', null)).toBe(false)
  })

  it('never makes a family out of a city name', () => {
    // "Redmond Second Addition" strips to "Redmond": that is the whole city,
    // not a subdivision family, so it falls through to the next level.
    expect(subdivisionFamilyKey('redmond-second-addition')).toBeNull()
    expect(sameSubdivisionFamily('redmond-second-addition', 'redmond-third-addition')).toBe(false)
  })
})

describe('the narrow levels hold to the home own ground', () => {
  const home = {
    platSlug: 'westside-meadows-ii',
    subdivisionNorm: 'westside meadows',
    citySlug: 'bend',
    communitySlug: null,
    marketArea: null,
    latitude: 44.074,
    longitude: -121.3625,
    ruralAcreage: false,
  }
  const salePlace = (over: Record<string, unknown> = {}) => ({
    ppsf: 380,
    platSlug: 'westside-meadows',
    subdivisionNorm: 'westside meadows',
    citySlug: 'bend',
    communitySlug: null,
    marketArea: null,
    latitude: 44.0745,
    longitude: -121.3632,
    ...over,
  })

  it('a namesake in another town is not the family and not the MLS subdivision', () => {
    const sample = anchorSampler(home)
    expect(sample(salePlace())).toMatchObject({ inFamily: true, sameSubdivisionName: true, inCity: true })
    expect(sample(salePlace({ citySlug: 'redmond' }))).toMatchObject({ inFamily: false, sameSubdivisionName: false, inCity: false })
    // A sale with no city does not join the family or the MLS-name level
    // ('unknown' is citySlug's blank). Inside the home's own neighborhood
    // polygon a family plat is the home's own subdivision whatever its city
    // field says (Matt 2026-10-08, "Yes, everywhere"): the polygon is the
    // place. The same plat outside that polygon joins nothing.
    expect(sample(salePlace({ citySlug: 'unknown' }))).toMatchObject({ inPlat: true, sameSubdivisionName: false })
    expect(
      sample(salePlace({ citySlug: 'unknown', latitude: 44.02324, longitude: -121.32792 })),
    ).toMatchObject({ inPlat: false, inFamily: false, sameSubdivisionName: false })
    // The home's own plat needs no city: the polygon is the place.
    expect(sample(salePlace({ platSlug: 'westside-meadows-ii', citySlug: null })).inPlat).toBe(true)
  })

  it('rural acreage reads no city level: no anchor rather than a city of tract homes', () => {
    const rural = anchorSampler({ ...home, platSlug: null, subdivisionNorm: null, ruralAcreage: true })
    // Thirty in-town sales twenty miles off: outside every ring, inside the city.
    const town = Array.from({ length: 30 }, () =>
      rural(salePlace({ platSlug: null, subdivisionNorm: null, latitude: 44.37, longitude: -121.36 })),
    )
    expect(town.every((s) => !s.inCity)).toBe(true)
    expect(anchorFromSamples(town)).toBeNull()
    const inTown = anchorSampler({ ...home, platSlug: null, subdivisionNorm: null })
    expect(
      anchorFromSamples(
        Array.from({ length: 30 }, () =>
          inTown(salePlace({ platSlug: null, subdivisionNorm: null, latitude: 44.37, longitude: -121.36 })),
        ),
      )?.source,
    ).toBe('city')
  })

  it('never names a family for a city', () => {
    // "La Pine Phase 1" and "La Pine Phase 2" are phases of a plat named for the
    // town; printing "in La Pine" would read as the whole city.
    expect(sameSubdivisionFamily('la-pine-phase-1', 'la-pine-phase-2')).toBe(false)
    expect(anchorPlaceNames({ platSlug: 'la-pine-phase-1', platLabel: 'La Pine Phase 1', city: 'La Pine' }).family).toBeNull()
    expect(anchorPlacePhrase({ source: 'family', where: null })).toBe("in your home's plat and its phases")
  })
})
