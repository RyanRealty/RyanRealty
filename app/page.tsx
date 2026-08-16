import type { Metadata } from 'next'

import { getRegionPulse, getListingTiles } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getMarketStatsCacheRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import { getPriceHistory } from '@/lib/data/market/getPriceHistory'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { curateFeaturedTiles } from '@/lib/kb/curate-featured'
import { buildMapPointFeatures } from '@/lib/kb/place-sections'
import { listingDetailPath } from '@/lib/slug'
import { buildYearSeries } from '@/lib/kb/year-series'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbCommunities } from '@/components/site/kb/KbCommunities.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbTicker } from '@/components/site/kb/KbTicker.client'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbCommunityAlerts } from '@/components/site/kb/KbCommunityAlerts.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { ArrivalIntent } from '@/components/site/v3/ArrivalIntent.client'
import { formatDate } from '@/lib/format/date'
import type { KbTownItem, KbCommunityItem, KbTickerItem, KbFeaturedItem, KbMarketData } from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import communityVideoManifest from '@/data/city-hero-videos.resolved.json'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

/**
 * Homepage — the kinetic-brutalist design (navy + cream, Amboqia + Geist, GSAP +
 * Lenis motion). CHROME: Global PublicNav in app/layout.tsx owns the top bar
 * (KbNav from lib/site-nav.ts). This page owns KbFooter only — do not re-mount
 * KbNav. HideChrome is only for the not-found footer edge case / CSS hide if
 * still used. Global JSON-LD, VisitTracker, and auth bridges still run. Every
 * figure is live from the DAL (§0). ISR cache at 60s.
 *
 * Promoted from the /concept/kb preview 2026-06-17 (Matt-approved design).
 */
export const revalidate = 60

export const metadata: Metadata = {
  // Layer A discovery shell (Matt 2026-08-10): exact-match money query language.
  title: 'Homes for Sale in Central Oregon | Bend, Redmond, Sisters, Sunriver',
  description:
    'Active homes for sale in Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices, days on market, and closed comps from the regional MLS.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Homes for Sale in Central Oregon | Ryan Realty',
    description:
      'Active homes for sale in Bend, Redmond, Sisters, and Sunriver. Live list prices, days on market, and closed comps.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Homes for Sale in Central Oregon' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Homes for Sale in Central Oregon | Bend, Redmond, Sisters, Sunriver',
    description: 'Active Central Oregon homes for sale. List prices and days on market, town by town.',
  },
}

const TOWN_ORDER = ['bend', 'la-pine', 'redmond', 'sunriver', 'sisters', 'terrebonne']
const TOWN_IMG: Record<string, string> = {
  bend: '/images/kb/bend-drake-park-aerial.jpg',
  'la-pine': '/images/kb/vandevert-ranch.jpg',
  redmond: '/images/kb/redmond-downtown-aerial.jpg',
  sunriver: '/images/kb/sunriver-deschutes-river.jpg',
  sisters: '/images/kb/sisters-downtown-three-peaks.jpg',
  terrebonne: '/images/kb/smith-rock-terrebonne.jpg',
}

// Each featured community resolves its silent Area Guide clip (graded + hosted
// by scripts/sync-city-videos.mjs) via `videoSlug` → data/city-hero-videos.resolved.json.
// Caldera Springs IS the Sunriver-area community, so the Sunriver card plays the
// real Caldera Springs guide (a Sunriver-area video) — not a mismatched still.
const COMM_FEATURED = [
  { match: 'tetherow', town: 'Bend', img: '/images/kb/tetherow-golf-aerial.jpg', videoSlug: 'tetherow' },
  { match: 'caldera', town: 'Sunriver', img: '/images/kb/caldera-springs.jpg', videoSlug: 'caldera-springs' },
  { match: 'broken top', town: 'Bend', img: '/images/kb/broken-top.jpg', videoSlug: 'broken-top' },
  { match: 'northwest crossing', town: 'Bend', img: '/images/kb/northwest-crossing.jpg', videoSlug: 'northwest-crossing' },
]

const monthLabel = (iso?: string) =>
  iso ? formatDate(iso, { month: 'short', day: undefined, year: undefined, timeZone: 'UTC' }) : ''

export default async function Home() {
  const [pulse, cities, communities, tiles, mktStats, priceHist] = await Promise.all([
    getRegionPulse().catch(() => null),
    getCitiesForIndex().catch(() => []),
    getCommunitiesForIndex().catch(() => []),
    getListingTiles({ status: 'active', propertyType: 'A', limit: 3000 }).catch(() => []),
    getMarketStatsCacheRowForGeo({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => null),
    getPriceHistory('region', 'central-oregon', 'monthly', 60).catch(() => []),
  ])

  const cityBySlug = new Map(cities.map((c) => [c.slug, c]))
  const towns: KbTownItem[] = TOWN_ORDER.map((slug): KbTownItem | null => {
    const c = cityBySlug.get(slug)
    if (!c) return null
    return { name: c.name, activeCount: c.activeCount, medianPrice: c.medianPrice, href: `/cities/${slug}`, img: TOWN_IMG[slug] }
  }).filter((t): t is KbTownItem => t !== null)

  const communityVideos = communityVideoManifest as Record<string, { video?: string } | undefined>
  // DB rows carry raw MLS casing ("caldera springs") — display headline gets
  // title case; already-cased names (NorthWest Crossing) pass through.
  const titleCaseName = (s: string) => s.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
  const communityItems: KbCommunityItem[] = COMM_FEATURED.map((f): KbCommunityItem | null => {
    const c = communities.find((x) => x.subdivision.toLowerCase().includes(f.match))
    if (!c) return null
    const cv = communityVideos[f.videoSlug]
    return {
      name: titleCaseName(c.subdivision),
      activeCount: c.activeCount,
      town: f.town,
      href: `/communities/${c.slug}`,
      img: f.img,
      video: cv?.video ? { url: cv.video, embedType: 'video-tag' as const } : null,
    }
  }).filter((x): x is KbCommunityItem => x !== null)

  const mapFeatures = buildMapPointFeatures(tiles)
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  // Each tape item links to its listing (design-audit: real prices + addresses
  // styled as content must honor the tap they invite).
  const tickerItems: KbTickerItem[] = tiles.slice(0, 6).map((t) => ({
    price: t.listPrice,
    address: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' '),
    town: t.city ?? '',
    href: listingDetailPath(
      t.listingKey,
      { streetNumber: t.streetNumber, streetName: t.streetName, city: t.city, postalCode: t.postalCode },
      { city: t.city, subdivision: t.subdivisionName },
      { mlsNumber: t.listNumber },
    ),
  }))

  // Featured homes — shared resolver classifies each home's MLS media into a
  // clean autoplay background video or a "Tour" badge (see resolve-featured-items).
  // Curated mix, not raw price-desc (design-audit): 2 luxury heroes + the home
  // closest to each town's live median + fill, deduped by street/subdivision.
  const featured = curateFeaturedTiles(
    tiles,
    towns.map((t) => ({ name: t.name, medianPrice: t.medianPrice })),
    9,
  )
  // 9 cards (hero + pair + two rows of thirds) so the per-town mid-market
  // picks survive the resolver's video-first ordering.
  const featuredItems: KbFeaturedItem[] = await resolveFeaturedItems(featured, 9)

  const sltRaw = mktStats?.avg_sale_to_list_ratio ?? null
  const marketData: KbMarketData = {
    active: pulse?.activeCount ?? null,
    closed30: pulse?.soldCount30d ?? null,
    new30: pulse?.newCount30d ?? null,
    medianList: pulse?.medianListPrice ?? null,
    saleToList: sltRaw != null ? (sltRaw < 2 ? sltRaw * 100 : sltRaw) : null,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: pulse?.monthsOfSupply ?? null,
    trend: priceHist
      .slice(-13)
      .filter((p) => p.medianSalePrice != null)
      .map((p) => ({ label: monthLabel(p.periodStart), value: p.medianSalePrice as number })),
    byTown: towns
      .filter((t) => t.medianPrice != null)
      .map((t) => ({ name: t.name, median: t.medianPrice as number })),
    countyMedian: pulse?.medianListPrice ?? null,
    yearSeries: buildYearSeries(priceHist, 5),
  }

  return (
    <main className="kb-root">
      <KbSectionTracker pageType="homepage" />
      <ArrivalIntent />
      <SmoothScrollProvider>
        {/* Hero Layer A (Matt 2026-08-10 exact-match discovery home):
            H1 matches money queries. Live count + median stay in the sub-line. */}
        <KbHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow="Central Oregon Real Estate"
          titleTop="Central Oregon"
          titleBottom="Homes for Sale"
          lead="Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market."
        />
        {/* C-07: the homepage was the only one of four callers omitting `title`, so
            it inherited the placeholder default and rendered a naked verb, "EXPLORE".
            The eyebrow had been given scent copy to compensate for a heading that said
            nothing — the fix belongs one line down. "The six towns" also went: it reads
            as a claim about the region, and the site carries Prineville and Madras too. */}
        <KbExploreTowns towns={towns} eyebrow="By town" title={'Where the sales\nare happening'} />
        <KbCommunities communities={communityItems} eyebrow="Resorts and planned communities" />
        <KbFeatured items={featuredItems} eyebrow="Listed right now" />
        {/* Mid-page buyer capture (E2 craft): navy band after inventory so the
            homepage is not sell-only until deep scroll. propertyType A = SFR
            across the regional MLS — honest Central Oregon filter without a
            single-city lie. hasNarrowingFilter accepts propertyType alone. */}
        <KbCommunityAlerts
          communityName="Central Oregon"
          city=""
          extraFilters={{ propertyType: 'A' }}
          headline="Central Oregon"
          body="Enter your email. When a single-family home hits the market in Bend, Redmond, Sisters, Sunriver, or nearby, you hear first."
        />
        {/* fitToFeatures frames the actual inventory — the REGION box in this
            wide container padded half the visible map out to the Willamette
            Valley with zero pins (design-audit). */}
        <KbListingMap geojson={mapGeo} totalActive={pulse?.activeCount ?? mapFeatures.length} fitToFeatures />
        <KbTicker items={tickerItems} />
        {/* KbSell (the one seller-conversion surface) sits ahead of the review
            stack + team + market HUD — as section 10 of 11 it never surfaced in
            a 10-viewport mobile scroll (design-audit P2). */}
        <KbSell
          data={{
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: pulse?.soldCount30d ?? null,
          }}
        />
        <KbTestimonials reviews={TESTIMONIALS.slice(0, 8)} />
        <KbTeam />
        <KbMarketHud data={marketData} asOf={pulse?.updatedAt ?? null} />
        <KbFooter towns={towns} />
      </SmoothScrollProvider>
    </main>
  )
}
