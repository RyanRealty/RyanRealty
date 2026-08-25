import { describe, expect, it } from 'vitest'
import { EMPTY_PROPERTY_FACTS } from './required-documents'
import {
  overlayPropertyFacts,
  parseInboundFeePct,
  parseSavedPropertyFacts,
  prefillReferralFee,
  referralFeeDollars,
} from './property-facts'

describe('overlayPropertyFacts', () => {
  it('lets a confirmed no overwrite unknown without inventing the rest', () => {
    const merged = overlayPropertyFacts(EMPTY_PROPERTY_FACTS, { hasWell: false, hasHOA: true })
    expect(merged.hasWell).toBe(false)
    expect(merged.hasHOA).toBe(true)
    expect(merged.hasSeptic).toBeNull()
  })
  it('lets the broker overlay win over MLS', () => {
    const mls = overlayPropertyFacts(EMPTY_PROPERTY_FACTS, { hasWell: true, yearBuilt: 1990 })
    const confirmed = overlayPropertyFacts(mls, { hasWell: false })
    expect(confirmed.hasWell).toBe(false)
    expect(confirmed.yearBuilt).toBe(1990)
  })
})

describe('parseSavedPropertyFacts', () => {
  it('reads booleans, a year, and financing and ignores junk', () => {
    expect(
      parseSavedPropertyFacts({
        hasWell: true,
        hasSeptic: false,
        yearBuilt: 1972,
        financing: 'fha',
        extra: 'no',
      }),
    ).toEqual({ hasWell: true, hasSeptic: false, yearBuilt: 1972, financing: 'fha' })
    expect(parseSavedPropertyFacts({ yearBuilt: 12 })).toBeNull()
    expect(parseSavedPropertyFacts(null)).toBeNull()
  })
})

describe('referralFeeDollars', () => {
  it('is 25 percent of GCI, cents rounded', () => {
    expect(referralFeeDollars(100_000, 25)).toBe(25000)
    expect(referralFeeDollars(33333, 25)).toBe(8333.25)
  })
  it('does not invent a fee when GCI or the percent is missing', () => {
    expect(referralFeeDollars(null, 25)).toBeNull()
    expect(referralFeeDollars(100_000, null)).toBeNull()
    expect(parseInboundFeePct({ inboundFeePct: 25 })).toBe(25)
    expect(parseInboundFeePct({ inboundFeePct: 0 })).toBeNull()
  })
  it('does not overwrite a referral fee already on the row', () => {
    expect(prefillReferralFee(5000, 100_000, 25)).toBeNull()
    expect(prefillReferralFee(0, 100_000, 25)).toBe(25000)
  })
})

describe('accepting a contract keeps the answers the broker already gave', () => {
  it('lets a confirmed answer beat the feed, and leaves unanswered keys to the feed', () => {
    // The MLS knows water and sewer. It does not know solar, tenants, or a
    // short sale — that is why the panel asks. Re-seeding the sale checklist
    // from the feed alone threw those answers away and asked again.
    const fromFeed = overlayPropertyFacts(EMPTY_PROPERTY_FACTS, { hasWell: true, hasSeptic: true })
    const withBroker = overlayPropertyFacts(fromFeed, { hasWell: false, hasSolar: false })
    expect(withBroker.hasWell).toBe(false)
    expect(withBroker.hasSolar).toBe(false)
    expect(withBroker.hasSeptic).toBe(true)
  })

  it('reads nothing out of a cycle that never saved facts', () => {
    expect(parseSavedPropertyFacts(null)).toBeNull()
    expect(parseSavedPropertyFacts(undefined)).toBeNull()
  })
})
