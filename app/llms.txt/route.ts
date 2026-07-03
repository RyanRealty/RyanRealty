import { NextResponse } from 'next/server'
import { getRecentBlogPosts, getPublishedGuides, listMarketReports, getEventsForIndex, getVenuesForIndex, getTrailsForIndex } from '@/lib/data'
import { GOLF_COURSES } from '@/data/golf/courses'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const revalidate = 3600

/**
 * llms.txt — the AI-crawler map of the site (growth-loop class fix 2026-06-10).
 *
 * Was a static hardcoded list, which silently omitted the highest-citation-value
 * families (blog posts, market reports, guides, tools). The dynamic sections now
 * pull from the same cached DAL the pages render from, so new content is
 * discoverable here the hour it publishes. Every fetcher is resilient-cached
 * (returns [] on failure) so the curated pillar sections always serve.
 * Coverage enforced by scripts/check-ai-crawler-access.mjs.
 */
export async function GET() {
  const [posts, guides, reports] = await Promise.all([
    getRecentBlogPosts({ limit: 25 }),
    getPublishedGuides(50),
    listMarketReports(12),
  ])

  // Each dynamic block prefixes its own newline so an empty result (no rows
  // published yet, or the resilient-cache fallback) leaves no dangling blank line.
  const lines = (items: string[]) => (items.length ? '\n' + items.join('\n') : '')
  const blogLines = lines(posts.map((p) => `- ${p.title}: ${SITE_URL}/blog/${p.slug}`))
  const guideLines = lines(guides.map((g) => `- ${g.title}: ${SITE_URL}/guides/${g.slug}`))
  const reportLines = lines(
    reports.map((r) => `- ${r.title}: ${SITE_URL}/housing-market/reports/${r.slug}`)
  )

  // Confirmed-upcoming events first, then the annual anchors — both link to the
  // detail page. Dates are the verified registry dates, never generated (§0).
  const { upcoming, anchors } = getEventsForIndex()
  const eventLines = lines(
    [...upcoming, ...anchors].map(
      (e) => `- ${e.name}: ${SITE_URL}/central-oregon/events/${e.slug}`,
    ),
  )
  const { music, performingArts } = getVenuesForIndex()
  const venueLines = lines(
    [...music, ...performingArts]
      .filter((v, i, arr) => arr.findIndex((x) => x.slug === v.slug) === i)
      .map((v) => `- ${v.name} (${v.city}): ${SITE_URL}/central-oregon/venues/${v.slug}`),
  )
  const golfLines = lines(
    GOLF_COURSES.map(
      (c) => `- ${c.name} (${c.city.replace(/\s*\(.*?\)/g, '')}): ${SITE_URL}/central-oregon/golf/${c.slug}`,
    ),
  )
  const { hiking, biking } = getTrailsForIndex()
  const trailLines = lines(
    [...hiking, ...biking]
      .filter((t, i, arr) => arr.findIndex((x) => x.slug === t.slug) === i)
      .map((t) => `- ${t.name} (${t.city}): ${SITE_URL}/central-oregon/trails/${t.slug}`),
  )

  const body = `# Ryan Realty Central Oregon Real Estate

> Ryan Realty serves Central Oregon buyers and sellers with live listings, market reports, and neighborhood guidance.

## Listings
- Homes for sale: ${SITE_URL}/homes-for-sale
- Bend homes for sale: ${SITE_URL}/homes-for-sale/bend
- Redmond homes for sale: ${SITE_URL}/homes-for-sale/redmond
- Sisters homes for sale: ${SITE_URL}/homes-for-sale/sisters
- Open houses: ${SITE_URL}/open-houses

## Price Drops
- Price Drop Radar (Central Oregon): ${SITE_URL}/price-drops
- Bend price drops: ${SITE_URL}/price-drops/bend
- Redmond price drops: ${SITE_URL}/price-drops/redmond
- Sisters price drops: ${SITE_URL}/price-drops/sisters

## Market Data
- Housing market hub: ${SITE_URL}/housing-market
- Market reports: ${SITE_URL}/reports
- Market explorer: ${SITE_URL}/reports/explore${reportLines}

## Local Areas
- Cities: ${SITE_URL}/cities
- Communities: ${SITE_URL}/communities

## Local Events
- Central Oregon events: ${SITE_URL}/central-oregon/events${eventLines}

## Live Music & Shows (venues)
- Central Oregon live music & show venues: ${SITE_URL}/central-oregon/venues${venueLines}

## Golf
- Central Oregon golf guide (every course by architect): ${SITE_URL}/lp/central-oregon-golf${golfLines}

## Trails
- Central Oregon hiking & mountain-bike trails: ${SITE_URL}/central-oregon/trails${trailLines}

## Guides
- All guides: ${SITE_URL}/guides${guideLines}

## Blog
- All posts: ${SITE_URL}/blog${blogLines}

## Tools
- Mortgage calculator: ${SITE_URL}/tools/mortgage-calculator
- Rental property calculator: ${SITE_URL}/tools/rental-property-calculator
- Home appreciation tool: ${SITE_URL}/tools/appreciation

## Brokerage
- Team: ${SITE_URL}/team
- Contact: ${SITE_URL}/contact
`

  return new NextResponse(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  })
}
