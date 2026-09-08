/**
 * Considered and not used, tested through the function the build calls.
 * Tested here: which fact becomes the reason, that the review's own prose can
 * never become one, the cap, and that an outlier trim is stated as what it is.
 */

import { describe, expect, it } from 'vitest'
import { buildRejectedSales, rejectionReason, type RejectedCandidate } from './rejected'
// The mechanical voice module was retired (main, 2026-09). What it enforced on
// these strings is checked here directly: no display punctuation, no jargon.
const BANNED_PUNCTUATION = /[—–;]/
const BANNED_JARGON = /\b(comp|comps|subject|band|bands|tier|tiers|ladder)\b/i
function readsLikeSellerProse(text: string): boolean {
  return !BANNED_PUNCTUATION.test(text) && !BANNED_JARGON.test(text)
}

const ASOF = new Date('2026-09-07T00:00:00Z').getTime()

const SUBJECT = { sqft: 1_440, yearBuilt: 2003, propertySubType: 'Single Family Residence' }

function candidate(over: Partial<RejectedCandidate> = {}): RejectedCandidate {
  return {
    listingKey: 'A',
    address: '900 SW Rimrock Way',
    sqft: 1_450,
    yearBuilt: 2004,
    propertySubType: 'Single Family Residence',
    closeDate: '2026-07-01',
    proximity: '1.2 miles NW',
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
      'a townhouse, and yours is a single family residence',
    )
  })

  it('then size, stated against the reader’s own', () => {
    expect(rejectionReason(candidate({ sqft: 2_400 }), SUBJECT, ASOF)).toBe(
      '2,400 square feet against your 1,440',
    )
  })

  it('then age', () => {
    expect(rejectionReason(candidate({ yearBuilt: 1961 }), SUBJECT, ASOF)).toBe(
      'built in 1961, and yours in 2003',
    )
  })

  it('then how long ago it sold', () => {
    expect(rejectionReason(candidate({ closeDate: '2025-01-15' }), SUBJECT, ASOF)).toBe('sold 20 months ago')
  })

  it('then distance, and never an empty claim', () => {
    expect(rejectionReason(candidate(), SUBJECT, ASOF)).toBe('1.2 miles NW from your home')
    expect(rejectionReason(candidate({ proximity: null }), SUBJECT, ASOF)).toBe(
      'a different kind of home from the sales that set this price',
    )
  })

  it('writes prose the voice canon accepts', () => {
    const lines = [
      rejectionReason(candidate({ propertySubType: 'Townhouse' }), SUBJECT, ASOF),
      rejectionReason(candidate({ sqft: 2_400 }), SUBJECT, ASOF),
      rejectionReason(candidate({ yearBuilt: 1961 }), SUBJECT, ASOF),
      rejectionReason(candidate({ closeDate: '2024-01-15' }), SUBJECT, ASOF),
      rejectionReason(candidate({ proximity: null }), SUBJECT, ASOF),
    ].join('\n')
    expect(readsLikeSellerProse(lines)).toBe(true)
  })
})

describe('buildRejectedSales', () => {
  it('names the excluded sales and never repeats the review’s own words', () => {
    const out = buildRejectedSales({
      candidates: [candidate({ listingKey: 'A', sqft: 2_400 }), candidate({ listingKey: 'B' })],
      excludedKeys: ['A'],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toEqual([
      { listingKey: 'A', address: '900 SW Rimrock Way', reason: '2,400 square feet against your 1,440' },
    ])
  })

  it('skips an excluded key that is not in the candidates', () => {
    const out = buildRejectedSales({
      candidates: [candidate({ listingKey: 'A' })],
      excludedKeys: ['GHOST'],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toEqual([])
  })

  it('states an outlier trim as a price, and carries no key for it', () => {
    const out = buildRejectedSales({
      candidates: [],
      excludedKeys: [],
      outliers: [{ address: '291 Bluff', closePrice: 695_000, ppsf: 695.4, reason: 'ppsf outlier' }],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toEqual([
      {
        listingKey: null,
        address: '291 Bluff',
        reason: 'sold at $695 a square foot, outside the range of the sales that set this price',
      },
    ])
  })

  it('stops at eight', () => {
    const candidates = Array.from({ length: 12 }, (_, i) =>
      candidate({ listingKey: `K${i}`, address: `${i} Test St`, sqft: 2_400 }),
    )
    const out = buildRejectedSales({
      candidates,
      excludedKeys: candidates.map((c) => c.listingKey),
      outliers: [{ address: 'extra', closePrice: 1, ppsf: 1, reason: 'x' }],
      subject: SUBJECT,
      asOfMs: ASOF,
    })
    expect(out).toHaveLength(8)
    expect(out.every((r) => r.listingKey != null)).toBe(true)
  })
})
