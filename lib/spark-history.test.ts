import { afterEach, describe, expect, it, vi } from 'vitest'
import { skipPage } from '@/test/spark-skip-token-fake'
import { fetchSparkListingHistory, fetchSparkListingsPage, fetchSparkListingsWhere, historyRefused, priceHistoryMayStandIn, SPARK_DEFAULT_PAGE_SIZE, SPARK_HISTORY_PAGE_SIZE } from './spark'

type Page = { results: { Id: string }[]; pagination?: { TotalPages: number; PageSize: number; CurrentPage: number } }

function stubPages(pages: Page[]) {
  const urls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url)
      const page = Number(new URL(url).searchParams.get('_page') ?? '1')
      const p = pages[page - 1] ?? { results: [] }
      return new Response(JSON.stringify({ D: { Success: true, Results: p.results, ...(p.pagination ? { Pagination: p.pagination } : {}) } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
  return urls
}

const items = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ Id: `e${from + i}` }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchSparkListingHistory', () => {
  it('asks for a sized, paginated first page: unasked, Spark returns its newest 10 events and no pagination', async () => {
    const urls = stubPages([{ results: items(0, 57), pagination: { TotalPages: 1, PageSize: SPARK_HISTORY_PAGE_SIZE, CurrentPage: 1 } }])
    const r = await fetchSparkListingHistory('token', '20260511224011533030000000')
    expect(urls).toHaveLength(1)
    const first = new URL(urls[0]!)
    expect(first.pathname).toMatch(/\/listings\/20260511224011533030000000\/history$/)
    expect(first.searchParams.get('_pagination')).toBe('1')
    expect(first.searchParams.get('_limit')).toBe(String(SPARK_HISTORY_PAGE_SIZE))
    expect(first.searchParams.get('_page')).toBe('1')
    expect(r).toMatchObject({ ok: true, partial: false })
    expect(r.items).toHaveLength(57)
  })

  it('reads every page the pagination block names, at the same page size', async () => {
    const urls = stubPages([
      { results: items(0, 200), pagination: { TotalPages: 2, PageSize: 200, CurrentPage: 1 } },
      { results: items(200, 31), pagination: { TotalPages: 2, PageSize: 200, CurrentPage: 2 } },
    ])
    const r = await fetchSparkListingHistory('token', 'k1')
    expect(urls.map((u) => new URL(u).searchParams.get('_page'))).toEqual(['1', '2'])
    expect(urls.every((u) => new URL(u).searchParams.get('_limit') === String(SPARK_HISTORY_PAGE_SIZE))).toBe(true)
    expect(r).toMatchObject({ ok: true, partial: false })
    expect(r.items.map((i) => (i as { Id: string }).Id)).toEqual(items(0, 231).map((i) => i.Id))
  })

  it('marks a history partial when a later page fails, keeping what it read', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (new URL(url).searchParams.get('_page') === '2') return new Response('busy', { status: 503 })
        return new Response(JSON.stringify({ D: { Success: true, Results: items(0, 200), Pagination: { TotalPages: 2, PageSize: 200, CurrentPage: 1 } } }), { status: 200 })
      }),
    )
    const r = await fetchSparkListingHistory('token', 'k2')
    expect(r).toMatchObject({ ok: false, partial: true, status: 503 })
    expect(r.items).toHaveLength(200)
  })

  it('never calls a first page with no pagination block at the default size a whole history', async () => {
    stubPages([{ results: items(0, SPARK_DEFAULT_PAGE_SIZE) }])
    const r = await fetchSparkListingHistory('token', 'k3')
    expect(r).toMatchObject({ ok: false, partial: true })
    expect(r.items).toHaveLength(SPARK_DEFAULT_PAGE_SIZE)
  })

  it('takes a short answer with no pagination block as whole', async () => {
    stubPages([{ results: items(0, 3) }])
    const r = await fetchSparkListingHistory('token', 'k4')
    expect(r).toMatchObject({ ok: true, partial: false })
  })
})

describe('priceHistoryMayStandIn', () => {
  it('lets the price history stand in on a standing answer only', () => {
    expect(priceHistoryMayStandIn({ ok: true, items: [] })).toBe(true)
    for (const status of [400, 403, 404, 200]) expect(priceHistoryMayStandIn({ ok: false, items: [], status })).toBe(true)
  })

  it('never on a temporary failure, a partial read or a history that has events', () => {
    for (const status of [401, 408, 409, 422, 425, 429, 500, 502, 503]) expect(priceHistoryMayStandIn({ ok: false, items: [], status })).toBe(false)
    expect(priceHistoryMayStandIn({ ok: false, items: [] })).toBe(false)
    expect(priceHistoryMayStandIn({ ok: false, items: [], partial: true })).toBe(false)
    expect(priceHistoryMayStandIn({ ok: false, items: items(0, 10) as never, partial: true, status: 200 })).toBe(false)
    expect(priceHistoryMayStandIn({ ok: true, items: items(0, 2) as never })).toBe(false)
  })
})

describe('fetchSparkListingsPage by skip token', () => {
  it('asks by skip token, without page or pagination, and passes the token back', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        return new Response(JSON.stringify({ D: { Success: true, Results: [], SkipToken: 'k9' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )
    const r = await fetchSparkListingsPage('token', { limit: 1000, filter: "StandardStatus Eq 'Active'", skiptoken: 'k5' })
    const q = new URL(urls[0]!).searchParams
    expect(q.get('_skiptoken')).toBe('k5')
    expect(q.get('_page')).toBeNull()
    expect(q.get('_pagination')).toBeNull()
    expect(q.get('_limit')).toBe('1000')
    expect(r.D?.SkipToken).toBe('k9')
  })
})

describe('historyRefused', () => {
  it('is a refusal only for the exact answers that refuse for good', () => {
    for (const status of [200, 400, 403, 404]) expect(historyRefused({ ok: false, status })).toBe(true)
    for (const status of [401, 408, 409, 429, 500]) expect(historyRefused({ ok: false, status })).toBe(false)
    expect(historyRefused({ ok: true, status: 200 })).toBe(false)
    expect(historyRefused({ ok: false, partial: true, status: 403 })).toBe(false)
    expect(historyRefused({ ok: false })).toBe(false)
  })
})

describe('fetchSparkListingsWhere', () => {
  function stubSkipToken(rows: Record<string, unknown>[], tokens: string[] = []) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const q = new URL(url).searchParams
        const token = q.get('_skiptoken') ?? ''
        tokens.push(token)
        return new Response(JSON.stringify(skipPage(rows, { limit: Number(q.get('_limit')), skiptoken: token })), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )
    return tokens
  }
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ ListingKey: `k${String(i).padStart(4, '0')}` }))

  it('reads every page after the last key until an empty page', async () => {
    const tokens = stubSkipToken(rows(2500))
    const got = await fetchSparkListingsWhere('token', { filter: "StandardStatus Eq 'Active'", maxPages: 5, tooMany: 'too many' })
    expect(got).toHaveLength(2500)
    expect(tokens).toEqual(['', 'k0999', 'k1999', 'k2499'])
  })

  it('throws past maxPages, and when Spark gives no next token', async () => {
    stubSkipToken(rows(2500))
    await expect(fetchSparkListingsWhere('token', { filter: 'x', maxPages: 2, tooMany: 'past two pages' })).rejects.toThrow('past two pages')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ D: { Success: true, Results: [{ StandardFields: { ListingKey: 'a' } }] } }), { status: 200 })),
    )
    await expect(fetchSparkListingsWhere('token', { filter: 'x', maxPages: 5, tooMany: 'too many' })).rejects.toThrow(/no next skip token/)
  })
})
