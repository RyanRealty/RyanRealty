/**
 * P14 wiring: middleware.ts answers a non-canonical listing path with a real
 * 308 BEFORE render, keeps the query string, and lets the canonical, unknown
 * keys and lookup failures through untouched. The Edge reader is mocked; the
 * hop and the URL builder are real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const lookup = vi.fn()
vi.mock('@/lib/data/listings/getListingCanonicalPathFieldsEdge', () => ({
  getListingCanonicalPathFieldsEdge: (id: string) => lookup(id),
}))

import { middleware } from '@/middleware'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const LOCKSLEY = {
  ListingKey: '20260731160357907738000000',
  ListNumber: '220226356',
  StreetNumber: '1522',
  StreetName: 'Locksley',
  City: 'Bend',
  State: 'OR',
  PostalCode: '97703',
  SubdivisionName: 'Providence',
}
const CANONICAL = '/homes-for-sale/bend/providence/1522-locksley-220226356'

function req(path: string) {
  return new NextRequest(new URL(path, 'https://ryan-realty.com'), {
    headers: { 'user-agent': UA, host: 'ryan-realty.com' },
  })
}

describe('middleware listing canonical hop', () => {
  beforeEach(() => {
    lookup.mockReset()
    lookup.mockImplementation(async (id: string) =>
      id === '220226356' || id === LOCKSLEY.ListingKey ? { kind: 'row', row: LOCKSLEY } : { kind: 'miss' },
    )
  })

  it("308s the Search Console variant (1,657 impressions) to the canonical, keeping the query", async () => {
    const res = await middleware(req('/homes-for-sale/bend/1522-locksley-220226356?utm_source=gbp'))
    expect(res.status).toBe(308)
    const loc = new URL(res.headers.get('location') as string, 'https://ryan-realty.com')
    expect(loc.pathname).toBe(CANONICAL)
    expect(loc.search).toBe('?utm_source=gbp')
    expect(res.headers.get('cache-control')).toBe('private, max-age=86400')
  })

  it('308s the pre-P14 four-segment canonical, the outside-boundaries shape and /listing/<ListingKey>', async () => {
    for (const p of [
      '/homes-for-sale/bend/mountain-view/providence/1522-locksley-220226356',
      '/homes-for-sale/outside-boundaries/providence/1522-locksley-220226356',
      `/listing/${LOCKSLEY.ListingKey}`,
    ]) {
      const res = await middleware(req(p))
      expect(res.status, p).toBe(308)
      expect(new URL(res.headers.get('location') as string, 'https://ryan-realty.com').pathname).toBe(CANONICAL)
    }
  })

  it('passes the canonical through to render', async () => {
    const res = await middleware(req(CANONICAL))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('an unknown key or a failed lookup renders as before (no hop, no 404)', async () => {
    let res = await middleware(req('/homes-for-sale/bend/rr-smoke-no-such-listing-999999999'))
    expect(res.status).toBe(200)
    lookup.mockImplementation(async () => ({ kind: 'error', reason: 'timeout' }))
    res = await middleware(req('/homes-for-sale/bend/1522-locksley-220226356'))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('a screened bot gets its 403 without costing a lookup', async () => {
    const res = await middleware(
      new NextRequest(new URL('/homes-for-sale/bend/1522-locksley-220226356', 'https://ryan-realty.com'), {
        headers: { 'user-agent': 'python-requests/2.31', host: 'ryan-realty.com' },
      }),
    )
    expect(res.status).toBe(403)
    expect(lookup).not.toHaveBeenCalled()
  })

  it("skips the App Router's own prefetch and navigation requests (no lookup per card)", async () => {
    const flightHeaders: Record<string, string>[] = [{ rsc: '1' }, { 'next-router-prefetch': '1' }]
    for (const headers of flightHeaders) {
      const res = await middleware(
        new NextRequest(new URL('/homes-for-sale/bend/1522-locksley-220226356', 'https://ryan-realty.com'), {
          headers: { 'user-agent': UA, host: 'ryan-realty.com', ...headers },
        }),
      )
      expect(res.status).toBe(200)
    }
    await middleware(req('/homes-for-sale/bend/1522-locksley-220226356?_rsc=abc12'))
    expect(lookup).not.toHaveBeenCalled()
  })

  it('never looks up a non-listing path', async () => {
    await middleware(req('/homes-for-sale/bend/tetherow'))
    await middleware(req('/cities/bend'))
    expect(lookup).not.toHaveBeenCalled()
  })
})
