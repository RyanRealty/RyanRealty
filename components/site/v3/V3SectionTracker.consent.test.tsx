/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/homes-for-sale/bend"}
 *
 * V3SectionTracker posted `{ sessionId, eventType, pageUrl }` and nothing else.
 * /api/visitors/track refuses an event that names no consent level, so every
 * section_view and scroll_depth it ever sent was dropped (found 2026-09-29).
 * It now posts the same context every first-party event carries, consent
 * included, computed by the same function VisitTracker uses, and only for a
 * visitor at the analytics or all tier: at essential the track route strips the
 * section id and the depth, so the row would be an empty event (one per section
 * plus up to four scroll milestones, every page view), and a decline records nothing. The section id and depth ride in
 * `metadata`, the field the route reads, not in top-level fields it ignores.
 */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COOKIE_MATRIX, encodeConsent } from '@/test/consent-fixtures'

vi.mock('next/navigation', () => ({ usePathname: () => '/homes-for-sale/bend', useSearchParams: () => new URLSearchParams() }))
vi.mock('next/link', () => ({ default: () => null }))
vi.mock('@/app/actions/track-user-event', () => ({ trackUserEvent: vi.fn(async () => undefined) }))

import { V3SectionTracker } from './V3SectionTracker.client'
import { currentConsentLevel, type FirstPartyEventContext } from '@/components/VisitTracker'
import { resetSessionMemory } from '@/lib/analytics/visitor-session'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const MIN = 60 * 1000
const T0 = Date.UTC(2026, 8, 29, 18, 0, 0)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Observed = { callback: IntersectionObserverCallback; targets: Element[] }
const observers: Observed[] = []
class FakeIntersectionObserver {
  private readonly rec: Observed
  constructor(callback: IntersectionObserverCallback) {
    this.rec = { callback, targets: [] }
    observers.push(this.rec)
  }
  observe(el: Element) {
    this.rec.targets.push(el)
  }
  disconnect() {}
  unobserve() {}
}

// sendBeacon gets a Blob; this stand-in keeps the JSON string so a test can read it.
class TextBlob {
  constructor(public readonly parts: string[]) {}
}

/** A posted body: the shared first-party context plus the event's own fields. */
type PostedBody = FirstPartyEventContext & Record<string, unknown>

let sent: Array<{ url: string; body: PostedBody }> = []
let container: HTMLDivElement
let mountNode: HTMLDivElement
let root: Root | null = null

const ALL = encodeConsent({ analytics: true, marketing: true })

function setConsent(raw: string | undefined) {
  document.cookie =
    raw === undefined
      ? 'ryan_realty_cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
      : `ryan_realty_cookie_consent=${raw}; path=/`
}

async function mount() {
  // The page: the `.v3` root and its sections. React renders into its own node,
  // because rendering into the page would clear the sections it has to watch.
  container = document.createElement('div')
  container.className = 'v3'
  container.innerHTML = '<section id="hero"></section><section id="market"></section>'
  document.body.appendChild(container)
  mountNode = document.createElement('div')
  document.body.appendChild(mountNode)
  root = createRoot(mountNode)
  await act(async () => {
    root!.render(React.createElement(V3SectionTracker))
  })
}

/** The second section crosses 55% visible. */
function viewSection(id: string) {
  const target = container.querySelector(`#${id}`)!
  const io = observers[observers.length - 1]
  io.callback([{ target, isIntersecting: true, intersectionRatio: 0.9 } as unknown as IntersectionObserverEntry], io as never)
}

function scrollTo(pct: number) {
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
  Object.defineProperty(window, 'scrollY', { configurable: true, value: (pct / 100) * 1000 })
  window.dispatchEvent(new Event('scroll'))
}

beforeEach(() => {
  observers.length = 0
  sent = []
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSessionMemory()
  setConsent(undefined)
  window.history.replaceState({}, '', '/homes-for-sale/bend')
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  vi.stubGlobal('Blob', TextBlob)
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: vi.fn((url: string, blob: TextBlob) => {
      sent.push({ url, body: JSON.parse(blob.parts[0]) as PostedBody })
      return true
    }),
  })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})

afterEach(() => {
  if (root) {
    const current = root
    root = null
    act(() => current.unmount())
  }
  container?.remove()
  mountNode?.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setConsent(undefined)
})

describe('V3SectionTracker GA4 section_view', () => {
  it('names its surface, so GA4 surface is not empty on section_view', async () => {
    const w = window as Window & { dataLayer?: unknown[] }
    w.dataLayer = []
    setConsent(ALL)
    await mount()
    viewSection('market')
    const ev = (w.dataLayer as Array<Record<string, unknown>>).find((e) => e.event === 'section_view')
    expect(ev?.ga4_params).toEqual({ section: 'market', surface: 'page_section' })
    delete w.dataLayer
  })
})

describe('V3SectionTracker carries the consent VisitTracker computes', () => {
  it('a section_view posts consent, the session, the arrival attribution, the visit and the section in metadata', async () => {
    setConsent(ALL)
    await mount()
    viewSection('market')

    expect(sent).toHaveLength(1)
    const b = sent[0].body
    expect(sent[0].url).toBe('/api/visitors/track')
    expect(b.eventType).toBe('section_view')
    // the field the track route reads (a top-level `section` is ignored by it)
    expect(b.metadata).toEqual({ section: 'market' })
    expect(b.section).toBeUndefined()
    expect(b.pageUrl).toBe('https://ryan-realty.com/homes-for-sale/bend')
    expect(b.consent).toBe('all')
    expect(b.consent).toBe(currentConsentLevel())
    expect(b.sessionId).toMatch(UUID)
    expect(b.sourceDomain).toBe('ryan-realty.com')
    expect(b.campaign).toMatchObject({ source: 'direct', medium: 'none' })
    expect(b.landingPage).toBe('https://ryan-realty.com/homes-for-sale/bend')
    expect(b.visit).toEqual({ id: Math.floor(T0 / 1000), number: 1, start: true })
  })

  it('a scroll milestone posts the same context, with the depth in metadata and no scrollDepthPct', async () => {
    setConsent(ALL)
    await mount()
    scrollTo(30)
    expect(sent.map((x) => x.body.eventType)).toEqual(['scroll_depth'])
    expect(sent[0].body.consent).toBe('all')
    expect(sent[0].body.sessionId).toMatch(UUID)
    expect(sent[0].body.metadata).toEqual({ percent: 25 })
    // scrollDepthPct is what visitor_score_delta_for_event scores (+5 at 75 and up):
    // wiring it is a lead-scoring decision, so it is deliberately not sent
    expect(sent[0].body.scrollDepthPct).toBeUndefined()
    expect(sent[0].body.scrollDepth).toBeUndefined()
  })

  it.each(COOKIE_MATRIX.filter((c) => c.level === 'all' || c.level === 'analytics'))('$label: posts consent $level, the value currentConsentLevel returns', async ({ raw, level }) => {
    setConsent(raw)
    await mount()
    viewSection('hero')
    expect(sent).toHaveLength(1)
    expect(sent[0].body.consent).toBe(level)
    expect(currentConsentLevel()).toBe(level)
  })

  it.each(COOKIE_MATRIX.filter((c) => c.level === 'essential'))('$label (essential): posts nothing, because the store would keep an empty row, and leaves no session id', async ({ raw }) => {
    setConsent(raw)
    await mount()
    viewSection('hero')
    viewSection('market')
    scrollTo(100)
    expect(currentConsentLevel()).toBe('essential')
    expect(sent).toEqual([])
    expect(window.localStorage.getItem('rr_session_id')).toBeNull()
    expect(window.localStorage.getItem('rr_visit_v1')).toBeNull()
  })

  it.each(COOKIE_MATRIX.filter((c) => c.level === 'declined'))('$label: a visitor who declined posts nothing and leaves no session id', async ({ raw }) => {
    setConsent(raw)
    await mount()
    viewSection('hero')
    scrollTo(80)
    expect(sent).toEqual([])
    expect(window.localStorage.getItem('rr_session_id')).toBeNull()
    expect(window.localStorage.getItem('rr_visit_v1')).toBeNull()
  })

  it('a scripted browser says so on a section view too: it can be the event that creates the session (review of 2026-09-30)', async () => {
    // The track route flags a session as automation only from the event that creates
    // it, and this tracker's post can be that event. Its body used to carry no
    // webdriver field, so such a session was never flagged and could be identified.
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: true })
    try {
      setConsent(ALL)
      await mount()
      viewSection('hero')
      scrollTo(30)
      expect(sent.map((x) => x.body.webdriver)).toEqual([true, true])
    } finally {
      Object.defineProperty(navigator, 'webdriver', { configurable: true, value: false })
    }
  })

  it('falls back to fetch keepalive with the same body when sendBeacon is missing', async () => {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: undefined })
    const posted: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        posted.push(JSON.parse(String(init?.body)))
        return { ok: true, json: async () => ({}) } as unknown as Response
      }),
    )
    setConsent(encodeConsent({ analytics: true, marketing: true }))
    await mount()
    viewSection('hero')
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ eventType: 'section_view', consent: 'all' })
  })
})

describe('a session born from a section or scroll event is attributed, and follows the session rule', () => {
  beforeEach(() => {
    // a consented visitor: a campaign link with no banner answer is granted this tier by
    // VisitTracker's mount effect, which is not mounted here
    setConsent(ALL)
  })

  it('carries the campaign on the link the page was opened with', async () => {
    window.history.replaceState({}, '', '/homes-for-sale/bend?utm_source=crm&utm_medium=email&utm_campaign=spring&utm_content=agent-matt')
    await mount()
    viewSection('market')
    const b = sent[0].body
    expect(b.campaign).toMatchObject({ source: 'crm', medium: 'email', campaign: 'spring', content: 'agent-matt' })
    expect(b.landingPage).toContain('utm_campaign=spring')
    expect(b.consent).toBe('all')
  })

  it('keeps one session through a reading and starts another after 30 minutes idle', async () => {
    await mount()
    viewSection('hero')
    vi.setSystemTime(T0 + 10 * MIN)
    viewSection('market')
    scrollTo(60)
    expect(new Set(sent.map((x) => x.body.sessionId)).size).toBe(1)

    vi.setSystemTime(T0 + 10 * MIN + 31 * MIN)
    scrollTo(100)
    const ids = sent.map((x) => x.body.sessionId)
    expect(new Set(ids).size).toBe(2)
    // scrolling to the bottom crosses two milestones (75, 100): the first begins the
    // new session, the second is inside it
    const born = sent.find((x) => x.body.sessionId !== ids[0])!.body
    expect(born.eventType).toBe('scroll_depth')
    expect(born.visit).toMatchObject({ number: 2, start: true })
    // the session this event created is attributed to the page it is on
    expect(born.landingPage).toBe('https://ryan-realty.com/homes-for-sale/bend')
    expect(born.campaign).toBeDefined()
    expect(sent[sent.length - 1].body.sessionId).toBe(born.sessionId)
    expect(sent[sent.length - 1].body.visit.start).toBe(false)
  })
})
