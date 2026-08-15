import type { MetadataRoute } from 'next'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cityEntityKey, cityNeighborhoodPath, listingDetailPath, listingsBrowsePath, slugify, teamPath, valuationPath } from '../lib/slug'
import { filterRogueCityUrls } from '../lib/sitemap-guard'
import { getIndexablePresetSlugs } from '../lib/search-presets'
import { PUBLIC_ACTIVE_STATUSES, PUBLIC_ACTIVE_OR_PREDICATE } from '@/lib/listing-status-public'

// Public sitemap — Coming Soon is excluded by policy. See
// lib/listing-status-public.ts. Never submit a pre-marketing listing to Google.
const ACTIVE_STATUS_OR = PUBLIC_ACTIVE_OR_PREDICATE

import { fetchAllRows } from '@/lib/supabase/paginate'
import { CENTRAL_OREGON_CITY_SLUGS, isCentralOregonCity, SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { getAllNeighborhoodsWithCity } from '@/lib/data'
import { getIndexableSubdivisions } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { subdivisionSitemapUrls } from '@/lib/data/subdivisions/subdivision-index'
import { getSubdivisionBrowseSlugsByCity } from '@/lib/data/subdivisions/getSubdivisionBrowseSlugsByCity'
import { getSearchMatrixSitemapEntries, getMatrixCityPresetNoIndex } from '@/lib/seo/getSearchMatrixEntries'
import { getOutOfAreaCitySitemapEntries } from '@/lib/data/geo/getOutOfAreaCities'
import { CO_EVENTS } from '@/data/co-events'
import { CO_VENUES } from '@/data/co-venues'
import { GOLF_COURSES } from '@/data/golf/courses'
import { CO_TRAILS } from '@/data/co-trails'
import { CO_SCHOOLS } from '@/data/co-schools'
import { CO_PARKS } from '@/data/co-parks'

// The ONLY slugs with a real /communities/[slug] page — derived directly from
// the curated resort registry (data/resort-communities.json) so the sitemap
// CANNOT drift from it (a hardcoded copy here sat at 14 slugs while the
// registry grew to 19 — five live pages were never submitted to Google).
// The old code before that emitted every row of the `communities` table,
// which included ~31 junk subdivision slugs ("Industrial, Madras Oregon").
const RESORT_COMMUNITY_SLUGS: string[] = getAllResortCommunities().map((c) => c.slug)

// Lifetime-listing floor for a (city, subdivision) browse URL to earn a
// sitemap slot. The threshold counts every status bucket (active + pending +
// closed), so a subdivision with real sold history KEEPS its URL after the
// last active listing closes — active-only sourcing made these pages
// evaporate from the index between listings, exactly when their sold-history
// content is the page's value.
const SUBDIVISION_SITEMAP_MIN_LIFETIME_LISTINGS = 3

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
    { url: `${baseUrl}/luxury-homes-bend`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
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
    { url: `${baseUrl}/schools`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/parks`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/housing-market`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/housing-market/central-oregon`, lastModified: now, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${baseUrl}/housing-market/reports`, lastModified: now, changeFrequency: 'daily', priority: 0.65 },
    // Per-city market pages (mirror the generateStaticParams list in
    // app/housing-market/[...slug]/page.tsx) — the section's main organic
    // asset; without these entries they were crawl-discovery only.
    ...[
      'bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'tumalo',
      'prineville', 'terrebonne', 'black-butte-ranch', 'eagle-crest', 'crooked-river-ranch',
    ].map((slug) => ({
      url: `${baseUrl}/housing-market/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    { url: `${baseUrl}/open-houses`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/activity`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/sell`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}${valuationPath()}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/buy`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    // Sell + buy intent pages (indexable, proper metadata) — added so the
    // long-tail intent landing pages are crawlable.
    { url: `${baseUrl}/sell/for-sale-by-owner`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/sell/expired-listings`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/sell/inherited-home`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/buy/first-time-home-buyer`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/buy/relocation`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/buy/investment`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/our-homes`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
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

  // Motivated sellers -- pillar + per-city pages
  staticPages.push({
    url: `${baseUrl}/motivated-sellers`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  })
  for (const citySlug of SITE_CITY_SLUGS) {
    staticPages.push({
      url: `${baseUrl}/motivated-sellers/${citySlug}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.75,
    })
  }

  // City tier — seed from the canonical list of cities that have a real page, so
  // every best-schema city hub is ALWAYS in the sitemap regardless of live
  // inventory or a dynamic-section timeout (the listings query can be heavy).
  for (const citySlug of SITE_CITY_SLUGS) {
    staticPages.push(
      { url: `${baseUrl}/cities/${citySlug}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
      { url: `${baseUrl}/homes-for-sale/${citySlug}`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
      { url: `${baseUrl}/open-houses/${citySlug}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    )
  }

  // If Supabase is not configured, return only static pages — still through the
  // rogue-/cities backstop (allow-set is empty here, so any 2-segment /cities URL
  // is dropped) so the no-DB path can't emit one either.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseKey) {
    return filterRogueCityUrls(staticPages, allowedNeighborhoodPaths)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const dynamicPages: MetadataRoute.Sitemap = []

  try {
    // Community -> neighborhood lookup for canonical listing paths with optional neighborhood.
    void supabase
    const { getCommunitiesForSitemapJoin } = await import('@/lib/data')
    const communityMetaRows = await getCommunitiesForSitemapJoin(5000)
    const neighborhoodByCommunity = new Map<string, string>()
    for (const row of communityMetaRows as Array<{
      name?: string | null
      cities?: { name?: string | null; slug?: string | null } | null
      neighborhoods?: { slug?: string | null } | null
    }>) {
      const cityName = (row.cities?.name ?? '').trim()
      const communityName = (row.name ?? '').trim()
      const neighborhoodSlug = (row.neighborhoods?.slug ?? '').trim()
      if (!cityName || !communityName || !neighborhoodSlug) continue
      const key = `${slugify(cityName)}:${slugify(communityName)}`
      neighborhoodByCommunity.set(key, neighborhoodSlug)
    }

    // Cities — paginate to get ALL cities (Supabase caps at 1,000 per request)
    const cityRows = await fetchAllRows<{ City?: string | null }>(
      supabase, 'listings', 'City',
      (q) => q.or(ACTIVE_STATUS_OR).not('City', 'is', null),
    )

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

    for (const city of cities) {
      const key = cityEntityKey(city)
      dynamicPages.push(
        { url: `${baseUrl}/cities/${key}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
        { url: `${baseUrl}/homes-for-sale/${key}`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
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
        if (await getMatrixCityPresetNoIndex(key, preset)) continue
        dynamicPages.push({
          url: `${baseUrl}/homes-for-sale/${key}/${preset}`,
          lastModified: now,
          changeFrequency: 'daily',
          priority: 0.8,
        })
      }
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

    // Subdivisions. Persistent (city, subdivision) pairs across ALL listing
    // statuses, thresholded by SUBDIVISION_SITEMAP_MIN_LIFETIME_LISTINGS, NOT
    // just currently-active pairs (active-only sourcing dropped a subdivision
    // URL from the sitemap the day its last listing closed). City scoping
    // stays on the CENTRAL_OREGON_CITY_SLUGS allowlist, independent of live
    // inventory, so a city with zero actives keeps its subdivision URLs too.
    // /cities/{city}/{sub} is deliberately NOT emitted here: that route only
    // resolves for boundary-neighborhood rows (anything else 404s), and
    // submitting 404s poisons the programmatic-page quality signal. The
    // neighborhood URLs are emitted below from the table the page resolves.
    //
    // Pairs come from listing_tile_mv (indexed on city_lower), NOT the
    // get_subdivision_status_counts RPC. That RPC's `TRIM("City") ILIKE
    // TRIM(p_city)` forces a sequential scan of the 589K-row listings table
    // per city (measured against production 2026-08-02: Bend 41.3s, Sisters
    // 32.0s, Redmond 14.6s, 104.7s total for just eight cities, the root
    // cause of the /sitemaps/*.xml 504s). The sitemap only needs the slugs of
    // subdivisions that clear the lifetime floor, not the RPC's
    // active/pending/closed split. See
    // lib/data/subdivisions/subdivision-sitemap-inventory.ts for the
    // classification this replicates and its one deliberate divergence
    // (listing_tile_mv excludes internet-display-opted-out listings, which
    // the RPC's raw-table scan does not).
    const subdivisionCitySlugs = [...CENTRAL_OREGON_CITY_SLUGS]
    const subdivisionSlugsByCity = await getSubdivisionBrowseSlugsByCity(
      supabase,
      subdivisionCitySlugs,
      SUBDIVISION_SITEMAP_MIN_LIFETIME_LISTINGS,
    )
    for (const [citySlug, subSlugs] of subdivisionSlugsByCity) {
      for (const subSlug of subSlugs) {
        dynamicPages.push(
          { url: `${baseUrl}/homes-for-sale/${citySlug}/${subSlug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
        )
      }
    }

    // Subdivision DETAIL pages (/subdivisions/[slug]) — the plat-boundary pages
    // (W2.1 light-up). A plat earns a sitemap slot with a GIS polygon AND
    // >= SUBDIVISION_INDEX_MIN_LIFETIME_SALES lifetime closed sales — the
    // shared set in lib/data/subdivisions/ that llms.txt also enumerates and
    // the page's noindex decision reads (parity pinned by
    // lib/data/subdivisions/subdivision-index.test.ts). Distinct from the
    // browse-pair floor above: detail pages carry the sold-history section, so
    // they earn indexation with real sold depth, not a listing trickle.
    const indexableSubdivisions = await getIndexableSubdivisions()
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
    const neighborhoodRows = await getAllNeighborhoodsWithCity()
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
    dynamicPages.push(...(await getSearchMatrixSitemapEntries(baseUrl, now)))

    // Out-of-area referral-tier city pages (W12) — only the indexable top set
    // (>= 5 active listings, top 25 by active count); every other out-of-area
    // city renders noindex and is never emitted.
    dynamicPages.push(...(await getOutOfAreaCitySitemapEntries()))

    // Team members
    const brokers = await fetchAllRows<{ slug: string; updated_at?: string }>(
      supabase, 'brokers', 'slug, updated_at',
      (q) => q.eq('is_active', true),
    )

    for (const b of brokers) {
      dynamicPages.push({
        url: `${baseUrl}${teamPath(b.slug)}`,
        lastModified: b.updated_at ? new Date(b.updated_at) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }

    // Listings — from the fast active-only slice of listing_tile_mv, NOT a full
    // scan of the 589K-row, 800-column `listings` table. That scan was timing
    // out at sitemap-generation time on the loaded pooler, silently dropping
    // EVERY individual listing from the sitemap (0 listing URLs in prod). The MV
    // is the lightweight tile view; filtering to on-market statuses returns the
    // small active set fast and reliably so listings are actually discoverable.
    const listings = await fetchAllRows<{
      listing_key: string
      list_number?: string | null
      subdivision_name?: string | null
      city?: string | null
      postal_code?: string | null
      street_number?: string | null
      street_name?: string | null
    }>(
      supabase, 'listing_tile_mv',
      'listing_key, list_number, subdivision_name, city, postal_code, street_number, street_name',
      (q) => q.in('standard_status', PUBLIC_ACTIVE_STATUSES),
    )

    for (const r of listings as Array<{
      listing_key: string
      list_number?: string | null
      subdivision_name?: string | null
      city?: string | null
      postal_code?: string | null
      street_number?: string | null
      street_name?: string | null
    }>) {
      // 'N/A' subdivision would slugify into a bogus /n-a/ URL segment — drop it.
      const subdivision = r.subdivision_name && r.subdivision_name !== 'N/A' ? r.subdivision_name : null
      dynamicPages.push({
        url: `${baseUrl}${listingDetailPath(
          r.listing_key,
          { streetNumber: r.street_number ?? null, streetName: r.street_name ?? null, city: r.city ?? null, state: null, postalCode: r.postal_code ?? null },
          {
            city: r.city ?? null,
            neighborhood:
              r.city && subdivision
                ? neighborhoodByCommunity.get(`${slugify(r.city)}:${slugify(subdivision)}`) ?? null
                : null,
            subdivision,
          },
          { mlsNumber: r.list_number ?? null }
        )}`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.7,
      })
    }

    // ZIP codes — paginate
    const zipRows = await fetchAllRows<{ PostalCode?: string | null }>(
      supabase, 'listings', 'PostalCode',
      (q) => q.or(ACTIVE_STATUS_OR).not('PostalCode', 'is', null),
    )

    const zips = Array.from(
      new Set(
        zipRows
          .map((r) => (r.PostalCode ?? '').replace(/\D/g, '').slice(0, 5))
          .filter((z) => z.length === 5)
      )
    )
    for (const zip of zips) {
      dynamicPages.push({
        url: `${baseUrl}/zip/${zip}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }

    // Blog posts — paginate
    const posts = await fetchAllRows<{ slug: string; published_at?: string | null }>(
      supabase, 'blog_posts', 'slug, published_at',
      (q) => q.eq('status', 'published'),
    )

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
    const reports = await fetchAllRows<{ slug: string; created_at?: string | null }>(
      supabase, 'market_reports', 'slug, created_at',
    )
    for (const r of reports) {
      dynamicPages.push({
        url: `${baseUrl}/housing-market/reports/${r.slug}`,
        lastModified: r.created_at ? new Date(r.created_at) : now,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }
  } catch (e) {
    console.error('[sitemap] Error generating dynamic pages:', e)
    // Return static pages only if database query fails
  }

  // Output-based drift backstop: drop any non-sanctioned 2-seg /cities URL,
  // however built (template/concat/join/aliased). Inspects final URL strings.
  return filterRogueCityUrls([...staticPages, ...dynamicPages], allowedNeighborhoodPaths)
}
