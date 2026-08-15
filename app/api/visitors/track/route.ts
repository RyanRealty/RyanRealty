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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { isGpcOptOut } from '@/lib/crm/gpc'
import { recordGpcSuppression } from '@/lib/data/crm/recordGpcSuppression'

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
 *  - 'essential' → minimal record (session_id + page_url + event_type only;
 *                  strip UTMs, geo, listing meta, scroll, referrer)
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
  /**
   * Global Privacy Control JS flag (navigator.globalPrivacyControl) forwarded
   * by the client. The Sec-GPC request header is read server-side; this is the
   * parallel JS source. Either being a GPC opt-out drops the event and (for an
   * identified visitor) records a durable suppression. Phase 8.1.
   */
  gpc?: boolean
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// save_listing (2026-07-21): a consumer like/save mirrored onto the visitor
// trail. Emitted server-side by lib/data/crm/recordSaveListingEvent (from the
// like/save actions) and accepted here for any future client-side emitter.
// Same consent gating as every other type — declined/missing consent is
// rejected above, 'essential' strips listing meta + metadata below.
const ALLOWED_EVENT_TYPES = new Set<string>([
  'page_view', 'listing_view', 'search', 'scroll_depth', 'section_view', 'cta_click', 'identify', 'signin', 'save_listing',
  'intent_declared', 'welcome_back', 'email_opt', 'sms_opt',
])

// Map the host of the page being tracked to a canonical source_domain bucket.
// Anything not in the known list defaults to 'ryan-realty.com' to keep older
// snippets safe; the schema stays open for adding more domains later.
function resolveSourceDomain(pageUrl: string, explicit?: string): string {
  const exp = explicit?.trim().toLowerCase()
  if (exp === 'ryan-realty.com' || exp === 'ryanrealty.vercel.app') return exp
  try {
    const host = new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'ryan-realty.com') return 'ryan-realty.com'
    if (host === 'ryanrealty.vercel.app') return 'ryanrealty.vercel.app'
    if (host.endsWith('.vercel.app')) return 'ryanrealty.vercel.app'
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
    // Vercel sends URL-encoded city names (e.g. "Bend" or "San%20Francisco")
    city:    city?.trim()    ? decodeURIComponent(city.trim()).slice(0, 64) : undefined,
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

  // ─── Consent gate (server-side enforcement) ─────────────────────────────
  // Snippet MUST send a consent level. We refuse 'declined' and untyped
  // events entirely so even a buggy or compromised client cannot store
  // visitor data when the user has not opted in.
  const consent: ConsentLevel = (body.consent === 'all' || body.consent === 'analytics' || body.consent === 'essential' || body.consent === 'declined')
    ? body.consent
    : 'declined'
  if (consent === 'declined') {
    return NextResponse.json(
      { ok: true, dropped: true, reason: 'consent_declined_or_missing' },
      { headers: corsHeaders(origin) },
    )
  }
  // 'essential' = minimal record (no UTMs, geo, listing meta, scroll, dwell).
  // 'analytics' or 'all' = full record.
  const minimalOnly = consent === 'essential'

  const supabase = getSupabase()
  if (!supabase) {
    // Don't 500 — page load must not depend on this. Log and return success.
    console.warn('[visitors/track] Supabase service role not configured; event dropped')
    return NextResponse.json({ ok: true, dropped: true }, { headers: corsHeaders(origin) })
  }

  // ─── GPC opt-out gate (server-side enforcement) ─────────────────────────
  // Global Privacy Control is a legally binding "do not sell / share" signal in
  // CA/CO/CT. On a GPC opt-out we (1) STOP tracking this event entirely (no
  // session/event writes), and (2) if the session is already identified to a
  // CRM person, record a durable channel='all' suppression so the opt-out
  // sticks across every send path AND pulls them from the Meta audience. The
  // suppression write is best-effort and never blocks the response. (Phase 8.1)
  const gpcOptOut = isGpcOptOut({
    secGpcHeader: request.headers.get('sec-gpc'),
    jsFlag: typeof body.gpc === 'boolean' ? body.gpc : null,
  })
  if (gpcOptOut) {
    let suppressionRecorded = false
    try {
      const { data: gpcSess } = await supabase
        .from('visitor_sessions')
        .select('crm_person_id')
        .eq('session_id', sessionId)
        .maybeSingle()
      const crmPersonId = gpcSess && typeof gpcSess.crm_person_id === 'number' ? gpcSess.crm_person_id : null
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

  const sourceDomain = resolveSourceDomain(pageUrl, body.sourceDomain)
  // Geo + UA + UTMs are PII-adjacent. Under essential-only consent, strip them.
  const geo = minimalOnly ? {} as ReturnType<typeof readIpGeo> : readIpGeo(request)
  const userAgent = minimalOnly ? undefined : (request.headers.get('user-agent')?.slice(0, 512) || undefined)
  const campaign = !minimalOnly && body.campaign && Object.values(body.campaign).some(Boolean) ? body.campaign : undefined

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
  // fbclid is PII-adjacent (identifies a specific Meta ad click); only capture
  // it when the visitor has granted analytics or full consent — same gate as UTMs.
  const fbclid = !minimalOnly && typeof body.fbclid === 'string' && body.fbclid.trim()
    ? body.fbclid.trim().slice(0, 512)
    : undefined

  // First-party durable visitor id (Phase 5). Set by middleware on the first
  // page request, so it is present on every same-origin track POST. It is a
  // functional pseudonymous identifier (same category as session_id), so it is
  // recorded at every consent level that stores anything — NOT stripped under
  // essential — to link this session to the durable visitor + the identity map.
  const rrVidCookie = request.cookies.get('rr_vid')?.value
  const rrVid = rrVidCookie && UUID_V4.test(rrVidCookie) ? rrVidCookie : undefined

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
    referrer:     body.referrer?.slice(0, 1024) ?? undefined,
    landing_page: body.landingPage?.slice(0, 1024) ?? undefined,
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
  // this session.
  const { error: insertSessionErr } = await supabase
    .from('visitor_sessions')
    .insert(cleanSessionInsert)
  if (insertSessionErr && insertSessionErr.code !== '23505') {
    // 23505 = unique_violation = session already exists, expected on revisit.
    console.warn('[visitors/track] session insert failed:', insertSessionErr.message)
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
    page_url:      pageUrl.slice(0, 2048),
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
    metadata:          !minimalOnly && body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
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

  // ─── GA4 Measurement Protocol page_view mirror (2026-08-10) ─────────────
  // Client gtag is consent-denied by default + often ad-blocked → GA4 shows
  // ~1–2 users while first-party sees ~3.7k sessions. Mirror view events from
  // this server path so GA4 volume tracks product truth WITHOUT changing the
  // locked Consent Mode defaults.
  //
  // Double-count guard: if consent is analytics/all AND the browser already
  // has a `_ga` cookie, client gtag is live — skip MP. If essential-only or
  // no `_ga` (denied / blocked / never loaded), server-fill the gap.
  // Never blocks the visitor response. No-op without GA4_API_SECRET.
  const mirrorGa4 =
    eventType === 'page_view' ||
    eventType === 'listing_view' ||
    eventType === 'intent_declared' ||
    eventType === 'welcome_back' ||
    eventType === 'email_opt' ||
    eventType === 'sms_opt'
  if (mirrorGa4) {
    try {
      const { fireGa4Event, clientIdFromGaCookie, clientIdFromSessionId } = await import(
        '@/lib/ga4-measurement-protocol'
      )
      const gaCookie = request.cookies.get('_ga')?.value
      const fromCookie = clientIdFromGaCookie(gaCookie)
      const isView = eventType === 'page_view' || eventType === 'listing_view'
      const clientHasGtag = isView && !minimalOnly && !!fromCookie
      if (!clientHasGtag) {
        const pagePath = (() => {
          try {
            return new URL(pageUrl).pathname
          } catch {
            return undefined
          }
        })()
        const meta = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
        const intent = typeof meta.intent === 'string' ? meta.intent : undefined
        const source = typeof meta.source === 'string' ? meta.source : undefined
        const thing = typeof meta.thing === 'string' ? meta.thing : undefined
        void fireGa4Event({
          eventName: isView ? 'page_view' : eventType,
          clientId: fromCookie || clientIdFromSessionId(sessionId),
          userProperties: intent ? { intent } : undefined,
          eventParams: {
            page_location: pageUrl,
            page_title: body.pageTitle ?? undefined,
            page_referrer: body.referrer ?? undefined,
            page_path: pagePath,
            // First-party session stitch (optional custom dim later)
            session_id: sessionId.slice(0, 36),
            intent,
            source,
            thing,
          },
        })
      }
    } catch (err) {
      console.warn(
        '[visitors/track] ga4 page_view mirror failed:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  // 3. Fetch the updated session for the response payload. Snippet uses this
  //    to decide whether to keep showing the sign-in modal, open a soft wall,
  //    or skip both.
  const { data: sessRow, error: readSessErr } = await supabase
    .from('visitor_sessions')
    .select('engagement_score, intent_tags, fub_person_id, crm_person_id, first_seen_at, identified_at')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (readSessErr) {
    console.warn('[visitors/track] session read failed:', readSessErr.message)
  }

  const session = sessRow ?? null

  // ─── Looking-at wake (D3) ────────────────────────────────────────────────
  // Identified person (crm_people.id) + a specific home. GPC already dropped
  // this request above (fail-closed). Essential consent strips listing meta
  // so listingKey is empty and we skip. Unidentified = no SMS. Same rail —
  // queueReturnVisitAlert only inserts; it does not send. One ping per
  // person+listing per session.
  const crmPersonId =
    !minimalOnly && session && typeof session.crm_person_id === 'number' ? session.crm_person_id : null
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
  return NextResponse.json(
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
    },
    { headers: corsHeaders(origin) },
  )
}
