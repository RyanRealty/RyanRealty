/**
 * ROUND-FOUR CLASS F — craft (docs/plans/CMA_REIMAGINED_2026-09-07.md,
 * "Round four audit", F).
 *
 *   F1  "The value strip plots sale-price dots inside a band labelled with
 *       list prices, so the lowest sale renders outside the shading captioned
 *       'what your home is worth'." — the drawing has to state its scale, and
 *       every mark on it has to be on that scale.
 *   F2  "its polygon on 19968 contains neither the subject nor any sale." —
 *       an outline that holds nothing on the map is suppressed, and the
 *       caption stops naming it.
 */
import { describe, expect, it } from 'vitest'
import {
  mapPointsFor,
  pointInAnyRing,
  pointInRing,
  polygonHoldsAnyPoint,
  type Ring,
} from '@/lib/cma/render-place-polygon'
import { mapPage, pricingPage } from '@/lib/cma/render-pricing-page'
import { worthStripHtml, worthStripSvg, WORTH_STRIP_WIDE } from '@/lib/cma/worth-strip'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

// ── F1. One scale ───────────────────────────────────────────────────────────

describe('F1 — the strip plots every mark on one scale, and says which', () => {
  const sales = [
    { n: 1, address: '100 Swalley', adjustedPrice: 412_000 },
    { n: 2, address: '200 Swalley', adjustedPrice: 426_000 },
    { n: 3, address: '300 Swalley', adjustedPrice: 428_000 },
    { n: 4, address: '400 Swalley', adjustedPrice: 435_000 },
    { n: 5, address: '500 Swalley', adjustedPrice: 443_000 },
  ]
  const input = {
    sales,
    rangeLow: 412_000,
    rangeHigh: 443_000,
    recommended: 435_000,
    lastAsk: 460_000,
    keptCount: 5,
  }

  it('names the scale on the drawing', () => {
    const svg = worthStripSvg(input, WORTH_STRIP_WIDE)
    expect(svg).toContain('One scale: sale price today. 5 sales.')
    expect(svg).toContain('The shading is what your home is worth')
  })

  it('places the shading, every dot and the list line with the same projection', () => {
    const svg = worthStripSvg(input, WORTH_STRIP_WIDE)
    const zone = /<rect x="([\d.]+)"[^>]*width="([\d.]+)"[^>]*fill="rgba\(16,39,66,0\.16\)"/.exec(svg)
    expect(zone).not.toBeNull()
    const zoneLeft = Number(zone![1])
    const zoneRight = zoneLeft + Number(zone![2])
    const dots = [...svg.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(dots).toHaveLength(5)
    // The shading is the worth range and the sales run from its low to its
    // high, so every dot lands within the shaded span — the F1 defect was
    // exactly a dot outside it, because the two were drawn on different
    // scales. Half a unit of slack for the toFixed(1) both sides round with.
    for (const cx of dots) {
      expect(cx).toBeGreaterThanOrEqual(zoneLeft - 0.5)
      expect(cx).toBeLessThanOrEqual(zoneRight + 0.5)
    }
    // The list line is a labelled tick on that same scale: $435,000 sits
    // inside $412,000-$443,000, so its x is inside the shading too.
    const listLine = /<line x1="([\d.]+)"[^>]*stroke="#102742" stroke-width="2"\/>/.exec(svg)
    expect(listLine).not.toBeNull()
    expect(Number(listLine![1])).toBeGreaterThan(zoneLeft)
    expect(Number(listLine![1])).toBeLessThan(zoneRight)
    expect(svg).toContain('list $435K')
  })

  it('says what a dot is, once, under the drawing', () => {
    const html = worthStripHtml(input)
    expect(html).toContain('Each dot is one sale, moved to what it would sell for today.')
    expect(html).toContain('The line is where we would list it.')
  })
})

// ── F2. An outline that holds nothing is not drawn ──────────────────────────

describe('F2 — a place polygon is suppressed when it holds neither the subject nor a sale', () => {
  /** A unit square around (44.0, -121.0). */
  const square: Ring = [
    { lat: 44.0, lng: -121.1 },
    { lat: 44.1, lng: -121.1 },
    { lat: 44.1, lng: -121.0 },
    { lat: 44.0, lng: -121.0 },
    { lat: 44.0, lng: -121.1 },
  ]

  it('finds a point inside, outside, and on the edge', () => {
    expect(pointInRing({ lat: 44.05, lng: -121.05 }, square)).toBe(true)
    expect(pointInRing({ lat: 44.05, lng: -120.5 }, square)).toBe(false)
    expect(pointInRing({ lat: 43.9, lng: -121.05 }, square)).toBe(false)
    // On the boundary counts as inside: a rooftop on its own plat line is in
    // that subdivision by every reading a seller has.
    expect(pointInRing({ lat: 44.0, lng: -121.05 }, square)).toBe(true)
    expect(pointInRing({ lat: 44.1, lng: -121.1 }, square)).toBe(true)
  })

  it('refuses a degenerate ring and a non-finite point', () => {
    expect(pointInRing({ lat: 44.05, lng: -121.05 }, [{ lat: 44, lng: -121 }])).toBe(false)
    expect(pointInRing({ lat: Number.NaN, lng: -121.05 }, square)).toBe(false)
  })

  it('handles a multipolygon as any-ring', () => {
    const far: Ring = [
      { lat: 45.0, lng: -122.1 },
      { lat: 45.1, lng: -122.1 },
      { lat: 45.1, lng: -122.0 },
      { lat: 45.0, lng: -122.0 },
      { lat: 45.0, lng: -122.1 },
    ]
    expect(pointInAnyRing({ lat: 45.05, lng: -122.05 }, [square, far])).toBe(true)
    expect(pointInAnyRing({ lat: 40.0, lng: -100.0 }, [square, far])).toBe(false)
  })

  it('holds the polygon when the subject is in it, or when only a sale is', () => {
    const inside = { lat: 44.05, lng: -121.05 }
    const outside = { lat: 44.9, lng: -120.2 }
    expect(polygonHoldsAnyPoint([square], [inside])).toBe(true)
    expect(polygonHoldsAnyPoint([square], [outside, inside])).toBe(true)
    expect(polygonHoldsAnyPoint([square], [outside, outside])).toBe(false)
    expect(polygonHoldsAnyPoint([square], [null, undefined])).toBe(false)
    // The 19968 case: a plat that resolved by name and holds nothing drawn.
    expect(polygonHoldsAnyPoint([], [inside])).toBe(false)
  })

  it('collects the subject and every sale that carries coordinates', () => {
    const points = mapPointsFor({ latitude: 44.05, longitude: -121.05 }, [
      { latitude: 44.06, longitude: -121.04 },
      { latitude: null, longitude: null },
      { latitude: 44.07, longitude: undefined },
    ])
    expect(points).toEqual([
      { lat: 44.05, lng: -121.05 },
      { lat: 44.06, lng: -121.04 },
    ])
  })

  // ── the caption follows the drawing ───────────────────────────────────────

  const subject = {
    listingKey: 'S1',
    streetAddress: '19968 Terrace',
    city: 'Bend',
    subdivision: 'Romaine Village',
    sqft: 1440,
    lotAcres: 0.17,
    propertySubType: 'Single Family Residence',
    yearBuilt: 1978,
    photoUrl: null,
    standardStatus: 'Closed',
    lastListPrice: null,
    lastListDate: null,
    latitude: 44.05,
    longitude: -121.05,
  } as unknown as CmaSubject

  const comps: CmaAdjustedComp[] = [1, 2, 3].map(
    (i) =>
      ({
        listingKey: `C${i}`,
        address: `${i}00 Terrace`,
        city: 'Bend',
        subdivision: 'Romaine Village',
        sqft: 1440,
        propertySubType: 'Single Family Residence',
        yearBuilt: 1978,
        photoUrl: null,
        listPrice: 400_000 + i * 1000,
        closePrice: 400_000 + i * 1000,
        closeDate: '2026-06-24',
        adjustedPrice: 400_000 + i * 1000,
        timeAdjustment: 0,
        sizeAdjustment: 0,
        weight: 1,
      }) as unknown as CmaAdjustedComp,
  )

  const pricing = {
    conservative: 383_000,
    recommended: 401_000,
    highEnd: 420_000,
    valueLow: 400_000,
    valueHigh: 403_000,
    confidence: 'Moderate',
    confidenceReason: '',
    needsReview: false,
    reviewReason: null,
  } as unknown as CmaPricing

  // Delta 3 gave the map its own chapter, so the caption lives there.
  function legendOf(boundaryShown: boolean | undefined): string {
    const body =
      mapPage({
        subject,
        facts: [
          {
            key: '1',
            family: 'closed',
            address: comps[0]!.address,
            outcome: 'sold $400K',
            domDays: 20,
            priceChanges: 0,
          },
        ],
        mapDataUri: 'data:image/png;base64,AAAA',
        mapOverlay: {
          view: { centerLat: 44.05, centerLng: -121.05, zoom: 14, width: 640, height: 400 },
          pins: [],
          boundaryShown,
        } as never,
      })?.body ?? ''
    return /<p class="small">(Every pin below[^<]*)<\/p>/.exec(body)?.[1] ?? ''
  }

  it('drops the boundary sentence when the outline was suppressed', () => {
    expect(legendOf(false)).toBe('Every pin below is a row in one of the three tables that follow.')
  })

  it('names the outline plainly when it was drawn', () => {
    expect(legendOf(true)).toBe(
      'Every pin below is a row in one of the three tables that follow. The outline is Romaine Village.',
    )
  })

  it('keeps the hedge only when the tile predates the check', () => {
    expect(legendOf(undefined)).toContain('when that boundary is on file')
  })
})
