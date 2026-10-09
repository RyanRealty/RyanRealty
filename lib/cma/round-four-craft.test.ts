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
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

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
          pins: [
            { key: null, family: 'subject', lat: 44.0505, lng: -121.0505 },
            { key: '1', family: 'closed', lat: 44.05, lng: -121.05 },
          ],
          boundaryShown,
        } as never,
      })?.body ?? ''
    return /<p class="small">(Every pin above[^<]*)<\/p>/.exec(body)?.[1] ?? ''
  }

  // The caption sits under the map and counts the tables that hold a drawn
  // pin: one closed sale here, so one table (2382 Jackson printed "one of the
  // three tables" over two, reader review 2026-10-08).
  it('drops the boundary sentence when the outline was suppressed', () => {
    expect(legendOf(false)).toBe('Every pin above is a row in the table that follows.')
  })

  it('names the outline plainly when it was drawn', () => {
    expect(legendOf(true)).toBe(
      'Every pin above is a row in the table that follows. The lines are the subdivisions these homes sit in.',
    )
  })

  it('does not claim an outline when the tile predates the check', () => {
    expect(legendOf(undefined)).toBe('Every pin above is a row in the table that follows.')
    expect(legendOf(undefined)).not.toContain('when that boundary is on file')
  })

  it('does not promise pins over a tile that carries none (stored html_content, 2026-10-07)', () => {
    const body =
      mapPage({
        subject,
        facts: [
          { key: '1', family: 'closed', address: comps[0]!.address, outcome: 'sold $400K', domDays: 20, priceChanges: 0 },
        ],
        mapDataUri: 'data:image/png;base64,AAAA',
        mapOverlay: null,
      })?.body ?? ''
    expect(body).not.toContain('Every pin')
    expect(body).toContain('The table that follows lists every home this map was drawn for.')
  })
})
