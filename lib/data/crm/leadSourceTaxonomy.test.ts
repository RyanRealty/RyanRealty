import { describe, it, expect } from 'vitest'
import {
  classifyLeadSource,
  isAttributableLead,
  normalizeSource,
  type LeadChannel,
} from './leadSourceTaxonomy'

// Every source string observed in production crm_people (2026-07) + the kebab/
// snake labels the live pipelines write. This test is the contract: if a new
// source appears and lands in the wrong bucket, add a rule here first.
const CASES: Array<[string, LeadChannel, boolean]> = [
  // channel, attributable
  // ── outreach lists (WE built these — never a marketing lead) ──
  ['Farm', 'prospecting', false],
  ['westside-farm-assessor', 'prospecting', false],
  ['Expired Listing', 'prospecting', false],
  ['expired-listing-cron', 'prospecting', false],
  ['FSBO', 'prospecting', false],
  ['Import', 'import', false],
  ['Follow Up Boss', 'import', false],
  ['Sphere', 'import', false], // bulk sphere-of-influence list — not per-lead inbound
  // ── genuine inbound / direct leads ──
  ['Website', 'web', true],
  ['website-signup', 'web', true],
  ['ryan-realty.com', 'web', true],
  ['contact-form', 'web', true],
  ['buyer-lp', 'web', true],
  ['seller-lp', 'web', true],
  ['seller_lp', 'web', true],
  // Inbound LP FORM submissions — a homeowner filled out our page. Real leads,
  // distinct from the "Expired Listing" / "FSBO" prospecting lists above.
  ['expired-lp', 'web', true],
  ['fsbo-lp', 'web', true],
  ['home-valuation', 'web', true],
  ['home_valuation_cta', 'web', true],
  ['cma-request', 'web', true],
  ['rental-calculator', 'web', true],
  ['exit_intent_popup', 'web', true],
  ['lp-form', 'web', true],
  ['tetherow_heath_cma', 'web', true],
  ['Google', 'web', true],
  ['Realtor.com', 'portal', true],
  ['realtor.com', 'portal', true],
  ['Zillow', 'portal', true],
  ['Inbound Call', 'phone', true],
  ['inbound-call', 'phone', true],
  ['Sign Call', 'phone', true],
  ['Cold Call', 'phone', true],
  ['Inbound Text', 'phone', true],
  ['Social', 'social', true],
  ['Facebook', 'social', true],
  ['facebook', 'social', true],
  ['meta-lead-form', 'social', true],
  ['Word of Mouth', 'referral', true],
  ['Referral', 'referral', true],
  ['Open House', 'referral', true],
  ['Manual Entry', 'manual', false],
  ['Manual entry', 'manual', false],
  // ── unknown / empty ──
  ['', 'unknown', false],
  ['whatever-new-thing', 'unknown', false],
]

describe('classifyLeadSource', () => {
  for (const [source, channel, attributable] of CASES) {
    it(`${JSON.stringify(source)} → ${channel} (attributable=${attributable})`, () => {
      const c = classifyLeadSource(source)
      expect(c.channel).toBe(channel)
      expect(c.attributable).toBe(attributable)
    })
  }

  it('handles null/undefined without throwing', () => {
    expect(classifyLeadSource(null).channel).toBe('unknown')
    expect(classifyLeadSource(undefined).channel).toBe('unknown')
    expect(isAttributableLead(null)).toBe(false)
  })

  it('prospecting wins over an incidental web keyword (farm never leaks to web)', () => {
    // A farm list labeled with a website-ish token must still classify as prospecting.
    expect(classifyLeadSource('Farm - website upload').channel).toBe('prospecting')
  })

  it('normalizeSource collapses punctuation + case', () => {
    expect(normalizeSource('Realtor.com')).toBe('realtor com')
    expect(normalizeSource('  Inbound_Call  ')).toBe('inbound call')
  })
})
