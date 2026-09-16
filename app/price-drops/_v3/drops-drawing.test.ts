import { describe, expect, it } from 'vitest'
import type { PriceDrop } from '@/lib/data'
import { priceDropDistribution, priceDropPoints } from './drops-drawing'

function drop(over: Partial<PriceDrop>): PriceDrop {
  return {
    listingKey: 'k1',
    listNumber: null,
    streetNumber: '123',
    streetName: 'Aspen',
    streetSuffix: 'Ct',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: null,
    subdivisionName: null,
    subdivisionSlug: null,
    addressSlug: null,
    lat: null,
    lng: null,
    photoUrl: null,
    beds: null,
    baths: null,
    sqft: null,
    listPrice: 500000,
    originalListPrice: 550000,
    lastDropAmount: 50000,
    lastDropPct: 9.1,
    ...over,
  } as PriceDrop
}

describe('priceDropPoints', () => {
  it('places one mark per cut at its percent, smallest first', () => {
    const points = priceDropPoints([
      drop({ listingKey: 'a', lastDropPct: 9.1 }),
      drop({ listingKey: 'b', lastDropPct: 2.4 }),
    ])
    expect(points.map((p) => p.id)).toEqual(['b', 'a'])
    expect(points[0]!.at).toBe(2.4)
  })

  it('plots no mark for a row with no percent — unknown is not zero', () => {
    expect(priceDropPoints([drop({ lastDropPct: null })])).toEqual([])
    expect(priceDropPoints([drop({ lastDropPct: 0 })])).toEqual([])
  })

  it('names the street and the city in the reading, with the dollar cut', () => {
    const [point] = priceDropPoints([drop({})])
    expect(point!.label).toContain('Bend')
    expect(point!.label).toContain('9.1% off')
    expect(point!.label).toContain('$50K cut')
  })

  it('drops a row with no street rather than naming a listing key', () => {
    expect(priceDropPoints([drop({ streetNumber: null, streetName: null })])).toEqual([])
  })
})

describe('priceDropDistribution', () => {
  const drops = [3, 5, 7, 9, 11, 13].map((pct, i) =>
    drop({ listingKey: `k${i}`, lastDropPct: pct }),
  )

  it('claims what the marks are, names the hairline, and counts what it could not plot', () => {
    const figure = priceDropDistribution({
      drops: [...drops, drop({ listingKey: 'x', lastDropPct: null })],
      total: 60,
      cap: 48,
      placeLabel: 'Central Oregon',
      windowDays: 7,
      fetchedAt: 'Sep 9, 2026',
    })!
    expect(figure.draw).toBe('strip')
    expect(figure.points).toHaveLength(6)
    expect(figure.claim).toContain('7.0%')
    // SITE-108: the claim names the hairline, because an unlabelled strip of
    // dots read as "a decorative scatter" to the 2026-09-15 evaluator.
    expect(figure.claim).toContain('hairline')
    expect(figure.claim).toContain("each card's bar")
    expect(figure.source).toContain('60 cuts are in the window and the pull is capped at 48')
    expect(figure.source).toContain('12 of them are not on this page at all')
    expect(figure.source).toContain('1 row(s) in the pull carry no percent')
  })

  it('draws the hairline at the page median the route hands in, not a second median of its own', () => {
    const figure = priceDropDistribution({
      drops,
      total: 6,
      cap: 48,
      placeLabel: 'Central Oregon',
      windowDays: 7,
      fetchedAt: null,
      // medianPositive over 3,5,7,9,11,13 averages the two middle values.
      medianPct: 8,
    })!
    expect(figure.context).toEqual({ value: 8, label: 'middle cut 8.0%' })
    expect(figure.claim).toContain('8.0%')
  })

  it('falls back to the middle drawn mark when the route names no median', () => {
    const figure = priceDropDistribution({
      drops,
      total: 6,
      cap: 48,
      placeLabel: 'Central Oregon',
      windowDays: 7,
      fetchedAt: null,
    })!
    expect(figure.context).toEqual({ value: 7, label: 'middle cut 7.0%' })
  })

  it('returns nothing when no row can be placed', () => {
    expect(
      priceDropDistribution({
        drops: [drop({ lastDropPct: null })],
        total: 1,
        cap: 48,
        placeLabel: 'Central Oregon',
        windowDays: 7,
        fetchedAt: null,
      }),
    ).toBeNull()
  })
})
