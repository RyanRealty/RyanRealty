import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  PROPERTY_TAX_RATE_FRACTION,
  PROPERTY_TAX_RATE_PCT,
  PROPERTY_TAX_RATE_SOURCE,
} from '@/lib/property-tax-rate'
import { computeMonthlyPiti } from '@/lib/listing-tier1'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

/**
 * The property tax rate diverged into six values across five modules before
 * 2026-08-17. These tests are the mechanism that keeps it at one: they fail if
 * a consumer grows its own literal back, or if the constant drifts from the
 * measurement recorded beside it.
 */
describe('property tax rate — one measured constant', () => {
  it('carries the measured median, 0.57% of list price', () => {
    expect(PROPERTY_TAX_RATE_FRACTION).toBe(0.0057)
    expect(PROPERTY_TAX_RATE_PCT).toBe(0.57)
  })

  it('derives the percent form without a float tail that would reach the screen', () => {
    // 0.0057 * 100 is 0.5700000000000001 in IEEE-754, and DSCR_DEFAULTS.taxRatePct
    // is interpolated straight into admin copy as `${...}%`.
    expect(String(PROPERTY_TAX_RATE_PCT)).toBe('0.57')
    expect(PROPERTY_TAX_RATE_PCT / 100).toBeCloseTo(PROPERTY_TAX_RATE_FRACTION, 12)
  })

  it('rounds the recorded median rather than inventing a different number', () => {
    expect(PROPERTY_TAX_RATE_SOURCE.medianPct).toBe(0.569)
    expect(PROPERTY_TAX_RATE_PCT).toBeCloseTo(PROPERTY_TAX_RATE_SOURCE.medianPct, 2)
    // The measurement is not a tail artifact: mean and median agree closely.
    expect(Math.abs(PROPERTY_TAX_RATE_SOURCE.meanPct - PROPERTY_TAX_RATE_SOURCE.medianPct)).toBeLessThan(0.05)
    expect(PROPERTY_TAX_RATE_SOURCE.sampleSize).toBe(6213)
  })

  it('agrees with the SQL trigger that writes listings.estimated_monthly_piti', () => {
    // The trigger cannot import this file, so the lock reads the RECORDED
    // migration (20260818052949) and extracts the declared constant. Editing
    // either side without the other fails here.
    const sql = readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260818052949_listing_piti_measured_tax_fallback.sql'),
      'utf8',
    )
    const m = sql.match(/tax_fallback_pct constant numeric := ([0-9.]+)/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBe(PROPERTY_TAX_RATE_FRACTION)
  })
})

describe('property tax rate — every consumer reads the constant', () => {
  const CONSUMERS = [
    'lib/listing-tier1.ts',
    'lib/data/config.ts',
    'lib/data/dscr/screen.ts',
    'components/site/listing-detail/MortgageCalculator.tsx',
    'components/site/listing-detail/RentalAnalysis.tsx',
  ]

  it.each(CONSUMERS)('%s imports from @/lib/property-tax-rate', (file) => {
    expect(read(file)).toMatch(/from '@\/lib\/property-tax-rate'/)
  })

  it.each(CONSUMERS)('%s declares no local tax-rate constant', (file) => {
    const offenders = read(file)
      .split('\n')
      .filter((line) => /^\s*(const|let|var)\s+\w*TAX\w*(RATE|FALLBACK|PCT)\w*\s*=/i.test(line))
    expect(offenders).toEqual([])
  })

  it('getCalculatorDefaults no longer reads the stale app_config tax row', () => {
    // app_config.default_tax_rate_pct holds 0.012 — seeded 2026-04-14, never
    // updated, more than double the measured figure. Reading it would reinstate
    // 1.2% on the mortgage calculator's opening screen.
    const config = read('lib/data/config.ts')
    expect(config).not.toMatch(/\.in\([^)]*default_tax_rate_pct/)
  })
})

describe('property tax rate — applied at the point of use', () => {
  it('prices the tax leg of PITI at the measured rate when the row has no tax bill', () => {
    const price = 700_000
    const withoutTax = computeMonthlyPiti({ listPrice: price, taxAnnual: null, hoaMonthly: null })
    const withTax = computeMonthlyPiti({
      listPrice: price,
      taxAnnual: price * PROPERTY_TAX_RATE_FRACTION,
      hoaMonthly: null,
    })
    expect(withoutTax).not.toBeNull()
    expect(withoutTax).toBeCloseTo(withTax!, 2)
    // 700,000 x 0.0057 / 12 = 332.50/mo. The retired 1.2% billed 700.00/mo.
    const atOldRate = computeMonthlyPiti({
      listPrice: price,
      taxAnnual: price * 0.012,
      hoaMonthly: null,
    })
    expect(atOldRate! - withoutTax!).toBeCloseTo(367.5, 2)
  })
})
