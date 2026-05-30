import { NextResponse, type NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import legacyRedirects from '@/data/legacy-redirects.json'

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

/**
 * Decide whether to block a page request. Returns a short reason string when the
 * request should be 403'd, or null to let it through. Never screens /api/*.
 */
function screenBotRequest(request: NextRequest, pathname: string): string | null {
  if (process.env.BOT_SCREEN_DISABLED === '1') return null
  if (pathname.startsWith('/api/')) return null

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

function buildNextResponse(pathname: string, request: NextRequest): NextResponse {
  // Always set x-pathname on the forwarded request headers so server
  // components can read it via headers().get('x-pathname').
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl
  const pathname = url.pathname
  const host = (request.headers.get('host') ?? '').toLowerCase()

  // ─── (0) Legacy URL → new-site 301 (domain cutover SEO preservation) ───
  // Runs FIRST so search crawlers and users get a clean single-hop 301 for any
  // of the ~650 indexed legacy WordPress/AgentFire URLs. Skips /api/* and the
  // LP subdomains (handled below). See LEGACY_REDIRECTS + LAUNCH-04 gate.
  if (!pathname.startsWith('/api/')) {
    const legacyDest = resolveLegacyRedirect(pathname)
    if (legacyDest) {
      const redirectUrl = url.clone()
      redirectUrl.pathname = legacyDest
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl, 301)
    }
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
    return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
  }

  // ─── (2) Rate limiting for /api/* ──────────────────────────────────────
  const limiter = pickLimiter(pathname)
  if (limiter) {
    const ip = getIp(request)
    const { success, limit, remaining, reset } = await limiter.limit(ip)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          },
        },
      )
    }

    const response = buildNextResponse(pathname, request)
    response.headers.set('X-RateLimit-Limit', String(limit))
    response.headers.set('X-RateLimit-Remaining', String(remaining))
    response.headers.set('X-RateLimit-Reset', String(reset))
    return response
  }

  // ─── (3) Default: forward x-pathname so server components can branch ───
  return buildNextResponse(pathname, request)
}

// Run on everything that isn't a Next.js internal or static asset.
// (Static files with extensions skip middleware — significant perf win.)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\..*).*)',
  ],
}
