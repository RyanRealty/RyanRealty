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
  typescript: {
    // Vercel-ONLY: skip the type-check phase there. Vercel's standard build
    // machine intermittently OOMs mid "Running TypeScript" (silent death,
    // deployment state ERROR, full Build CPU billed, commit never deploys —
    // 6 of 20 production deploys on 2026-07-29). The pushed tree is already
    // type-checked twice before Vercel can see it: the local push chain
    // (scripts/push-with-gates.sh, G47) builds with full checking on every
    // code push, and CI's lint-and-build job builds again on GitHub runners
    // (VERCEL is unset in both, so this flag stays false there). The Vercel
    // pass was a redundant third check. Approved-by: matt 2026-07-29.
    ignoreBuildErrors: process.env.VERCEL === '1',
  },
  // pdfjs-dist breaks when Turbopack bundles it into a server action (TC
  // document upload page-count). Load it from node_modules at runtime instead.
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas'],
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
  // Per-page prerender ceiling, in seconds.
  //
  // HISTORY. This number was raised twice to absorb ONE route: the monolithic
  // /sitemap.xml, which fanned out to per-city subdivision-count RPCs plus
  // paginated table scans and emitted 10,689 URLs / 2,148,231 bytes in a single
  // prerender. 180 -> 600, then 600 -> 1800 on 2026-07-28 after the build log
  // showed "Failed to build /sitemap.xml/route ... took more than 600 seconds.
  // Retrying again shortly. (attempt 1 of 3)" — three attempts x 600s is ~30
  // minutes burned on one route, and two production deploys were canceled. On
  // 2026-07-30 the same work, running once per class, blew the 1800s ceiling
  // too ("Failed to build /sitemaps/core.xml ... more than 1800 seconds") and
  // silently pinned production to an older commit for days.
  //
  // FIXED AT THE SOURCE, not here. Nothing sitemap-shaped prerenders any more:
  //   - the five per-class children render on FIRST REQUEST and cache for an
  //     hour (app/sitemaps/[cls]/route.ts, dynamicParams = true, 124348de)
  //   - /sitemap.xml is now a <sitemapindex> that does zero data work
  //     (app/sitemaps/index.xml/route.ts, reached via the beforeFiles rewrite)
  //   - app/sitemap.ts, which still owns buildAllUrls, is force-dynamic and is
  //     never prerendered
  //
  // LOWERED 1800 -> 600 on 2026-07-31, per the contract the previous version
  // of this comment recorded ("lower it to 600 only AFTER a green production
  // deploy on this configuration, reading the build log for the slowest
  // prerendered route"). Both conditions were measured, not inferred:
  //   - Vercel deploy history (project prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA):
  //     every production build since the sitemap work left the build path
  //     (commit 846a9268, 2026-07-30) is READY — 15 consecutive across
  //     2026-07-30..31, most recently ca979cee (dpl_ACqmMTche6traz2paf91sYfjqzCN),
  //     zero ERROR states. CANCELED entries in the window are ignoreCommand
  //     skips on docs-only commits, not build failures.
  //   - That deploy's build log: "Build Completed in /vercel/output [4m]" for
  //     the ENTIRE build. /sitemap.xml and /sitemaps/[cls] show as dynamic
  //     (never prerendered); no prerendered route is within an order of
  //     magnitude of 600s.
  // Do NOT raise this again — if a route needs more than 600s it must come
  // off the build path, the way the sitemap routes did (see HISTORY above).
  staticPageGenerationTimeout: 600,
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
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://*.googletagmanager.com https://www.googletagmanager.com https://*.google-analytics.com https://www.google-analytics.com https://www.google.com https://maps.googleapis.com https://maps.gstatic.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.adtrafficquality.google https://connect.facebook.net https://widgetbe.com https://*.widgetbe.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data: https://fonts.gstatic.com https://widgetbe.com https://*.widgetbe.com; connect-src 'self' https://tiles.openfreemap.org https://elevation-tiles-prod.s3.amazonaws.com https://accounts.google.com https://*.supabase.co https://*.google-analytics.com https://www.google-analytics.com https://*.analytics.google.com https://www.google.com https://www.googletagmanager.com https://*.doubleclick.net https://*.adtrafficquality.google https://api.elevenlabs.io https://maps.googleapis.com https://maps.gstatic.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://connect.facebook.net https://www.facebook.com https://*.facebook.com https://analytics.google.com https://widgetbe.com https://*.widgetbe.com; worker-src 'self' blob:; frame-src 'self' https://accounts.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://*.aryeo.com https://*.matterport.com https://*.zillow.com https://drive.google.com https://*.cloudflarestream.com https://*.videodelivery.net https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.google.com https://*.adtrafficquality.google;" },
        ],
      },
      // CMA documents are embedded in a same-origin iframe on the admin review
      // page (/admin/cmas/[slug]). The global DENY above blocks that preview;
      // SAMEORIGIN keeps cross-origin embedding blocked while letting the
      // admin surface frame the document. (Same-key headers: last match wins.)
      { source: '/cma/:slug', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
      // Legacy file-based CMAs live as static assets under /cmas/<slug>/cma.html
      // and /cma/[slug] 302-redirects there — the redirect target needs the
      // same frame policy or the admin preview iframe goes blank for old CMAs.
      { source: '/cmas/:path*', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
      // The BPO review page (/admin/bpo/[slug]) frames its opinion document the
      // same way the CMA page does, and app/bpo/[slug]/route.ts sets SAMEORIGIN
      // on its own response — but the global DENY above is applied over it
      // (same-key headers: last match wins), so the frame has never rendered.
      // Measured 2026-08-07: /bpo/<slug>?variant=full returned DENY and resolved
      // to chrome-error://chromewebdata/ while /cma/<slug> returned SAMEORIGIN
      // and rendered. Cross-origin embedding stays blocked either way.
      { source: '/bpo/:slug', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
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
      // /cities/crooked-river-ranch likewise has no geo_snapshot_mv row (CRR is
      // not a distinct MLS city — its listings file under Terrebonne by
      // SubdivisionName) so the page 404'd. Send it to its real, live community
      // surface instead of dead-ending. Temporary (307) in case CRR gets its own
      // city data + page later. Removed from the city tiers 2026-07-24 — see
      // lib/data/geo/report-cities.ts NON_MLS_CITY_EXEMPTIONS.
      { source: '/cities/crooked-river-ranch', destination: '/communities/crooked-river-ranch', permanent: false },
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
      // Content hub: editorial lives on /blog. Geo chooser is /cities.
      { source: '/guides', destination: '/blog', permanent: true },
      { source: '/guides/:slug', destination: '/blog/:slug', permanent: true },
      // /sell/plan retired 2026-06-04: orphan legacy page (sitemap-only, zero inbound
      // links) carrying an unsourced market stat (CLAUDE.md §0). Superseded by the
      // contracted /sell hub. 301 so any held position transfers rather than 404s.
      { source: '/sell/plan', destination: '/sell', permanent: true },
      { source: '/sign-in', destination: '/login', permanent: true },
      { source: '/sign-in/:path*', destination: '/login/:path*', permanent: true },
      { source: '/agents', destination: '/team', permanent: true },
      { source: '/agents/:slug', destination: '/team/:slug', permanent: true },
      { source: '/reports', destination: '/housing-market/reports', permanent: true },
      // E-CUT: leftover CUT-CANDIDATE public pages fold into living destinations.
      { source: '/area-guides', destination: '/cities', permanent: true },
      { source: '/areas/:slug', destination: '/homes-for-sale', permanent: true },
      { source: '/builders', destination: '/homes-for-sale?newConstruction=1', permanent: true },
      { source: '/builders/:slug', destination: '/homes-for-sale?newConstruction=1', permanent: true },
      { source: '/resources', destination: '/housing-market', permanent: true },
      { source: '/pulse', destination: '/activity', permanent: true },
      // W8.4: the custom-filter explore tool is retired in favor of the
      // pre-generated /housing-market/[geo] reports (with the timeframe selector).
      // Both explore routes redirect to the housing-market hub. ci:no-explore-route
      // enforces the retirement.
      { source: '/reports/explore', destination: '/housing-market', permanent: true },
      { source: '/housing-market/explore', destination: '/housing-market', permanent: true },
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
      { source: '/best-neighborhoods-bend-oregon', destination: '/cities', permanent: true },

      // Landing pages linked/advertised but never built — keep funnel traffic on a
      // live LP instead of a dead end (307: revisit if these LPs ship later).
      { source: '/lp/bend-luxury-concierge', destination: '/lp/bend', permanent: false },
      { source: '/lp/awbrey-butte', destination: '/lp/bend', permanent: false },
      { source: '/lp/woodside-ranch', destination: '/lp/bend', permanent: false },
      // /lp/listings/<key> was never a route; the listing itself lives at /listing/<key>.
      { source: '/lp/listings/:listingKey', destination: '/listing/:listingKey', permanent: true },

      // Removed demo route still drawing traffic → the live Market Pulse page.
      { source: '/pulse-video-demo', destination: '/activity', permanent: true },

      // Admin route moved under the (protected) group.
      { source: '/admin/social', destination: '/admin/analytics/social', permanent: false },
    ];
  },
  async rewrites() {
    return {
      // /sitemap.xml must serve a <sitemapindex> over the five per-class
      // children. Next's metadata convention owns /sitemap.xml whenever
      // app/sitemap.ts exists, and a MetadataRoute.Sitemap can only emit a flat
      // <urlset> — so the index is a route handler and this rewrite points the
      // canonical sitemap URL at it. It MUST stay in beforeFiles: afterFiles
      // rewrites run after filesystem routes, so app/sitemap.ts would win and
      // serve the 10,689-URL monolith again. Pinned by ci:sitemap-resolvable.
      beforeFiles: [
        { source: '/sitemap.xml', destination: '/sitemaps/index.xml' },
      ],
      // Unchanged. A bare array return from rewrites() is afterFiles, so these
      // keep exactly the ordering semantics they had before the split.
      afterFiles: [
      { source: '/homes-for-sale/listing/:listingKey', destination: '/listing/by-key/:listingKey' },
      { source: '/homes-for-sale/:city/:listingSlug([^/]*-[0-9]{5,})', destination: '/listing/by-address/:city/:listingSlug' },
      { source: '/homes-for-sale/:city/:community/:listingSlug([^/]*-[0-9]{5,})', destination: '/listing/by-address/:city/:community/:listingSlug' },
      { source: '/homes-for-sale/:city/:neighborhood/:community/:listingSlug([^/]*-[0-9]{5,})', destination: '/listing/by-address/:city/:neighborhood/:community/:listingSlug' },
      { source: '/homes-for-sale/:city/:community/:listingSlug([^/]*~[^/]*)', destination: '/listing/by-address/:city/:community/:listingSlug' },
      { source: '/homes-for-sale/:city/:neighborhood/:community/:listingSlug([^/]*~[^/]*)', destination: '/listing/by-address/:city/:neighborhood/:community/:listingSlug' },
      { source: '/homes-for-sale', destination: '/search' },
      { source: '/homes-for-sale/:path*', destination: '/search/:path*' },
      ],
    };
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
  // preview deployments). The pdfjs worker is a dynamic import inside
  // pdf.mjs (`webpackIgnore: true`) so NFT never sees it. Without this
  // include, assertPdfPageSafety dies on Vercel after the PDF has already
  // rendered ("Cannot find module .../pdf.worker.mjs").
  outputFileTracingIncludes: {
    'app/api/cma/[slug]/pdf/route': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
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
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      './public/drafts/cma-*/cma.html',
      './public/drafts/cma-*/assets/*.png',
      './public/drafts/cma-*/assets/*.jpg',
      './public/drafts/cma-*/assets/*.otf',
      './public/cmas/cma-*/cma.html',
      './public/cmas/cma-*/assets/*.png',
      './public/cmas/cma-*/assets/*.jpg',
      './public/cmas/cma-*/assets/*.otf',
    ],
    'app/api/cma/[slug]/gmail-draft/route': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    ],
    'app/api/reports/export/route': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    ],
    'app/home-valuation/actions': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    ],
  },
}

export default nextConfig
