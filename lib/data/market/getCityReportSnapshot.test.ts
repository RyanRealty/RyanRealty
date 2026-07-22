import { describe, it, expect } from 'vitest'
import {
  buildCityReportSnapshot,
  citySlugCandidates,
  cityUrlSlug,
  hasReportSignal,
} from './getCityReportSnapshot'

const pulse = {
  activeCount: 500,
  medianListPrice: 815_000,
  monthsOfSupply: 4.1,
  closedLast30Days: 92,
  medianDaysToPending: 38,
  refreshedAt: '2026-07-22T10:00:00Z',
}

const detail = {
  medianSalePrice: 780_000,
  soldCount: 1_240,
  medianDom: 41,
  yoyMedianPriceDeltaPct: 2.1,
  periodStart: '2025-07-22',
  periodEnd: '2026-07-21',
  updatedAt: '2026-07-22T06:00:00Z',
}

describe('citySlugCandidates', () => {
  it('returns space-separated first (the live city-page spelling), hyphenated second', () => {
    expect(citySlugCandidates('La Pine')).toEqual(['la pine', 'la-pine'])
  })

  it('single-word cities collapse to one candidate', () => {
    expect(citySlugCandidates('Bend')).toEqual(['bend'])
  })
})

describe('cityUrlSlug', () => {
  it('hyphenates for /cities/<slug> links', () => {
    expect(cityUrlSlug('La Pine')).toBe('la-pine')
    expect(cityUrlSlug('Bend')).toBe('bend')
  })
})

describe('buildCityReportSnapshot', () => {
  it('keeps live and trailing-12-month figures in separate labeled blocks', () => {
    const snap = buildCityReportSnapshot({ cityLabel: 'Bend', geoSlug: 'bend', pulse, detail })
    expect(snap).not.toBeNull()
    expect(snap!.live).toEqual({
      activeCount: 500,
      medianListPrice: 815_000,
      monthsOfSupply: 4.1,
      closedLast30Days: 92,
      medianDaysToPending: 38,
      refreshedAt: '2026-07-22T10:00:00Z',
    })
    expect(snap!.trailing12mo).toEqual({
      medianSalePrice: 780_000,
      soldCount: 1_240,
      medianDom: 41,
      yoyMedianPriceDeltaPct: 2.1,
      periodStart: '2025-07-22',
      periodEnd: '2026-07-21',
      updatedAt: '2026-07-22T06:00:00Z',
    })
    expect(snap!.urlSlug).toBe('bend')
  })

  it('carries the cache row period bounds as date-only strings (the §0 window label)', () => {
    const snap = buildCityReportSnapshot({
      cityLabel: 'Bend',
      geoSlug: 'bend',
      pulse: null,
      detail: { ...detail, periodStart: '2025-07-22T00:00:00Z', periodEnd: '2026-07-21T00:00:00Z' },
    })
    expect(snap!.trailing12mo!.periodStart).toBe('2025-07-22')
    expect(snap!.trailing12mo!.periodEnd).toBe('2026-07-21')
  })

  it('omits the city entirely when both paths are empty (honest empty, never dashes)', () => {
    expect(
      buildCityReportSnapshot({ cityLabel: 'Bend', geoSlug: 'bend', pulse: null, detail: null }),
    ).toBeNull()
  })

  it('a missing pulse row yields a null live block, not fabricated zeros', () => {
    const snap = buildCityReportSnapshot({ cityLabel: 'Tumalo', geoSlug: 'tumalo', pulse: null, detail })
    expect(snap!.live).toBeNull()
    expect(snap!.trailing12mo!.medianSalePrice).toBe(780_000)
  })

  it('a missing cache row yields a null trailing block, not fabricated zeros', () => {
    const snap = buildCityReportSnapshot({ cityLabel: 'Tumalo', geoSlug: 'tumalo', pulse, detail: null })
    expect(snap!.trailing12mo).toBeNull()
    expect(snap!.live!.activeCount).toBe(500)
  })

  it('hasReportSignal drops all-zero cities (no price, no inventory, no sales)', () => {
    const dead = buildCityReportSnapshot({
      cityLabel: 'Tumalo',
      geoSlug: 'tumalo',
      pulse: { ...pulse, activeCount: 0, medianListPrice: null, monthsOfSupply: null, closedLast30Days: 0, medianDaysToPending: null },
      detail: { ...detail, medianSalePrice: null, soldCount: 0, medianDom: null, yoyMedianPriceDeltaPct: null },
    })
    expect(dead).not.toBeNull()
    expect(hasReportSignal(dead!)).toBe(false)
  })

  it('hasReportSignal keeps a city with any one real signal', () => {
    const base = {
      cityLabel: 'Terrebonne',
      geoSlug: 'terrebonne',
      pulse: { ...pulse, activeCount: 0, medianListPrice: null, monthsOfSupply: null, closedLast30Days: 0, medianDaysToPending: null },
      detail: { ...detail, medianSalePrice: null, soldCount: 0, medianDom: null, yoyMedianPriceDeltaPct: null },
    }
    const inventoryOnly = buildCityReportSnapshot({
      ...base,
      pulse: { ...base.pulse, activeCount: 7 },
    })
    expect(hasReportSignal(inventoryOnly!)).toBe(true)
    const priceOnly = buildCityReportSnapshot({
      ...base,
      detail: { ...base.detail, medianSalePrice: 563_000 },
    })
    expect(hasReportSignal(priceOnly!)).toBe(true)
    const salesOnly = buildCityReportSnapshot({
      ...base,
      detail: { ...base.detail, soldCount: 6 },
    })
    expect(hasReportSignal(salesOnly!)).toBe(true)
  })

  it('non-finite numbers are nulled, never rendered', () => {
    const snap = buildCityReportSnapshot({
      cityLabel: 'Bend',
      geoSlug: 'bend',
      pulse: { ...pulse, medianListPrice: Number.NaN as unknown as number },
      detail,
    })
    expect(snap!.live!.medianListPrice).toBeNull()
  })
})
