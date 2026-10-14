import { afterEach, describe, expect, it, vi } from 'vitest'
import { clientIdFromGaCookie, fireGa4Event, isNonProductionPageLocation } from './ga4-measurement-protocol'
import { isNonProductionRequestHost } from './analytics/non-production-host'

describe('clientIdFromGaCookie — last two numeric dot parts', () => {
  it('reads the standard GA1.x.random.timestamp cookie', () => {
    expect(clientIdFromGaCookie('GA1.1.1234567890.1700000000')).toBe('1234567890.1700000000')
    expect(clientIdFromGaCookie('GA1.2.123.456')).toBe('123.456')
  })

  it('accepts a bare digits.digits value and extra prefixes', () => {
    expect(clientIdFromGaCookie('123.456')).toBe('123.456')
    expect(clientIdFromGaCookie('  GS1.1.99.88  ')).toBe('99.88')
    expect(clientIdFromGaCookie('foo.bar.111.222')).toBe('111.222')
  })

  it('rejects missing, minted-uuid, and non-numeric tails', () => {
    expect(clientIdFromGaCookie(null)).toBeNull()
    expect(clientIdFromGaCookie('')).toBeNull()
    expect(clientIdFromGaCookie('GA1.1')).toBeNull()
    expect(clientIdFromGaCookie('6b1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f')).toBeNull()
    expect(clientIdFromGaCookie('GA1.1.abc.def')).toBeNull()
  })
})

describe('isNonProductionPageLocation — our own browsing is not analytics', () => {
  // Measured 2026-08-26: 43 sessions reached the production GA4 property as a
  // `127.0.0.1:8777` referral. Local development, sitting in the reports beside
  // real traffic and counted as a referral source.
  it.each([
    'http://localhost:3000/housing-market/bend',
    'http://app.localhost:3000/',
    'http://127.0.0.1:8777/',
    'http://0.0.0.0:3000/search',
    'http://[::1]:3000/',
    'http://mac-mini.local:3000/',
    'https://ryanrealty-abc123.vercel.app/listings', // staging-host-ok: fixture asserting we BLOCK this host, not a link we emit
    'http://site.test/',
    'http://192.168.1.20:3000/',
    'http://10.0.0.8:3000/',
    'http://172.16.0.4:8777/',
    'https://ryan-realty.com.evil.example/',
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

describe('isNonProductionRequestHost — spoofed pageUrl vs the request Host', () => {
  it.each(['127.0.0.1:3000', '127.0.0.1:8777', 'localhost:3000', '0.0.0.0:3000', '[::1]:3000', '192.168.1.20:3000'])(
    'blocks Host %s',
    (host) => {
      expect(isNonProductionRequestHost(host)).toBe(true)
    },
  )

  it.each(['ryan-realty.com', 'www.ryan-realty.com', 'seller.ryan-realty.com', 'ryan-realty.com:443'])(
    'allows Host %s',
    (host) => {
      expect(isNonProductionRequestHost(host)).toBe(false)
    },
  )

  it('fails OPEN on a missing Host so a stripped header cannot drop real visitors', () => {
    expect(isNonProductionRequestHost(null)).toBe(false)
    expect(isNonProductionRequestHost('')).toBe(false)
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

  it('refuses a LAN page_location the denylist used to miss', async () => {
    vi.stubEnv('GA4_MEASUREMENT_ID', 'G-TEST')
    vi.stubEnv('GA4_API_SECRET', 'secret')
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await fireGa4Event({
      eventName: 'page_view',
      clientId: '1.2',
      eventParams: { page_location: 'http://192.168.1.20:3000/' },
    })
    expect(res).toMatchObject({ ok: false, error: 'NON_PRODUCTION_HOST' })
    expect(fetchMock).not.toHaveBeenCalled()
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

/**
 * No personal information reaches GA4 (Matt 2026-10-14). Every server sender
 * goes through fireGa4Event, so it is the one place that holds the rule for all
 * of them: generate_lead, valuation_requested (which sent `cma_slug`, the
 * subject's street address, until 2026-10-14), person_identified, the page-view
 * mirror and its campaign_details.
 */
describe('fireGa4Event sends GA4 no personal information, whatever the caller passes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('a CMA view: no address slug, title or person param reaches the payload', async () => {
    vi.stubEnv('GA4_MEASUREMENT_ID', 'G-TEST')
    vi.stubEnv('GA4_API_SECRET', 'secret')
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await fireGa4Event({
      eventName: 'page_view',
      clientId: '1.2',
      precedingEvents: [{ name: 'campaign_details', params: { source: 'cma', medium: 'email', campaign: 'cma-828-florida', campaign_id: 'cma-828-florida' } }],
      userProperties: { assigned_broker: 'matt', email: 'pat@example.com' },
      eventParams: {
        page_location: 'https://ryan-realty.com/cma/cma-828-florida?utm_campaign=cma-828-florida&rr_doc=cma-828-florida',
        page_path: '/cma/cma-828-florida',
        page_title: 'Pricing report · 828 NW Florida Ave · Bend, OR 97703',
        page_referrer: 'https://ryan-realty.com/sell?address=828%20NW%20Florida%20Ave',
        cma_slug: 'cma-828-florida',
        cma_id: '0b7d5c1e-1111-4222-8333-444455556666',
        thing: 'pat@example.com',
      },
    })
    const raw = String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)
    expect(raw).not.toMatch(/828|florida|example\.com/i)
    const body = JSON.parse(raw)
    expect(body.events[0].params).toMatchObject({ campaign: 'cma-letter', campaign_id: 'cma-letter' })
    expect(body.events[1].params).toMatchObject({
      page_location: 'https://ryan-realty.com/cma/[document]?utm_campaign=cma-letter',
      page_path: '/cma/[document]',
      page_title: 'CMA',
      page_referrer: 'https://ryan-realty.com/sell',
      cma_id: '0b7d5c1e-1111-4222-8333-444455556666',
    })
    expect(body.events[1].params).not.toHaveProperty('cma_slug')
    expect(body.events[1].params).not.toHaveProperty('thing')
    expect(body.user_properties).toEqual({ assigned_broker: { value: 'matt' } })
  })

  it('a lead submitted from /sell?address= keeps its page, minus the address', async () => {
    vi.stubEnv('GA4_MEASUREMENT_ID', 'G-TEST')
    vi.stubEnv('GA4_API_SECRET', 'secret')
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await fireGa4Event({
      eventName: 'generate_lead',
      clientId: '1.2',
      eventParams: { lead_type: 'seller_valuation', form_id: 'sell_value', page_location: 'https://ryan-realty.com/sell?address=61234%20SE%20River%20Rd&utm_source=gbp' },
    })
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.events[0].params).toMatchObject({ lead_type: 'seller_valuation', form_id: 'sell_value', page_location: 'https://ryan-realty.com/sell?utm_source=gbp' })
  })
})

describe('sessionFromGaStreamCookie (the _ga_<stream> cookie)', () => {
  it('reads the GS1 format', async () => {
    const { sessionFromGaStreamCookie } = await import('./ga4-measurement-protocol')
    expect(sessionFromGaStreamCookie('GS1.1.1760400000.4.1.1760400123.0.0.0')).toEqual({ sessionId: '1760400000', sessionNumber: 4 })
  })
  it('reads the GS2 format', async () => {
    const { sessionFromGaStreamCookie } = await import('./ga4-measurement-protocol')
    expect(sessionFromGaStreamCookie('GS2.1.s1760400000$o12$g1$t1760400123$j60$l0$h0')).toEqual({ sessionId: '1760400000', sessionNumber: 12 })
  })
  it('returns null for a missing or malformed cookie', async () => {
    const { sessionFromGaStreamCookie } = await import('./ga4-measurement-protocol')
    expect(sessionFromGaStreamCookie(undefined)).toBeNull()
    expect(sessionFromGaStreamCookie('')).toBeNull()
    expect(sessionFromGaStreamCookie('GA1.1.123.456')).toBeNull()
    expect(sessionFromGaStreamCookie('GS2.1.o3$g1')).toBeNull()
  })
  it('names the stream cookie from the measurement id', async () => {
    const { gaStreamCookieName } = await import('./ga4-measurement-protocol')
    expect(gaStreamCookieName('G-ST40W4WM6T')).toBe('_ga_ST40W4WM6T')
  })
})
