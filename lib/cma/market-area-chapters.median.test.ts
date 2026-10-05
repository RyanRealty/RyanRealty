/**
 * One printed offer median. The chart tick and the "inside N days" sentences
 * read the same figure: offer-timing median when that block has one, otherwise
 * the city medianDom. 26 and 25 on the same market is the split this locks.
 */
import { describe, expect, it } from 'vitest'
import { renderDaysToOfferHtml, renderInventoryBoardHtml, renderOfferTimingHtml } from '@/lib/cma/market-area-chapters'
import type { CmaAdjustedComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

const offerTiming = {
  city: 'Bend',
  windowMonths: 12,
  n: 188,
  medianDays: 26,
  points: [
    { days: 7, pct: 34 },
    { days: 14, pct: 55 },
    { days: 30, pct: 72 },
  ],
}

const market = {
  geoLabel: 'Bend',
  medianDom: 25,
  offerTiming,
} as unknown as CmaMarketContext

const subject = {
  streetAddress: '10 NW Test Ave',
  city: 'Bend',
  standardStatus: 'Active',
} as unknown as CmaSubject

function comp(address: string, daysToOffer: number): CmaAdjustedComp {
  return { address, daysToOffer } as unknown as CmaAdjustedComp
}

describe('printed offer median', () => {
  it('uses 26 from offer timing on the chart and in the prose, not medianDom 25', () => {
    const chart = renderDaysToOfferHtml({
      subject,
      comps: [comp('1 Oak St', 10), comp('2 Oak St', 18), comp('3 Oak St', 40)],
      market,
    })
    const prose = renderInventoryBoardHtml(market)
    const timing = renderOfferTimingHtml({ market, subject })
    expect(chart).toContain('Bend median 26 days')
    expect(chart).toContain('median is 26')
    expect(chart).not.toContain('median 25')
    expect(chart).not.toContain('median is 25')
    expect(prose).toContain('Half of the homes that sold had an accepted offer inside 26 days.')
    expect(prose).not.toContain('inside 25 days')
    expect(timing).toContain('Half of the 188 homes that sold in Bend had an offer inside 26 days.')
    expect(timing).not.toContain('inside 25 days')
  })
})