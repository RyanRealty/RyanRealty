import { describe, it, expect } from 'vitest'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import {
  buildAllTypeFigures,
  buildCompositionFigures,
  closedMartRow,
  compositionParts,
  pickLatestMartYear,
  volumeCompact,
  volumeSentence,
} from './closed-kpis'

// Fixture matches the live analytics_mart_market_annual region/all row verified
// 2026-08-27 (CLAUDE.md section 0): sold_count 5,769, total_volume
// $4,116,031,220.90, median_close $585,000, computed_at 2026-08-27T08:15:22.761Z.
// 2025 is the derived truth per ../_v3/hub-constants.ts CLOSED_SALES_YEAR and
// ./region-constants.ts CLOSED_SALES_TO_YEAR, both last full calendar year.
function mart(partial: Partial<CoMarketAnnualRow>): CoMarketAnnualRow {
  return {
    geoType: 'region',
    geoSlug: 'central-oregon',
    year: 2025,
    typeScope: 'all',
    soldCount: 5769,
    totalVolume: 4_116_031_220.9,
    medianClose: 585000,
    meanClose: null,
    propertyTypeBreakdown: { A: 4850, B: 200, D: 719 },
    methodology: 'test',
    source: 'mart',
    computedAt: '2026-08-27T08:15:22.761Z',
    ...partial,
  }
}

describe('volumeCompact', () => {
  it('prints the 2025 mart volume as $4.116B, not $4.12B', () => {
    expect(volumeCompact(4_116_031_220.9)).toBe('$4.116B')
  })

  it('returns empty for zero or non-finite so callers cannot print a fake zero', () => {
    expect(volumeCompact(0)).toBe('')
    expect(volumeCompact(Number.NaN)).toBe('')
  })
})

describe('volumeSentence', () => {
  it('spells the same 2025 figure for FAQ copy', () => {
    expect(volumeSentence(4_116_031_220.9)).toBe('$4.116 billion')
  })
})

describe('closedMartRow', () => {
  it('keeps a present mart year and drops missing or zero rows', () => {
    expect(closedMartRow(mart({}))?.soldCount).toBe(5769)
    expect(closedMartRow(mart({ source: 'missing', soldCount: 0, totalVolume: 0 }))).toBeNull()
    expect(closedMartRow(null)).toBeNull()
  })
})

describe('compositionParts', () => {
  it('omits zero types and does not invent a row from an empty object', () => {
    expect(compositionParts({ A: 4850, B: 0, D: 600 }).map((p) => p.code)).toEqual(['A', 'D'])
    expect(compositionParts({})).toEqual([])
    expect(compositionParts(undefined)).toEqual([])
  })
})

describe('buildAllTypeFigures and buildCompositionFigures', () => {
  it('labels volume and closes as every type and composition with labelPropertyType', () => {
    const allType = buildAllTypeFigures({
      soldCount: 5769,
      totalVolume: 4_116_031_220.9,
      historyHref: '/housing-market/history?year=2025',
    })
    expect(allType.map((f) => f.label)).toEqual(['Closed volume, every type', 'Closed sales, every type'])
    expect(allType[0]?.value).toBe('$4.116B')
    expect(allType[1]?.value).toBe('5,769')

    const composition = buildCompositionFigures({
      parts: compositionParts({ A: 4850, D: 719 }),
      historyHref: '/housing-market/history?year=2025',
    })
    expect(composition.map((f) => f.label)).toEqual([
      'All residential closes',
      'Land closes',
    ])
    expect(composition[0]?.href).toBe('/housing-market/history?year=2025&type=A')
  })
})

describe('pickLatestMartYear', () => {
  it('returns the newest present mart year', () => {
    const latest = pickLatestMartYear([
      mart({ year: 2024, soldCount: 5707 }),
      mart({ year: 2025 }),
      mart({ year: 2023, source: 'missing', soldCount: 0, totalVolume: 0 }),
    ])
    expect(latest?.year).toBe(2025)
    expect(pickLatestMartYear([])).toBeNull()
  })
})
