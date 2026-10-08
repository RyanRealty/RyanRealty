/**
 * The facts walk admits on the one 20% line (Matt 2026-10-08,
 * lib/pricing/price-tier.ts): a sale's own closed $/sqft against the home's
 * independent anchor, in place of the 30% tier gap. A sale outside is skipped
 * and counted; the walk goes on in the same order.
 */
import { describe, expect, it } from 'vitest'
import { walkPricingLadder, type PricingSale, type PricingSubject, type SubdivisionCell } from '@/lib/pricing/match'

const asOf = '2026-08-01'

function subject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '1 Test St',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: null,
    subdivisionNorm: null,
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
    ...over,
  }
}

let seq = 0
function sale(key: string, ppsf: number, over: Partial<PricingSale> = {}): PricingSale {
  seq += 1
  const sqft = over.sqft ?? 1980
  return {
    listingKey: key,
    listNumber: null,
    address: `${seq} Comp St`,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: null,
    subdivisionNorm: null,
    latitude: 44.061,
    longitude: -121.301,
    beds: 3,
    baths: 2,
    sqft,
    lotAcres: 0.18,
    yearBuilt: 1996,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: Math.round(sqft * ppsf),
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: null,
    lastAsk: null,
    daysToOffer: 18,
    cdom: 32,
    dropCount: 0,
    closePpsf: ppsf,
    photoUrl: null,
    publicRemarks: null,
    ...over,
  }
}

const keys = (out: ReturnType<typeof walkPricingLadder>) => out.comps.map((c) => c.listingKey).sort()

describe('the facts walk admits on the one 20% price line', () => {
  // Four sales at $500 plus the two under test: the anchor (the median of the
  // sales within a mile) is $500, so the line is $400 to $600.
  const core = () => ['A', 'B', 'C', 'D'].map((k) => sale(k, 500))

  it('keeps a sale 19% under the anchor and skips one 21% under, which the 30% gap seated', () => {
    const out = walkPricingLadder(subject(), [...core(), sale('IN', 405), sale('OUT', 395)], { asOf })
    expect(out.priceAnchor?.ppsf).toBe(500)
    expect(keys(out)).toEqual(['A', 'B', 'C', 'D', 'IN'])
    expect(keys(out)).not.toContain('OUT')
    // Counted with its reason, once, however many rungs re-read it.
    expect(out.priceTierSkipped).toBe(1)
    expect(out.rungs.some((r) => (r.priceTier ?? 0) > 0)).toBe(true)
    expect(out.trace.some((t) => t.includes('sold outside $400 to $600 a square foot (within 20% of $500)'))).toBe(true)
  })

  it('keeps a sale 19% over the anchor and skips one 21% over', () => {
    const out = walkPricingLadder(subject(), [...core(), sale('IN', 595), sale('OUT', 605)], { asOf })
    expect(keys(out)).toEqual(['A', 'B', 'C', 'D', 'IN'])
  })

  it('grades a sale whose plat has its own cell too (2400 Jones: never graded on its own price before)', () => {
    // Subject and sales each sit in a named plat with a cell of its own, and
    // the two medians agree, so the plat-against-plat test passes. Under the
    // 30% gap the sale's own $/sqft was then never read, which is how 2400
    // Jones at $381 reached 1648 Pheasant's set against a $498 anchor.
    const cells = new Map<string, SubdivisionCell>([
      ['bend:pheasant hill', { medianPpsf: 500, n: 12 }],
      ['bend:jones addition', { medianPpsf: 490, n: 12 }],
    ])
    const named = (k: string, ppsf: number, sqft: number) =>
      sale(k, ppsf, { subdivision: 'Jones Addition', subdivisionNorm: 'jones addition', sqft })
    const out = walkPricingLadder(
      subject({ subdivision: 'Pheasant Hill', subdivisionNorm: 'pheasant hill' }),
      // A named tract walks its quarter-mile pocket here, and a pocket sale
      // whose CLOSE sits under every other kept close is dropped by its own
      // rule (rule 5). JONES is the larger house, so its close is not the
      // lowest: only its $/sqft, $381 against a $500 anchor, keeps it out.
      [
        ...['A', 'B', 'C', 'D'].map((k) => named(k, 500, 1700)),
        named('IN', 595, 1700),
        named('JONES', 381, 2350),
      ],
      { asOf, cells },
    )
    expect(keys(out)).toContain('IN')
    expect(keys(out)).not.toContain('JONES')
  })

  it('never grades the subject own plat, and never the same-street twin', () => {
    const ownPlat = (k: string, ppsf: number) =>
      sale(k, ppsf, { subdivision: 'Kenwood', subdivisionNorm: 'kenwood' })
    const out = walkPricingLadder(
      subject({ subdivision: 'Kenwood', subdivisionNorm: 'kenwood' }),
      [...core(), ownPlat('PLAT_LOW', 300), sale('TWIN', 300, { address: '9 Test St', sqft: 2000 })],
      { asOf },
    )
    expect(keys(out)).toContain('PLAT_LOW')
    expect(keys(out)).toContain('TWIN')
  })

  it('with no anchor keeps the old behavior: nothing is graded on its own price', () => {
    // Four sales are under ANCHOR_MIN_N, so there is no anchor and no line, and
    // a cell-less sale with no subject cell passes as it always did.
    const out = walkPricingLadder(subject(), [sale('A', 500), sale('B', 500), sale('C', 500), sale('LOW', 300)], {
      asOf,
    })
    expect(out.priceAnchor).toBeNull()
    expect(keys(out)).toContain('LOW')
    expect(out.priceTierSkipped).toBe(0)
  })
})
