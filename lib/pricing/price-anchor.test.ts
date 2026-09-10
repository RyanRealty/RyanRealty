import { describe, expect, it } from 'vitest'
import { ANCHOR_MIN_N, resolvePriceAnchor } from '@/lib/pricing/price-anchor'

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
