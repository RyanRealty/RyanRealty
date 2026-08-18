import { describe, expect, it } from 'vitest'
import { listingTrendSvg, medianCloseLineSvg } from '@/lib/cma/market-charts'

describe('labeled market charts', () => {
  it('prints a caption and dollar ends on the sold line', () => {
    const html = medianCloseLineSvg(
      [1, 2, 3, 4, 5, 6].map((m) => ({
        periodStart: `2026-0${m}-01`,
        medianSalePrice: 400000 + m * 5000,
        soldCount: 10,
      })),
    )
    expect(html).toContain('Median sold by month')
    expect(html).toContain('$405,000')
    expect(html).toContain('Jan')
    expect(html).toContain('Jun')
  })

  it('splits new listings and ask into two labeled charts', () => {
    const html = listingTrendSvg(
      [1, 2, 3, 4, 5].map((m) => ({
        month: `2026-0${m}-01`,
        newListings: 8 + m,
        medianAsk: 500000 + m * 10000,
      })),
    )
    expect(html).toContain('New listings by month')
    expect(html).toContain('Median ask by month')
    expect(html).not.toMatch(/Solid line is new listings/)
  })
})
