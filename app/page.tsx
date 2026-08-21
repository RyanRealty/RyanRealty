import type { Metadata } from 'next'

import { getRegionPulse, getListingTiles, getBoundaryGeoJSON, getRecentBlogPosts, getParks, getReviews } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getMarketStatsCacheRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import { getMarketPulseAllCitySnapshots } from '@/lib/data/market/getMarketPulseSnapshot'
import { getPriceHistory } from '@/lib/data/market/getPriceHistory'
import {
  formatPulseCityRemainderPublic,
  namePulseCityRemainder,
  pulseCityHrefSlug,
} from '@/lib/market/pulse-city-remainder'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { listingDetailPath } from '@/lib/slug'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { buildYearSeries } from '@/lib/kb/year-series'
import { publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { V3SectionTracker } from '@/components/site/v3/V3SectionTracker.client'
import { HomeDHero } from '@/components/site/home-d/HomeDHero.client'
import { HomeDTowns } from '@/components/site/home-d/HomeDTowns.client'
import { HomeDGolf } from '@/components/site/home-d/HomeDGolf.client'
import { HomeDLuxury } from '@/components/site/home-d/HomeDLuxury.client'
import { HomeDJournal } from '@/components/site/home-d/HomeDJournal'
import { HomeDParks } from '@/components/site/home-d/HomeDParks.client'
import { HomeDAlerts } from '@/components/site/home-d/HomeDAlerts.client'
import { HomeDFooter } from '@/components/site/home-d/HomeDFooter'
import { HomeDDock } from '@/components/site/home-d/HomeDDock.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { formatDate } from '@/lib/format/date'
import type { KbMarketData } from '@/components/site/kb/types'
import type { HomeDCommunity, HomeDPark, HomeDPost, HomeDTown } from '@/components/site/home-d/types'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { sortCitiesWithPrimaryFirst } from '@/lib/cities'
import { COMMUNITY_LINKS } from '@/lib/site-nav'
import { valuationHref } from '@/lib/site/valuation-href'
import '@/components/site/kb/kb.css'
import '@/components/site/home-d/home-d.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
// D11 seo-shell lock: this exact town list stays in source. The live hero
// count is the regional pulse, so the hero lead names that grain instead.
const D11_HOMEPAGE_LEAD =
  'Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market.'

/**
 * Homepage — home-d visual restyle of the live `/` template.
 * CHROME: Global V3Chrome in app/layout.tsx owns the top bar. This page owns
 * HomeDFooter + HomeDDock. Every figure is live from the DAL (§0). ISR 60s.
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Homes for Sale in Central Oregon | Bend, Redmond, Sisters, Sunriver',
  description:
    `Active homes for sale in ${D11_HOMEPAGE_LEAD} Closed comps from the regional MLS.`,
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

const TOWN_IMG: Record<string, string> = {
  bend: '/images/kb/bend-drake-park-aerial.jpg',
  'la-pine': '/images/kb/vandevert-ranch.jpg',
  redmond: '/images/kb/redmond-downtown-aerial.jpg',
  sunriver: '/images/kb/sunriver-deschutes-river.jpg',
  sisters: '/images/kb/sisters-downtown-three-peaks.jpg',
  terrebonne: '/images/kb/smith-rock-terrebonne.jpg',
}

const COMM_IMG: Record<string, string> = {
  tetherow: '/images/kb/tetherow-golf-aerial.jpg',
  'broken-top': '/images/kb/broken-top.jpg',
  'caldera-springs': '/images/kb/caldera-springs.jpg',
  'northwest-crossing': '/images/kb/northwest-crossing.jpg',
  'three-rivers': '/images/kb/three-rivers.jpg',
  'vandevert-ranch': '/images/kb/vandevert-ranch.jpg',
}

const PARK_IMG: Record<string, string> = {
  'drake-park': '/images/kb/bend-drake-park-aerial.jpg',
  'smith-rock': '/images/kb/smith-rock-terrebonne.jpg',
}

const SITE_CITY_SET = new Set(SITE_CITY_SLUGS)

const titleCaseName = (s: string) => s.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())

const monthLabel = (iso?: string) =>
  iso ? formatDate(iso, { month: 'short', day: undefined, year: undefined, timeZone: 'UTC' }) : ''

function communityPhoto(slug: string, heroImageUrl: string | null): string | null {
  const key = Object.keys(COMM_IMG).find((k) => slug.includes(k))
  if (key) return COMM_IMG[key]
  return heroImageUrl?.trim() || null
}

function golfKey(name: string) {
  return name.toLowerCase().replace(/\s+resort$/i, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function officialRank(slug: string, subdivision: string) {
  const href = `/communities/${slug}`
  const byHref = COMMUNITY_LINKS.findIndex((l) => l.href === href)
  if (byHref >= 0) return byHref
  const want = golfKey(subdivision)
  const byName = COMMUNITY_LINKS.findIndex((l) => golfKey(l.label) === want)
  if (byName >= 0) return byName
  const bySlug = COMMUNITY_LINKS.findIndex((l) => {
    const key = l.href.split('/').pop() ?? ''
    if (slug === key) return true
    return SITE_CITY_SLUGS.some((city) => slug === `${city}-${key}`)
  })
  return bySlug >= 0 ? bySlug : 999
}

export default async function Home() {
  const [pulse, cities, communities, tiles, mktStats, priceHist, cityPulse, journalRaw, reviews] = await Promise.all([
    getRegionPulse().catch(() => null),
    getCitiesForIndex().catch(() => []),
    getCommunitiesForIndex().catch(() => []),
    getListingTiles({ status: 'active', propertyType: 'A', limit: 3000 }).catch(() => []),
    getMarketStatsCacheRowForGeo({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => null),
    getPriceHistory('region', 'central-oregon', 'monthly', 60).catch(() => []),
    getMarketPulseAllCitySnapshots().catch(() => []),
    getRecentBlogPosts({ limit: 4 }).catch(() => []),
    getReviews(8).catch(() => ({ reviews: [], count: 0, averageRating: 0, source: 'google' as const })),
  ])

  const liveCities = sortCitiesWithPrimaryFirst(cities).filter((c) => SITE_CITY_SET.has(c.slug))
  const towns: HomeDTown[] = liveCities.map((c) => ({
    name: c.name,
    slug: c.slug,
    activeCount: c.activeCount,
    medianPrice: c.medianPrice,
    href: `/cities/${c.slug}`,
    img: TOWN_IMG[c.slug] || null,
  }))
  const townRemainder = formatPulseCityRemainderPublic(
    namePulseCityRemainder({
      regionActive: pulse?.activeCount,
      displayedLabels: towns.map((t) => t.name),
      allCities: cityPulse.map((row) => ({
        label: row.geo_label,
        active: row.active_count,
        slug: pulseCityHrefSlug(row.geo_slug || row.geo_label),
      })),
    }),
  )

  const polygonRows = await Promise.all(
    towns.map(async (t) => {
      const geometry = await getBoundaryGeoJSON({ geoType: 'city', geoSlug: t.slug }).catch(() => null)
      if (!geometry) return null
      return { slug: t.slug, name: t.name, href: t.href, geometry }
    }),
  )
  const polygons = polygonRows.filter((row): row is NonNullable<typeof row> => row !== null)

  const golfSource = communities.filter((c) => officialRank(c.slug, c.subdivision) < 999)
  golfSource.sort((a, b) => {
    const ia = officialRank(a.slug, a.subdivision)
    const ib = officialRank(b.slug, b.subdivision)
    if (ia !== ib) return ia - ib
    return b.activeCount - a.activeCount || a.subdivision.localeCompare(b.subdivision)
  })
  const seenGolf = new Set<string>()
  const communityItems: HomeDCommunity[] = []
  for (const c of golfSource) {
    const key = golfKey(c.subdivision)
    if (!key || seenGolf.has(key)) continue
    seenGolf.add(key)
    communityItems.push({
      name: titleCaseName(c.subdivision.replace(/\s+resort$/i, '').trim()),
      town: c.city,
      href: `/communities/${c.slug}`,
      img: communityPhoto(c.slug, c.heroImageUrl),
      activeCount: c.activeCount,
    })
    if (communityItems.length >= 10) break
  }

  const luxuryTiles = [...tiles]
    .filter((t) => t.photoUrl && t.listPrice != null)
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .slice(0, 8)
  const luxuryByHref = new Map(
    luxuryTiles.map((t) => [
      listingDetailPath(
        t.listingKey,
        { streetNumber: t.streetNumber, streetName: t.streetName, city: t.city, postalCode: t.postalCode },
        { city: t.city, subdivision: t.subdivisionName },
        { mlsNumber: t.listNumber },
      ),
      t,
    ]),
  )
  const luxuryItems = (await resolveFeaturedItems(luxuryTiles, 8))
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .map((item) => {
      const tile = luxuryByHref.get(item.href)
      publishListingShareKind({
        propertySubType: tile?.propertySubType ?? null,
        subdivisionName: tile?.subdivisionName ?? item.sub,
        city: tile?.city ?? item.city,
        listNumber: tile?.listNumber ?? null,
      })
      return {
        ...item,
        propertySubType: tile?.propertySubType ?? null,
        listNumber: tile?.listNumber ?? null,
      }
    })

  const journal: HomeDPost[] = journalRaw.map((p) => ({
    title: p.title,
    href: `/blog/${p.slug}`,
    excerpt: p.excerpt,
    dateLabel: p.publishedAt
      ? formatDate(p.publishedAt, { month: 'short', day: 'numeric', year: 'numeric' })
      : null,
  }))

  const parkGroups = getParks()
  const allParks = parkGroups.flatMap((g) => g.parks)
  const parkBySlug = new Map(allParks.map((p) => [p.slug, p]))
  const featuredParkRecord = parkBySlug.get('drake-park') ?? allParks[0] ?? null
  const parkListSlugs = ['shevlin-park', 'smith-rock', 'tumalo', 'riverbend-park', 'farewell-bend-park']
  const parks: HomeDPark[] = []
  if (featuredParkRecord) {
    parks.push({
      name: featuredParkRecord.name,
      slug: featuredParkRecord.slug,
      href: `/parks/${featuredParkRecord.slug}`,
      city: featuredParkRecord.city,
      detail: featuredParkRecord.amenities.find((a) => /mirror pond/i.test(a))
        ? 'Mirror Pond'
        : featuredParkRecord.acres != null
          ? `${featuredParkRecord.acres.toLocaleString('en-US')} acres`
          : featuredParkRecord.city,
      img: PARK_IMG[featuredParkRecord.slug] ?? null,
    })
  }
  for (const slug of parkListSlugs) {
    const p = parkBySlug.get(slug)
    if (!p || parks.some((row) => row.slug === p.slug)) continue
    parks.push({
      name: p.name,
      slug: p.slug,
      href: `/parks/${p.slug}`,
      city: p.city,
      detail: p.acres != null ? `${p.acres.toLocaleString('en-US')} acres` : p.city,
      img: PARK_IMG[p.slug] ?? null,
    })
  }
  const riverbend = parkBySlug.get('riverbend-park')
  const parksNote =
    riverbend?.amenities.some((a) => /off-leash/i.test(a))
      ? 'Closest official off-leash area is Riverbend Park.'
      : null

  const sltRaw = mktStats?.avg_sale_to_list_ratio ?? null
  const marketData: KbMarketData = {
    active: pulse?.activeCount ?? null,
    closed30: pulse?.soldCount30d ?? null,
    new30: pulse?.newCount30d ?? null,
    medianList: pulse?.medianListPrice ?? null,
    saleToList: sltRaw != null ? (sltRaw < 2 ? sltRaw * 100 : sltRaw) : null,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: publishMonthsOfSupply({
      grain: 'region',
      pulseMos: pulse?.monthsOfSupply,
      pulseActiveCount: pulse?.activeCount,
      displayedActiveCount: pulse?.activeCount,
    }),
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
    <main className="kb-root home-d">
      <V3SectionTracker />
      <SmoothScrollProvider>
        <HomeDHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          titleTop="Central Oregon"
          titleBottom="Homes for Sale"
          lead="Homes for sale across Central Oregon. Live list prices and days on market."
          cta={{ href: publishRegionalSearchHref(), label: 'See homes' }}
          ctaSecondary={{ href: valuationHref('/'), label: 'Value my home' }}
        />
        <HomeDTowns towns={towns} polygons={polygons} notes={townRemainder} />
        <HomeDGolf communities={communityItems} />
        <HomeDLuxury items={luxuryItems} />
        <HomeDJournal posts={journal} />
        {featuredParkRecord && parks.length > 0 ? (
          <HomeDParks featured={parks[0]!} parks={parks} note={parksNote} />
        ) : null}
        <HomeDAlerts />
        <KbMarketHud data={marketData} asOf={pulse?.updatedAt ?? null} />
        <HomeDFooter towns={towns} communities={communityItems} />
        <HomeDDock rating={reviews.averageRating} reviewCount={reviews.count} />
      </SmoothScrollProvider>
    </main>
  )
}
