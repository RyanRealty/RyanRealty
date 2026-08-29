import { describe, expect, it } from 'vitest'
import {
  alignHubFaqWindows,
  buildHubLead,
  buildSfrFollowFigures,
  CITY_LEDGER_TRACE,
  hubMarketTrace,
} from './hub-sections'

describe('buildSfrFollowFigures — list median digits', () => {
  it('prints the exact SFR median the hub FAQ publishes, not a thousand-round', () => {
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

  it('orders the decision set: list, inventory, supply, days to pending', () => {
    const figures = buildSfrFollowFigures(
      {
        medianList: 729875,
        active: 1200,
        daysToPending: 14,
      },
      '2.1 months',
    )
    expect(figures.map((f) => String(f.label))).toEqual([
      'median list price · now, single-family',
      'homes for sale · now, single-family',
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

  it('strips at least from mix headline numbers and keeps the floor in the source', () => {
    const figures = buildSfrFollowFigures(
      { medianList: 729875, active: 1200, daysToPending: 14 },
      '5.4 months',
      {
        mix: {
          financing: [],
          features: [{ key: 'cooling_yn', share: 0.84, floor: true }],
          bedrooms: [],
        },
      },
    )
    const cooling = figures.find((f) => String(f.label).includes('cooling'))
    expect(cooling?.value).toBe('84.0%')
    expect(String(cooling?.value)).not.toMatch(/at least/)
    expect(hubMarketTrace({ hasMos: true, hasFloorMix: true })).toMatch(/at least that share/)
  })
})

describe('hub traces', () => {
  it('names Oregon Data Share MLS and a window, not leftover membership', () => {
    const trace = hubMarketTrace({ hasMos: false, hasFloorMix: false })
    expect(trace).toMatch(/Oregon Data Share MLS/)
    expect(trace).toMatch(/Central Oregon/)
    expect(trace).toMatch(/single-family/)
    expect(trace).not.toMatch(/leftover/i)
    expect(CITY_LEDGER_TRACE).not.toMatch(/leftover/i)
  })
})

describe('alignHubFaqWindows', () => {
  it('labels the list median as now and days-to-pending as 90 days', () => {
    const faqs = alignHubFaqWindows([
      {
        question: 'What is the median home price in Central Oregon?',
        answer:
          'The median list price for a single-family home in Central Oregon is $729,875 as of August 29, 2026, based on a direct count of the active MLS listings.',
      },
      {
        question: 'How long do homes take to sell in Central Oregon?',
        answer: 'Single-family homes in Central Oregon took a median of 14 days to go pending as of August 29, 2026.',
      },
    ])
    expect(faqs[0]?.answer).toContain('is $729,875 now, from the active list, based on')
    expect(faqs[0]?.answer).not.toMatch(/leftover/i)
    expect(faqs[1]?.answer).toContain('to go pending over the last 90 days')
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
