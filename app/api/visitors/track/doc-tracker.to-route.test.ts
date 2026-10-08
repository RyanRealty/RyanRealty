/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/"}
 *
 * The client-document tracker talking to the real /api/visitors/track route, end
 * to end: the script is executed in a browser-shaped page, what it sends is handed
 * to the route handler, and the rows the route writes are inspected. This is the
 * whole of break 1 (Matt 2026-09-29): a report opened BEFORE any public page
 * creates the session, so the campaign on the link has to be on that first row.
 * The route half of the identity story lives in new-session-identity.test.ts.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeVisitorDb } from '@/test/fake-visitor-db'
import { signPersonLinkToken } from '@/lib/identity/link-token'
import { encodeConsent } from '@/test/consent-fixtures'
import { clearBrowserState, docTrackerHarness, setConsentCookie, type TrackerCall } from '@/test/doc-tracker-harness'

const store = createFakeVisitorDb()
const alerts = vi.hoisted(() => ({ cmaOpened: vi.fn(async () => true) }))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => store.client }))
vi.mock('@/lib/data/leads/listingAlerts', () => ({ stampListingAlertsCrmPerson: vi.fn() }))
vi.mock('@/lib/data/crm/personExistsById', () => ({ personExistsById: vi.fn(async () => true) }))
vi.mock('@/lib/data/crm/recordGpcSuppression', () => ({ recordGpcSuppression: vi.fn(async () => ({ ok: true, recorded: false })) }))
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: vi.fn(async () => undefined),
  clientIdFromGaCookie: () => null,
  clientIdFromSessionId: (s: string) => s,
}))
vi.mock('@/lib/crm/broker-alerts', () => ({ queueReturnVisitAlert: vi.fn(async () => true) }))
vi.mock('@/lib/crm/cma-engagement', () => ({
  queueCmaOpenedAlert: alerts.cmaOpened,
  cmaSlugFromDocumentUrl: (u: string | null | undefined) => {
    const m = String(u ?? '').match(/\/cma\/([a-z0-9-]{3,80})/i)
    return m ? m[1]!.toLowerCase() : null
  },
}))
vi.mock('@/lib/cma/doc-links', () => ({ cmaCampaignFromUrl: () => null }))

import { POST } from './route'

// The signing secret falls back to the service key, so it must be set BEFORE a token
// is minted, or the token is signed with one secret and verified with another.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

const MIN = 60 * 1000
const T0 = Date.UTC(2026, 8, 29, 18, 0, 0)
const SLUG = 'cma-828-florida'
const PERSON = 64115
const VID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
const TOKEN = signPersonLinkToken(PERSON, 'document')
const HUMAN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const EMAIL_LINK = `/cma/${SLUG}?utm_source=cma&utm_campaign=${SLUG}&agent=matt&utm_medium=email&utm_content=agent-matt&_pid=${TOKEN}`

const h = docTrackerHarness()

/** Hand each post the script makes to the real route, as the browser would (with the middleware's rr_vid cookie). */
function routeResponder(ua = HUMAN_UA) {
  return async (call: TrackerCall): Promise<Record<string, unknown>> => {
    if (call.url !== '/api/visitors/track') return {}
    const res = await POST(
      new NextRequest('https://ryan-realty.com/api/visitors/track', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://ryan-realty.com',
          'user-agent': ua,
          cookie: `rr_vid=${VID}`,
        },
        body: JSON.stringify(call.body),
      }),
    )
    return (await res.json()) as Record<string, unknown>
  }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  store.reset()
  alerts.cmaOpened.mockClear()
  clearBrowserState()
  h.install()
  h.respondWith(routeResponder())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  h.uninstall()
})

describe('a report opened first', () => {
  it('creates the session with the campaign, referrer and landing page on the link, and identifies the recipient', async () => {
    document.cookie = 'rr_cr=0; path=/'
    h.load({ url: EMAIL_LINK, referrer: 'https://mail.google.com/' })
    await h.flush()

    expect(store.db.visitor_sessions).toHaveLength(1)
    const row = store.db.visitor_sessions[0]
    expect(row).toMatchObject({
      utm_source: 'cma',
      utm_medium: 'email',
      utm_campaign: SLUG,
      utm_content: 'agent-matt',
      referrer: 'https://mail.google.com/',
      rr_vid: VID,
      crm_person_id: PERSON,
      identified_via: 'tracked_link:document',
    })
    // landing page is the real address, with the person token taken out
    expect(String(row.landing_page)).toBe(`https://ryan-realty.com/cma/${SLUG}?utm_source=cma&utm_campaign=${SLUG}&agent=matt&utm_medium=email&utm_content=agent-matt`)
    // a campaign link with no banner answer is granted the campaign-link tier, so the user agent is kept too
    expect(row.user_agent).toBe(HUMAN_UA)
    expect(store.db.visitor_events).toHaveLength(1)
    expect(store.db.visitor_events[0]).toMatchObject({ event_type: 'page_view', page_category: 'client-document' })
    expect(String(store.db.visitor_events[0].page_url)).not.toContain('_pid')
    expect(store.db.visitor_identity_map).toEqual([expect.objectContaining({ rr_vid: VID, crm_person_id: PERSON })])
    // and the broker hears about it once, for the recipient
    expect(alerts.cmaOpened).toHaveBeenCalledWith({ slug: SLUG, crmPersonId: PERSON, trigger: 'document' })
  })

  it('a tap on a comp is the same session, and the same session keeps its first-touch fields', async () => {
    h.load({ url: EMAIL_LINK, referrer: 'https://mail.google.com/' })
    await h.flush()
    h.tap('https://ryan-realty.com/homes-for-sale/bend/1-elm-st-201201234?utm_source=cma&utm_medium=document&utm_campaign=cma-828-florida', 'See this home')
    await h.flush()

    expect(store.db.visitor_sessions).toHaveLength(1)
    expect(store.db.visitor_events.map((e) => e.event_type)).toEqual(['page_view', 'cta_click'])
    expect(store.db.visitor_events[1].metadata).toMatchObject({
      destination: 'https://ryan-realty.com/homes-for-sale/bend/1-elm-st-201201234?utm_source=cma&utm_medium=document&utm_campaign=cma-828-florida',
    })
  })

  it('opened again after more than 30 minutes, the next visit is a new session that still knows who it is', async () => {
    h.load({ url: EMAIL_LINK, referrer: 'https://mail.google.com/' })
    await h.flush()
    vi.setSystemTime(T0 + 45 * MIN)
    // the address the reader comes back to has no token (a bookmark, or the link with the token stripped)
    h.load({ url: `/cma/${SLUG}?utm_source=cma&utm_campaign=${SLUG}` })
    await h.flush()

    expect(store.db.visitor_sessions).toHaveLength(2)
    const [first, second] = store.db.visitor_sessions
    expect(second.session_id).not.toBe(first.session_id)
    expect(second).toMatchObject({ utm_source: 'cma', utm_campaign: SLUG, crm_person_id: PERSON, identified_via: 'rr_vid_carryover' })
  })

  it('a different campaign is a new session carrying its own campaign, identified the same way', async () => {
    h.load({ url: EMAIL_LINK })
    await h.flush()
    vi.setSystemTime(T0 + MIN)
    h.load({ url: '/cma/cma-901-other?utm_source=crm&utm_medium=email&utm_campaign=fall-market&agent=matt' })
    await h.flush()

    expect(store.db.visitor_sessions).toHaveLength(2)
    expect(store.db.visitor_sessions[1]).toMatchObject({
      utm_source: 'crm',
      utm_medium: 'email',
      utm_campaign: 'fall-market',
      crm_person_id: PERSON,
      identified_via: 'rr_vid_carryover',
    })
  })
})

describe('the visitors the script must not record', () => {
  it('a visitor who declined reaches the route with nothing', async () => {
    setConsentCookie(encodeConsent({ analytics: false, marketing: false }))
    h.load({ url: EMAIL_LINK })
    await h.flush()
    h.tap('https://ryan-realty.com/reviews', 'Reviews')
    await h.flush()
    expect(h.calls).toEqual([])
    expect(store.db.visitor_sessions).toEqual([])
    expect(store.db.visitor_events).toEqual([])
    expect(store.db.visitor_identity_map).toEqual([])
  })

  it('a browser driven by automation is counted and flagged, and neither identified nor announced to a broker', async () => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: true })
    h.load({ url: EMAIL_LINK })
    await h.flush()

    expect(store.db.visitor_sessions).toHaveLength(1)
    expect(store.db.visitor_sessions[0]).toMatchObject({ is_automated: true, automation_reason: 'webdriver', crm_person_id: null })
    expect(store.db.visitor_identity_map).toEqual([])
    expect(alerts.cmaOpened).not.toHaveBeenCalled()
  })

  it('a crawler user agent is flagged the same way', async () => {
    h.respondWith(routeResponder('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'))
    h.load({ url: EMAIL_LINK })
    await h.flush()
    expect(store.db.visitor_sessions[0]).toMatchObject({ is_automated: true, automation_reason: 'declared-crawler', crm_person_id: null })
    expect(alerts.cmaOpened).not.toHaveBeenCalled()
  })
})
