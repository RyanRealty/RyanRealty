import { describe, expect, it } from 'vitest'
import { compsPriceChartSvg } from '@/lib/cma/comps-price-chart'

describe('compsPriceChartSvg', () => {
  it('draws this house list against the adjusted sales', () => {
    const svg = compsPriceChartSvg({
      comps: [
        { address: '19000 Ceiling Rd', adjustedPrice: 1120000 },
        { address: '19100 Best Match Ln', adjustedPrice: 995000 },
      ],
      recommended: 1050000,
    })
    expect(svg).toContain('<svg')
    expect(svg).toContain('$1,050,000')
    expect(svg).toContain('This list')
    expect(svg).toContain('19000 Ceiling')
    expect(svg).toContain('$995K')
  })

  it('returns empty when there is nothing to plot', () => {
    expect(compsPriceChartSvg({ comps: [], recommended: 655000 })).toBe('')
    expect(compsPriceChartSvg({ comps: [{ address: 'A', adjustedPrice: 1 }], recommended: 0 })).toBe('')
  })
})
