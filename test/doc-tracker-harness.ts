// Runs public/rr-doc-tracker.js the way a browser does, inside the jsdom test
// environment, and records what it sends. Shared by the client-document tracker
// tests (app/api/visitors/track/doc-tracker.*.test.ts and
// new-session-identity.test.ts). The script is a plain file served as-is, so the
// only honest test of it is to execute it.
//
// Lives in test/ rather than lib/ because a module only tests import is an
// orphan to ci:reachable-exports.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { vi } from 'vitest'
import {
  SESSION_BINDING_KEY,
  SESSION_ID_KEY,
  SESSION_STATE_KEY,
  type SessionRecord,
} from '@/lib/analytics/visitor-session'

export const DOC_TRACKER_SRC = readFileSync(join(process.cwd(), 'public/rr-doc-tracker.js'), 'utf8')

/**
 * Store a lifecycle record the way the session rule writes one: the visit in
 * rr_visit_v1 ({ id, n, last }, the part the tracker deployed before the rule also
 * reads and rewrites) and the session it belongs to in rr_visit_sid_v1 ({ sid, s, c }).
 * `sessionId`, when given, is stored as rr_session_id too.
 */
export function storeSessionRecord(record: SessionRecord, sessionId?: string): void {
  if (sessionId) window.localStorage.setItem(SESSION_ID_KEY, sessionId)
  window.localStorage.setItem(SESSION_STATE_KEY, JSON.stringify({ id: record.id, n: record.n, last: record.last }))
  if (record.sid) {
    window.localStorage.setItem(SESSION_BINDING_KEY, JSON.stringify({ sid: record.sid, s: record.s ?? '', c: record.c ?? '' }))
  }
}

/** The lifecycle record as both trackers read it back from storage, or null when there is no visit. */
export function readSessionRecord(): SessionRecord | null {
  const visit = JSON.parse(window.localStorage.getItem(SESSION_STATE_KEY) ?? 'null') as SessionRecord | null
  if (!visit) return null
  const binding = JSON.parse(window.localStorage.getItem(SESSION_BINDING_KEY) ?? 'null') as Partial<SessionRecord> | null
  return { id: visit.id, n: visit.n, last: visit.last, sid: binding?.sid, s: binding?.s, c: binding?.c }
}

export type TrackerCall = {
  url: string
  method: string
  /** Parsed JSON body, or null for a GET request. */
  body: Record<string, unknown> | null
}

export type TrackerPage = {
  /** Path and query, e.g. `/cma/1-main-st?utm_source=cma`. Same origin as the test page. */
  url: string
  referrer?: string
  title?: string
  /**
   * How the browser reached the page (the Navigation Timing entry's `type`):
   * 'navigate' (a link, a typed address, a redirect), 'reload', 'back_forward'.
   * Defaults to 'navigate'. null: a browser that cannot say.
   */
  navigationType?: string | null
}

export const CONSENT_COOKIE_NAME = 'ryan_realty_cookie_consent'

export function clearBrowserState(): void {
  window.localStorage.clear()
  window.sessionStorage.clear()
  document.cookie = `${CONSENT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  window.history.replaceState({}, '', '/')
  setReferrer('')
  setNavigationType('navigate')
  Object.defineProperty(navigator, 'webdriver', { configurable: true, value: false })
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined })
}

export function setReferrer(value: string): void {
  Object.defineProperty(document, 'referrer', { configurable: true, get: () => value })
}

/**
 * The navigation type this document was loaded with, as
 * `performance.getEntriesByType('navigation')[0].type` reports it. jsdom reports
 * no navigation entry at all, so every tracker test states the one it means.
 * null removes the entry (a browser that cannot say).
 */
export function setNavigationType(type: string | null): void {
  const entries = type === null ? [] : [{ entryType: 'navigation', name: window.location.href, type }]
  Object.defineProperty(performance, 'getEntriesByType', {
    configurable: true,
    writable: true,
    value: (kind: string) => (kind === 'navigation' ? entries : []),
  })
}

export function setConsentCookie(raw: string | undefined): void {
  if (raw === undefined) {
    document.cookie = `${CONSENT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    return
  }
  document.cookie = `${CONSENT_COOKIE_NAME}=${raw}; path=/`
}

/** The banner's cookie value as the browser holds it, or undefined. */
export function readConsentCookieRaw(): string | undefined {
  const row = document.cookie.split('; ').find((r) => r.startsWith(`${CONSENT_COOKIE_NAME}=`))
  return row?.split('=')[1]
}

export function docTrackerHarness() {
  const calls: TrackerCall[] = []
  const listeners: Array<{
    type: string
    listener: EventListenerOrEventListenerObject
    options?: boolean | AddEventListenerOptions
  }> = []
  type Responder = (call: TrackerCall) => Record<string, unknown> | Promise<Record<string, unknown>>
  let responder: Responder = () => ({ ok: true })

  // Requests the tracker has made that the responder has not answered yet: flush()
  // waits for these, so a test that hands posts to the real route reads its rows
  // only after the route has finished (it loads modules on first use).
  let inflight = 0

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: TrackerCall = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
    }
    // Recorded synchronously, before anything is awaited: a tap is visible the moment it is made.
    calls.push(call)
    inflight++
    try {
      const json = await responder(call)
      return { ok: true, status: 200, json: async () => json } as unknown as Response
    } finally {
      inflight--
    }
  })

  const realAdd = document.addEventListener.bind(document)

  return {
    calls,
    /** Posts to /api/visitors/track, in order. */
    get posts(): TrackerCall[] {
      return calls.filter((c) => c.url === '/api/visitors/track')
    },
    /** GETs of the identify endpoint (the identify ping), in order. */
    get identifyPings(): TrackerCall[] {
      return calls.filter((c) => c.url.startsWith('/api/track/e/identify'))
    },
    respondWith(fn: Responder) {
      responder = fn
    },
    install() {
      vi.stubGlobal('fetch', fetchMock)
      vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
        listeners.push({ type, listener: listener as EventListenerOrEventListenerObject, options })
        realAdd(type, listener as EventListenerOrEventListenerObject, options)
      })
    },
    uninstall() {
      for (const l of listeners) document.removeEventListener(l.type, l.listener, l.options)
      listeners.length = 0
      calls.length = 0
      responder = () => ({ ok: true })
      fetchMock.mockClear()
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    },
    /**
     * Load the document tracker on a page (a fresh script execution, like a page
     * load). A new document replaces the old one, so the listeners an earlier load
     * installed go with it: a tap after this load reaches this load's script only.
     */
    load(page: TrackerPage) {
      for (const l of listeners) document.removeEventListener(l.type, l.listener, l.options)
      listeners.length = 0
      window.history.replaceState({}, '', page.url)
      setReferrer(page.referrer ?? '')
      setNavigationType(page.navigationType === undefined ? 'navigate' : page.navigationType)
      document.title = page.title ?? 'Market report'
      // The script is an IIFE that reads location, document, localStorage, fetch,
      // history and navigator from the global scope, exactly as a <script> tag does.
      new Function(DOC_TRACKER_SRC)()
    },
    /** Let the tracker's fetch chain (post, response, retry, identify ping) settle. */
    async flush() {
      let quiet = 0
      for (let i = 0; i < 2000 && quiet < 4; i++) {
        await new Promise((r) => setTimeout(r, 0))
        quiet = inflight === 0 ? quiet + 1 : 0
      }
    },
    /** Tap an anchor inside the document. */
    tap(href: string, text = 'A comp') {
      const a = document.createElement('a')
      a.setAttribute('href', href)
      a.textContent = text
      // jsdom does not navigate; refuse the default so it does not log that.
      a.addEventListener('click', (e) => e.preventDefault())
      document.body.appendChild(a)
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      a.remove()
    },
  }
}
