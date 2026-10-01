import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSparkListingHistory, SPARK_DEFAULT_PAGE_SIZE, SPARK_HISTORY_PAGE_SIZE } from './spark'

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
