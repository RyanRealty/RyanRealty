import type { MetadataRoute } from 'next'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cityEntityKey, listingDetailPath, listingsBrowsePath, slugify, teamPath, valuationPath } from '../lib/slug'
import { getAllPresetSlugs } from '../lib/search-presets'

const ACTIVE_STATUS_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'

import { fetchAllRows } from '@/lib/supabase/paginate'
import { isCentralOregonCity, SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { CO_EVENTS } from '@/data/co-events'
import { CO_VENUES } from '@/data/co-venues'
import { CO_GOLF_COURSES } from '@/data/co-golf'

// The ONLY slugs with a real /communities/[slug] page — the curated resort
// registry (data/resort-communities.json). The old code emitted every row of
// the `communities` table, which included ~31 junk subdivision slugs that
// render fabricated pages ("Industrial, Madras Oregon"). Keep this in sync with
// the registry.
const RESORT_COMMUNITY_SLUGS = [
  'tetherow', 'broken-top', 'eagle-crest', 'pronghorn', 'caldera-springs',
  'sunriver', 'awbrey-glen', 'northwest-crossing', 'crosswater',
  'black-butte-ranch', 'brasada-ranch', 'widgi-creek', 'vandevert-ranch',
  'three-rivers',
] as const

/**
 * Dynamic sitemap — generates at request time so it always has fresh data.
 * Next.js serves this at /sitemap.xml automatically.
 *
 * For a Central Oregon regional site, total URLs are well under Google's
 * 50,000 limit per sitemap file, so we serve a single sitemap without chunking.
 * This avoids the Next.js 16 bug (issue 77304) where generateSitemaps() creates
 * chunks at /sitemap/[id].xml but never generates the /sitemap.xml index.
 */

// ISR, not force-dynamic: the heavy generation (~14s of listings scans) runs at
// build + once per hour in the background, and every crawler request is served
// from cache instantly. force-dynamic re-ran the whole thing on EVERY hit, which
// is why /sitemap.xml took 11-14s and intermittently timed out. A sitemap up to
// an hour stale is fine for Google.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const now = new Date()
  return buildAllUrls(baseUrl, now)
}

/**
 * Build the complete list of sitemap URLs. Called once per chunk request.
 * In production with caching (revalidate: 3600), this is efficient enough.
 */
async function buildAllUrls(baseUrl: string, now: Date): Promise<MetadataRoute.Sitemap> {
  // Static pages — always included even without database
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}${listingsBrowsePath()}`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/luxury-homes-bend`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/communities`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/cities`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}${teamPath()}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/guides`, lastModified: now, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${baseUrl}/central-oregon/events`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/central-oregon/venues`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/housing-market`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/housing-market/central-oregon`, lastModified: now, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${baseUrl}/open-houses`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/activity`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/sell`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}${valuationPath()}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    // Per-community LPs (Tier 2 in the city > community > subdivision > listing
    // search-authority stack). Tetherow is the first port from static HTML to
    // the Next.js dynamic route + ISR exemplar.
    { url: `${baseUrl}/lp/tetherow/`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/buy`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    // Sell + buy intent pages (indexable, proper metadata) — added so the
    // long-tail intent landing pages are crawlable.
    { url: `${baseUrl}/sell/for-sale-by-owner`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/sell/expired-listings`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/sell/inherited-home`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/buy/first-time-home-buyer`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/buy/relocation`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/buy/investment`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    // central-oregon-golf LP is indexable content (organic golf-community SEO).
    { url: `${baseUrl}/lp/central-oregon-golf`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/lp/bend/`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/lp/tetherow/heath/`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/our-homes`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    // NOTE: /compare, /lp/fsbo, /lp/buyer-listing-alerts removed from the sitemap —
    // they declare robots:{index:false}, so listing them only wasted crawl budget
    // and triggered Search Console "submitted but noindex" warnings. To make the
    // two LPs organically discoverable, remove their page-level noindex instead.
    { url: `${baseUrl}/videos`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/resources`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/pulse`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/feed`, lastModified: now, changeFrequency: 'daily', priority: 0.55 },
    { url: `${baseUrl}/tools/mortgage-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/tools/rental-property-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/tools/appreciation`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/reviews`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/join`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
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
  for (const course of CO_GOLF_COURSES) {
    staticPages.push({
      url: `${baseUrl}/central-oregon/golf/${course.slug}`,
      lastModified: course.lastVerified,
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

  // If Supabase is not configured, return only static pages
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseKey) {
    return staticPages
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

      // Preset filter pages per city
      const presetSlugs = getAllPresetSlugs()
      for (const preset of presetSlugs) {
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

    // Subdivisions — ONE scan of active listings for (City, SubdivisionName)
    // pairs, grouped in memory. Replaces the per-city N+1 loop that made ~24
    // separate paginated scans of the 589K listings table (the main sitemap
    // slowdown, ~11s -> a few seconds).
    const cityNameSet = new Set(cities)
    const subPairRows = await fetchAllRows<{ City?: string | null; SubdivisionName?: string | null }>(
      supabase, 'listings', 'City, SubdivisionName',
      (q) => q.or(ACTIVE_STATUS_OR).not('SubdivisionName', 'is', null).not('City', 'is', null),
    )
    const subsByCity = new Map<string, Set<string>>()
    for (const r of subPairRows) {
      const city = (r.City ?? '').trim()
      const sub = (r.SubdivisionName ?? '').trim()
      if (!city || !sub || !cityNameSet.has(city)) continue
      let set = subsByCity.get(city)
      if (!set) { set = new Set(); subsByCity.set(city, set) }
      set.add(sub)
    }
    for (const [city, subs] of subsByCity) {
      const cityKey = cityEntityKey(city)
      for (const sub of subs) {
        const subSlug = slugify(sub)
        dynamicPages.push(
          { url: `${baseUrl}/cities/${cityKey}/${encodeURIComponent(subSlug)}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
          { url: `${baseUrl}/homes-for-sale/${cityKey}/${subSlug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
        )
      }
    }

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
      (q) => q.in('standard_status', ['Active', 'Coming Soon', 'Active Under Contract']),
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

    // Guides — paginate
    const guides = await fetchAllRows<{ slug: string; published_at?: string | null; updated_at?: string | null }>(
      supabase, 'guides', 'slug, published_at, updated_at',
      (q) => q.eq('status', 'published'),
    )

    for (const g of guides) {
      dynamicPages.push({
        url: `${baseUrl}/guides/${g.slug}`,
        lastModified: g.updated_at ? new Date(g.updated_at) : g.published_at ? new Date(g.published_at) : now,
        changeFrequency: 'monthly',
        priority: 0.65,
      })
    }

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

  return [...staticPages, ...dynamicPages]
}
