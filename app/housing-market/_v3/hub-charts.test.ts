import { describe, expect, it } from 'vitest'
import type { MarketPulseSnapshot } from '@/lib/data'
import {
  buildHubRankChart,
  buildHubRelateChart,
  buildHubTimeChart,
  RANK_CHART_CAPTION,
  RELATE_CHART_CAPTION,
  TIME_CHART_CAPTION,
} from './hub-charts'

function city(
  label: string,
  overrides: Partial<MarketPulseSnapshot> = {},
): MarketPulseSnapshot {
  return {
    geo_type: 'city',
    geo_slug: label.toLowerCase(),
    geo_label: label,
    active_count: 100,
    median_list_price: 500000,
    months_of_supply: 5,
    updated_at: '2026-08-29T00:00:00.000Z',
    ...overrides,
  } as MarketPulseSnapshot
}

describe('hub Chart Room series', () => {
  it('names the Time series without leftover labels', () => {
    const chart = buildHubTimeChart([
      { periodStart: '2026-01-01', medianSalePrice: 600000 },
      { periodStart: '2026-02-01', medianSalePrice: 610000 },
      { periodStart: '2025-01-01', medianSalePrice: 580000 },
      { periodStart: '2025-02-01', medianSalePrice: 590000 },
    ])
    expect(chart?.caption).toBe(TIME_CHART_CAPTION)
    expect(String(chart?.caption)).not.toMatch(/leftover/i)
    expect(TIME_CHART_CAPTION).toBe('Median close by month, single-family, Central Oregon')
  })

  it('omits Relate and Rank when fewer than two cities publish the series', () => {
    expect(buildHubRelateChart([city('Bend')])).toBeUndefined()
    expect(buildHubRankChart([city('Bend')])).toBeUndefined()
    expect(buildHubRelateChart([])).toBeUndefined()
    expect(buildHubRankChart([])).toBeUndefined()
  })

  it('plots Relate and Rank when two or more cities publish, with clean captions', () => {
    const snapshots = [
      city('Bend', { months_of_supply: 4.2, median_list_price: 750000 }),
      city('Redmond', { months_of_supply: 6.1, median_list_price: 525000 }),
    ]
    const relate = buildHubRelateChart(snapshots)
    const rank = buildHubRankChart(snapshots)
    expect(relate?.kind).toBe('range')
    expect(relate?.caption).toBe(RELATE_CHART_CAPTION)
    expect(rank?.kind).toBe('range')
    expect(rank?.caption).toBe(RANK_CHART_CAPTION)
    expect(String(relate?.caption)).not.toMatch(/leftover/i)
    expect(String(rank?.caption)).not.toMatch(/leftover/i)
  })
})
