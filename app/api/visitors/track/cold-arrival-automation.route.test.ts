/**
 * /api/visitors/track and the cold-arrival automation rules (2026-10-14,
 * lib/analytics/automation.ts, docs/TRACKING_POLICY.md "Automation"), against
 * the in-memory stand-in for the tables the route writes.
 *
 * Pinned: a cold arrival from a long-superseded desktop Chrome build, or from a
 * datacenter town, is stored and flagged provisionally (at every consent tier,
 * from the request headers, which are not stored at essential); its first view
 * never reaches GA4; a section render or a repeat view of the landing page does
 * not clear it; a scroll, another page, or identification does. A person who
 * arrived from somewhere we can name is never flagged. A HeadlessChrome client
 * hint is permanent automation and identifies nobody.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeVisitorDb } from '@/test/fake-visitor-db'
import { signPersonLinkToken } from '@/lib/identity/link-token'
import { personCookieValue } from '@/lib/identity/person-cookie'

const store = createFakeVisitorDb()
const spies = vi.hoisted(() => ({ ga4: vi.fn(async () => undefined) }))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => store.client }))
vi.mock('@/lib/data/leads/listingAlerts', () => ({ stampListingAlertsCrmPerson: vi.fn() }))
vi.mock('@/lib/data/crm/personExistsById', () => ({ personExistsById: vi.fn(async () => true) }))
vi.mock('@/lib/data/crm/recordGpcSuppression', () => ({ recordGpcSuppression: vi.fn(async () => ({ ok: true, recorded: false })) }))
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: spies.ga4,
  clientIdFromGaCookie: () => null,
  clientIdFromSessionId: (s: string) => s,
}))
vi.mock('@/lib/crm/broker-alerts', () => ({ queueReturnVisitAlert: vi.fn(async () => true) }))
vi.mock('@/lib/crm/cma-engagement', () => ({ queueCmaOpenedAlert: vi.fn(async () => true), cmaSlugFromDocumentUrl: () => null }))
vi.mock('@/lib/cma/doc-links', () => ({ cmaCampaignFromUrl: () => null }))

import { POST } from './route'

const desktop = (platform: string, major: number) =>
  `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
// The measured crawler: 667 sessions in 14 days on exactly this string.
const STALE_UA = desktop('X11; Linux x86_64', 150)
const CURRENT_UA = desktop('Macintosh; Intel Mac OS X 10_15_7', 154)
const LANDING = 'https://ryan-realty.com/homes-for-sale/bend/southwest-bend'
const PERSON = 64115
const VID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
const sid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

type Opts = { ua?: string; headers?: Record<string, string>; cookies?: Record<string, string> }

function track(body: Record<string, unknown>, opts: Opts = {}): Promise<Response> {
  const cookie = Object.entries(opts.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return POST(
    new NextRequest('https://ryan-realty.com/api/visitors/track', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://ryan-realty.com',
        'user-agent': opts.ua ?? STALE_UA,
        ...(cookie ? { cookie } : {}),
        ...(opts.headers ?? {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

const event = (sessionId: string, over: Record<string, unknown> = {}) => ({
  sessionId,
  sourceDomain: 'ryan-realty.com',
  eventType: 'page_view',
  pageUrl: LANDING,
  pageCategory: 'search',
  consent: 'essential',
  landingPage: LANDING,
  campaign: { source: 'direct', medium: 'none' },
  ...over,
})

const geo = (city: string, region: string) => ({
  'x-vercel-ip-country': 'US',
  'x-vercel-ip-country-region': region,
  'x-vercel-ip-city': encodeURIComponent(city),
})

beforeEach(() => {
  // The stale-browser rule reads the request time against the Chrome release
  // table, so the clock is pinned: Chrome 154 is current on this day and
  // Chrome 150 long superseded (lib/analytics/chrome-releases.ts).
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T18:00:00Z'))
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  process.env.GA4_API_SECRET = 'test-secret'
  store.reset()
  spies.ga4.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('stale-browser: a long-superseded desktop Chrome on a cold arrival', () => {
  it('is stored, flagged provisionally from the header at the essential tier, and kept out of GA4', async () => {
    await track(event(sid(1)))
    const row = store.session(sid(1))!
    expect(row).toMatchObject({ is_automated: true, automation_reason: 'stale-browser', crm_person_id: null })
    // read to classify, never stored at essential
    expect(row.user_agent).toBeUndefined()
    expect(spies.ga4).not.toHaveBeenCalled()
  })

  it('a section rendering in view or a repeat view of the landing page does not clear it', async () => {
    await track(event(sid(2)))
    await track(event(sid(2), { eventType: 'section_view', metadata: { section: 'hero' } }))
    await track(event(sid(2), { pageUrl: `${LANDING}?sort=newest&statusFilter=active&page=1` }))
    expect(store.session(sid(2))).toMatchObject({ is_automated: true, automation_reason: 'stale-browser' })
  })

  it('a scroll clears it', async () => {
    await track(event(sid(3)))
    await track(event(sid(3), { eventType: 'scroll_depth', consent: 'all', metadata: { percent: 25 } }))
    expect(store.session(sid(3))).toMatchObject({ is_automated: false, automation_reason: null })
  })

  it('moving on to another page clears it', async () => {
    await track(event(sid(4)))
    await track(event(sid(4), { pageUrl: 'https://ryan-realty.com/homes-for-sale/bend' }))
    expect(store.session(sid(4))).toMatchObject({ is_automated: false, automation_reason: null })
  })

  it('a still-flagged session sends nothing to GA4 until it shows a person, then mirrors', async () => {
    await track(event(sid(11)))
    await track(event(sid(11), { pageUrl: `${LANDING}?page=2` })) // a re-render of the landing page
    expect(spies.ga4).not.toHaveBeenCalled()
    await track(event(sid(11), { pageUrl: 'https://ryan-realty.com/homes-for-sale/bend' }))
    expect(store.session(sid(11))).toMatchObject({ is_automated: false })
    expect(spies.ga4).toHaveBeenCalledTimes(1)
  })

  it('a session whose first event already shows a person is never flagged', async () => {
    await track(event(sid(5), { eventType: 'cta_click' }))
    expect(store.session(sid(5))).toMatchObject({ is_automated: false })
  })

  it('a person who arrived from somewhere we can name is never flagged, whatever the build', async () => {
    await track(event(sid(6), { referrer: 'https://www.google.com/' }))
    await track(event(sid(7), { landingPage: `${LANDING}?utm_source=crm&utm_medium=email`, pageUrl: `${LANDING}?utm_source=crm&utm_medium=email` }))
    expect(store.session(sid(6))).toMatchObject({ is_automated: false })
    expect(store.session(sid(7))).toMatchObject({ is_automated: false })
  })

  it('a current build on the same cold arrival is never flagged, and its view is mirrored', async () => {
    await track(event(sid(8)), { ua: CURRENT_UA })
    expect(store.session(sid(8))).toMatchObject({ is_automated: false })
    expect(spies.ga4).toHaveBeenCalledTimes(1)
  })

  it('a browser the identity map knows is identified at birth, and the flag is cleared', async () => {
    store.db.visitor_identity_map.push({ rr_vid: VID, crm_person_id: PERSON, fub_person_id: PERSON, identify_source: 'form_submit' })
    await track(event(sid(9)), { cookies: { rr_vid: VID } })
    expect(store.session(sid(9))).toMatchObject({ crm_person_id: PERSON, is_automated: false, automation_reason: null })
  })

  it('the signed rr_pid cookie identifies the session, and the flag is cleared', async () => {
    await track(event(sid(10)), { cookies: { rr_vid: VID, rr_pid: personCookieValue(PERSON) } })
    expect(store.session(sid(10))).toMatchObject({ crm_person_id: PERSON, is_automated: false, automation_reason: null })
  })
})

describe('datacenter-geo: a cold arrival from a datacenter town', () => {
  it('is flagged provisionally, with the town stored at the analytics tier', async () => {
    await track(event(sid(20), { consent: 'analytics' }), { ua: CURRENT_UA, headers: geo('Santa Clara', 'CA') })
    expect(store.session(sid(20))).toMatchObject({
      is_automated: true,
      automation_reason: 'datacenter-geo',
      ip_city: 'Santa Clara',
      ip_region: 'CA',
    })
  })

  it('a person whose address changes mid-session (a VPN, a carrier) is still cleared by a scroll', async () => {
    await track(event(sid(24)), { ua: CURRENT_UA, headers: geo('Ashburn', 'VA') })
    expect(store.session(sid(24))).toMatchObject({ is_automated: true, automation_reason: 'datacenter-geo' })
    await track(event(sid(24), { eventType: 'scroll_depth', consent: 'all' }), { ua: CURRENT_UA, headers: geo('Bend', 'OR') })
    expect(store.session(sid(24))).toMatchObject({ is_automated: false, automation_reason: null })
  })

  it('reads only the geo Vercel sets: a client-sent cf-ipcity neither flags nor hides a session', async () => {
    await track(event(sid(25)), { ua: CURRENT_UA, headers: { 'cf-ipcity': 'Santa Clara', 'cf-region': 'CA', 'cf-ipcountry': 'US' } })
    expect(store.session(sid(25))).toMatchObject({ is_automated: false })
    await track(event(sid(26)), { ua: CURRENT_UA, headers: { ...geo('Council Bluffs', 'IA'), 'cf-ipcity': 'Bend', 'cf-region': 'OR' } })
    expect(store.session(sid(26))).toMatchObject({ is_automated: true, automation_reason: 'datacenter-geo' })
  })

  it('a town this brokerage serves is never flagged, Prineville and its datacenters included', async () => {
    await track(event(sid(21)), { ua: CURRENT_UA, headers: geo('Prineville', 'OR') })
    await track(event(sid(22)), { ua: CURRENT_UA, headers: geo('Bend', 'OR') })
    expect(store.session(sid(21))).toMatchObject({ is_automated: false })
    expect(store.session(sid(22))).toMatchObject({ is_automated: false })
  })

  it('a person from a datacenter town who arrived from a search is never flagged', async () => {
    await track(event(sid(23), { referrer: 'https://www.google.com/' }), { ua: CURRENT_UA, headers: geo('Santa Clara', 'CA') })
    expect(store.session(sid(23))).toMatchObject({ is_automated: false })
  })
})

describe('a malformed geo header', () => {
  it('never throws the request; the session is still recorded', async () => {
    const res = await track(event(sid(40)), { ua: CURRENT_UA, headers: { 'cf-ipcity': '%E0%A4%A', 'x-vercel-ip-country': 'US' } })
    expect(res.status).toBe(200)
    expect(store.session(sid(40))).toMatchObject({ is_automated: false })
  })
})

describe('a HeadlessChrome client hint', () => {
  it('is permanent automation, even behind a desktop user agent and a signed token', async () => {
    const res = await track(event(sid(30), { identityToken: signPersonLinkToken(PERSON, 'email'), referrer: 'https://mail.google.com/' }), {
      ua: CURRENT_UA,
      cookies: { rr_vid: VID },
      headers: { 'sec-ch-ua': '"Chromium";v="154", "Not.A/Brand";v="24", "HeadlessChrome";v="154"' },
    })
    expect(((await res.json()) as { identity?: { identifiedNow?: boolean } }).identity?.identifiedNow).toBe(false)
    expect(store.session(sid(30))).toMatchObject({ is_automated: true, automation_reason: 'headless', crm_person_id: null })
    // a person's later event on it does not clear a permanent class
    await track(event(sid(30), { eventType: 'scroll_depth', consent: 'all' }), { ua: CURRENT_UA })
    expect(store.session(sid(30))).toMatchObject({ is_automated: true, automation_reason: 'headless' })
  })
})
