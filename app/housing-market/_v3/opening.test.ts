import { describe, expect, it } from 'vitest'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { buildLiveFigures } from '../[...slug]/_v3/geo-figures'
import { buildRegionFigures } from '../annual-review/_v3/annual-sections'
import { buildRegionInstruments } from '../central-oregon/_v3/region-figures'
import { YEAR_OVERLAY_READING, buildRegionMedianChart } from './market-charts'
import { CLOSED_LEAD_FIGURES, MARKET_FOLD_LABEL, MARKET_LEAD_FIGURES } from './opening'

/**
 * SITE-41. The opening of a market report is a claim and a drawing, not a KPI grid.
 *
 * TASTE.md names the banned tell exactly — "KPI grids: a number, a percentage, and
 * jargon — a figure with no plain sentence beside it saying what it means for the
 * reader" — and on 2026-09-08 the separate evaluator found it on all four market
 * classes at once. The fix lives in three places and every one of them can rot back
 * silently, so every one of them is asserted here.
 *
 * The rule these tests encode: every figure a reader sees BEFORE opening a fold says
 * what it means, in a sentence that carries no second number.
 */

const HUD: LeftoverHudKpis = {
  active: 655,
  pending: 293,
  closed30: 180,
  new30: 210,
  medianList: 939900,
  saleToList: 97.4,
  daysToPending: 24,
  monthsSupply: 3.8,
  sold12mo: 1740,
}

describe('every lead figure says what it means', () => {
  it('the city and community opening: four figures, four sentences', () => {
    const { figures } = buildLiveFigures(HUD, '3.8', 'Bend')
    expect(figures.length).toBeGreaterThanOrEqual(MARKET_LEAD_FIGURES)
    for (const figure of figures.slice(0, MARKET_LEAD_FIGURES)) {
      expect(figure.sentence, String(figure.label)).toBeTruthy()
      expect(String(figure.sentence).length).toBeGreaterThan(20)
    }
  })

  it('the region opening: four figures, four sentences', () => {
    const { live } = buildRegionInstruments(HUD, '4.9', HUD.monthsSupply ?? null)
    expect(live.figures.length).toBeGreaterThanOrEqual(MARKET_LEAD_FIGURES)
    for (const figure of live.figures.slice(0, MARKET_LEAD_FIGURES)) {
      expect(figure.sentence, String(figure.label)).toBeTruthy()
    }
  })

  it('the annual review opening: four figures, four sentences', () => {
    const figures = buildRegionFigures({ active: 1562, daysToPending: 29 }, 4.9, 750000)
    expect(figures).toHaveLength(4)
    for (const figure of figures) {
      expect(figure.sentence, String(figure.label)).toBeTruthy()
    }
  })

  it('a sentence explains its own figure and never smuggles in a second number', () => {
    const all = [
      ...buildLiveFigures(HUD, '3.8', 'Bend').figures,
      ...buildRegionFigures({ active: 1562, daysToPending: 29 }, 4.9, 750000),
    ]
    for (const figure of all) {
      if (!figure.sentence) continue
      // A number in a sentence would be a figure with no label, no door and no trace
      // of its own — section 0's whole objection to an unsourced stat.
      expect(String(figure.sentence), String(figure.label)).not.toMatch(/\d/)
    }
  })
})

describe('the fold names what it reveals', () => {
  it('no fold label carries a bare integer', () => {
    for (const label of [MARKET_FOLD_LABEL]) {
      expect(label).not.toMatch(/\d/)
      expect(label.length).toBeGreaterThan(20)
    }
  })

  it('a closed-sales band caps one lower, because V3Instrument will not fold a single figure', () => {
    // Five figures with a cap of four render all five (the primitive refuses a fold
    // that would hide exactly one). Three is what actually caps the row at four.
    expect(CLOSED_LEAD_FIGURES).toBe(MARKET_LEAD_FIGURES - 1)
  })
})

describe('one marker rule across every series', () => {
  it('the year overlay marks every line, not only the emphasized one', () => {
    const chart = buildRegionMedianChart([
      { periodStart: '2024-01-01', medianSalePrice: 600000 },
      { periodStart: '2024-02-01', medianSalePrice: 610000 },
      { periodStart: '2025-01-01', medianSalePrice: 640000 },
      { periodStart: '2025-02-01', medianSalePrice: 650000 },
      { periodStart: '2026-01-01', medianSalePrice: 660000 },
      { periodStart: '2026-02-01', medianSalePrice: 665000 },
    ])
    expect(chart).toBeTruthy()
    expect(chart?.series?.length).toBe(3)
    // `emphasize` alone gives beads to the current year and bare strokes to the years
    // behind it, which three separate evaluators read as unfinished.
    expect(chart?.marks).toBe(true)
    expect(chart?.emphasize).toBe('last')
    expect(YEAR_OVERLAY_READING.marks).toBe(true)
    expect(YEAR_OVERLAY_READING.restingRead).toBe('last')
    expect(YEAR_OVERLAY_READING.keysToggle).toBe(true)
  })
})
