/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/"}
 *
 * VisitTracker and the session rule (Matt 2026-09-29). Every public page view and
 * every interaction that posts through fireFirstPartyEvent now applies the rule in
 * lib/analytics/visitor-session.ts: a new session after 30 minutes idle or on an
 * ARRIVAL from a different campaign (the first event of a page load the browser
 * navigated to from outside the site), never inside one. The consent tier it posts
 * at is the one mapping in lib/identity/consent.ts, the same value V3SectionTracker
 * sends, and every post carries the browser's automation and GPC signals.
 */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COOKIE_MATRIX, encodeConsent } from '@/test/consent-fixtures'

const nav = vi.hoisted(() => ({ pathname: '/homes-for-sale/bend' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname, useSearchParams: () => new URLSearchParams() }))
vi.mock('next/link', () => ({ default: () => null }))
vi.mock('@/app/actions/track-user-event', () => ({ trackUserEvent: vi.fn(async () => undefined) }))

import VisitTracker, {
  currentConsentLevel,
  fireFirstPartyEvent,
  firstPartyEventContext,
  getOrCreateSessionId,
  type FirstPartyEventContext,
} from './VisitTracker'
import { readRrSessionId } from '@/lib/tracking'
import { postedSession, resetSessionMemory } from '@/lib/analytics/visitor-session'
import { setNavigationType, setReferrer } from '@/test/doc-tracker-harness'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const MIN = 60 * 1000
const T0 = Date.UTC(2026, 8, 29, 18, 0, 0)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** A tracker post: the shared first-party context plus the event's own fields. */
type Post = FirstPartyEventContext & Record<string, unknown>
let posts: Post[]
let respond: (n: number, body: Post) => Record<string, unknown>
let root: Root | null = null
let mountNode: HTMLDivElement | null = null

function setConsent(raw: string | undefined) {
  document.cookie =
    raw === undefined
      ? 'ryan_realty_cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
      : `ryan_realty_cookie_consent=${raw}; path=/`
}

function goto(url: string) {
  window.history.replaceState({}, '', url)
}

/** A new document at `url`: the session module's page state starts over, as it does on a page load. */
function pageLoad(url: string, opts: { referrer?: string; nav?: string } = {}) {
  resetSessionMemory()
  goto(url)
  setReferrer(opts.referrer ?? '')
  setNavigationType(opts.nav ?? 'navigate')
}

function setSignal(name: 'webdriver' | 'globalPrivacyControl', value: boolean | undefined) {
  Object.defineProperty(navigator, name, { configurable: true, value })
}

const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0))
}

beforeEach(() => {
  posts = []
  respond = () => ({ ok: true })
  window.localStorage.clear()
  window.sessionStorage.clear()
  setConsent(undefined)
  pageLoad('/homes-for-sale/bend')
  setSignal('webdriver', false)
  setSignal('globalPrivacyControl', undefined)
  nav.pathname = '/homes-for-sale/bend'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Post
      posts.push(body)
      const json = respond(posts.length, body)
      return { ok: true, json: async () => json } as unknown as Response
    }),
  )
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})

afterEach(() => {
  if (root) {
    const current = root
    root = null
    act(() => current.unmount())
  }
  mountNode?.remove()
  mountNode = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setConsent(undefined)
  document.cookie = 'rr_cr=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  setSignal('webdriver', false)
  setSignal('globalPrivacyControl', undefined)
})

describe('fireFirstPartyEvent applies the session rule', () => {
  it('posts the session, the tier, the arrival attribution and the visit', async () => {
    goto('/homes-for-sale/bend?utm_source=crm&utm_medium=email&utm_campaign=spring&fbclid=F1')
    fireFirstPartyEvent('page_view')
    expect(posts).toHaveLength(1)
    const p = posts[0]
    expect(p.sessionId).toMatch(UUID)
    expect(p.eventType).toBe('page_view')
    expect(p.consent).toBe('essential') // no answer, no region signal, fail closed
    expect(p.campaign).toMatchObject({ source: 'crm', medium: 'email', campaign: 'spring' })
    expect(p.fbclid).toBe('F1')
    expect(p.landingPage).toContain('utm_campaign=spring')
    expect(p.visit).toEqual({ id: Math.floor(T0 / 1000), number: 1, start: true })
    expect(p.sourceDomain).toBe('ryan-realty.com')
  })

  it('one session through a visit; a new one after more than 30 minutes idle', () => {
    fireFirstPartyEvent('page_view')
    vi.setSystemTime(T0 + 20 * MIN)
    fireFirstPartyEvent('cta_click')
    vi.setSystemTime(T0 + 45 * MIN) // 25 after the last event, 45 after the first
    fireFirstPartyEvent('page_view')
    expect(new Set(posts.map((p) => p.sessionId)).size).toBe(1)
    expect(posts.map((p) => p.visit.start)).toEqual([true, false, false])

    vi.setSystemTime(T0 + 45 * MIN + 30 * MIN + 1)
    fireFirstPartyEvent('page_view')
    expect(posts[3].sessionId).not.toBe(posts[0].sessionId)
    expect(posts[3].visit).toEqual({ id: Math.floor((T0 + 75 * MIN + 1) / 1000), number: 2, start: true })
  })

  it('an arrival on a different campaign starts a new session, and the new session carries THAT campaign', () => {
    pageLoad('/homes-for-sale/bend?utm_source=facebook&utm_campaign=spring')
    fireFirstPartyEvent('page_view')
    vi.setSystemTime(T0 + 2 * MIN)
    // the email link, opened from webmail: a new page load from outside the site
    pageLoad('/homes-for-sale/bend?utm_source=crm&utm_medium=email&utm_campaign=fall', { referrer: 'https://mail.google.com/' })
    fireFirstPartyEvent('page_view')
    expect(posts[1].sessionId).not.toBe(posts[0].sessionId)
    expect(posts[1].campaign).toMatchObject({ source: 'crm', campaign: 'fall' })
    expect(posts[1].landingPage).toContain('utm_campaign=fall')
    expect(posts[1].visit).toMatchObject({ number: 2, start: true })
    // and it carries on inside it: a client-side navigation to a page with no campaign of its own
    vi.setSystemTime(T0 + 3 * MIN)
    goto('/homes-for-sale/bend')
    fireFirstPartyEvent('page_view')
    expect(posts[2].sessionId).toBe(posts[1].sessionId)
  })

  it('a later event whose address carries another campaign is not an arrival and never ends the session (review of 2026-09-30)', () => {
    // A comp page opened from a CMA carries utm_source=cma&utm_campaign=<slug>; the
    // session was born on the report's text link (utm_source=crm, no campaign).
    pageLoad('/cma/cma-828-florida?utm_source=crm&utm_medium=email')
    fireFirstPartyEvent('page_view')
    vi.setSystemTime(T0 + MIN)
    pageLoad('/homes-for-sale/bend/1-elm-st-201201231?utm_source=cma&utm_medium=document&utm_campaign=cma-828-florida', {
      referrer: 'https://ryan-realty.com/cma/cma-828-florida?utm_source=crm&utm_medium=email',
    })
    fireFirstPartyEvent('listing_view', { listingMls: '201201231' })
    vi.setSystemTime(T0 + 2 * MIN)
    fireFirstPartyEvent('cta_click')
    vi.setSystemTime(T0 + 3 * MIN)
    pageLoad('/cma/cma-828-florida?utm_source=crm&utm_medium=email', { nav: 'back_forward' })
    fireFirstPartyEvent('page_view')
    expect(new Set(posts.map((p) => p.sessionId)).size).toBe(1)
    expect(posts.map((p) => p.visit.start)).toEqual([true, false, false, false])
  })

  it('a declined visitor posts nothing and leaves no session id or lifecycle record', () => {
    setConsent(encodeConsent({ analytics: false, marketing: false }))
    fireFirstPartyEvent('page_view')
    expect(posts).toEqual([])
    expect(window.localStorage.getItem('rr_session_id')).toBeNull()
    expect(window.localStorage.getItem('rr_visit_v1')).toBeNull()
    expect(firstPartyEventContext()).toBeNull()
  })

  it.each(COOKIE_MATRIX)('$label posts at the tier currentConsentLevel names', ({ raw, level }) => {
    setConsent(raw)
    expect(currentConsentLevel()).toBe(level)
    fireFirstPartyEvent('page_view')
    if (level === 'declined') expect(posts).toEqual([])
    else expect(posts[0].consent).toBe(level)
  })

  it('answers a rotateSession by starting a fresh session and re-sending once, never in a loop', async () => {
    respond = (n) => (n <= 2 ? { ok: true, rotateSession: true } : { ok: true })
    fireFirstPartyEvent('page_view')
    await flush()
    // first send, one re-send under a new id; the second rotate request is not followed
    expect(posts).toHaveLength(2)
    expect(posts[1].sessionId).not.toBe(posts[0].sessionId)
    expect(posts[1].campaign).toEqual(posts[0].campaign)
    expect(readRrSessionId()).toBe(posts[1].sessionId)
  })

  it('says which session each post landed in once it settles, the re-sent one after a rotateSession (the identity bridge waits for it)', async () => {
    fireFirstPartyEvent('page_view')
    await flush()
    expect(await postedSession(0)).toBe(posts[0].sessionId)

    resetSessionMemory()
    posts = []
    respond = (n) => (n === 1 ? { ok: true, rotateSession: true } : { ok: true })
    fireFirstPartyEvent('page_view')
    await flush()
    expect(posts).toHaveLength(2)
    expect(await postedSession(0)).toBe(posts[1].sessionId)
    expect(posts[1].sessionId).not.toBe(posts[0].sessionId)
  })

  it('a post the route could not take still says its session (the bridge must not wait for ever)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) }) as unknown as Response))
    fireFirstPartyEvent('page_view')
    const sid = readRrSessionId()
    await flush()
    expect(await postedSession(0)).toBe(sid)
  })

  it('forwards the signed person token from the link on the page view', () => {
    goto('/homes-for-sale/bend?agent=matt&_pid=64115.email.abcdefghijklmnopqrstuv')
    fireFirstPartyEvent('page_view')
    expect(posts[0].identityToken).toBe('64115.email.abcdefghijklmnopqrstuv')
  })

  it('every event carries the automation signal in the shared context (the route flags a session from it)', () => {
    fireFirstPartyEvent('page_view')
    expect(posts[0].webdriver).toBeUndefined()
    setSignal('webdriver', true)
    expect(firstPartyEventContext()).toMatchObject({ webdriver: true })
    fireFirstPartyEvent('cta_click')
    expect(posts[1]).toMatchObject({ webdriver: true })
  })

  it('under Global Privacy Control nothing identifying is written or sent: one notice per page load carries the signal alone (review of 2026-09-30)', async () => {
    setSignal('globalPrivacyControl', true)
    goto('/homes-for-sale/bend?utm_source=crm&utm_medium=email&_pid=64115.email.abcdefghijklmnopqrstuv')
    fireFirstPartyEvent('page_view')
    fireFirstPartyEvent('cta_click')
    fireFirstPartyEvent('listing_view', { listingMls: '201201234' })
    expect(firstPartyEventContext()).toBeNull()
    // no session id, no lifecycle record, no first-touch capture: no identifier at all
    expect(Object.keys(window.localStorage)).toEqual([])
    expect(Object.keys(window.sessionStorage)).toEqual([])
    // the track route records a durable suppression for a contact the browser already
    // carries (its signed rr_pid cookie or its rr_vid), and writes nothing else
    expect(posts).toEqual([{ gpc: true }])
    // a new page load sends its own notice
    pageLoad('/sell')
    fireFirstPartyEvent('page_view')
    expect(posts).toEqual([{ gpc: true }, { gpc: true }])
    expect(Object.keys(window.localStorage)).toEqual([])
  })
})

describe('the entry points that are not tracked events', () => {
  it('getOrCreateSessionId mints once, is stable, and never advances the session clock', () => {
    const id = getOrCreateSessionId()!
    expect(id).toMatch(UUID)
    expect(getOrCreateSessionId()).toBe(id)
    expect(window.localStorage.getItem('rr_visit_v1')).toBeNull()
    // no lifecycle record names that id, so the first tracked event starts a session of
    // its own (an id the rule did not start could be months old), and search events
    // from then on read the tracked session's id
    fireFirstPartyEvent('page_view')
    expect(posts[0].sessionId).not.toBe(id)
    expect(getOrCreateSessionId()).toBe(posts[0].sessionId)
  })

  it('lib/tracking reads the id the tracker uses, so a lead form stitches the right session', () => {
    expect(readRrSessionId()).toBeUndefined()
    fireFirstPartyEvent('page_view')
    expect(readRrSessionId()).toBe(posts[0].sessionId)
    vi.setSystemTime(T0 + 40 * MIN)
    fireFirstPartyEvent('page_view')
    expect(readRrSessionId()).toBe(posts[1].sessionId)
    expect(posts[1].sessionId).not.toBe(posts[0].sessionId)
  })
})

describe('the mounted tracker', () => {
  async function mount() {
    mountNode = document.createElement('div')
    document.body.appendChild(mountNode)
    root = createRoot(mountNode)
    await act(async () => {
      root!.render(React.createElement(VisitTracker, { userId: null }))
    })
  }

  it('posts one page_view on mount at the tier the visitor chose', async () => {
    setConsent(encodeConsent({ analytics: true, marketing: false }))
    await mount()
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({ eventType: 'page_view', consent: 'analytics' })
  })

  it('a US campaign link with no banner answer stays analytics and does not write the consent cookie', async () => {
    document.cookie = 'rr_cr=0; path=/'
    goto('/homes-for-sale/bend?utm_source=crm&utm_medium=email&gclid=G1')
    await mount()
    expect(posts[0].consent).toBe('analytics')
    expect(document.cookie).not.toContain('ryan_realty_cookie_consent=')
  })

  it('a DE visitor on a utm/fbclid link with no answer is not auto-granted', async () => {
    document.cookie = 'rr_cr=1; path=/'
    goto('/homes-for-sale/bend?utm_source=crm&utm_medium=email&fbclid=TEST')
    await mount()
    expect(posts[0].consent).toBe('essential')
    expect(document.cookie).not.toContain('ryan_realty_cookie_consent=')
  })

  it('never grants the campaign-link tier to a browser sending Global Privacy Control, and posts only the notice', async () => {
    setSignal('globalPrivacyControl', true)
    goto('/homes-for-sale/bend?utm_source=crm&utm_medium=email')
    await mount()
    expect(document.cookie).not.toContain('ryan_realty_cookie_consent=')
    expect(posts).toEqual([{ gpc: true }])
    expect(window.localStorage.getItem('rr_session_id')).toBeNull()
  })

  it('a US region signal with no banner answer posts analytics, not essential', () => {
    document.cookie = 'rr_cr=0; path=/'
    fireFirstPartyEvent('page_view')
    expect(posts[0].consent).toBe('analytics')
  })

  it('a restricted region signal with no banner answer stays essential', () => {
    document.cookie = 'rr_cr=1; path=/'
    fireFirstPartyEvent('page_view')
    expect(posts[0].consent).toBe('essential')
  })

  it('GPC with a US region signal still posts only the notice', () => {
    document.cookie = 'rr_cr=0; path=/'
    setSignal('globalPrivacyControl', true)
    fireFirstPartyEvent('page_view')
    expect(posts).toEqual([{ gpc: true }])
  })

  it('posts nothing for a visitor who declined', async () => {
    setConsent(encodeConsent({ analytics: false, marketing: false }))
    await mount()
    expect(posts).toEqual([])
  })

  it('a private page (a signing link) is never tracked', async () => {
    nav.pathname = '/sign/abcdef123456'
    await mount()
    expect(posts).toEqual([])
  })
})

describe('the fields it posts are ones the track route reads', () => {
  const routeSrc = readFileSync(join(process.cwd(), 'app/api/visitors/track/route.ts'), 'utf8')
  const start = routeSrc.indexOf('type TrackBody = {')
  const bodyType = routeSrc.slice(start, routeSrc.indexOf('\n}\n', start))
  const routeFields = new Set([...bodyType.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]))

  it('every key of a posted event is a TrackBody field', () => {
    goto('/homes-for-sale/bend?utm_source=crm&fbclid=F&gclid=G&_pid=tok')
    fireFirstPartyEvent('listing_view', { listingMls: '201201234', metadata: { a: 1 }, scrollDepthPct: 50 })
    for (const key of Object.keys(posts[0])) expect(routeFields.has(key), `${key} is not a field of TrackBody`).toBe(true)
  })
})
