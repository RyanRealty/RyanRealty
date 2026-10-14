import { describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve({ get: () => null }),
}))

import { ga4ContextFromRequest, ga4ServerEventParams, ga4ServerSendAllowed } from './ga4-server-context'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const jar = (c: Record<string, string>) => ({ get: (n: string) => (n in c ? { value: c[n] } : undefined) })

function ctx(over: Partial<Parameters<typeof ga4ContextFromRequest>[0]> = {}) {
  const cookies = { _ga: 'GA1.1.111.222', _ga_ST40W4WM6T: 'GS2.1.s1760400000$o3$g1$t1760400100' }
  return ga4ContextFromRequest({
    cookieStore: jar(cookies),
    cookieHeader: '_ga=GA1.1.111.222',
    referer: 'https://ryan-realty.com/sell?utm_source=fb',
    userAgent: UA,
    secGpc: null,
    host: 'ryan-realty.com',
    ...over,
  })
}

describe('ga4ContextFromRequest', () => {
  it('reads client id, browser session and page', () => {
    const c = ctx()
    expect(c.clientId).toBe('111.222')
    expect(c.session).toEqual({ sessionId: '1760400000', sessionNumber: 3 })
    expect(c.pageLocation).toBe('https://ryan-realty.com/sell?utm_source=fb')
    expect(ga4ServerSendAllowed(c)).toBe(true)
  })

  it('with no Referer, judges the Host the request reached', () => {
    expect(ga4ServerSendAllowed(ctx({ referer: '', host: 'ryan-realty.com' }))).toBe(true)
    expect(ga4ServerSendAllowed(ctx({ referer: '', host: 'preview.example.com' }))).toBe(false)
    expect(ga4ServerSendAllowed(ctx({ referer: '', host: 'localhost:3000' }))).toBe(false)
  })

  it('a provider webhook skips page and automation rules but not consent or a broker browser', () => {
    const webhook = ctx({ referer: '', host: null, userAgent: 'facebookexternalua' })
    expect(ga4ServerSendAllowed(webhook)).toBe(false)
    expect(ga4ServerSendAllowed(webhook, { serverToServer: true })).toBe(true)
    expect(ga4ServerSendAllowed(ctx({ referer: '', cookieHeader: 'rr_internal=1' }), { serverToServer: true })).toBe(false)
    expect(ga4ServerSendAllowed(ctx({ referer: '', secGpc: '1' }), { serverToServer: true })).toBe(false)
  })
})

describe('ga4ServerEventParams', () => {
  it('puts identity keys first, then the session, so GA4s 25-param cap keeps them', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]))
    const out = ga4ServerEventParams(ctx(), { ...many, lead_type: 'buyer_question', form_id: 'contact' })
    const keys = Object.keys(out)
    expect(keys.slice(0, 5)).toEqual(['lead_type', 'form_id', 'session_id', 'session_number', 'page_location'])
  })

  it('a caller key never replaces the browser session', () => {
    const out = ga4ServerEventParams(ctx(), { session_id: 'rr-first-party', page_location: '/elsewhere', lead_type: 'seller' })
    expect(out.session_id).toBe('1760400000')
    expect(out.page_location).toBe('https://ryan-realty.com/sell?utm_source=fb')
  })

  it('with no context, passes params through', () => {
    expect(ga4ServerEventParams(null, { a: 1, lead_type: 'x' })).toEqual({ lead_type: 'x', a: 1 })
  })
})
