import { describe, expect, it } from 'vitest'
import type { MarketPulse } from '@/lib/data'
import { buildLiveFigures } from './geo-figures'

function pulse(overrides: Partial<MarketPulse>): MarketPulse {
  return {
    geoType: 'city',
    geoSlug: 'madras',
    activeCount: 47,
    medianListPrice: 399900,
    newThisWeek: 0,
    priceDropsThisWeek: 0,
    closedLast30Days: 0,
    monthsOfSupply: 4.9,
    medianDaysToPending: null,
    refreshedAt: '2026-08-19T00:00:00Z',
    ...overrides,
  }
}

describe('buildLiveFigures — list median digits', () => {
  it('Madras: prints the exact pulse median the FAQ publishes, not a thousand-round', () => {
    const live = buildLiveFigures(pulse({ medianListPrice: 399900 }), '4.9', 'Madras')
    const list = live.figures.find((f) => String(f.label).includes('median list price'))
    expect(list?.value).toBe('$399,900')
    expect(String(list?.value)).not.toContain('$400,000')
  })
})
