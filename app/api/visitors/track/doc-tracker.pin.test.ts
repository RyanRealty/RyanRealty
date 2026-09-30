/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/"}
 *
 * THE PIN. public/rr-doc-tracker.js is a plain file served as-is, so it cannot
 * import the TypeScript rules it has to follow: the banner's consent mapping
 * (lib/identity/consent.ts), the session rule and first-touch capture
 * (lib/analytics/visitor-session.ts). It MIRRORS them. A mirror that drifts is
 * how the report page ended up recording visitors who had declined (it hard-coded
 * 'essential' and never read the cookie), so this file runs the script and the
 * production TypeScript through the same cookies, URLs and timelines and fails the
 * moment they disagree. It names the side to change.
 *
 * What is compared is behaviour, not text: the script is executed, and the
 * TypeScript side is the real code (the banner's autoGrantConsentForAdTraffic,
 * VisitTracker's currentConsentLevel, advanceSession, captureSource). A page load
 * is a page load on both sides: the script runs afresh, and the module's page
 * state starts over (resetSessionMemory), with the same address, referrer and
 * navigation type, because only the first event of a load the browser navigated
 * to from outside the site is an arrival.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({ default: () => null }))
vi.mock('@/app/actions/track-user-event', () => ({ trackUserEvent: vi.fn(async () => undefined) }))

import { autoGrantConsentForAdTraffic } from '@/components/CookieConsentBanner'
import { currentConsentLevel, fireFirstPartyEvent, firstPartyEventContext } from '@/components/VisitTracker'
import { CONSENT_COOKIE, arrivalConsent } from '@/lib/identity/consent'
import {
  SESSION_BINDING_KEY,
  SESSION_ID_KEY,
  SESSION_IDLE_MS,
  SESSION_STATE_KEY,
  SESSION_UUID_V4,
  SOURCE_CACHE_KEY,
  advanceSession,
  captureSource,
  isExternalArrival,
  resetSessionMemory,
} from '@/lib/analytics/visitor-session'
import { COOKIE_MATRIX, SEARCH_MATRIX, encodeConsent } from '@/test/consent-fixtures'
import { deployedTrackerTab } from '@/test/deployed-visit-tracker'
import {
  DOC_TRACKER_SRC,
  clearBrowserState,
  docTrackerHarness,
  readConsentCookieRaw,
  readSessionRecord,
  setConsentCookie,
  setNavigationType,
  setReferrer,
  storeSessionRecord,
} from '@/test/doc-tracker-harness'

const MIN = 60 * 1000
const T0 = Date.UTC(2026, 8, 29, 18, 0, 0)
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

describe('consent: the script and the site read the banner the same way', () => {
  const cases = COOKIE_MATRIX.flatMap((c) => SEARCH_MATRIX.map((search) => ({ ...c, search })))

  it.each(cases)('$label $search', async ({ raw, search }) => {
    // 1. What the site does: VisitTracker's mount effect calls the banner's
    //    autoGrantConsentForAdTraffic, then reads currentConsentLevel.
    clearBrowserState()
    setConsentCookie(raw)
    window.history.replaceState({}, '', `/homes-for-sale${search}`)
    autoGrantConsentForAdTraffic()
    const siteLevel = currentConsentLevel()
    const siteCookie = readConsentCookieRaw()

    // 2. What the shared rule says.
    const rule = arrivalConsent({ cookieValue: raw, search, gpc: false })
    expect(siteLevel).toBe(rule.level)
    expect(siteCookie).toBe(rule.grant ? encodeConsent({ analytics: true, marketing: true }) : raw)

    // 3. What the script does on the same cookie and the same link.
    clearBrowserState()
    resetSessionMemory()
    setConsentCookie(raw)
    h.load({ url: `/cma/1-main-st${search}` })
    await h.flush()
    const docLevel = h.posts.length === 0 ? 'declined' : h.posts[h.posts.length - 1].body!.consent
    expect(docLevel).toBe(siteLevel)
    expect(readConsentCookieRaw()).toBe(siteCookie)
    h.calls.length = 0
  })

  const setGpc = (on: boolean) =>
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: on ? true : undefined })

  it.each(cases)('with Global Privacy Control: $label $search', async ({ raw, search }) => {
    // The site: the grant never applies (the cookie is left as it was), and the
    // tracker writes no identifier and posts nothing but one notice carrying the
    // signal alone (the route records a durable suppression for a contact the browser
    // already carries, and writes nothing else).
    const withToken = `${search}&_pid=tok`.replace(/^&/, '?')
    clearBrowserState()
    resetSessionMemory()
    setGpc(true)
    setConsentCookie(raw)
    window.history.replaceState({}, '', `/homes-for-sale${withToken}`)
    expect(autoGrantConsentForAdTraffic()).toBe(false)
    const siteCookie = readConsentCookieRaw()
    const rule = arrivalConsent({ cookieValue: raw, search, gpc: true })
    expect(rule.grant).toBe(false)
    expect(currentConsentLevel()).toBe(rule.level)
    expect(siteCookie).toBe(raw)
    fireFirstPartyEvent('page_view')
    fireFirstPartyEvent('cta_click')
    await h.flush()
    const site = h.calls.map((c) => ({ url: c.url, method: c.method, body: c.body }))
    expect(site).toEqual([{ url: '/api/visitors/track', method: 'POST', body: { gpc: true } }])
    expect(Object.keys(window.localStorage)).toEqual([])
    expect(Object.keys(window.sessionStorage)).toEqual([])
    h.calls.length = 0

    // The script: the same, and no identify ping; the address bar is still cleaned.
    clearBrowserState()
    resetSessionMemory()
    setGpc(true)
    setConsentCookie(raw)
    h.load({ url: `/cma/1-main-st${withToken}` })
    await h.flush()
    h.tap('https://ryan-realty.com/reviews', 'Reviews')
    await h.flush()
    expect(h.calls.map((c) => ({ url: c.url, method: c.method, body: c.body }))).toEqual(site)
    expect(Object.keys(window.localStorage)).toEqual([])
    expect(Object.keys(window.sessionStorage)).toEqual([])
    expect(readConsentCookieRaw()).toBe(siteCookie)
    expect(window.location.search).not.toContain('_pid')
    setGpc(false)
  })
})

describe('session rule: the script and the site apply it identically', () => {
  /**
   * `load`: a page load (the script runs afresh; the site module's page state
   * starts over) at `/cma/1-main-st<search>`, reached the way `nav` says (default
   * 'navigate') from `referrer` (default none). `event`: a later event on the page
   * already loaded (the script's tap; the site's next tracked event). `old`: an event
   * in ANOTHER tab still running the tracker deployed before the rule
   * (test/deployed-visit-tracker.ts), which rewrites rr_visit_v1 with no session in it.
   */
  type Step =
    | { kind?: 'load'; at: number; search: string; referrer?: string; nav?: string | null }
    | { kind: 'event'; at: number }
    | { kind: 'old'; at: number }
  type Timeline = { name: string; seed?: () => void; steps: Step[] }

  const SEEDED = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
  const SENTINEL = JSON.stringify({ landingPage: 'SENTINEL' })
  const OWN = 'https://ryan-realty.com/cma/1-main-st?utm_source=crm&utm_medium=email'
  const long = (tail: string) => `${'x'.repeat(100)}${tail}`

  const TIMELINES: Timeline[] = [
    {
      name: 'one visit, with the 30 minute boundary either side',
      steps: [
        { at: 0 * MIN, search: '' },
        { kind: 'event', at: 5 * MIN },
        { at: 34 * MIN, search: '' }, // 29 after the last
        { kind: 'event', at: 64 * MIN }, // exactly 30 after the last: still one session
        { at: 94 * MIN + 12, search: '' }, // 30 minutes and 12 ms after the last: idle
        { kind: 'event', at: 100 * MIN },
      ],
    },
    {
      name: 'arrivals: a new campaign ends it; the same, none, or a re-cased one does not',
      steps: [
        { at: 0 * MIN, search: '?utm_source=email&utm_campaign=spring' },
        { at: 1 * MIN, search: '?utm_source=email&utm_campaign=spring' },
        { at: 2 * MIN, search: '?utm_source=facebook' },
        { at: 3 * MIN, search: '?utm_source=facebook&utm_medium=paid&utm_content=a' },
        { at: 4 * MIN, search: '' },
        { at: 5 * MIN, search: '?agent=matt&_pid=tok' },
        { at: 6 * MIN, search: '?utm_source=FACEBOOK', referrer: 'https://l.facebook.com/' },
        { at: 7 * MIN, search: '?utm_campaign=spring', referrer: 'https://mail.google.com/' },
        { at: 8 * MIN, search: '?utm_campaign=SPRING' },
        { at: 9 * MIN, search: '?utm_source=facebook&utm_campaign=spring' },
      ],
    },
    {
      name: 'not arrivals: a later event, a reload, the back button, a link on our own site, a browser that cannot say',
      steps: [
        { at: 0 * MIN, search: '?utm_source=facebook&utm_campaign=spring' },
        { kind: 'event', at: 1 * MIN },
        { at: 2 * MIN, search: '?utm_source=cma&utm_campaign=1-main-st', nav: 'reload' },
        { at: 3 * MIN, search: '?utm_source=crm', nav: 'back_forward' },
        { at: 4 * MIN, search: '?utm_source=crm&utm_campaign=x', referrer: OWN },
        { at: 5 * MIN, search: '?utm_source=crm&utm_campaign=y', referrer: 'https://www.ryan-realty.com/sell' },
        { at: 6 * MIN, search: '?utm_source=crm&utm_campaign=z', nav: 'prerender' },
        { at: 7 * MIN, search: '?utm_source=crm&utm_campaign=w', nav: null },
        // and then a real arrival on a different campaign does end it
        { at: 8 * MIN, search: '?utm_source=crm&utm_campaign=w', referrer: 'https://mail.google.com/' },
      ],
    },
    {
      name: 'the report sent by text, its comp pages and back again: one visit (review of 2026-09-30)',
      steps: [
        { at: 0 * MIN, search: '?agent=matt&utm_source=crm&utm_medium=email&_pid=tok' },
        { kind: 'event', at: 1 * MIN }, // the tap on a comp
        { at: 2 * MIN, search: '?agent=matt&utm_source=cma&utm_medium=document&utm_campaign=1-main-st', referrer: OWN }, // the comp page
        { at: 3 * MIN, search: '?agent=matt&utm_source=crm&utm_medium=email', nav: 'back_forward' }, // back to the report
        { kind: 'event', at: 4 * MIN },
        { at: 5 * MIN, search: '?agent=matt&utm_source=cma&utm_medium=document&utm_campaign=1-main-st', referrer: OWN },
        { at: 6 * MIN, search: '?agent=matt&utm_source=crm&utm_medium=email', nav: 'back_forward' },
      ],
    },
    {
      name: 'a session that begins on a load that is not an arrival records the campaign on its address',
      steps: [
        { at: 0 * MIN, search: '?utm_source=cma&utm_campaign=1-main-st', referrer: OWN },
        { at: 1 * MIN, search: '?utm_source=cma&utm_campaign=1-main-st' }, // arriving on the same campaign: same session
        { at: 2 * MIN, search: '?utm_source=crm' }, // a different one: a new session
      ],
    },
    {
      name: 'idle and a new campaign at the same time',
      steps: [
        { at: 0 * MIN, search: '?utm_source=a' },
        { at: 31 * MIN, search: '?utm_source=b' },
        { at: 32 * MIN, search: '?utm_source=b' },
      ],
    },
    {
      name: 'empty and padded values are not campaigns / not different',
      steps: [
        { at: 0 * MIN, search: '?utm_source=&utm_campaign=' },
        { at: 1 * MIN, search: '?utm_source=%20a%20' },
        { at: 2 * MIN, search: '?utm_source=a' },
        { at: 3 * MIN, search: '?utm_medium=email' },
      ],
    },
    {
      name: 'values compare on their first 100 characters',
      steps: [
        { at: 0 * MIN, search: `?utm_campaign=${long('one')}` },
        { at: 1 * MIN, search: `?utm_campaign=${long('two')}` },
        { at: 2 * MIN, search: `?utm_campaign=${long('two')}x` },
        { at: 3 * MIN, search: '?utm_campaign=other' },
      ],
    },
    {
      name: 'an id already in storage with no lifecycle record is not kept',
      seed: () => window.localStorage.setItem(SESSION_ID_KEY, SEEDED),
      steps: [
        { at: 0 * MIN, search: '' },
        { at: 1 * MIN, search: '?utm_source=a' },
        { kind: 'event', at: 2 * MIN },
      ],
    },
    {
      name: 'a record from before the rule (no session or campaign on it), recent',
      seed: () => {
        window.localStorage.setItem(SESSION_ID_KEY, SEEDED)
        window.localStorage.setItem(SESSION_STATE_KEY, JSON.stringify({ id: Math.floor(T0 / 1000) - 60, n: 5, last: T0 - 60_000 }))
      },
      steps: [
        { at: 0 * MIN, search: '' },
        { at: 1 * MIN, search: '?utm_source=a' },
      ],
    },
    {
      name: 'a record from before the rule, gone stale',
      seed: () => {
        window.localStorage.setItem(SESSION_ID_KEY, SEEDED)
        window.localStorage.setItem(SESSION_STATE_KEY, JSON.stringify({ id: 1, n: 5, last: T0 - 90 * MIN }))
      },
      steps: [
        { at: 0 * MIN, search: '' },
        { kind: 'event', at: 1 * MIN },
      ],
    },
    {
      name: 'a record naming a different session than the one in storage',
      seed: () => {
        storeSessionRecord(
          { id: Math.floor(T0 / 1000), n: 2, last: T0, sid: '00000000-0000-4000-8000-000000000000', s: 'a', c: '' },
          SEEDED,
        )
      },
      steps: [
        { at: 1 * MIN, search: '?utm_source=a' },
        { at: 2 * MIN, search: '?utm_source=b' },
      ],
    },
    {
      name: 'a record this rule wrote for the id in storage: the session carries on',
      seed: () => {
        storeSessionRecord({ id: Math.floor(T0 / 1000), n: 2, last: T0, sid: SEEDED, s: 'a', c: '' }, SEEDED)
      },
      steps: [
        { at: 1 * MIN, search: '?utm_source=a' },
        { kind: 'event', at: 2 * MIN },
        { at: 3 * MIN, search: '?utm_source=b' },
      ],
    },
    {
      name: 'a corrupt record',
      seed: () => {
        window.localStorage.setItem(SESSION_ID_KEY, SEEDED)
        window.localStorage.setItem(SESSION_STATE_KEY, '{oops')
      },
      steps: [
        { at: 0 * MIN, search: '' },
        { kind: 'event', at: 1 * MIN },
      ],
    },
    {
      name: 'a session id that is not a uuid',
      seed: () => window.localStorage.setItem(SESSION_ID_KEY, 'not-a-uuid'),
      steps: [
        { at: 0 * MIN, search: '' },
        { kind: 'event', at: 1 * MIN },
      ],
    },
    // The rollout (review of 2026-09-30): a tab loaded before the deploy keeps the old
    // tracker and rewrites rr_visit_v1 between these events. One visit is one session.
    {
      name: 'a tab still on the deployed tracker between loads and taps: one visit',
      steps: [
        { at: 0 * MIN, search: '?utm_source=crm&utm_medium=email' },
        { kind: 'old', at: 1 * MIN },
        { kind: 'event', at: 2 * MIN },
        { kind: 'old', at: 3 * MIN },
        { at: 4 * MIN, search: '?utm_source=crm&utm_medium=email', nav: 'reload' },
        { kind: 'old', at: 5 * MIN },
        { kind: 'old', at: 6 * MIN },
        { kind: 'event', at: 7 * MIN },
        { at: 8 * MIN, search: '', referrer: OWN },
      ],
    },
    {
      name: 'the deployed tracker\'s events are activity: they keep the session alive',
      steps: [
        { at: 0 * MIN, search: '' },
        { kind: 'old', at: 20 * MIN },
        { kind: 'old', at: 40 * MIN },
        { kind: 'event', at: 45 * MIN }, // 45 after this tracker's last event, 5 after the old tab's
        { kind: 'event', at: 76 * MIN }, // and idle still ends it
      ],
    },
    {
      name: 'a browser from before the rule whose old tab posts first: the id is still not kept',
      seed: () => window.localStorage.setItem(SESSION_ID_KEY, SEEDED),
      steps: [
        { kind: 'old', at: 0 * MIN },
        { at: 1 * MIN, search: '' },
        { kind: 'old', at: 2 * MIN },
        { kind: 'event', at: 3 * MIN },
      ],
    },
  ]

  type Trace = {
    session: string
    /** null for a step in the other tab: the deployed tracker posts no visit this module computes. */
    visit: { id: number; number: number; start: boolean } | null
    record: { id: number; n: number; last: number; s?: string; c?: string }
    sourceCacheCleared: boolean | null
  }
  type Row = { sid: string; visit: Trace['visit']; record: Trace['record']; cleared: boolean | null }

  /** Session ids differ between runs; compare which steps share one instead (the seeded id keeps its name). */
  function normalize(rows: Row[]): Trace[] {
    const names = new Map<string, string>([[SEEDED, 'SEEDED']])
    return rows.map((r) => {
      if (!names.has(r.sid)) names.set(r.sid, `S${names.size}`)
      return { session: names.get(r.sid)!, visit: r.visit, record: r.record, sourceCacheCleared: r.cleared }
    })
  }

  /** The lifecycle record as both copies read it: the visit and the session it belongs to. */
  function storedRecord(): Trace['record'] {
    const r = readSessionRecord()!
    return { id: r.id, n: r.n, last: r.last, s: r.s, c: r.c }
  }

  /**
   * The site: each load starts the module's page state over at that address,
   * referrer and navigation type; each event is the next advanceSession on it. A
   * tab-cache sentinel (valid JSON, so a continuing session hands it straight back)
   * shows whether the step cleared the first-touch capture, which is what a session
   * ending does. An `old` step is the other tab's deployed tracker.
   */
  function runSite(t: Timeline): Row[] {
    clearBrowserState()
    resetSessionMemory()
    t.seed?.()
    const oldTab = deployedTrackerTab()
    const rows: Row[] = []
    for (const step of t.steps) {
      if (step.kind === 'old') {
        rows.push({ sid: oldTab.event(T0 + step.at), visit: null, record: storedRecord(), cleared: null })
        continue
      }
      if (step.kind !== 'event') {
        resetSessionMemory()
        window.history.replaceState({}, '', `/cma/1-main-st${step.search}`)
        setReferrer(step.referrer ?? '')
        setNavigationType(step.nav === undefined ? 'navigate' : step.nav)
      }
      window.sessionStorage.setItem(SOURCE_CACHE_KEY, SENTINEL)
      const a = advanceSession({ now: T0 + step.at })!
      rows.push({
        sid: a.sessionId,
        visit: a.visit,
        record: storedRecord(),
        cleared: window.sessionStorage.getItem(SOURCE_CACHE_KEY) === null,
      })
    }
    return rows
  }

  it.each(TIMELINES)('$name', async (t) => {
    const site = runSite(t)

    // The script: load the document, or tap in it, at the same times and addresses,
    // with the same other tab writing between them.
    clearBrowserState()
    resetSessionMemory()
    t.seed?.()
    const oldTab = deployedTrackerTab()
    const doc: Row[] = []
    for (const step of t.steps) {
      vi.setSystemTime(T0 + step.at)
      if (step.kind === 'old') {
        doc.push({ sid: oldTab.event(T0 + step.at), visit: null, record: storedRecord(), cleared: null })
        continue
      }
      window.sessionStorage.setItem(SOURCE_CACHE_KEY, SENTINEL)
      const before = h.posts.length
      if (step.kind === 'event') h.tap('https://ryan-realty.com/reviews', 'Reviews')
      else h.load({ url: `/cma/1-main-st${step.search}`, referrer: step.referrer, navigationType: step.nav })
      await h.flush()
      const post = h.posts[before].body!
      doc.push({
        sid: post.sessionId as string,
        visit: post.visit as Trace['visit'],
        record: storedRecord(),
        // a continuing session hands the cached capture back; a new one recaptured this page
        cleared: post.landingPage !== 'SENTINEL',
      })
    }

    expect(normalize(doc)).toEqual(normalize(site))
  })

  it('the fixtures are not vacuous: the timelines split where the rule says, and only there', () => {
    const sessionsOf = (name: string) => normalize(runSite(TIMELINES.find((x) => x.name.startsWith(name))!)).map((r) => r.session)
    // spring -> spring -> facebook, ... -> FACEBOOK (same) -> spring only (new) -> SPRING (same) -> facebook+spring (new)
    expect(sessionsOf('arrivals')).toEqual(['S1', 'S1', 'S2', 'S2', 'S2', 'S2', 'S2', 'S3', 'S3', 'S4'])
    // nothing but the final arrival ends it
    expect(sessionsOf('not arrivals')).toEqual(['S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S2'])
    expect(sessionsOf('the report sent by text')).toEqual(Array(7).fill('S1'))
    // an old id is never kept; one the rule recorded is
    expect(sessionsOf('an id already in storage')[0]).not.toBe('SEEDED')
    expect(sessionsOf('a record from before the rule (no session')[0]).not.toBe('SEEDED')
    expect(sessionsOf('a record this rule wrote')).toEqual(['SEEDED', 'SEEDED', 'S1'])
    // the rollout: the other tab's rewrites never split a visit, and its events are activity
    expect(sessionsOf('a tab still on the deployed tracker')).toEqual(Array(9).fill('S1'))
    expect(sessionsOf('the deployed tracker\'s events are activity')).toEqual(['S1', 'S1', 'S1', 'S1', 'S2'])
    // ...and an id from before the rule is replaced, then followed by the old tab too
    expect(sessionsOf('a browser from before the rule whose old tab')).toEqual(['SEEDED', 'S1', 'S1', 'S1'])
  })
})

describe('the arrival rule: the script and the site agree on which page loads are arrivals', () => {
  const NAVS = ['navigate', 'reload', 'back_forward', 'prerender', null] as const
  const REFERRERS = ['', 'https://mail.google.com/', 'https://ryan-realty.com/cma/1-main-st', 'https://www.ryan-realty.com/', 'https://ryan-realty.com.example.org/', 'not a url']
  const cases = NAVS.flatMap((nav) => REFERRERS.map((referrer) => ({ nav, referrer })))
  const RUNNING = { id: Math.floor(T0 / 1000), n: 2, last: T0, sid: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f', s: 'facebook', c: 'spring' }
  const seed = () => storeSessionRecord(RUNNING, RUNNING.sid)

  it.each(cases)('navigation $nav from "$referrer"', async ({ nav, referrer }) => {
    const expected = isExternalArrival({ firstEventOfPageLoad: true, navigationType: nav, referrer, hostname: 'ryan-realty.com' })
    // a session running under another campaign; the page loads a minute later on a new one
    clearBrowserState()
    resetSessionMemory()
    seed()
    window.history.replaceState({}, '', '/cma/1-main-st?utm_source=cma&utm_campaign=1-main-st')
    setReferrer(referrer)
    setNavigationType(nav)
    const site = advanceSession({ now: T0 + MIN })!
    expect(site.sessionId !== RUNNING.sid).toBe(expected)

    clearBrowserState()
    resetSessionMemory()
    seed()
    vi.setSystemTime(T0 + MIN)
    h.load({ url: '/cma/1-main-st?utm_source=cma&utm_campaign=1-main-st', referrer, navigationType: nav })
    await h.flush()
    expect(h.posts[0].body!.sessionId !== RUNNING.sid).toBe(expected)
    h.calls.length = 0
  })

  it('the matrix is not vacuous: some loads are arrivals and some are not', () => {
    const verdicts = cases.map(({ nav, referrer }) =>
      isExternalArrival({ firstEventOfPageLoad: true, navigationType: nav, referrer, hostname: 'ryan-realty.com' }),
    )
    expect(verdicts.filter(Boolean).length).toBe(4) // navigate from: nothing, webmail, a look-alike host, an unreadable referrer
    expect(verdicts.filter((v) => !v).length).toBe(cases.length - 4)
  })
})

describe('storage that answers reads but refuses writes: both keep the session in memory the same way', () => {
  // A full quota, or a private window whose setItem throws while getItem still
  // answers null. Nothing persists, so one page life is all there is: a page view
  // and the events after it. (The script's memory is per page load, like the
  // module's is per bundle load.)
  const AT = [0, 1 * MIN, 32 * MIN, 33 * MIN]
  const refuseWrites = () =>
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
  type Row = { sid: string; visit: { id: number; number: number; start: boolean } }
  const named = (rows: Row[]) => {
    const names = new Map<string, string>()
    return rows.map((r) => {
      if (!names.has(r.sid)) names.set(r.sid, `S${names.size + 1}`)
      return { session: names.get(r.sid)!, visit: r.visit }
    })
  }

  it.each([['an untagged page', ''], ['a campaign link', '?utm_source=cma&utm_campaign=1-main-st']])('%s', async (_label, search) => {
    // The site
    clearBrowserState()
    resetSessionMemory()
    let spy = refuseWrites()
    const site: Row[] = AT.map((t) => {
      const a = advanceSession({ now: T0 + t, search })!
      return { sid: a.sessionId, visit: a.visit }
    })
    spy.mockRestore()

    // The script: the page view, then a tap at each later time
    clearBrowserState()
    resetSessionMemory()
    spy = refuseWrites()
    const doc: Row[] = []
    vi.setSystemTime(T0 + AT[0])
    h.load({ url: `/cma/1-main-st${search}` })
    await h.flush()
    doc.push({ sid: h.posts[0].body!.sessionId as string, visit: h.posts[0].body!.visit as Row['visit'] })
    for (const t of AT.slice(1)) {
      vi.setSystemTime(T0 + t)
      const before = h.posts.length
      h.tap('https://ryan-realty.com/reviews', 'Reviews')
      await h.flush()
      const body = h.posts[before].body!
      doc.push({ sid: body.sessionId as string, visit: body.visit as Row['visit'] })
    }
    spy.mockRestore()

    expect(named(doc)).toEqual(named(site))
    // and it is the session rule, not a session per event: one, then a second after 31 idle minutes
    expect(named(site).map((r) => r.session)).toEqual(['S1', 'S1', 'S2', 'S2'])
    expect(named(site).map((r) => [r.visit.number, r.visit.start])).toEqual([[1, true], [1, false], [2, true], [2, false]])
  })

  it('a storage that still holds an OLD id and refuses writes: neither answers the old id after the session ends', async () => {
    // A full quota: the id and record written months ago are still readable. The id
    // and the record are read as one pair, so once a session has ended here the old
    // id is never posted again (read apart, every later event went out under it).
    const OLD = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
    const seedOld = () => storeSessionRecord({ id: 1, n: 4, last: T0 - 90 * 24 * 60 * MIN, sid: OLD, s: '', c: '' }, OLD)
    clearBrowserState()
    resetSessionMemory()
    seedOld()
    let spy = refuseWrites()
    const site: Row[] = AT.map((t) => {
      const a = advanceSession({ now: T0 + t, search: '' })!
      return { sid: a.sessionId, visit: a.visit }
    })
    spy.mockRestore()

    clearBrowserState()
    resetSessionMemory()
    seedOld()
    spy = refuseWrites()
    const doc: Row[] = []
    vi.setSystemTime(T0 + AT[0])
    h.load({ url: '/cma/1-main-st' })
    await h.flush()
    doc.push({ sid: h.posts[0].body!.sessionId as string, visit: h.posts[0].body!.visit as Row['visit'] })
    for (const t of AT.slice(1)) {
      vi.setSystemTime(T0 + t)
      const before = h.posts.length
      h.tap('https://ryan-realty.com/reviews', 'Reviews')
      await h.flush()
      const body = h.posts[before].body!
      doc.push({ sid: body.sessionId as string, visit: body.visit as Row['visit'] })
    }
    spy.mockRestore()

    expect(named(doc)).toEqual(named(site))
    expect([...site, ...doc].some((r) => r.sid === OLD)).toBe(false)
    expect(named(site).map((r) => r.session)).toEqual(['S1', 'S1', 'S2', 'S2'])
    expect(named(site).map((r) => r.visit.number)).toEqual([5, 5, 6, 6])
  })
})

describe('first touch: the script captures what the site captures', () => {
  const REFERRERS = [
    '',
    'https://www.facebook.com/',
    'https://l.instagram.com/',
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://duckduckgo.com/',
    'https://www.youtube.com/',
    'https://www.linkedin.com/',
    'https://www.tiktok.com/',
    'https://www.zillow.com/homes',
    'https://www.realtor.com/',
    'https://www.trulia.com/',
    'https://ryan-realty.com/homes-for-sale',
    'https://some-newsletter.example.org/issue-4',
    'not a url',
  ]
  const URLS = [
    '/cma/1-main-st',
    '/cma/1-main-st?utm_source=cma&utm_medium=email&utm_campaign=1-main-st&utm_content=agent-matt&utm_term=t',
    '/cma/1-main-st?utm_medium=email',
    '/cma/1-main-st?fbclid=F1&gclid=G1',
    '/cma/1-main-st?utm_source=CMA&_pid=tok#chapter-3',
  ]
  const cases = URLS.flatMap((url) => REFERRERS.map((referrer) => ({ url, referrer })))

  it.each(cases)('$url from "$referrer"', async ({ url, referrer }) => {
    clearBrowserState()
    resetSessionMemory()
    window.history.replaceState({}, '', url)
    setReferrer(referrer)
    const site = JSON.parse(JSON.stringify(captureSource())) as Record<string, unknown>

    clearBrowserState()
    resetSessionMemory()
    h.load({ url, referrer })
    await h.flush()
    const b = h.posts[0].body!
    const doc = JSON.parse(
      JSON.stringify({
        campaign: b.campaign,
        fbclid: b.fbclid,
        gclid: b.gclid,
        referrer: b.referrer,
        landingPage: b.landingPage,
      }),
    ) as Record<string, unknown>
    expect(doc).toEqual(site)
    h.calls.length = 0
  })
})

describe('the script sends what the site sends, in the fields the route already accepts', () => {
  const routeSrc = readFileSync(join(process.cwd(), 'app/api/visitors/track/route.ts'), 'utf8')
  const bodyType = routeSrc.slice(routeSrc.indexOf('type TrackBody = {'), routeSrc.indexOf('\n}\n', routeSrc.indexOf('type TrackBody = {')))
  const routeFields = new Set([...bodyType.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]))

  it('reads the route body fields (the fixture itself is sound)', () => {
    expect([...routeFields]).toEqual(
      expect.arrayContaining(['sessionId', 'eventType', 'pageUrl', 'campaign', 'referrer', 'landingPage', 'consent', 'visit', 'identityToken']),
    )
  })

  it('every field the script posts is one the track route reads: no new API', async () => {
    h.load({ url: '/cma/1-main-st?utm_source=cma&utm_campaign=1-main-st&fbclid=F&gclid=G&_pid=tok', referrer: 'https://mail.google.com/' })
    await h.flush()
    h.tap('https://ryan-realty.com/reviews', 'Reviews')
    await h.flush()
    for (const post of h.posts) {
      for (const key of Object.keys(post.body!)) expect(routeFields.has(key), `${key} is not a field of TrackBody`).toBe(true)
    }
  })

  it('and the script sends every context field the site tracker does (VisitTracker firstPartyEventContext)', async () => {
    clearBrowserState()
    resetSessionMemory()
    window.history.replaceState({}, '', '/homes-for-sale?utm_source=crm&utm_medium=email')
    setReferrer('https://mail.google.com/')
    autoGrantConsentForAdTraffic()
    const site = firstPartyEventContext()!
    expect(Object.keys(site).sort()).toEqual(
      ['campaign', 'consent', 'fbclid', 'gclid', 'landingPage', 'referrer', 'sessionId', 'sourceDomain', 'visit', 'webdriver'].sort(),
    )

    clearBrowserState()
    resetSessionMemory()
    h.load({ url: '/cma/1-main-st?utm_source=crm&utm_medium=email', referrer: 'https://mail.google.com/' })
    await h.flush()
    const doc = h.posts[0].body!
    for (const key of Object.keys(site)) {
      // undefined fields (no fbclid, no gclid) are simply absent from the JSON
      if ((site as Record<string, unknown>)[key] !== undefined) expect(doc, key).toHaveProperty(key)
    }
  })

  it('the automation signal rides in the shared context on both sides, so every event carries it (a tap included)', async () => {
    // The track route flags a session from the event that CREATES it; any event can be that one.
    clearBrowserState()
    resetSessionMemory()
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: true })
    expect(firstPartyEventContext()!.webdriver).toBe(true)

    clearBrowserState()
    resetSessionMemory()
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: true })
    h.load({ url: '/cma/1-main-st' })
    await h.flush()
    h.tap('https://ryan-realty.com/reviews', 'Reviews')
    await h.flush()
    expect(h.posts.map((p) => p.body!.webdriver)).toEqual([true, true])
  })
})

describe('the literals the mirror must share', () => {
  const capture = (re: RegExp) => {
    const m = re.exec(DOC_TRACKER_SRC)
    if (!m) throw new Error(`rr-doc-tracker.js no longer matches ${re}`)
    return m[1]
  }
  const banner = readFileSync(join(process.cwd(), 'components/CookieConsentBanner.tsx'), 'utf8')

  it('storage keys', () => {
    expect(capture(/var SESSION_KEY = '([^']+)'/)).toBe(SESSION_ID_KEY)
    expect(capture(/var STATE_KEY = '([^']+)'/)).toBe(SESSION_STATE_KEY)
    expect(capture(/var BINDING_KEY = '([^']+)'/)).toBe(SESSION_BINDING_KEY)
    expect(capture(/var SOURCE_KEY = '([^']+)'/)).toBe(SOURCE_CACHE_KEY)
  })

  it('the cookie name, and how long a grant lasts, are the banner\'s', () => {
    expect(capture(/var CONSENT_COOKIE = '([^']+)'/)).toBe(CONSENT_COOKIE)
    expect(/const COOKIE_CONSENT_KEY = '([^']+)'/.exec(banner)![1]).toBe(CONSENT_COOKIE)
    expect(capture(/var CONSENT_EXPIRY_YEARS = (\d+)/)).toBe(/const CONSENT_EXPIRY_YEARS = (\d+)/.exec(banner)![1])
  })

  it('the idle timeout and the session id shape', () => {
    expect(new Function(`return ${capture(/var IDLE_MS = ([^\n]+)/)}`)()).toBe(SESSION_IDLE_MS)
    const uuid = /var UUID = \/(.+)\/i/.exec(DOC_TRACKER_SRC)![1]
    expect(uuid).toBe(SESSION_UUID_V4.source.replace(/\\\//g, '/'))
  })

  it('the campaign-link grant writes the cookie exactly as the banner does', () => {
    expect(DOC_TRACKER_SRC).toContain("'; path=/; expires=' + expires.toUTCString() + '; SameSite=Lax'")
    expect(banner).toContain('; path=/; expires=${expires.toUTCString()}; SameSite=Lax')
  })
})
