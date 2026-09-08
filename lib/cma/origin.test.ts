import { describe, expect, it } from 'vitest'
import {
  classifyCmaOrigin,
  isAskedOrigin,
  isColdOrigin,
  prospectKindForOrigin,
  sendModeForOrigin,
  theirPriceLabelFor,
  CMA_ORIGIN_LABEL,
  CMA_ORIGIN_INTENT,
  type CmaOrigin,
} from '@/lib/cma/origin'

describe('classifyCmaOrigin', () => {
  it('maps every request_source the builder actually writes', () => {
    expect(classifyCmaOrigin('expired-listing-cron')).toBe('expired')
    expect(classifyCmaOrigin('expired-dashboard')).toBe('expired')
    expect(classifyCmaOrigin('fsbo-cron')).toBe('fsbo')
    expect(classifyCmaOrigin('fsbo-lp')).toBe('fsbo')
    expect(classifyCmaOrigin('seller-lp')).toBe('seller-valuation')
    expect(classifyCmaOrigin('place-page')).toBe('place-page')
    expect(classifyCmaOrigin('lead-form')).toBe('lead-form')
    expect(classifyCmaOrigin('admin-manual')).toBe('broker')
    expect(classifyCmaOrigin('crm-kickoff')).toBe('broker')
    expect(classifyCmaOrigin('cli-rebuild')).toBe('internal')
    expect(classifyCmaOrigin('brain-queue')).toBe('internal')
  })

  it('reads the lane-recovery sources the 2026-09-07 backfill writes', () => {
    // The backfill can prove the LANE (the prospect link table reaches the row)
    // but not the trigger — request_source did not exist as a column until
    // 2026-08-27, so a pre-cutover expired row could equally have come from the
    // cron or from the expired dashboard. These tokens say the lane and admit
    // the trigger was never recorded, instead of asserting a cron that may not
    // have built it.
    expect(classifyCmaOrigin('expired-backfill')).toBe('expired')
    expect(classifyCmaOrigin('fsbo-backfill')).toBe('fsbo')
  })

  it('never classifies a `cmas` row as a BPO', () => {
    // BPOs are rows in broker_price_opinions, not cmas — the queue stamps
    // origin 'bpo' on them when it unions them in. No request_source string
    // produces that lane, and inventing one here would make the classifier
    // claim a provenance nothing in the codebase writes.
    expect(classifyCmaOrigin('bpo')).toBe('unknown')
    expect(classifyCmaOrigin('bpo-admin')).toBe('unknown')
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
    expect(sendModeForOrigin('place-page')).toBe('now')
    expect(sendModeForOrigin('lead-form')).toBe('now')
    expect(sendModeForOrigin('broker')).toBe('now')
    // A BPO is a broker asking for the brokerage's own opinion of value — it is
    // never cold outreach, so it never rides the drip.
    expect(sendModeForOrigin('bpo')).toBe('now')
    expect(isAskedOrigin('bpo')).toBe(true)
    expect(sendModeForOrigin('expired')).toBe('drip')
    expect(sendModeForOrigin('fsbo')).toBe('drip')
  })

  it('never puts an unattributed row on a bulk lane', () => {
    // A backfilled row with no provenance must not ride a batch send.
    expect(sendModeForOrigin('unknown')).toBe('manual')
    expect(sendModeForOrigin('internal')).toBe('manual')
  })

  it('asked and cold are mutually exclusive, and every origin has a lane', () => {
    const all: CmaOrigin[] = [
      'expired',
      'fsbo',
      'seller-valuation',
      'place-page',
      'lead-form',
      'bpo',
      'broker',
      'internal',
      'unknown',
    ]
    for (const o of all) {
      expect(isAskedOrigin(o) && isColdOrigin(o)).toBe(false)
      expect(['now', 'drip', 'manual']).toContain(sendModeForOrigin(o))
      expect(CMA_ORIGIN_LABEL[o]).toBeTruthy()
      expect(CMA_ORIGIN_INTENT[o]).toBeTruthy()
    }
  })

  it('labels and explains the place-page origin', () => {
    expect(CMA_ORIGIN_LABEL['place-page']).toBe('Place page')
    expect(CMA_ORIGIN_INTENT['place-page']).toBe(
      'A homeowner on a neighborhood or community page typed their address and asked what it would sell for.',
    )
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
