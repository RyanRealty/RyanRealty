/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/"}
 *
 * The session rule (Matt 2026-09-29, tightened by the review of 2026-09-30): a
 * session ends after 30 minutes of inactivity, when the visitor ARRIVES on a
 * different campaign, or when the stored id is one the rule did not start; and not
 * otherwise. An arrival is the first tracked event of a page load the browser
 * navigated to from outside the site; a later event on the same page carries the
 * same address, utm tags and all, and never ends a session on its campaign. Every
 * browser tracker follows this module, and public/rr-doc-tracker.js mirrors it
 * (pinned in app/api/visitors/track/doc-tracker.pin.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_ID_KEY,
  SESSION_IDLE_MS,
  SESSION_STATE_KEY,
  SESSION_UUID_V4,
  SOURCE_CACHE_KEY,
  advanceSession,
  campaignKeyFromSearch,
  captureSource,
  currentSessionId,
  decideSession,
  forceNewSession,
  isExternalArrival,
  pageNavigationType,
  readSessionId,
  referrerIsThisSite,
  resetSessionMemory,
  type SessionRecord,
} from './visitor-session'
import { readSessionRecord, setNavigationType, setReferrer, storeSessionRecord } from '@/test/doc-tracker-harness'
import { deployedTrackerTab } from '@/test/deployed-visit-tracker'

const MIN = 60 * 1000
const T0 = Date.UTC(2026, 8, 29, 18, 0, 0)
const OLD_ID = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

function record(over: Partial<SessionRecord> = {}): SessionRecord {
  return { id: Math.floor(T0 / 1000), n: 1, last: T0, sid: 'x', s: '', c: '', ...over }
}

/** The lifecycle record as the rule reads it back: the visit and the session it belongs to. */
const stored = (): SessionRecord | null => readSessionRecord()

/**
 * A new document: the module's page state starts over (as it does when a page
 * loads), at `url`, reached the way `nav` says, from `referrer`.
 */
function pageLoad(url: string, opts: { referrer?: string; nav?: string | null } = {}) {
  resetSessionMemory()
  window.history.replaceState({}, '', url)
  setReferrer(opts.referrer ?? '')
  setNavigationType(opts.nav === undefined ? 'navigate' : opts.nav)
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  pageLoad('/')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  setReferrer('')
})

describe('campaignKeyFromSearch', () => {
  it('reads utm_source and utm_campaign, trimmed and lower-cased', () => {
    expect(campaignKeyFromSearch('?utm_source=CMA&utm_campaign=  1-Main-St ')).toEqual({ source: 'cma', campaign: '1-main-st' })
    expect(campaignKeyFromSearch('utm_source=email')).toEqual({ source: 'email', campaign: '' })
    expect(campaignKeyFromSearch('?utm_campaign=spring')).toEqual({ source: '', campaign: 'spring' })
  })

  it('an ordinary link announces no campaign, so it can never break a session', () => {
    expect(campaignKeyFromSearch('')).toBeNull()
    expect(campaignKeyFromSearch(null)).toBeNull()
    expect(campaignKeyFromSearch('?agent=matt&_pid=tok')).toBeNull()
    expect(campaignKeyFromSearch('?utm_medium=email&utm_content=agent-matt')).toBeNull()
    expect(campaignKeyFromSearch('?utm_source=&utm_campaign=')).toBeNull()
    expect(campaignKeyFromSearch('?fbclid=abc')).toBeNull()
  })
})

describe('isExternalArrival: which events can end a session on their campaign', () => {
  const HOST = 'ryan-realty.com'
  const arrival = (over: Partial<Parameters<typeof isExternalArrival>[0]> = {}) =>
    isExternalArrival({ firstEventOfPageLoad: true, navigationType: 'navigate', referrer: '', hostname: HOST, ...over })

  it('the first event of a page the browser navigated to, from a mail or messaging app or another site, is one', () => {
    expect(arrival()).toBe(true)
    expect(arrival({ referrer: 'https://mail.google.com/' })).toBe(true)
    expect(arrival({ referrer: 'https://l.facebook.com/l.php' })).toBe(true)
    expect(arrival({ referrer: 'not a url' })).toBe(true)
  })

  it('a later event on the same page is not: it carries the same address, utm tags and all', () => {
    expect(arrival({ firstEventOfPageLoad: false })).toBe(false)
  })

  it('a reload, the back or forward button, a prerender, or a browser that cannot say is not', () => {
    expect(arrival({ navigationType: 'reload' })).toBe(false)
    expect(arrival({ navigationType: 'back_forward' })).toBe(false)
    expect(arrival({ navigationType: 'prerender' })).toBe(false)
    expect(arrival({ navigationType: null })).toBe(false)
  })

  it('a link on our own pages (a CMA comp link included) is not, with or without www', () => {
    expect(arrival({ referrer: 'https://ryan-realty.com/cma/1-main-st?utm_source=crm' })).toBe(false)
    expect(arrival({ referrer: 'https://www.ryan-realty.com/homes-for-sale' })).toBe(false)
    expect(arrival({ referrer: 'https://ryan-realty.com/', hostname: 'www.ryan-realty.com' })).toBe(false)
  })

  it('referrerIsThisSite compares the host, not a prefix', () => {
    expect(referrerIsThisSite('https://ryan-realty.com.example.org/', HOST)).toBe(false)
    expect(referrerIsThisSite('https://notryan-realty.com/', HOST)).toBe(false)
    expect(referrerIsThisSite('', HOST)).toBe(false)
    expect(referrerIsThisSite(null, HOST)).toBe(false)
    expect(referrerIsThisSite('https://RYAN-REALTY.com:443/x', HOST)).toBe(true)
  })
})

describe('pageNavigationType', () => {
  it('reads the Navigation Timing entry', () => {
    setNavigationType('back_forward')
    expect(pageNavigationType()).toBe('back_forward')
    setNavigationType('navigate')
    expect(pageNavigationType()).toBe('navigate')
  })

  it('falls back to the older performance.navigation numbers, and says null when there is nothing', () => {
    setNavigationType(null)
    expect(pageNavigationType()).toBeNull()
    Object.defineProperty(performance, 'navigation', { configurable: true, value: { type: 1 } })
    try {
      expect(pageNavigationType()).toBe('reload')
    } finally {
      Object.defineProperty(performance, 'navigation', { configurable: true, value: undefined })
    }
  })
})

describe('decideSession', () => {
  const none = { source: '', campaign: '' }
  const email = { source: 'email', campaign: '' }
  const SID = 'x'

  it('no session id yet: a new session', () => {
    expect(decideSession({ sessionId: null, record: null, now: T0, arrival: null })).toEqual({ newSession: true, reason: 'first' })
  })

  it('a session id no lifecycle record names is never kept: it may be months old', () => {
    // no record at all (an id from before the rule, or one a search event minted)
    expect(decideSession({ sessionId: SID, record: null, now: T0, arrival: null })).toEqual({ newSession: true, reason: 'unrecorded' })
    // a record from before the rule carried an id (TRACK-1, 2026-09-23), however recent
    const track1: SessionRecord = { id: Math.floor(T0 / 1000), n: 3, last: T0 }
    expect(decideSession({ sessionId: SID, record: track1, now: T0 + 1000, arrival: null }).reason).toBe('unrecorded')
    // a record that names a different session
    expect(decideSession({ sessionId: SID, record: record({ sid: 'y' }), now: T0 + 1000, arrival: null }).reason).toBe('unrecorded')
  })

  it('within 30 minutes and no arrival on a new campaign: the session continues', () => {
    expect(decideSession({ sessionId: SID, record: record(), now: T0 + 29 * MIN, arrival: null })).toEqual({ newSession: false, reason: null })
  })

  it('more than 30 minutes since the last activity ends it; exactly 30 does not', () => {
    expect(SESSION_IDLE_MS).toBe(30 * MIN)
    expect(decideSession({ sessionId: SID, record: record(), now: T0 + 30 * MIN, arrival: null }).newSession).toBe(false)
    expect(decideSession({ sessionId: SID, record: record(), now: T0 + 30 * MIN + 1, arrival: null })).toEqual({ newSession: true, reason: 'idle' })
  })

  it('an arrival on a different campaign ends it, even a second after the last click', () => {
    expect(decideSession({ sessionId: SID, record: record({ s: 'crm' }), now: T0 + 1000, arrival: email })).toEqual({ newSession: true, reason: 'campaign' })
    // a session that began with no campaign is also "different" from a tagged arrival
    expect(decideSession({ sessionId: SID, record: record(), now: T0 + 1000, arrival: email }).reason).toBe('campaign')
    // the campaign name alone is enough
    expect(
      decideSession({ sessionId: SID, record: record({ s: 'cma', c: 'a' }), now: T0 + 1000, arrival: { source: 'cma', campaign: 'b' } }).reason,
    ).toBe('campaign')
  })

  it('the same campaign again does not end it; an untagged arrival, or no arrival at all, never does', () => {
    const rec = record({ s: 'email', c: '' })
    expect(decideSession({ sessionId: SID, record: rec, now: T0 + 1000, arrival: email }).newSession).toBe(false)
    expect(decideSession({ sessionId: SID, record: rec, now: T0 + 1000, arrival: null }).newSession).toBe(false)
    expect(decideSession({ sessionId: SID, record: record(), now: T0 + 1000, arrival: none }).newSession).toBe(false)
  })

  it('idle outranks campaign in the reason it reports', () => {
    expect(decideSession({ sessionId: SID, record: record(), now: T0 + 31 * MIN, arrival: email }).reason).toBe('idle')
  })
})

describe('advanceSession', () => {
  it('the first event mints a session, starts visit 1 and records the campaign it arrived on', () => {
    const a = advanceSession({ now: T0, search: '?utm_source=cma&utm_medium=email&utm_campaign=1-main-st' })!
    expect(a.sessionId).toMatch(SESSION_UUID_V4)
    expect(a.reason).toBe('first')
    expect(a.visit).toEqual({ id: Math.floor(T0 / 1000), number: 1, start: true })
    expect(window.localStorage.getItem(SESSION_ID_KEY)).toBe(a.sessionId)
    expect(window.sessionStorage.getItem(SESSION_ID_KEY)).toBe(a.sessionId)
    expect(stored()).toEqual({ id: Math.floor(T0 / 1000), n: 1, last: T0, sid: a.sessionId, s: 'cma', c: '1-main-st' })
  })

  it('keeps one session across a whole visit: page views, clicks and scrolls inside 30 minutes of each other', () => {
    const first = advanceSession({ now: T0, search: '?utm_source=cma&utm_campaign=1-main-st' })!
    // later events on the page, and pages reached by links on the site, whatever their addresses carry
    const events = [
      { at: 2 * MIN, search: '?utm_source=cma&utm_campaign=1-main-st' },
      { at: 9 * MIN, search: '' },
      { at: 30 * MIN, search: '?agent=matt' },
      { at: 31 * MIN, search: '?utm_source=crm&utm_medium=email' },
      // 20 minutes apart for two hours: the clock is the LAST activity, not the start
      ...Array.from({ length: 6 }, (_, i) => ({ at: 31 * MIN + (i + 1) * 20 * MIN, search: '' })),
    ]
    for (const [i, e] of events.entries()) {
      if (i % 2) pageLoad('/homes-for-sale', { referrer: 'https://ryan-realty.com/cma/1-main-st' })
      const a = advanceSession({ now: T0 + e.at, search: e.search })!
      expect(a.sessionId).toBe(first.sessionId)
      expect(a.visit).toEqual({ id: first.visit.id, number: 1, start: false })
      expect(a.reason).toBeNull()
    }
    expect(stored()!.last).toBe(T0 + 31 * MIN + 6 * 20 * MIN)
  })

  it('starts a new session after more than 30 minutes idle', () => {
    const first = advanceSession({ now: T0, search: '' })!
    const later = advanceSession({ now: T0 + 30 * MIN + 1, search: '' })!
    expect(later.sessionId).not.toBe(first.sessionId)
    expect(later.reason).toBe('idle')
    expect(later.visit).toEqual({ id: Math.floor((T0 + 30 * MIN + 1) / 1000), number: 2, start: true })
    expect(readSessionId()).toBe(later.sessionId)
    expect(stored()).toMatchObject({ sid: later.sessionId, n: 2 })
  })

  it('starts a new session when the visitor ARRIVES on a different campaign, mid-visit', () => {
    const first = advanceSession({ now: T0, search: '?utm_source=facebook&utm_campaign=spring' })!
    pageLoad('/?utm_source=crm&utm_medium=email&utm_content=agent-matt', { referrer: 'https://mail.google.com/' })
    const second = advanceSession({ now: T0 + 2 * MIN })!
    expect(second.sessionId).not.toBe(first.sessionId)
    expect(second.reason).toBe('campaign')
    expect(second.visit.start).toBe(true)
    expect(second.visit.number).toBe(2)
    expect(stored()).toMatchObject({ sid: second.sessionId, s: 'crm', c: '' })
    // the same email link again is the same session, and so is a reload of it
    pageLoad('/?utm_source=crm&utm_medium=email&utm_content=agent-matt', { referrer: 'https://mail.google.com/' })
    expect(advanceSession({ now: T0 + 3 * MIN })!.sessionId).toBe(second.sessionId)
    pageLoad('/?utm_source=crm&utm_medium=email&utm_content=agent-matt', { nav: 'reload' })
    const reload = advanceSession({ now: T0 + 4 * MIN })!
    expect(reload.sessionId).toBe(second.sessionId)
    expect(reload.visit.start).toBe(false)
  })

  it('a later event on the same page never ends the session on the campaign in its address (review of 2026-09-30)', () => {
    // The CMA sent by text: utm_source=crm, no campaign. The session is running
    // under the comp page's campaign (cma / the slug) when the reader comes back
    // and taps again; that tap carries the report's address, and is not an arrival.
    pageLoad('/homes-for-sale/bend/1-elm-st-201201231?utm_source=cma&utm_campaign=1-main-st')
    const comp = advanceSession({ now: T0 })!
    const tap = advanceSession({ now: T0 + MIN, search: '?agent=matt&utm_source=crm&utm_medium=email' })!
    const scroll = advanceSession({ now: T0 + 2 * MIN, search: '?utm_source=facebook&utm_campaign=other' })!
    expect(tap.sessionId).toBe(comp.sessionId)
    expect(scroll.sessionId).toBe(comp.sessionId)
    expect([tap.reason, scroll.reason]).toEqual([null, null])
  })

  it.each([
    ['a reload', { nav: 'reload' }],
    ['the back button', { nav: 'back_forward' }],
    ['a link on our own site', { referrer: 'https://www.ryan-realty.com/sell' }],
    ['a browser that cannot say how it got here', { nav: null }],
  ] as const)('%s is not an arrival: its campaign does not end the session', (_label, how) => {
    const first = advanceSession({ now: T0, search: '?utm_source=facebook&utm_campaign=spring' })!
    pageLoad('/cma/1-main-st?utm_source=cma&utm_campaign=1-main-st', how)
    const next = advanceSession({ now: T0 + MIN })!
    expect(next.sessionId).toBe(first.sessionId)
    expect(next.reason).toBeNull()
  })

  it('a session that begins on an event that is not an arrival records the campaign on its address, the one its first touch sends', () => {
    pageLoad('/cma/1-main-st?utm_source=cma&utm_campaign=1-main-st', { referrer: 'https://ryan-realty.com/' })
    const a = advanceSession({ now: T0 })!
    expect(a.reason).toBe('first')
    expect(stored()).toMatchObject({ s: 'cma', c: '1-main-st' })
    // so arriving on that same campaign later is not a new one
    pageLoad('/cma/1-main-st?utm_source=cma&utm_campaign=1-main-st', { referrer: 'https://mail.google.com/' })
    expect(advanceSession({ now: T0 + MIN })!.sessionId).toBe(a.sessionId)
  })

  it('clears the tab first-touch capture whenever a session ends, so the new one captures ITS arrival', () => {
    advanceSession({ now: T0, search: '' })
    window.sessionStorage.setItem(SOURCE_CACHE_KEY, JSON.stringify({ landingPage: 'https://ryan-realty.com/old' }))
    advanceSession({ now: T0 + MIN, search: '' })
    expect(window.sessionStorage.getItem(SOURCE_CACHE_KEY)).not.toBeNull()
    advanceSession({ now: T0 + MIN + 31 * MIN, search: '' })
    expect(window.sessionStorage.getItem(SOURCE_CACHE_KEY)).toBeNull()
  })

  it('does not keep a session id from before the rule: no lifecycle record names it (review of 2026-09-30)', () => {
    // A browser that last visited months ago holds rr_session_id and nothing else.
    // Kept, an email clicked today would land in that session, whose first-touch
    // fields never change, and its campaign would be lost.
    window.localStorage.setItem(SESSION_ID_KEY, OLD_ID)
    const a = advanceSession({ now: T0, search: '?utm_source=crm&utm_medium=email' })!
    expect(a.sessionId).not.toBe(OLD_ID)
    expect(a.reason).toBe('unrecorded')
    expect(a.visit).toEqual({ id: Math.floor(T0 / 1000), number: 1, start: true })
    expect(readSessionId()).toBe(a.sessionId)
    expect(stored()).toMatchObject({ sid: a.sessionId, s: 'crm' })
  })

  it('nor one whose record was written before sessions carried an id (TRACK-1), however recent', () => {
    window.localStorage.setItem(SESSION_ID_KEY, OLD_ID)
    window.localStorage.setItem(SESSION_STATE_KEY, JSON.stringify({ id: Math.floor(T0 / 1000) - 60, n: 5, last: T0 - 60_000 }))
    const a = advanceSession({ now: T0, search: '' })!
    expect(a.sessionId).not.toBe(OLD_ID)
    expect(a.reason).toBe('unrecorded')
    expect(a.visit).toEqual({ id: Math.floor(T0 / 1000), number: 6, start: true }) // the visit count carries on
  })

  it('an id a search event minted before any tracked event is not kept either', () => {
    const minted = currentSessionId()!
    expect(stored()).toBeNull()
    const a = advanceSession({ now: T0, search: '' })!
    expect(a.sessionId).not.toBe(minted)
    expect(a.reason).toBe('unrecorded')
    expect(a.visit).toEqual({ id: Math.floor(T0 / 1000), number: 1, start: true })
  })

  it('reads the current page by default: the URL query, the wall clock, how the page was reached', () => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    pageLoad('/cma/1-main-st?utm_source=cma&utm_campaign=1-main-st', { referrer: 'https://mail.google.com/' })
    const a = advanceSession()!
    expect(a.visit.id).toBe(Math.floor(T0 / 1000))
    expect(stored()).toMatchObject({ s: 'cma', c: '1-main-st' })
    vi.setSystemTime(T0 + MIN)
    pageLoad('/?utm_source=facebook&utm_campaign=spring') // an ad, no referrer
    expect(advanceSession()!.reason).toBe('campaign')
    vi.setSystemTime(T0 + 40 * MIN)
    window.history.replaceState({}, '', '/homes-for-sale')
    expect(advanceSession()!.reason).toBe('idle')
  })

  it('still works, in memory, when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const first = advanceSession({ now: T0, search: '' })!
    const second = advanceSession({ now: T0 + MIN, search: '' })!
    expect(second.sessionId).toBe(first.sessionId)
    expect(second.visit.start).toBe(false)
    const third = advanceSession({ now: T0 + 40 * MIN, search: '' })!
    expect(third.sessionId).not.toBe(first.sessionId)
    expect(readSessionId()).toBe(third.sessionId)
  })

  it('keeps one session when storage answers reads but refuses writes (a full quota, some private windows)', () => {
    // getItem works and returns null because setItem never lands. A memory that only
    // answered when the READ threw minted a new session id and a new visit on every
    // event of such a browser.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const first = advanceSession({ now: T0, search: '' })!
    const second = advanceSession({ now: T0 + MIN, search: '' })!
    expect(second.sessionId).toBe(first.sessionId)
    expect(second.visit).toEqual({ id: first.visit.id, number: 1, start: false })
    expect(readSessionId()).toBe(first.sessionId)
    // the rule still applies: idle ends it (a new page load starts over, as it must:
    // nothing of the page's memory survives it, and storage kept nothing)
    const third = advanceSession({ now: T0 + 40 * MIN, search: '' })!
    expect(third.sessionId).not.toBe(first.sessionId)
    expect(third.visit).toMatchObject({ number: 2, start: true })
    // and the server-asked rotation keeps its record
    const rotated = forceNewSession()!
    expect(rotated).not.toBe(third.sessionId)
    expect(readSessionId()).toBe(rotated)
    expect(advanceSession({ now: T0 + 42 * MIN, search: '' })!.sessionId).toBe(rotated)
  })

  it('storage that still holds an OLD id but refuses writes never answers that old id after a session ends (review of 2026-09-30)', () => {
    // A full quota: the id and record written months ago are still readable, and
    // nothing new lands. Read apart, the id came back from storage while the record
    // came from memory, so every event after the break was posted under the old id.
    storeSessionRecord({ id: 1, n: 4, last: T0 - 90 * 24 * 60 * MIN, sid: OLD_ID, s: '', c: '' }, OLD_ID)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const first = advanceSession({ now: T0, search: '' })!
    expect(first.sessionId).not.toBe(OLD_ID)
    expect(first.reason).toBe('idle')
    const second = advanceSession({ now: T0 + MIN, search: '' })!
    const third = advanceSession({ now: T0 + 2 * MIN, search: '' })!
    expect([second.sessionId, third.sessionId]).toEqual([first.sessionId, first.sessionId])
    expect([second.reason, third.reason]).toEqual([null, null])
    expect(readSessionId()).toBe(first.sessionId)
    expect(currentSessionId()).toBe(first.sessionId)
  })

  it('replaces a corrupt lifecycle record rather than trusting it', () => {
    window.localStorage.setItem(SESSION_ID_KEY, OLD_ID)
    window.localStorage.setItem(SESSION_STATE_KEY, '{not json')
    const a = advanceSession({ now: T0, search: '' })!
    expect(a.sessionId).not.toBe(OLD_ID)
    expect(a.reason).toBe('unrecorded')
    // a fresh page load (nothing in memory) that finds a record that is not one
    window.localStorage.setItem(SESSION_STATE_KEY, JSON.stringify({ id: 'x', n: 1, last: 2 }))
    pageLoad('/')
    expect(advanceSession({ now: T0 + MIN, search: '' })!.reason).toBe('unrecorded')
  })

  it('a page that has already seen the session keeps it when storage is wiped or corrupted underneath it', () => {
    const first = advanceSession({ now: T0, search: '' })!
    window.localStorage.setItem(SESSION_STATE_KEY, '{not json')
    const second = advanceSession({ now: T0 + MIN, search: '' })!
    expect(second.sessionId).toBe(first.sessionId)
    expect(second.visit.start).toBe(false)
    window.localStorage.clear()
    const third = advanceSession({ now: T0 + 2 * MIN, search: '' })!
    expect(third.sessionId).toBe(first.sessionId)
    expect(third.visit.start).toBe(false)
  })

  it('storage that another tab has advanced wins over this page memory', () => {
    const first = advanceSession({ now: T0, search: '' })!
    // another tab began a new session a minute later and wrote it
    const other = { id: Math.floor((T0 + MIN) / 1000), n: 2, last: T0 + MIN, sid: '11111111-2222-4333-8444-555555555555', s: 'crm', c: 'spring' }
    storeSessionRecord(other, other.sid)
    const next = advanceSession({ now: T0 + 2 * MIN, search: '' })!
    expect(next.sessionId).toBe(other.sid)
    expect(next.sessionId).not.toBe(first.sessionId)
    expect(next.visit).toEqual({ id: other.id, number: 2, start: false })
  })
})

describe('a tab still running the tracker deployed before this rule (the rollout, review of 2026-09-30)', () => {
  // A search tab loaded before the deploy changes its filters with pushState and never
  // reloads, so it keeps the old tracker, which rewrites rr_visit_v1 as { id, n, last }
  // on every event. While the session id lived in that record, each rewrite erased it
  // and the next event here started a new session ('unrecorded'): five session ids in
  // nine minutes of one visit. The hot-lead score split across them, and the "looking at
  // this home" text, deduped per session and listing, could fire again.
  it('its events between this tracker\'s events leave the visit one session', () => {
    const oldTab = deployedTrackerTab()
    const first = advanceSession({ now: T0, search: '' })!
    const ids = new Set([first.sessionId])
    for (let i = 1; i <= 4; i++) {
      ids.add(oldTab.event(T0 + (2 * i - 1) * MIN))
      const next = advanceSession({ now: T0 + 2 * i * MIN, search: '' })!
      ids.add(next.sessionId)
      expect(next.reason).toBeNull()
      expect(next.visit).toEqual({ id: first.visit.id, number: 1, start: false })
    }
    expect([...ids]).toEqual([first.sessionId])
    // a page load in this tracker after the old tab wrote carries on too
    pageLoad('/homes-for-sale', { referrer: 'https://ryan-realty.com/' })
    oldTab.event(T0 + 9 * MIN)
    expect(advanceSession({ now: T0 + 10 * MIN, search: '' })!.sessionId).toBe(first.sessionId)
  })

  it('its events are activity in the same session: they keep the visit alive for this tab too', () => {
    const oldTab = deployedTrackerTab()
    const first = advanceSession({ now: T0, search: '' })!
    expect(oldTab.event(T0 + 20 * MIN)).toBe(first.sessionId)
    expect(oldTab.event(T0 + 40 * MIN)).toBe(first.sessionId)
    // 45 minutes after this tab's last event, 5 after the old tab's
    const next = advanceSession({ now: T0 + 45 * MIN, search: '' })!
    expect(next.sessionId).toBe(first.sessionId)
    expect(next.reason).toBeNull()
  })

  it('a session this rule did not start is still not kept: the old tracker writing first changes nothing', () => {
    // A browser from before the rule, whose old tab is the first to post: it keeps its
    // months-old id and writes a record naming no session. This tracker does not keep it.
    window.localStorage.setItem(SESSION_ID_KEY, OLD_ID)
    const oldTab = deployedTrackerTab()
    expect(oldTab.event(T0)).toBe(OLD_ID)
    const a = advanceSession({ now: T0 + MIN, search: '?utm_source=crm&utm_medium=email' })!
    expect(a.sessionId).not.toBe(OLD_ID)
    expect(a.reason).toBe('unrecorded')
    // and from then on the old tab posts under the session this rule started
    expect(oldTab.event(T0 + 2 * MIN)).toBe(a.sessionId)
    expect(advanceSession({ now: T0 + 3 * MIN, search: '' })!.sessionId).toBe(a.sessionId)
  })
})

describe('the arrival is the address the page LOADED at (review of 2026-09-30)', () => {
  // The module records the page's address, referrer and navigation type when it is
  // first evaluated, which is at hydration (lib/tracking.ts imports it). VisitTracker
  // is loaded lazily, so a visitor who taps a link before it mounts sends the first
  // tracked event from the page they navigated to, and until 2026-09-30 THAT address
  // was compared: the campaign they arrived on was never seen.
  async function freshModuleAt(url: string, opts: { referrer?: string } = {}) {
    window.history.replaceState({}, '', url)
    setReferrer(opts.referrer ?? '')
    setNavigationType('navigate')
    vi.resetModules()
    return import('./visitor-session')
  }

  it('a tap before the tracker mounts: the session ends on the arrival\'s campaign, and its first touch is the arrival', async () => {
    // a session running under the spring ad
    advanceSession({ now: T0, search: '?utm_source=facebook&utm_campaign=spring' })
    // the email link, opened from webmail: the page loads, and the module with it
    const m = await freshModuleAt('/?utm_source=crm&utm_medium=email&utm_campaign=fall', { referrer: 'https://mail.google.com/' })
    // the visitor taps a link before the lazy tracker has mounted (a client-side navigation)
    window.history.pushState({}, '', '/homes-for-sale')
    const a = m.advanceSession({ now: T0 + 2 * MIN })!
    expect(a.reason).toBe('campaign')
    expect(stored()).toMatchObject({ s: 'crm', c: 'fall' })
    const src = m.captureSource(a.pageHref)
    expect(src.campaign).toMatchObject({ source: 'crm', medium: 'email', campaign: 'fall' })
    expect(src.landingPage).toBe('https://ryan-realty.com/?utm_source=crm&utm_medium=email&utm_campaign=fall')
    // a later event is on the page it is on, and is never an arrival
    const later = m.advanceSession({ now: T0 + 3 * MIN })!
    expect(later.sessionId).toBe(a.sessionId)
    expect(later.pageHref).toBe('https://ryan-realty.com/homes-for-sale')
  })

  it('an untagged landing followed by a tap onto a tagged address is not an arrival on that tag', async () => {
    const first = advanceSession({ now: T0, search: '?utm_source=facebook&utm_campaign=spring' })!
    const m = await freshModuleAt('/', { referrer: 'https://www.google.com/' })
    window.history.pushState({}, '', '/sell?utm_source=site&utm_campaign=banner')
    const a = m.advanceSession({ now: T0 + MIN })!
    expect(a.sessionId).toBe(first.sessionId)
    expect(a.reason).toBeNull()
  })
})

describe('the other ways in', () => {
  it('readSessionId never mints and never touches the clock', () => {
    expect(readSessionId()).toBeNull()
    window.localStorage.setItem(SESSION_ID_KEY, 'not-a-uuid')
    expect(readSessionId()).toBeNull()
    const a = advanceSession({ now: T0, search: '' })!
    expect(readSessionId()).toBe(a.sessionId)
    expect(stored()!.last).toBe(T0)
  })

  it('currentSessionId mints once and is stable, and does not advance the session clock', () => {
    const a = currentSessionId()!
    expect(a).toMatch(SESSION_UUID_V4)
    expect(currentSessionId()).toBe(a)
    expect(stored()).toBeNull()
  })

  it('forceNewSession (the server said this session belongs to someone else) changes the id and nothing else', () => {
    const first = advanceSession({ now: T0, search: '?utm_source=cma&utm_campaign=1-main-st' })!
    window.sessionStorage.setItem(SOURCE_CACHE_KEY, '{}')
    const fresh = forceNewSession()!
    expect(fresh).not.toBe(first.sessionId)
    expect(readSessionId()).toBe(fresh)
    expect(window.sessionStorage.getItem(SOURCE_CACHE_KEY)).toBeNull()
    expect(stored()).toEqual({ id: first.visit.id, n: 1, last: T0, sid: fresh, s: 'cma', c: '1-main-st' })
    // the visit and campaign carry over: the very next event is the same visit
    const next = advanceSession({ now: T0 + MIN, search: '?utm_source=cma&utm_campaign=1-main-st' })!
    expect(next.sessionId).toBe(fresh)
    expect(next.visit).toEqual({ id: first.visit.id, number: 1, start: false })
  })
})

describe('captureSource', () => {

  it('captures the campaign, click ids, referrer and landing page of the arrival', () => {
    window.history.replaceState({}, '', '/cma/1-main-st?utm_source=cma&utm_medium=email&utm_campaign=1-main-st&utm_content=agent-matt&fbclid=F1&gclid=G1')
    setReferrer('https://mail.google.com/')
    const c = captureSource()
    expect(c.campaign).toEqual({ source: 'cma', medium: 'email', campaign: '1-main-st', content: 'agent-matt', term: undefined })
    expect(c.fbclid).toBe('F1')
    expect(c.gclid).toBe('G1')
    expect(c.referrer).toBe('https://mail.google.com/')
    expect(c.landingPage).toContain('/cma/1-main-st?utm_source=cma')
  })

  it('infers the source from the referrer when the link is untagged, and calls a bare arrival direct / none', () => {
    setReferrer('https://www.google.com/')
    expect(captureSource().campaign).toMatchObject({ source: 'google', medium: 'organic' })
    window.sessionStorage.clear()
    setReferrer('https://l.facebook.com/')
    expect(captureSource().campaign).toMatchObject({ source: 'facebook', medium: 'social' })
    window.sessionStorage.clear()
    setReferrer('https://example.org/x')
    expect(captureSource().campaign).toMatchObject({ source: 'example.org', medium: 'referral' })
    window.sessionStorage.clear()
    setReferrer('')
    expect(captureSource().campaign).toMatchObject({ source: 'direct', medium: 'none' })
  })

  it('is first-touch for the tab: cached, until a session ends', () => {
    window.history.replaceState({}, '', '/?utm_source=crm&utm_medium=email')
    const first = captureSource()
    window.history.replaceState({}, '', '/homes-for-sale')
    expect(captureSource()).toEqual(first)
    // the session ends (idle): the cache goes, and the next capture reads THIS page
    advanceSession({ now: T0, search: '?utm_source=crm' })
    advanceSession({ now: T0 + 40 * MIN, search: '' })
    expect(captureSource().campaign).toMatchObject({ source: 'direct', medium: 'none' })
  })
})
