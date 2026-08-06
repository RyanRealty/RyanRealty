/**
 * Equity-position — pure computation rules. Must refuse to render on thin
 * data (§0: cut, don't guess) and must never suppress an honest loss.
 */
import { describe, expect, it } from 'vitest'
import { computeEquityPosition } from './equity'
import type { CmaPriorSaleRow } from '@/lib/data/cma/builderReads'

const DAY_MS = 24 * 3600 * 1000
const YEAR_MS = 365.25 * DAY_MS

function priorSale(closePrice: number, closeDate: string, sqft: number | null = 2000): CmaPriorSaleRow {
  return { ClosePrice: closePrice, CloseDate: closeDate, TotalLivingAreaSqFt: sqft }
}

function isoYearsBefore(asOf: Date, years: number): string {
  return new Date(asOf.getTime() - years * YEAR_MS).toISOString().slice(0, 10)
}

describe('computeEquityPosition', () => {
  it('reports a normal gain with a hand-computed CAGR', () => {
    const asOf = new Date('2026-08-06T00:00:00Z')
    const purchaseIso = isoYearsBefore(asOf, 3)
    const e = computeEquityPosition({
      priorSale: priorSale(500000, purchaseIso),
      recommendedPrice: 750000,
      asOf,
    })
    expect(e).not.toBeNull()
    expect(e!.purchasePrice).toBe(500000)
    expect(e!.purchaseDate).toBe(purchaseIso)
    expect(e!.yearsHeld).toBe(3)
    expect(e!.gainDollars).toBe(250000)
    expect(e!.gainPct).toBe(50) // 250000 / 500000 * 100
    // Hand-computed CAGR: (750000/500000)^(1/3) - 1 = 1.5^(1/3) - 1 ≈ 0.1447 → 14.5%
    const expectedCagr = Math.round((Math.pow(1.5, 1 / 3) - 1) * 1000) / 10
    expect(e!.annualizedPct).toBe(expectedCagr)
    expect(e!.annualizedPct).toBe(14.5)
  })

  it('reports a loss honestly — negative gain is never suppressed', () => {
    const asOf = new Date('2026-08-06T00:00:00Z')
    const purchaseIso = isoYearsBefore(asOf, 2)
    const e = computeEquityPosition({
      priorSale: priorSale(800000, purchaseIso),
      recommendedPrice: 700000,
      asOf,
    })
    expect(e).not.toBeNull()
    expect(e!.gainDollars).toBe(-100000)
    expect(e!.gainPct).toBe(-12.5) // -100000 / 800000 * 100
    // Hand-computed CAGR: (700000/800000)^(1/2) - 1 = sqrt(0.875) - 1 ≈ -0.0646 → -6.5%
    const expectedCagr = Math.round((Math.pow(700000 / 800000, 1 / 2) - 1) * 1000) / 10
    expect(e!.annualizedPct).toBe(expectedCagr)
    expect(e!.annualizedPct).toBeLessThan(0)
  })

  it('a hold under six months ships nothing', () => {
    const asOf = new Date('2026-08-06T00:00:00Z')
    const purchaseIso = new Date(asOf.getTime() - 90 * DAY_MS).toISOString().slice(0, 10)
    const e = computeEquityPosition({
      priorSale: priorSale(500000, purchaseIso),
      recommendedPrice: 600000,
      asOf,
    })
    expect(e).toBeNull()
  })

  it('a hold between six and twelve months renders the position but withholds CAGR', () => {
    const asOf = new Date('2026-08-06T00:00:00Z')
    const purchaseIso = new Date(asOf.getTime() - 8 * 30.44 * DAY_MS).toISOString().slice(0, 10) // ~8 months
    const e = computeEquityPosition({
      priorSale: priorSale(500000, purchaseIso),
      recommendedPrice: 550000,
      asOf,
    })
    expect(e).not.toBeNull()
    expect(e!.annualizedPct).toBeNull()
    expect(e!.gainDollars).toBe(50000)
  })

  it('a missing prior sale ships nothing', () => {
    expect(
      computeEquityPosition({ priorSale: null, recommendedPrice: 600000, asOf: new Date('2026-08-06') }),
    ).toBeNull()
  })

  it('a non-positive purchase price ships nothing', () => {
    const asOf = new Date('2026-08-06T00:00:00Z')
    const purchaseIso = isoYearsBefore(asOf, 5)
    expect(
      computeEquityPosition({ priorSale: priorSale(0, purchaseIso), recommendedPrice: 600000, asOf }),
    ).toBeNull()
    expect(
      computeEquityPosition({ priorSale: priorSale(-10000, purchaseIso), recommendedPrice: 600000, asOf }),
    ).toBeNull()
  })

  it('a sale that postdates the current listing cycle ships nothing', () => {
    const asOf = new Date('2023-01-01T00:00:00Z')
    const futureIso = '2026-01-01'
    expect(
      computeEquityPosition({ priorSale: priorSale(500000, futureIso), recommendedPrice: 600000, asOf }),
    ).toBeNull()
  })

  it('the source string names the table, the filter, and the row count', () => {
    const asOf = new Date('2026-08-06T00:00:00Z')
    const purchaseIso = isoYearsBefore(asOf, 5)
    const e = computeEquityPosition({
      priorSale: priorSale(400000, purchaseIso),
      recommendedPrice: 900000,
      asOf,
    })
    expect(e).not.toBeNull()
    expect(e!.source).toMatch(/^Supabase listings,/)
    expect(e!.source).toContain("StandardStatus='Closed'")
    expect(e!.source).toContain('1 row')
    expect(e!.source).toContain(purchaseIso)
  })
})
