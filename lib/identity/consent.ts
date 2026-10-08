import {
  isKnownRestrictedConsentCountry,
  isKnownUnrestrictedConsentCountry,
} from '@/lib/analytics/consent-regions'

/**
 * The visitor's tracking choice: ONE reading of the banner's cookie, used by the
 * browser trackers and by the server's identity paths alike.
 *
 * The rule (docs/TRACKING_POLICY.md, "What we collect at each consent tier"):
 *   - no banner answer, unrestricted region, no GPC -> analytics (Matt 2026-10-08)
 *   - no banner answer, restricted region (EEA/UK/CH) or unknown country -> essential
 *   - analytics and marketing  -> all
 *   - analytics only           -> analytics
 *   - marketing only           -> essential  (marketing alone widens nothing we store)
 *   - both off, or an unreadable cookie -> declined: NOTHING recorded, nobody identified
 *   - Global Privacy Control   -> NOTHING recorded, and it is never read as a grant
 *   - an ad or campaign click (utm_*, fbclid, gclid, msclkid, ttclid) is not
 *     consent: it does not grant ad_*, write the consent cookie, or load the
 *     Meta Pixel (Matt 2026-10-08)
 *
 * WHO USES IT. components/VisitTracker.tsx (currentConsentLevel, and through it
 * every tracker that posts to /api/visitors/track, V3SectionTracker included),
 * components/CookieConsentBanner.tsx (getStoredConsent), components/PersonIdentityBridge.tsx,
 * components/search/search-events.client.ts, and the server-side identify and
 * event paths below (app/actions/track-user-event.ts included).
 *
 * public/rr-doc-tracker.js is a plain script served as a static file, so it cannot
 * import this module. It MIRRORS parseConsentCookie / trackingLevelFromConsent /
 * arrivalConsent / gpcFromNavigator line for line, and
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

/** Optional region / GPC when mapping a missing banner answer to a tier. */
export type ConsentContext = {
  /** ISO 3166-1 alpha-2 (server: x-vercel-ip-country). */
  country?: string | null
  /** Client: from the `rr_cr` cookie. Overrides country when set. */
  restrictedRegion?: boolean
  gpc?: boolean
}

function regionIsRestricted(context?: ConsentContext): boolean {
  if (!context) return true
  if (context.gpc) return true
  if (context.restrictedRegion === true) return true
  if (context.restrictedRegion === false) return false
  return !isKnownUnrestrictedConsentCountry(context.country)
}

/**
 * The tier a stored answer records at. No answer without region context is
 * `essential` (fail closed, the previous default). No answer in a known
 * unrestricted region with no GPC is `analytics` (Matt 2026-10-08). Geo, user
 * agent and listing meta stay gated on the analytics tier.
 */
export function trackingLevelFromConsent(
  stored: ConsentState | null,
  context?: ConsentContext,
): TrackingConsentLevel {
  if (stored === null) {
    if (regionIsRestricted(context)) return 'essential'
    return 'analytics'
  }
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
 * consent. /api/visitors/track drops every event that carries it (and records a
 * durable suppression for a contact it already knows); the client-document
 * tracker records nothing at all. GPC wins over every default, including the
 * US analytics grant. Tags and recording also stay off when GPC is on even if
 * a stored banner answer says marketing:true.
 */
export function gpcFromNavigator(nav: unknown): boolean {
  return !!nav && typeof nav === 'object' && (nav as { globalPrivacyControl?: unknown }).globalPrivacyControl === true
}

/**
 * The tier ONE page load records at. An ad or campaign click is not consent:
 * `grant` is always false (Matt 2026-10-08). `search` stays on the signature so
 * callers and the document-tracker pin keep passing the arrival query; it is
 * not read. GPC (`gpc`, required so no caller can leave it out) keeps a
 * no-answer visitor at essential even in the US. An explicit stored answer is
 * still returned as its tier; recording and tags separately honor GPC.
 */
export function arrivalConsent(args: {
  cookieValue: string | null | undefined
  search: string | null | undefined
  gpc: boolean
  country?: string | null
  restrictedRegion?: boolean
}): { level: TrackingConsentLevel; grant: boolean } {
  void args.search
  const stored = parseConsentCookie(args.cookieValue)
  const region = { country: args.country, restrictedRegion: args.restrictedRegion, gpc: args.gpc }
  return {
    level: trackingLevelFromConsent(stored, region),
    grant: false,
  }
}

/**
 * May this request share with Meta or Google Ads? Only an explicit marketing
 * grant, and never under GPC. Fail closed when there is no banner answer.
 */
export function marketingSharingAllowed(args: {
  consentCookie?: string | null
  secGpc?: string | null
  gpc?: boolean
}): boolean {
  if (gpcHeaderOptsOut(args.secGpc) || args.gpc === true) return false
  return parseConsentCookie(args.consentCookie)?.marketing === true
}

const CONSENT_RANK: Record<TrackingConsentLevel, number> = {
  declined: 0,
  essential: 1,
  analytics: 2,
  all: 3,
}

export function minTrackingConsent(a: TrackingConsentLevel, b: TrackingConsentLevel): TrackingConsentLevel {
  return CONSENT_RANK[a] <= CONSENT_RANK[b] ? a : b
}

function postedConsentLevel(posted: string | null | undefined): TrackingConsentLevel {
  if (posted === 'all' || posted === 'analytics' || posted === 'essential' || posted === 'declined') return posted
  return 'declined'
}

/**
 * Server enforcement: a client cannot widen past the stored banner answer or
 * the region default. Unknown country (tests, missing header) does not rewrite
 * a posted analytics/all tier. A known unrestricted country with no answer is
 * analytics even if the client still posts `essential`. A known restricted
 * country with no answer is essential even if the client posts analytics/all.
 */
export function effectiveTrackingConsent(args: {
  posted: string | null | undefined
  cookieValue?: string | null
  country?: string | null
}): TrackingConsentLevel {
  const posted = postedConsentLevel(args.posted)
  const stored = parseConsentCookie(args.cookieValue)
  if (stored !== null) {
    return minTrackingConsent(posted, trackingLevelFromConsent(stored))
  }
  if (posted === 'declined') return 'declined'
  if (isKnownUnrestrictedConsentCountry(args.country)) return 'analytics'
  if (isKnownRestrictedConsentCountry(args.country)) return 'essential'
  return posted
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
