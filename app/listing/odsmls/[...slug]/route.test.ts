/**
 * Legacy /listing/odsmls/<mls>/... redirect: a lookup that ERRORS is a 503,
 * never the permanent 308 to search a missing listing gets (2026-10-05).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const lookup = vi.fn()
vi.mock('@/lib/data', () => ({ getListingLookup: (key: string) => lookup(key) }))
vi.mock('@/lib/slug', () => ({
  listingCanonicalHref: () => '/homes-for-sale/bend/providence/1522-locksley-220226356',
  listingsBrowsePath: () => '/homes-for-sale',
}))

import { GET } from './route'

function call(path: string) {
  const slug = path.split('/').filter(Boolean)
  return GET(new NextRequest(new URL(`/listing/odsmls/${path}`, 'https://ryan-realty.com')), {
    params: Promise.resolve({ slug }),
  })
}

describe('odsmls legacy redirect', () => {
  beforeEach(() => lookup.mockReset())

  it('a database error answers 503 + Retry-After + no-store, not a 308', async () => {
    lookup.mockResolvedValue({ kind: 'error' })
    const res = await call('220226356/bend/1522-locksley')
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe('120')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('a resolved listing 308s to its canonical, a missing one 308s to search', async () => {
    lookup.mockResolvedValue({ kind: 'ok', listing: {} })
    let res = await call('220226356/bend/1522-locksley')
    expect(res.status).toBe(308)
    expect(new URL(res.headers.get('location') as string).pathname).toBe('/homes-for-sale/bend/providence/1522-locksley-220226356')
    lookup.mockResolvedValue({ kind: 'missing' })
    res = await call('220226356/bend/1522-locksley')
    expect(res.status).toBe(308)
    expect(new URL(res.headers.get('location') as string).pathname).toBe('/homes-for-sale')
  })
})
