import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireGa4Event, isNonProductionPageLocation } from './ga4-measurement-protocol'

describe('isNonProductionPageLocation — our own browsing is not analytics', () => {
  // Measured 2026-08-26: 43 sessions reached the production GA4 property as a
  // `127.0.0.1:8777` referral. Local development, sitting in the reports beside
  // real traffic and counted as a referral source.
  it.each([
    'http://localhost:3000/housing-market/bend',
    'http://127.0.0.1:8777/',
    'http://0.0.0.0:3000/search',
    'http://mac-mini.local:3000/',
    'https://ryanrealty-abc123.vercel.app/listings', // staging-host-ok: fixture asserting we BLOCK this host, not a link we emit
    'http://site.test/',
  ])('blocks %s', (url) => {
    expect(isNonProductionPageLocation(url)).toBe(true)
  })

  it.each([
    'https://ryan-realty.com/',
    'https://www.ryan-realty.com/housing-market/bend',
    'https://ryan-realty.com/lp/seller-home-value?utm_source=facebook',
  ])('allows %s', (url) => {
    expect(isNonProductionPageLocation(url)).toBe(false)
  })

  it('fails OPEN on anything it cannot parse — losing real analytics is worse', () => {
    expect(isNonProductionPageLocation(undefined)).toBe(false)
    expect(isNonProductionPageLocation('')).toBe(false)
    expect(isNonProductionPageLocation('not a url')).toBe(false)
    expect(isNonProductionPageLocation(42)).toBe(false)
  })

  it('does not block a production host that merely CONTAINS a dev word', () => {
    expect(isNonProductionPageLocation('https://localhost.ryan-realty.com/')).toBe(false)
    expect(isNonProductionPageLocation('https://ryan-realty.com/localhost')).toBe(false)
  })
})

describe('fireGa4Event — per-visit session + campaign_details (TRACK-1, P7)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('prepends campaign_details in the same request and carries the visit session onto it', async () => {
    vi.stubEnv('GA4_MEASUREMENT_ID', 'G-TEST')
    vi.stubEnv('GA4_API_SECRET', 'secret')
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await fireGa4Event({
      eventName: 'page_view',
      clientId: '123.456',
      precedingEvents: [{ name: 'campaign_details', params: { source: 'google', medium: 'organic' } }],
      eventParams: { page_location: 'https://ryan-realty.com/sell', session_id: 1790000000, session_number: 3 },
    })
    expect(res.ok).toBe(true)
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.events.map((e: { name: string }) => e.name)).toEqual(['campaign_details', 'page_view'])
    expect(body.events[0].params).toMatchObject({ source: 'google', medium: 'organic', session_id: 1790000000, session_number: 3 })
    expect(body.events[1].params).toMatchObject({ session_id: 1790000000, session_number: 3, engagement_time_msec: 100 })
  })

  it('sends only the event itself when nothing precedes it', async () => {
    vi.stubEnv('GA4_MEASUREMENT_ID', 'G-TEST')
    vi.stubEnv('GA4_API_SECRET', 'secret')
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await fireGa4Event({ eventName: 'page_view', clientId: '1.2', eventParams: { page_location: 'https://ryan-realty.com/' } })
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.events).toHaveLength(1)
  })
})
