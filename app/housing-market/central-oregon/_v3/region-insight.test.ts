import { describe, expect, it } from 'vitest'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import type { MedianMonth } from '../../_v3/market-charts'
import {
  buildRegionInsightBoard,
  insightDelta,
  regionInsightDatasetVariables,
  regionInsightFaqs,
  regionInsightPageCount,
  regionInsightTemporalCoverage,
} from './region-insight'

/**
 * SITE-103. The board behind the fold's InsightCards.
 *
 * What these tests are FOR: the three cards publish figures, a meta
 * description, three FAQ answers and five Dataset variables off one object, so
 * the thing that must never break is that the object refuses to invent. Every
 * case below is a shape the live rows actually produce — a short history, a
 * cache path with no closing counts, a mart year with one property type.
 */

function months(count: number, opts: { closings?: boolean } = {}): MedianMonth[] {
  const out: MedianMonth[] = []
  for (let i = 0; i < count; i += 1) {
    const month = i % 12
    const year = 2024 + Math.floor(i / 12)
    out.push({
      periodStart: `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00.000Z`,
      medianSalePrice: 600_000 + i * 1_000,
      soldCount: opts.closings === false ? null : 200 + i,
    })
  }
  return out
}

const HUD: LeftoverHudKpis = {
  active: 1_493,
  pending: 537,
  medianList: 749_500,
  monthsSupply: 4.55,
  daysToPending: 29,
} as unknown as LeftoverHudKpis

function martYear(year: number, breakdown: Record<string, number>): CoMarketAnnualRow {
  const soldCount = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return {
    geoType: 'region',
    geoSlug: 'central-oregon',
    year,
    typeScope: 'all',
    soldCount,
    totalVolume: soldCount * 600_000,
    medianClose: 600_000,
    meanClose: 640_000,
    propertyTypeBreakdown: breakdown,
    methodology: 'v1',
    source: 'mart',
    computedAt: '2026-09-01T00:00:00.000Z',
  }
}

describe('region insight board', () => {
  it('publishes three pages when every population answers', () => {
    const board = buildRegionInsightBoard({
      monthly: months(30),
      closedSeries: [martYear(2025, { A: 5_000, D: 490, F: 60 })],
      hud: HUD,
    })
    expect(regionInsightPageCount(board)).toBe(3)
    expect(board.compare?.cells).toHaveLength(12)
    expect(board.compare?.priorCells).toHaveLength(12)
    expect(board.pace?.closings).toHaveLength(12)
    expect(board.mix?.segments.length).toBeGreaterThanOrEqual(2)
  })

  it('omits Compare rather than drawing two windows of unequal length', () => {
    // Eighteen months is enough for ONE window and half of another. A compare
    // card built on that reads one month against nothing, so it is absent.
    const board = buildRegionInsightBoard({
      monthly: months(18),
      closedSeries: [],
      hud: HUD,
    })
    expect(board.compare).toBeNull()
    expect(board.pace).not.toBeNull()
  })

  it('omits the pace page when the rows carry no closing counts (absent is not zero)', () => {
    const board = buildRegionInsightBoard({
      monthly: months(30, { closings: false }),
      closedSeries: [],
      hud: HUD,
    })
    expect(board.pace).toBeNull()
    expect(board.compare).not.toBeNull()
  })

  it('omits the mix page when one property type is the whole year', () => {
    const board = buildRegionInsightBoard({
      monthly: months(30),
      closedSeries: [martYear(2025, { A: 5_000 })],
      hud: HUD,
    })
    expect(board.mix).toBeNull()
  })

  it('never names a mart year it did not read', () => {
    const board = buildRegionInsightBoard({
      monthly: months(30),
      closedSeries: [],
      hud: HUD,
    })
    expect(board.mix).toBeNull()
    expect(regionInsightFaqs(board).some((faq) => /\d{4}/.test(faq.question))).toBe(false)
  })

  it('gives every published figure a Dataset variable, and nothing else', () => {
    const board = buildRegionInsightBoard({
      monthly: months(30),
      closedSeries: [martYear(2025, { A: 5_000, D: 490, F: 60 })],
      hud: HUD,
    })
    const vars = regionInsightDatasetVariables(board)
    const recent = board.compare!.cells.at(-1)!
    expect(vars.find((v) => v.name.includes(recent.label))?.value).toBe(recent.median)
    expect(vars).toHaveLength(5)

    const empty = buildRegionInsightBoard({ monthly: [], closedSeries: [], hud: HUD })
    expect(regionInsightDatasetVariables(empty)).toHaveLength(0)
    expect(regionInsightTemporalCoverage(empty)).toBeNull()
  })

  it('covers exactly the window the cards draw', () => {
    const board = buildRegionInsightBoard({
      monthly: months(30),
      closedSeries: [],
      hud: HUD,
    })
    const first = board.compare!.priorCells[0]!
    const last = board.compare!.cells.at(-1)!
    expect(regionInsightTemporalCoverage(board)).toBe(`${first.key}/${last.key}`)
  })

  it('answers the FAQ in a visitor’s words, with the source named', () => {
    const board = buildRegionInsightBoard({
      monthly: months(30),
      closedSeries: [martYear(2025, { A: 5_000, D: 490, F: 60 })],
      hud: HUD,
    })
    const faqs = regionInsightFaqs(board)
    expect(faqs).toHaveLength(3)
    for (const faq of faqs) {
      expect(faq.answer).not.toContain('\u2014')
      expect(faq.answer).toMatch(/Oregon Data Share/)
      // No pipeline vocabulary in anything a visitor reads (SITE-88 jargon rule).
      expect(faq.question).not.toMatch(
        /leftover|sample-gated|MarketPulse|metric layer|geo_type|property_sub_type/i,
      )
      expect(faq.answer).not.toMatch(
        /leftover|sample-gated|MarketPulse|metric layer|geo_type|property_sub_type/i,
      )
    }
  })

  it('signs a percent change and calls a flat month flat', () => {
    expect(insightDelta(110, 100)).toBe('+10.0%')
    expect(insightDelta(90, 100)).toBe('−10.0%')
    expect(insightDelta(100, 100)).toBe('0.0%')
    expect(insightDelta(100, 0)).toBeNull()
  })
})
