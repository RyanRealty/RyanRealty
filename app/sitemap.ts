import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { cityEntityKey, cityNeighborhoodPath, listingsBrowsePath, teamPath, valuationPath } from '../lib/slug'
import { finalizeSitemapEntries } from '../lib/sitemap-guard'
import { LLMS_ZIPS } from '@/lib/site/llms-geo'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { getIndexablePresetSlugs } from '../lib/search-presets'
import { isBendNewConstructionSearchTwinPath } from '@/lib/routing/bend-new-construction-search-twin'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'

// Public sitemap — Coming Soon is excluded by policy. See
// lib/listing-status-public.ts. Never submit a pre-marketing listing to Google.

import { fetchAllRows } from '@/lib/supabase/paginate'
import { CENTRAL_OREGON_CITY_SLUGS, isCentralOregonCity, SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { publicCommunitySlug } from '@/lib/communities/community-public-pair'
import { selfCitySearchUrlLeavesSitemap } from '@/lib/communities/self-city-community'
import { redirectsAwayFromSearch } from '@/lib/search/publish-place-browse-href'
import { getAllNeighborhoodsWithCity } from '@/lib/data'
import { getIndexableSubdivisions } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { subdivisionSitemapUrls } from '@/lib/data/subdivisions/subdivision-index'
import { getBrowsePairSitemapPaths } from '@/lib/seo/getBrowsePairDecision'
import { cityPresetTypeTwin, placeTypeSitemapPaths } from '@/lib/seo/place-type-twin'
import {
  getSearchMatrixSitemapEntries,
  getMatrixCityPresetDecisionSet,
  matrixCityPresetNoIndexFromSet,
} from '@/lib/seo/getSearchMatrixEntries'
import { getOutOfAreaCitySitemapEntries } from '@/lib/data/geo/getOutOfAreaCities'
import { getListingSitemapRows } from '@/lib/data/sitemap/getListingSitemapRows'
import { listPublishedEditions, type EditionListItem } from '@/lib/data/market-report/editions'
import { CO_EVENTS } from '@/data/co-events'
import { CO_VENUES } from '@/data/co-venues'
import { GOLF_COURSES } from '@/data/golf/courses'
import { CO_TRAILS } from '@/data/co-trails'
import { CO_SCHOOLS } from '@/data/co-schools'
import { CO_PARKS } from '@/data/co-parks'
import { CORE_MARKET_PATHS } from '@/app/housing-market/[...slug]/_v3/geo-constants'

// The ONLY slugs with a real /communities/[slug] page — derived directly from
// the curated resort registry (data/resort-communities.json) so the sitemap
// CANNOT drift from it (a hardcoded copy here sat at 14 slugs while the
// registry grew to 19 — five live pages were never submitted to Google).
// The old code before that emitted every row of the `communities` table,
// which included ~31 junk subdivision slugs ("Industrial, Madras Oregon").
const RESORT_COMMUNITY_SLUGS: string[] = getAllResortCommunities().map((c) => publicCommunitySlug(c))

// The (city, subdivision) browse-pair floor that lived here
// (SUBDIVISION_SITEMAP_MIN_LIFETIME_LISTINGS = 3, every status) is retired
// (visibility audit 2026-09-22, EXP-2): it submitted pages with no listing and
// no sold history to show. The emission rule is now the shared browse-pair
// decision (lib/seo/browse-pair-decision.ts, BROWSE_PAIR_MIN_LIFETIME_SALES),
// which the search route's robots and canonical read too.

/**
 * NOT THE SERVED SITEMAP ANY MORE — this file is the URL-UNIVERSE BUILDER.
 *
 * buildAllUrls() below is the single source of every public URL. The per-class
 * children at /sitemaps/{core|geo|listings|matrix|content}.xml consume it, and
 * /sitemap.xml serves a <sitemapindex> over those children
 * (app/sitemaps/index.xml/route.ts, via the beforeFiles rewrite in next.config).
 *
 * WHY (2026-07-30): the flat urlset this used to serve reached 10,689 URLs /
 * 2,148,231 bytes, built from per-city subdivision RPCs plus paginated scans.
 * Prerendering it blew Vercel's per-route ceiling twice (600s on 2026-07-28,
 * then 1800s on 2026-07-30 once the same work ran once per class) and both
 * times production silently pinned to an older commit. Nothing sitemap-shaped
 * prerenders now: the children render on first request (124348de), and the
 * route config below keeps this one off the build path.
 *
 * The default export stays only because Next's metadata convention requires one
 * (a sitemap.ts without it is a build error). The rewrite claims /sitemap.xml
 * first, so it is unreachable in normal operation and survives as a
 * correct-but-slow fallback. Do NOT delete it or point crawlers back at it.
 */

// Never prerender: `revalidate` alone put the whole buildAllUrls fan-out on the
// build critical path, which is the failure described above.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const now = new Date()
  return buildAllUrls(baseUrl, now)
}

/**
 * Build the complete list of sitemap URLs. Called once per chunk request.
 * In production with caching (revalidate: 3600), this is efficient enough.
 *
 * Exported for the per-class child sitemaps at /sitemaps/[cls] (westside
 * backlog #5) — same URL universe, bucketed by lib/data/sitemap/classify.ts,
 * so GSC reports indexed counts per class. The monolith at /sitemap.xml
 * stays authoritative and unchanged.
 */
export async function buildAllUrls(baseUrl: string, now: Date): Promise<MetadataRoute.Sitemap> {
  // Sanctioned 2-segment /cities/{a}/{b} paths (from the neighborhoods table);
  // filterRogueCityUrls drops any 2-seg /cities URL not in this set before serve.
  const allowedNeighborhoodPaths = new Set<string>()
  // Static pages — always included even without database
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}${listingsBrowsePath()}`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    // /luxury-homes-bend 301s onto /homes-for-sale/bend/luxury (SITE-185), which
    // the city x preset loop below emits; a sitemap lists canonicals.
    { url: `${baseUrl}/communities`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/cities`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/neighborhoods`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/subdivisions`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    // Crawlable directory of every browse-URL family (W3.4 internal-link layer).
    { url: `${baseUrl}/site-index`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
    { url: `${baseUrl}${teamPath()}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/central-oregon/events`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/central-oregon/venues`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/central-oregon/trails`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/central-oregon/golf`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/schools`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/parks`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/housing-market`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/months-of-supply`, lastModified: now, changeFrequency: 'weekly', priority: 0.55 },
    { url: `${baseUrl}/how-we-get-our-numbers`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/new-construction`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    // SITE-178: /housing-market/central-oregon is noindex,follow (report twin).
    { url: `${baseUrl}/housing-market/reports`, lastModified: now, changeFrequency: 'daily', priority: 0.65 },
    // Per-city market pages (mirror the generateStaticParams list in
    // app/housing-market/[...slug]/page.tsx) — the section's main organic
    // asset; without these entries they were crawl-discovery only.
    // Each is its canonical URL: a registry community's market page is its
    // community-grain path (/housing-market/sisters/black-butte-ranch), never
    // the one-segment twin that 301s there (lib/market/canonical-market-path).
    ...CORE_MARKET_PATHS.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    { url: `${baseUrl}/open-houses`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    // /activity and /buy are not listed: both 301 (to /housing-market and
    // /homes-for-sale) since UXLIVE-8, and a sitemap never submits a redirect.
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/sell`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}${valuationPath()}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    // Sell + buy intent pages (indexable, proper metadata) — added so the
    // long-tail intent landing pages are crawlable.
    { url: `${baseUrl}/sell/for-sale-by-owner`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/sell/expired-listings`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/buy/first-time-home-buyer`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/buy/relocation`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/buy/investment`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/our-homes`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    // Every active Central Oregon commercial lease (Matt 2026-09-23).
    { url: `${baseUrl}/commercial-space-for-lease`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    // NOTE: /compare, every /lp page, and /feed are not sitemapped.
    // /lp/* declare robots:{index:false} (IA lock: paid-arrival, off the organic
    // graph). /feed 301s to /videos?view=feed. Listing them wasted crawl budget
    // and triggered Search Console "submitted but noindex" warnings.
    { url: `${baseUrl}/videos`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/tools/mortgage-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/tools/rental-property-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/tools/appreciation`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/reviews`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/join`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/newsletter`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/refer-a-client`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/accessibility`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/fair-housing`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/dmca`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  // Central Oregon event detail pages — registry-driven (data/co-events.ts), so
  // they belong in the static set (crawlable even on the no-DB early return).
  // lastModified is the verified date, not now(), so freshness is honest (§0).
  for (const event of CO_EVENTS) {
    staticPages.push({
      url: `${baseUrl}/central-oregon/events/${event.slug}`,
      lastModified: event.lastVerified,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }
  for (const venue of CO_VENUES) {
    staticPages.push({
      url: `${baseUrl}/central-oregon/venues/${venue.slug}`,
      lastModified: venue.lastVerified,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }
  // Per-course golf detail pages (data/golf/courses.ts). There is no organic
  // golf index route; the paid golf LP is noindex and is not submitted.
  for (const course of GOLF_COURSES) {
    staticPages.push({
      url: `${baseUrl}/central-oregon/golf/${course.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }
  for (const trail of CO_TRAILS) {
    staticPages.push({
      url: `${baseUrl}/central-oregon/trails/${trail.slug}`,
      lastModified: trail.lastVerified,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }
  // School + park detail pages — registry-driven (data/co-schools.ts,
  // data/co-parks.ts), same pattern as golf/trails. Neither registry carries a
  // lastVerified date, so lastModified follows the GOLF_COURSES idiom.
  for (const school of CO_SCHOOLS) {
    staticPages.push({
      url: `${baseUrl}/schools/${school.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }
  for (const park of CO_PARKS) {
    staticPages.push({
      url: `${baseUrl}/parks/${park.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }

  // Price Drop Radar -- pillar + per-city pages (daily-crawl magnet)
  staticPages.push({
    url: `${baseUrl}/price-drops`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.85,
  })
  for (const citySlug of SITE_CITY_SLUGS) {
    staticPages.push({
      url: `${baseUrl}/price-drops/${citySlug}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    })
  }

  // /motivated-sellers + /motivated-sellers/<city> are NOT submitted (removed
  // 2026-08-19). next.config.ts 308s all 11 of them onto the /price-drops pages
  // already listed above — verified on production: /motivated-sellers/bend ->
  // 308 /price-drops/bend. A sitemap lists canonical 200 URLs; submitting a
  // redirect source spends crawl budget to land on a page already in the file.

  // City tier — seed from the canonical list of cities that have a real page, so
  // every best-schema city hub is ALWAYS in the sitemap regardless of live
  // inventory or a dynamic-section timeout (the listings query can be heavy).
  for (const citySlug of SITE_CITY_SLUGS) {
    staticPages.push(
      { url: `${baseUrl}/cities/${citySlug}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
      // SITE-187: a self-city community's plain search page canonicals to
      // /communities/<slug> (already listed below); a sitemap lists canonicals.
      ...(selfCitySearchUrlLeavesSitemap(citySlug)
        ? []
        : [{ url: `${baseUrl}/homes-for-sale/${citySlug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.85 }]),
      { url: `${baseUrl}/open-houses/${citySlug}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    )
  }

  // If Supabase is not configured, return only static pages — still through the
  // rogue-/cities backstop (allow-set is empty here, so any 2-segment /cities URL
  // is dropped) so the no-DB path can't emit one either.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseKey) {
    return finalizeSitemapEntries(staticPages, allowedNeighborhoodPaths)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const dynamicPages: MetadataRoute.Sitemap = []

  // ── the build deadline (SITE-54, 2026-09-09) ──────────────────────────────
  //
  // Every leg below is a database read, and until this change a single slow one
  // could consume the route's entire maxDuration=300 budget. That is what
  // happened: the per-city subdivision leg threw hundreds of 8s-bound queries at
  // a database that was mid-REFRESH, and /sitemaps/geo.xml returned 504 'Task
  // timed out after 300 seconds' twice on 2026-09-09 — no headers, no bytes, no
  // log line naming the leg. A 504 tells Google nothing at all.
  //
  // So the legs share a deadline instead. A leg that overruns it resolves to its
  // own empty fallback with a `[withTimeoutFallback:sitemap:<leg>]` warning
  // naming it, every later leg gets the 1s floor and falls back fast, and the
  // response is an HONEST PARTIAL that says in the log exactly what is missing.
  // A partial sitemap is a smaller crawl map; a 504 is no crawl map.
  //
  // 210s leaves ~90s of the 300s ceiling for serialization and the response.
  // SITEMAP_BUILD_BUDGET_MS overrides it for local measurement.
  const buildBudgetMs = Number(process.env.SITEMAP_BUILD_BUDGET_MS ?? 210_000)
  const deadlineAt = Date.now() + buildBudgetMs
  /** Whatever is left of the shared budget, never less than 1s. */
  const remainingMs = () => Math.max(1_000, deadlineAt - Date.now())
  /** Run one leg under the shared deadline; on overrun, log and fall back. */
  const legMs: string[] = []
  const leg = <T,>(label: string, work: Promise<T>, fallback: T): Promise<T> => {
    const startedAt = Date.now()
    return withTimeoutFallback(work, fallback, remainingMs(), `sitemap:${label}`).finally(() => {
      legMs.push(`${label}=${Date.now() - startedAt}ms`)
    })
  }

  try {
    // Every leg is an independent read (none takes another's result), so all
    // of them START here, together, and the body below awaits each where it
    // is used. Run one after another they cost the SUM of the legs: 44.8s cold
    // from a sandbox on 2026-09-24 (matrix-city-preset-decision 18.4s,
    // search-matrix 10.4s, listing-rows 5.0s, cities 4.4s, ...), which is what
    // put /sitemaps/core.xml, geo.xml and matrix.xml past the crawl probe's 20s
    // budget on every cold build. Started together they cost the slowest one.
    // The shared deadline above still bounds each.
    const subdivisionCitySlugs = [...CENTRAL_OREGON_CITY_SLUGS]
    const started = {
      // The city list reads listing_search_mv (maintained incrementally since
      // 2026-09-24), not raw `listings`. The raw scan paged 589K rows through an
      // ilike OR with no index behind it: 13.7s from the sandbox and 18.7s in
      // production's cold build (the whole build's critical path), and it came
      // back with exactly 7,000 rows because fetchAllRows stops on a page that
      // errors. The table read is 1.3s, 7,485 rows, and the same 18 Central
      // Oregon cities (compared 2026-09-25).
      'cities': leg(
        'cities',
        fetchAllRows<{ city?: string | null }>(
          supabase, 'listing_search_mv', 'city',
          (q) => q.in('standard_status', PUBLIC_ACTIVE_STATUSES).not('city', 'is', null).order('listing_key', { ascending: true }),
        ).then((rows) => rows.map((r) => ({ City: r.city ?? null }))),
        SITE_CITY_SLUGS.map((slug) => ({ City: slug })) as Array<{ City?: string | null }>,
      ),
      'matrix-city-preset-decision': leg(
        'matrix-city-preset-decision',
        getMatrixCityPresetDecisionSet(),
        null as Awaited<ReturnType<typeof getMatrixCityPresetDecisionSet>>,
      ),
      'subdivision-browse-pairs': leg(
        'subdivision-browse-pairs',
        getBrowsePairSitemapPaths(subdivisionCitySlugs),
        [] as string[],
      ),
      'indexable-subdivisions': leg('indexable-subdivisions', getIndexableSubdivisions(), []),
      'neighborhoods': leg('neighborhoods', getAllNeighborhoodsWithCity(), []),
      'search-matrix': leg('search-matrix', getSearchMatrixSitemapEntries(baseUrl, now), []),
      'out-of-area-cities': leg('out-of-area-cities', getOutOfAreaCitySitemapEntries(), []),
      'brokers': leg(
        'brokers',
        fetchAllRows<{ slug: string; updated_at?: string }>(
          supabase, 'brokers', 'slug, updated_at',
          (q) => q.eq('is_active', true),
        ),
        [] as Array<{ slug: string; updated_at?: string }>,
      ),
      'listing-rows': leg('listing-rows', getListingSitemapRows(now), []),
      'blog-posts': leg(
        'blog-posts',
        fetchAllRows<{ slug: string; published_at?: string | null }>(
          supabase, 'blog_posts', 'slug, published_at',
          (q) => q.eq('status', 'published'),
        ),
        [] as Array<{ slug: string; published_at?: string | null }>,
      ),
      'market-reports': leg(
        'market-reports',
        fetchAllRows<{ slug: string; created_at?: string | null }>(
          supabase, 'market_reports', 'slug, created_at',
        ),
        [] as Array<{ slug: string; created_at?: string | null }>,
      ),
    }

    // Cities — paginate to get ALL cities (Supabase caps at 1,000 per request).
    // Fallback is the ten seeded site cities, not []: this raw-listings scan hit
    // the statement timeout 11 times in 24h on 2026-09-22, and an empty
    // fallback silently dropped every /cities, /homes-for-sale/{city}/{preset}
    // and /open-houses family from that hour's sitemap (visibility audit,
    // DATA-4). cityEntityKey is slugify(), so a slug maps to itself.
    const cityRows = await started['cities']

    const cities = Array.from(
      new Set(
        ((cityRows ?? []) as Array<{ City?: string | null }>)
          .map((row) => (row.City ?? '').trim())
          // Central Oregon service area only — keep out-of-area cities (Medford,
          // Ashland, Klamath Falls, ...) out of the sitemap so Google doesn't
          // crawl + index 404'ing pages. Also scopes the per-city subdivision loop.
          .filter((city) => city.length > 0 && isCentralOregonCity(city))
      )
    )

    // The city x preset noindex decision, resolved ONCE (SITE-54, 2026-09-09).
    //
    // The loop below used to call getMatrixCityPresetNoIndex(key, preset) —
    // one `await` per combo — for up to 24 cities x 45 presets = ~1,080 calls.
    // getSearchMatrix() is React `cache()`-wrapped to dedupe within one call
    // tree, but buildAllUrls() runs inside unstable_cache's revalidation
    // context (lib/sitemap-class-rows.ts), which is not the request-scoped
    // AsyncLocalStorage `cache()` dedupes against. Measured directly against
    // production: each combo independently rebuilt the matrix
    // (assembleSearchMatrix -> getSearchMatrixInventory, ~8.3s per rebuild —
    // confirmed with a standalone timed read of listing_search_mv). At ~8.3s
    // a combo, the first ~25 silently consumed the whole 210s leg budget and
    // every combo after that hit the exhausted-budget 1s floor and still
    // couldn't finish inside it — /sitemaps/geo.xml (which shares
    // buildAllUrls with every class) never returned within maxDuration 300.
    //
    // getMatrixCityPresetDecisionSet() resolves the same matrix once; the
    // loop then does a synchronous Set lookup per combo
    // (matrixCityPresetNoIndexFromSet), same classification, same output.
    const matrixCityPresetDecision = await started['matrix-city-preset-decision']

    for (const city of cities) {
      const key = cityEntityKey(city)
      dynamicPages.push(
        { url: `${baseUrl}/cities/${key}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
        ...(selfCitySearchUrlLeavesSitemap(key)
          ? []
          : [{ url: `${baseUrl}/homes-for-sale/${key}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.85 }]),
        { url: `${baseUrl}/open-houses/${key}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
      )

      // Preset filter pages per city. Sort-only presets (price-low-to-high /
      // price-high-to-low) are excluded — they render the same inventory as the
      // city page reordered (duplicate content), and the search page marks them
      // noindex, so submitting them would only trigger "submitted but noindex".
      const presetSlugs = getIndexablePresetSlugs()
      for (const preset of presetSlugs) {
        // W3.1: skip a {city}/{preset} combo with a VERIFIED zero city-wide count
        // (§0 — the search page noindexes it too; unknown states fail OPEN).
        // Fails OPEN on a failed/never-resolved matrix read, exactly as
        // before: an unknown inventory state emits the URL rather than
        // silently dropping a live page from the sitemap.
        if (matrixCityPresetNoIndexFromSet(matrixCityPresetDecision, key, preset)) continue
        // SITE-179: Bend new-construction lives at /new-construction.
        if (isBendNewConstructionSearchTwinPath(`/homes-for-sale/${key}/${preset}`)) continue
        // EXP-6: a type preset with verified inventory canonicalizes to
        // /cities/{city}/types/{type}; the types leg below submits that page
        // instead (lib/seo/place-type-twin.ts — the search route's metadata
        // reads the same rule).
        if (cityPresetTypeTwin(key, preset, matrixCityPresetDecision?.positiveCityPresets ?? null)) continue
        dynamicPages.push({
          url: `${baseUrl}/homes-for-sale/${key}/${preset}`,
          lastModified: now,
          changeFrequency: 'daily',
          priority: 0.8,
        })
      }
    }

    // Place-type pages (EXP-6): /cities/{city}/types/{type} and
    // /communities/{community}/types/{type}, each only with a VERIFIED positive
    // active count from the same matrix decision set as the preset loop above,
    // so a type page is submitted exactly when its preset twin is not. A failed
    // matrix read submits none (the twins then stay in, fail-open as before).
    for (const path of placeTypeSitemapPaths(cities.map((c) => cityEntityKey(c)), matrixCityPresetDecision)) {
      dynamicPages.push({ url: `${baseUrl}${path}`, lastModified: now, changeFrequency: 'daily', priority: 0.75 })
    }

    // Communities — ONLY the curated resort registry (slugs with a real page).
    // Was: every `communities` table row, which leaked ~31 junk subdivision slugs
    // that render fabricated "Industrial, Madras Oregon" pages.
    for (const slug of RESORT_COMMUNITY_SLUGS) {
      dynamicPages.push({
        url: `${baseUrl}/communities/${slug}`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.8,
      })
    }

    // Subdivision browse pairs (/homes-for-sale/{city}/{sub}). Emitted exactly
    // when the SHARED browse-pair decision says so
    // (lib/seo/browse-pair-decision.ts — the search route's robots and
    // canonical read the same function, so a submitted pair is always
    // indexable and self-canonical). Visibility audit 2026-09-22 (EXP-2,
    // EXP-4, SEO-6). The live MVs run through this code on 2026-09-23, against
    // the 1,815 browse locs the live geo.xml carried under the old floor (>= 3
    // lifetime listings of any status; 1,051 of them had nothing for sale):
    // 748 stay; 662 plat twins of the same place (same city; 16 across a word
    // break) now carry rel=canonical to /subdivisions/{plat slug}, 17 community
    // twins to /communities/{slug}, 146 carry an MLS code as their only name,
    // 179 have no listing for sale and under 10 sales on record, 61 have
    // listings but under 10 sales (indexable while they do, never submitted),
    // and 2 are neighborhood slugs finalizeSitemapEntries already drops. What
    // stays is every pair with >= BROWSE_PAIR_MIN_LIFETIME_SALES (10) closed sales under
    // its name: a page that always has content (the listings when there are
    // any, the sold-history section always), and a set decided on LIFETIME
    // depth, so it still does not flap as listings come and go — the reason
    // the old comment here gave for counting every status (active-only
    // sourcing dropped a subdivision URL the day its last listing closed).
    // City scoping stays on the CENTRAL_OREGON_CITY_SLUGS allowlist, so a city
    // with zero actives keeps its pairs.
    // /cities/{city}/{sub} is deliberately NOT emitted here: that route only
    // resolves for boundary-neighborhood rows (anything else 404s), and
    // submitting 404s poisons the programmatic-page quality signal. The
    // neighborhood URLs are emitted below from the table the page resolves.
    //
    // Pairs come from public.subdivision_city_inventory_mv — ONE filtered read
    // of 2,216 pre-counted rows (the 24 Central Oregon city_lower values out of
    // the MV's 6,885; measured 2026-09-09) in 929 ms cold (SITE-54).
    //
    // Two sources ago this was get_subdivision_status_counts(p_city), whose
    // `TRIM("City") ILIKE TRIM(p_city)` forced a sequential scan of the
    // 589K-row listings table per city (104.7s for eight cities, 2026-08-02).
    // The fix for that read listing_tile_mv directly instead — correct, but it
    // paged the whole HISTORY view per city through PostgREST (Bend ~129,192
    // rows, 32.7s for the 24-city set) against an 8s statement timeout, while
    // pg_cron job 164 holds that view under REFRESH ... CONCURRENTLY for 13-21
    // minutes of every 30-minute slot overnight. Grouped by query_id over 24h
    // it was the single largest statement-timeout source on the database
    // (19,655 + 1,136), it took listing detail, tiles and blog down with it
    // through the connection pool, and it is why /sitemaps/geo.xml returned
    // 504 'Task timed out after 300 seconds' twice on 2026-09-09.
    //
    // The aggregate now happens once a night inside the MV. Same rows, same
    // classification (classifyLifetimeBuckets) — see
    // lib/data/subdivisions/getSubdivisionCityInventory.ts.
    const browsePairPaths = await started['subdivision-browse-pairs']
    for (const path of browsePairPaths) {
      // SITE-183 / SITE-182: a registry community's area twin
      // (/homes-for-sale/bend/broken-top) 301s onto the community page,
      // which the resort loop above already lists. A sitemap lists
      // canonicals, never a redirect source.
      if (redirectsAwayFromSearch(path)) continue
      dynamicPages.push({ url: `${baseUrl}${path}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 })
    }

    // Subdivision DETAIL pages (/subdivisions/[slug]) — the plat-boundary pages
    // (W2.1 light-up). A plat earns a sitemap slot with a GIS polygon AND
    // >= SUBDIVISION_INDEX_MIN_LIFETIME_SALES lifetime closed sales — the
    // shared set in lib/data/subdivisions/ that llms.txt also enumerates and
    // the page's noindex decision reads (parity pinned by
    // lib/data/subdivisions/subdivision-index.test.ts). Distinct from the
    // browse-pair floor above: detail pages carry the sold-history section, so
    // they earn indexation with real sold depth, not a listing trickle.
    // Since 2026-09-23 (Matt: multi-phase subdivisions grouped under one main
    // page; SEO-7) the same set also carries each plat FAMILY's main page
    // (/subdivisions/ridge-at-eagle-crest) and leaves out a plat recorded under
    // a city, neighborhood or community name (/subdivisions/bend, /sisters,
    // /la-pine). Nothing to change here: the set decides, this leg submits it.
    const indexableSubdivisions = await started['indexable-subdivisions']
    for (const url of subdivisionSitemapUrls(indexableSubdivisions, baseUrl)) {
      dynamicPages.push({
        url,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }

    // Neighborhood pages — /cities/{city}/{neighborhood} resolves ONLY for
    // rows in the neighborhoods table; emit exactly those.
    const neighborhoodRows = await started['neighborhoods']
    for (const n of neighborhoodRows) {
      const cityRel = Array.isArray(n.cities) ? n.cities[0] : n.cities
      const citySlug = cityRel?.slug
      if (!citySlug || !n.slug) continue
      // Sole sanctioned 2-seg /cities emission (named helper); record it so
      // filterRogueCityUrls allows exactly these and drops any other.
      const neighborhoodPath = cityNeighborhoodPath(citySlug, n.slug)
      allowedNeighborhoodPaths.add(neighborhoodPath)
      dynamicPages.push({
        url: `${baseUrl}${neighborhoodPath}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }

    // Search-matrix combos (W3.2) — 3-segment /homes-for-sale/{city}/{area}/{preset}
    // URLs for curated geos, emitted only with >= 1 verified active listing AND
    // depth content. Returns [] when the cached inventory read fails, so a
    // transient DB error thins the sitemap instead of fabricating entries.
    dynamicPages.push(
      ...(await started['search-matrix']),
    )

    // Out-of-area referral-tier city pages (W12) — only the indexable top set
    // (>= 5 active listings, top 25 by active count); every other out-of-area
    // city renders noindex and is never emitted.
    dynamicPages.push(...(await started['out-of-area-cities']))

    // Team members
    const brokers = await started['brokers']

    for (const b of brokers) {
      dynamicPages.push({
        url: `${baseUrl}${teamPath(b.slug)}`,
        lastModified: b.updated_at ? new Date(b.updated_at) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }

    // Listings — first-class ordered read of listing_tile_mv. Do not page this
    // MV with fetchAllRows (no ORDER BY): unordered OFFSET pages returned
    // 7,586 rows / 5,827 unique keys on 2026-08-19, so 1,759 live listings
    // never reached listings.xml. Paths use listingTileHref so locs match
    // the listing-page canonical.
    const listingRows = await started['listing-rows']
    for (const r of listingRows) {
      dynamicPages.push({
        url: `${baseUrl}${r.path}`,
        lastModified: new Date(r.lastModified),
        changeFrequency: 'daily',
        priority: 0.7,
      })
    }

    // ZIP codes — exactly the ZIPs the route serves. app/zip/[zip] is
    // dynamicParams=false over CANONICAL_ZIPS (10 ZIPs), so anything else
    // 404s. Until 2026-09-22 this leg enumerated every PostalCode with an
    // active listing statewide by scanning raw `listings` (a query that hit
    // the statement timeout 42 times in 24h and then silently dropped the
    // whole family), which submitted 105 URLs that returned 404 (visibility
    // audit 2026-09-22, EXP-5 / DATA-4). LLMS_ZIPS is pinned byte-identical
    // to CANONICAL_ZIPS by lib/site/llms-geo.test.ts and is server-safe.
    const zips = LLMS_ZIPS.map((z) => z.zip)
    for (const zip of zips) {
      dynamicPages.push({
        url: `${baseUrl}/zip/${zip}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }

    // Blog posts — paginate
    const posts = await started['blog-posts']

    for (const p of posts) {
      dynamicPages.push({
        url: `${baseUrl}/blog/${p.slug}`,
        lastModified: p.published_at ? new Date(p.published_at) : now,
        changeFrequency: 'monthly',
        priority: 0.6,
      })
    }

    // /guides permanently redirects to /blog — do not emit a guides URL family.

    // Market reports — restored 2026-06-01 (the HTTP 500 was jsdom failing to
    // load in serverless; fixed in lib/sanitize.ts, pages now 200).
    const reports = await started['market-reports']
    for (const r of reports) {
      dynamicPages.push({
        url: `${baseUrl}/housing-market/reports/${r.slug}`,
        lastModified: r.created_at ? new Date(r.created_at) : now,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }

    // Monthly market report: the archive and every published edition. Read
    // through the DAL (published rows only), so a draft or held month is never
    // submitted, and the archive is listed only once it has an edition (it is
    // noindex while empty).
    const editions = await leg(
      'market-report-editions',
      listPublishedEditions(),
      [] as EditionListItem[],
    )
    if (editions.length > 0) {
      const newest = editions[0]?.published_at
      dynamicPages.push({
        url: `${baseUrl}/housing-market/reports/monthly`,
        lastModified: newest ? new Date(newest) : now,
        changeFrequency: 'monthly',
        priority: 0.7,
      })
      for (const e of editions) {
        dynamicPages.push({
          url: `${baseUrl}/housing-market/reports/monthly/${e.edition_month.slice(0, 7)}`,
          lastModified: e.published_at ? new Date(e.published_at) : now,
          changeFrequency: 'yearly',
          priority: 0.5,
        })
      }
    }
  } catch (e) {
    console.error('[sitemap] Error generating dynamic pages:', e)
    // Return static pages only if database query fails
  }
  // One line per universe build naming each leg's wall time, so a slow
  // sitemap names its slow read in the runtime log (crawl probe 2026-09-24).
  console.log(`[sitemap] universe build ${Date.now() - (deadlineAt - buildBudgetMs)}ms: ${legMs.join(' ')}`)

  // Output-based drift backstop: drop any non-sanctioned 2-seg /cities URL,
  // however built (template/concat/join/aliased), drop the browse twin of
  // every neighborhood (/homes-for-sale/{city}/{slug} 301s to the neighborhood
  // page), and emit each URL once (the static seed and the city loop both
  // pushed /cities/{c}, /homes-for-sale/{c}, /open-houses/{c}: 30 duplicates
  // on 2026-09-22). Inspects final URL strings.
  return finalizeSitemapEntries([...staticPages, ...dynamicPages], allowedNeighborhoodPaths)
}
