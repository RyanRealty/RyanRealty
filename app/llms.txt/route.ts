import { NextResponse } from 'next/server'
import { getRecentBlogPosts, getPublishedGuides, listMarketReports, getEventsForIndex, getVenuesForIndex, getTrailsForIndex, getAllNeighborhoodsWithCity } from '@/lib/data'
import { publicCommunitySlug } from '@/lib/communities/community-public-pair'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { getIndexableSubdivisions } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { PRIMARY_CITIES } from '@/lib/cities'
import { GOLF_COURSES } from '@/data/golf/courses'
import aiQueryMap from '@/lib/seo/ai-query-map.json' assert { type: 'json' }
import { CORE_MARKET_PATHS } from '@/app/housing-market/[...slug]/_v3/geo-constants'
import { cityTypeLlmsLines, dedupeLlmsLines, marketCityLlmsLines, zipLlmsLines, LLMS_SUBDIVISIONS_PATH } from '@/lib/site/llms-geo'
import { BRAND, CONTACT } from '@/lib/brand/contact'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const revalidate = 3600

/**
 * llms.txt — the AI-crawler map of the site (growth-loop class fix 2026-06-10).
 *
 * The dynamic sections pull from the same cached DAL the pages render from, so
 * new content is discoverable here the hour it publishes. Every fetcher is
 * resilient-cached (returns [] on failure) so the curated sections always serve.
 * Coverage enforced by scripts/check-ai-crawler-access.mjs and
 * scripts/check-ai-query-battery.mjs.
 *
 * SHAPE (AEO-2 / AEO-4, visibility audit 2026-09-22). The file used to be 281 KB
 * and 2,892 links, 2,642 of them (91%) bare subdivision plat URLs, with the
 * Guides, Blog, Tools and Brokerage sections sitting after the plat block and
 * three pillars listed twice. It now leads with who we are and the pages an
 * assistant most needs (brokerage, listings, homes by type per city, market
 * data, places), carries a one-line description on the new type pages, prints
 * each URL once (dedupeLlmsLines), and moves the plat list to its own linked
 * file under "## Optional", which the llms.txt convention reserves for
 * secondary links a reader can skip. The plat set itself is unchanged: it is
 * still the same list the sitemap submits (subdivision-index parity test).
 */
export async function GET() {
  const [posts, guides, reports, neighborhoods, subdivisions] = await Promise.all([
    getRecentBlogPosts({ limit: 25 }),
    getPublishedGuides(50),
    listMarketReports(12),
    getAllNeighborhoodsWithCity().catch(() => []),
    // Counted only, for the pointer line to the secondary file. Same shared set
    // app/sitemap.ts submits. Resilient-cached: [].
    getIndexableSubdivisions(),
  ])

  const seen = new Set<string>()
  // Each block prefixes its own newline so an empty result (no rows published
  // yet, or the resilient-cache fallback) leaves no dangling blank line. Every
  // URL prints once across the whole file: the first section to list it wins.
  const lines = (items: string[]) => {
    const kept = dedupeLlmsLines(items, seen)
    return kept.length ? '\n' + kept.join('\n') : ''
  }
  const pillars = (section: string) =>
    (aiQueryMap.pillars as Array<{ section: string; label: string; path: string; description?: string }>)
      .filter((p) => p.section === section)
      .map((p) =>
        p.description
          ? `- [${p.label}](${SITE_URL}${p.path}): ${p.description}`
          : `- ${p.label}: ${SITE_URL}${p.path}`,
      )

  const cityLabel = (slug: string) =>
    slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  const brokerageLines = lines(pillars('brokerage'))
  const listingLines = lines([
    `- Homes for sale: ${SITE_URL}/homes-for-sale`,
    `- Bend homes for sale: ${SITE_URL}/homes-for-sale/bend`,
    `- Redmond homes for sale: ${SITE_URL}/homes-for-sale/redmond`,
    `- Sisters homes for sale: ${SITE_URL}/homes-for-sale/sisters`,
    `- Sunriver homes for sale: ${SITE_URL}/homes-for-sale/sunriver`,
    `- La Pine homes for sale: ${SITE_URL}/homes-for-sale/la-pine`,
    `- Open houses: ${SITE_URL}/open-houses`,
    `- New construction in Bend: ${SITE_URL}/new-construction`,
    `- Price Drop Radar (Central Oregon): ${SITE_URL}/price-drops`,
    `- Bend price drops: ${SITE_URL}/price-drops/bend`,
    `- Redmond price drops: ${SITE_URL}/price-drops/redmond`,
    `- Sisters price drops: ${SITE_URL}/price-drops/sisters`,
    ...pillars('listings'),
  ])
  const typeLines = lines(cityTypeLlmsLines(SITE_URL, PRIMARY_CITIES))
  const marketLines = lines([
    `- Housing market hub: ${SITE_URL}/housing-market`,
    `- Market reports: ${SITE_URL}/housing-market/reports`,
    ...reports.map((r) => `- ${r.title}: ${SITE_URL}/housing-market/reports/${r.slug}`),
    ...marketCityLlmsLines(SITE_URL, CORE_MARKET_PATHS, cityLabel),
  ])
  // Full geo index: the same three sources the sitemap emits from, so the AI
  // crawler map and the Google crawler map cannot disagree on which geo pages
  // exist: SITE_CITY_SLUGS (city pages), the curated resort registry
  // (/communities/*), and boundary neighborhoods (/cities/{city}/{slug}).
  const cityLines = lines([
    `- All cities: ${SITE_URL}/cities`,
    ...SITE_CITY_SLUGS.map((slug) => `- ${cityLabel(slug)}: ${SITE_URL}/cities/${slug}`),
  ])
  const communityLines = lines([
    `- All communities: ${SITE_URL}/communities`,
    ...getAllResortCommunities().map(
      (c) => `- ${c.label} (${c.city}): ${SITE_URL}/communities/${publicCommunitySlug(c)}`,
    ),
  ])
  const neighborhoodLines = lines(
    neighborhoods
      .map((n) => {
        const cityRel = Array.isArray(n.cities) ? n.cities[0] : n.cities
        if (!cityRel?.slug || !n.slug) return null
        return `- ${n.name} (${cityRel.name}): ${SITE_URL}/cities/${cityRel.slug}/${n.slug}`
      })
      .filter((line): line is string => line !== null),
  )
  const zipLines = lines(zipLlmsLines(SITE_URL))
  const guideLines = lines([
    `- All guides: ${SITE_URL}/blog`,
    ...pillars('guides'),
    ...guides.map((g) => `- ${g.title}: ${SITE_URL}/blog/${g.slug}`),
  ])
  // "All posts" shares /blog with "All guides" above, so the dedupe drops it.
  const blogLines = lines([
    `- All posts: ${SITE_URL}/blog`,
    ...posts.map((p) => `- ${p.title}: ${SITE_URL}/blog/${p.slug}`),
  ])
  const toolLines = lines([
    `- Mortgage calculator: ${SITE_URL}/tools/mortgage-calculator`,
    `- Rental property calculator: ${SITE_URL}/tools/rental-property-calculator`,
    `- Home appreciation tool: ${SITE_URL}/tools/appreciation`,
    ...pillars('tools'),
  ])

  // Confirmed-upcoming events first, then the annual anchors, both linking to
  // the detail page. Dates are the verified registry dates, never generated (§0).
  const { upcoming, anchors } = getEventsForIndex()
  const eventLines = lines([
    `- Central Oregon events: ${SITE_URL}/central-oregon/events`,
    ...[...upcoming, ...anchors].map((e) => `- ${e.name}: ${SITE_URL}/central-oregon/events/${e.slug}`),
  ])
  const { music, performingArts } = getVenuesForIndex()
  const venueLines = lines([
    `- Central Oregon live music and show venues: ${SITE_URL}/central-oregon/venues`,
    ...[...music, ...performingArts]
      .filter((v, i, arr) => arr.findIndex((x) => x.slug === v.slug) === i)
      .map((v) => `- ${v.name} (${v.city}): ${SITE_URL}/central-oregon/venues/${v.slug}`),
  ])
  const golfLines = lines(
    GOLF_COURSES.map(
      (c) => `- ${c.name} (${c.city.replace(/\s*\(.*?\)/g, '')}): ${SITE_URL}/central-oregon/golf/${c.slug}`,
    ),
  )
  const { hiking, biking } = getTrailsForIndex()
  const trailLines = lines([
    `- Central Oregon hiking and mountain-bike trails: ${SITE_URL}/central-oregon/trails`,
    ...[...hiking, ...biking]
      .filter((t, i, arr) => arr.findIndex((x) => x.slug === t.slug) === i)
      .map((t) => `- ${t.name} (${t.city}): ${SITE_URL}/central-oregon/trails/${t.slug}`),
  ])

  const subdivisionPointer =
    subdivisions.length > 0
      ? `\n- Subdivisions (${subdivisions.length.toLocaleString('en-US')} pages, one link each): ${SITE_URL}${LLMS_SUBDIVISIONS_PATH}`
      : `\n- Subdivisions: ${SITE_URL}${LLMS_SUBDIVISIONS_PATH}`

  const body = `# ${BRAND.name}

> ${BRAND.name} is a boutique real estate brokerage in Bend, Oregon, that helps people buy and sell homes across Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and the resort communities around them. Its city, community, neighborhood, and ZIP pages list the homes for sale there now, from the regional MLS, with that place's market figures.

Office: ${BRAND.address.street}, ${BRAND.address.city}, ${BRAND.address.region} ${BRAND.address.postalCode}. Phone: ${CONTACT.phoneDirect}. Web: ${BRAND.url}

## Brokerage${brokerageLines}

## Listings${listingLines}

## Homes by type
One page per property type in each city: the ones for sale now, live from the regional MLS, with prices, photos, and a map.${typeLines}

## Market Data${marketLines}

## Cities${cityLines}

## Communities${communityLines}

## Neighborhoods${neighborhoodLines}

## ZIP codes${zipLines}

## Guides${guideLines}

## Blog${blogLines}

## Tools${toolLines}

## Local Events${eventLines}

## Live Music & Shows (venues)${venueLines}

## Golf${golfLines}

## Trails${trailLines}

## Optional${subdivisionPointer}
`

  return new NextResponse(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  })
}
