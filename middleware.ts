import { NextResponse, type NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import legacyRedirects from '@/data/legacy-redirects.json'
import { resolveSubdivisionAreaRedirect } from '@/lib/subdivision-area-redirects'
import { CENTRAL_OREGON_CITY_SLUGS, isCentralOregonCommunitySlug } from '@/lib/central-oregon'
import resortCommunitiesRegistry from '@/data/resort-communities.json'

/**
 * Next.js Edge Middleware.
 *
 * Three jobs:
 *
 *   1. Host-based rewrites for the seller/buyer landing-page subdomains
 *      (e.g. seller.ryan-realty.com/ → /lp/seller-home-value). Keeps the
 *      URL the visitor sees clean while serving the underlying LP route.
 *
 *   2. Sets x-pathname on the request so server components (notably the
 *      root layout) can branch on the current path — used to strip global
 *      chrome on /lp/* routes so dedicated landing pages render without
 *      site nav, footer, chat widget, or exit-intent popup.
 *
 *   3. IP-based rate limiting on /api/* routes. When Upstash env vars are
 *      missing (local dev), the limiter is a no-op pass-through.
 *
 * Tiers:
 *   /api/ai/*        → strict (10 req/min)  — AI generation costs money
 *   /api/pdf/*        → strict (10 req/min)  — CPU-intensive PDF rendering
 *   /api/cma/*        → strict (10 req/min)  — compute-heavy valuations
 *   /api/auth/*       → auth   (5 req/min)   — brute-force protection
 *   /api/open-houses/* → auth  (5 req/min)   — form spam protection
 *   /api/admin/sync/* → admin   (300 req/min) — high-frequency admin polling
 *   /api/*            → general (60 req/min)  — catch-all API protection
 */

// Build limiters at module scope (Edge runtime caches across invocations)
function buildLimiter(prefix: string, tokens: number, window: string): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.trim() || !token?.trim()) return null
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(tokens, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
    prefix: `rl:mw:${prefix}`,
    analytics: true,
  })
}

const strict = buildLimiter('strict', 10, '60 s')
const auth = buildLimiter('auth', 5, '60 s')
const admin = buildLimiter('admin', 300, '60 s')
const general = buildLimiter('general', 60, '60 s')

function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    '127.0.0.1'
  )
}

function pickLimiter(pathname: string): Ratelimit | null {
  if (pathname.startsWith('/api/ai/')) return strict
  if (pathname.startsWith('/api/pdf/')) return strict
  if (pathname.startsWith('/api/cma/')) return strict
  // /api/auth/me is the read-only session check the header / SignInPrompt /
  // VisitTracker fire on EVERY page load. The 5/min auth limiter is for
  // brute-force protection on login/callback, not a per-pageview session read —
  // applying it here 429s any visitor who browses more than 5 pages a minute and
  // breaks the auth chrome. Route it through the general (60/min) tier instead.
  if (pathname === '/api/auth/me') return general
  if (pathname.startsWith('/api/auth/')) return auth
  if (pathname.startsWith('/api/open-houses/')) return auth
  if (pathname.startsWith('/api/admin/sync/')) return admin ?? general
  if (pathname.startsWith('/api/')) return general
  return null
}

// ─── Bot / geo screening (page routes only) ─────────────────────────────────
//
// Why this exists: GA4's built-in "known bots" filter only drops *declared*
// crawlers (Googlebot, Bingbot, ...). It does nothing about JS-executing
// scraper bots running in data centers — they render the page, gtag.js fires,
// and GA4 logs a real session from an IP that geolocates to China/Singapore/etc.
// That is the "traffic from places like China" noise. Two layers stop it:
//
//   1. UA denylist — obvious automation (HTTP client libraries, CLI tools,
//      security scanners, zero-value aggressive crawlers) and requests with no
//      User-Agent at all.
//   2. Geo block — page views geolocating to high-spam / data-center origins.
//      Vercel sets x-vercel-ip-country at the edge; it is absent in local dev,
//      so this layer no-ops locally.
//
// Verified good crawlers (search, AI, social link-preview, our own perf tooling)
// are allowlisted FIRST and bypass BOTH layers — so SEO and share-card unfurling
// never break, even if a good crawler ever requests from a blocked country.
//
// Scope: PAGE ROUTES ONLY. /api/* is never screened here — webhooks (Meta CAPI,
// FUB, Spark), Vercel crons, and other server-to-server callers legitimately use
// non-browser UAs and may originate from foreign IPs. Static assets already skip
// middleware via the matcher.
//
// Operational knobs (no redeploy needed):
//   BOT_SCREEN_DISABLED=1   — kill switch, disables all screening instantly.
//   BLOCK_COUNTRIES=CN,RU   — override the geo list (CSV of ISO-3166 alpha-2).

// Always allow. Mirrors the AI crawlers in app/robots.ts, plus search engines,
// social unfurlers, and our perf tooling (Lighthouse / PageSpeed Insights).
const GOOD_BOT_RE =
  /(googlebot|google-inspectiontool|storebot-google|google-read-aloud|adsbot-google|mediapartners-google|googleother|google-extended|apis-google|feedfetcher-google|bingbot|bingpreview|adidxbot|msnbot|slurp|duckduckbot|applebot|gptbot|oai-searchbot|chatgpt-user|perplexitybot|claudebot|claude-searchbot|claude-web|anthropic-ai|cohere-ai|ccbot|chrome-lighthouse|google page speed|pagespeed|facebookexternalhit|facebookcatalog|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|whatsapp|discordbot|telegrambot|skypeuripreview|pinterest|redditbot|embedly|flipboard|vercelbot|vercel-screenshot)/i

// Always block. Unambiguous automation: HTTP client libraries, CLI tools,
// security scanners, and aggressive zero-value crawlers. No real visitor sends
// these. (AhrefsBot is intentionally absent — it feeds our own Ahrefs site
// audit. Sophisticated headless bots faking a real browser UA are caught by the
// geo layer, not this list.)
const BAD_BOT_RE =
  /(curl\/|wget|python-requests|python-urllib|urllib|aiohttp|httpx|libwww-perl|lwp::|java\/|okhttp|go-http-client|node-fetch|axios|guzzlehttp|apache-httpclient|httpclient|winhttp|wininet|mechanize|scrapy|httrack|colly|zgrab|masscan|nmap|nikto|sqlmap|nuclei|wpscan|gobuster|censys|internet-measurement|l9scan|netcraftsurveyagent|semrushbot|mj12bot|dotbot|dataforseobot|petalbot|bytespider|blexbot|megaindex|serpstatbot|seekport|barkrowler|spbot)/i

function parseBlockedCountries(): Set<string> {
  const fromEnv = (process.env.BLOCK_COUNTRIES || '').trim()
  const codes = fromEnv
    ? fromEnv.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
    : ['CN', 'HK', 'RU', 'SG'] // default: top data-center / GA4-spam origins
  return new Set(codes)
}
const BLOCKED_COUNTRIES = parseBlockedCountries()

// Pages cited in compliance filings (A2P 10DLC campaign message_flow, carrier
// CTA verification) must be loadable by reviewer tooling, which often presents
// an HTTP-library User-Agent. Twilio error 30909 hit us twice (2026-06-11)
// because the bad-ua screen 403'd these exact URLs. Keep this list in sync
// with CTA_URLS in scripts/crm-a2p-resubmit.mjs.
const COMPLIANCE_VERIFICATION_PATHS = new Set([
  '/privacy',
  '/terms',
  '/contact',
  '/sell/valuation',
  '/lp/seller-home-value',
  '/lp/sell-your-home',
  '/lp/buyer-listing-alerts',
  '/lp/expired-listing',
])

/**
 * Decide whether to block a page request. Returns a short reason string when the
 * request should be 403'd, or null to let it through. Never screens /api/*.
 */
function screenBotRequest(request: NextRequest, pathname: string): string | null {
  if (process.env.BOT_SCREEN_DISABLED === '1') return null
  if (pathname.startsWith('/api/')) return null
  if (COMPLIANCE_VERIFICATION_PATHS.has(pathname.replace(/\/$/, '') || '/')) return null

  const ua = request.headers.get('user-agent') ?? ''

  // 1. Verified good crawlers bypass everything (SEO + social safety).
  if (GOOD_BOT_RE.test(ua)) return null

  // 2. No User-Agent on an HTML page route is effectively always a script.
  if (ua.trim() === '') return 'empty-ua'

  // 3. Obvious automation / scanners / junk crawlers.
  if (BAD_BOT_RE.test(ua)) return 'bad-ua'

  // 4. Geo block — Vercel sets this header at the edge; absent locally (→ allow).
  const country = (request.headers.get('x-vercel-ip-country') ?? '').toUpperCase()
  if (country && BLOCKED_COUNTRIES.has(country)) return `geo:${country}`

  return null
}

/**
 * Map of landing-page subdomains to the underlying LP path they serve at the
 * root. Add buyer/recruit/etc. here as we ship them.
 */
const HOST_LP_ROOT_REWRITES: Record<string, string> = {
  'seller.ryan-realty.com': '/lp/seller-home-value',
  // Future:
  // 'buyer.ryan-realty.com': '/lp/buyer-listing-alerts',
}

// ─── Legacy WordPress/AgentFire → new-site 301 redirect map (cutover) ──────
// Generated by scripts/build-legacy-redirects.mjs from the live Yoast sitemaps.
// Preserves SEO equity for ~650 indexed legacy URLs at domain cutover.
// Gate: scripts/check-legacy-redirects.mjs (LAUNCH-04). Keys are normalized:
// lowercase, no trailing slash.
const LEGACY_REDIRECTS: Record<string, string> = legacyRedirects as Record<string, string>

function resolveLegacyRedirect(pathname: string): string | null {
  let p = pathname
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  p = p.toLowerCase()
  const dest = LEGACY_REDIRECTS[p]
  // Guard against self-maps (a path that exists on BOTH sites is served
  // natively, never redirected to itself → no loop).
  return dest && dest !== p ? dest : null
}

// ─── Geo-slug validation (soft-404 elimination) ────────────────────────────
// /cities/[slug] and /communities/[slug] use generateStaticParams=[] +
// dynamicParams=true, so an unknown slug renders the page, hits notFound() deep
// in an async server component, and Next ships a HOLLOW 200 (soft-404). Google
// files thousands of those under "crawled, not indexed", which suppresses the
// whole site. Validate the slug HERE, before render, against the authoritative
// STATIC sets and emit a REAL 404. Edge-safe (no DB): cities use the service-area
// set; communities use the city-prefixed check + the resort registry. Valid but
// dynamic city-prefixed subdivision slugs pass through to the page's own guard.
const RESORT_COMMUNITY_SLUGS: Set<string> = new Set(
  (Array.isArray(resortCommunitiesRegistry)
    ? (resortCommunitiesRegistry as Array<{ slug?: string }>)
    : ((resortCommunitiesRegistry as { communities?: Array<{ slug?: string }> }).communities ?? [])
  )
    .map((c) => c.slug)
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.toLowerCase()),
)

function isInvalidGeoSlug(pathname: string): boolean {
  const cityMatch = pathname.match(/^\/cities\/([^/]+)\/?$/)
  if (cityMatch) {
    let slug = cityMatch[1]
    try { slug = decodeURIComponent(slug) } catch { /* raw */ }
    return !CENTRAL_OREGON_CITY_SLUGS.has(slug.toLowerCase())
  }
  const commMatch = pathname.match(/^\/communities\/([^/]+)\/?$/)
  if (commMatch) {
    let slug = commMatch[1]
    try { slug = decodeURIComponent(slug) } catch { /* raw */ }
    slug = slug.toLowerCase()
    return !(isCentralOregonCommunitySlug(slug) || RESORT_COMMUNITY_SLUGS.has(slug))
  }
  return false
}

const GEO_NOT_FOUND_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found · Ryan Realty</title></head>' +
  '<body style="font-family:Geist,system-ui,sans-serif;background:#102742;color:#faf8f4;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center">' +
  '<div style="max-width:32rem;padding:2rem"><h1 style="font-size:2rem;margin:0 0 .75rem">Page not found</h1>' +
  '<p style="opacity:.8;line-height:1.6;margin:0 0 1.5rem">That place is not in our Central Oregon coverage. Search every active listing instead.</p>' +
  '<a href="/homes-for-sale" style="color:#faf8f4;text-decoration:underline">Browse homes for sale</a></div></body></html>'

// ─── Canonical production host ──────────────────────────────────────────────
// The site answers on BOTH the custom domain (ryan-realty.com) and the Vercel
// deployment alias (ryanrealty.vercel.app). Two equal public hosts silently
// break Google/Facebook sign-in: @supabase/ssr writes the PKCE code_verifier as
// a HOST-ONLY cookie on whichever host the visitor initiates from, but Supabase
// Auth redirects the OAuth callback to the host in its Site URL / redirect
// allow-list. When the visitor starts on the alias and the callback resolves on
// the custom domain (or vice-versa), the verifier cookie is gone and
// exchangeCodeForSession throws "code verifier could not be found" — the user
// bounces to /auth-error and NO Follow Up Boss lead is created. Verified live
// 2026-06-02: on ryan-realty.com the verifier cookie is written correctly
// (Lax, persistent, host-only) and the flow completes; the failures all came
// from visitors on ryanrealty.vercel.app.
//
// 2026-06-03: www.ryan-realty.com is ALSO a live public alias and was NOT being
// funneled, so a visitor who lands on www sets the verifier on www but Supabase
// redirects the callback to the apex (its Site URL) — verifier missing → the
// "sign-in issue" that clears on a second try (now on the apex). Adding www
// closes that gap. (seller./go. subdomains are intentionally excluded: seller.
// is a transparent LP rewrite and go. is a short-link host.)
//
// Funnel every browser (page) request to the canonical host so initiation and
// callback always share one host. /api/* is excluded so server-to-server
// callers (Meta CAPI, FUB, Spark webhooks, Vercel crons) that may hit the alias
// and not follow redirects keep working. Also consolidates SEO to one hostname.
const CANONICAL_HOST = 'ryan-realty.com'
const NON_CANONICAL_HOSTS = new Set(['ryanrealty.vercel.app', 'www.ryan-realty.com'])

function buildNextResponse(pathname: string, request: NextRequest): NextResponse {
  // Always set x-pathname on the forwarded request headers so server
  // components can read it via headers().get('x-pathname').
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

/**
 * Paid-click attribution rescue. When a Meta ad click lands with ?fbclid and the
 * Meta pixel has NOT already set _fbc (pre-pixel click, consent gate, blocked
 * pixel — the common reason paid conversions show 0), drop a ready-to-use Meta
 * _fbc value into a first-party rr_fbc cookie. The seller/buyer LP server actions
 * fall back to it when sending the CAPI Lead event, so Meta can attribute the
 * conversion to the ad click. Scoped to the registrable domain (subdomainIndex 1)
 * so it works on both the apex and the seller. LP host; httpOnly (only the server
 * action reads it). No-op without ?fbclid or when a real _fbc already exists.
 */
function attachFbcCookie(response: NextResponse, request: NextRequest, host: string): NextResponse {
  const fbclid = request.nextUrl.searchParams.get('fbclid')
  if (!fbclid) return response
  if (request.cookies.get('_fbc') || request.cookies.get('rr_fbc')) return response
  const isProd = host.endsWith('ryan-realty.com')
  response.cookies.set('rr_fbc', `fb.1.${Date.now()}.${fbclid}`, {
    maxAge: 90 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: isProd,
    ...(isProd ? { domain: 'ryan-realty.com' } : {}),
  })
  return response
}

/**
 * First-party visitor id (Phase 5 — tracking policy / identity graph). Sets a
 * durable, server-readable `rr_vid` cookie on the first page request when none
 * exists. Unlike the client-generated session_id (localStorage rr_session_id),
 * this cookie is present on the very FIRST server request — before any client
 * JS — so server actions, the identify backfill (lib/visitor-backfill.ts), and
 * CAPI can stitch anonymous browsing to a known person without waiting on the
 * client. Scoped to the registrable domain so it is stable across the apex and
 * the seller. LP subdomain. NOT httpOnly: the client tracker reads it to use as
 * a stable external_id (Meta) / user_id (GA) for cross-event identity. 2-year
 * TTL (a returning visitor keeps the same id). No-op when rr_vid already exists.
 */
function attachVidCookie(response: NextResponse, request: NextRequest, host: string): NextResponse {
  if (request.cookies.get('rr_vid')) return response
  const isProd = host.endsWith('ryan-realty.com')
  response.cookies.set('rr_vid', crypto.randomUUID(), {
    maxAge: 2 * 365 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: isProd,
    ...(isProd ? { domain: 'ryan-realty.com' } : {}),
  })
  return response
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl
  const pathname = url.pathname
  const host = (request.headers.get('host') ?? '').toLowerCase()

  // ─── (00) Canonical host — funnel the Vercel alias to ryan-realty.com ──
  // Runs before everything else so OAuth initiation AND /auth/callback always
  // land on the canonical host (where the PKCE verifier cookie lives). Never
  // touches /api/* (webhooks/crons may target the alias and not follow 308s).
  if (NON_CANONICAL_HOSTS.has(host) && !pathname.startsWith('/api/')) {
    const redirectUrl = url.clone()
    redirectUrl.protocol = 'https:'
    redirectUrl.hostname = CANONICAL_HOST
    redirectUrl.port = ''
    return NextResponse.redirect(redirectUrl, 308)
  }

  // ─── (0) Legacy URL → new-site 301 (domain cutover SEO preservation) ───
  // Runs FIRST so search crawlers and users get a clean single-hop 301 for any
  // of the ~650 indexed legacy WordPress/AgentFire URLs. Skips /api/* and the
  // LP subdomains (handled below). See LEGACY_REDIRECTS + LAUNCH-04 gate.
  if (!pathname.startsWith('/api/')) {
    const legacyDest = resolveLegacyRedirect(pathname)
    if (legacyDest) {
      const redirectUrl = url.clone()
      // A legacy dest may carry an anchor (e.g. "/sell#marketing-plan") so a
      // deep-linked legacy URL lands the visitor on the right section. Split it
      // off the pathname so the "#" is not URL-encoded into the path.
      const hashIdx = legacyDest.indexOf('#')
      redirectUrl.pathname = hashIdx === -1 ? legacyDest : legacyDest.slice(0, hashIdx)
      redirectUrl.search = ''
      redirectUrl.hash = hashIdx === -1 ? '' : legacyDest.slice(hashIdx)
      return NextResponse.redirect(redirectUrl, 301)
    }
  }

  // ─── (0a) /subdivisions marketing-slug → canonical area (hard 308) ─────
  // /subdivisions/[slug] serves PLAT slugs only (geo_type='subdivision', e.g.
  // 'tetherow-phase-1'). A MARKETING-level area name ('awbrey-butte', 'tetherow')
  // has no plat boundary, so the page notFound()s — which, under Next 16
  // streaming, ships as a hollow 200 (soft-404): bad UX + an SEO sink. An App
  // Router page cannot emit a hard 3xx once the shell has streamed, so the real
  // permanent redirect has to happen HERE, before render. Resolution is a
  // synchronous lookup in a committed-JSON map (resort registry + City-of-Bend
  // neighborhoods) — no DB, Edge-safe, no penalty on the ~3,213 valid plats
  // (they are not in the map → pass straight through). Single hop → 200.
  // See lib/subdivision-area-redirects.ts.
  if (!pathname.startsWith('/api/')) {
    const subMatch = pathname.match(/^\/subdivisions\/([^/]+)\/?$/)
    if (subMatch) {
      let subSlug = subMatch[1]
      try {
        subSlug = decodeURIComponent(subSlug)
      } catch {
        /* malformed escape — fall back to the raw segment */
      }
      const areaDest = resolveSubdivisionAreaRedirect(subSlug)
      if (areaDest) {
        const redirectUrl = url.clone()
        redirectUrl.pathname = areaDest
        redirectUrl.search = ''
        return NextResponse.redirect(redirectUrl, 308)
      }
    }
  }

  // ─── (0c) Invalid geo slug → REAL 404 (kills soft-404 sprawl) ──────────
  // Unknown /cities/* and /communities/* slugs would otherwise render a hollow
  // 200 (soft-404). Emit a hard 404 with a noindex body so Google drops them.
  if (!pathname.startsWith('/api/') && isInvalidGeoSlug(pathname)) {
    return new NextResponse(GEO_NOT_FOUND_HTML, {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  // ─── (0b) Bot / geo screening for page routes (never /api/*) ───────────
  // Block obvious automation and high-spam-origin page views before anything
  // renders, so gtag.js never fires for them — keeps GA4 clean. Good crawlers
  // and /api/* are exempt (see screenBotRequest).
  const botBlockReason = screenBotRequest(request, pathname)
  if (botBlockReason) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'x-bot-screen': botBlockReason, 'cache-control': 'no-store' },
    })
  }

  // ─── (1) Host-based rewrite for LP subdomains ──────────────────────────
  // seller.ryan-realty.com/ → /lp/seller-home-value (transparent rewrite —
  // browser still shows seller.ryan-realty.com/). Only rewrites the root path
  // so the subdomain can also serve /lp/west-bend-value etc. later.
  const subdomainLpRoot = HOST_LP_ROOT_REWRITES[host]
  if (subdomainLpRoot && (pathname === '/' || pathname === '')) {
    const rewriteUrl = url.clone()
    rewriteUrl.pathname = subdomainLpRoot
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', subdomainLpRoot)
    return attachVidCookie(attachFbcCookie(NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } }), request, host), request, host)
  }

  // ─── (2) Rate limiting for /api/* ──────────────────────────────────────
  const limiter = pickLimiter(pathname)
  if (limiter) {
    const ip = getIp(request)
    // Fail OPEN: if the limiter backend (Upstash) is down or over its monthly
    // request quota, limiter.limit() throws. A rate limiter must never take the
    // API offline — when its backend errors, allow the request through rather
    // than 500-ing every /api/* call. (Quota/outage is surfaced via logs.)
    let limited: { success: boolean; limit: number; remaining: number; reset: number } | null = null
    try {
      limited = await limiter.limit(ip)
    } catch (err) {
      console.error('[middleware] rate-limiter unavailable, failing open:', err instanceof Error ? err.message : err)
    }

    if (limited && !limited.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limited.limit),
            'X-RateLimit-Remaining': String(limited.remaining),
            'X-RateLimit-Reset': String(limited.reset),
            'Retry-After': String(Math.ceil((limited.reset - Date.now()) / 1000)),
          },
        },
      )
    }

    const response = buildNextResponse(pathname, request)
    if (limited) {
      response.headers.set('X-RateLimit-Limit', String(limited.limit))
      response.headers.set('X-RateLimit-Remaining', String(limited.remaining))
      response.headers.set('X-RateLimit-Reset', String(limited.reset))
    }
    return response
  }

  // ─── (3) Default: forward x-pathname so server components can branch ───
  return attachVidCookie(attachFbcCookie(buildNextResponse(pathname, request), request, host), request, host)
}

// Run on everything that isn't a Next.js internal or static asset.
// (Static files with extensions skip middleware — significant perf win.)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\..*).*)',
  ],
}
