/**
 * GSC slide fix (2026-10-05): an injected database failure on a listing path
 * answers 503 + Retry-After + no-store through the REAL middleware and the REAL
 * edge reader (only global fetch is stubbed), and a healthy read still renders.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'
import { resetListingCanonicalEdgeCache } from '@/lib/data/listings/getListingCanonicalPathFieldsEdge'
import {
  isListingLookupUnavailable,
  listingTemporarilyUnavailableResponse,
  readListingForRequest,
  LISTING_RETRY_TIMEOUT_MS,
} from './listing-unavailable'

const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const CANONICAL = '/homes-for-sale/bend/providence/1522-locksley-220226356'
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

function req(path: string) {
  return new NextRequest(new URL(path, 'https://ryan-realty.com'), {
    headers: { 'user-agent': UA, host: 'ryan-realty.com' },
  })
}

describe('listing lookup failure answers 503 (real middleware, real edge reader)', () => {
  beforeEach(() => {
    resetListingCanonicalEdgeCache()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('a statement timeout from PostgREST (HTTP 500) is a 503, retried once', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout' }), {
          status: 500,
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = await middleware(req(CANONICAL))
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe('120')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).not.toMatch(/noindex/i)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('a refused connection is a 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    expect((await middleware(req(CANONICAL))).status).toBe(503)
  })

  it('a healthy read renders the canonical (200 pass-through), and a miss renders the refusal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([LOCKSLEY]), { status: 200 })))
    const ok = await middleware(req(CANONICAL))
    expect(ok.status).toBe(200)
    expect(ok.headers.get('x-middleware-next')).toBe('1')
    resetListingCanonicalEdgeCache()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })))
    expect((await middleware(req('/homes-for-sale/bend/1-nowhere-999999998'))).status).toBe(200)
  })

  it('missing Supabase env (a preview without secrets) never 503s', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await middleware(req(CANONICAL))).status).toBe(200)
  })
})

describe('readListingForRequest', () => {
  it('reads once when the first read answers, and retries at the page ceiling only on a transient error', async () => {
    const reader = vi.fn(async () => ({ kind: 'miss' as const }))
    await readListingForRequest('220226356', reader)
    expect(reader).toHaveBeenCalledTimes(1)
    const flaky = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'error', reason: 'timeout', transient: true })
      .mockResolvedValueOnce({ kind: 'miss' })
    expect(await readListingForRequest('220226356', flaky)).toEqual({ kind: 'miss' })
    expect(flaky).toHaveBeenLastCalledWith('220226356', { timeoutMs: LISTING_RETRY_TIMEOUT_MS })
    const config = vi.fn(async () => ({ kind: 'error' as const, reason: 'HTTP 401', transient: false }))
    await readListingForRequest('220226356', config)
    expect(config).toHaveBeenCalledTimes(1)
  })

  it('only a transient error counts as unavailable', () => {
    expect(isListingLookupUnavailable({ kind: 'error', reason: 'x', transient: true })).toBe(true)
    expect(isListingLookupUnavailable({ kind: 'error', reason: 'x', transient: false })).toBe(false)
    expect(isListingLookupUnavailable({ kind: 'miss' })).toBe(false)
  })

  it('the response is 503, Retry-After 120, no-store, and carries no noindex anywhere', async () => {
    const res = listingTemporarilyUnavailableResponse('HTTP 503')
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe('120')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-robots-tag')).toBeNull()
    expect(await res.text()).not.toMatch(/noindex|—/)
  })
})
