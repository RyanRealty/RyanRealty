/**
 * THE BENCH (Matt 2026-10-08, refill from the same rung).
 *
 * A rung that widens the area seats only what reaches five. The sales it
 * qualified past that are its bench, in the rung's own order (closest matches
 * first), and the comparability review refills from there, never from a wider
 * rung. Own ground seats the best five. The rest of that plat is the bench.
 */
import { describe, expect, it } from 'vitest'
import { PRICING_TARGET_COMPS } from '@/lib/pricing/ladder'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

function subject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '1 Test St',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Old Ground',
    subdivisionNorm: 'old ground',
    subdivisionSlug: 'old-ground',
    latitude: 44.06,
    longitude: -121.3,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    yearBuilt: 1998,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: null,
    communityLocated: true,
    communitySlug: null,
    ...over,
  }
}

let seq = 0
function sale(over: Partial<PricingSale> = {}): PricingSale {
  seq += 1
  return {
    listingKey: over.listingKey ?? `K${seq}`,
    listNumber: null,
    address: over.address ?? `${seq} Comp St`,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Old Ground',
    subdivisionNorm: 'old ground',
    subdivisionSlug: 'old-ground',
    latitude: 44.061,
    longitude: -121.301,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.18,
    yearBuilt: 1996,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 700_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: 725_000,
    lastAsk: 710_000,
    daysToOffer: 18,
    cdom: 32,
    dropCount: 1,
    closePpsf: 350,
    photoUrl: null,
    publicRemarks: null,
    communityLocated: true,
    communitySlug: null,
    ...over,
  }
}

const asOf = '2026-08-01'
const here = { latitude: 44.06, longitude: -121.3 }
function atMiles(miles: number) {
  return { latitude: here.latitude + miles / 69, longitude: here.longitude }
}

describe('the refill bench (Matt 2026-10-08)', () => {
  it('is the reach rung\'s next candidates in its own order, and never a wider rung\'s', () => {
    const subj = subject({ adjacentSubdivisionSlugs: ['like-neighbors'] })
    const like = (listingKey: string, miles: number) =>
      sale({
        ...atMiles(miles),
        listingKey,
        address: `${listingKey} Like Ln`,
        subdivision: 'Like Neighbors',
        subdivisionNorm: 'like neighbors',
        subdivisionSlug: 'like-neighbors',
      })
    // A plat that touches nothing, inside a mile: a ring would take it, but
    // the walk stops widening at five and the bench never reaches past the
    // rung that got there.
    const wide = sale({
      ...atMiles(0.8),
      listingKey: 'WIDE',
      address: '9 Wide Way',
      subdivision: 'Other Place',
      subdivisionNorm: 'other place',
      subdivisionSlug: 'other-place',
    })
    const pool = [
      wide,
      ...['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'].map((key) => like(key, 0.3)),
      ...['N1', 'N2', 'N3'].map((key) => like(key, 0.05)),
    ]
    const out = walkPricingLadder(subj, pool, { asOf })
    const seated = out.comps.map((c) => c.listingKey)
    expect(seated).toHaveLength(PRICING_TARGET_COMPS)
    expect(seated).toEqual(expect.arrayContaining(['N1', 'N2', 'N3', 'F1', 'F2']))
    expect(out.reachedOnTier).toBe('adjacent-sub-3mo')
    expect(out.reachedOnWidening).toBe(true)
    // The bench: the same rung's remaining qualifiers, closest matches first
    // (equal distance and features, so the listing key settles the order).
    expect((out.bench ?? []).map((c) => c.listingKey)).toEqual(['F3', 'F4', 'F5', 'F6', 'F7'])
    expect((out.bench ?? []).every((c) => c.selectionTier === 'adjacent-sub-3mo')).toBe(true)
    expect((out.bench ?? []).every((c) => c.setsPrice)).toBe(true)
    expect((out.bench ?? []).some((c) => c.listingKey === 'WIDE')).toBe(false)
    expect(seated).not.toContain('WIDE')
    // No bench sale is also seated.
    expect((out.bench ?? []).some((c) => seated.includes(c.listingKey))).toBe(false)
  })

  it('keeps the five newest own-plat sales and benches the rest', () => {
    const subj = subject()
    const own = (listingKey: string, closeDate: string) =>
      sale({ ...atMiles(0.04), listingKey, address: `${listingKey} Own Ln`, closeDate })
    const pool = [
      own('O1', '2026-07-20'),
      own('O2', '2026-07-10'),
      own('O3', '2026-06-30'),
      own('O4', '2026-06-20'),
      own('O5', '2026-06-10'),
      own('O6', '2026-05-30'),
      own('O7', '2026-05-20'),
      own('O8', '2026-05-10'),
      own('O9', '2026-04-30'),
    ]
    const out = walkPricingLadder(subj, pool, { asOf })
    // Same size, beds, baths, and year. Recency seats O1 through O5.
    expect(out.comps.map((c) => c.listingKey)).toEqual(['O1', 'O2', 'O3', 'O4', 'O5'])
    expect(out.comps).toHaveLength(PRICING_TARGET_COMPS)
    expect(out.reachedOnTier?.startsWith('subdivision-')).toBe(true)
    expect(out.reachedOnWidening).toBe(false)
    expect((out.bench ?? []).map((c) => c.listingKey)).toEqual(['O6', 'O7', 'O8', 'O9'])
    expect((out.bench ?? []).every((c) => c.selectionTier.startsWith('subdivision-'))).toBe(true)
  })
})
