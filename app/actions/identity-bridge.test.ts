/**
 * The identify server actions and automation (Matt 2026-09-29).
 *
 * identifyPersonFromEmailClickNative is the second identification path behind a
 * tracked link (the first is /api/visitors/track), and identifyAuthenticatedSession
 * bridges a signed-in visitor. Both ignored the automation class: an email
 * security scanner that rendered the link ran the action and the contact was
 * cookied, GA4-tagged, stitched and had the bot's session back-filled as theirs.
 * A request whose user agent lib/analytics/automation.ts classifies as automated
 * now identifies nobody, whatever token it carries (docs/TRACKING_POLICY.md,
 * identity loop rule 5). So does a SESSION the track route flagged as automation:
 * a scripted browser with an ordinary user agent reports navigator.webdriver in
 * its tracker post, which no request header shows, so the actions ask the session
 * row (backfillSessionToFub reports it) BEFORE they cookie, tag GA4 or stitch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signPersonLinkToken } from '@/lib/identity/link-token'
import { encodeConsent } from '@/test/consent-fixtures'

const state = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  headers: {} as Record<string, string>,
  cookieSet: vi.fn(),
  backfill: vi.fn(),
  isAutomated: vi.fn(),
  stitch: vi.fn(),
  ga4: vi.fn(),
  user: null as null | { id: string; email: string; app_metadata: { provider: string } },
  matches: [] as number[],
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name in state.cookies ? { value: state.cookies[name] } : undefined),
    set: state.cookieSet,
  }),
  headers: async () => new Headers(state.headers),
}))
vi.mock('@/lib/visitor-backfill', () => ({
  backfillSessionToFub: state.backfill,
  isAutomatedSession: state.isAutomated,
  stitchVisitorIdentity: state.stitch,
}))
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: state.ga4,
  readGa4ClientIdFromCookies: () => null,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/data/crm/personByEmailCi', () => ({ personIdsByEmailCi: async () => state.matches }))
vi.mock('@/lib/data/crm/personExistsById', () => ({ personExistsById: async () => true }))

import { identifyAuthenticatedSession, identifyPersonFromEmailClickNative } from './identity-bridge'

const HUMAN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const PERSON = 64115
const SESSION = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
const TOKEN = signPersonLinkToken(PERSON, 'document')

beforeEach(() => {
  state.cookies = { rr_vid: 'vid-A' }
  state.headers = { 'user-agent': HUMAN_UA }
  state.cookieSet.mockReset()
  state.backfill.mockReset()
  state.backfill.mockResolvedValue({ ok: true, sessionFound: true, alreadyIdentified: false, eventsBackfilled: 3, errors: [] })
  state.isAutomated.mockReset()
  state.isAutomated.mockResolvedValue(false)
  state.stitch.mockReset()
  state.ga4.mockReset()
  state.ga4.mockResolvedValue(undefined)
  state.user = null
  state.matches = []
})

describe('identifyPersonFromEmailClickNative', () => {
  it('a person following the link is cookied, backfilled and stitched', async () => {
    const res = await identifyPersonFromEmailClickNative(TOKEN, SESSION)
    expect(res).toEqual({ ok: true })
    expect(state.cookieSet).toHaveBeenCalledTimes(1)
    expect(state.cookieSet.mock.calls[0][0]).toBe('rr_pid')
    expect(state.backfill).toHaveBeenCalledWith({ sessionId: SESSION, fubPersonId: PERSON, identifiedVia: 'tracked_link:document' })
    expect(state.stitch).toHaveBeenCalledWith(expect.objectContaining({ rrVid: 'vid-A', fubPersonId: PERSON, sessionId: SESSION }))
    expect(state.ga4).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a declared crawler', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['a link previewer', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
    ['an HTTP library', 'python-requests/2.31.0'],
    ['a headless browser', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36'],
  ])('%s with a valid signed token identifies nobody: no cookie, no backfill, no stitch, no GA4 event', async (_label, ua) => {
    state.headers = { 'user-agent': ua }
    const res = await identifyPersonFromEmailClickNative(TOKEN, SESSION)
    expect(res).toEqual({ ok: false, error: 'Automated request' })
    expect(state.cookieSet).not.toHaveBeenCalled()
    expect(state.backfill).not.toHaveBeenCalled()
    expect(state.stitch).not.toHaveBeenCalled()
    expect(state.ga4).not.toHaveBeenCalled()
  })

  it('a request with no user agent at all is automation too', async () => {
    state.headers = {}
    expect(await identifyPersonFromEmailClickNative(TOKEN, SESSION)).toEqual({ ok: false, error: 'Automated request' })
    expect(state.backfill).not.toHaveBeenCalled()
  })

  it('a decline is still a decline, and Global Privacy Control still stops it', async () => {
    state.cookies = { rr_vid: 'vid-A', ryan_realty_cookie_consent: encodeConsent({ analytics: false, marketing: false }) }
    expect(await identifyPersonFromEmailClickNative(TOKEN, SESSION)).toEqual({ ok: false, error: 'Tracking declined' })
    state.cookies = { rr_vid: 'vid-A' }
    state.headers = { 'user-agent': HUMAN_UA, 'sec-gpc': '1' }
    expect(await identifyPersonFromEmailClickNative(TOKEN, SESSION)).toEqual({ ok: false, error: 'Tracking declined' })
    expect(state.backfill).not.toHaveBeenCalled()
  })

  it('a token we did not sign identifies nobody, human or not', async () => {
    expect(await identifyPersonFromEmailClickNative(String(PERSON), SESSION)).toMatchObject({ ok: false })
    expect(state.backfill).not.toHaveBeenCalled()
  })

  describe('a session the track route flagged as automation (a scripted browser with an ordinary user agent)', () => {
    const flagged = { ok: true, sessionFound: true, alreadyIdentified: false, eventsBackfilled: 0, errors: [], automated: true }

    afterEach(() => {
      vi.useRealTimers()
    })

    it('identifies nobody: no cookie, no GA4 event, no identity-map stitch', async () => {
      state.backfill.mockResolvedValue(flagged)
      const res = await identifyPersonFromEmailClickNative(TOKEN, SESSION)
      expect(res).toEqual({ ok: false, error: 'Automated request' })
      expect(state.backfill).toHaveBeenCalledTimes(1)
      expect(state.cookieSet).not.toHaveBeenCalled()
      expect(state.ga4).not.toHaveBeenCalled()
      expect(state.stitch).not.toHaveBeenCalled()
    })

    it('is caught on the retry too, when the session row was not there on the first read', async () => {
      // The landing page fires the session-creating tracker post and this action
      // together, so the row can appear a beat later: the action waits and reads again.
      vi.useFakeTimers()
      state.backfill
        .mockResolvedValueOnce({ ok: true, sessionFound: false, alreadyIdentified: false, eventsBackfilled: 0, errors: [] })
        .mockResolvedValueOnce(flagged)
      const pending = identifyPersonFromEmailClickNative(TOKEN, SESSION)
      await vi.advanceTimersByTimeAsync(2500)
      expect(await pending).toEqual({ ok: false, error: 'Automated request' })
      expect(state.backfill).toHaveBeenCalledTimes(2)
      expect(state.cookieSet).not.toHaveBeenCalled()
      expect(state.stitch).not.toHaveBeenCalled()
    })

    it('a person whose session is fine is still cookied AFTER the backfill, tagged and stitched', async () => {
      const res = await identifyPersonFromEmailClickNative(TOKEN, SESSION)
      expect(res).toEqual({ ok: true })
      const order = (fn: { mock: { invocationCallOrder: number[] } }) => fn.mock.invocationCallOrder[0]!
      expect(order(state.backfill)).toBeLessThan(order(state.cookieSet))
      expect(order(state.cookieSet)).toBeLessThan(order(state.stitch))
      expect(state.ga4).toHaveBeenCalledTimes(1)
    })

    it('with no session id to ask about, the request-level checks are all there is and a person is identified', async () => {
      const res = await identifyPersonFromEmailClickNative(TOKEN, undefined)
      expect(res).toEqual({ ok: true })
      expect(state.backfill).not.toHaveBeenCalled()
      expect(state.cookieSet).toHaveBeenCalledTimes(1)
      expect(state.stitch).toHaveBeenCalledWith(expect.objectContaining({ rrVid: 'vid-A', fubPersonId: PERSON, sessionId: null }))
    })
  })

  describe('a browser that reports navigator.webdriver on the call (review of 2026-09-30)', () => {
    // PersonIdentityBridge calls this at mount, before VisitTracker has created a
    // session: on a fresh automated browser there is no session id, so there was no
    // flagged row to ask about, and the rr_pid cookie, the GA4 person_identified event
    // and the rr_vid stitch were all written for a scripted browser.
    it('with no session yet, identifies nobody: no cookie, no GA4 event, no stitch', async () => {
      const res = await identifyPersonFromEmailClickNative(TOKEN, undefined, { webdriver: true })
      expect(res).toEqual({ ok: false, error: 'Automated request' })
      expect(state.cookieSet).not.toHaveBeenCalled()
      expect(state.ga4).not.toHaveBeenCalled()
      expect(state.stitch).not.toHaveBeenCalled()
      expect(state.backfill).not.toHaveBeenCalled()
    })

    it('with a session id too, is refused before the backfill touches it', async () => {
      expect(await identifyPersonFromEmailClickNative(TOKEN, SESSION, { webdriver: true })).toEqual({ ok: false, error: 'Automated request' })
      expect(state.backfill).not.toHaveBeenCalled()
      expect(state.cookieSet).not.toHaveBeenCalled()
    })

    it('a browser that says it is not automated is identified as before', async () => {
      expect(await identifyPersonFromEmailClickNative(TOKEN, undefined, { webdriver: false })).toEqual({ ok: true })
      expect(state.cookieSet).toHaveBeenCalledTimes(1)
    })
  })
})

describe('identifyAuthenticatedSession', () => {
  beforeEach(() => {
    state.user = { id: 'auth-1', email: 'Lead@Example.com', app_metadata: { provider: 'google' } }
    state.matches = [PERSON]
  })

  it('bridges a signed-in person to their contact', async () => {
    expect(await identifyAuthenticatedSession(SESSION)).toEqual({ ok: true, bridged: true })
    expect(state.backfill).toHaveBeenCalledWith(expect.objectContaining({ sessionId: SESSION, fubPersonId: PERSON, identifiedVia: 'google' }))
    expect(state.stitch).toHaveBeenCalledTimes(1)
    expect(state.cookieSet).toHaveBeenCalledTimes(1)
  })

  it('a flagged automated browser signed in as a test account bridges nothing', async () => {
    state.headers = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36' }
    expect(await identifyAuthenticatedSession(SESSION)).toEqual({ ok: true, bridged: false })
    expect(state.cookieSet).not.toHaveBeenCalled()
    expect(state.backfill).not.toHaveBeenCalled()
    expect(state.stitch).not.toHaveBeenCalled()
  })

  it('a signed-in browser that reports navigator.webdriver bridges nothing: no backfill, no cookie, no stitch', async () => {
    expect(await identifyAuthenticatedSession(undefined, { webdriver: true })).toEqual({ ok: true, bridged: false })
    expect(await identifyAuthenticatedSession(SESSION, { webdriver: true })).toEqual({ ok: true, bridged: false })
    expect(state.backfill).not.toHaveBeenCalled()
    expect(state.cookieSet).not.toHaveBeenCalled()
    expect(state.stitch).not.toHaveBeenCalled()
  })

  it('an anonymous visitor bridges nothing, as before', async () => {
    state.user = null
    expect(await identifyAuthenticatedSession(SESSION)).toEqual({ ok: true, bridged: false })
    expect(state.backfill).not.toHaveBeenCalled()
  })

  it('a session flagged as automation is bridged to nobody: no cookie, no identity-map stitch', async () => {
    state.backfill.mockResolvedValue({ ok: true, sessionFound: true, alreadyIdentified: false, eventsBackfilled: 0, errors: [], automated: true })
    expect(await identifyAuthenticatedSession(SESSION)).toEqual({ ok: true, bridged: false })
    expect(state.backfill).toHaveBeenCalledTimes(1)
    expect(state.cookieSet).not.toHaveBeenCalled()
    expect(state.stitch).not.toHaveBeenCalled()
  })

  it('a person is cookied only after the backfill said the session is fine', async () => {
    expect(await identifyAuthenticatedSession(SESSION)).toEqual({ ok: true, bridged: true })
    const order = (fn: { mock: { invocationCallOrder: number[] } }) => fn.mock.invocationCallOrder[0]!
    expect(order(state.backfill)).toBeLessThan(order(state.cookieSet))
    expect(order(state.cookieSet)).toBeLessThan(order(state.stitch))
  })

  describe('a known email with no contact yet', () => {
    beforeEach(() => {
      state.matches = []
    })

    it('still records the identity graph for a human session', async () => {
      expect(await identifyAuthenticatedSession(SESSION)).toEqual({ ok: true, bridged: false })
      expect(state.isAutomated).toHaveBeenCalledWith(SESSION)
      expect(state.stitch).toHaveBeenCalledTimes(1)
      expect(state.stitch).toHaveBeenCalledWith(expect.objectContaining({ rrVid: 'vid-A', email: 'lead@example.com', source: 'auth_session' }))
      expect(state.backfill).not.toHaveBeenCalled()
      expect(state.cookieSet).not.toHaveBeenCalled()
    })

    it('records nothing for a session flagged as automation', async () => {
      state.isAutomated.mockResolvedValue(true)
      expect(await identifyAuthenticatedSession(SESSION)).toEqual({ ok: true, bridged: false })
      expect(state.stitch).not.toHaveBeenCalled()
    })
  })
})
