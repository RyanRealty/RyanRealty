/**
 * THE session rule: one definition of "a visit", followed by every browser tracker.
 *
 * A session ends, and the next tracked event starts a new one, when
 *   (a) more than 30 minutes have passed since the last tracked activity, or
 *   (b) the visitor ARRIVES on a link carrying a campaign (utm_source or
 *       utm_campaign) different from the one the current session began under, or
 *   (c) the browser holds a session id this rule did not start: one with no
 *       lifecycle record naming it (an id from before the rule, which could be
 *       months old, or one a search event minted before any tracked event).
 *
 * That is Google Analytics' own rule. "[UA] How a web session is defined in
 * Universal Analytics" (support.google.com/analytics/answer/2731565) ends a
 * session after 30 minutes of inactivity and whenever a visitor arrives from a
 * different campaign; GA4 keeps the 30-minute default ("About Analytics
 * sessions", support.google.com/analytics/answer/9191807). We take those two
 * conditions and not Universal Analytics' midnight cut, which would split an
 * evening's browsing in two for no reason of ours.
 *
 * AN ARRIVAL is the first tracked event of a page load that the browser navigated
 * to (navigation type 'navigate': not a reload, not the back or forward button)
 * from outside this site (no referrer, or another site's). Only an arrival's
 * campaign is compared (isExternalArrival). Every other event carries its page's
 * address too, and that address keeps its utm tags for as long as the page is
 * open: a CMA sent by text is linked with utm_source=crm and no campaign, and every
 * comp in it with utm_source=cma&utm_campaign=<slug>, so while every event compared
 * its address one reading of the report (a view, four comp taps, each comp opened
 * and come back from) was nine sessions (review of 2026-09-30).
 *
 * WHY IT EXISTS (Matt 2026-09-29, the four tracked-email breaks). `rr_session_id`
 * lived in localStorage forever, and visitor_sessions keeps the first-touch
 * fields (campaign, referrer, landing page, user agent) of the FIRST event a
 * session id ever sent and never updates them. A browser therefore carried the
 * campaign of its first-ever visit for life: an email clicked months later landed
 * in that old session and its `utm_*` was lost. Sessions now end, so the next
 * tagged arrival is born with its own campaign.
 *
 * Identity still stitches across the break. The track route identifies a NEW
 * session by the signed `_pid` token on the link, else by the durable `rr_vid`
 * carried in visitor_identity_map (`rr_vid_carryover`), else by the signed
 * `rr_pid` cookie; a person who was known a minute ago is known in the new
 * session too (app/api/visitors/track/new-session-identity.test.ts).
 *
 * WHO FOLLOWS IT. components/VisitTracker.tsx (every page view and every
 * interaction that posts through fireFirstPartyEvent, V3SectionTracker included)
 * and lib/tracking.ts (the session id forms read) call this module.
 * public/rr-doc-tracker.js, the tracker injected into /cma and /bpo documents, is
 * a plain script that cannot import it, so it MIRRORS isExternalArrival,
 * decideSession, advanceSession and captureSource line for line;
 * app/api/visitors/track/doc-tracker.pin.test.ts runs that script and this module
 * through the same page loads and timelines and fails when they disagree.
 *
 * STORAGE (shared by every tab and by the doc tracker). The lifecycle record is ONE
 * record in two keys, read and written as one:
 *   rr_session_id    localStorage   the session id, a uuid v4 (unchanged key)
 *   rr_visit_v1      localStorage   { id, n, last }: the visit. `id` is the Unix
 *                                   second it began and `n` the running visit number
 *                                   (the GA4 mirror's session_id / session_number,
 *                                   TRACK-1); `last` is the ms of the last tracked
 *                                   activity. The tracker deployed before this rule
 *                                   reads and rewrites this key too, in this shape.
 *   rr_visit_sid_v1  localStorage   { sid, s, c }: the session the visit belongs to
 *                                   (`sid`: an id no record names is never kept) and
 *                                   the utm_source / utm_campaign on the address it
 *                                   began at (`s` / `c`, '' = none), the same values
 *                                   its first-touch capture records. A key of its own
 *                                   because the deployed tracker rewrites rr_visit_v1
 *                                   as { id, n, last } on every event of a tab loaded
 *                                   before the deploy (a search tab that changes its
 *                                   filters with pushState never reloads): kept in
 *                                   rr_visit_v1, the session id was erased by each such
 *                                   event and the next event here started a new
 *                                   session, five in nine minutes of one visit (review
 *                                   of 2026-09-30). A browser from before the rule has
 *                                   no such key, so its id is still not kept.
 *   rr_source_v1     sessionStorage the tab's first-touch capture (captureSource);
 *                                   cleared whenever a session ends so the new one
 *                                   captures ITS arrival, not the old one's.
 * A visit and a session are the same thing here: a new session id always starts a
 * new GA4 visit, so the mirror's `campaign_details` follows the campaign change.
 *
 * THE PAGE'S ARRIVAL is recorded when this module is first evaluated, which is at
 * hydration (lib/tracking.ts imports it, as do the identity bridge and the cookie
 * banner): the address, the referrer and the navigation type the page loaded with.
 * The first tracked event of the page load is judged on that record, not on the
 * address current when it fires. VisitTracker loads lazily, so a visitor who taps a
 * link before it mounts sends its first event from the page they navigated to, and
 * until 2026-09-30 that address was compared and captured instead of the one they
 * arrived on.
 *
 * Every function is safe to call with storage blocked or unwritable (private
 * windows, some in-app browsers, a full quota): state then lives in memory for the
 * life of the page. The id and its record are read as ONE pair, and the pair this
 * page wrote wins when it is newer than storage's (a write that did not land), so
 * a session that ended here is never answered with the id storage still holds.
 * Call them from effects and event handlers only, never in a render body.
 */
import { VISIT_IDLE_MS, type VisitContext } from '@/lib/analytics/ga4-visit'

export const SESSION_ID_KEY = 'rr_session_id'
export const SESSION_STATE_KEY = 'rr_visit_v1'
/** The session the visit in SESSION_STATE_KEY belongs to (see the header: why a key of its own). */
export const SESSION_BINDING_KEY = 'rr_visit_sid_v1'
export const SOURCE_CACHE_KEY = 'rr_source_v1'

/** GA4's own default session timeout (see the header). One constant, shared with the GA4 mirror. */
export const SESSION_IDLE_MS = VISIT_IDLE_MS

export const SESSION_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** The pair a campaign is compared by. '' means the URL carried none of that part. */
export type CampaignKey = { source: string; campaign: string }

export type SessionRecord = {
  id: number
  n: number
  last: number
  sid?: string
  s?: string
  c?: string
}

export type SessionDecision = {
  /** Mint a new session id; this event starts a new GA4 visit. */
  newSession: boolean
  /**
   * Why. `first`: no session id yet. `unrecorded`: a session id no lifecycle
   * record names (one from before this rule, which may be months old, or one a
   * search event minted before any tracked event), so it is not kept. `idle`: past
   * the timeout. `campaign`: an arrival on a different campaign. null: the session
   * simply continues.
   */
  reason: 'first' | 'unrecorded' | 'idle' | 'campaign' | null
}

const CAMPAIGN_VALUE_MAX = 100

function normalizeCampaignValue(v: string | null): string {
  return (v ?? '').trim().toLowerCase().slice(0, CAMPAIGN_VALUE_MAX)
}

/**
 * The campaign a URL's query string announces, or null when it carries neither
 * utm_source nor utm_campaign (an ordinary internal link announces nothing, so
 * it can never break a session). Compared case-insensitively and trimmed: a
 * casing difference is the same campaign.
 */
export function campaignKeyFromSearch(search: string | null | undefined): CampaignKey | null {
  const qs = new URLSearchParams(search || '')
  const source = normalizeCampaignValue(qs.get('utm_source'))
  const campaign = normalizeCampaignValue(qs.get('utm_campaign'))
  return source || campaign ? { source, campaign } : null
}

function siteHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

/** Is `referrer` a page on this site (the same host, with or without www)? An unreadable referrer is not. */
export function referrerIsThisSite(referrer: string | null | undefined, hostname: string): boolean {
  if (!referrer) return false
  try {
    return siteHost(new URL(referrer).hostname) === siteHost(hostname)
  } catch {
    return false
  }
}

/**
 * Is this event an ARRIVAL, the only kind whose campaign can end a session? It
 * is when all three hold:
 *   - it is the first tracked event of this page load (a tap, a scroll or a
 *     section view later on the same page carries the same address, utm tags and
 *     all, and is not a new arrival);
 *   - the browser navigated to the page ('navigate': a link, a typed address, a
 *     redirect), rather than reloading it or going back or forward to it; a
 *     browser that cannot say (null) is not counted as navigating;
 *   - it came from outside this site: no referrer (a mail or messaging app, a
 *     bookmark) or another site's (webmail, a social feed). A link on our own
 *     pages, a CMA's comp links included, is not an arrival.
 */
export function isExternalArrival(args: {
  firstEventOfPageLoad: boolean
  navigationType: string | null
  referrer: string | null | undefined
  hostname: string
}): boolean {
  return args.firstEventOfPageLoad && args.navigationType === 'navigate' && !referrerIsThisSite(args.referrer, args.hostname)
}

/**
 * How the browser reached this document, from the Navigation Timing entry:
 * 'navigate', 'reload', 'back_forward' or 'prerender'; the older
 * performance.navigation numbers where that is all there is; null when the browser
 * cannot say.
 */
export function pageNavigationType(): string | null {
  if (typeof performance === 'undefined') return null
  try {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (entry && typeof entry.type === 'string') return entry.type
  } catch {
    /* no Navigation Timing entries: try the older interface */
  }
  try {
    const legacy = (performance as Performance & { navigation?: { type?: number } }).navigation?.type
    if (legacy === 0) return 'navigate'
    if (legacy === 1) return 'reload'
    if (legacy === 2) return 'back_forward'
  } catch {
    /* none */
  }
  return null
}

/**
 * The rule itself. Pure. `sessionId` is the stored session id (null when there is
 * none), `record` the stored lifecycle record, `arrival` the campaign of the URL
 * this event fires on when the event is an arrival (isExternalArrival), else null.
 */
export function decideSession(args: {
  sessionId: string | null
  record: SessionRecord | null
  now: number
  arrival: CampaignKey | null
}): SessionDecision {
  if (!args.sessionId) return { newSession: true, reason: 'first' }
  if (!args.record || args.record.sid !== args.sessionId) return { newSession: true, reason: 'unrecorded' }
  if (args.now - args.record.last > SESSION_IDLE_MS) return { newSession: true, reason: 'idle' }
  const a = args.arrival
  if (a && (a.source !== (args.record.s ?? '') || a.campaign !== (args.record.c ?? ''))) {
    return { newSession: true, reason: 'campaign' }
  }
  return { newSession: false, reason: null }
}

// ── storage ─────────────────────────────────────────────────────────────────

/** How this page loaded: recorded once, when the module is first evaluated (see the header). */
export type PageArrival = {
  /** The query string the page loaded with. */
  search: string
  /** The address the page loaded at. */
  href: string
  /** document.referrer, which stays the document's for its whole life. */
  referrer: string
  /** pageNavigationType() at load. */
  navigationType: string | null
}

/**
 * This page's own copy of the session (the fallback when storage is blocked or
 * will not keep a write), whether a tracked event of this page load has been
 * accounted yet (only the first can be an arrival), the page's arrival, and the
 * session its tracker's posts have landed in. All of it belongs to the page: the
 * module is loaded once per document.
 */
const memory: {
  sid: string | null
  record: SessionRecord | null
  eventAccounted: boolean
  arrival: PageArrival | null
  posted: string | null
  postWaiters: Array<(sessionId: string) => void>
  gpcNoticed: boolean
} = {
  sid: null,
  record: null,
  eventAccounted: false,
  arrival: null,
  posted: null,
  postWaiters: [],
  gpcNoticed: false,
}

/**
 * Forget the page's own state, as a new page load does (tests; the module is
 * otherwise loaded once per document). The arrival is recorded again from the
 * address current at the next read, which is when a test has set up its page.
 */
export function resetSessionMemory(): void {
  memory.sid = null
  memory.record = null
  memory.eventAccounted = false
  memory.arrival = null
  memory.posted = null
  memory.postWaiters = []
  memory.gpcNoticed = false
}

function readPageArrival(): PageArrival {
  return {
    search: window.location.search,
    href: window.location.href,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    navigationType: pageNavigationType(),
  }
}

/** How this page loaded (see the header). Recorded at module evaluation; a page that has none yet records it now. */
export function pageArrival(): PageArrival | null {
  if (typeof window === 'undefined') return null
  if (!memory.arrival) memory.arrival = readPageArrival()
  return memory.arrival
}

// Record the arrival NOW, while the address is still the one the page loaded at:
// this runs when the module is first evaluated, at hydration, before the lazily
// loaded tracker can post anything.
if (typeof window !== 'undefined') memory.arrival = readPageArrival() // hydration-safe: module evaluation in the browser, never a render body

function mintUuidV4(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // variant 10
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`
}

/** The visit part of the record (rr_visit_v1), or null when it is not one. */
function parseVisit(raw: string | null): Pick<SessionRecord, 'id' | 'n' | 'last'> | null {
  if (!raw) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const ok =
    typeof o.id === 'number' &&
    Number.isFinite(o.id) &&
    typeof o.n === 'number' &&
    Number.isFinite(o.n) &&
    typeof o.last === 'number' &&
    Number.isFinite(o.last)
  return ok ? { id: o.id as number, n: o.n as number, last: o.last as number } : null
}

/** The session part of the record (rr_visit_sid_v1): nothing when it is absent or not one, so no session id is kept. */
function parseBinding(raw: string | null): Pick<SessionRecord, 'sid' | 's' | 'c'> {
  if (!raw) return {}
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!v || typeof v !== 'object') return {}
  const o = v as Record<string, unknown>
  if (typeof o.sid !== 'string' || !SESSION_UUID_V4.test(o.sid)) return {}
  return { sid: o.sid, s: typeof o.s === 'string' ? o.s : '', c: typeof o.c === 'string' ? o.c : '' }
}

/**
 * The session id and its lifecycle record, read as ONE pair.
 *
 * Storage is the pair every tab shares, so it wins, unless this page has seen
 * later activity than storage holds: a write that did not land (blocked storage;
 * a full quota or some private windows, where getItem answers while setItem
 * throws). Then this page's own id AND record are used together. Read apart, a
 * storage that still held an old id but refused writes answered that old id for
 * every event after a session ended here (and with the record naming the new id,
 * each of those events would have started yet another session).
 *
 * The record is the visit (rr_visit_v1) with the session it belongs to
 * (rr_visit_sid_v1) on it. A visit with no session on it names none: that is a
 * browser from before this rule, and its id is not kept.
 */
function readState(): { sid: string | null; record: SessionRecord | null } {
  let storedSid: string | null = null
  let rawVisit: string | null = null
  let rawBinding: string | null = null
  try {
    const v = window.localStorage.getItem(SESSION_ID_KEY)
    storedSid = v && SESSION_UUID_V4.test(v) ? v : null
    rawVisit = window.localStorage.getItem(SESSION_STATE_KEY)
    rawBinding = window.localStorage.getItem(SESSION_BINDING_KEY)
  } catch {
    /* storage blocked: this page's memory is all there is */
  }
  const visit = parseVisit(rawVisit)
  const storedRecord: SessionRecord | null = visit ? { ...visit, ...parseBinding(rawBinding) } : null
  const mem = memory.record
  if (mem && (!storedRecord || mem.last > storedRecord.last)) return { sid: memory.sid, record: mem }
  return { sid: storedSid ?? memory.sid, record: storedRecord ?? mem }
}

function writeSid(id: string): void {
  memory.sid = id
  try {
    window.localStorage.setItem(SESSION_ID_KEY, id)
  } catch {
    /* memory keeps it */
  }
  try {
    window.sessionStorage.setItem(SESSION_ID_KEY, id)
  } catch {
    /* sessionStorage may be blocked; localStorage still stitches */
  }
}

/**
 * Store the record: the session first, then the visit, and not the visit when the
 * session did not land. A visit stored without its session would be read, by every
 * tab, as a visit naming no session, and each event would start another; stored
 * neither, the page's own newer pair wins (readState).
 */
function writeRecord(record: SessionRecord): void {
  memory.record = record
  try {
    window.localStorage.setItem(SESSION_BINDING_KEY, JSON.stringify({ sid: record.sid, s: record.s ?? '', c: record.c ?? '' }))
    window.localStorage.setItem(SESSION_STATE_KEY, JSON.stringify({ id: record.id, n: record.n, last: record.last }))
  } catch {
    /* memory keeps it */
  }
}

function clearSourceCache(): void {
  try {
    window.sessionStorage.removeItem(SOURCE_CACHE_KEY)
  } catch {
    /* fall through: the next capture just recomputes */
  }
}

// ── the session ─────────────────────────────────────────────────────────────

/** The stored session id, or null when there is none. Never mints, never touches the clock. */
export function readSessionId(): string | null {
  if (typeof window === 'undefined') return null
  return readState().sid
}

/**
 * The stored session id, minted when absent. For callers that label something
 * with the session id but do not themselves record a tracked event (search
 * events written to user_events, for one): it neither advances the clock nor
 * applies the rule. A tracked event goes through advanceSession, and an id minted
 * here has no lifecycle record, so the first tracked event starts a session of
 * its own rather than keeping it (decideSession, `unrecorded`).
 */
export function currentSessionId(): string | null {
  if (typeof window === 'undefined') return null
  const existing = readState().sid
  if (existing) return existing
  const id = mintUuidV4()
  writeSid(id)
  return id
}

export type AdvancedSession = {
  sessionId: string
  /** The GA4 visit this event belongs to (`start` is true on the event that begins it). */
  visit: VisitContext
  reason: SessionDecision['reason']
  /**
   * The address this event is judged on, and the one its first touch is captured
   * from (captureSource): the page's arrival for the first event of a page load,
   * the current address after that.
   */
  pageHref: string
}

/**
 * Account for ONE tracked event: apply the rule, mint a new session id when it
 * says so, stamp the activity clock, and return the session and visit this event
 * belongs to. Call it exactly once per event you are about to post, and not at
 * all when you are going to post nothing (a declined visitor leaves no trace).
 *
 * The first call of a page load is the only one that can be an arrival
 * (isExternalArrival), and it is judged on how the page LOADED (pageArrival: its
 * address, referrer and navigation type), whatever address is current by the time
 * the tracker posts; only an arrival's campaign is compared with the session's.
 * A later call is judged on the current address. `search` overrides the query
 * string the event's campaign is read from (tests). A session that begins on this
 * event records that campaign, arrival or not, because it is the one its
 * first-touch capture sends.
 */
export function advanceSession(opts: { now?: number; search?: string } = {}): AdvancedSession | null {
  if (typeof window === 'undefined') return null
  const now = opts.now ?? Date.now() // hydration-safe: event/effect code only, never a render body
  const firstOfPageLoad = !memory.eventAccounted
  const loaded = pageArrival()!
  const pageHref = firstOfPageLoad ? loaded.href : window.location.href
  const campaign = campaignKeyFromSearch(opts.search ?? (firstOfPageLoad ? loaded.search : window.location.search))
  const arrival = isExternalArrival({
    firstEventOfPageLoad: firstOfPageLoad,
    navigationType: loaded.navigationType,
    referrer: loaded.referrer,
    hostname: window.location.hostname,
  })
  memory.eventAccounted = true
  const { sid: stored, record } = readState()
  const decision = decideSession({ sessionId: stored, record, now, arrival: arrival ? campaign : null })

  let sessionId = stored
  if (decision.newSession || !sessionId) {
    sessionId = mintUuidV4()
    writeSid(sessionId)
    // The new session captures ITS arrival (campaign, referrer, landing page),
    // not the one the tab cached for the session that just ended.
    clearSourceCache()
  }

  const next: SessionRecord = decision.newSession
    ? {
        id: Math.floor(now / 1000),
        n: (record?.n ?? 0) + 1,
        last: now,
        sid: sessionId,
        s: campaign?.source ?? '',
        c: campaign?.campaign ?? '',
      }
    : { ...record!, last: now, sid: sessionId }
  writeRecord(next)
  return {
    sessionId,
    visit: { id: next.id, number: next.n, start: decision.newSession },
    reason: decision.reason,
    pageHref,
  }
}

/**
 * Start a fresh session id because the server asked (`rotateSession`: this
 * browser's session belongs to a DIFFERENT contact, a shared laptop or a
 * forwarded link). Not a session-rule break: the visit and its campaign carry
 * over, only the id changes, so the person who clicked is recorded under their
 * own session. Returns the new id.
 */
export function forceNewSession(): string | null {
  if (typeof window === 'undefined') return null
  const id = mintUuidV4()
  try {
    window.localStorage.removeItem(SESSION_ID_KEY)
    window.sessionStorage.removeItem(SESSION_ID_KEY)
  } catch {
    /* writeSid below still stores the new id where it can */
  }
  writeSid(id)
  clearSourceCache()
  const { record } = readState()
  if (record) writeRecord({ ...record, sid: id })
  return id
}

// ── the session a post landed in ────────────────────────────────────────────

/**
 * VisitTracker calls this when one of its posts has settled, with the session the
 * post was recorded under (after a rotateSession re-send, the id it re-sent under).
 * The identity bridge waits for it (postedSession).
 */
export function notePostedSession(sessionId: string): void {
  memory.posted = sessionId
  const waiters = memory.postWaiters
  memory.postWaiters = []
  for (const w of waiters) w(sessionId)
}

/**
 * The session this page's tracker posts have landed in: at once when one has
 * settled, else when the first one does, else null after `timeoutMs` (a page the
 * tracker records nothing on). A click that brought the visitor here can END the
 * stored session (a new campaign, 30 minutes idle, an id from before the rule), so
 * the id in storage before the tracker posts can be the visit before this one; the
 * session to identify is the one the post created.
 */
export function postedSession(timeoutMs: number): Promise<string | null> {
  if (memory.posted) return Promise.resolve(memory.posted)
  return new Promise((resolve) => {
    const waiter = (sessionId: string) => {
      clearTimeout(timer)
      resolve(sessionId)
    }
    const timer = setTimeout(() => {
      memory.postWaiters = memory.postWaiters.filter((w) => w !== waiter)
      resolve(null)
    }, timeoutMs)
    memory.postWaiters.push(waiter)
  })
}

/**
 * Under Global Privacy Control the trackers write no identifier and post no event:
 * one notice per page load, `{ gpc: true }` (VisitTracker's fireFirstPartyEvent;
 * public/rr-doc-tracker.js runs once per page and sends its own). True the first time
 * it is asked on this page, false after.
 */
export function takeGpcNotice(): boolean {
  if (memory.gpcNoticed) return false
  memory.gpcNoticed = true
  return true
}

// ── first touch ─────────────────────────────────────────────────────────────

export type CapturedSource = {
  campaign?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string }
  referrer?: string
  landingPage?: string
  fbclid?: string
  gclid?: string
}

/**
 * UTM + fbclid + gclid + referrer capture once per tab session (sessionStorage),
 * and once more whenever a session ends (advanceSession clears the cache). Sent
 * with every event, so whichever event creates a session on the server carries
 * the first-touch attribution: visitor_sessions keeps the values from the first
 * event of a session id and never overwrites them.
 *
 * `pageHref` is the address to capture from: the event's (AdvancedSession.pageHref,
 * which is the page's arrival for the first event of a page load), else the current
 * one. The click ids are persisted with the UTMs because the param disappears after
 * the initial landing. A referrer host with no utm_source is mapped to a source
 * (facebook, google organic, ...), and an arrival with neither is `direct / none`.
 * public/rr-doc-tracker.js mirrors this function line for line.
 */
export function captureSource(pageHref?: string): CapturedSource {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.sessionStorage.getItem(SOURCE_CACHE_KEY)
    if (stored) return JSON.parse(stored) as CapturedSource
  } catch {
    /* recompute */
  }
  const href = pageHref ?? window.location.href
  let search = window.location.search
  try {
    search = new URL(href).search
  } catch {
    /* an address that does not parse: the current page's query */
  }
  const params = new URLSearchParams(search || '')
  const src: Record<string, string | undefined> = {
    utm_source: params.get('utm_source') ?? undefined,
    utm_medium: params.get('utm_medium') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
    utm_content: params.get('utm_content') ?? undefined,
    utm_term: params.get('utm_term') ?? undefined,
  }
  // Meta click-id: present when the visitor arrives from a Facebook/Instagram ad.
  const fbclid = params.get('fbclid') ?? undefined
  // Google click-id: same first-touch treatment for Google Ads clicks.
  const gclid = params.get('gclid') ?? undefined
  const referrer = (typeof document !== 'undefined' ? document.referrer : '') || undefined
  // Auto-infer source from the referrer host when there is no utm_source.
  if (!src.utm_source && referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase()
      if (/facebook|fb\.com/.test(host)) {
        src.utm_source = 'facebook'
        src.utm_medium ||= 'social'
      } else if (/instagram/.test(host)) {
        src.utm_source = 'instagram'
        src.utm_medium ||= 'social'
      } else if (/\bgoogle\./.test(host)) {
        src.utm_source = 'google'
        src.utm_medium ||= 'organic'
      } else if (/bing|duckduckgo/.test(host)) {
        src.utm_source = host.split('.')[0]
        src.utm_medium ||= 'organic'
      } else if (/youtube/.test(host)) {
        src.utm_source = 'youtube'
        src.utm_medium ||= 'social'
      } else if (/linkedin/.test(host)) {
        src.utm_source = 'linkedin'
        src.utm_medium ||= 'social'
      } else if (/tiktok/.test(host)) {
        src.utm_source = 'tiktok'
        src.utm_medium ||= 'social'
      } else if (/zillow|realtor|trulia/.test(host)) {
        src.utm_source = host.replace(/^www\./, '').split('.')[0]
        src.utm_medium ||= 'portal'
      } else if (host && host !== window.location.hostname) {
        src.utm_source = host
        src.utm_medium ||= 'referral'
      }
    } catch {
      /* unparseable referrer: no inference */
    }
  }
  if (!src.utm_source) {
    src.utm_source = 'direct'
    src.utm_medium ||= 'none'
  }
  const result: CapturedSource = {
    campaign: {
      source: src.utm_source,
      medium: src.utm_medium,
      campaign: src.utm_campaign,
      content: src.utm_content,
      term: src.utm_term,
    },
    fbclid,
    gclid,
    referrer,
    landingPage: href,
  }
  try {
    window.sessionStorage.setItem(SOURCE_CACHE_KEY, JSON.stringify(result))
  } catch {
    /* uncached: the next event recomputes */
  }
  return result
}
