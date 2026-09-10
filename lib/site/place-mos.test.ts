import { describe, expect, it } from 'vitest'
import {
  MOS_METHODOLOGY_CLAUSE,
  MOS_PLAIN_LABEL,
  MOS_THRESHOLD_CLAUSE,
} from '@/lib/market/classify'
import {
  PLACE_MOS_MIN_CLOSES,
  buildPlaceMosView,
  monthOfSalesFromHud,
  publishPlaceMos,
} from './place-mos'

describe('monthOfSalesFromHud', () => {
  it('is active / MOS — the rearranged monthly pace', () => {
    expect(monthOfSalesFromHud(658, 3.9)).toBeCloseTo(658 / 3.9, 8)
  })

  it('omits when either side is missing or not a count', () => {
    expect(monthOfSalesFromHud(0, 3.9)).toBeNull()
    expect(monthOfSalesFromHud(658, 0)).toBeNull()
    expect(monthOfSalesFromHud(-1, 3.9)).toBeNull()
    expect(monthOfSalesFromHud(658, Number.NaN)).toBeNull()
  })
})

describe('publishPlaceMos', () => {
  it('publishes leftover HUD inputs when six-month closes clear the floor', () => {
    const out = publishPlaceMos({ active: 658, monthsSupply: 3.9 })
    expect(out).not.toBeNull()
    expect(out!.homesForSale).toBe(658)
    expect(out!.mos).toBe(3.9)
    expect(out!.monthOfSales).toBeCloseTo(658 / 3.9, 8)
    expect(out!.impliedSixMonthCloses).toBeCloseTo((658 * 6) / 3.9, 8)
    expect(out!.impliedSixMonthCloses).toBeGreaterThanOrEqual(PLACE_MOS_MIN_CLOSES)
  })

  it('omits when n is too small to chart (DATA_GRAPHICS: fewer than 6 closes)', () => {
    // 2 homes, 12 months of supply → one close in six months.
    expect(publishPlaceMos({ active: 2, monthsSupply: 12 })).toBeNull()
    expect(publishPlaceMos({ active: 5, monthsSupply: 6 })).toBeNull()
  })

  it('omits when leftover withheld the figure', () => {
    expect(publishPlaceMos({ active: 48, monthsSupply: null })).toBeNull()
    expect(publishPlaceMos({ active: null, monthsSupply: 3.9 })).toBeNull()
    expect(publishPlaceMos({ active: 0, monthsSupply: 3.9 })).toBeNull()
  })

  it('publishes exactly at the six-close floor', () => {
    // active / mos * 6 = 6  →  mos = active
    const out = publishPlaceMos({ active: 6, monthsSupply: 6 })
    expect(out).not.toBeNull()
    expect(out!.impliedSixMonthCloses).toBe(6)
  })
})

describe('buildPlaceMosView', () => {
  it('hands the primitive preformatted bars, a caption that is not a MOS tile, and a tooltip with both counts plus the source line', () => {
    const view = buildPlaceMosView({
      active: 658,
      monthsSupply: 3.9,
      grain: 'city',
      geoSlug: 'bend',
      asOf: 'Sep 9, 2026',
    })
    expect(view).not.toBeNull()
    expect(view!.caption).toBe('About 3.9 months of homes on the market.')
    expect(view!.caption.toLowerCase()).not.toMatch(/\bmos\b/)
    expect(view!.plainLabel).toBe(MOS_PLAIN_LABEL)
    expect(view!.homesName).toBe('Homes for sale')
    expect(view!.salesName).toBe('A month of sales')
    expect(view!.homesLabel).toBe('658')
    expect(view!.salesLabel).toBe('168.7')
    expect(view!.homesValue).toBe(658)
    expect(view!.salesValue).toBeCloseTo(168.7, 1)
    expect(view!.asOf).toBe('Sep 9, 2026')
    expect(view!.tooltip.homes).toBe('658')
    expect(view!.tooltip.sales).toBe('168.7')
    expect(view!.tooltip.source).toContain('Oregon Data Share')
    expect(view!.tooltip.source).toContain('leftoverHudKpis')
    expect(view!.tooltip.source).toContain('city:bend')
    expect(view!.tooltip.source).toContain('as of Sep 9, 2026')
    expect(view!.source).toContain(MOS_METHODOLOGY_CLAUSE)
    expect(view!.source).toContain(MOS_THRESHOLD_CLAUSE)
    expect(view!.source).toContain('updated Sep 9, 2026')
  })

  it('omits rather than inventing a thin neighborhood drawing', () => {
    expect(
      buildPlaceMosView({
        active: 3,
        monthsSupply: 48,
        grain: 'neighborhood',
        geoSlug: 'bend-century-west',
        asOf: 'Sep 9, 2026',
      }),
    ).toBeNull()
  })
})
