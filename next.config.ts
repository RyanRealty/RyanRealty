import type { NextConfig } from 'next'
import path from 'path'
import fs from 'fs'

/**
 * Load Supabase vars from .env.local so they win over Cursor's Supabase plugin
 * (which can inject a different project URL when you run dev from Cursor).
 */
function loadSupabaseEnvFromLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const p = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq <= 0) continue
        const key = trimmed.slice(0, eq).trim()
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (
          key === 'NEXT_PUBLIC_SUPABASE_URL' ||
          key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' ||
          key === 'SUPABASE_SERVICE_ROLE_KEY'
        ) {
          if (value) out[key] = value
        }
      }
    }
  } catch {
    // ignore
  }
  return out
}

const supabaseFromEnvLocal = loadSupabaseEnvFromLocal()

// PWA: Serwist requires webpack. Next 16 defaults to Turbopack; use `next build --webpack` to enable SW.
// Manifest + offline page + InstallPrompt work without the service worker.
const nextConfig: NextConfig = {
  // Turbopack: use project dir as root so @/ resolves correctly when multiple lockfiles exist (e.g. parent folder).
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  // Emit production source maps so Lighthouse Best Practices audit
  // valid-source-maps passes. /team route dropped to BP=0 without this
  // because every chunked vendor JS bundle counted as a missing-map fail.
  // Source maps are served at /_next/static/chunks/*.js.map only on
  // explicit request — they don't bloat user payloads.
  productionBrowserSourceMaps: true,
  env: {
    ...(supabaseFromEnvLocal.NEXT_PUBLIC_SUPABASE_URL && {
      NEXT_PUBLIC_SUPABASE_URL: supabaseFromEnvLocal.NEXT_PUBLIC_SUPABASE_URL,
    }),
    ...(supabaseFromEnvLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY && {
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseFromEnvLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }),
    ...(supabaseFromEnvLocal.SUPABASE_SERVICE_ROLE_KEY && {
      SUPABASE_SERVICE_ROLE_KEY: supabaseFromEnvLocal.SUPABASE_SERVICE_ROLE_KEY,
    }),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'replication.sparkapi.com', pathname: '/**' },
      { protocol: 'https', hostname: 'sparkapi.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.resize.sparkplatform.com', pathname: '/**' },
      // All Spark/FlexMLS photo CDN subdomains (cdn.resize + cdn.photos + future).
      // Listing-detail gallery photos use cdn.photos.sparkplatform.com (the Uri300
      // field) which was NOT allowlisted, so Next/Image blocked them -> broken
      // images on the listing detail page. The wildcard covers every variant.
      { protocol: 'https', hostname: '**.sparkplatform.com', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  // Prevent Vercel build retries/failures when a few pages exceed 60s prerender window.
  // Runtime performance is controlled separately via query timeouts and cache.
  staticPageGenerationTimeout: 180,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // GA4 + Google Ads need more than www.google-analytics.com: gtag beacons
          // hit www.google.com/g/collect and the regional *.analytics.google.com /
          // region1.google-analytics.com hosts, Google Signals/SODAR uses
          // *.adtrafficquality.google, and ads conversions use *.doubleclick.net.
          // Without these in connect-src the /g/collect fetch is CSP-blocked and
          // tracking silently dies. (Verified 2026-06-01: console showed
          // "Fetch API cannot load https://www.google.com/g/collect ... violates ...
          // connect-src" on every page.)
          // Also required: the GA4 APEX host analytics.google.com (Signals /
          // cross-device — *.analytics.google.com does NOT match the bare host),
          // and widgetbe.com (the Follow Up Boss tracking pixel script + beacons
          // in components/FollowUpBossPixel.tsx — FUB lead attribution). Verified
          // 2026-06-02: both were CSP-blocked on every page.
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://www.googletagmanager.com https://*.google-analytics.com https://www.google-analytics.com https://www.google.com https://maps.googleapis.com https://maps.gstatic.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.adtrafficquality.google https://connect.facebook.net https://widgetbe.com https://*.widgetbe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data: https://fonts.gstatic.com https://widgetbe.com https://*.widgetbe.com; connect-src 'self' https://*.supabase.co https://*.google-analytics.com https://www.google-analytics.com https://*.analytics.google.com https://www.google.com https://www.googletagmanager.com https://*.doubleclick.net https://*.adtrafficquality.google https://api.elevenlabs.io https://maps.googleapis.com https://maps.gstatic.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://connect.facebook.net https://www.facebook.com https://*.facebook.com https://analytics.google.com https://widgetbe.com https://*.widgetbe.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://*.aryeo.com https://*.matterport.com https://*.cloudflarestream.com https://*.videodelivery.net https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.google.com https://*.adtrafficquality.google;" },
        ],
      },
      // SITE_SPEC §45-47 — aggressive edge caching on the public LP families.
      // The cookie-aware Header / Footer live inside <Suspense> islands; the
      // page shell + content (sourced from cached MVs) is safe to cache at
      // the Vercel CDN. s-maxage=60 + stale-while-revalidate=600 means the
      // CDN serves cached HTML for 60s then serves-stale-while-revalidating
      // for 10min, which absorbs cold-render spikes that were driving cold
      // p95 over budget.
      { source: '/', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=600' }] },
      { source: '/cities/:path*', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=600' }] },
      { source: '/communities/:path*', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=600' }] },
      { source: '/zip/:path*', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=600' }] },
      { source: '/listing/:path*', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=600' }] },
      { source: '/homes-for-sale/:path*', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=600' }] },
      { source: '/about', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=3600' }] },
      { source: '/team', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=3600' }] },
      { source: '/team/:slug', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=3600' }] },
    ];
  },
  // SEO: canonical URLs use /homes-for-sale (keyword-rich). Old /search links redirect.
  async redirects() {
    return [
      // /cities/tumalo has no geo_snapshot_mv market-data row (Tumalo is a Bend
      // submarket, not a standalone city in the MLS aggregation) so the page
      // 404'd. Send it to Bend rather than dead-end. Temporary (307) in case
      // Tumalo gets its own data + page later.
      { source: '/cities/tumalo', destination: '/cities/bend', permanent: false },
      // /sold is linked from the site footer ("Sold data") but had no route -> 404
      // on every page. Point it at the sold-listings view (search filtered to
      // closed). Caught by the new check-internal-links gate.
      { source: '/sold', destination: '/homes-for-sale?status=Sold', permanent: false },
      { source: '/search', destination: '/homes-for-sale', permanent: true },
      { source: '/search/:path*', destination: '/homes-for-sale/:path*', permanent: true },
      { source: '/listings', destination: '/homes-for-sale', permanent: true },
      { source: '/listings/:listingKey', destination: '/listing/:listingKey', permanent: true },
      { source: '/homes-for-sale/in/listing/:listingKey', destination: '/homes-for-sale/listing/:listingKey', permanent: true },
      { source: '/homes-for-sale/in/:path*', destination: '/homes-for-sale/:path*', permanent: true },
      { source: '/home-valuation', destination: '/sell/valuation', permanent: true },
      // /sell/plan retired 2026-06-04: orphan legacy page (sitemap-only, zero inbound
      // links) carrying an unsourced market stat (CLAUDE.md §0). Superseded by the
      // contracted /sell hub. 301 so any held position transfers rather than 404s.
      { source: '/sell/plan', destination: '/sell', permanent: true },
      { source: '/sign-in', destination: '/login', permanent: true },
      { source: '/sign-in/:path*', destination: '/login/:path*', permanent: true },
      { source: '/agents', destination: '/team', permanent: true },
      { source: '/agents/:slug', destination: '/team/:slug', permanent: true },
      { source: '/reports', destination: '/housing-market/reports', permanent: true },
      { source: '/reports/explore', destination: '/housing-market/explore', permanent: true },
      { source: '/reports/:slug/:geoName', destination: '/housing-market/reports/:slug/:geoName', permanent: true },
      // Single-segment report (e.g. /reports/weekly-2026-05-24) had no rule, so it
      // and /housing-market/reports/:slug both returned 200 = duplicate content.
      { source: '/reports/:slug', destination: '/housing-market/reports/:slug', permanent: true },

      // ── Legacy AgentFire/WordPress cutover 404s ─────────────────────────────
      // URL shapes the sitemap-driven legacy map (middleware + legacy-redirects.json)
      // doesn't cover. Verified against GA4 + live-probed 2026-06-02 — see
      // scripts/ga4-404-report.mjs. Every destination is a guaranteed-200 page.
      // (Legacy listing-detail URLs /listing/odsmls/<mls>/... resolve to the live
      // listing via the app/listing/odsmls/[...slug] route, not a static rule.)

      // Old AgentFire IDX *search* URLs, e.g. /properties/neighborhood-Boyd-Acres...
      { source: '/properties', destination: '/homes-for-sale', permanent: true },
      { source: '/properties/:path*', destination: '/homes-for-sale', permanent: true },

      // Old WordPress dated blog permalinks (/<year>/<month>/<slug>). The slug
      // rarely matches the new /blog/<slug>, so consolidate to the blog index
      // (always 200) rather than risk a 301 to a 404.
      { source: '/:year(2023)/:path*', destination: '/blog', permanent: true },
      { source: '/:year(2024)/:path*', destination: '/blog', permanent: true },
      { source: '/:year(2025)/:path*', destination: '/blog', permanent: true },

      // Old WordPress static pages.
      { source: '/sellers', destination: '/sell', permanent: true },
      { source: '/best-neighborhoods-bend-oregon', destination: '/area-guides', permanent: true },

      // Landing pages linked/advertised but never built — keep funnel traffic on a
      // live LP instead of a dead end (307: revisit if these LPs ship later).
      { source: '/lp/bend-luxury-concierge', destination: '/lp/bend', permanent: false },
      { source: '/lp/awbrey-butte', destination: '/lp/bend', permanent: false },
      { source: '/lp/woodside-ranch', destination: '/lp/bend', permanent: false },
      // /lp/listings/<key> was never a route; the listing itself lives at /listing/<key>.
      { source: '/lp/listings/:listingKey', destination: '/listing/:listingKey', permanent: true },

      // Removed demo route still drawing traffic → the live Market Pulse page.
      { source: '/pulse-video-demo', destination: '/pulse', permanent: true },

      // Admin route moved under the (protected) group.
      { source: '/admin/social', destination: '/admin/analytics/social', permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: '/homes-for-sale/listing/:listingKey', destination: '/listing/by-key/:listingKey' },
      { source: '/homes-for-sale/:city/:listingSlug([^/]*-[0-9]{5,})', destination: '/listing/by-address/:city/:listingSlug' },
      { source: '/homes-for-sale/:city/:community/:listingSlug([^/]*-[0-9]{5,})', destination: '/listing/by-address/:city/:community/:listingSlug' },
      { source: '/homes-for-sale/:city/:neighborhood/:community/:listingSlug([^/]*-[0-9]{5,})', destination: '/listing/by-address/:city/:neighborhood/:community/:listingSlug' },
      { source: '/homes-for-sale/:city/:community/:listingSlug([^/]*~[^/]*)', destination: '/listing/by-address/:city/:community/:listingSlug' },
      { source: '/homes-for-sale/:city/:neighborhood/:community/:listingSlug([^/]*~[^/]*)', destination: '/listing/by-address/:city/:neighborhood/:community/:listingSlug' },
      { source: '/homes-for-sale', destination: '/search' },
      { source: '/homes-for-sale/:path*', destination: '/search/:path*' },
    ];
  },
  // Avoid "Body exceeded 1 MB limit" → browser "Failed to fetch" (e.g. Server Actions with images/large payloads)
  experimental: {
    optimizePackageImports: ['@hugeicons/react', '@hugeicons/core-free-icons', 'date-fns', 'recharts', '@react-email/components', 'radix-ui', '@react-google-maps/api', '@googlemaps/markerclusterer'],
    serverActions: {
      bodySizeLimit: '4mb',
    },
    // PPR was renamed to cacheComponents in Next 16 with a different API
    // (mark cached I/O with 'use cache'). Adopting that is a multi-file
    // refactor — out of scope for the §45-47 fix. The current play is
    // edge-cache headers + a refactored layout (no top-level headers()
    // / cookies() reads in the shell) so the function response is at
    // least cacheable at the CDN even though the route is still dynamic.
  },
  // Include CMA drafts + finalized assets so /api/cma/[slug]/pdf can read
  // them from disk inside the serverless function (avoids the SSO wall on
  // preview deployments).
  outputFileTracingIncludes: {
    'app/api/cma/[slug]/pdf/route': [
      './public/drafts/cma-*/cma.html',
      './public/drafts/cma-*/assets/*.png',
      './public/drafts/cma-*/assets/*.jpg',
      './public/drafts/cma-*/assets/*.otf',
      './public/cmas/cma-*/cma.html',
      './public/cmas/cma-*/assets/*.png',
      './public/cmas/cma-*/assets/*.jpg',
      './public/cmas/cma-*/assets/*.otf',
    ],
    'app/api/cma/[slug]/email/route': [
      './public/drafts/cma-*/cma.html',
      './public/drafts/cma-*/assets/*.png',
      './public/drafts/cma-*/assets/*.jpg',
      './public/drafts/cma-*/assets/*.otf',
      './public/cmas/cma-*/cma.html',
      './public/cmas/cma-*/assets/*.png',
      './public/cmas/cma-*/assets/*.jpg',
      './public/cmas/cma-*/assets/*.otf',
    ],
  },
}

export default nextConfig
