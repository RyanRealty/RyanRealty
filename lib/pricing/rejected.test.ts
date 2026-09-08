/**
 * Considered and not used, tested through the function the build calls.
 *
 * Tested here: that a sale the grid prints can never also appear as rejected,
 * that no sale is listed twice, that every reason states the RULE that cut the
 * sale rather than a fact about it, and that a sale with no recoverable rule is
 * omitted instead of given an invented one.
 */

import { describe, expect, it } from 'vitest'
import { buildRejectedSales, rejectionReason, type KeptSale, type RejectedCandidate } from './rejected'
// The mechanical voice module was retired (main, 2026-09). What it enforced on
// these strings is checked here directly: no display punctuation, no jargon.
const BANNED_PUNCTUATION = /[—–;]/
const BANNED_JARGON = /\b(comp|comps|subject|band|bands|tier|tiers|ladder)\b/i
function readsLikeSellerProse(text: string): boolean {
  return !BANNED_PUNCTUATION.test(text) && !BANNED_JARGON.test(text)
}

const ASOF = new Date('2026-09-07T00:00:00Z').getTime()

const SUBJECT = {
  sqft: 1_440,
  yearBuilt: 2003,
  baths: 2,
  propertySubType: 'Single Family Residence',
  latitude: 44.0582,
  longitude: -121.3153,
}

function candidate(over: Partial<RejectedCandidate> = {}): RejectedCandidate {
  return {
    listingKey: 'A',
    address: '900 SW Rimrock Way',
    sqft: 1_450,
    yearBuilt: 2004,
    baths: 2,
    propertySubType: 'Single Family Residence',
    closeDate: '2026-07-01',
    latitude: 44.0582,
    longitude: -121.3153,
    ...over,
  }
}

function kept(over: Partial<KeptSale> = {}): KeptSale {
  return {
    listingKey: 'K1',
    address: '61234 NW Juniper Ave',
    sqft: 1_460,
    yearBuilt: 2002,
    closeDate: '2026-06-01',
    closePrice: 600_000,
    ...over,
  }
}

describe('rejectionReason', () => {
  it('does not call two names for the same kind of home a difference', () => {
    // Live 2026-09-07, cma-64726-horseman: "a manufactured, and yours is a
    // manufactured on land" is not a reason a reader can use.
    expect(
      rejectionReason(
        candidate({ propertySubType: 'Manufactured', sqft: 2_400 }),
        { ...SUBJECT, propertySubType: 'Manufactured On Land' },
        ASOF,
      ),
    ).toBe('2,400 square feet against your 1,440')
  })

  it('leads with a different kind of home', () => {
    expect(rejectionReason(candidate({ propertySubType: 'Townhouse', sqft: 900 }), SUBJECT, ASOF)).toBe(
      'a different kind of home: a townhouse, and yours is a single family residence',
    )
  })

  it('then the bath count, stated against the reader’s own', () => {
    expect(rejectionReason(candidate({ baths: 3 }), SUBJECT, ASOF)).toBe('3 baths against your 2')
  })

  it('then size', () => {
    expect(rejectionReason(candidate({ sqft: 2_400 }), SUBJECT, ASOF)).toBe(
      '2,400 square feet against your 1,440',
    )
  })

  it('then age', () => {
    expect(rejectionReason(candidate({ yearBuilt: 1961 }), SUBJECT, ASOF)).toBe(
      'built in 1961, and yours in 2003',
    )
  })

  it('states the two-year window when the sale sold outside it', () => {
    expect(rejectionReason(candidate({ closeDate: '2024-01-15' }), SUBJECT, ASOF)).toBe(
      'sold 32 months ago, outside the two years this analysis draws from',
    )
  })

  it('never states a distance as a reason', () => {
    // The 2026-09-07 document pass: "0.18 miles NE from your home" printed as a
    // reason, so a reader saw a CLOSER home rejected than the ones kept.
    const reason = rejectionReason(candidate(), SUBJECT, ASOF)
    expect(reason).toBeNull()
  })

  it('omits the row rather than invent a reason it cannot recover', () => {
    expect(rejectionReason(candidate({ sqft: 1_445, yearBuilt: 2003 }), SUBJECT, ASOF)).toBeNull()
  })

  it('falls back to what the comparability review said, in seller language', () => {
    const reason = rejectionReason(candidate(), SUBJECT, ASOF, {
      reviewReason: 'This comp is a different quality tier from the subject property',
    })
    expect(reason).toBe(
      'our comparability review set it aside: This sale is a different quality level from your home',
    )
    expect(readsLikeSellerProse(reason!)).toBe(true)
  })

  it('omits the row when the review’s words cannot be made into seller language', () => {
    expect(rejectionReason(candidate(), SUBJECT, ASOF, { reviewReason: 'Outside the price band ladder' })).toBeNull()
    // Live judge prose, cma-2980-lucus. A blanket swap of "subject" writes
    // "12 years after the 2004 your home" onto a page a seller reads.
    expect(
      rejectionReason(candidate(), SUBJECT, ASOF, {
        reviewReason: 'Built 2016, 12 years after the 2004 subject, custom residence at $503/sqft.',
      }),
    ).toBeNull()
  })

  it('translates the possessive the review actually writes', () => {
    // Live judge prose, cma-2513-upas-redmond-97756.
    expect(
      rejectionReason(candidate(), SUBJECT, ASOF, {
        reviewReason: "Dry Canyon 55+ community by Lennar, not the subject's buyer pool",
      }),
    ).toBe("our comparability review set it aside: Dry Canyon 55+ community by Lennar, not your home's buyer pool")
  })

  it('states a size or age gap only when it beats every sale that set the price', () => {
    // A 2,400 sqft sale is a wide gap in the abstract, but not when a kept sale
    // is wider — saying so would repeat the distance bug in another column.
    const context = { widestKeptSizeGap: 0.9, widestKeptAgeGap: 60, oldestKeptMonths: 40 }
    expect(rejectionReason(candidate({ sqft: 2_400 }), SUBJECT, ASOF, context)).toBeNull()
    expect(rejectionReason(candidate({ yearBuilt: 1961 }), SUBJECT, ASOF, context)).toBeNull()
    // 4,000 sqft is a 1.78x gap, wider than the widest kept sale — that states a rule.
    expect(rejectionReason(candidate({ sqft: 4_000 }), SUBJECT, ASOF, context)).toBe(
      '4,000 square feet against your 1,440',
    )
  })

  it('says a sale sold longer ago than every sale that set the price', () => {
    expect(
      rejectionReason(candidate({ closeDate: '2025-09-01' }), SUBJECT, ASOF, { oldestKeptMonths: 6 }),
    ).toBe('sold 12 months ago, longer ago than any sale that set this price')
  })

  it('writes prose the voice canon accepts', () => {
    const lines = [
      rejectionReason(candidate({ propertySubType: 'Townhouse' }), SUBJECT, ASOF),
      rejectionReason(candidate({ baths: 3 }), SUBJECT, ASOF),
      rejectionReason(candidate({ sqft: 2_400 }), SUBJECT, ASOF),
      rejectionReason(candidate({ yearBuilt: 1961 }), SUBJECT, ASOF),
      rejectionReason(candidate({ closeDate: '2024-01-15' }), SUBJECT, ASOF),
    ]
      .filter((r): r is string => r != null)
      .join('\n')
    expect(readsLikeSellerProse(lines)).toBe(true)
  })
})

describe('buildRejectedSales', () => {
  it('never lists a sale the grid prints', () => {
    // cma-65365-concorde, 2026-09-07: five of the six sales in the grid also
    // printed under "considered and not used". The kept set is the exclusion.
    const a = candidate({ listingKey: 'A', sqft: 2_400 })
    const b = candidate({ listingKey: 'B', address: '17 SW Bluff Dr', sqft: 4_000 })
    const out = buildRejectedSales({
      candidates: [a, b],
      excluded: [{ listingKey: 'A' }, { listingKey: 'B' }],
      kept: [kept({ listingKey: 'A', address: a.address })],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out.map((r) => r.listingKey)).toEqual(['B'])
  })

  it('never lists a kept sale under a second listing key, matching on the address', () => {
    const out = buildRejectedSales({
      candidates: [candidate({ listingKey: 'A2', address: '900 SW Rimrock Way ', sqft: 2_400 })],
      excluded: [{ listingKey: 'A2' }],
      kept: [kept({ listingKey: 'A', address: '900 SW Rimrock Way' })],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toEqual([])
  })

  it('never lists the same sale twice', () => {
    const out = buildRejectedSales({
      candidates: [candidate({ listingKey: 'A', sqft: 2_400 })],
      excluded: [{ listingKey: 'A' }, { listingKey: 'A' }],
      outliers: [{ address: '900 SW Rimrock Way', closePrice: 695_000, ppsf: 695, reason: 'x' }],
      kept: [kept()],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toHaveLength(1)
  })

  it('names the excluded sales with a rule, and drops the ones with none', () => {
    const out = buildRejectedSales({
      candidates: [candidate({ listingKey: 'A', sqft: 2_400 }), candidate({ listingKey: 'B', address: '17 SW Bluff Dr' })],
      excluded: [{ listingKey: 'A' }, { listingKey: 'B' }],
      kept: [kept()],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toEqual([
      { listingKey: 'A', address: '900 SW Rimrock Way', reason: '2,400 square feet against your 1,440' },
    ])
  })

  it('keeps a sale the review cut, using the review’s own stated reason', () => {
    const out = buildRejectedSales({
      candidates: [candidate({ listingKey: 'B', address: '17 SW Bluff Dr' })],
      excluded: [{ listingKey: 'B', reason: 'The comp backs to the highway and the subject does not' }],
      kept: [kept()],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toEqual([
      {
        listingKey: 'B',
        address: '17 SW Bluff Dr',
        reason: 'our comparability review set it aside: The sale backs to the highway and your home does not',
      },
    ])
  })

  it('skips an excluded key that is not in the candidates', () => {
    const out = buildRejectedSales({
      candidates: [candidate({ listingKey: 'A' })],
      excluded: [{ listingKey: 'GHOST' }],
      kept: [kept()],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toEqual([])
  })

  it('states an outlier trim as the gap to the sales that set the price', () => {
    const out = buildRejectedSales({
      candidates: [],
      excluded: [],
      outliers: [{ address: '291 Bluff', closePrice: 695_000, ppsf: 695.4, reason: 'ppsf outlier' }],
      // 600,000 / 1,460 = $411/sqft. 695 is 69 percent above it.
      kept: [kept()],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toEqual([
      {
        listingKey: null,
        address: '291 Bluff',
        reason: 'sold at $695 a square foot, 69 percent above the sales that set this price',
      },
    ])
  })

  it('states an outlier trim without a percentage when there is nothing to compare it to', () => {
    const out = buildRejectedSales({
      candidates: [],
      excluded: [],
      outliers: [{ address: '291 Bluff', closePrice: 695_000, ppsf: 695.4, reason: 'ppsf outlier' }],
      kept: [],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out[0]!.reason).toBe(
      'sold at $695 a square foot, outside the range of the sales that set this price',
    )
  })

  it('stops at eight', () => {
    const candidates = Array.from({ length: 12 }, (_, i) =>
      candidate({ listingKey: `K${i}`, address: `${i} Test St`, sqft: 2_400 }),
    )
    const out = buildRejectedSales({
      candidates,
      excluded: candidates.map((c) => ({ listingKey: c.listingKey })),
      outliers: [{ address: 'extra', closePrice: 1, ppsf: 1, reason: 'x' }],
      kept: [kept()],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toHaveLength(8)
    expect(out.every((r) => r.listingKey != null)).toBe(true)
  })
})

describe('preRejected — a rule that is about the SET, not the sale', () => {
  const kept = [
    { listingKey: 'JUNE', address: '60924 Targee', sqft: 1394, yearBuilt: 1998, closeDate: '2026-06-26', closePrice: 455_000 },
    { listingKey: 'A', address: '61111 Chuckanut', sqft: 1440, yearBuilt: 1996, closeDate: '2026-08-21', closePrice: 307_000 },
  ]
  const subject = { sqft: 1668, yearBuilt: 1997, baths: 2, propertySubType: 'Single Family Residence' }

  it('lists the prior sale verbatim, beside the printed sale at the same address', () => {
    const out = buildRejectedSales({
      candidates: [],
      preRejected: [
        {
          listingKey: 'MARCH',
          address: '60924 Targee',
          reason: 'an earlier sale of the same home, which sold again on 2026-06-26 and is already in this analysis',
        },
      ],
      excluded: [],
      kept,
      subject,
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.listingKey).toBe('MARCH')
    expect(out[0]!.reason).toContain('sold again on 2026-06-26')
  })

  it('still refuses a key the grid prints', () => {
    const out = buildRejectedSales({
      candidates: [],
      preRejected: [{ listingKey: 'JUNE', address: '60924 Targee', reason: 'whatever' }],
      excluded: [],
      kept,
      subject,
    })
    expect(out).toEqual([])
  })

  it('lists one row per address however many times the home sold', () => {
    const out = buildRejectedSales({
      candidates: [],
      preRejected: [
        { listingKey: 'MARCH', address: '60924 Targee', reason: 'r1' },
        { listingKey: 'OLD', address: '60924 Targee', reason: 'r2' },
      ],
      excluded: [],
      kept,
      subject,
    })
    expect(out).toHaveLength(1)
  })
})
