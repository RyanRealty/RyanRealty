/**
 * /api/visitors/track, against an in-memory stand-in for the three tables it
 * writes. What is pinned here is the server half of the 2026-09-29 tracked-email
 * fixes:
 *
 *  - SESSIONS END NOW (lib/analytics/visitor-session.ts), so the route sees many
 *    more brand-new session ids on a browser it already knows. Identity must
 *    still stitch across every one of them, exactly as before: a signed token on
 *    the link, else the durable rr_vid in visitor_identity_map (rr_vid_carryover),
 *    else the signed rr_pid cookie, and a session owned by someone else is never
 *    reassigned.
 *  - A session born on a client document carries the campaign on the link, and
 *    the route still never rewrites a session's first-touch fields.
 *  - AUTOMATION never identifies anyone and never texts a broker: not the
 *    "they opened your report" alert, not the "looking at this home" alert.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeVisitorDb } from '@/test/fake-visitor-db'
import { signPersonLinkToken } from '@/lib/identity/link-token'
import { personCookieValue } from '@/lib/identity/person-cookie'

const store = createFakeVisitorDb()
const alerts = vi.hoisted(() => ({
  cmaOpened: vi.fn(async () => true),
  returnVisit: vi.fn(async () => true),
  personExists: vi.fn(async () => true),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => store.client }))
vi.mock('@/lib/data/leads/listingAlerts', () => ({ stampListingAlertsCrmPerson: vi.fn() }))
vi.mock('@/lib/data/crm/personExistsById', () => ({ personExistsById: alerts.personExists }))
vi.mock('@/lib/data/crm/recordGpcSuppression', () => ({ recordGpcSuppression: vi.fn(async () => ({ ok: true, recorded: false })) }))
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: vi.fn(async () => undefined),
  clientIdFromGaCookie: () => null,
  clientIdFromSessionId: (s: string) => s,
}))
vi.mock('@/lib/crm/broker-alerts', () => ({ queueReturnVisitAlert: alerts.returnVisit }))
vi.mock('@/lib/crm/cma-engagement', () => ({
  queueCmaOpenedAlert: alerts.cmaOpened,
  cmaSlugFromDocumentUrl: (u: string | null | undefined) => {
    const m = String(u ?? '').match(/\/cma\/([a-z0-9-]{3,80})/i)
    return m ? m[1]!.toLowerCase() : null
  },
}))
vi.mock('@/lib/cma/doc-links', () => ({
  cmaCampaignFromUrl: (u: string | null | undefined) => {
    try {
      const c = (new URL(String(u), 'https://ryan-realty.com').searchParams.get('utm_campaign') ?? '').toLowerCase()
      return c.startsWith('cma-') ? c : null
    } catch {
      return null
    }
  },
}))

import { POST } from './route'

const HUMAN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const SLUG = 'cma-828-florida'
const PERSON = 64115
const OTHER_PERSON = 70001
const VID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
const sid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function track(
  body: Record<string, unknown>,
  opts: { cookies?: Record<string, string>; ua?: string } = {},
): Promise<Response> {
  const cookie = Object.entries(opts.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return POST(
    new NextRequest('https://ryan-realty.com/api/visitors/track', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://ryan-realty.com',
        'user-agent': opts.ua ?? HUMAN_UA,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

const view = (sessionId: string, over: Record<string, unknown> = {}) => ({
  sessionId,
  sourceDomain: 'ryan-realty.com',
  eventType: 'page_view',
  pageUrl: 'https://ryan-realty.com/homes-for-sale',
  pageCategory: 'search',
  consent: 'essential',
  ...over,
})

const docView = (sessionId: string, over: Record<string, unknown> = {}) => {
  const url = `https://ryan-realty.com/cma/${SLUG}?utm_source=cma&utm_medium=email&utm_campaign=${SLUG}&utm_content=agent-matt&agent=matt`
  return view(sessionId, {
    pageUrl: url,
    pageCategory: 'client-document',
    landingPage: url,
    campaign: { source: 'cma', medium: 'email', campaign: SLUG, content: 'agent-matt' },
    referrer: 'https://mail.google.com/',
    ...over,
  })
}

/** The track route's JSON answer, as far as these tests read it. */
type TrackAnswer = {
  ok?: boolean
  dropped?: boolean
  reason?: string
  rotateSession?: boolean
  identity?: { identifiedNow: boolean }
}

async function json(res: Response): Promise<TrackAnswer> {
  return (await res.json()) as TrackAnswer
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  store.reset()
  alerts.cmaOpened.mockClear()
  alerts.returnVisit.mockClear()
  alerts.personExists.mockClear()
  alerts.personExists.mockResolvedValue(true)
})

describe('a session born on a report carries the campaign on the link', () => {
  it('stores the campaign, referrer and landing page, with the person token stripped from every stored URL', async () => {
    const token = signPersonLinkToken(PERSON, 'document')
    const url = `https://ryan-realty.com/cma/${SLUG}?utm_source=cma&utm_medium=email&utm_campaign=${SLUG}&agent=matt&_pid=${token}`
    const res = await track(docView(sid(1), { pageUrl: url, landingPage: url, identityToken: token, consent: 'all' }), {
      cookies: { rr_vid: VID },
    })
    expect(res.status).toBe(200)

    const row = store.session(sid(1))!
    expect(row).toMatchObject({
      utm_source: 'cma',
      utm_medium: 'email',
      utm_campaign: SLUG,
      utm_content: 'agent-matt',
      referrer: 'https://mail.google.com/',
      rr_vid: VID,
      source_domain: 'ryan-realty.com',
    })
    expect(row.user_agent).toBe(HUMAN_UA) // 'all' tier: the header is kept
    expect(String(row.landing_page)).toContain(`/cma/${SLUG}?utm_source=cma`)
    expect(String(row.landing_page)).not.toContain('_pid')
    const event = store.db.visitor_events[0]
    expect(event).toMatchObject({ session_id: sid(1), event_type: 'page_view', page_category: 'client-document' })
    expect(String(event.page_url)).not.toContain('_pid')
    expect(String(event.page_url)).toContain(`utm_campaign=${SLUG}`)
    // and the recipient is identified by the token, in that same request
    expect(row).toMatchObject({ crm_person_id: PERSON, identified_via: 'tracked_link:document' })
  })

  it('never rewrites first-touch: the reason a browser-lifetime session id lost every later campaign', async () => {
    await track(view(sid(2), { campaign: { source: 'facebook', medium: 'paid' }, landingPage: 'https://ryan-realty.com/' }))
    await track(docView(sid(2)))
    expect(store.session(sid(2))).toMatchObject({ utm_source: 'facebook', utm_medium: 'paid' })
    expect(store.session(sid(2))!.utm_campaign).toBeUndefined()
    // ...which is why the tracker now ends a session on a new campaign: the next
    // tagged arrival is a new session id, and a new row carries its own campaign.
    await track(docView(sid(3)))
    expect(store.session(sid(3))).toMatchObject({ utm_source: 'cma', utm_campaign: SLUG })
  })

  it('records a session born on a tap or a scroll with the same attribution, at every tier that stores anything', async () => {
    await track(
      view(sid(4), {
        eventType: 'cta_click',
        pageCategory: 'client-document',
        pageUrl: `https://ryan-realty.com/cma/${SLUG}`,
        consent: 'essential',
        campaign: { source: 'cma', medium: 'email', campaign: SLUG },
        landingPage: `https://ryan-realty.com/cma/${SLUG}?utm_source=cma`,
        referrer: 'https://mail.google.com/',
      }),
    )
    expect(store.session(sid(4))).toMatchObject({ utm_source: 'cma', utm_campaign: SLUG, referrer: 'https://mail.google.com/' })
    // essential keeps the campaign and referrer but never the user agent (docs/TRACKING_POLICY.md)
    expect(store.session(sid(4))!.user_agent).toBeUndefined()
  })
})

describe('a NEW session on a browser we already know is identified exactly as before', () => {
  it('by the signed token on the link, and it maps the browser so the next session is born identified', async () => {
    const token = signPersonLinkToken(PERSON, 'email')
    const res = await track(view(sid(10), { identityToken: token }), { cookies: { rr_vid: VID } })
    const body = await json(res)
    expect(body.identity?.identifiedNow).toBe(true)
    expect(store.session(sid(10))).toMatchObject({ crm_person_id: PERSON, identified_via: 'tracked_link:email' })
    expect(store.db.visitor_identity_map).toEqual([
      expect.objectContaining({ rr_vid: VID, crm_person_id: PERSON, identify_source: 'tracked_link:email' }),
    ])
    // the response hands the browser its signed rr_pid cookie
    expect(res.headers.get('set-cookie')).toContain('rr_pid=')
  })

  it('by rr_vid_carryover when the new session carries no token at all', async () => {
    store.db.visitor_identity_map.push({ rr_vid: VID, crm_person_id: PERSON, fub_person_id: PERSON, identify_source: 'tracked_link:email' })
    const res = await track(view(sid(11)), { cookies: { rr_vid: VID } })
    expect((await json(res)).identity?.identifiedNow).toBe(true)
    expect(store.session(sid(11))).toMatchObject({ crm_person_id: PERSON, identified_via: 'rr_vid_carryover' })
    // carryover does not rewrite where the identification first came from
    expect(store.db.visitor_identity_map[0].identify_source).toBe('tracked_link:email')
  })

  it('by a token for the same person on a fresh session, after the browser idled out of its old one', async () => {
    await track(view(sid(12), { identityToken: signPersonLinkToken(PERSON, 'email') }), { cookies: { rr_vid: VID } })
    // 40 minutes later: a new session id, the same browser, a second tagged email
    const res = await track(docView(sid(13), { identityToken: signPersonLinkToken(PERSON, 'document') }), { cookies: { rr_vid: VID } })
    expect(res.status).toBe(200)
    expect(store.session(sid(12))).toMatchObject({ crm_person_id: PERSON })
    expect(store.session(sid(13))).toMatchObject({ crm_person_id: PERSON, identified_via: 'tracked_link:document', utm_campaign: SLUG })
  })

  it('by the signed rr_pid cookie on a browser the identity map has never seen', async () => {
    const res = await track(view(sid(14)), { cookies: { rr_vid: VID, rr_pid: personCookieValue(PERSON) } })
    expect((await json(res)).identity?.identifiedNow).toBe(true)
    expect(store.session(sid(14))).toMatchObject({ crm_person_id: PERSON, identified_via: 'rr_pid_cookie' })
  })

  it('an unsigned _pid or an unknown browser leaves the new session anonymous', async () => {
    await track(view(sid(15), { identityToken: String(PERSON) }), { cookies: { rr_vid: VID } })
    await track(view(sid(16)), { cookies: { rr_vid: '11111111-2222-4333-8444-555555555555' } })
    expect(store.session(sid(15))!.crm_person_id).toBeNull()
    expect(store.session(sid(16))!.crm_person_id).toBeNull()
  })

  it('a new session on a shared browser is the person who clicked, and earlier sessions stay theirs', async () => {
    store.db.visitor_identity_map.push({ rr_vid: VID, crm_person_id: PERSON, fub_person_id: PERSON, identify_source: 'form_submit' })
    store.db.visitor_sessions.push({ session_id: sid(17), rr_vid: VID, crm_person_id: PERSON, identified_at: '2026-09-28T00:00:00Z' })
    const res = await track(view(sid(18), { identityToken: signPersonLinkToken(OTHER_PERSON, 'email') }), { cookies: { rr_vid: VID } })
    expect((await json(res)).identity?.identifiedNow).toBe(true)
    expect(store.session(sid(18))).toMatchObject({ crm_person_id: OTHER_PERSON, identified_via: 'tracked_link:email' })
    expect(store.session(sid(17))).toMatchObject({ crm_person_id: PERSON })
  })

  it('still answers rotateSession, and writes nothing, when the session id in hand belongs to someone else', async () => {
    store.db.visitor_sessions.push({ session_id: sid(19), rr_vid: VID, crm_person_id: PERSON, identified_at: '2026-09-28T00:00:00Z' })
    const before = store.db.visitor_events.length
    const res = await track(view(sid(19), { identityToken: signPersonLinkToken(OTHER_PERSON, 'email') }), { cookies: { rr_vid: VID } })
    expect(await json(res)).toMatchObject({ ok: true, rotateSession: true })
    expect(store.db.visitor_events).toHaveLength(before)
    expect(store.session(sid(19))).toMatchObject({ crm_person_id: PERSON })
  })

  it('a declined visitor is still recorded nowhere, however the session began', async () => {
    const res = await track(view(sid(20), { consent: 'declined', identityToken: signPersonLinkToken(PERSON, 'email') }), {
      cookies: { rr_vid: VID },
    })
    expect(await json(res)).toMatchObject({ ok: true, dropped: true })
    expect(store.db.visitor_sessions).toHaveLength(0)
    expect(store.db.visitor_events).toHaveLength(0)
  })
})

describe('automation never identifies anyone and never texts a broker', () => {
  it('a crawler that follows the tracked link is counted, flagged, and identified as nobody', async () => {
    const token = signPersonLinkToken(PERSON, 'document')
    const res = await track(docView(sid(30), { identityToken: token, consent: 'essential' }), {
      cookies: { rr_vid: VID },
      ua: GOOGLEBOT_UA,
    })
    expect((await json(res)).identity?.identifiedNow).toBe(false)
    expect(store.session(sid(30))).toMatchObject({ is_automated: true, automation_reason: 'declared-crawler', crm_person_id: null })
    expect(store.db.visitor_identity_map).toEqual([])
    expect(alerts.cmaOpened).not.toHaveBeenCalled()
  })

  it('does not fire "they opened the report" for a scanner that renders the document, with or without a token', async () => {
    await track(docView(sid(31)), { ua: GOOGLEBOT_UA })
    await track(docView(sid(32), { identityToken: signPersonLinkToken(PERSON, 'document') }), { ua: 'python-requests/2.31' })
    await track(docView(sid(33), { webdriver: true }), { ua: HUMAN_UA }) // a headless browser with a normal user agent
    expect(alerts.cmaOpened).not.toHaveBeenCalled()
    expect(store.session(sid(33))).toMatchObject({ is_automated: true, automation_reason: 'webdriver' })
  })

  it('the same document view from a person still alerts the broker (the control)', async () => {
    await track(docView(sid(34), { identityToken: signPersonLinkToken(PERSON, 'document') }), { cookies: { rr_vid: VID } })
    expect(alerts.cmaOpened).toHaveBeenCalledTimes(1)
    expect(alerts.cmaOpened).toHaveBeenCalledWith({ slug: SLUG, crmPersonId: PERSON, trigger: 'document' })
  })

  it('does not fire the looking-at alert for automation on an identified session, but does for a person', async () => {
    const listing = (sessionId: string, over: Record<string, unknown> = {}) =>
      view(sessionId, {
        eventType: 'listing_view',
        pageCategory: 'listing_detail',
        pageUrl: 'https://ryan-realty.com/homes-for-sale/bend/1-elm-st-201201234',
        consent: 'all',
        listing: { mlsNumber: '201201234', street: '1 Elm St' },
        ...over,
      })
    // a session that was already identified (an earlier person visit on it)
    store.db.visitor_sessions.push({ session_id: sid(35), rr_vid: VID, crm_person_id: PERSON, identified_at: '2026-09-28T00:00:00Z' })
    store.db.visitor_sessions.push({ session_id: sid(36), rr_vid: VID, crm_person_id: PERSON, identified_at: '2026-09-28T00:00:00Z' })

    await track(listing(sid(35)), { ua: GOOGLEBOT_UA })
    expect(alerts.returnVisit).not.toHaveBeenCalled()

    await track(listing(sid(36)))
    expect(alerts.returnVisit).toHaveBeenCalledTimes(1)
    expect(alerts.returnVisit).toHaveBeenCalledWith(expect.objectContaining({ crmPersonId: PERSON, sessionId: sid(36), listingKey: '201201234' }))
  })

  it('a session flagged only by the provisional contact-deep-link shape is still identified when a person arrives with a token', async () => {
    const res = await track(
      view(sid(37), {
        pageUrl: 'https://ryan-realty.com/contact?listingKey=201201234',
        landingPage: 'https://ryan-realty.com/contact?listingKey=201201234',
        identityToken: signPersonLinkToken(PERSON, 'email'),
      }),
      { cookies: { rr_vid: VID } },
    )
    expect((await json(res)).identity?.identifiedNow).toBe(true)
    expect(store.session(sid(37))).toMatchObject({ crm_person_id: PERSON, is_automated: false })
  })
})
