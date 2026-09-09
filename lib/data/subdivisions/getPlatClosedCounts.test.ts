/**
 * getPlatClosedCounts — the read contract, pinned (SITE-24).
 *
 * Three things this module must never do, each of which has burned this DAL
 * before and each of which is asserted below:
 *
 *   1. Cache a blip as "no plat has any closed sales". The fetch THROWS on a
 *      PostgREST error and THROWS on an empty result set, because 3,0xx rows
 *      exist in production and zero is a failed read, not a county with no
 *      sales. A cached false zero would noindex the whole /subdivisions class
 *      and empty that sitemap section for the full 6h TTL.
 *   2. Report a plat's count as zero when the plat simply has no row. Unknown
 *      is not zero (§0) — getPlatClosedCount returns null and the caller omits
 *      the figure.
 *   3. Confuse the polygon half with the name half. The total is the union over
 *      distinct listing_key; closedInPolygon and closedByName are carried
 *      beside it and are NOT required to sum to it.
 *
 * makeResilientCached is stubbed to a pass-through so the throw contract is
 * observable here. In production that wrapper swallows the throw into one
 * uncached retry and then the [] fallback — which is the point: the throw must
 * happen so unstable_cache never stores the empty.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Pass-through the resilient wrapper: the exported fn IS the fetch fn here.
vi.mock('@/lib/data/cache/resilient', () => ({
  makeResilientCached: (fn: unknown) => fn,
}))

type Row = Record<string, unknown>

let pages: Row[] = []
let readError: { message: string } | null = null

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.order = () => chain
      chain.range = (from: number, to: number) =>
        Promise.resolve(
          readError
            ? { data: null, error: readError }
            : { data: pages.slice(from, to + 1), error: null },
        )
      return chain
    },
  }),
}))

const { getPlatClosedCounts, getPlatClosedCount } = await import('./getPlatClosedCounts')

function row(over: Partial<Row> & { plat_slug: string }): Row {
  return {
    plat_label: 'A Plat',
    closed_count: 10,
    closed_in_polygon: 10,
    closed_by_name: 0,
    closed_count_sfr: 10,
    top_city_lower: 'bend',
    last_close_date: '2026-08-05T00:00:00+00:00',
    closed_by_year: { '2024': 2, '2025': 7, '2026': 4 },
    ...over,
  }
}

beforeEach(() => {
  readError = null
  pages = []
})

describe('getPlatClosedCounts', () => {
  it('maps the MV row onto the PlatClosedCount shape, polygon and name kept apart', () => {
    pages = [
      row({
        plat_slug: 'golf-homes-at-tetherow',
        plat_label: 'Golf Homes At Tetherow',
        closed_count: 107,
        closed_in_polygon: 107,
        closed_by_name: 0,
        closed_count_sfr: 107,
      }),
    ]
    return getPlatClosedCounts().then((out) => {
      expect(out).toHaveLength(1)
      expect(out[0]).toEqual({
        slug: 'golf-homes-at-tetherow',
        label: 'Golf Homes At Tetherow',
        closedCount: 107,
        closedInPolygon: 107,
        closedByName: 0,
        closedCountSfr: 107,
        topCityLower: 'bend',
        lastCloseDate: '2026-08-05T00:00:00+00:00',
        closedByYear: { 2024: 2, 2025: 7, 2026: 4 },
      })
    })
  })

  /**
   * The union case. Outcrop: 8 sales inside the recorded polygon, 20 recorded
   * under the name, total 20 — the two halves overlap, so they must not be
   * expected to add up, and the total is never their sum.
   */
  it('keeps the total as the union, not the sum of the two attributions', async () => {
    pages = [
      row({
        plat_slug: 'outcrop',
        plat_label: 'Outcrop',
        closed_count: 20,
        closed_in_polygon: 8,
        closed_by_name: 20,
      }),
    ]
    const [out] = await getPlatClosedCounts()
    expect(out.closedCount).toBe(20)
    expect(out.closedInPolygon + out.closedByName).not.toBe(out.closedCount)
  })

  it('THROWS on a read error rather than returning an empty set to be cached', async () => {
    readError = { message: 'pooler 25P02' }
    await expect(getPlatClosedCounts()).rejects.toThrow(/read failed/)
  })

  it('THROWS on zero rows — production holds thousands, so zero is a failed read', async () => {
    pages = []
    await expect(getPlatClosedCounts()).rejects.toThrow(/returned 0 rows/)
  })

  it('drops a slugless row and blanks an empty city rather than inventing either', async () => {
    pages = [
      row({ plat_slug: '   ' }),
      row({ plat_slug: 'awbrey-glen', plat_label: '  ', top_city_lower: '  ' }),
    ]
    const out = await getPlatClosedCounts()
    expect(out).toHaveLength(1)
    // No label, so the slug stands in — never an empty heading.
    expect(out[0]).toMatchObject({ slug: 'awbrey-glen', label: 'awbrey-glen', topCityLower: null })
  })

  it('coerces a null or negative count to 0 rather than NaN', async () => {
    pages = [row({ plat_slug: 'awbrey-glen', closed_count: null, closed_by_name: -3 })]
    const [out] = await getPlatClosedCounts()
    expect(out.closedCount).toBe(0)
    expect(out.closedByName).toBe(0)
  })

  /**
   * closed_by_year reaches a CHART, and a chart is where a junk key becomes an
   * axis. One bad close_date must not put a 1970 bar under a plat's series.
   */
  describe('closedByYear', () => {
    it('keys the year series by number and keeps the years in the map', async () => {
      pages = [row({ plat_slug: 'awbrey-glen', closed_by_year: { '2012': 2, '2013': 4 } })]
      const [out] = await getPlatClosedCounts()
      expect(out.closedByYear).toEqual({ 2012: 2, 2013: 4 })
    })

    it('drops an impossible year and a non-positive count instead of plotting them', async () => {
      const nextYear = new Date().getUTCFullYear() + 1
      pages = [
        row({
          plat_slug: 'awbrey-glen',
          closed_by_year: { '1899': 3, [String(nextYear)]: 3, notayear: 3, '2020': 0, '2021': 5 },
        }),
      ]
      const [out] = await getPlatClosedCounts()
      expect(out.closedByYear).toEqual({ 2021: 5 })
    })

    it('is an empty map when the MV carries none — the page draws nothing, never a zero line', async () => {
      for (const value of [null, undefined, [] as unknown]) {
        pages = [row({ plat_slug: 'awbrey-glen', closed_by_year: value })]
        const [out] = await getPlatClosedCounts()
        expect(out.closedByYear).toEqual({})
      }
    })
  })
})

describe('getPlatClosedCount', () => {
  beforeEach(() => {
    pages = [
      row({ plat_slug: 'golf-homes-at-tetherow', closed_count: 107 }),
      row({ plat_slug: 'ridge-at-broken-top', closed_count: 8 }),
    ]
  })

  it('finds one plat off the same set, case- and whitespace-insensitively', async () => {
    const out = await getPlatClosedCount('  Golf-Homes-At-Tetherow ')
    expect(out?.closedCount).toBe(107)
  })

  /**
   * §0: a plat with no row has no published count. NULL, so the caller omits
   * the figure — never 0, which would read as "no home has ever sold here".
   */
  it('returns null for a plat with no row, never a zero', async () => {
    expect(await getPlatClosedCount('courtyard-garages-at-broken-top')).toBeNull()
    expect(await getPlatClosedCount('')).toBeNull()
  })

  /**
   * A real count under the index floor is still a real count. The page prints
   * it; the index gate is what refuses it. Nothing here rounds it up.
   */
  it('reports a real count that sits under the index floor, unrounded', async () => {
    const out = await getPlatClosedCount('ridge-at-broken-top')
    expect(out?.closedCount).toBe(8)
  })
})
