import { describe, expect, it } from 'vitest'
import {
  classifyCmaOrigin,
  isAskedOrigin,
  isColdOrigin,
  prospectKindForOrigin,
  sendModeForOrigin,
  theirPriceLabelFor,
  CMA_ORIGIN_LABEL,
  type CmaOrigin,
} from '@/lib/cma/origin'

describe('classifyCmaOrigin', () => {
  it('maps every request_source the builder actually writes', () => {
    expect(classifyCmaOrigin('expired-listing-cron')).toBe('expired')
    expect(classifyCmaOrigin('expired-dashboard')).toBe('expired')
    expect(classifyCmaOrigin('fsbo-cron')).toBe('fsbo')
    expect(classifyCmaOrigin('fsbo-lp')).toBe('fsbo')
    expect(classifyCmaOrigin('seller-lp')).toBe('seller-valuation')
    expect(classifyCmaOrigin('lead-form')).toBe('lead-form')
    expect(classifyCmaOrigin('admin-manual')).toBe('broker')
    expect(classifyCmaOrigin('crm-kickoff')).toBe('broker')
    expect(classifyCmaOrigin('cli-rebuild')).toBe('internal')
    expect(classifyCmaOrigin('brain-queue')).toBe('internal')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(classifyCmaOrigin('  Seller-LP ')).toBe('seller-valuation')
  })

  it('falls back to the legacy expired-audit doc_type when source is missing', () => {
    // 367 live rows carry the legacy doc_type; without this they read as
    // 'unknown' and drop off the expired filter entirely.
    expect(classifyCmaOrigin(null, 'expired-audit')).toBe('expired')
    expect(classifyCmaOrigin('', 'expired-audit')).toBe('expired')
  })

  it('returns unknown rather than guessing', () => {
    expect(classifyCmaOrigin(null)).toBe('unknown')
    expect(classifyCmaOrigin('something-nobody-wrote')).toBe('unknown')
  })
})

describe('send lanes', () => {
  it('sends what a person asked for immediately, and drips cold outreach', () => {
    expect(sendModeForOrigin('seller-valuation')).toBe('now')
    expect(sendModeForOrigin('lead-form')).toBe('now')
    expect(sendModeForOrigin('broker')).toBe('now')
    expect(sendModeForOrigin('expired')).toBe('drip')
    expect(sendModeForOrigin('fsbo')).toBe('drip')
  })

  it('never puts an unattributed row on a bulk lane', () => {
    // A backfilled row with no provenance must not ride a batch send.
    expect(sendModeForOrigin('unknown')).toBe('manual')
    expect(sendModeForOrigin('internal')).toBe('manual')
  })

  it('asked and cold are mutually exclusive, and every origin has a lane', () => {
    const all: CmaOrigin[] = ['expired', 'fsbo', 'seller-valuation', 'lead-form', 'broker', 'internal', 'unknown']
    for (const o of all) {
      expect(isAskedOrigin(o) && isColdOrigin(o)).toBe(false)
      expect(['now', 'drip', 'manual']).toContain(sendModeForOrigin(o))
      expect(CMA_ORIGIN_LABEL[o]).toBeTruthy()
    }
  })
})

describe('origin context', () => {
  it('names the price they had it at, per origin', () => {
    expect(theirPriceLabelFor('expired')).toBe('Last list')
    expect(theirPriceLabelFor('fsbo')).toBe('Their ask')
    // A requested valuation has no asking price — a label here would invent one.
    expect(theirPriceLabelFor('seller-valuation')).toBeNull()
    expect(theirPriceLabelFor('lead-form')).toBeNull()
  })

  it('joins only the origins that have a prospect table', () => {
    expect(prospectKindForOrigin('expired')).toBe('expired')
    expect(prospectKindForOrigin('fsbo')).toBe('fsbo')
    expect(prospectKindForOrigin('seller-valuation')).toBeNull()
  })
})
