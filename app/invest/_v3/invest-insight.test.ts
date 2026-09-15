import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import { composeInvestInsightPages, investInsightChartPoints } from './invest-insight'

function row(segment: string, activeCount: number | null, extra: Partial<PublicSegmentRow> = {}): PublicSegmentRow {
  return {
    segment,
    activeCount,
    medianList: null,
    monthsOfSupply: null,
    verdict: null,
    pendingCount: extra.pendingCount ?? null,
    closedCount: extra.closedCount ?? 12,
    sampleN: activeCount,
    daysToContract: extra.daysToContract ?? 40,
    saleToOriginal: null,
    yoyMedian: null,
    priceCutShare: null,
  } as PublicSegmentRow
}

const LIVE = [
  row('multifamily_2_4', 46),
  row('commercial_sale', 61),
  row('land', 605),
  row('farm', 41),
  row('business', 8),
]

describe('composeInvestInsightPages', () => {
  it('pages every income type, largest first, shares against the whole', () => {
    const pages = composeInvestInsightPages(LIVE)
    expect(pages.map((p) => p.key)).toEqual([
      'land',
      'commercial_sale',
      'multifamily_2_4',
      'farm',
      'business',
    ])
    expect(pages[0]?.figure).toBe('605')
    expect(pages[0]?.share).toBeCloseTo(605 / 761, 6)
    expect(pages[0]?.shareLabel).toContain('79.5%')
    expect(pages[0]?.href).toContain('/homes-for-sale')
  })

  it('drops a withheld count', () => {
    expect(composeInvestInsightPages([row('land', null), row('farm', 41)])).toEqual([
      expect.objectContaining({ key: 'farm', count: 41 }),
    ])
  })

  it('builds chart points that match the pager titles', () => {
    const pages = composeInvestInsightPages(LIVE)
    const points = investInsightChartPoints(pages)
    expect(points[0]).toEqual({ value: 605, label: '605 lots', tick: 'Lots' })
  })
})

describe('invest catalog import (Tip Ready route scan)', () => {
  it('imports the insight pager from the installed source', () => {
    const src = readFileSync(new URL('./InvestInsight.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/from '@\/components\/motion\/insight-pager'/)
  })
})
