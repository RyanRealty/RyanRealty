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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeVisitorDb } from '@/test/fake-visitor-db'
import { signPersonLinkToken } from '@/lib/identity/link-token'
import { ga4UserIdFor, ga4UserIdForPerson } from '@/lib/analytics/ga4-user-id'

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
  // the real parser (the mirror reads the slug only to look up the CMA's opaque id)
  cmaSlugFromDocumentUrl: (u: string | null | undefined) => String(u ?? '').match(/\/cma\/([a-z0-9-]{3,80})/i)?.[1]?.toLowerCase() ?? null,
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
  // the mirror reads a document's opaque id only when it can send (fireGa4Event is mocked)
  vi.stubEnv('GA4_API_SECRET', 'test-secret')
  store.reset()
  ga4.fire.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
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

  it('an essential-tier reader is NOT mirrored (Matt 2026-10-14: no analytics consent)', async () => {
    await track(pageView({ pageUrl: DOC, pageCategory: 'client-document', consent: 'essential' }), { _ga: GA_COOKIE })
    // a document send would land after the response (its id is read first): give it time
    await new Promise((r) => setTimeout(r, 250))
    expect(ga4.fire).not.toHaveBeenCalled()
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

  // Matt 2026-10-14: those hits carried no source (most of GA4's "(not set)"
  // sessions) and the visitor had not consented. visitor_events still has them.
  it('an essential-tier page_view on a site page is NEVER mirrored', async () => {
    await track(pageView({ pageUrl: 'https://ryan-realty.com/homes-for-sale/bend', pageCategory: 'search', consent: 'essential' }), { _ga: GA_COOKIE })
    await track(pageView({ pageUrl: 'https://ryan-realty.com/homes-for-sale/bend', pageCategory: 'search', consent: 'essential', eventType: 'listing_view' }))
    expect(ga4.fire).not.toHaveBeenCalled()
    expect(store.session(SESSION)).toBeTruthy()
  })

  it('an essential-tier intent event is not mirrored; at the analytics tier it is', async () => {
    await track(pageView({ pageUrl: 'https://ryan-realty.com/sell', pageCategory: 'seller', consent: 'essential', eventType: 'intent_declared' }))
    expect(ga4.fire).not.toHaveBeenCalled()
    await track(pageView({ pageUrl: 'https://ryan-realty.com/sell', pageCategory: 'seller', consent: 'analytics', eventType: 'intent_declared' }))
    await vi.waitFor(() => expect(ga4.fire).toHaveBeenCalledTimes(1))
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
  // The mirror runs after the response (next/server after(); outside a request
  // it runs at once) and reads the document's id first, so wait for the send.
  const fired = () => vi.waitFor(() => expect(ga4.fire).toHaveBeenCalled())

  it('a CMA view: /cma/[document], cma_id, a fixed title, and the address nowhere in what is sent', async () => {
    await track(
      pageView({
        pageUrl: `${DOC}&rr_doc=cma-828-florida`,
        pageTitle: 'Pricing report · 828 NW Florida Ave · Bend, OR 97703',
        referrer: 'https://ryan-realty.com/sell?address=828%20NW%20Florida%20Ave',
        pageCategory: 'client-document',
        consent: 'analytics',
        campaign: { source: 'cma', medium: 'email', campaign: 'cma-828-florida' },
        visit: { id: Math.floor(Date.now() / 1000), number: 1, start: true },
      }),
      { _ga: GA_COOKIE },
    )
    await fired()
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
        consent: 'analytics',
      }),
    )
    await fired()
    expect(ga4.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        eventParams: expect.objectContaining({ page_location: 'https://ryan-realty.com/bpo/[document]', page_title: 'Broker price opinion', bpo_id: BPO_ID }),
      }),
    )
    expect(sent()).not.toMatch(/61234|river/i)
  })

  it('an intent event on a page holding a typed address is mirrored without it', async () => {
    await track(pageView({ pageUrl: 'https://ryan-realty.com/sell?address=12%20Elm%20St&from=%2F', pageCategory: 'seller', consent: 'analytics', eventType: 'intent_declared' }))
    await fired()
    expect(ga4.fire).toHaveBeenCalledWith(
      expect.objectContaining({ eventParams: expect.objectContaining({ page_location: 'https://ryan-realty.com/sell?from=%2F' }) }),
    )
    expect(sent()).not.toMatch(/Elm/)
  })
})

describe('a known contact\'s mirrored hit carries the hashed user id the browser tag uses (analytics tier only)', () => {
  const PERSON = 64115
  const VID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
  const UID = ga4UserIdForPerson(PERSON)
  // fireGa4Event derives the user_id from knownContact (lib/ga4-measurement-protocol.ts).
  type Fired = { knownContact?: { personId: number | null; trackingLevel: string } | null }
  const sentUserId = () => {
    const k = (ga4.fire.mock.calls.at(-1) as unknown as [Fired] | undefined)?.[0]?.knownContact
    return k ? ga4UserIdFor(k.personId, k.trackingLevel as 'all') : null
  }

  it.each(['all', 'analytics'])('the report view that identifies a %s-tier recipient carries it (identify runs before the mirror)', async (consent) => {
    const token = signPersonLinkToken(PERSON, 'document')
    await track(pageView({ pageUrl: `${DOC}&_pid=${token}`, pageCategory: 'client-document', consent }), { rr_vid: VID })
    expect(store.session(SESSION)).toMatchObject({ crm_person_id: PERSON })
    expect(ga4.fire).toHaveBeenCalledTimes(1)
    expect(sentUserId()).toBe(UID)
    // the token and the raw id never ride in a mirrored parameter
    const arg = (ga4.fire.mock.calls[0] as unknown as [{ eventParams: unknown; userProperties: unknown; precedingEvents: unknown }])[0]
    const sent = JSON.stringify([arg.eventParams, arg.userProperties, arg.precedingEvents])
    expect(sent).not.toContain(token)
    expect(sent).not.toContain(String(PERSON))
  })

  it('a returning browser (identity map) reading at the analytics tier carries it', async () => {
    store.db.visitor_identity_map.push({ rr_vid: VID, crm_person_id: PERSON })
    await track(pageView({ pageUrl: DOC, pageCategory: 'client-document', consent: 'all' }), { rr_vid: VID })
    expect(sentUserId()).toBe(UID)
  })

  it('an essential-tier recipient is identified first-party and sent to GA4 not at all (Matt 2026-10-14)', async () => {
    const token = signPersonLinkToken(PERSON, 'document')
    await track(pageView({ pageUrl: `${DOC}&_pid=${token}`, pageCategory: 'client-document', consent: 'essential' }), { rr_vid: VID })
    expect(store.session(SESSION)).toMatchObject({ crm_person_id: PERSON })
    await new Promise((r) => setTimeout(r, 250))
    expect(ga4.fire).not.toHaveBeenCalled()
  })

  it('a known contact on an essential-tier site page is not mirrored', async () => {
    store.db.visitor_identity_map.push({ rr_vid: VID, crm_person_id: PERSON })
    await track(pageView({ pageUrl: 'https://ryan-realty.com/homes-for-sale/bend', pageCategory: 'search', consent: 'essential' }), { rr_vid: VID })
    expect(store.session(SESSION)).toMatchObject({ crm_person_id: PERSON })
    expect(ga4.fire).not.toHaveBeenCalled()
  })

  it('an anonymous reader carries none', async () => {
    await track(pageView({ pageUrl: DOC, pageCategory: 'client-document', consent: 'all' }))
    expect(ga4.fire).toHaveBeenCalledTimes(1)
    expect(sentUserId()).toBeNull()
  })
})
