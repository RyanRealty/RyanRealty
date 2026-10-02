import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * fetchDeltaWindow against a fake Spark that behaves like the real one
 * (2026-10-01): changes stamped to the whole second, a second's listings in a
 * different order on every request, Ge/Gt/Eq on the stamp, skip-token paging
 * in key order. Paging by `_page` lost a row when a listing read early changed
 * again mid-read, and could split a second across two pages; neither may lose
 * a row here.
 */

type Row = { ListingKey: string; ModificationTimestamp: string }
const fake = {
  rows: [] as Row[],
  requests: 0,
  filters: [] as string[],
  onRequest: null as null | ((n: number) => void),
  /** The request Spark answers 200 with Success false (Code 1500). */
  successFalseAt: null as number | null,
}

vi.mock('@/lib/spark', async () => ({
  assertSparkSuccess: (await vi.importActual<typeof import('@/lib/spark')>('@/lib/spark')).assertSparkSuccess,
  fetchSparkListingsPage: vi.fn(async (_token: string, opts: { limit?: number; filter?: string; skiptoken?: string }) => {
    fake.requests++
    fake.onRequest?.(fake.requests)
    if (fake.successFalseAt === fake.requests) return { D: { Success: false, Code: 1500, Message: 'permission denied' } }
    const filter = opts.filter ?? ''
    fake.filters.push(filter)
    const m = /^ModificationTimestamp (Ge|Gt|Eq) (\S+)$/.exec(filter)
    if (!m) throw new Error(`unexpected filter ${filter}`)
    const [, op, at] = m
    const t = Date.parse(at!)
    const hit = fake.rows.filter((r) => {
      const rt = Date.parse(r.ModificationTimestamp)
      return op === 'Ge' ? rt >= t : op === 'Gt' ? rt > t : rt === t
    })
    const limit = opts.limit ?? 100
    if (opts.skiptoken !== undefined) {
      const page = hit.sort((a, b) => a.ListingKey.localeCompare(b.ListingKey)).filter((r) => r.ListingKey > opts.skiptoken!).slice(0, limit)
      return { D: { Results: page.map((r) => ({ StandardFields: { ...r } })), SkipToken: page.length ? page[page.length - 1]!.ListingKey : opts.skiptoken } }
    }
    // Ascending by stamp; ties in a different order on every request, as Spark does.
    const flip = fake.requests % 2 === 0 ? -1 : 1
    const page = hit
      .sort((a, b) => Date.parse(a.ModificationTimestamp) - Date.parse(b.ModificationTimestamp) || flip * a.ListingKey.localeCompare(b.ListingKey))
      .slice(0, limit)
    return { D: { Results: page.map((r) => ({ StandardFields: { ...r } })), Pagination: { TotalRows: hit.length } } }
  }),
}))

import { fetchDeltaWindow } from './deltaSync'

const sec = (n: number) => new Date(Date.parse('2026-10-01T19:00:00Z') + n * 1000).toISOString().replace('.000Z', 'Z')
const keysOf = (r: { StandardFields?: unknown }[]) => r.map((x) => (x.StandardFields as Row).ListingKey).sort()

beforeEach(() => {
  fake.rows = []
  fake.requests = 0
  fake.filters = []
  fake.onRequest = null
  fake.successFalseAt = null
})

describe('fetchDeltaWindow', () => {
  it('returns every change once when seconds are split across pages and reorder between requests', async () => {
    // 30 listings over 6 seconds, five a second; pages of 4 split every second.
    for (let i = 0; i < 30; i++) fake.rows.push({ ListingKey: `k${String(i).padStart(2, '0')}`, ModificationTimestamp: sec(Math.floor(i / 5)) })
    const r = await fetchDeltaWindow('t', sec(0), { pageSize: 4, maxPages: 100 })
    expect(keysOf(r.results)).toEqual(fake.rows.map((x) => x.ListingKey).sort())
    expect(r.results).toHaveLength(30)
    expect(r.truncated).toBe(false)
    expect(fake.filters[0]).toBe(`ModificationTimestamp Ge ${sec(0)}`)
  })

  it('loses no row when a listing already read changes again mid-read, and keeps its newer record', async () => {
    for (let i = 0; i < 12; i++) fake.rows.push({ ListingKey: `k${String(i).padStart(2, '0')}`, ModificationTimestamp: sec(i) })
    // After the first page (k00..k03), k01 changes again: under _page every later row shifted one place.
    fake.onRequest = (n) => {
      if (n === 2) fake.rows.find((x) => x.ListingKey === 'k01')!.ModificationTimestamp = sec(20)
    }
    const r = await fetchDeltaWindow('t', sec(0), { pageSize: 4, maxPages: 100 })
    expect(keysOf(r.results)).toEqual(fake.rows.map((x) => x.ListingKey).sort())
    const k01 = r.results.find((x) => (x.StandardFields as Row).ListingKey === 'k01')!
    expect((k01.StandardFields as Row).ModificationTimestamp).toBe(sec(20))
  })

  it('reads a second that fills more than a page by skip token, then goes on after it', async () => {
    for (let i = 0; i < 9; i++) fake.rows.push({ ListingKey: `t${i}`, ModificationTimestamp: sec(5) })
    fake.rows.push({ ListingKey: 'after', ModificationTimestamp: sec(6) })
    const r = await fetchDeltaWindow('t', sec(0), { pageSize: 4, maxPages: 100 })
    expect(keysOf(r.results)).toEqual(fake.rows.map((x) => x.ListingKey).sort())
    expect(fake.filters).toContain(`ModificationTimestamp Eq ${sec(5)}`)
    expect(fake.filters.at(-1)).toBe(`ModificationTimestamp Gt ${sec(5)}`)
  })

  it('reports a window longer than maxPages as truncated', async () => {
    for (let i = 0; i < 20; i++) fake.rows.push({ ListingKey: `k${String(i).padStart(2, '0')}`, ModificationTimestamp: sec(i) })
    const r = await fetchDeltaWindow('t', sec(0), { pageSize: 4, maxPages: 2 })
    expect(r.truncated).toBe(true)
    expect(r.pagesProcessed).toBe(2)
  })

  it('throws on an error Spark answers as 200 (Success false) rather than reading the window as drained', async () => {
    for (let i = 0; i < 30; i++) fake.rows.push({ ListingKey: `k${String(i).padStart(2, '0')}`, ModificationTimestamp: sec(i) })
    fake.successFalseAt = 2
    await expect(fetchDeltaWindow('t', sec(0), { pageSize: 4, maxPages: 100 })).rejects.toThrow(
      '[deltaSync] Spark answered Success false: permission denied (Code 1500)',
    )
  })
})
