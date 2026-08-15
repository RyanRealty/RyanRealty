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

function mart(partial: Partial<CoMarketAnnualRow>): CoMarketAnnualRow {
  return {
    geoType: 'region',
    geoSlug: 'central-oregon',
    year: 2024,
    typeScope: 'all',
    soldCount: 5707,
    totalVolume: 3_931_000_000,
    medianClose: 570000,
    meanClose: null,
    propertyTypeBreakdown: { A: 4850, B: 200, D: 600 },
    methodology: 'test',
    source: 'mart',
    computedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('volumeCompact', () => {
  it('prints the 2024 mart volume as $3.931B, not $3.93B', () => {
    expect(volumeCompact(3_931_000_000)).toBe('$3.931B')
  })

  it('returns empty for zero or non-finite so callers cannot print a fake zero', () => {
    expect(volumeCompact(0)).toBe('')
    expect(volumeCompact(Number.NaN)).toBe('')
  })
})

describe('volumeSentence', () => {
  it('spells the same 2024 figure for FAQ copy', () => {
    expect(volumeSentence(3_931_000_000)).toBe('$3.931 billion')
  })
})

describe('closedMartRow', () => {
  it('keeps a present mart year and drops missing or zero rows', () => {
    expect(closedMartRow(mart({}))?.soldCount).toBe(5707)
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
  it('labels volume and closes ALL-TYPE and composition with labelPropertyType', () => {
    const allType = buildAllTypeFigures({
      soldCount: 5707,
      totalVolume: 3_931_000_000,
      historyHref: '/housing-market/history?year=2024',
    })
    expect(allType.map((f) => f.label)).toEqual(['ALL-TYPE volume', 'ALL-TYPE closes'])
    expect(allType[0]?.value).toBe('$3.931B')
    expect(allType[1]?.value).toBe('5,707')

    const composition = buildCompositionFigures({
      parts: compositionParts({ A: 4850, D: 600 }),
      historyHref: '/housing-market/history?year=2024',
    })
    expect(composition.map((f) => f.label)).toEqual([
      'Single-family / residential closes',
      'Land closes',
    ])
    expect(composition[0]?.href).toBe('/housing-market/history?year=2024&type=A')
  })
})

describe('pickLatestMartYear', () => {
  it('returns the newest present mart year', () => {
    const latest = pickLatestMartYear([
      mart({ year: 2023, soldCount: 5000 }),
      mart({ year: 2024 }),
      mart({ year: 2022, source: 'missing', soldCount: 0, totalVolume: 0 }),
    ])
    expect(latest?.year).toBe(2024)
    expect(pickLatestMartYear([])).toBeNull()
  })
})
