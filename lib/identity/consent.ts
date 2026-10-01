/**
 * The visitor's tracking choice: ONE reading of the banner's cookie, used by the
 * browser trackers and by the server's identity paths alike.
 *
 * The rule (docs/TRACKING_POLICY.md, "What we collect at each consent tier"):
 *   - no banner answer         -> essential  (identification ALLOWED)
 *   - analytics and marketing  -> all
 *   - analytics only           -> analytics
 *   - marketing only           -> essential  (marketing alone widens nothing we store)
 *   - both off, or an unreadable cookie -> declined: NOTHING recorded, nobody identified
 *   - Global Privacy Control   -> NOTHING recorded, and it is never read as a grant
 *   - a visitor with no answer who arrives on an ad or campaign link (utm_*,
 *     fbclid, gclid, msclkid, ttclid) is treated as `all` for that page view
 *     (Matt 2026-06-02, the "aggressive ad-traffic consent" call), unless their
 *     browser sends Global Privacy Control
 *
 * WHO USES IT. components/VisitTracker.tsx (currentConsentLevel, and through it
 * every tracker that posts to /api/visitors/track, V3SectionTracker included),
 * components/CookieConsentBanner.tsx (getStoredConsent, and autoGrantConsentForAdTraffic
 * through arrivalConsent), components/PersonIdentityBridge.tsx,
 * components/search/search-events.client.ts, and the server-side identify and
 * event paths below (app/actions/track-user-event.ts included).
 *
 * public/rr-doc-tracker.js is a plain script served as a static file, so it cannot
 * import this module. It MIRRORS parseConsentCookie / trackingLevelFromConsent /
 * isAdTrafficSearch / arrivalConsent / gpcFromNavigator line for line, and
 * app/api/visitors/track/doc-tracker.pin.test.ts runs that script against these
 * functions over every cookie shape and campaign URL, with and without Global
 * Privacy Control, so the two cannot drift apart unnoticed. (They did: until 2026-09-29 the
 * client-document tracker hard-coded `essential` and posted for a visitor who had
 * declined.) Change a rule here and that test tells you the mirror to change.
 *
 * Pure: takes the raw cookie value, the query string, the Sec-GPC header and the
 * navigator's GPC flag; no Next imports, safe in a client bundle.
 */

export const CONSENT_COOKIE = 'ryan_realty_cookie_consent'

/** What the banner stores: one boolean per optional category. */
export type ConsentState = { analytics: boolean; marketing: boolean }

/** What /api/visitors/track is told, and enforces: no client can widen it. */
export type TrackingConsentLevel = 'all' | 'analytics' | 'essential' | 'declined'

/**
 * The stored banner answer, or null when the visitor has not answered yet. Reads
 * the cookie value the way the banner wrote it: URL-encoded JSON of
 * `{ analytics, marketing }`, or the legacy bare `all`. Anything else that is
 * present but unreadable is an explicit decline (both off), never "no answer".
 */
export function parseConsentCookie(raw: string | null | undefined): ConsentState | null {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as { analytics?: unknown; marketing?: unknown }
    return { analytics: Boolean(parsed.analytics), marketing: Boolean(parsed.marketing) }
  } catch {
    if (value === 'all') return { analytics: true, marketing: true }
    return { analytics: false, marketing: false }
  }
}

/**
 * The tier a stored answer records at. No answer is `essential`: the track
 * endpoint stores the functional record (session id, page URL, referrer, campaign
 * params); geo, user agent and listing meta stay gated on analytics consent.
 * Treating "no choice" as declined made every visitor who ignored the banner
 * invisible (2 sessions/day sitewide, found in the 2026-07-10 E2E pass).
 */
export function trackingLevelFromConsent(stored: ConsentState | null): TrackingConsentLevel {
  if (stored === null) return 'essential'
  if (stored.analytics && stored.marketing) return 'all'
  if (stored.analytics) return 'analytics'
  if (stored.marketing) return 'essential'
  return 'declined'
}

/**
 * Did this visitor arrive on an ad or campaign link? Click ids from the ad
 * platforms, or any utm_* parameter. `has`, not `get`: a bare `?fbclid=` counts.
 */
export function isAdTrafficSearch(search: string | null | undefined): boolean {
  const qs = new URLSearchParams(search || '')
  return (
    qs.has('fbclid') ||
    qs.has('gclid') ||
    qs.has('msclkid') ||
    qs.has('ttclid') ||
    [...qs.keys()].some((k) => k.toLowerCase().startsWith('utm_'))
  )
}

/**
 * Global Privacy Control as the page sees it: `navigator.globalPrivacyControl`
 * (the request carries the same signal as `Sec-GPC: 1`, gpcHeaderOptsOut). A
 * legally binding opt-out of sale and sharing (CA/CO/CT). It is never read as
 * consent, so the campaign-link grant does not apply to it; /api/visitors/track
 * drops every event that carries it (and records a durable suppression for a
 * contact it already knows); the client-document tracker records nothing at all.
 */
export function gpcFromNavigator(nav: unknown): boolean {
  return !!nav && typeof nav === 'object' && (nav as { globalPrivacyControl?: unknown }).globalPrivacyControl === true
}

/**
 * The tier ONE page load records at, folding in the ad-traffic grant: a visitor
 * with no banner answer who arrived on a campaign link is granted analytics and
 * marketing (`grant: true` tells the caller to write the cookie: the banner's
 * autoGrantConsentForAdTraffic decides through this, and public/rr-doc-tracker.js
 * mirrors it). An explicit answer, including a decline, is never overridden, and a
 * browser sending Global Privacy Control (`gpc`, required so no caller can leave it
 * out) is never granted anything: GPC itself is enforced where the events land (see
 * gpcFromNavigator), so the tier here stays the one the cookie names. `search` is
 * the query string the page ARRIVED with (lib/analytics/visitor-session.ts
 * pageArrival), not whatever address a client-side navigation has put there since.
 */
export function arrivalConsent(args: {
  cookieValue: string | null | undefined
  search: string | null | undefined
  gpc: boolean
}): { level: TrackingConsentLevel; grant: boolean } {
  const stored = parseConsentCookie(args.cookieValue)
  if (stored === null && !args.gpc && isAdTrafficSearch(args.search)) return { level: 'all', grant: true }
  return { level: trackingLevelFromConsent(stored), grant: false }
}

// ── The server's identify paths (server actions, tracking pings, redirects) ──

/** True when the stored banner answer is an explicit decline. */
export function consentCookieDeclines(raw: string | null | undefined): boolean {
  return trackingLevelFromConsent(parseConsentCookie(raw)) === 'declined'
}

/** Sec-GPC: 1 is a legally binding opt-out (CA/CO/CT); honored everywhere. */
export function gpcHeaderOptsOut(header: string | null | undefined): boolean {
  return typeof header === 'string' && header.trim() === '1'
}

/**
 * May the server record anything for this request? Not under Global Privacy
 * Control, and not for a visitor whose banner answer is a decline; every other
 * tier, no answer included, records (the tier table). Server actions that write an
 * event (trackUserEvent) ask this.
 */
export function recordingAllowed(args: { consentCookie?: string | null; secGpc?: string | null }): boolean {
  return !gpcHeaderOptsOut(args.secGpc) && !consentCookieDeclines(args.consentCookie)
}

/** May an identity path record anything for this request? The same test (recordingAllowed). */
export function identificationAllowed(args: { consentCookie?: string | null; secGpc?: string | null }): boolean {
  return recordingAllowed(args)
}
