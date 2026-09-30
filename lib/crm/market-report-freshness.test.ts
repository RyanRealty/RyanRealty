import { describe, it, expect } from 'vitest'
import { describeStaleSources, findStaleSources, MARKET_DATA_MAX_AGE_HOURS } from './market-report-freshness'
import type { MarketReportAreaBlock, MarketReportProvenance } from '@/lib/data/crm/getMarketReportData'

const NOW = new Date('2026-09-29T22:00:00Z')

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3_600_000).toISOString()
}

function block(provenance: MarketReportProvenance | null, over: Partial<MarketReportAreaBlock> = {}): MarketReportAreaBlock {
  return {
    slug: 'bend',
    areaLabel: 'Bend',
    geoType: 'city',
    medianPrice: 721000,
    activeListings: 480,
    soldLast12mo: 1657,
    monthsOfSupply: 3.5,
    marketVerdict: 'sellers',
    domMedian: 25,
    yoyPct: -1.2,
    marketHealthLabel: null,
    refreshedAt: null,
    source: 'market_metric',
    twelveMonthSource: 'market-truth',
    href: '/cities/bend',
    provenance,
    ...over,
  } as MarketReportAreaBlock
}

function cell(computedAt: string) {
  return { computedAt, completeThrough: computedAt.slice(0, 10), sampleN: 100, definitionId: 'd1' } as never
}

function prov(o: { cache?: number | null; live?: number | null; twelve?: number | null }): MarketReportProvenance {
  return {
    cache:
      o.cache == null
        ? null
        : { updatedAt: hoursAgo(o.cache), periodStart: null, periodEnd: null, soldCount: 1657, methodologyVersion: 'v3-2026-05-07' },
    live: o.live == null ? null : { table: 'market_metric', computedAt: hoursAgo(o.live), completeThrough: null },
    twelveMonth:
      o.twelve == null
        ? null
        : { medianClose: cell(hoursAgo(o.twelve)), closedCount: cell(hoursAgo(o.twelve)), yoyMedian: cell(hoursAgo(o.twelve)) },
  }
}

describe('findStaleSources (a report never mails numbers older than it says)', () => {
  it('the threshold is 30 hours: one daily refresh plus a 6-hour grace', () => {
    expect(MARKET_DATA_MAX_AGE_HOURS).toBe(30)
  })

  it('a report with every clock inside a day is fresh', () => {
    expect(findStaleSources([block(prov({ cache: 15, live: 16, twelve: 16 }))], NOW)).toEqual([])
  })

  it('holds on a market_stats_cache row older than 30 hours (a missed 07:00 UTC run)', () => {
    const stale = findStaleSources([block(prov({ cache: 33, live: 2, twelve: 2 }))], NOW)
    expect(stale).toHaveLength(1)
    expect(stale[0]).toMatchObject({ area: 'bend', source: 'market_stats_cache', ageHours: 33 })
  })

  it('holds on a stale live inventory clock and on a stale Market Truth cell', () => {
    const stale = findStaleSources([block(prov({ cache: 2, live: 40, twelve: 50 }))], NOW)
    expect(stale.map((s) => s.source).sort()).toEqual(['market_metric', 'market_metric'])
  })

  it('a printed figure with no clock at all is held (fail closed)', () => {
    const p = prov({ cache: 2, live: 2, twelve: 2 })
    p.cache = { updatedAt: null, periodStart: null, periodEnd: null, soldCount: null, methodologyVersion: null }
    const stale = findStaleSources([block(p)], NOW)
    expect(stale).toEqual([{ area: 'bend', source: 'market_stats_cache', asOf: null, ageHours: null }])
  })

  it('names each stale source and its age for the held row', () => {
    const stale = findStaleSources([block(prov({ cache: 33.04, live: 2, twelve: 2 }))], NOW)
    expect(describeStaleSources(stale)).toBe(`bend market_stats_cache ${hoursAgo(33.04)} (33h old)`)
  })
})
