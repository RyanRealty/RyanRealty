/**
 * POST /api/visitors/track
 *
 * Source-agnostic visitor tracking ingest. Called from:
 *   - ryan-realty.com (WordPress AgentFire) — cross-origin via the snippet at
 *     docs/wordpress-fub-identify-snippet.html
 *   - ryanrealty.vercel.app (Next.js) — same-origin via the VisitorTracker
 *     client component (replacement for the legacy VisitTracker)
 *
 * Flow:
 *   1. Receives a tracked event (page_view, listing_view, search,
 *      scroll_depth, cta_click, identify, signin, save_listing) with a
 *      client-generated session_id (uuid v4 persisted in localStorage as
 *      `rr_session_id`).
 *   2. UPSERT into public.visitor_sessions:
 *        - First event for this session_id → INSERT with first-touch UTMs,
 *          referrer, landing page, user_agent, IP geo, source_domain.
 *        - Subsequent events → no-op on the UPSERT, the BEFORE INSERT trigger
 *          on visitor_events updates last_seen_at + score + intent_tags.
 *   3. INSERT into public.visitor_events. Trigger fires, score updates.
 *   4. Returns running { engagement_score, intent_tags, fub_person_id,
 *      session_age_seconds } so the client snippet can adapt UI (e.g. open
 *      a soft wall when score crosses a threshold, hide the sign-in modal
 *      when the session is already identified).
 *
 * Non-blocking: always returns 200 on a payload-parse success, even if the
 * DB write fails. The page load must never depend on this endpoint.
 *
 * Auth model:
 *   - Origin allowlist (ryan-realty.com + ryanrealty.vercel.app + previews).
 *   - No request body is trusted for identification — fub_person_id only
 *     comes from the server-side identify backfill, never from the client.
 *   - IP rate limiting at the Vercel edge stops obvious abuse.
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { isGpcOptOut } from '@/lib/crm/gpc'
import { recordGpcSuppression } from '@/lib/data/crm/recordGpcSuppression'
// Identity params (?_pid / ?_fuid) are stripped from every URL this route
// stores or forwards. See strip-identity.ts for why the server, not the client
// bridge, has to be the mechanism.
import { AGENT_ATTRIB_COOKIE } from '@/lib/agent-attribution'
import { resolveVisitBrokerSlug, visitBrokerGa4Fields } from '@/lib/analytics/visit-broker'
import { ga4SafePagePath, ga4SafePageTitle, stripGa4UrlParams, stripIdentityParams, visitorEventMetadata } from './strip-identity'
// P7 identity loop (2026-09-23, docs/TRACKING_POLICY.md "The known-contact
// identity loop"): a SIGNED ?_pid= token on a link we sent identifies the visit
// here, server-side, on the landing page view; the durable rr_vid and the
// signed rr_pid cookie carry it to every later visit on the browser.
import { verifyPersonLinkToken } from '@/lib/identity/link-token'
import { arrivalTokenFrom, planArrivalIdentity, type ArrivalDecision } from '@/lib/identity/arrival'
import {
  PERSON_COOKIE,
  personCookieOptions,
  personCookieValue,
  signedPersonIdFromCookie,
} from '@/lib/identity/person-cookie'
import {
  clearProvisionalAutomation,
  identifySessionAndBrowser,
  insertVisitorSession,
  isMissingColumnError,
  readIdentityMapForVid,
  readSessionIdentity,
  stampSessionEmailOnly,
} from '@/lib/data/identity/sessionIdentity'
import { personExistsById } from '@/lib/data/crm/personExistsById'
import {
  classifyArrivalShape,
  classifyAutomation,
  isPersonEvidence,
  isProvisionalReason,
} from '@/lib/analytics/automation'
import { campaignDetailsParams, ga4SessionParams, parseVisit } from '@/lib/analytics/ga4-visit'
import { ga4MirrorSends, isGa4MirrorView } from '@/lib/analytics/ga4-mirror'
import {
  decideGaSuppressionForPage,
  hasAutomationMarker,
  hasInternalUserCookie,
} from '@/lib/analytics/ga-suppression'
import { isNonProductionPageLocation, isNonProductionRequestHost } from '@/lib/analytics/non-production-host'
import { CONSENT_COOKIE, effectiveTrackingConsent } from '@/lib/identity/consent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Origin allowlist. Vercel previews go through preview URLs we cannot enumerate
// in advance; we use a suffix check for `.vercel.app` as a pragmatic match.
const ALLOWED_EXACT_ORIGINS = new Set<string>([
  'https://ryan-realty.com',
  'https://www.ryan-realty.com',
  'https://ryanrealty.vercel.app', // staging-host-ok: incoming CORS origin (not an outgoing URL); keep through cutover
])

function isAllowedOrigin(origin: string | null, selfOrigin?: string | null): boolean {
  if (!origin) return false
  // Same-origin posts always pass: only pages WE serve carry our own origin
  // (rr-doc-tracker on /cma|/bpo documents, and any local production build —
  // the exact-origin list alone 403'd every localhost verification run).
  if (selfOrigin && origin === selfOrigin) return true
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true
  try {
    const u = new URL(origin)
    if (u.protocol !== 'https:') return false
    if (u.hostname.endsWith('.vercel.app') && u.hostname.startsWith('ryanrealty')) return true
  } catch {
    return false
  }
  return false
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = isAllowedOrigin(origin) ? origin! : ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonError(status: number, error: string, origin: string | null) {
  return NextResponse.json({ ok: false, error }, { status, headers: corsHeaders(origin) })
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })
}

/**
 * The opaque row id of the CMA or BPO a client-document view is on, as a GA4
 * param (`cma_id` / `bpo_id`). GA4 sees the page as `/cma/[document]`
 * (stripGa4UrlParams), because the slug is the subject's street address; the
 * id keeps the view attributable to its document. Read after the response
 * (mirrorAfterResponse), only when the mirror can send (GA4_API_SECRET set),
 * and capped at GA4_DOC_ID_BUDGET_MS so a stuck read cannot hold the function
 * open. Empty on any other page, on a failed or timed-out read: the view is
 * still counted, without the id.
 */
const GA4_DOC_ID_BUDGET_MS = 3000

async function ga4DocumentIdParams(pageUrl: string): Promise<Record<string, string>> {
  if (!process.env.GA4_API_SECRET?.trim()) return {}
  const lookup = async (): Promise<Record<string, string>> => {
    const { cmaSlugFromDocumentUrl } = await import('@/lib/crm/cma-engagement')
    const cmaSlug = cmaSlugFromDocumentUrl(pageUrl)
    if (cmaSlug) {
      const { getCmaIdBySlug } = await import('@/lib/data/cma/documents')
      const id = await getCmaIdBySlug(cmaSlug)
      return id ? { cma_id: id } : {}
    }
    let path = ''
    try {
      path = new URL(pageUrl).pathname
    } catch {
      return {}
    }
    const bpo = /^\/bpo\/([a-z0-9-]{3,80})(?:\/|$)/i.exec(path)
    if (!bpo) return {}
    const { getBpoIdBySlug } = await import('@/lib/data/bpo/reads')
    const id = await getBpoIdBySlug(bpo[1]!)
    return id ? { bpo_id: id } : {}
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      lookup(),
      new Promise<Record<string, string>>((resolve) => {
        timer = setTimeout(() => resolve({}), GA4_DOC_ID_BUDGET_MS)
      }),
    ])
  } catch {
    return {}
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// ─── Payload schema ─────────────────────────────────────────────────────────

type Campaign = {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
}

type ListingMeta = {
  mlsNumber?: string
  street?: string
  city?: string
  state?: string
  postalCode?: string
  price?: number
  bedrooms?: number
  bathrooms?: number
  areaSqft?: number
}

/** Granular consent state the client sends with every event. Server enforces.
 *  - 'all'       → full tracking (UTMs, geo, listing meta, intent tags)
 *  - 'analytics' → analytics-only (treated like 'all' for our first-party
 *                  store; we do not share visitor_events with third parties)
 *  - 'essential' → functional record: session_id, page_url, event_type,
 *                  REFERRER and CAMPAIGN PARAMS (they describe the click, not
 *                  the person). Geo, user agent, listing meta, scroll and dwell
 *                  are stripped.
 *  - 'declined'  → REJECT the event entirely, no writes
 *  - undefined   → REJECT (defense in depth: snippet must opt in explicitly) */
type ConsentLevel = 'all' | 'analytics' | 'essential' | 'declined'

type TrackBody = {
  /** Client-generated uuid v4 persisted in localStorage. */
  sessionId?: string
  /** Logical source surface — 'ryan-realty.com' | 'ryanrealty.vercel.app' */
  sourceDomain?: string
  /** One of: page_view, listing_view, search, scroll_depth, cta_click, identify, signin */
  eventType?: string
  /** Full URL of the page where the event happened. */
  pageUrl?: string
  /** document.title at event time. */
  pageTitle?: string
  /** Page category bucket assigned by the client snippet. */
  pageCategory?: string
  /** Listing metadata (only when eventType=listing_view). */
  listing?: ListingMeta | null
  /** Scroll depth percent (only when eventType=scroll_depth). */
  scrollDepthPct?: number
  /** Dwell seconds on previous page (best-effort). */
  dwellSeconds?: number
  /** First-touch attribution captured by the snippet on first hit. */
  campaign?: Campaign
  /** document.referrer at first page load. */
  referrer?: string
  /** Landing page URL at first page load. */
  landingPage?: string
  /** Free-form payload for forward-compat. */
  metadata?: Record<string, unknown>
  /** REQUIRED: client-side consent state. Server enforces compliance. */
  consent?: ConsentLevel
  /**
   * Meta click-id from the ?fbclid= URL param. Persisted on session creation
   * alongside utm_* for first-touch attribution + CAPI deduplication.
   * Stripped to 512 chars max; only accepted at analytics/all consent level.
   */
  fbclid?: string
  /** Google Ads click-id from ?gclid= — same first-touch treatment as fbclid. */
  gclid?: string
  /**
   * Global Privacy Control JS flag (navigator.globalPrivacyControl) forwarded
   * by the client. The Sec-GPC request header is read server-side; this is the
   * parallel JS source. Either being a GPC opt-out drops the request and (for a
   * contact the browser was already identified as) records a durable suppression.
   * Phase 8.1. Since 2026-09-30 the trackers send it ALONE, as a notice with no
   * session id (gpcKnownContact).
   */
  gpc?: boolean
  /**
   * Canonical short broker slug resolved client-side from ?agent= / cookie.
   * Server re-normalizes; unknown values are ignored.
   */
  agent?: string
  /**
   * The signed person token from a link we sent (?_pid=). Usually read straight
   * off `pageUrl`; forwarded explicitly when PersonIdentityBridge cleaned the
   * address bar before the tracker posted. Verified server-side; an unsigned or
   * forged value identifies nobody.
   */
  identityToken?: string
  /** navigator.webdriver, an automation signal (lib/analytics/automation.ts). */
  webdriver?: boolean
  /**
   * The visit this event belongs to (VisitTracker): the Unix second it began,
   * the browser's running visit count, and whether this event starts it. Feeds
   * the GA4 mirror's per-visit session_id (TRACK-1).
   */
  visit?: { id?: number; number?: number; start?: boolean }
}

/**
 * Send the GA4 mirror hit once the response is on its way, without losing it.
 * The mirror runs last in this handler, so a bare `void` promise could be
 * frozen with the function before the request to Google leaves; `after()` keeps
 * the function alive until it settles. Outside a request scope (unit tests)
 * `after` throws, and the task simply runs now.
 */
function mirrorAfterResponse(task: () => Promise<unknown>): void {
  try {
    after(task)
  } catch {
    void task()
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * The contact a browser sending Global Privacy Control was ALREADY identified as,
 * from what it carries on every request to this site, or null. The trackers send
 * nothing identifying under GPC (a notice of `{ gpc: true }`), so the contact is:
 * the session a tracker from before 2026-09-30 still names in its post, else the
 * signed rr_pid cookie, else the person the browser's rr_vid is mapped to in
 * visitor_identity_map. Only a signed cookie names anyone. Read only to record the
 * opt-out; nothing about the visit is written.
 */
async function gpcKnownContact(
  request: NextRequest,
  body: TrackBody,
  sb: NonNullable<ReturnType<typeof getSupabase>>,
): Promise<number | null> {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (UUID_V4.test(sessionId)) {
    const fromSession = (await readSessionIdentity(sb, sessionId))?.crmPersonId ?? null
    if (fromSession) return fromSession
  }
  const fromCookie = signedPersonIdFromCookie(request.cookies.get(PERSON_COOKIE)?.value)
  if (fromCookie) return fromCookie
  const rrVid = request.cookies.get('rr_vid')?.value
  if (rrVid && UUID_V4.test(rrVid)) return (await readIdentityMapForVid(sb, rrVid))?.personId ?? null
  return null
}

// save_listing (2026-07-21): a consumer like/save mirrored onto the visitor
// trail. Emitted server-side by lib/data/crm/recordSaveListingEvent (from the
// like/save actions) and accepted here for any future client-side emitter.
// Same consent gating as every other type — declined/missing consent is
// rejected above, 'essential' strips listing meta + metadata below.
const ALLOWED_EVENT_TYPES = new Set<string>([
  'page_view', 'listing_view', 'search', 'scroll_depth', 'section_view', 'cta_click', 'identify', 'signin', 'save_listing',
  'intent_declared', 'welcome_back', 'email_opt', 'sms_opt',
  'join_convert',
])

// Map the host of the page being tracked to a canonical source_domain bucket.
// Anything not in the known list defaults to 'ryan-realty.com' to keep older
// snippets safe; the schema stays open for adding more domains later.
function resolveSourceDomain(pageUrl: string, explicit?: string): string {
  const exp = explicit?.trim().toLowerCase()
  // source_domain bucket labels for the INCOMING page host (a stored classification,
  // the schema's existing value), never a URL anyone is sent to. staging-host-ok
  if (exp === 'ryan-realty.com' || exp === 'ryanrealty.vercel.app') return exp
  try {
    const host = new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'ryan-realty.com') return 'ryan-realty.com'
    if (host === 'ryanrealty.vercel.app') return 'ryanrealty.vercel.app' // staging-host-ok: bucket label, see above
    if (host.endsWith('.vercel.app')) return 'ryanrealty.vercel.app' // staging-host-ok: bucket label, see above
  } catch {
    // fall through to default
  }
  return 'ryan-realty.com'
}

// Extract best-effort IP geo from common edge-proxy headers. Cloudflare sets
// CF-IPCountry; Vercel passes x-vercel-ip-country / x-vercel-ip-city /
// x-vercel-ip-country-region. Either works; we prefer Cloudflare when present
// (the WordPress site is behind CF), fall back to Vercel headers for Next.js.
function readIpGeo(req: NextRequest): { country?: string; region?: string; city?: string } {
  const h = req.headers
  const country = h.get('cf-ipcountry') || h.get('x-vercel-ip-country') || undefined
  const region  = h.get('cf-region') || h.get('x-vercel-ip-country-region') || undefined
  const city    = h.get('cf-ipcity') || h.get('x-vercel-ip-city') || undefined
  return {
    country: country?.trim() ? country.trim().toUpperCase().slice(0, 2) : undefined,
    region:  region?.trim()  ? region.trim().slice(0, 64) : undefined,
    // Vercel sends URL-encoded city names (e.g. "Bend" or "San%20Francisco").
    // Read at every tier for the automation class, so a malformed value (a
    // client can send cf-ipcity itself) must not throw the request.
    city:    city?.trim()    ? decodeCity(city.trim()).slice(0, 64) : undefined,
  }
}

/**
 * The IP geo Vercel's edge sets on every request (x-vercel-ip-*), for the
 * automation class only. A client cannot set these on Vercel, while it can send
 * cf-* itself, and the region is the ISO code DATACENTER_LOCALITIES compares
 * against (lib/analytics/automation.ts).
 */
function readVercelGeo(req: NextRequest): { country?: string; region?: string; city?: string } {
  const h = req.headers
  const country = h.get('x-vercel-ip-country')?.trim()
  const region = h.get('x-vercel-ip-country-region')?.trim()
  const city = h.get('x-vercel-ip-city')?.trim()
  return {
    country: country ? country.toUpperCase().slice(0, 2) : undefined,
    region: region ? region.slice(0, 64) : undefined,
    city: city ? decodeCity(city).slice(0, 64) : undefined,
  }
}

function decodeCity(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const selfOrigin = new URL(request.url).origin
  if (!isAllowedOrigin(origin, selfOrigin)) {
    return jsonError(403, 'Origin not allowed', origin)
  }

  let body: TrackBody
  try {
    body = (await request.json()) as TrackBody
  } catch {
    return jsonError(400, 'Invalid JSON', origin)
  }

  // ─── GPC opt-out gate (server-side enforcement, before anything else) ────
  // Global Privacy Control is a legally binding "do not sell / share" signal in
  // CA/CO/CT. On a GPC opt-out we (1) STOP tracking entirely (no session/event
  // writes), and (2) if the browser was already identified to a CRM person,
  // record a durable channel='all' suppression so the opt-out sticks across every
  // send path AND pulls them from the Meta audience. The suppression write is
  // best-effort and never blocks the response. (Phase 8.1)
  //
  // First, before the session id and consent checks: since 2026-09-30 the
  // trackers write no identifier under GPC and post only a notice, `{ gpc: true }`,
  // with no session id in it (a decline does not cancel the opt-out either).
  const gpcOptOut = isGpcOptOut({
    secGpcHeader: request.headers.get('sec-gpc'),
    jsFlag: typeof body.gpc === 'boolean' ? body.gpc : null,
  })
  if (gpcOptOut) {
    let suppressionRecorded = false
    try {
      const gpcSb = getSupabase()
      const crmPersonId = gpcSb ? await gpcKnownContact(request, body, gpcSb) : null
      if (crmPersonId) {
        const res = await recordGpcSuppression(crmPersonId)
        suppressionRecorded = res.ok && res.recorded
        if (!res.ok) console.warn('[visitors/track] gpc suppression failed:', res.error)
      }
    } catch (err) {
      // Never let the suppression write break the tracking response.
      console.warn('[visitors/track] gpc handling error:', err instanceof Error ? err.message : String(err))
    }
    return NextResponse.json(
      { ok: true, dropped: true, reason: 'gpc_opt_out', suppressionRecorded },
      { headers: corsHeaders(origin) },
    )
  }

  const sessionId = body.sessionId?.trim()
  if (!sessionId || !UUID_V4.test(sessionId)) {
    return jsonError(400, 'sessionId must be a uuid v4', origin)
  }

  const eventType = body.eventType?.trim()
  if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
    return jsonError(400, `Invalid eventType (allowed: ${[...ALLOWED_EVENT_TYPES].join(', ')})`, origin)
  }

  const pageUrl = body.pageUrl?.trim()
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) {
    return jsonError(400, 'pageUrl must be a full URL', origin)
  }

  // ─── Our own development never lands in production (Matt 2026-10-05) ────
  // A local `next build && next start` holds production credentials, so its
  // tracker wrote to the production visitor tables: 2,594 sessions landing on
  // 127.0.0.1 / localhost in the 2026-10-05 audit, 2,306 of them not flagged.
  // The same host rule the GA4 mirror applies: a page on localhost, 127.0.0.1
  // (any port), a LAN IP, [::1], or a *.vercel.app preview records nothing.
  // Also the request Host: a client that spoofs pageUrl as ryan-realty.com
  // while posting to a local `next start` still drops.
  const requestHost =
    request.headers.get('host') ||
    (() => {
      try {
        return new URL(request.url).host
      } catch {
        return null
      }
    })()
  if (isNonProductionPageLocation(pageUrl) || isNonProductionRequestHost(requestHost)) {
    return NextResponse.json(
      { ok: true, dropped: true, reason: 'non_production_host' },
      { headers: corsHeaders(origin) },
    )
  }

  // ─── Consent gate (server-side enforcement) ─────────────────────────────
  // The client names a tier; the server clamps it to the stored banner answer
  // and the region default (lib/identity/consent.ts effectiveTrackingConsent).
  // A client cannot widen past a decline or a restricted-region default.
  // Untyped events are declined. US / unrestricted, no answer, no GPC is
  // analytics (geo may be stored). Restricted, GPC (already dropped above),
  // and declined stay essential or dropped.
  const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry')
  const consent: ConsentLevel = effectiveTrackingConsent({
    posted: body.consent,
    cookieValue: request.cookies.get(CONSENT_COOKIE)?.value,
    country,
  })
  if (consent === 'declined') {
    return NextResponse.json(
      { ok: true, dropped: true, reason: 'consent_declined_or_missing' },
      { headers: corsHeaders(origin) },
    )
  }
  // 'essential' = minimal record: no geo, no user agent, no listing meta, no
  // scroll or dwell. Campaign params and referrer ARE kept — they describe how
  // the visit arrived, not who arrived.
  // 'analytics' or 'all' = full record.
  const minimalOnly = consent === 'essential'

  const supabase = getSupabase()
  if (!supabase) {
    // Don't 500 — page load must not depend on this. Log and return success.
    console.warn('[visitors/track] Supabase service role not configured; event dropped')
    return NextResponse.json({ ok: true, dropped: true }, { headers: corsHeaders(origin) })
  }

  const sourceDomain = resolveSourceDomain(pageUrl, body.sourceDomain)
  // Everything stored from here on uses the identity-stripped URL. `pageUrl`
  // itself stays intact for the reads that legitimately need the whole thing
  // (slug parsing, GA4's page_location) — nothing there persists an id.
  const storedPageUrl = stripIdentityParams(pageUrl) ?? pageUrl
  // Geo + UA describe the PERSON, and stay gated on analytics consent. The
  // automation classifier below still READS the user agent and Vercel's geo at
  // every tier (reading to classify is not storing: docs/TRACKING_POLICY.md).
  const geo = minimalOnly ? {} as ReturnType<typeof readIpGeo> : readIpGeo(request)
  const userAgent = minimalOnly ? undefined : (request.headers.get('user-agent')?.slice(0, 512) || undefined)
  // Campaign parameters describe the LINK THAT WAS CLICKED, not the visitor, and
  // are kept at every tier that stores anything — the same treatment `referrer`
  // has always had, and for the same reason (Matt 2026-08-26).
  //
  // They used to be stripped under essential. Because 99.5% of visitors never
  // answer the banner, that discarded the campaign tag on 99.5% of arrivals:
  // 357 of 79,220 sessions in 90 days carried one. Every paid click was landing
  // with its attribution already destroyed.
  //
  // An explicit decline and a GPC signal both still stop tracking entirely —
  // GPC is enforced above, before any write. Disclosed in app/privacy/page.tsx
  // under Cookies; the code and that page must not drift apart.
  const campaign = body.campaign && Object.values(body.campaign).some(Boolean) ? body.campaign : undefined

  // 1. UPSERT visitor_sessions. On first event we want to capture first-touch
  //    attribution and geo; on subsequent events we want to NOT overwrite
  //    those values, but we still want to keep last_seen_at fresh.
  //
  //    Postgres ON CONFLICT (session_id) DO UPDATE ... lets us conditionally
  //    update by checking IS NULL on the existing row's columns. We use
  //    coalesce-on-update so the first non-NULL value sticks.

  // Use a direct UPSERT via the supabase-js builder. The trigger handles
  // last_seen_at updates on event insert; we still upsert here so first-touch
  // fields land on session creation.
  // fbclid identifies which Meta ad was clicked. Same treatment as the UTMs
  // above (Matt 2026-08-26): it describes the click, not the person, and an
  // explicit decline or a GPC signal still stops it along with everything else.
  const fbclid = typeof body.fbclid === 'string' && body.fbclid.trim()
    ? body.fbclid.trim().slice(0, 512)
    : undefined
  const gclid = typeof body.gclid === 'string' && body.gclid.trim()
    ? body.gclid.trim().slice(0, 512)
    : undefined

  // First-party durable visitor id (Phase 5). Set by middleware on the first
  // page request, so it is present on every same-origin track POST. It is a
  // functional pseudonymous identifier (same category as session_id), so it is
  // recorded at every consent level that stores anything — NOT stripped under
  // essential — to link this session to the durable visitor + the identity map.
  const rrVidCookie = request.cookies.get('rr_vid')?.value
  const rrVid = rrVidCookie && UUID_V4.test(rrVidCookie) ? rrVidCookie : undefined

  // ─── Automation class + arrival identity (P7) ──────────────────────────
  // Classified from the UA HEADER at every tier; only the class label is
  // stored, never the UA string itself at essential (docs/TRACKING_POLICY.md).
  // Our own scripts carry an explicit marker (`rr_automation=1` cookie or query,
  // lib/analytics/ga-suppression.ts), so a capture that spoofs a desktop user
  // agent is still flagged (Matt 2026-10-05: 1,232 Chrome/124-Mac sessions from
  // the capture tool were not).
  const cookieHeader = request.headers.get('cookie')
  const automation = classifyAutomation({
    userAgent: request.headers.get('user-agent'),
    webdriver: body.webdriver,
    marker: hasAutomationMarker({ cookieHeader, search: (() => { try { return new URL(pageUrl).search } catch { return '' } })() }),
    clientHints: request.headers.get('sec-ch-ua'),
  })
  const rawToken = arrivalTokenFrom({ identityToken: body.identityToken, pageUrl })
  const token = rawToken ? verifyPersonLinkToken(rawToken) : null
  // Behavioural and PROVISIONAL (lib/analytics/automation.ts): a cold arrival
  // (no referrer, campaign or token) on the listing contact-form deep link, from
  // a desktop Chrome build long superseded, or from a datacenter town. Every
  // event of a session carries the same landing page, referrer, user agent and
  // geo, so this is recomputed on each one. Stored at birth unless this very
  // event shows a person, cleared below by the first event that does
  // (isPersonEvidence) or by identification; never blocks identification.
  const arrivalShape = automation.automated
    ? { automated: false, reason: null }
    : classifyArrivalShape({
        landingPage: body.landingPage,
        referrer: body.referrer,
        hasToken: !!rawToken,
        userAgent: request.headers.get('user-agent'),
        geo: readVercelGeo(request),
        atMs: Date.now(),
      })
  const personEvidence = isPersonEvidence({ eventType, pageUrl, landingPage: body.landingPage })
  // A signed-in broker's browser (`rr_internal=1`, set on admin sign-in) is
  // flagged `internal` at birth: left out of counts of outside visitors and
  // never mirrored to GA4, but still a person, so identification proceeds
  // (NON_BLOCKING_FLAG_REASONS in lib/analytics/automation.ts).
  const internalBrowser = !automation.automated && hasInternalUserCookie(cookieHeader)
  const birthClass = automation.automated
    ? automation
    : internalBrowser
      ? { automated: true, reason: 'internal' as const }
      : arrivalShape.automated && !personEvidence
        ? arrivalShape
        : { automated: false, reason: null }
  const provisionalAtBirth = birthClass.automated && isProvisionalReason(birthClass.reason)
  let tokenPersonExists = true
  if (token && !automation.automated) {
    const [owner, exists] = await Promise.all([
      readSessionIdentity(supabase, sessionId),
      personExistsById(token.personId).catch(() => false),
    ])
    tokenPersonExists = exists
    const pre = planArrivalIdentity({ token, tokenPersonExists, session: owner })
    if (pre.kind === 'rotate') {
      // This browser session belongs to another contact (shared device,
      // forwarded email). Record nothing under it: the tracker starts a fresh
      // session and re-sends, so the visit lands on the person who clicked.
      return NextResponse.json({ ok: true, rotateSession: true }, { headers: corsHeaders(origin) })
    }
  }

  const sessionInsert = {
    session_id: sessionId,
    rr_vid: rrVid,
    source_domain: sourceDomain,
    utm_source:   campaign?.source ?? undefined,
    utm_medium:   campaign?.medium ?? undefined,
    utm_campaign: campaign?.campaign ?? undefined,
    utm_content:  campaign?.content ?? undefined,
    utm_term:     campaign?.term ?? undefined,
    fbclid,
    gclid,
    referrer:     stripIdentityParams(body.referrer)?.slice(0, 1024),
    landing_page: stripIdentityParams(body.landingPage)?.slice(0, 1024),
    user_agent:   userAgent,
    ip_country:   geo.country,
    ip_region:    geo.region,
    ip_city:      geo.city,
  }

  // Strip undefined keys so Postgres defaults / NULLs apply correctly.
  const cleanSessionInsert: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(sessionInsert)) {
    if (v !== undefined) cleanSessionInsert[k] = v
  }

  // First, try to INSERT the row. If session already exists, the unique
  // constraint on session_id (PK) will reject — that's fine, we silently
  // ignore. We do NOT want to OVERWRITE the first-touch fields on a return
  // event; first-touch attribution is by definition the FIRST time we saw
  // this session. The automation class rides as an optional column pair
  // (migration 20260923120000); before that migration is applied the insert
  // retries without them.
  const sessionWrite = await insertVisitorSession(supabase, cleanSessionInsert, {
    is_automated: birthClass.automated,
    automation_reason: birthClass.reason,
  })
  if (!sessionWrite.inserted && sessionWrite.code !== '23505') {
    // 23505 = unique_violation = session already exists, expected on revisit.
    console.warn('[visitors/track] session insert failed:', sessionWrite.message)
  }
  // Identity carryover at session birth (2026-09-01). stitchVisitorIdentity
  // stamps person ids only onto sessions that EXIST at stitch time, so a new
  // session from the same browser days later was born unidentified — the
  // looking-at wake below and every crm_person_id reader missed stitched
  // returners (verified: stitched clickers on site with their newest
  // identified session days old). On a brand-new session whose browser
  // carries a durable rr_vid, resolve the identity map once (PK read) and
  // stamp the same fields the stitch writes. Best-effort, never blocks.
  // A token on this very request outranks the map (lib/identity/arrival.ts);
  // automation is never identified.
  let identifiedNow = false
  // The signed rr_pid cookie is (re)issued whenever this request identifies a
  // browser, so /api/identity/me and the landing-page forms know them too.
  let setPersonCookieFor: number | null = null
  if (sessionWrite.inserted && rrVid && !token && !automation.automated) {
    const known = await readIdentityMapForVid(supabase, rrVid)
    if (known?.personId) {
      const res = await identifySessionAndBrowser(supabase, {
        sessionId,
        rrVid,
        personId: known.personId,
        via: 'rr_vid_carryover',
        email: known.email,
        stitchBrowser: false,
      })
      identifiedNow = res.sessionStamped
      if (res.sessionStamped) setPersonCookieFor = known.personId
      // A browser already mapped to a contact is a person, whatever it landed on:
      // identifySessionAndBrowser clears a provisional flag when it stamps.
    } else if (known?.email) {
      await stampSessionEmailOnly(supabase, sessionId, known.email)
    }
  }

  // 2. INSERT the event. Trigger fires, score updates, last_seen_at refreshes.
  // Under essential-only consent, listing metadata, scroll, dwell, and the
  // freeform metadata blob get dropped — we keep only session_id,
  // source_domain, event_type, page_url, page_title, page_category.
  const listing = !minimalOnly && body.listing && (body.listing.mlsNumber || body.listing.street) ? body.listing : null
  const eventInsert = {
    session_id:    sessionId,
    source_domain: sourceDomain,
    event_type:    eventType,
    page_url:      storedPageUrl.slice(0, 2048),
    page_title:    body.pageTitle?.slice(0, 512) ?? undefined,
    page_category: body.pageCategory?.slice(0, 64) ?? undefined,
    listing_mls:       listing?.mlsNumber?.slice(0, 64) ?? undefined,
    listing_street:    listing?.street?.slice(0, 256) ?? undefined,
    listing_city:      listing?.city?.slice(0, 128) ?? undefined,
    listing_state:     listing?.state?.slice(0, 16) ?? undefined,
    listing_postal:    listing?.postalCode?.slice(0, 16) ?? undefined,
    listing_price:     typeof listing?.price === 'number' ? listing.price : undefined,
    listing_bedrooms:  typeof listing?.bedrooms === 'number' ? listing.bedrooms : undefined,
    listing_bathrooms: typeof listing?.bathrooms === 'number' ? listing.bathrooms : undefined,
    listing_area_sqft: typeof listing?.areaSqft === 'number' ? listing.areaSqft : undefined,
    scroll_depth_pct:  !minimalOnly && typeof body.scrollDepthPct === 'number' ? Math.max(0, Math.min(100, Math.round(body.scrollDepthPct))) : undefined,
    dwell_seconds:     !minimalOnly && typeof body.dwellSeconds === 'number' ? Math.max(0, Math.round(body.dwellSeconds)) : undefined,
    metadata:          visitorEventMetadata(body.metadata, minimalOnly),
  }
  const cleanEventInsert: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(eventInsert)) {
    if (v !== undefined) cleanEventInsert[k] = v
  }

  const { error: insertEventErr } = await supabase
    .from('visitor_events')
    .insert(cleanEventInsert)
  if (insertEventErr) {
    // FK violation can happen if the session insert above failed for some
    // unexpected reason. Log and return success — the page must not break.
    console.warn('[visitors/track] event insert failed:', insertEventErr.message)
    return NextResponse.json({ ok: true, eventDropped: true }, { headers: corsHeaders(origin) })
  }

  // 3. Fetch the updated session for the response payload. Snippet uses this
  //    to decide whether to keep showing the sign-in modal, open a soft wall,
  //    or skip both. Read before the GA4 mirror (2026-10-14): the stored
  //    automation flag decides whether this event clears a provisional class
  //    and whether it may reach GA4.
  const readSession = (columns: string) =>
    supabase.from('visitor_sessions').select(columns).eq('session_id', sessionId).maybeSingle()
  const SESSION_COLUMNS = 'engagement_score, intent_tags, fub_person_id, crm_person_id, first_seen_at, identified_at'
  let sessRead = await readSession(`${SESSION_COLUMNS}, is_automated, automation_reason`)
  // A database from before migration 20260923120000 has no flag columns.
  if (sessRead.error && isMissingColumnError(sessRead.error)) sessRead = await readSession(SESSION_COLUMNS)
  if (sessRead.error) {
    console.warn('[visitors/track] session read failed:', sessRead.error.message)
  }
  const session = (sessRead.data ?? null) as Record<string, unknown> | null

  // A later event that shows a person (a second page, a scroll, a search, a
  // click, a form: isPersonEvidence) clears a provisional class on the STORED
  // session, whatever this request's own geo or token says (an address can
  // change mid-session). A section rendering in view or a repeat view of the
  // landing page does not: a headless crawler's tall viewport fires those on
  // load. Only a session still carrying a provisional reason pays the write.
  let provisionalStill = session
    ? session.is_automated === true && isProvisionalReason(session.automation_reason)
    : sessionWrite.inserted && provisionalAtBirth
  if (provisionalStill && personEvidence && !sessionWrite.inserted) {
    await clearProvisionalAutomation(supabase, sessionId)
    provisionalStill = false
  }

  // ─── Identify the visit (P7) ─────────────────────────────────────────────
  // The signed token on the link just clicked, else the signed rr_pid cookie
  // from an earlier identification on this browser. Identifies the session AND
  // back-stitches every anonymous session on the same rr_vid, and maps the
  // rr_vid so the next visit, and this person's other devices once they click
  // from them, are born identified.
  const cookiePersonId = signedPersonIdFromCookie(request.cookies.get(PERSON_COOKIE)?.value)
  const decision: ArrivalDecision = planArrivalIdentity({
    token,
    tokenPersonExists,
    session: session ? { crmPersonId: typeof session.crm_person_id === 'number' ? session.crm_person_id : null } : null,
    cookiePersonId,
    automated: automation.automated,
  })
  if (session && decision.kind === 'identify') {
    const res = await identifySessionAndBrowser(supabase, {
      sessionId,
      rrVid,
      personId: decision.personId,
      via: decision.via,
    })
    if (res.sessionStamped) {
      identifiedNow = true
      // Identified, so a person: identifySessionAndBrowser cleared any
      // provisional automation flag, and this view may reach GA4.
      provisionalStill = false
      session.crm_person_id = decision.personId
      session.fub_person_id = decision.personId
      session.identified_at = session.identified_at ?? new Date().toISOString()
    }
    if (res.sessionStamped && cookiePersonId !== decision.personId) setPersonCookieFor = decision.personId
  }
  if (setPersonCookieFor && setPersonCookieFor === cookiePersonId) setPersonCookieFor = null

  // ─── GA4 Measurement Protocol page_view mirror (2026-08-10) ─────────────
  // Mirror view events when the browser is not counting them.
  //
  // At analytics/all on a site page, skip page_view/listing_view regardless of
  // `_ga`. US visitors are analytics-granted by default, so the Google tag
  // counts the first view; `_ga` is often not set yet when this POST lands, and
  // gating on the cookie double-counted that first view (browser client_id plus
  // an rr_session_id-derived client_id). Trade-off: an ad-blocked visitor at
  // the analytics tier is no longer mirrored; first-party Supabase still has
  // them.
  //
  // ESSENTIAL TIER: NOTHING (Matt 2026-10-14). A visitor who has not allowed
  // analytics (a privacy-law region with no banner answer, or marketing only)
  // is not copied to GA4 at all: those hits carried no source and the visitor
  // had not consented. visitor_events above still records the visit.
  // At the analytics tier: client documents (`pageCategory: 'client-document'`,
  // no Google tag) and the intent events (intent_declared, welcome_back,
  // email_opt, sms_opt). The rule is ga4MirrorSends (lib/analytics/ga4-mirror.ts).
  // A decline never reaches here. Never blocks the visitor response.
  // No-op without GA4_API_SECRET.
  //
  // KNOWN CONTACTS (2026-10-14, data/analytics/decisions.json
  // "crm-contacts-tagged-in-ga4"): a mirrored hit from a session that belongs to
  // a CRM contact carries the same hashed user_id the browser tag gets from
  // /api/identity/me, at the analytics tier (an essential-tier visit is not
  // mirrored at all since 2026-10-14). The mirror runs AFTER the
  // identify step above so the view that identifies the visit (a tracked link to
  // a CMA, which runs no Google tag) carries it: GA4 read 2026-10-14 showed 12
  // users with a user id against 113 contacts on the site in 30 days, and 13 of
  // the missing ones had read only their report at the analytics tier.
  const mirrorGa4 = ga4MirrorSends({ eventType, consent, pageCategory: body.pageCategory, pageUrl })
  // Automation never reaches GA4: a crawler render mirrored as a page_view is
  // exactly the inflation TRACK-1 measured, and GA4's known-bot filter does
  // not see Measurement Protocol hits. Nor does a session still carrying a
  // provisional class (a cold arrival that reads as a machine): its views mirror
  // from the event that shows a person.
  // ONE suppression decision with the browser's Google tag loader
  // (lib/analytics/ga-suppression.ts, Matt 2026-10-05): never /admin, never a
  // non-production host, never automation (user agent, navigator.webdriver, our
  // marker), never a signed-in broker's browser.
  const gaSuppression = decideGaSuppressionForPage({
    pageUrl,
    userAgent: request.headers.get('user-agent'),
    webdriver: body.webdriver,
    cookieHeader,
    clientHints: request.headers.get('sec-ch-ua'),
  })
  if (
    mirrorGa4 &&
    !gaSuppression.suppress &&
    !automation.automated &&
    !provisionalStill
  ) {
    try {
      const { fireGa4Event, clientIdFromGaCookie, clientIdFromSessionId } = await import(
        '@/lib/ga4-measurement-protocol'
      )
      const gaCookie = request.cookies.get('_ga')?.value
      const fromCookie = clientIdFromGaCookie(gaCookie)
      // ga4MirrorSends already left out every view the browser's Google tag
      // counts (a site page at the analytics tier) and everything at the
      // essential tier. A raw-HTML client document (/cma, /bpo) loads no gtag, so
      // its views are mirrored for a reader at the analytics tier.
      const isView = isGa4MirrorView(eventType)
      const pagePath = (() => {
        try {
          return new URL(pageUrl).pathname
        } catch {
          return undefined
        }
      })()
      const { pageTypeFromPath } = await import('@/lib/analytics/page-type')
      const pageType = pagePath ? pageTypeFromPath(pagePath) : undefined
      const meta = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
      const intent = typeof meta.intent === 'string' ? meta.intent : undefined
      const source = typeof meta.source === 'string' ? meta.source : undefined
      const thing = typeof meta.thing === 'string' ? meta.thing : undefined
      const broker = visitBrokerGa4Fields(
        resolveVisitBrokerSlug({
          agentParam: typeof body.agent === 'string' ? body.agent : null,
          cookieValue: request.cookies.get(AGENT_ATTRIB_COOKIE)?.value,
          pageUrl,
          utmContent: campaign?.content,
          utmTerm: campaign?.term,
        }),
      )
      // TRACK-1: a per-visit numeric session id (not the browser-lifetime
      // rr_session_id) and, on the first event of a visit, campaign_details
      // with the source / medium / campaign the tracker captured, so GA4 can
      // draw sessions and attribute them.
      const visit = parseVisit(body.visit)
      const campaignDetails = visit?.start ? campaignDetailsParams(campaign ?? body.campaign) : null
      const knownPersonId = session && typeof session.crm_person_id === 'number' ? session.crm_person_id : null
      // A CMA or BPO is counted as /cma/[document] with its opaque row id,
      // never its address slug (Matt 2026-10-14). Read after the response.
      const isDocument = body.pageCategory === 'client-document'
      const eventName = isView ? 'page_view' : eventType
      mirrorAfterResponse(async () => {
        try {
          // A CMA or BPO's opaque row id, read after the response.
          const documentIds = isDocument ? await ga4DocumentIdParams(pageUrl) : {}
          await fireGa4Event({
            eventName,
            clientId: fromCookie || clientIdFromSessionId(sessionId),
            // fireGa4Event sends the hashed id at the analytics tier only.
            knownContact: { personId: knownPersonId, trackingLevel: consent },
            precedingEvents: campaignDetails ? [{ name: 'campaign_details', params: campaignDetails }] : undefined,
            userProperties: {
              ...(intent ? { intent } : {}),
              ...(broker?.userProperties ?? {}),
            },
            eventParams: {
              // GA4-safe (strip-identity.ts): GA4 is a third party, so no contact
              // id, no address or text a person typed, and no CMA or BPO address
              // slug or title leaves the building (Matt 2026-10-14). No fallback
              // to the stored URL: an address GA4 may not see is sent as nothing.
              page_location: stripGa4UrlParams(pageUrl),
              page_title: ga4SafePageTitle(pageUrl, body.pageTitle),
              page_referrer: stripGa4UrlParams(body.referrer),
              page_path: ga4SafePagePath(pagePath),
              ...documentIds,
              page_type: pageType,
              ...ga4SessionParams(visit, sessionId),
              intent,
              source,
              thing,
              ...(broker?.eventParams ?? {}),
            },
          })
        } catch (err) {
          console.warn('[visitors/track] ga4 mirror send failed:', err instanceof Error ? err.message : String(err))
        }
      })
    } catch (err) {
      console.warn(
        '[visitors/track] ga4 page_view mirror failed:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  // ─── Looking-at wake (D3) ────────────────────────────────────────────────
  // Identified person (crm_people.id) + a specific home. GPC already dropped
  // this request above (fail-closed). Essential consent strips listing meta
  // so listingKey is empty and we skip. Unidentified = no SMS. Same rail —
  // queueReturnVisitAlert only inserts; it does not send. One ping per
  // person+listing per session.
  //
  // AUTOMATION NEVER ALERTS A BROKER (docs/TRACKING_POLICY.md, "The known-contact
  // identity loop", rule 5). A crawler or scanner rendering a listing page must
  // not read as the contact looking at that home, so a request the classifier
  // above flagged fires neither this alert nor the one below.
  const crmPersonId =
    !minimalOnly && !automation.automated && session && typeof session.crm_person_id === 'number'
      ? session.crm_person_id
      : null
  if (crmPersonId && eventType === 'listing_view') {
    try {
      const { listingKeyFromPageUrl } = await import('@/lib/crm/looking-at')
      const listingKey = (listing?.mlsNumber ?? listingKeyFromPageUrl(pageUrl) ?? '').trim()
      if (listingKey) {
        const { queueReturnVisitAlert } = await import('@/lib/crm/broker-alerts')
        await withTimeoutFallback(
          queueReturnVisitAlert({
            crmPersonId,
            sessionId,
            listingKey,
            address: listing?.street?.trim() || null,
            pageUrl,
          }),
          false,
          2000,
          'crm:return-visit-alert',
        )
      }
    } catch (err) {
      console.warn('[visitors/track] return-visit alert failed:', err)
    }
  }

  // ─── They opened the report (2026-09-07) ─────────────────────────────────
  // A client document view is the strongest signal a sent CMA produces, and it
  // reached nobody. Same rail, same switches (the alert kind carries the
  // `return-visit:` prefix so the broker's Return-visit switch governs it), one
  // alert per document per contact, ever.
  //
  // Deliberately NOT gated on `minimalOnly`. Since 2026-09-29 a client document
  // posts the reader's own tier (public/rr-doc-tracker.js reads the banner's
  // answer the way VisitTracker does), and a recipient at 'essential' (no banner
  // answer and no campaign on the link, or marketing only) opening the report is
  // still the signal this alert exists for. The looking-at branch above fires
  // only on a listing_view, which a document never sends. The person id is not
  // collected from this visitor: it comes from OUR OWN server-side identify
  // backfill on a link WE emailed them, and telling the broker that the
  // recipient opened the document we sent them is the purpose of the send. The
  // consent gates are a decline (the document posts nothing, and a declined post
  // is dropped at the top of this route) and GPC, which dropped this request
  // fail-closed long before this line.
  //
  // A TAP ON A COMP COUNTS TOO (2026-09-07). Every address, place and CTA the
  // document prints goes through `trackedDocLink`, which stamps `rr_doc=<cmaSlug>`
  // (and, on links already sent, the legacy `utm_campaign=<cmaSlug>`). A seller
  // who skimmed the report and then opened three comps on the site is the
  // strongest signal the send produced, and it arrives on a listing page, not
  // on `/cma/<slug>`. `cmaCampaignFromUrl` reads that identity. Same rail, same
  // `return-visit:cma:<slug>` kind, so the queueBrokerAlert dedupe still means
  // ONE alert per document per contact, ever — a reader who opens five comps
  // does not text the broker five times.
  // Both view kinds: a comp is a LISTING page, which fires `listing_view`, and
  // a page_view-only test would never alert on the tap that matters most.
  //
  // Not for automation. An email security scanner or link previewer that opens
  // the tracked report link is the loudest false positive this alert has: the
  // broker is told "they opened your report" about a bot. The classifier reads
  // the request's user agent and navigator.webdriver (lib/analytics/automation.ts).
  if (!automation.automated && (eventType === 'page_view' || eventType === 'listing_view')) {
    try {
      const { cmaSlugFromDocumentUrl, queueCmaOpenedAlert } = await import('@/lib/crm/cma-engagement')
      const { cmaCampaignFromUrl } = await import('@/lib/cma/doc-links')
      const slug =
        (body.pageCategory === 'client-document' ? cmaSlugFromDocumentUrl(pageUrl) : null) ??
        cmaCampaignFromUrl(pageUrl)
      const viewerId =
        session && typeof session.crm_person_id === 'number' ? session.crm_person_id : null
      if (slug) {
        await withTimeoutFallback(
          queueCmaOpenedAlert({ slug, crmPersonId: viewerId, trigger: 'document' }),
          false,
          2000,
          'crm:cma-opened-alert',
        )
      }
    } catch (err) {
      console.warn('[visitors/track] cma-opened alert failed:', err)
    }
  }
  const response = NextResponse.json(
    {
      ok: true,
      session: session
        ? {
            engagementScore: session.engagement_score,
            intentTags:      session.intent_tags ?? [],
            fubPersonId:     session.fub_person_id,
            identified:      !!session.identified_at,
            sessionAgeSeconds: session.first_seen_at
              ? Math.floor((Date.now() - new Date(session.first_seen_at as string).getTime()) / 1000)
              : null,
          }
        : null,
      // The tracker dispatches `person-identified` on identifiedNow so the
      // analytics bridge picks up the hashed GA4 user id. No id is returned.
      identity: { identifiedNow },
    },
    { headers: corsHeaders(origin) },
  )
  if (setPersonCookieFor) {
    response.cookies.set(PERSON_COOKIE, personCookieValue(setPersonCookieFor), personCookieOptions())
  }
  return response
}
