/**
 * The GA4 page_view mirror and the client-document tracker (Matt 2026-09-29).
 *
 * /api/visitors/track mirrors page views to GA4 through the Measurement Protocol
 * when the browser is not counting them. On a site page, analytics/all view
 * events are not mirrored (the Google tag counts them; gating on `_ga` double-
 * counted the first hit). Essential-tier views are still mirrored. A raw-HTML
 * client document (/cma/<slug>, /bpo/<slug>) loads no gtag, so its views are
 * always mirrored, whatever the tier.
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
const { CMA_ID, BPO_ID } = vi.hoisted(() => ({ CMA_ID: '0b7d5c1e-1111-4222-8333-444455556666', BPO_ID: '9f8e7d6c-5555-4666-8777-888899990000' }))
vi.mock('@/lib/data/cma/documents', () => ({ getCmaIdBySlug: vi.fn(async (slug: string) => (slug === 'cma-828-florida' ? CMA_ID : null)) }))
vi.mock('@/lib/data/bpo/reads', () => ({ getBpoIdBySlug: vi.fn(async () => BPO_ID) }))

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
        // GA4-safe: the address slug is /cma/[document], the legacy
        // utm_campaign=<slug> is the program campaign (Matt 2026-10-14).
        eventParams: expect.objectContaining({
          page_location: 'https://ryan-realty.com/cma/[document]?utm_source=cma&utm_medium=email&utm_campaign=cma-letter',
          cma_id: CMA_ID,
        }),
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

  it.each(['all', 'analytics'])('a %s-tier visitor without a _ga cookie on a site page is NOT mirrored (first hit would double-count)', async (consent) => {
    await track(pageView({ pageUrl: 'https://ryan-realty.com/homes-for-sale/bend', pageCategory: 'search', consent }))
    expect(ga4.fire).not.toHaveBeenCalled()
  })

  it('an essential-tier visitor on a site page is mirrored (client gtag is consent-denied)', async () => {
    await track(pageView({ pageUrl: 'https://ryan-realty.com/homes-for-sale/bend', pageCategory: 'search', consent: 'essential' }), { _ga: GA_COOKIE })
    expect(ga4.fire).toHaveBeenCalledTimes(1)
  })
})

/**
 * No person addresses in GA4 (Matt 2026-10-14). A CMA's slug is the subject's
 * street address and its title names it; before this the mirror sent both as
 * page_location, page_path and page_title. The view is still counted and
 * attributable: /cma/[document] plus the CMA's opaque row id.
 */
describe('a client document reaches GA4 without the subject address', () => {
  const sent = () => JSON.stringify((ga4.fire.mock.calls as unknown[][]).map((c) => c[0]))

  it('a CMA view: /cma/[document], cma_id, a fixed title, and the address nowhere in what is sent', async () => {
    await track(
      pageView({
        pageUrl: `${DOC}&rr_doc=cma-828-florida`,
        pageTitle: 'Pricing report · 828 NW Florida Ave · Bend, OR 97703',
        referrer: 'https://ryan-realty.com/sell?address=828%20NW%20Florida%20Ave',
        pageCategory: 'client-document',
        consent: 'essential',
        campaign: { source: 'cma', medium: 'email', campaign: 'cma-828-florida' },
        visit: { id: Math.floor(Date.now() / 1000), number: 1, start: true },
      }),
      { _ga: GA_COOKIE },
    )
    expect(ga4.fire).toHaveBeenCalledTimes(1)
    expect(ga4.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        eventParams: expect.objectContaining({
          page_location: 'https://ryan-realty.com/cma/[document]?utm_source=cma&utm_medium=email&utm_campaign=cma-letter',
          page_path: '/cma/[document]',
          page_title: 'CMA',
          page_referrer: 'https://ryan-realty.com/sell',
          cma_id: CMA_ID,
        }),
      }),
    )
    expect(sent()).not.toMatch(/828|florida/i)
  })

  it('a BPO view: /bpo/[document] and bpo_id', async () => {
    await track(
      pageView({
        pageUrl: 'https://ryan-realty.com/bpo/bpo-61234-se-river-rd-bend',
        pageTitle: 'Broker Price Opinion · 61234 SE River Rd',
        pageCategory: 'client-document',
        consent: 'essential',
      }),
    )
    expect(ga4.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        eventParams: expect.objectContaining({ page_location: 'https://ryan-realty.com/bpo/[document]', page_title: 'Broker price opinion', bpo_id: BPO_ID }),
      }),
    )
    expect(sent()).not.toMatch(/61234|river/i)
  })

  it('a site page view with a typed address is mirrored without it', async () => {
    await track(pageView({ pageUrl: 'https://ryan-realty.com/sell?address=12%20Elm%20St&from=%2F', pageCategory: 'seller', consent: 'essential' }))
    expect(ga4.fire).toHaveBeenCalledWith(
      expect.objectContaining({ eventParams: expect.objectContaining({ page_location: 'https://ryan-realty.com/sell?from=%2F' }) }),
    )
    expect(sent()).not.toMatch(/Elm/)
  })
})
