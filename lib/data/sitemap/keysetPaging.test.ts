import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Keyset-paging regression lock (2026-09-16).
 *
 * PR #252 commit 7b5535bd: GitHub Actions route smoke failed
 * "sitemaps/listings.xml returned HTTP 500" (144/145), and a local production
 * build reproduced it twice with the server log
 * "[getListingSitemapRows] listing_tile_mv page failed: canceling statement
 * due to statement timeout" — eight concurrent ORDER BY + OFFSET pages over
 * the same filtered listing_tile_mv contending for the statement timeout.
 * This locks the replacement: sequential `.gt('listing_key', lastKey)
 * .order('listing_key').limit(PAGE_SIZE)` paging, a tolerant count sanity
 * check, and exponential-backoff retry. Supabase mocked per the DAL test
 * pattern (resolveCanonicalListingKey.test.ts, getTaxlots.test.ts).
 */
vi.mock('@/lib/data/client', () => ({ supabaseAnon: vi.fn() }))

import { getListingSitemapRows } from './getListingSitemapRows'
import { supabaseAnon } from '@/lib/data/client'
import type { ListingSitemapTile } from './listing-sitemap-path'

const PAGE_SIZE = 1000

type PageResult = { data?: ListingSitemapTile[] | null; error?: unknown }
type CountResult = { count?: number | null; error?: unknown }

/**
 * Minimal thenable query-builder mock covering the two shapes this DAL sends:
 * a `head: true` exact count, and a `select(cols).in().gt()?.order().limit()`
 * data page. Each `.then()` call — including every retry attempt — consumes
 * the next queued result (clamped to the last entry once exhausted, so an
 * "always fails" scenario is a one-element array).
 */
function mockSupabase(opts: { countResults: CountResult[]; pageResults: PageResult[] }) {
  let countIdx = 0
  let pageIdx = 0
  const gtCalls: (string | null)[] = []

  function dataBuilder() {
    let gtValue: string | null = null
    const builder = {
      in: () => builder,
      gt: (_col: string, value: string) => {
        gtValue = value
        return builder
      },
      order: () => builder,
      limit: () => builder,
      then: (resolve: (v: PageResult) => void) => {
        gtCalls.push(gtValue)
        const r = opts.pageResults[Math.min(pageIdx, opts.pageResults.length - 1)] ?? { data: [], error: null }
        pageIdx += 1
        resolve(r)
      },
    }
    return builder
  }

  function countBuilder() {
    const builder = {
      in: () => builder,
      then: (resolve: (v: CountResult) => void) => {
        const r = opts.countResults[Math.min(countIdx, opts.countResults.length - 1)] ?? { count: 0, error: null }
        countIdx += 1
        resolve(r)
      },
    }
    return builder
  }

  return {
    client: {
      from: () => ({
        select: (_cols: string, selectOpts?: { count?: string; head?: boolean }) =>
          selectOpts?.head ? countBuilder() : dataBuilder(),
      }),
    },
    gtCalls,
    pageCallCount: () => pageIdx,
    countCallCount: () => countIdx,
  }
}

const setSb = (v: unknown) => (supabaseAnon as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v)

/** A real, service-area (Bend) tile with a deterministic listing_key. */
function tile(n: number): ListingSitemapTile {
  const key = String(n).padStart(20, '0')
  return {
    listing_key: key,
    list_number: `2202${String(n).padStart(5, '0')}`,
    street_number: String(n),
    street_name: 'Oak',
    city: 'Bend',
    subdivision_name: null,
    boundary_city: 'Bend',
    boundary_neighborhood: null,
    modified_at: '2026-09-01T00:00:00.000Z',
  }
}

const NOW = new Date('2026-09-16T00:00:00.000Z')

describe('getListingSitemapRows keyset paging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stops on the first short page and never sends .gt() on the first page', async () => {
    const rows = [tile(1), tile(2), tile(3)] // 3 < PAGE_SIZE
    const sb = mockSupabase({
      countResults: [{ count: 3, error: null }],
      pageResults: [{ data: rows, error: null }],
    })
    setSb(sb.client)

    const result = await getListingSitemapRows(NOW)

    expect(result).toHaveLength(3)
    expect(sb.pageCallCount()).toBe(1) // one page, no follow-up call
    expect(sb.gtCalls).toEqual([null])
  })

  it('a full page continues from the last key of the previous page', async () => {
    const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => tile(i + 1))
    const secondPage = [tile(PAGE_SIZE + 1), tile(PAGE_SIZE + 2)]
    const sb = mockSupabase({
      countResults: [{ count: PAGE_SIZE + 2, error: null }],
      pageResults: [{ data: fullPage, error: null }, { data: secondPage, error: null }],
    })
    setSb(sb.client)

    const result = await getListingSitemapRows(NOW)

    expect(result).toHaveLength(PAGE_SIZE + 2)
    expect(sb.pageCallCount()).toBe(2)
    const lastKeyOfFirstPage = fullPage[fullPage.length - 1]!.listing_key
    expect(sb.gtCalls).toEqual([null, lastKeyOfFirstPage])
  })

  it('preserves fetch order across pages in the assembled rows', async () => {
    const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => tile(i + 1))
    const secondPage = [tile(PAGE_SIZE + 1), tile(PAGE_SIZE + 2)]
    const sb = mockSupabase({
      countResults: [{ count: PAGE_SIZE + 2, error: null }],
      pageResults: [{ data: fullPage, error: null }, { data: secondPage, error: null }],
    })
    setSb(sb.client)

    const result = await getListingSitemapRows(NOW)
    const expectedOrder = [...fullPage, ...secondPage].map((t) => t.listing_key)
    expect(result.map((r) => r.listingKey)).toEqual(expectedOrder)
  })

  it('a page error survives 4 attempts and throws with the original message', async () => {
    vi.useFakeTimers()
    const sb = mockSupabase({
      countResults: [{ count: 5, error: null }],
      pageResults: [{ data: null, error: { message: 'canceling statement due to statement timeout' } }],
    })
    setSb(sb.client)

    // Attach a settle-capturing handler synchronously, in the same tick the
    // promise is created, so advancing fake timers below can never produce an
    // "unhandled rejection" window before this test observes the outcome.
    const settled = getListingSitemapRows(NOW).then(
      (v) => ({ ok: true as const, v }),
      (e) => ({ ok: false as const, e }),
    )
    // Let all 4 retry attempts (250/750/2000ms backoff + jitter) play out.
    await vi.runAllTimersAsync()
    const result = await settled

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.e).toBeInstanceOf(Error)
      expect((result.e as Error).message).toMatch(/canceling statement due to statement timeout/)
    }
    expect(sb.pageCallCount()).toBe(4) // withRetry attempts, default 4
  })

  it('a count-query timeout does not fail the sitemap — it proceeds with keyset paging', async () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rows = [tile(1), tile(2)]
    const sb = mockSupabase({
      countResults: [{ count: null, error: { message: 'canceling statement due to statement timeout' } }],
      pageResults: [{ data: rows, error: null }],
    })
    setSb(sb.client)

    const promise = getListingSitemapRows(NOW)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toHaveLength(2)
    expect(sb.countCallCount()).toBe(4) // count retried and exhausted, but swallowed
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/count failed, proceeding without it/))
    errorSpy.mockRestore()
  })

  it('a known non-zero count with an empty page read still throws (the guard survives the refactor)', async () => {
    const sb = mockSupabase({
      countResults: [{ count: 5, error: null }],
      pageResults: [{ data: [], error: null }],
    })
    setSb(sb.client)

    await expect(getListingSitemapRows(NOW)).rejects.toThrow(/reported 5 Active\/AUC rows but the page read returned 0/)
  })

  it('a known zero count short-circuits without reading any pages', async () => {
    const sb = mockSupabase({
      countResults: [{ count: 0, error: null }],
      pageResults: [{ data: [tile(1)], error: null }], // would be wrong if read
    })
    setSb(sb.client)

    const result = await getListingSitemapRows(NOW)
    expect(result).toEqual([])
    expect(sb.pageCallCount()).toBe(0)
  })
})
