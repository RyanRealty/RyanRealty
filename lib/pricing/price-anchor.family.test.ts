/**
 * THE ANCHOR IS WHAT THE HOME'S OWN AREA SELLS FOR (Matt 2026-10-08, "One 20%
 * line"), read at the narrowest level with enough sales.
 *
 * 3062 NW Kelly Hill (cma-3062-nw-kelly-hill: 3 bed, 2 bath, 1,702 sqft, 2004)
 * sits in the recorded plat Westside Meadows II, beside Westside Meadows, the
 * same subdivision, inside Summit West. The anchor was Summit West's median,
 * $609 a square foot over 42 sales, so the line ran $487 to $731 and every
 * Westside Meadows sale fell outside it. The listings rows (verified
 * 2026-10-08, ClosePrice / TotalLivingAreaSqFt): 2955 Bordeaux $800,000 /
 * 1,750 = $457; 2500 Summerhill $717,000 / 2,080 = $345; 2974 Chardonnay
 * $735,000 / 1,920 = $383; 3080 Kelly Hill $788,000 / 1,960 = $402; 2382
 * Summerhill $800,000 / 2,091 = $383; 3086 Kelly Hill $725,000 / 2,160 = $336;
 * 2376 Summerhill $765,000 / 2,347 = $326. The fixture below is that shape.
 */
import { describe, expect, it } from 'vitest'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'
import { anchorFromSamples, resolvePriceAnchor, type AnchorSample } from '@/lib/pricing/price-anchor'
import { insidePriceTier, priceTierLine } from '@/lib/pricing/price-tier'

const asOf = '2026-10-08'
const SUMMIT_WEST = 'bend-summit-west'

function kellyHill(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '3062 NW Kelly Hill',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Westside Meadows',
    subdivisionNorm: 'westside meadows',
    subdivisionSlug: 'westside-meadows-ii',
    platLabel: 'Westside Meadows II',
    latitude: 44.073973,
    longitude: -121.362518,
    beds: 3,
    baths: 2,
    sqft: 1702,
    lotAcres: 0.15,
    yearBuilt: 2004,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: SUMMIT_WEST,
    communityLocated: true,
    communitySlug: null,
    adjacentSubdivisionSlugs: ['westside-meadows', 'shevlin-ridge-phase-3', 'shevlin-ridge-phase-1'],
    closerSubdivisionSlugs: [],
    ...over,
  }
}

let seq = 0
function sale(key: string, closePrice: number, sqft: number, over: Partial<PricingSale> = {}): PricingSale {
  seq += 1
  return {
    listingKey: key,
    listNumber: null,
    address: `${seq} NW Comp Ln`,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Westside Meadows',
    subdivisionNorm: 'westside meadows',
    subdivisionSlug: 'westside-meadows',
    latitude: 44.0745,
    longitude: -121.3632,
    beds: 3,
    baths: 2,
    sqft,
    lotAcres: 0.15,
    yearBuilt: 2003,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-05-15',
    originalAsk: null,
    lastAsk: null,
    daysToOffer: 15,
    cdom: 30,
    dropCount: 0,
    closePpsf: closePrice / sqft,
    photoUrl: null,
    publicRemarks: null,
    marketArea: SUMMIT_WEST,
    communityLocated: true,
    communitySlug: null,
    ...over,
  }
}

/** Westside Meadows II (the home's own plat) and Westside Meadows: seven sales. */
function westsideMeadows(): PricingSale[] {
  const own = { subdivisionSlug: 'westside-meadows-ii', latitude: 44.0742, longitude: -121.36266 }
  return [
    sale('KELLY_3080', 788_000, 1960, { ...own, closeDate: '2025-01-03' }),
    sale('KELLY_3086', 725_000, 2160, { ...own, closeDate: '2025-04-17' }),
    sale('BORDEAUX_2955', 800_000, 1750, { closeDate: '2026-05-29' }),
    sale('SUMMERHILL_2500', 717_000, 2080, { closeDate: '2026-05-13' }),
    sale('CHARDONNAY_2974', 735_000, 1920, { closeDate: '2025-11-26' }),
    sale('SUMMERHILL_2382', 800_000, 2091, { closeDate: '2026-07-22' }),
    sale('SUMMERHILL_2376', 765_000, 2347, { closeDate: '2025-02-03' }),
  ]
}

const WM_KEYS = ['BORDEAUX_2955', 'SUMMERHILL_2500', 'CHARDONNAY_2974', 'SUMMERHILL_2382', 'SUMMERHILL_2376']

/** The rest of Summit West: newer, larger-lot plats that sell near $620 a square foot. */
function summitWest(): PricingSale[] {
  return Array.from({ length: 40 }, (_, i) =>
    sale(`SW${i}`, Math.round(1800 * (600 + (i % 5) * 10)), 1800, {
      subdivision: 'Shevlin Ridge',
      subdivisionNorm: 'shevlin ridge',
      subdivisionSlug: i % 2 === 0 ? 'shevlin-ridge-phase-3' : 'shevlin-ridge-phase-1',
      latitude: 44.0705 + (i % 4) * 0.001,
      longitude: -121.3665 + (i % 3) * 0.001,
      yearBuilt: 2016,
    }),
  )
}

describe('3062 NW Kelly Hill: the anchor is Westside Meadows, not Summit West', () => {
  it('reads the subdivision family and keeps every Westside Meadows sale inside the line', () => {
    const pool = [...westsideMeadows(), ...summitWest()]
    const anchor = resolvePriceAnchor(kellyHill(), pool)
    // The home's own subdivision (Matt 2026-10-08, "Yes, everywhere"):
    // Westside Meadows II and Westside Meadows, a plat of its family inside
    // its own Summit West polygon, hold seven: median $383 (326, 336, 345,
    // 383, 383, 402, 457). Before the ruling the plat level held only the two
    // Westside Meadows II sales and the same seven answered one level later as
    // the family. The level is named by the family, the place it read.
    expect(anchor).toMatchObject({ source: 'plat', n: 7, where: 'Westside Meadows' })
    expect(Math.round(anchor!.ppsf)).toBe(383)
    const line = priceTierLine(anchor!.ppsf)!
    expect(line).toEqual({ anchor: 383, floor: 306, ceiling: 460 })
    for (const s of westsideMeadows()) expect(insidePriceTier(s.closePpsf, line), s.listingKey).toBe(true)
    // And the Summit West tract sales are a different market from this home.
    for (const s of summitWest()) expect(insidePriceTier(s.closePpsf, line), s.listingKey).toBe(false)
  })

  it('the neighborhood median it replaced put the home own subdivision outside its own line', () => {
    // The pre-2026-10-08 read: neighborhood first. Same pool, same quantity.
    const pool = [...westsideMeadows(), ...summitWest()]
    const neighborhoodOnly: AnchorSample[] = pool.map((s) => ({
      ppsf: s.closePpsf,
      inPlat: false,
      inFamily: false,
      sameSubdivisionName: false,
      inCommunity: false,
      inNeighborhood: s.marketArea === SUMMIT_WEST,
      miles: null,
      inCity: true,
    }))
    const old = anchorFromSamples(neighborhoodOnly)!
    expect(old.source).toBe('neighborhood')
    const oldLine = priceTierLine(old.ppsf)!
    expect(oldLine.anchor).toBeGreaterThan(600)
    for (const key of WM_KEYS) {
      const s = pool.find((p) => p.listingKey === key)!
      expect(insidePriceTier(s.closePpsf, oldLine), key).toBe(false)
    }
  })

  it('the walk seats Westside Meadows sales the old line skipped, and says where the anchor came from', () => {
    const out = walkPricingLadder(kellyHill(), [...westsideMeadows(), ...summitWest()], { asOf, anchorWindowMonths: 24 })
    expect(out.priceAnchor?.source).toBe('plat')
    const seated = out.comps.map((c) => c.listingKey)
    // Five price-setting sales from the home's own subdivision: the two in its
    // own plat and the touching Westside Meadows sales inside the line.
    expect(seated.length).toBeGreaterThanOrEqual(5)
    expect(seated.filter((k) => WM_KEYS.includes(k)).length).toBeGreaterThanOrEqual(3)
    expect(seated.some((k) => k.startsWith('SW'))).toBe(false)
    expect(
      out.trace.some((t) =>
        t.startsWith(
          'Price tier: homes of this size sell for about $383 a square foot in Westside Meadows (median of 7 sales that closed in the last 24 months).',
        ),
      ),
    ).toBe(true)
  })

  it('falls to the MLS subdivision name when the home sits in no recorded plat', () => {
    const unplatted = kellyHill({ subdivisionSlug: null, platLabel: null, adjacentSubdivisionSlugs: [] })
    const anchor = resolvePriceAnchor(unplatted, [...westsideMeadows(), ...summitWest()])
    expect(anchor).toMatchObject({ source: 'subdivision', n: 7, where: 'Westside Meadows' })
  })
})

describe('a home in a uniformly priced neighborhood keeps the same line', () => {
  it('reads its own plat, and the line is the one the neighborhood would have drawn', () => {
    // Every sale in the neighborhood trades at $398 to $402, the home's plat included.
    const plat = Array.from({ length: 6 }, (_, i) =>
      sale(`P${i}`, 2000 * (398 + (i % 5)), 2000, {
        subdivision: 'Even Acres',
        subdivisionNorm: 'even acres',
        subdivisionSlug: 'even-acres',
      }),
    )
    const rest = Array.from({ length: 30 }, (_, i) =>
      sale(`R${i}`, 2000 * (398 + (i % 5)), 2000, {
        subdivision: 'Other Tract',
        subdivisionNorm: 'other tract',
        subdivisionSlug: `other-tract-${i % 3}`,
      }),
    )
    const home = kellyHill({
      subdivision: 'Even Acres',
      subdivisionNorm: 'even acres',
      subdivisionSlug: 'even-acres',
      platLabel: 'Even Acres',
      sqft: 2000,
    })
    const now = resolvePriceAnchor(home, [...plat, ...rest])!
    expect(now.source).toBe('plat')
    const before = anchorFromSamples(
      [...plat, ...rest].map((s) => ({
        ppsf: s.closePpsf,
        inPlat: false,
        inFamily: false,
        sameSubdivisionName: false,
        inCommunity: false,
        inNeighborhood: true,
        miles: null,
        inCity: true,
      })),
    )!
    expect(before.source).toBe('neighborhood')
    expect(priceTierLine(now.ppsf)).toEqual(priceTierLine(before.ppsf))
    // Same line, same admissions: a $250 sale is out under either, a $400 one in.
    const line = priceTierLine(now.ppsf)!
    expect(insidePriceTier(250, line)).toBe(false)
    expect(insidePriceTier(400, line)).toBe(true)
  })
})
