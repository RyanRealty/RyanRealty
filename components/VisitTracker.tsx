'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackVisit } from '@/app/actions/track-visit'
import { trackReturnVisitAction } from '@/app/actions/track-return-visit'
import { hasAnalyticsConsent, getStoredConsent, getOrCreateVisitId, autoGrantConsentForAdTraffic } from './CookieConsentBanner'

const FUB_LAST_VISIT_KEY = 'fub_last_visit'
const RETURN_VISIT_MS = 24 * 60 * 60 * 1000

// localStorage key for the source-agnostic uuid that lets us stitch a visitor
// across Ryan Realty surfaces (Vercel + WP). Matches the WP snippet config.
const RR_SESSION_ID_KEY = 'rr_session_id'

function uuidv4(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
  const h: string[] = []
  for (let j = 0; j < 16; j++) {
    const s = bytes[j].toString(16)
    h.push(s.length === 1 ? '0' + s : s)
  }
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
}

function getOrCreateSessionId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const existing = localStorage.getItem(RR_SESSION_ID_KEY)
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) return existing
    const fresh = uuidv4()
    localStorage.setItem(RR_SESSION_ID_KEY, fresh)
    return fresh
  } catch {
    return uuidv4()
  }
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
  const p = (pathname || '/').toLowerCase().replace(/\/+$/, '')
  const segs = p.split('/').filter(Boolean)
  // Legacy /listing/{key} (excluding the by-address / by-key resolver prefixes).
  if (segs[0] === 'listing' && segs[1] && segs[1] !== 'by-address' && segs[1] !== 'by-key') {
    return { isListing: true, mls: decodeURIComponent(segs[1]) }
  }
  // Canonical /homes-for-sale/{city}/.../{street}-{mls} — needs city + a listing
  // segment (>= 3 parts) whose final token ends in a 6+ digit MLS number.
  if (segs[0] === 'homes-for-sale' && segs.length >= 3) {
    const m = segs[segs.length - 1].match(/(\d{6,})$/)
    if (m) return { isListing: true, mls: m[1] }
  }
  return { isListing: false, mls: null }
}

function categorizePage(pathname: string): string {
  const p = (pathname || '/').toLowerCase()
  if (detectListing(p).isListing) return 'listing_detail'
  if (/^\/listing\/[^/]+/.test(p)) return 'listing_detail'
  if (/^\/(search|listings|properties)/.test(p)) return 'search'
  if (/^\/lp\/seller-home-value|^\/home-valuation|^\/sell(\/|$)/.test(p)) return 'seller_intent'
  if (/^\/lp\/buyer-listing-alerts|^\/buyers(\/|$)|^\/explore/.test(p)) return 'buyer_intent'
  if (/^\/lp\/expired-listing/.test(p)) return 'seller_intent'
  if (/mortgage|affordability/.test(p)) return 'financial_tools'
  if (/^\/community\/|^\/area-guides?\/|^\/neighborhood\//.test(p)) return 'area_guide'
  if (/^\/blog/.test(p)) return 'blog'
  if (/^\/about|^\/contact|^\/team/.test(p)) return 'about'
  if (p === '/' || p === '') return 'home'
  return 'other'
}

function consentLevel(): 'all' | 'analytics' | 'essential' | 'declined' {
  if (typeof window === 'undefined') return 'declined'
  const stored = getStoredConsent()
  // No banner answer yet -> 'essential': the track endpoint stores ONLY the
  // minimal functional record (session_id + page URL; UTMs, geo, listing meta,
  // referrer all stripped server-side). Treating "no choice" as declined made
  // every visitor who ignored the banner invisible (2 sessions/day sitewide,
  // and email-click leads never created the session their identity param was
  // supposed to stitch — found in the 2026-07-10 E2E pass). An explicit
  // decline is still declined, and the server also honors GPC opt-outs.
  if (stored === null) return 'essential'
  if (stored.analytics && stored.marketing) return 'all'
  if (stored.analytics) return 'analytics'
  if (stored.marketing) return 'essential'
  return 'declined'
}

/**
 * Best-effort UTM + fbclid + referrer capture once per session (sessionStorage). Mirrors
 * the WP snippet's captureSource so we get consistent first-touch attribution
 * regardless of which surface the visitor landed on first.
 */
function captureSource(): { campaign?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string }; referrer?: string; landingPage?: string; fbclid?: string } {
  if (typeof window === 'undefined') return {}
  const STORAGE_KEY = 'rr_source_v1'
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  const params = new URLSearchParams(window.location.search || '')
  const src: Record<string, string | undefined> = {
    utm_source: params.get('utm_source') ?? undefined,
    utm_medium: params.get('utm_medium') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
    utm_content: params.get('utm_content') ?? undefined,
    utm_term: params.get('utm_term') ?? undefined,
  }
  // Meta click-id — present when visitor arrives from a Facebook/Instagram ad.
  // Captured once at session start (first-touch) and stored so we don't lose
  // it on SPA navigation (the param disappears after the initial landing).
  const fbclid = params.get('fbclid') ?? undefined
  const referrer = (typeof document !== 'undefined' ? document.referrer : '') || undefined
  // Auto-infer source from referrer host when no UTM
  if (!src.utm_source && referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase()
      if (/facebook|fb\.com/.test(host))   { src.utm_source = 'facebook';  src.utm_medium ||= 'social' }
      else if (/instagram/.test(host))     { src.utm_source = 'instagram'; src.utm_medium ||= 'social' }
      else if (/\bgoogle\./.test(host))    { src.utm_source = 'google';    src.utm_medium ||= 'organic' }
      else if (/bing|duckduckgo/.test(host)) { src.utm_source = host.split('.')[0]; src.utm_medium ||= 'organic' }
      else if (/youtube/.test(host))       { src.utm_source = 'youtube';   src.utm_medium ||= 'social' }
      else if (/linkedin/.test(host))      { src.utm_source = 'linkedin';  src.utm_medium ||= 'social' }
      else if (/tiktok/.test(host))        { src.utm_source = 'tiktok';    src.utm_medium ||= 'social' }
      else if (/zillow|realtor|trulia|redfin/.test(host)) { src.utm_source = host.replace(/^www\./, '').split('.')[0]; src.utm_medium ||= 'portal' }
      else if (host && host !== window.location.hostname) { src.utm_source = host; src.utm_medium ||= 'referral' }
    } catch {}
  }
  if (!src.utm_source) { src.utm_source = 'direct'; src.utm_medium ||= 'none' }
  const result = {
    campaign: {
      source: src.utm_source,
      medium: src.utm_medium,
      campaign: src.utm_campaign,
      content: src.utm_content,
      term: src.utm_term,
    },
    fbclid,
    referrer,
    landingPage: window.location.href,
  }
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result)) } catch {}
  return result
}

/**
 * Fire a same-origin POST to /api/visitors/track. The endpoint upserts the
 * session and inserts the event; the DB trigger updates engagement_score and
 * intent_tags. Server-side consent gate refuses 'declined' events even if
 * something here misbehaves.
 */
function fireVisitorEvent(pathname: string, eventType: 'page_view' | 'listing_view', listingMls?: string | null) {
  const sessionId = getOrCreateSessionId()
  if (!sessionId) return
  const consent = consentLevel()
  if (consent === 'declined') return
  const { campaign, referrer, landingPage, fbclid } = captureSource()
  const payload = {
    sessionId,
    sourceDomain: typeof window !== 'undefined' ? window.location.hostname.toLowerCase().replace(/^www\./, '') : 'ryanrealty.vercel.app',
    eventType,
    pageUrl: typeof window !== 'undefined' ? window.location.href : pathname,
    pageTitle: typeof document !== 'undefined' ? document.title.slice(0, 200) : undefined,
    pageCategory: categorizePage(pathname),
    // Identifies WHICH property was viewed — the server writes visitor_events.listing_mls
    // and fires trackListingView() to Follow Up Boss so the CRM logs the property view.
    listing: listingMls ? { mlsNumber: listingMls } : undefined,
    campaign,
    fbclid,
    referrer,
    landingPage,
    consent,
  }
  // keepalive=true so the POST survives a fast navigation away.
  try {
    fetch('/api/visitors/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  } catch {}
}

function getFubLastVisit(): number | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${FUB_LAST_VISIT_KEY}=([^;]+)`))
  const val = match?.[1]
  if (!val) return null
  const n = parseInt(val, 10)
  return Number.isFinite(n) ? n : null
}

function setFubLastVisit(): void {
  if (typeof document === 'undefined') return
  const maxAge = 30 * 24 * 60 * 60
  document.cookie = `${FUB_LAST_VISIT_KEY}=${Date.now()}; path=/; max-age=${maxAge}; SameSite=Lax`
}

type Props = { userId?: string | null; userEmail?: string | null }

export default function VisitTracker({ userId, userEmail }: Props) {
  const pathname = usePathname()
  const tracked = useRef<string | null>(null)
  // Separate dedupe for the visitor_events write, keyed by pathname ONLY. The
  // session wrapper renders with userId=null then re-renders once /api/auth/me
  // resolves the real id; the visitor_event payload is keyed by sessionId (not
  // userId), so it must fire once per pathname or the null->id re-render would
  // double-count every page/property view for a logged-in visitor.
  const firedVisitorPath = useRef<string | null>(null)
  const returnTracked = useRef(false)

  useEffect(() => {
    // Aggressive ad-traffic consent (Matt 2026-06-02): a visitor arriving from a
    // paid/marketing click with no prior consent choice gets analytics+marketing
    // auto-granted so THIS first page view + all on-site intent scoring fires.
    // Respects an explicit prior decision (essential/declined not overridden).
    autoGrantConsentForAdTraffic()
    // The public visitor pipeline never tracks internal admin pages.
    if (pathname?.startsWith('/admin') || !pathname) return
    // Unified visitor_sessions / visitor_events pipeline — feeds the
    // /admin/visitors/live + /admin/analytics/funnel-breakdown dashboards and
    // the hot-lead scoring cron. Fires at EVERY non-declined consent level:
    // with no banner answer the event goes out at 'essential' and the server
    // stores the minimal record. Fired once per pathname (firedVisitorPath) so
    // the userId resolution does not double-count the view.
    if (consentLevel() !== 'declined' && firedVisitorPath.current !== pathname) {
      firedVisitorPath.current = pathname
      const det = detectListing(pathname)
      fireVisitorEvent(pathname, det.isListing ? 'listing_view' : 'page_view', det.mls)
    }
    // Everything below (legacy visits table, GA-adjacent writes) stays behind
    // explicit analytics consent.
    if (!hasAnalyticsConsent()) return
    const visitId = getOrCreateVisitId()
    if (!visitId) return
    // Legacy visits table (kept for backward-compat with existing reports) —
    // keyed by pathname+userId so a login re-associates the visit.
    const key = pathname + (userId ?? 'anon')
    if (tracked.current !== key) {
      tracked.current = key
      trackVisit({
        visitId,
        path: pathname,
        referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        userId: userId ?? undefined,
      })
    }
  }, [pathname, userId])

  useEffect(() => {
    if (!hasAnalyticsConsent() || !userEmail?.trim() || !pathname) return
    const now = Date.now()
    const last = getFubLastVisit()
    const isReturn = last == null || now - last >= RETURN_VISIT_MS
    setFubLastVisit()
    if (isReturn && !returnTracked.current) {
      returnTracked.current = true
      const pageUrl = typeof window !== 'undefined' ? window.location.href : pathname
      const pageTitle = typeof document !== 'undefined' ? document.title : undefined
      trackReturnVisitAction({ userEmail: userEmail.trim(), pageUrl, pageTitle })
    }
  }, [pathname, userEmail])

  useEffect(() => {
    const onConsent = () => {
      if (hasAnalyticsConsent() && pathname) {
        // Consent was off at load and just got granted — fire the view the main
        // effect had to skip. Guard each write with its own ref so this never
        // double-counts what the main effect already recorded.
        const key = pathname + (userId ?? 'anon')
        if (tracked.current !== key) {
          tracked.current = key
          const visitId = getOrCreateVisitId()
          if (visitId) {
            trackVisit({
              visitId,
              path: pathname,
              referrer: document.referrer || undefined,
              userAgent: navigator.userAgent,
              userId: userId ?? undefined,
            })
          }
        }
        // Mirror to the new visitor_events pipeline on the consent flip too.
        if (firedVisitorPath.current !== pathname) {
          firedVisitorPath.current = pathname
          const det = detectListing(pathname)
          fireVisitorEvent(pathname, det.isListing ? 'listing_view' : 'page_view', det.mls)
        }
      }
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [pathname, userId])

  return null
}
