import { describe, it, expect } from 'vitest'
import { tileAndEventToDrop, type ActivityEventRow } from './getPriceDrops'
import type { ListingTile } from '@/lib/data/types/listing'

/**
 * §0 data-accuracy lock (Matt report 2026-07-12): a price-drop card must never
 * show "was $X, -Y%, now $X". The displayed was → now → % have to be
 * self-consistent, and a listing whose CURRENT price is not below the prior
 * price (recovered / relisted / increased) must be excluded entirely.
 *
 * Regression case: 18575 Century Drive — an event dropped it $299K → $229K, then
 * it went back to $299K, and the old logic (percent from the event's new_price)
 * printed "was $299K, -23.4%" while it was currently listed at $299,000.
 */
const NOW = 1_800_000_000_000

function tile(listPrice: number): ListingTile {
  return {
    listingKey: 'K1',
    listNumber: 'L1',
    streetNumber: '18575',
    streetName: 'Century Drive',
    streetSuffix: null,
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97702',
    subdivisionName: null,
    subdivisionSlug: null,
    lat: null,
    lng: null,
    photoUrl: 'p.jpg',
    beds: 2,
    baths: 2,
    sqft: 1024,
    listPrice,
    priceDropCount: 1,
    addressSlug: null,
    listNumber2: null,
  } as unknown as ListingTile
}

function event(previous: number | null, next: number | null): ActivityEventRow {
  return {
    id: 'e1',
    listing_key: 'K1',
    event_type: 'price_change',
    event_at: new Date(NOW - 86_400_000).toISOString(),
    payload: { previous_price: previous, new_price: next },
  }
}

describe('tileAndEventToDrop — was → now → % consistency (§0)', () => {
  it('excludes a listing whose current price is NOT below the prior price (recovered/relisted)', () => {
    // The regression: event $299K → $229K, but currently back to $299K.
    expect(tileAndEventToDrop(tile(299_000), event(299_000, 229_000), NOW)).toBeNull()
  })

  it('excludes a listing whose price went UP', () => {
    expect(tileAndEventToDrop(tile(400_000), event(350_000, 400_000), NOW)).toBeNull()
  })

  it('excludes when previous_price is missing (unverifiable)', () => {
    expect(tileAndEventToDrop(tile(299_000), event(null, 250_000), NOW)).toBeNull()
  })

  it('computes a consistent drop from previous → current list price', () => {
    const d = tileAndEventToDrop(tile(299_000), event(390_000, 299_000), NOW)
    expect(d).not.toBeNull()
    expect(d!.originalListPrice).toBe(390_000) // "was"
    expect(d!.listPrice).toBe(299_000) // "now"
    expect(d!.lastDropAmount).toBe(91_000)
    expect(d!.lastDropPct).toBeCloseTo((91_000 / 390_000) * 100, 3) // ~23.3%
    // The invariant: was * (1 - pct/100) === now (never "was == now with a %").
    expect(d!.originalListPrice! * (1 - d!.lastDropPct! / 100)).toBeCloseTo(d!.listPrice!, 0)
  })

  it('the percentage always agrees with the displayed was/now prices', () => {
    for (const [prev, now] of [
      [500_000, 450_000],
      [1_250_000, 1_100_000],
      [349_900, 319_900],
    ] as const) {
      const d = tileAndEventToDrop(tile(now), event(prev, now), NOW)!
      expect(d).not.toBeNull()
      const impliedNow = d.originalListPrice! * (1 - d.lastDropPct! / 100)
      expect(impliedNow).toBeCloseTo(d.listPrice!, 0)
      expect(d.lastDropAmount).toBe(prev - now)
    }
  })
})
