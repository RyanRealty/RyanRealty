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
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'

const { detailMock, pulseMock, leftoverMock, overlaysMock } = vi.hoisted(() => ({
  detailMock: vi.fn(),
  pulseMock: vi.fn(),
  leftoverMock: vi.fn(),
  overlaysMock: vi.fn(),
}))

vi.mock('@/lib/data/market/getCityMarketDetail', () => ({
  getCityMarketDetail: (args: unknown) => detailMock(args),
}))
vi.mock('@/lib/data/market/getMarketPulse', () => ({
  getMarketPulse: (args: unknown) => pulseMock(args),
}))
vi.mock('@/lib/data/market-truth/public-pace', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/market-truth/public-pace')>(
    '@/lib/data/market-truth/public-pace',
  )
  return {
    ...actual,
    getPublicDetachedPace: (...args: unknown[]) => leftoverMock(...args),
  }
})
vi.mock('@/lib/data/market-truth/getSellBendMarket', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/market-truth/getSellBendMarket')>(
    '@/lib/data/market-truth/getSellBendMarket',
  )
  return {
    ...actual,
    getDetachedOverlays: (...args: unknown[]) => overlaysMock(...args),
  }
})

const { getCityRangeRow } = await import('@/lib/data/market/getCityRangeReport')

/** Two spellings holding DIFFERENT geographies — the exact La Pine shape. */
const SPACE = 'la pine'
const HYPHEN = 'la-pine'

beforeEach(() => {
  detailMock.mockReset()
  pulseMock.mockReset()
  leftoverMock.mockReset()
  leftoverMock.mockResolvedValue({ ...EMPTY_PUBLIC_PACE })
  overlaysMock.mockReset()
  overlaysMock.mockResolvedValue(new Map())
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
    // Sales (12 mo) is leftover, not a second cache spelling. Default leftover miss omits.
    expect(row!.sales12mo).toBeNull()
    expect(row!.activeCount).toBeNull()
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
    expect(row!.activeCount).toBeNull()
    // The hyphen spelling's 44 must NOT appear beside the space spelling's pulse.
    expect(row!.soldCount).toBeNull()
    expect(row!.medianSalePrice).toBeNull()
  })

  /**
   * The EXACT shape that shipped and had to be rolled back: the canonical space
   * spelling answers PARTIALLY (it has the trailing-365 row and the pulse, but no
   * `ytd` row, because the ytd writer had keyed on the hyphen), while the hyphen
   * spelling holds a polygon-scoped `ytd`. A per-source merge takes soldCount=44
   * from the hyphen and sales12mo=179 from the space row and publishes 44 closings
   * "year to date" beside 58 in the last 90 days. The earlier cases pass under
   * that regression because their first candidate answers fully — this one is the
   * headline defect, so it must fail loudly if the merge ever returns.
   */
  it('first candidate answering PARTIALLY still supplies every field (the shipped defect)', async () => {
    detailMock.mockImplementation(({ geoSlug, periodType }: { geoSlug: string; periodType: string }) => {
      // Space spelling: trailing year only — NO ytd row.
      if (geoSlug === SPACE && periodType === 'rolling_365d') {
        return Promise.resolve({ soldCount: 179, medianSalePrice: 405000, periodStart: '2025-07-24', periodEnd: '2026-07-24' })
      }
      if (geoSlug === SPACE) return Promise.resolve(null)
      // Hyphen spelling: the polygon-scoped ytd row.
      if (geoSlug === HYPHEN && periodType === 'ytd') {
        return Promise.resolve({ soldCount: 44, medianSalePrice: 369950, periodStart: '2026-01-01', periodEnd: '2026-07-24' })
      }
      return Promise.resolve(null)
    })
    pulseMock.mockImplementation(({ geoSlug }: { geoSlug: string }) =>
      Promise.resolve(geoSlug === SPACE ? { activeCount: 170, monthsOfSupply: 11.33 } : null),
    )

    const row = await getCityRangeRow('La Pine', 'ytd')
    expect(row).not.toBeNull()
    // Committed to the space spelling: its pulse renders, leftover (miss) omits
    // Sales (12 mo), and the hyphen's 44 must NOT appear as this row's YTD.
    expect(row!.sales12mo).toBeNull()
    expect(row!.activeCount).toBeNull()
    expect(row!.soldCount).toBeNull()
    expect(row!.medianSalePrice).toBeNull()
    // Guard the impossible-row signature directly.
    expect(row!.soldCount).not.toBe(44)
  })

  it('returns null when no spelling answers', async () => {
    detailMock.mockResolvedValue(null)
    pulseMock.mockResolvedValue(null)
    expect(await getCityRangeRow('Nowhere', 'ytd')).toBeNull()
  })
})
