/**
 * Failed-ask haircut vs the letter hero band.
 *
 * Nugget (cma-19815-nugget): last ask $725k sits below the sales. The
 * haircut is skipped and the recommendation pins to the band LOW.
 * Production rebuild: band $734k–$1,285k, midpoint $1,036k — that rec
 * failed expired-list-cap (rec > ask). Pin to $734k and the contract
 * becomes rec <= valueLow.
 *
 * Murphy (cma-20506-murphy): range $693k–$735k, last ask $729k (inside),
 * rec $716k. Unchanged.
 *
 * Ask above the range: existing p75 haircut still binds.
 */
import { describe, expect, it } from 'vitest'
import {
  applyFailedAskCap,
  FAILED_ASK_BACKTEST,
  failedAskBelowRangeNote,
} from '@/lib/cma/expired-audit'
import { whatItsWorthLead } from '@/lib/cma/render-pricing-page'
import { applyEngineRecommendedList } from '@/lib/pricing/estimate'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'

const recentOff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()

function pricing(over: Partial<CmaPricing> = {}): Pick<
  CmaPricing,
  | 'conservative'
  | 'recommended'
  | 'highEnd'
  | 'valueLow'
  | 'valueHigh'
  | 'needsReview'
  | 'reviewReason'
  | 'notes'
  | 'clamp'
  | 'priceOverride'
  | 'failedAskBelowRange'
> {
  return {
    conservative: 0,
    recommended: 0,
    highEnd: 0,
    valueLow: 0,
    valueHigh: 0,
    needsReview: false,
    reviewReason: null,
    notes: [],
    priceOverride: null,
    ...over,
  }
}

const NUGGET = {
  valueLow: 734_000,
  valueHigh: 878_000,
  conservative: 734_000,
  recommended: 803_000,
  highEnd: 878_000,
  lastAsk: 725_000,
} as const

const MURPHY = {
  valueLow: 693_000,
  valueHigh: 735_000,
  conservative: 693_000,
  recommended: 803_000,
  highEnd: 735_000,
  lastAsk: 729_000,
} as const

describe('failed-ask haircut vs the hero band', () => {
  it('Nugget shape: ask below the range, rec pins to the band low (not midpoint, not $712k)', () => {
    const x = pricing({
      conservative: NUGGET.conservative,
      recommended: NUGGET.recommended,
      highEnd: NUGGET.highEnd,
      valueLow: NUGGET.valueLow,
      valueHigh: NUGGET.valueHigh,
    })
    const r = applyFailedAskCap(x, {
      lastFailedListPrice: NUGGET.lastAsk,
      offMarketDate: recentOff,
    })

    // Old path: 725_000 × 0.982 → 712_000. That is the haircut bug.
    const oldHaircut = Math.round((NUGGET.lastAsk * FAILED_ASK_BACKTEST.closeP75Ratio) / 1000) * 1000
    expect(oldHaircut).toBe(712_000)
    expect(r.applied).toBe(false)
    expect(r.belowRange).toBe(true)
    expect(x.failedAskBelowRange).toBe(true)
    expect(x.recommended).toBe(NUGGET.valueLow)
    expect(x.recommended).toBe(734_000)
    expect(x.recommended).not.toBe(803_000)
    expect(x.recommended).not.toBe(712_000)
    expect(x.clamp).toBeNull()
    expect(x.notes.join(' ')).toContain(failedAskBelowRangeNote(NUGGET.lastAsk))
    expect(failedAskBelowRangeNote(NUGGET.lastAsk)).not.toMatch(/[—–]/)
  })

  it('Nugget production rebuild: ask $725k, band $734k–$1,285k, rec $734k, contract passes', () => {
    const valueLow = 734_000
    const valueHigh = 1_285_000
    const midpoint = 1_036_000
    const x = pricing({
      conservative: valueLow,
      recommended: midpoint,
      highEnd: valueHigh,
      valueLow,
      valueHigh,
    })
    applyFailedAskCap(x, {
      lastFailedListPrice: 725_000,
      offMarketDate: recentOff,
    })
    expect(x.failedAskBelowRange).toBe(true)
    expect(x.recommended).toBe(734_000)
    expect(x.recommended).not.toBe(midpoint)
    expect(x.notes.join(' ')).toContain(failedAskBelowRangeNote(725_000))
  })

  it('Murphy shape: ask inside the range, recommended stays $716k', () => {
    const x = pricing({
      conservative: MURPHY.conservative,
      recommended: MURPHY.recommended,
      highEnd: MURPHY.highEnd,
      valueLow: MURPHY.valueLow,
      valueHigh: MURPHY.valueHigh,
    })
    const r = applyFailedAskCap(x, {
      lastFailedListPrice: MURPHY.lastAsk,
      offMarketDate: recentOff,
    })

    expect(r.applied).toBe(true)
    expect(r.belowRange).toBeFalsy()
    expect(x.failedAskBelowRange).toBe(false)
    expect(x.recommended).toBe(716_000)
    expect(x.recommended).toBeGreaterThanOrEqual(MURPHY.valueLow)
    expect(x.recommended).toBeLessThanOrEqual(MURPHY.valueHigh)
    expect(x.recommended).toBe(
      Math.round((MURPHY.lastAsk * FAILED_ASK_BACKTEST.closeP75Ratio) / 1000) * 1000,
    )
  })

  it('ask above the range: existing p75 haircut still binds', () => {
    const x = pricing({
      conservative: 693_000,
      recommended: 850_000,
      highEnd: 900_000,
      valueLow: 693_000,
      valueHigh: 735_000,
    })
    const ask = 800_000
    const r = applyFailedAskCap(x, { lastFailedListPrice: ask, offMarketDate: recentOff })
    const expected = Math.round((ask * FAILED_ASK_BACKTEST.closeP75Ratio) / 1000) * 1000
    expect(expected).toBe(786_000)
    expect(r.applied).toBe(true)
    expect(x.failedAskBelowRange).toBe(false)
    expect(x.recommended).toBe(786_000)
    expect(x.recommended).toBeLessThan(ask)
  })

  it('engine cover on the Nugget shape does not clip to the failed ask', () => {
    const board = pricing({
      conservative: NUGGET.conservative,
      recommended: NUGGET.recommended,
      highEnd: NUGGET.highEnd,
      valueLow: NUGGET.valueLow,
      valueHigh: NUGGET.valueHigh,
    }) as CmaPricing
    const cover = applyEngineRecommendedList(
      board,
      {
        recommendedList: NUGGET.recommended,
        predictedClose: 803_000,
        conservativeList: NUGGET.conservative,
        highEndList: NUGGET.highEnd,
        source: 'comps',
      },
      { failedAsk: NUGGET.lastAsk },
    )
    expect(cover.recommended).toBe(NUGGET.valueLow)
    expect(cover.recommended).toBe(734_000)
    expect(cover.failedAskBelowRange).toBe(true)
    expect(cover.failedAskCapped).toBe(true)
  })

  it('pricing beat names the under-ask when the flag is set', () => {
    const lead = whatItsWorthLead(
      { streetAddress: '19815 Nugget', standardStatus: 'Expired', lastListPrice: NUGGET.lastAsk } as CmaSubject,
      {
        conservative: NUGGET.conservative,
        recommended: NUGGET.recommended,
        highEnd: NUGGET.highEnd,
        valueLow: NUGGET.valueLow,
        valueHigh: NUGGET.valueHigh,
        failedAsk: NUGGET.lastAsk,
        failedAskBelowRange: true,
        notes: [],
      } as unknown as CmaPricing,
    )
    expect(lead).toContain('The sales support $734,000 to $878,000.')
    expect(lead).toContain(failedAskBelowRangeNote(NUGGET.lastAsk))
    expect(lead).not.toMatch(/[—–]/)
  })

  it('a broker override with a note may sit below the band', () => {
    const x = pricing({
      conservative: 700_000,
      recommended: 700_000,
      highEnd: 734_000,
      valueLow: 734_000,
      valueHigh: 878_000,
      priceOverride: 700_000,
      reviewReason: 'The recommended list price reflects a broker adjustment applied on review.',
    })
    const r = applyFailedAskCap(x, {
      lastFailedListPrice: 800_000,
      offMarketDate: recentOff,
    })
    expect(r.applied).toBe(false)
    expect(x.recommended).toBe(700_000)
    expect(x.recommended).toBeLessThan(NUGGET.valueLow)
    expect(x.failedAskBelowRange).toBe(false)
  })
})
