/**
 * The month line says what it is a line OF, when the recommendation sits under
 * every month of it (tasteReview round three, §3).
 */
import { describe, expect, it } from 'vitest'
import { renderInventoryBoardHtml } from '@/lib/cma/market-area-chapters'
import type { CmaMarketContext, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '2465 7th',
  city: 'Redmond',
  beds: 3,
  baths: 2,
  sqft: 1440,
} as unknown as CmaSubject

const months = [530, 512, 498, 505, 488, 476, 470, 481, 492, 466, 461, 474].map((k, i) => ({
  periodStart: `2025-${String((i % 12) + 1).padStart(2, '0')}-01`,
  medianSalePrice: k * 1000,
}))

const market = {
  geoSlug: 'redmond',
  geoLabel: 'Redmond',
  medianDom: 21,
  activeCount: 40,
  monthsOfSupply: 3.2,
  trend: months,
} as unknown as CmaMarketContext

describe('the month line and the recommendation', () => {
  it('names the basis when every month drawn sits above the number', () => {
    const html = renderInventoryBoardHtml(market, { recommended: 435_000, subject })
    expect(html).toContain(
      'This line is the middle sale price of single-family homes in Redmond, all sizes. Yours is priced against 3 bed 2 bath homes near 1,440 square feet.',
    )
  })

  it('says nothing when the recommendation sits inside the line', () => {
    const html = renderInventoryBoardHtml(market, { recommended: 480_000, subject })
    expect(html).not.toContain('all sizes')
  })

  it('says nothing on a board with no price beside it', () => {
    expect(renderInventoryBoardHtml(market)).not.toContain('all sizes')
  })
})
