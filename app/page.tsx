import type { Metadata } from 'next'

import { getRegionPulse, getListingTiles } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getMarketStatsCacheRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import { getPriceHistory } from '@/lib/data/market/getPriceHistory'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { buildYearSeries } from '@/lib/kb/year-series'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
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
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import type { KbTownItem, KbCommunityItem, KbTickerItem, KbFeaturedItem, KbMarketData } from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import communityVideoManifest from '@/data/city-hero-videos.resolved.json'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

/**
 * Homepage — the kinetic-brutalist design (navy + cream, Amboqia + Geist, GSAP +
 * Lenis motion). Carries its own chrome (KbNav + the KB footer section); the
 * default SiteHeader/SiteFooter are hidden on "/" via HideChrome in the layout,
 * while the global JSON-LD, VisitTracker, and auth bridges still run. Every
 * figure is live from the DAL (§0). ISR cache at 60s.
 *
 * Promoted from the /concept/kb preview 2026-06-17 (Matt-approved design).
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Ryan Realty. Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
  description:
    'Find your next home in Central Oregon. Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities. Real numbers, direct from the brokers who close deals here.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Ryan Realty. Central Oregon Real Estate',
    description:
      'Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities. Real numbers, direct from the brokers who close deals here.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Ryan Realty. Central Oregon Real Estate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ryan Realty. Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
    description: 'Real numbers, direct from the brokers who close deals in Central Oregon.',
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
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) : ''

export default async function Home() {
  const [pulse, cities, communities, tiles, featured, mktStats, priceHist] = await Promise.all([
    getRegionPulse().catch(() => null),
    getCitiesForIndex().catch(() => []),
    getCommunitiesForIndex().catch(() => []),
    getListingTiles({ status: 'active', propertyType: 'A', limit: 3000 }).catch(() => []),
    getListingTiles({ status: 'active', propertyType: 'A', sort: 'price-desc', limit: 14 }).catch(() => []),
    getMarketStatsCacheRowForGeo({ geoSlug: 'central-oregon' }).catch(() => null),
    getPriceHistory('region', 'central-oregon', 'monthly', 60).catch(() => []),
  ])

  const cityBySlug = new Map(cities.map((c) => [c.slug, c]))
  const towns: KbTownItem[] = TOWN_ORDER.map((slug) => {
    const c = cityBySlug.get(slug)
    if (!c) return null
    return { name: c.name, activeCount: c.activeCount, medianPrice: c.medianPrice, href: `/cities/${slug}`, img: TOWN_IMG[slug] }
  }).filter((t): t is KbTownItem => t !== null)

  const communityVideos = communityVideoManifest as Record<string, { video?: string } | undefined>
  const communityItems: KbCommunityItem[] = COMM_FEATURED.map((f): KbCommunityItem | null => {
    const c = communities.find((x) => x.subdivision.toLowerCase().includes(f.match))
    if (!c) return null
    const cv = communityVideos[f.videoSlug]
    return {
      name: c.subdivision,
      activeCount: c.activeCount,
      town: f.town,
      href: `/communities/${c.slug}`,
      img: f.img,
      video: cv?.video ? { url: cv.video, embedType: 'video-tag' as const } : null,
    }
  }).filter((x): x is KbCommunityItem => x !== null)

  const mapFeatures = tiles
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(t.lng), Number(t.lat)] as [number, number] },
      properties: {
        p: t.listPrice,
        bd: t.beds,
        ba: t.baths,
        sf: t.sqft,
        a: [t.streetNumber, t.streetName].filter(Boolean).join(' '),
        sub: t.subdivisionName ?? '',
        city: t.city ?? '',
        img: t.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  const tickerItems: KbTickerItem[] = tiles.slice(0, 6).map((t) => ({
    price: t.listPrice,
    address: [t.streetNumber, t.streetName].filter(Boolean).join(' '),
    town: t.city ?? '',
  }))

  // Featured homes — shared resolver classifies each home's MLS media into a
  // clean autoplay background video or a "Tour" badge (see resolve-featured-items).
  const featuredItems: KbFeaturedItem[] = await resolveFeaturedItems(featured)

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
      <KbNav />
      <KbSectionTracker pageType="homepage" />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
        />
        <KbExploreTowns towns={towns} />
        <KbCommunities communities={communityItems} />
        <KbFeatured items={featuredItems} />
        <KbListingMap geojson={mapGeo} totalActive={pulse?.activeCount ?? mapFeatures.length} />
        <KbTicker items={tickerItems} />
        <KbTestimonials reviews={TESTIMONIALS.slice(0, 8)} />
        <KbTeam />
        <KbMarketHud data={marketData} />
        <KbSell
          data={{
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: pulse?.soldCount30d ?? null,
          }}
        />
        <KbFooter towns={towns} />
      </SmoothScrollProvider>
    </main>
  )
}
