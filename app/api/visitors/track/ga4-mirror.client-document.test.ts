/**
 * The GA4 page_view mirror and the client-document tracker (Matt 2026-09-29).
 *
 * /api/visitors/track mirrors page views to GA4 through the Measurement Protocol,
 * except when the browser's own gtag is already counting the view: a consented
 * tier (analytics or all) AND a `_ga` cookie means "client gtag is live, do not
 * double count". A raw-HTML client document (/cma/<slug>, /bpo/<slug>) loads no
 * gtag at all. Until the document tracker sent the visitor's real tier it always
 * posted at 'essential', so every report open was mirrored; sending the real tier
 * would have made a consented reader with a `_ga` cookie vanish from GA4. The
 * guard's premise is false on a document, so a client-document view is always
 * mirrored, and every other page keeps the double-count guard.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeVisitorDb } from '@/test/fake-visitor-db'

const store = createFakeVisitorDb()
const ga4 = vi.hoisted(() => ({ fire: vi.fn(async () => undefined) }))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => store.client }))
vi.mock('@/lib/data/leads/listingAlerts', () => ({ stampListingAlertsCrmPerson: vi.fn() }))
vi.mock('@/lib/data/crm/personExistsById', () => ({ personExistsById: vi.fn(async () => true) }))
vi.mock('@/lib/data/crm/recordGpcSuppression', () => ({ recordGpcSuppression: vi.fn(async () => ({ ok: true, recorded: false })) }))
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: ga4.fire,
  // GA1.1.<client id> -> <client id>, as the real parser reads the cookie
  clientIdFromGaCookie: (v: string | undefined) => (v ? v.replace(/^GA\d+\.\d+\./, '') : null),
  clientIdFromSessionId: (s: string) => s,
}))
vi.mock('@/lib/crm/broker-alerts', () => ({ queueReturnVisitAlert: vi.fn(async () => true) }))
vi.mock('@/lib/crm/cma-engagement', () => ({
  queueCmaOpenedAlert: vi.fn(async () => true),
  cmaSlugFromDocumentUrl: () => null,
}))
vi.mock('@/lib/cma/doc-links', () => ({ cmaCampaignFromUrl: () => null }))

import { POST } from './route'

const HUMAN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const SESSION = '00000000-0000-4000-8000-000000000042'
const GA_COOKIE = 'GA1.1.1234567890.1700000000'
const DOC = 'https://ryan-realty.com/cma/cma-828-florida?utm_source=cma&utm_medium=email&utm_campaign=cma-828-florida'

function track(body: Record<string, unknown>, cookies: Record<string, string> = {}): Promise<Response> {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return POST(
    new NextRequest('https://ryan-realty.com/api/visitors/track', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://ryan-realty.com',
        'user-agent': HUMAN_UA,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

const pageView = (over: Record<string, unknown>) => ({
  sessionId: SESSION,
  sourceDomain: 'ryan-realty.com',
  eventType: 'page_view',
  ...over,
})

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  store.reset()
  ga4.fire.mockClear()
})

describe('a client document view is always mirrored to GA4 (the document runs no gtag)', () => {
  it.each(['all', 'analytics'])('a %s-tier reader with a _ga cookie is still mirrored, once, on the cookie client id', async (consent) => {
    const res = await track(pageView({ pageUrl: DOC, pageCategory: 'client-document', consent }), { _ga: GA_COOKIE })
    expect(res.status).toBe(200)
    expect(ga4.fire).toHaveBeenCalledTimes(1)
    expect(ga4.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'page_view',
        clientId: '1234567890.1700000000',
        eventParams: expect.objectContaining({ page_location: DOC }),
      }),
    )
  })

  it('an essential-tier reader is mirrored, as it always was', async () => {
    await track(pageView({ pageUrl: DOC, pageCategory: 'client-document', consent: 'essential' }), { _ga: GA_COOKIE })
    expect(ga4.fire).toHaveBeenCalledTimes(1)
  })

  it('a consented reader with no _ga cookie is mirrored on the session client id', async () => {
    await track(pageView({ pageUrl: DOC, pageCategory: 'client-document', consent: 'all' }))
    expect(ga4.fire).toHaveBeenCalledTimes(1)
    expect(ga4.fire).toHaveBeenCalledWith(expect.objectContaining({ clientId: SESSION }))
  })
})

describe('every other page keeps the double-count guard', () => {
  it.each(['all', 'analytics'])('a %s-tier visitor with a _ga cookie on a site page is NOT mirrored (client gtag is counting it)', async (consent) => {
    await track(pageView({ pageUrl: 'https://ryan-realty.com/homes-for-sale/bend', pageCategory: 'search', consent }), { _ga: GA_COOKIE })
    expect(ga4.fire).not.toHaveBeenCalled()
  })

  it('an essential-tier visitor on a site page is mirrored (client gtag is consent-denied)', async () => {
    await track(pageView({ pageUrl: 'https://ryan-realty.com/homes-for-sale/bend', pageCategory: 'search', consent: 'essential' }), { _ga: GA_COOKIE })
    expect(ga4.fire).toHaveBeenCalledTimes(1)
  })
})
