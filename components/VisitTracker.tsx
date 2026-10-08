'use client'

import { useEffect, useRef } from 'react'
import { isPrivatePath } from '@/lib/analytics/private-paths'
import { usePathname } from 'next/navigation'
import { trackUserEvent } from '@/app/actions/track-user-event'
import { hasAnalyticsConsent, getStoredConsent, autoGrantConsentForAdTraffic } from './CookieConsentBanner'
import { lastThingFromHouse, lastThingFromSearch, writeLastThing } from '@/lib/site/arrival-intent'
import { listingMlsFromPath, visitorPageCategoryFromPath } from '@/lib/analytics/page-type'
import { resolveClientVisitBroker } from '@/lib/analytics/visit-broker'
import { gpcFromNavigator, trackingLevelFromConsent, type TrackingConsentLevel } from '@/lib/identity/consent'
import { consentRegionRestrictedFromCookieHeader } from '@/lib/analytics/consent-regions'
import type { VisitContext } from '@/lib/analytics/ga4-visit'
import {
  advanceSession,
  captureSource,
  currentSessionId,
  forceNewSession,
  notePostedSession,
  takeGpcNotice,
  type CapturedSource,
} from '@/lib/analytics/visitor-session'

/** Exported so other client trackers (search-events.client.ts) stitch the SAME
 *  rr_session_id the page_view pipeline uses — one visitor, one session key.
 *  Reads (or mints) the id; it is not a tracked event, so it never advances the
 *  session clock. The session RULE (30 minutes idle, an arrival on a new
 *  campaign, an id no lifecycle record names) lives in
 *  lib/analytics/visitor-session.ts and is applied by firstPartyEventContext; an
 *  id minted here before any tracked event is not kept by it. */
export function getOrCreateSessionId(): string | null {
  return currentSessionId() // hydration-safe: callers are event/effect code (search fires), never render
}

/**
 * Map the current pathname to a high-level page_category so the engagement
 * scoring trigger weighs the event correctly. Mirrors the WP snippet's
 * categorizePage() so both sources feed the same taxonomy.
 */
/**
 * Detect a listing-detail view and extract its MLS number from the path.
 * Handles BOTH the legacy `/listing/{key}` URL and the canonical SEO URL
 * `/homes-for-sale/{city}/{...area}/{street}-{mls}` that Google + every internal
 * link now use. The canonical city/subdivision SEARCH paths (`/homes-for-sale/bend`,
 * `/homes-for-sale/bend/sunriver`) are NOT listing details — a listing segment is
 * distinguished by a trailing 6+ digit MLS number that a place slug never has.
 * Without this, property views fired a generic page_view and the CRM never learned
 * which property a visitor looked at.
 */
function detectListing(pathname: string): { isListing: boolean; mls: string | null } {
  const mls = listingMlsFromPath(pathname)
  return { isListing: mls != null, mls }
}

function categorizePage(pathname: string): string {
  return visitorPageCategoryFromPath(pathname)
}

/**
 * The tier this visitor is recorded at, from the banner's cookie
 * (lib/identity/consent.ts holds the mapping: one rule for every tracker).
 * Exported so every tracker that posts to /api/visitors/track sends the SAME
 * value this one does: V3SectionTracker sent none and the server dropped all of
 * its events (found 2026-09-29).
 *
 * No banner answer in a restricted region (or with no region signal) ->
 * 'essential': the track endpoint stores a functional record — session_id, page
 * URL, REFERRER and CAMPAIGN PARAMS. Geo, user agent and listing meta are
 * stripped server-side. No banner answer in an unrestricted region with no GPC
 * is 'analytics' (Matt 2026-10-08). An explicit decline is still declined, and
 * the server honors GPC opt-outs before any write.
 *
 * Referrer was never stripped, despite what this comment claimed until
 * 2026-08-26. Verified against the data: 11,197 of the last 90 days' sessions
 * carry a referrer and only 357 carry a user agent. The claim mattered because
 * anyone "fixing" the code to match it would have destroyed the only source
 * attribution that works for 99.5% of visitors.
 *
 * Campaign params joined it on 2026-08-26 (Matt's call). They describe the link
 * that was clicked, not the person, so they are treated like the referrer. Before
 * that, 99.5% of arrivals — everyone who ignores the banner — landed with their
 * campaign tag already discarded: 357 of 79,220 sessions in 90 days carried one,
 * which made tagging links pointless. This is a privacy-policy position, not a
 * code detail, and it is disclosed in app/privacy/page.tsx under Cookies.
 *
 * Treating "no choice" as declined made every visitor who ignored the banner
 * invisible (2 sessions/day sitewide, and email-click leads never created the
 * session their identity param was supposed to stitch — found in the 2026-07-10
 * E2E pass).
 */
export function currentConsentLevel(): TrackingConsentLevel {
  if (typeof window === 'undefined') return 'declined'
  return trackingLevelFromConsent(getStoredConsent(), {
    restrictedRegion: consentRegionRestrictedFromCookieHeader(document.cookie),
    gpc: gpcFromNavigator(typeof navigator !== 'undefined' ? navigator : undefined),
  })
}

/**
 * The signed person token a link we sent carried (?_pid=). Read off the URL, or
 * from the stash PersonIdentityBridge leaves when it cleans the address bar
 * first. Forwarded once; the server verifies it (an unsigned value identifies
 * nobody) and identifies the visit (P7 identity loop).
 */
const PID_STASH_KEY = 'rr_pid_token'
function takeArrivalToken(): string | undefined {
  try {
    const fromUrl = new URLSearchParams(window.location.search || '').get('_pid')
    const stashed = sessionStorage.getItem(PID_STASH_KEY)
    if (stashed) sessionStorage.removeItem(PID_STASH_KEY)
    const token = (fromUrl || stashed || '').trim()
    return token ? token.slice(0, 120) : undefined
  } catch {
    return undefined
  }
}

type TrackResponse = { rotateSession?: boolean; identity?: { identifiedNow?: boolean } }

/**
 * POST one event. Once it has settled, the session it was recorded under is noted
 * (notePostedSession): PersonIdentityBridge waits for it, because the click that
 * brought the visitor here may have ended the session in storage and this post is
 * what starts the new one. A rotateSession answer re-sends once under a fresh id, and
 * that re-send is the one noted. A post that fails is noted too: its session is still
 * this page's, and the bridge must not wait for a post that will never answer.
 */
function postTrack(payload: Record<string, unknown>, allowRotate: boolean) {
  const settled = () => {
    if (typeof payload.sessionId === 'string') notePostedSession(payload.sessionId)
  }
  try {
    fetch('/api/visitors/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
      .then((r) => (r.ok ? (r.json() as Promise<TrackResponse>) : null))
      .then((json) => {
        if (json?.rotateSession && allowRotate) {
          const fresh = forceNewSession() // hydration-safe: runs in the fetch callback, never in render
          if (fresh) {
            postTrack({ ...payload, sessionId: fresh }, false)
            return
          }
        }
        settled()
        if (json?.identity?.identifiedNow) {
          // The analytics bridge re-reads /api/identity/me (hashed ids only).
          window.dispatchEvent(new CustomEvent('person-identified'))
        }
      })
      .catch(settled)
  } catch {
    settled()
  }
}

/** Event types client surfaces may fire into the first-party visitor store.
 *  Must stay a subset of ALLOWED_EVENT_TYPES in app/api/visitors/track. */
export type FirstPartyEventType =
  | 'page_view'
  | 'listing_view'
  | 'search'
  | 'scroll_depth'
  | 'section_view'
  | 'cta_click'
  | 'save_listing'
  | 'intent_declared'
  | 'welcome_back'
  | 'email_opt'
  | 'sms_opt'
  | 'join_convert'

export type FirstPartyEventOptions = {
  /** MLS number when the event concerns one listing. */
  listingMls?: string | null
  /** Street when known. Used to remember the last house for welcome-back. */
  listingStreet?: string | null
  /** Scroll depth percent (scroll_depth events). */
  scrollDepthPct?: number
  /** Free-form event payload (e.g. { query, city } for search events). */
  metadata?: Record<string, unknown>
  /** Override the pathname-derived page category. */
  pageCategory?: string
}

/**
 * What every first-party event carries, whichever tracker sends it: the session
 * this event belongs to (the session rule has been applied: lib/analytics/
 * visitor-session.ts), the tier it may be recorded at, and the arrival
 * attribution the server needs if THIS event is the one that creates the session
 * (visitor_sessions keeps the first-touch fields of the first event a session id
 * ever sends and never updates them).
 *
 * Returns null when nothing may be posted: a visitor who declined leaves no
 * trace, not even a session id in storage, and neither does a browser sending
 * Global Privacy Control (fireFirstPartyEvent sends its notice instead). Call it
 * once per event, only when you are about to post. fireFirstPartyEvent is the
 * normal way; V3SectionTracker, which posts with sendBeacon so a scroll milestone
 * survives a navigation, calls this and posts the result itself. It used to build
 * its own body with no consent field, and the server dropped every section_view
 * and scroll_depth it sent.
 *
 * The automation signal rides here too, so every event carries it whichever
 * tracker sends it: the track route classifies a session as automation only from
 * the event that CREATES it, and a section view can be that event (review of
 * 2026-09-30: V3SectionTracker's body had no webdriver, so a scripted browser
 * whose first post was a section view was never flagged).
 */
export type FirstPartyEventContext = {
  sessionId: string
  sourceDomain: string
  campaign: CapturedSource['campaign']
  fbclid: string | undefined
  gclid: string | undefined
  referrer: string | undefined
  landingPage: string | undefined
  consent: TrackingConsentLevel
  /** TRACK-1: the per-visit GA4 session (`start` on the event that begins it). */
  visit: VisitContext
  /** navigator.webdriver: an automation signal (lib/analytics/automation.ts), not personal data. */
  webdriver: true | undefined
}

/** navigator.globalPrivacyControl, as the page sees it (lib/identity/consent.ts). */
function gpcOn(): boolean {
  return gpcFromNavigator(typeof navigator !== 'undefined' ? navigator : undefined)
}

export function firstPartyEventContext(): FirstPartyEventContext | null {
  if (typeof window === 'undefined') return null
  // Global Privacy Control: no identifier is written and nothing identifying is
  // sent (docs/TRACKING_POLICY.md, the GPC tier). Checked before the session is
  // advanced, which is what writes one.
  if (gpcOn()) return null
  const consent = currentConsentLevel()
  if (consent === 'declined') return null
  const advanced = advanceSession() // hydration-safe: effect/event code only (fireFirstPartyEvent, V3SectionTracker's effect), never render
  if (!advanced) return null
  // The first touch is captured from the address the event is judged on: the page's
  // arrival for the first event of a page load, whatever address is current by then.
  const { campaign, referrer, landingPage, fbclid, gclid } = captureSource(advanced.pageHref) // hydration-safe: same, effect/event code only
  return {
    sessionId: advanced.sessionId,
    sourceDomain: window.location.hostname.toLowerCase().replace(/^www\./, ''),
    campaign,
    fbclid,
    gclid,
    referrer,
    landingPage,
    consent,
    visit: advanced.visit,
    webdriver: typeof navigator !== 'undefined' && navigator.webdriver === true ? true : undefined,
  }
}

/**
 * Under Global Privacy Control no event is posted: once per page load, a notice
 * that carries the signal and nothing else (no session id, address or campaign).
 * The track route drops it before any write, and records a durable suppression for
 * a contact the browser was already identified as, from what the browser carries
 * on every request here (its signed rr_pid cookie, its rr_vid). The document
 * tracker sends the same notice (public/rr-doc-tracker.js).
 */
function sendGpcNotice(): void {
  if (!takeGpcNotice()) return
  try {
    fetch('/api/visitors/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gpc: true }),
      keepalive: true,
    }).catch(() => {})
  } catch {}
}

/**
 * Fire a same-origin POST to /api/visitors/track. The endpoint upserts the
 * session and inserts the event; the DB trigger updates engagement_score and
 * intent_tags. Server-side consent gate refuses 'declined' events even if
 * something here misbehaves.
 *
 * Exported so interaction surfaces (SearchFilters search fires,
 * LandingPageTracker scroll-depth dual-writes) share ONE consent gate, ONE
 * session key, and ONE payload shape with the page-view tracker below.
 */
export function fireFirstPartyEvent(eventType: FirstPartyEventType, opts: FirstPartyEventOptions = {}) {
  if (typeof window === 'undefined') return
  if (gpcOn()) {
    sendGpcNotice()
    return
  }
  const ctx = firstPartyEventContext()
  if (!ctx) return
  const pathname = window.location.pathname
  try {
    if (eventType === 'listing_view') {
      writeLastThing(lastThingFromHouse({ path: pathname, street: opts.listingStreet }))
    }
    if (eventType === 'search') {
      const query = typeof opts.metadata?.query === 'string' ? opts.metadata.query : null
      writeLastThing(
        lastThingFromSearch({
          href: `${pathname}${window.location.search || ''}`,
          query,
        }),
      )
    }
  } catch {
    /* memory must never break tracking */
  }
  const payload = {
    ...ctx,
    eventType,
    pageUrl: window.location.href,
    pageTitle: typeof document !== 'undefined' ? document.title.slice(0, 200) : undefined,
    pageCategory: opts.pageCategory ?? categorizePage(pathname),
    // Identifies WHICH property the event concerns — the server writes
    // visitor_events.listing_mls so the CRM behavior panels can join the home.
    listing: opts.listingMls ? { mlsNumber: opts.listingMls } : undefined,
    scrollDepthPct: typeof opts.scrollDepthPct === 'number' ? opts.scrollDepthPct : undefined,
    metadata: opts.metadata,
    // Canonical short slug when ?agent= / cookie is known — server MP page_view
    // uses the same assigned_broker / broker_slug names as generate_lead.
    // Only runs inside fireFirstPartyEvent (client POST / keepalive), never in JSX render.
    agent: resolveClientVisitBroker() ?? undefined, // hydration-safe
    // P7 identity loop: the signed token from the link that brought them here.
    identityToken: takeArrivalToken(),
  }
  // keepalive=true so the POST survives a fast navigation away. The response
  // may ask for a fresh session (the old one belongs to another contact) or
  // report that this visit was just identified.
  postTrack(payload, true)
}

/** Page/listing view fire keyed to a pathname (the tracker's own effect path). */
function fireVisitorEvent(pathname: string, eventType: 'page_view' | 'listing_view', listingMls?: string | null) {
  fireFirstPartyEvent(eventType, { listingMls, pageCategory: categorizePage(pathname) })
}


type Props = { userId?: string | null; userEmail?: string | null }

export default function VisitTracker({ userId }: Props) {
  const pathname = usePathname()
  // Separate dedupe for the visitor_events write, keyed by pathname ONLY. The
  // session wrapper renders with userId=null then re-renders once /api/auth/me
  // resolves the real id; the visitor_event payload is keyed by sessionId (not
  // userId), so it must fire once per pathname or the null->id re-render would
  // double-count every page/property view for a logged-in visitor.
  const firedVisitorPath = useRef<string | null>(null)
  // Separate ref for the per-user listing-view write: the visitor event fires on
  // the first (userId=null) render, but the user event must fire on the null→id
  // re-render once /api/auth/me resolves userId — its own ref keeps that at
  // once-per-pathname without being pre-empted by the visitor-event guard.
  const firedUserViewPath = useRef<string | null>(null)

  useEffect(() => {
    // Aggressive ad-traffic consent (Matt 2026-06-02): a visitor arriving from a
    // paid/marketing click with no prior consent choice gets analytics+marketing
    // auto-granted so THIS first page view + all on-site intent scoring fires.
    // Respects an explicit prior decision (essential/declined not overridden).
    autoGrantConsentForAdTraffic()
    try {
      const vid = document.cookie.match(/(?:^|; )rr_vid=([^;]+)/)?.[1]
      if (vid) sessionStorage.setItem('rr_vid', vid)
    } catch {
      /* first-party memory is best-effort */
    }
    // The public visitor pipeline never tracks internal admin pages, nor a page
    // whose address carries a secret (a signing link: private-paths.ts).
    if (pathname?.startsWith('/admin') || !pathname || isPrivatePath(pathname)) return
    // Unified visitor_sessions / visitor_events pipeline — feeds the
    // /admin/visitors/live + /admin/analytics/funnel-breakdown dashboards and
    // the hot-lead scoring cron. Fires at EVERY non-declined consent level:
    // with no banner answer the event goes out at 'essential' and the server
    // stores the minimal record. Fired once per pathname (firedVisitorPath) so
    // the userId resolution does not double-count the view.
    if (currentConsentLevel() !== 'declined' && firedVisitorPath.current !== pathname) {
      firedVisitorPath.current = pathname
      const det = detectListing(pathname)
      fireVisitorEvent(pathname, det.isListing ? 'listing_view' : 'page_view', det.mls)
    }
    // Per-USER viewing history: a signed-in visitor's listing views go to
    // user_events (the real source /account/history reads — before, that page read
    // user_activities, which nothing wrote, so it was always empty). Own ref +
    // userId gate so it fires on the null→id re-render, once per pathname. Honors a
    // cookie decline and Global Privacy Control like the visitor_events write above
    // (and trackUserEvent refuses both server-side).
    if (userId && currentConsentLevel() !== 'declined' && !gpcOn() && firedUserViewPath.current !== pathname) {
      const detU = detectListing(pathname)
      if (detU.isListing && detU.mls) {
        firedUserViewPath.current = pathname
        trackUserEvent({ eventType: 'listing_view', listingKey: detU.mls, pagePath: pathname }).catch(() => {})
      }
    }
    // The legacy visits-table write (trackVisit) was deleted 2026-07-21 — the
    // visitor_sessions / visitor_events pipeline above is the sole write path.
  }, [pathname, userId])


  useEffect(() => {
    const onConsent = () => {
      if (hasAnalyticsConsent() && pathname) {
        // Consent was declined at load and just got granted — fire the visitor
        // event the main effect had to skip. The firedVisitorPath ref keeps
        // this from double-counting what the main effect already recorded.
        if (firedVisitorPath.current !== pathname) {
          firedVisitorPath.current = pathname
          const det = detectListing(pathname)
          fireVisitorEvent(pathname, det.isListing ? 'listing_view' : 'page_view', det.mls)
        }
      }
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [pathname])

  return null
}
