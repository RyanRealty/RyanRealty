import { describe, expect, it } from 'vitest'
import { buildHubLead, buildSfrFollowFigures } from './hub-sections'

describe('buildSfrFollowFigures — list median digits', () => {
  it('prints the exact leftover SFR median the hub FAQ publishes, not a thousand-round', () => {
    const figures = buildSfrFollowFigures(
      {
        medianList: 729875,
        active: 1200,
        daysToPending: 14,
      },
      '2.1 months',
    )
    const list = figures.find((f) => String(f.label).includes('median list price'))
    expect(list?.value).toBe('$729,875')
    expect(String(list?.value)).not.toContain('$730,000')
  })

  it('orders median list price, homes for sale, months of supply, then days to pending (parity.json market-report requiredComponents)', () => {
    const figures = buildSfrFollowFigures(
      {
        medianList: 729875,
        active: 1200,
        daysToPending: 14,
      },
      '2.1 months',
    )
    expect(figures.map((f) => String(f.label))).toEqual([
      'median list price, single-family',
      'homes for sale, single-family',
      'months of supply, single-family',
      'median to pending · 90 days, single-family',
    ])
  })

  it('omits months of supply when the raw value is absent, never a fabricated figure', () => {
    const figures = buildSfrFollowFigures(
      { medianList: 729875, active: 1200, daysToPending: 14 },
      null,
    )
    expect(figures.some((f) => String(f.label).includes('months of supply'))).toBe(false)
  })
})

describe('buildHubLead, one population one clock (2026-08-27 hero-reorder fix)', () => {
  it('carries no months-of-supply figure any more, that figure moved to buildSfrFollowFigures', () => {
    const lead = buildHubLead({
      geoType: 'region',
      geoSlug: 'central-oregon',
      year: 2025,
      typeScope: 'all',
      soldCount: 5769,
      totalVolume: 4_116_031_220.9,
      medianClose: 585000,
      meanClose: null,
      propertyTypeBreakdown: { A: 4850, D: 719 },
      methodology: 'test',
      source: 'mart',
      computedAt: '2026-08-27T08:15:22.761Z',
    })
    expect(lead.figures.some((f) => String(f.label).includes('months of supply'))).toBe(false)
    expect(lead.closed?.year).toBe(2025)
    expect(lead.source).not.toContain('Months of supply')
  })
})
