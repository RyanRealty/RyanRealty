/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/"}
 *
 * public/rr-doc-tracker.js, EXECUTED. It is the tracker injected into /cma and
 * /bpo documents, a plain file served as-is, so the only honest test of it is to
 * run it in a browser-shaped page and look at what it sends.
 *
 * These are the two breaks it had (Matt 2026-09-29):
 *  1. A report opened before any public page created the session with NO campaign
 *     or click id (it sent the address and the landing page without their query,
 *     and none of the campaign fields the site's own tracker sends), and
 *     visitor_sessions never updates first-touch fields, so the campaign on the
 *     email link was lost for good.
 *  2. It hard-coded consent 'essential' and never read the banner's cookie, so a
 *     visitor who DECLINED was recorded and identified anyway.
 * plus the session rule (a session ends after 30 minutes idle or on a different
 * campaign) applied to the id it shares with the site.
 *
 * That it agrees with the TypeScript it mirrors is pinned in doc-tracker.pin.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The site's own tracker runs beside the script in the one-visit case below.
vi.mock('next/navigation', () => ({ usePathname: () => '/', useSearchParams: () => new URLSearchParams() }))
vi.mock('next/link', () => ({ default: () => null }))
vi.mock('@/app/actions/track-user-event', () => ({ trackUserEvent: vi.fn(async () => undefined) }))

import { signPersonLinkToken } from '@/lib/identity/link-token'
import { encodeConsent, COOKIE_MATRIX } from '@/test/consent-fixtures'
import { fireFirstPartyEvent } from '@/components/VisitTracker'
import { resetSessionMemory } from '@/lib/analytics/visitor-session'
import {
  clearBrowserState,
  docTrackerHarness,
  readConsentCookieRaw,
  setConsentCookie,
  setNavigationType,
  setReferrer,
  storeSessionRecord,
} from '@/test/doc-tracker-harness'

const MIN = 60 * 1000
const T0 = Date.UTC(2026, 8, 29, 18, 0, 0)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SLUG = '1-main-st-bend'
const TOKEN = signPersonLinkToken(64115, 'document')
/** The link the send puts in the email (lib/cma/first-contact-*: utm_source=cma, utm_campaign=<slug>, then the decorator). */
const EMAIL_LINK =
  `/cma/${SLUG}?utm_source=cma&utm_campaign=${SLUG}&agent=matt&utm_medium=email&utm_content=agent-matt&_pid=${TOKEN}`

const h = docTrackerHarness()

beforeEach(() => {
  clearBrowserState()
  resetSessionMemory()
  h.install()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  h.uninstall()
})

describe('a report opened first (break 1)', () => {
  it('sends the real URL and the campaign, referrer, click ids and landing page the site tracker sends', async () => {
    h.load({ url: EMAIL_LINK.replace('&_pid=', '&fbclid=F1&_pid='), referrer: 'https://mail.google.com/', title: '1 Main St' })
    await h.flush()

    expect(h.posts).toHaveLength(1)
    const b = h.posts[0].body!
    expect(b.eventType).toBe('page_view')
    expect(b.pageCategory).toBe('client-document')
    // the real URL, query and all (the server strips _pid and _fuid before it stores anything)
    expect(b.pageUrl).toBe(`https://ryan-realty.com${EMAIL_LINK.replace('&_pid=', '&fbclid=F1&_pid=')}`)
    expect(b.landingPage).toBe(b.pageUrl)
    expect(b.campaign).toEqual({
      source: 'cma',
      medium: 'email',
      campaign: SLUG,
      content: 'agent-matt',
    })
    expect(b.fbclid).toBe('F1')
    expect(b.referrer).toBe('https://mail.google.com/')
    expect(b.pageTitle).toBe('1 Main St')
    expect(b.sourceDomain).toBe('ryan-realty.com')
    expect(b.sessionId).toMatch(UUID)
    expect(b.visit).toEqual({ id: Math.floor(T0 / 1000), number: 1, start: true })
    // the signed person token still rides along for the server to verify
    expect(b.identityToken).toBe(TOKEN)
  })

  it('an untagged arrival is direct / none, the same label the site tracker gives it', async () => {
    h.load({ url: `/cma/${SLUG}` })
    await h.flush()
    const b = h.posts[0].body!
    expect(b.campaign).toMatchObject({ source: 'direct', medium: 'none' })
    expect(b.pageUrl).toBe(`https://ryan-realty.com/cma/${SLUG}`)
    expect(b.referrer).toBeUndefined()
  })

  it('names a referrer host as the source when the link carried no campaign', async () => {
    h.load({ url: `/cma/${SLUG}`, referrer: 'https://l.facebook.com/' })
    await h.flush()
    expect(h.posts[0].body!.campaign).toMatchObject({ source: 'facebook', medium: 'social' })
  })

  it('every later tap carries the same session context, so a session born on a tap is attributed too', async () => {
    h.load({ url: EMAIL_LINK })
    await h.flush()
    h.tap(`https://ryan-realty.com/homes-for-sale/bend/1-elm-st-201?_pid=${TOKEN}&utm_source=cma`, 'See this home')
    await h.flush()

    expect(h.posts).toHaveLength(2)
    const view = h.posts[0].body!
    const tap = h.posts[1].body!
    expect(tap.eventType).toBe('cta_click')
    expect(tap.sessionId).toBe(view.sessionId)
    expect(tap.campaign).toEqual(view.campaign)
    expect(tap.landingPage).toBe(view.landingPage)
    expect(tap.consent).toBe(view.consent)
    expect(tap.visit).toEqual({ id: (view.visit as { id: number }).id, number: 1, start: false })
    // the report's own address by then: the tracker has taken the token out of the address bar
    expect(tap.pageUrl).toBe(`https://ryan-realty.com${EMAIL_LINK.replace(`&_pid=${TOKEN}`, '')}`)
    // the destination is stored without the identity token
    expect(tap.metadata).toEqual({ destination: 'https://ryan-realty.com/homes-for-sale/bend/1-elm-st-201?utm_source=cma' })
    expect(tap.pageTitle).toBe('See this home')
    // a token is only forwarded once, on the page view
    expect(tap.identityToken).toBeUndefined()
  })

  it('reports navigator.webdriver so the server can classify automation', async () => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: true })
    h.load({ url: `/cma/${SLUG}` })
    await h.flush()
    expect(h.posts[0].body!.webdriver).toBe(true)
  })
})

describe('a visitor who declined (break 2)', () => {
  const declined = encodeConsent({ analytics: false, marketing: false })

  it('posts nothing, identifies nobody, leaves no session id, and still cleans the address bar', async () => {
    setConsentCookie(declined)
    h.load({ url: EMAIL_LINK })
    await h.flush()
    h.tap('https://ryan-realty.com/homes-for-sale', 'Search')
    await h.flush()

    expect(h.calls).toEqual([])
    expect(window.localStorage.getItem('rr_session_id')).toBeNull()
    expect(window.localStorage.getItem('rr_visit_v1')).toBeNull()
    // the token never lingers in the address bar, declined or not
    expect(window.location.search).not.toContain('_pid')
    expect(window.location.search).toContain(`utm_campaign=${SLUG}`)
    // and the ad-traffic grant never overrides an explicit decline
    expect(readConsentCookieRaw()).toBe(declined)
  })

  it.each(COOKIE_MATRIX.filter((c) => c.level === 'declined'))('$label: no post, no identify ping', async ({ raw }) => {
    setConsentCookie(raw)
    h.load({ url: EMAIL_LINK })
    await h.flush()
    expect(h.calls).toEqual([])
  })

  it('a visitor who answered but did not decline is recorded at the tier they chose', async () => {
    setConsentCookie(encodeConsent({ analytics: true, marketing: false }))
    h.load({ url: EMAIL_LINK })
    await h.flush()
    expect(h.posts[0].body!.consent).toBe('analytics')

    window.localStorage.clear()
    setConsentCookie(encodeConsent({ analytics: false, marketing: true }))
    h.load({ url: EMAIL_LINK })
    await h.flush()
    expect(h.posts[1].body!.consent).toBe('essential')
  })

  it('no banner answer, no campaign on the link: essential, nothing is written to the cookie', async () => {
    h.load({ url: `/cma/${SLUG}` })
    await h.flush()
    expect(h.posts[0].body!.consent).toBe('essential')
    expect(readConsentCookieRaw()).toBeUndefined()
  })

  it('no banner answer on a campaign link: analytics and marketing are granted for the visit and remembered, as on any other page', async () => {
    h.load({ url: EMAIL_LINK })
    await h.flush()
    expect(h.posts[0].body!.consent).toBe('all')
    expect(readConsentCookieRaw()).toBe(encodeConsent({ analytics: true, marketing: true }))
  })

  it('a decline that arrives after the page loaded stops the taps too', async () => {
    h.load({ url: `/cma/${SLUG}` })
    await h.flush()
    setConsentCookie(declined)
    h.tap('https://ryan-realty.com/homes-for-sale', 'Search')
    await h.flush()
    expect(h.posts).toHaveLength(1)
  })
})

describe('the session rule (break 3)', () => {
  const at = (minutes: number) => vi.setSystemTime(T0 + minutes * MIN)
  const sessions = () => h.posts.map((p) => p.body!.sessionId as string)

  it('one session through a whole reading: reloads and taps inside 30 minutes of each other', async () => {
    h.load({ url: EMAIL_LINK })
    await h.flush()
    at(20)
    h.tap('https://ryan-realty.com/homes-for-sale/bend', 'Bend')
    at(45)
    h.tap('https://ryan-realty.com/reviews', 'Reviews')
    at(70)
    h.load({ url: `/cma/${SLUG}?utm_source=cma&utm_campaign=${SLUG}` })
    await h.flush()

    expect(new Set(sessions()).size).toBe(1)
    expect(h.posts.map((p) => (p.body!.visit as { start: boolean }).start)).toEqual([true, false, false, false])
  })

  it('a new session after more than 30 minutes idle, carrying the arrival it was born on', async () => {
    h.load({ url: EMAIL_LINK })
    await h.flush()
    at(31)
    h.tap('https://ryan-realty.com/reviews', 'Reviews')
    await h.flush()

    const [view, tap] = h.posts.map((p) => p.body!)
    expect(tap.sessionId).not.toBe(view.sessionId)
    expect(tap.visit).toEqual({ id: Math.floor((T0 + 31 * MIN) / 1000), number: 2, start: true })
    // a session born on a tap still carries attribution: the tab's capture was reset for it
    expect(tap.landingPage).toBe(window.location.href)
    expect(tap.campaign).toMatchObject({ source: 'cma', campaign: SLUG })
    expect(window.localStorage.getItem('rr_session_id')).toBe(tap.sessionId)
  })

  it('exactly 30 minutes is still the same session', async () => {
    h.load({ url: EMAIL_LINK })
    await h.flush()
    at(30)
    h.tap('https://ryan-realty.com/reviews', 'Reviews')
    await h.flush()
    expect(new Set(sessions()).size).toBe(1)
  })

  it('a different campaign is a new session even a minute later; the same campaign is not', async () => {
    h.load({ url: `/cma/${SLUG}?utm_source=facebook&utm_campaign=spring` })
    await h.flush()
    at(1)
    h.load({ url: EMAIL_LINK })
    await h.flush()
    at(2)
    h.load({ url: EMAIL_LINK })
    await h.flush()

    const [facebook, email, reload] = h.posts.map((p) => p.body!)
    expect(email.sessionId).not.toBe(facebook.sessionId)
    expect(email.campaign).toMatchObject({ source: 'cma', campaign: SLUG })
    expect(reload.sessionId).toBe(email.sessionId)
    expect(email.visit).toMatchObject({ number: 2, start: true })
    expect(reload.visit).toMatchObject({ number: 2, start: false })
  })

  it('shares the id with the site: a session the site began carries straight on into the report', async () => {
    const siteSession = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
    storeSessionRecord({ id: Math.floor(T0 / 1000), n: 4, last: T0, sid: siteSession, s: 'cma', c: SLUG }, siteSession)
    at(10)
    h.load({ url: `/cma/${SLUG}?utm_source=cma&utm_campaign=${SLUG}` })
    await h.flush()
    expect(h.posts[0].body!.sessionId).toBe(siteSession)
    expect(h.posts[0].body!.visit).toEqual({ id: Math.floor(T0 / 1000), number: 4, start: false })
  })

  it('an id from before the rule (no lifecycle record names it) is not kept: the report starts a session of its own', async () => {
    // A browser that last visited before sessions ended holds a months-old
    // rr_session_id and no rr_visit_v1. Keeping it put this email click into that
    // old session, whose first-touch fields never change, and its campaign was lost.
    const old = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
    window.localStorage.setItem('rr_session_id', old)
    h.load({ url: EMAIL_LINK })
    await h.flush()
    const b = h.posts[0].body!
    expect(b.sessionId).not.toBe(old)
    expect(b.sessionId).toMatch(UUID)
    expect(b.visit).toEqual({ id: Math.floor(T0 / 1000), number: 1, start: true })
    expect(b.campaign).toMatchObject({ source: 'cma', campaign: SLUG })
    expect(window.localStorage.getItem('rr_session_id')).toBe(b.sessionId)
  })

  it('a record written before sessions carried an id (the TRACK-1 visit record) does not keep the old id either', async () => {
    // Active a minute ago, so the idle rule does not end it; the address is untagged
    // (a bookmark), so no campaign does either. Only the missing session id on the
    // record says this id predates the rule.
    const old = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
    window.localStorage.setItem('rr_session_id', old)
    window.localStorage.setItem('rr_visit_v1', JSON.stringify({ id: Math.floor(T0 / 1000) - 60, n: 7, last: T0 - 60_000 }))
    h.load({ url: `/cma/${SLUG}` })
    await h.flush()
    expect(h.posts[0].body!.sessionId).not.toBe(old)
    // the visit count carries on
    expect(h.posts[0].body!.visit).toEqual({ id: Math.floor(T0 / 1000), number: 8, start: true })
  })
})

describe('one visit across the report and the pages it links to (the review of 2026-09-30)', () => {
  // A CMA sent by text or by a sequence is linked with utm_source=crm and no
  // campaign (lib/analytics/visit-broker.ts stampCrmOutboundUtms); every comp in it
  // links with utm_source=cma&utm_campaign=<slug> (lib/cma/doc-links.ts). Both
  // trackers re-read the address bar on every event, so while the campaign was
  // compared on every event the reader flipped sessions on each step: one view and
  // four comp taps, each opening the comp and coming back, was 8 sessions, the
  // largest 21 points. Only an EXTERNAL ARRIVAL (the first event of a page load the
  // browser navigated to from outside the site) compares campaigns now.
  const SMS_LINK = `/cma/${SLUG}?agent=matt&utm_source=crm&utm_medium=email&utm_content=agent-matt&_pid=${TOKEN}`
  const REPORT_ADDRESS = `https://ryan-realty.com/cma/${SLUG}?agent=matt&utm_source=crm&utm_medium=email&utm_content=agent-matt`
  const comp = (i: number) =>
    `/homes-for-sale/bend/${i}-elm-st-20120123${i}?agent=matt&utm_source=cma&utm_medium=document&utm_campaign=${SLUG}`
  const at = (minutes: number) => vi.setSystemTime(T0 + minutes * MIN)

  /** The comp page loads in the tab: a new document on the site, whose tracker posts its view. */
  function openComp(i: number) {
    resetSessionMemory() // a new document: the site's session module starts over in memory
    window.history.replaceState({}, '', comp(i))
    setReferrer(REPORT_ADDRESS) // the report, on our own site
    setNavigationType('navigate')
    fireFirstPartyEvent('listing_view', { listingMls: `20120123${i}` })
  }

  it('one view and four comp taps, each opened and come back from, is ONE session', async () => {
    h.load({ url: SMS_LINK }) // from the text message: no referrer
    await h.flush()
    for (let i = 1; i <= 4; i++) {
      at(i * 3)
      h.tap(`https://ryan-realty.com${comp(i)}`, `Comp ${i}`)
      at(i * 3 + 1)
      openComp(i)
      at(i * 3 + 2)
      // back to the report: the browser reloads it from history, referrer and all
      h.load({ url: REPORT_ADDRESS.replace('https://ryan-realty.com', ''), navigationType: 'back_forward' })
      await h.flush()
    }

    const posts = h.posts.map((p) => p.body!)
    expect(posts).toHaveLength(1 + 4 * 3) // the view, then a tap, a comp view and the report again, four times
    expect(new Set(posts.map((p) => p.sessionId)).size).toBe(1)
    // one GA4 visit, begun by the first view
    expect(posts.map((p) => (p.visit as { start: boolean }).start)).toEqual([true, ...Array(12).fill(false)])
    expect(new Set(posts.map((p) => (p.visit as { number: number }).number))).toEqual(new Set([1]))
  })

  it('the comp opened in a new tab is the same visit too', async () => {
    h.load({ url: SMS_LINK })
    await h.flush()
    at(1)
    h.tap(`https://ryan-realty.com${comp(1)}`, 'Comp 1')
    openComp(1)
    at(2)
    h.tap(`https://ryan-realty.com${comp(2)}`, 'Comp 2')
    openComp(2)
    expect(new Set(h.posts.map((p) => p.body!.sessionId)).size).toBe(1)
  })

  it('a later event on the report never ends the session because of the campaign still in its address', async () => {
    // A session the site began under another campaign a minute ago, then the report
    // opened from the text: that ARRIVAL is a new campaign (a new session); the taps
    // after it, whose address still says utm_source=crm, are not arrivals.
    storeSessionRecord(
      { id: Math.floor(T0 / 1000) - 60, n: 3, last: T0 - 60_000, sid: '11111111-2222-4333-8444-555555555555', s: 'facebook', c: 'spring' },
      '11111111-2222-4333-8444-555555555555',
    )
    h.load({ url: SMS_LINK })
    await h.flush()
    at(1)
    h.tap(`https://ryan-realty.com${comp(1)}`, 'Comp 1')
    at(2)
    h.tap(`https://ryan-realty.com${comp(2)}`, 'Comp 2')
    const [view, ...taps] = h.posts.map((p) => p.body!)
    expect(view.sessionId).not.toBe('11111111-2222-4333-8444-555555555555')
    expect(view.visit).toMatchObject({ number: 4, start: true })
    for (const t of taps) expect(t.sessionId).toBe(view.sessionId)
  })

  it('opening the report again from the text, inside 30 minutes, is still the same visit; from another campaign it is not', async () => {
    h.load({ url: SMS_LINK })
    await h.flush()
    at(5)
    h.load({ url: SMS_LINK }) // the same link, tapped again in the messages app
    await h.flush()
    at(6)
    h.load({ url: `/cma/${SLUG}?utm_source=facebook&utm_campaign=fall` }) // an ad, a minute later
    await h.flush()
    const [first, again, ad] = h.posts.map((p) => p.body!)
    expect(again.sessionId).toBe(first.sessionId)
    expect(ad.sessionId).not.toBe(first.sessionId)
    expect(ad.visit).toMatchObject({ number: 2, start: true })
  })

  it.each([
    ['a reload', 'reload', ''],
    ['the back button', 'back_forward', ''],
    ['a link on our own site', 'navigate', 'https://ryan-realty.com/homes-for-sale'],
    ['a link on our own site, www', 'navigate', 'https://www.ryan-realty.com/sell'],
    ['a browser that cannot say how it got here', null, ''],
  ])('%s is not an arrival: a different campaign in the address does not end the session', async (_label, navigationType, referrer) => {
    h.load({ url: `/cma/${SLUG}?utm_source=facebook&utm_campaign=spring` })
    await h.flush()
    at(1)
    h.load({ url: `/cma/${SLUG}?utm_source=cma&utm_campaign=${SLUG}`, navigationType, referrer })
    await h.flush()
    expect(h.posts[1].body!.sessionId).toBe(h.posts[0].body!.sessionId)
    expect(h.posts[1].body!.visit).toMatchObject({ number: 1, start: false })
  })

  it('an arrival from another site (a webmail page) is an arrival', async () => {
    h.load({ url: `/cma/${SLUG}?utm_source=facebook&utm_campaign=spring` })
    await h.flush()
    at(1)
    h.load({ url: EMAIL_LINK, referrer: 'https://mail.google.com/' })
    await h.flush()
    expect(h.posts[1].body!.sessionId).not.toBe(h.posts[0].body!.sessionId)
  })
})

describe('Global Privacy Control on a report', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
  })

  // The one request is the notice the site tracker sends too: the signal and nothing
  // else, so the track route can suppress a contact the browser already carries
  // (app/api/visitors/track/gpc.test.ts).
  const NOTICE = [{ url: '/api/visitors/track', method: 'POST', body: { gpc: true } }]

  it('writes no consent cookie and no identifier, posts no event, identifies nobody, and still cleans the address bar', async () => {
    h.load({ url: EMAIL_LINK }) // a campaign link with no banner answer: the grant would have written 'all'
    await h.flush()
    h.tap('https://ryan-realty.com/homes-for-sale', 'Search')
    await h.flush()
    expect(h.calls).toEqual(NOTICE)
    expect(h.identifyPings).toEqual([])
    expect(readConsentCookieRaw()).toBeUndefined()
    expect(Object.keys(window.localStorage)).toEqual([])
    expect(Object.keys(window.sessionStorage)).toEqual([])
    expect(window.location.search).not.toContain('_pid')
  })

  it('a visitor who once accepted everything is still recorded nowhere while the signal is on', async () => {
    setConsentCookie(encodeConsent({ analytics: true, marketing: true }))
    h.load({ url: EMAIL_LINK })
    await h.flush()
    expect(h.calls).toEqual(NOTICE)
  })
})

describe('identity through the report (unchanged by any of the above)', () => {
  it('forwards the signed token on the page view, then pings the identify endpoint once with the session id', async () => {
    h.load({ url: EMAIL_LINK })
    await h.flush()
    const sid = h.posts[0].body!.sessionId as string
    expect(h.posts[0].body!.identityToken).toBe(TOKEN)
    expect(h.identifyPings).toHaveLength(1)
    expect(h.identifyPings[0].url).toBe(`/api/track/e/identify?_pid=${encodeURIComponent(TOKEN)}&sid=${encodeURIComponent(sid)}`)
    expect(window.location.search).not.toContain('_pid')
  })

  it('starts a fresh session and re-sends once when the server says this session belongs to someone else', async () => {
    let first = true
    h.respondWith(() => {
      if (first) {
        first = false
        return { ok: true, rotateSession: true }
      }
      return { ok: true }
    })
    h.load({ url: EMAIL_LINK })
    await h.flush()

    expect(h.posts).toHaveLength(2)
    const [a, b] = h.posts.map((p) => p.body!)
    expect(b.sessionId).not.toBe(a.sessionId)
    expect(b.sessionId).toMatch(UUID)
    // the re-send is the same view, with the attribution intact
    expect(b.campaign).toEqual(a.campaign)
    expect(b.landingPage).toBe(a.landingPage)
    expect(b.identityToken).toBe(TOKEN)
    expect(window.localStorage.getItem('rr_session_id')).toBe(b.sessionId)
    // and the identify ping names the NEW session
    expect(h.identifyPings[0].url).toContain(`sid=${encodeURIComponent(b.sessionId as string)}`)
  })

  it('a retired ?_fuid= is still cleaned from the address bar and still sent to the identify endpoint, where the server refuses it', async () => {
    h.load({ url: `/cma/${SLUG}?_fuid=22288&utm_source=cma` })
    await h.flush()
    expect(window.location.search).toBe('?utm_source=cma')
    expect(h.identifyPings).toHaveLength(1)
    expect(h.identifyPings[0].url).toContain('_fuid=22288')
  })

  it('a browser driven by automation says so to the identify ping too (the endpoint refuses it)', async () => {
    // navigator.webdriver rides in every post (the track route flags the session), but
    // the identify ping is a GET the server cannot otherwise classify: an automated
    // browser with an ordinary user agent would have been cookied as the contact.
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: true })
    h.load({ url: EMAIL_LINK })
    await h.flush()
    const sid = h.posts[0].body!.sessionId as string
    expect(h.posts[0].body!.webdriver).toBe(true)
    expect(h.identifyPings).toHaveLength(1)
    expect(h.identifyPings[0].url).toBe(
      `/api/track/e/identify?_pid=${encodeURIComponent(TOKEN)}&sid=${encodeURIComponent(sid)}&webdriver=1`,
    )
  })

  it('a link with no token pings nothing', async () => {
    h.load({ url: `/cma/${SLUG}?utm_source=cma` })
    await h.flush()
    expect(h.identifyPings).toHaveLength(0)
  })

  it('never breaks the document when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    expect(() => h.load({ url: EMAIL_LINK })).not.toThrow()
    await h.flush()
    expect(window.location.search).not.toContain('_pid')
  })
})
