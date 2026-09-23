import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getListingCanonicalPathFieldsEdge,
  resetListingCanonicalEdgeCache,
} from './getListingCanonicalPathFieldsEdge'

const ENV = { supabaseUrl: 'https://proj.supabase.co/', anonKey: 'anon-key' }

const LOCKSLEY = {
  ListingKey: '20260731160357907738000000',
  ListNumber: '220226356',
  StreetNumber: '1522',
  StreetName: 'Locksley',
  City: 'Bend',
  State: 'OR',
  PostalCode: '97703',
  SubdivisionName: 'Providence',
  permit_internet_yn: true,
  permit_address_internet_yn: null,
  idx_participant: true,
}

function jsonFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
}

describe('getListingCanonicalPathFieldsEdge', () => {
  beforeEach(() => resetListingCanonicalEdgeCache())

  it('reads one row by ListNumber OR ListingKey with the anon key, MLS path columns only', async () => {
    const fetchImpl = jsonFetch([LOCKSLEY])
    const r = await getListingCanonicalPathFieldsEdge('220226356', { ...ENV, fetchImpl })
    expect(r).toEqual({
      kind: 'row',
      row: {
        ListingKey: '20260731160357907738000000',
        ListNumber: '220226356',
        StreetNumber: '1522',
        StreetName: 'Locksley',
        City: 'Bend',
        State: 'OR',
        PostalCode: '97703',
        SubdivisionName: 'Providence',
      },
    })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://proj.supabase.co/rest/v1/listings')
    expect(u.searchParams.get('or')).toBe('(ListNumber.eq.220226356,ListingKey.eq.220226356)')
    expect(u.searchParams.get('limit')).toBe('2')
    const select = u.searchParams.get('select') ?? ''
    for (const col of ['ListingKey', 'ListNumber', 'StreetNumber', 'StreetName', 'City', 'SubdivisionName', 'permit_internet_yn']) {
      expect(select.split(',')).toContain(col)
    }
    expect(select).not.toMatch(/boundary_|\*/)
    expect((init.headers as Record<string, string>).apikey).toBe('anon-key')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('refuses anything that is not a numeric key, without a request', async () => {
    const fetchImpl = jsonFetch([LOCKSLEY])
    for (const bad of ['', 'abc', '1234', '220226356)', '22022,6356', 'rr-smoke-no-such-listing', '9'.repeat(41)]) {
      expect(await getListingCanonicalPathFieldsEdge(bad, { ...ENV, fetchImpl })).toEqual({ kind: 'miss' })
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('a row the seller or broker opted out of display is a miss (IDX, ODS Rule B/G)', async () => {
    for (const flag of ['permit_internet_yn', 'permit_address_internet_yn', 'idx_participant']) {
      resetListingCanonicalEdgeCache()
      const fetchImpl = jsonFetch([{ ...LOCKSLEY, [flag]: false }])
      expect(await getListingCanonicalPathFieldsEdge('220226356', { ...ENV, fetchImpl })).toEqual({ kind: 'miss' })
    }
  })

  it('prefers the ListNumber match when both columns hit, like resolveCanonicalListingKey', async () => {
    const other = { ...LOCKSLEY, ListingKey: '220226356', ListNumber: '999999999', City: 'Sisters' }
    const fetchImpl = jsonFetch([other, LOCKSLEY])
    const r = await getListingCanonicalPathFieldsEdge('220226356', { ...ENV, fetchImpl })
    expect(r.kind === 'row' && r.row.City).toBe('Bend')
  })

  it('two rows under one ListNumber is a miss, as resolveCanonicalListingKey (maybeSingle) resolves neither', async () => {
    const twin = { ...LOCKSLEY, ListingKey: '20260731160357907738000009', City: 'Sisters' }
    const fetchImpl = jsonFetch([LOCKSLEY, twin])
    expect(await getListingCanonicalPathFieldsEdge('220226356', { ...ENV, fetchImpl })).toEqual({ kind: 'miss' })
  })

  it('no row is a miss; an HTTP error, a throw, a timeout or missing env is an error', async () => {
    expect(await getListingCanonicalPathFieldsEdge('220000001', { ...ENV, fetchImpl: jsonFetch([]) })).toEqual({ kind: 'miss' })
    expect((await getListingCanonicalPathFieldsEdge('220000002', { ...ENV, fetchImpl: jsonFetch({ message: 'x' }, 500) })).kind).toBe('error')
    const thrower = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect((await getListingCanonicalPathFieldsEdge('220000003', { ...ENV, fetchImpl: thrower })).kind).toBe('error')
    const hang = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const t0 = Date.now()
    expect((await getListingCanonicalPathFieldsEdge('220000004', { ...ENV, fetchImpl: hang, timeoutMs: 30 })).kind).toBe('error')
    expect(Date.now() - t0).toBeLessThan(1_000)
    expect((await getListingCanonicalPathFieldsEdge('220000005', { supabaseUrl: '', anonKey: '', fetchImpl: jsonFetch([]) })).kind).toBe('error')
  })

  it('memoises hits for 5 minutes and misses for 1, never errors, and shares one in-flight read', async () => {
    let clock = 1_000_000
    const now = () => clock
    const hit = jsonFetch([LOCKSLEY])
    await Promise.all([
      getListingCanonicalPathFieldsEdge('220226356', { ...ENV, fetchImpl: hit, now }),
      getListingCanonicalPathFieldsEdge('220226356', { ...ENV, fetchImpl: hit, now }),
    ])
    expect(hit).toHaveBeenCalledTimes(1)
    clock += 4 * 60_000
    await getListingCanonicalPathFieldsEdge('220226356', { ...ENV, fetchImpl: hit, now })
    expect(hit).toHaveBeenCalledTimes(1)
    clock += 2 * 60_000
    await getListingCanonicalPathFieldsEdge('220226356', { ...ENV, fetchImpl: hit, now })
    expect(hit).toHaveBeenCalledTimes(2)

    const miss = jsonFetch([])
    await getListingCanonicalPathFieldsEdge('220000010', { ...ENV, fetchImpl: miss, now })
    clock += 30_000
    await getListingCanonicalPathFieldsEdge('220000010', { ...ENV, fetchImpl: miss, now })
    expect(miss).toHaveBeenCalledTimes(1)
    clock += 31_000
    await getListingCanonicalPathFieldsEdge('220000010', { ...ENV, fetchImpl: miss, now })
    expect(miss).toHaveBeenCalledTimes(2)

    const err = jsonFetch({}, 503)
    await getListingCanonicalPathFieldsEdge('220000011', { ...ENV, fetchImpl: err, now })
    await getListingCanonicalPathFieldsEdge('220000011', { ...ENV, fetchImpl: err, now })
    expect(err).toHaveBeenCalledTimes(2)
  })
})
