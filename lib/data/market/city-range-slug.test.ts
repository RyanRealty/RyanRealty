/**
 * §0 no-mixing rule for the /reports range table (W8.1).
 *
 * A city can have more than one slug spelling in market_stats_cache — the
 * canonical `lower("City")` space form ('la pine') and, historically, a retired
 * hyphen form ('la-pine'). Those spellings are NOT interchangeable sources to be
 * merged field-by-field: for La Pine the hyphen slug also matched a `boundaries`
 * polygon, so its rows counted only inside the city limits while the space rows
 * counted the whole MLS city. A field-by-field merge produced a row describing
 * two different geographies — 44 closings "year to date" beside 58 in the last
 * 90 days, a strict sub-window, which is arithmetically impossible.
 *
 * An impossible row is a worse §0 failure than a missing one. These tests pin
 * the rule that survived that bug: candidate spellings are tried in order, and
 * the FIRST one that answers supplies EVERY field.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const detailMock = vi.fn()
const pulseMock = vi.fn()

vi.mock('@/lib/data/market/getCityMarketDetail', () => ({
  getCityMarketDetail: (args: unknown) => detailMock(args),
}))
vi.mock('@/lib/data/market/getMarketPulse', () => ({
  getMarketPulse: (args: unknown) => pulseMock(args),
}))

const { getCityRangeRow } = await import('@/lib/data/market/getCityRangeReport')

/** Two spellings holding DIFFERENT geographies — the exact La Pine shape. */
const SPACE = 'la pine'
const HYPHEN = 'la-pine'

beforeEach(() => {
  detailMock.mockReset()
  pulseMock.mockReset()
})

describe('getCityRangeRow — one spelling supplies every field', () => {
  it('never merges a detail row from one spelling with a pulse from another', async () => {
    // Space spelling: whole-city universe, answers everything.
    // Hyphen spelling: polygon-scoped universe with DIFFERENT numbers.
    detailMock.mockImplementation(({ geoSlug, periodType }: { geoSlug: string; periodType: string }) => {
      if (geoSlug === SPACE) {
        return Promise.resolve(
          periodType === 'ytd'
            ? { soldCount: 95, medianSalePrice: 415000, medianDom: 52, medianPricePerSqft: 269, periodStart: '2026-01-01', periodEnd: '2026-07-24' }
            : { soldCount: 179, medianSalePrice: 405000, medianDom: 51, medianPricePerSqft: 320, periodStart: '2025-07-24', periodEnd: '2026-07-24' },
        )
      }
      if (geoSlug === HYPHEN) {
        return Promise.resolve({ soldCount: 44, medianSalePrice: 369950, medianDom: 52, medianPricePerSqft: 269, periodStart: '2026-01-01', periodEnd: '2026-07-24' })
      }
      return Promise.resolve(null)
    })
    pulseMock.mockImplementation(({ geoSlug }: { geoSlug: string }) =>
      Promise.resolve(geoSlug === SPACE ? { activeCount: 170, monthsOfSupply: 11.33 } : null),
    )

    const row = await getCityRangeRow('La Pine', 'ytd')
    expect(row).not.toBeNull()
    // Space answered first, so EVERY field is the space universe — never the
    // hyphen's 44/$369,950 blended in beside the space pulse.
    expect(row!.soldCount).toBe(95)
    expect(row!.medianSalePrice).toBe(415000)
    expect(row!.sales12mo).toBe(179)
    expect(row!.activeCount).toBe(170)
    // The regression signature: YTD must never be smaller than the trailing year.
    expect(row!.soldCount!).toBeLessThanOrEqual(row!.sales12mo!)
  })

  it('falls through to the next spelling ONLY when the first answers nothing at all', async () => {
    detailMock.mockImplementation(({ geoSlug }: { geoSlug: string }) =>
      Promise.resolve(
        geoSlug === HYPHEN
          ? { soldCount: 44, medianSalePrice: 369950, medianDom: 52, medianPricePerSqft: 269, periodStart: '2026-01-01', periodEnd: '2026-07-24' }
          : null,
      ),
    )
    pulseMock.mockResolvedValue(null)

    const row = await getCityRangeRow('La Pine', 'ytd')
    expect(row).not.toBeNull()
    expect(row!.soldCount).toBe(44)
    expect(row!.medianSalePrice).toBe(369950)
    // Nothing borrowed from the spelling that answered nothing.
    expect(row!.activeCount).toBeNull()
    expect(row!.monthsOfSupply).toBeNull()
  })

  it('does not borrow a pulse from a second spelling when the first answered', async () => {
    // First candidate has ONLY a pulse; the second has rich detail. Committing to
    // the first is what keeps the row single-geography.
    detailMock.mockImplementation(({ geoSlug }: { geoSlug: string }) =>
      Promise.resolve(geoSlug === HYPHEN ? { soldCount: 44, medianSalePrice: 369950, periodStart: '2026-01-01', periodEnd: '2026-07-24' } : null),
    )
    pulseMock.mockImplementation(({ geoSlug }: { geoSlug: string }) =>
      Promise.resolve(geoSlug === SPACE ? { activeCount: 170, monthsOfSupply: 11.33 } : null),
    )

    const row = await getCityRangeRow('La Pine', 'ytd')
    expect(row).not.toBeNull()
    expect(row!.activeCount).toBe(170)
    // The hyphen spelling's 44 must NOT appear beside the space spelling's pulse.
    expect(row!.soldCount).toBeNull()
    expect(row!.medianSalePrice).toBeNull()
  })

  it('returns null when no spelling answers', async () => {
    detailMock.mockResolvedValue(null)
    pulseMock.mockResolvedValue(null)
    expect(await getCityRangeRow('Nowhere', 'ytd')).toBeNull()
  })
})
