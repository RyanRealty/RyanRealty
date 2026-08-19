import { describe, expect, it } from 'vitest'
import type { MarketPulse } from '@/lib/data'
import { buildSfrFollowFigures } from './hub-sections'

function pulse(overrides: Partial<MarketPulse>): MarketPulse {
  return {
    geoType: 'region',
    geoSlug: 'central-oregon',
    activeCount: 1200,
    medianListPrice: 729875,
    newThisWeek: 0,
    priceDropsThisWeek: 0,
    closedLast30Days: 0,
    monthsOfSupply: 4.1,
    medianDaysToPending: 14,
    refreshedAt: '2026-08-19T00:00:00Z',
    ...overrides,
  }
}

describe('buildSfrFollowFigures — list median digits', () => {
  it('prints the exact SFR pulse median the hub FAQ publishes, not a thousand-round', () => {
    const figures = buildSfrFollowFigures(pulse({ medianListPrice: 729875 }))
    const list = figures.find((f) => String(f.label).includes('median list price'))
    expect(list?.value).toBe('$729,875')
    expect(String(list?.value)).not.toContain('$730,000')
  })
})
