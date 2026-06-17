/**
 * City page — KB (kinetic-brutalist) design, Phase 9 wave 1 of the convergence
 * program (docs/KB_CONVERGENCE_ROADMAP.md). Reuses the SAME section library as the
 * homepage (components/site/kb/*), fed CITY-scoped DAL data, never forked
 * (ci:kb-single-source G50). KbNav + KbFooter carry the chrome (default chrome
 * hidden for ^/cities/[slug] via HideChrome). Bend reuses the homepage hero video;
 * other cities use their VERIFIED cityHero photo with a labeled regional fallback.
 *
 * THE PAGE CONTRACT (docs/KB_CONVERGENCE_ROADMAP.md): KB design + SEO for Google &
 * LLMs (pageMetadata + MetadataBlock JSON-LD: Breadcrumb/City/Dataset/FAQPage) +
 * tracking (CityPageTracker + section/interaction events). Every figure live (§0).
 *
 * Section stack: breadcrumb · hero · about · featured · map · ticker · market ·
 * neighborhoods · communities · golf/master-planned · open houses · activity ·
 * explore-other-cities · guides(blog) · testimonials · team · sell · FAQ · footer.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/city/parity.json (KB set).
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getGeoSnapshot,
  getMarketPulse,
  getRegionPulse,
  getPriceHistory,
  getCityListings,
  getBendNeighborhoodStats,
  getCityCommunitySnapshots,
  getAllCitySnapshots,
  getRecentBlogPosts,
} from '@/lib/data'
import { getMarketStatsCacheRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { getCityMetadataByName } from '@/lib/data/cities/getCityMetadata'
import { getCityContent, buildDataDrivenCityAbout } from '@/lib/city-content'
import { CITY_QUICK_FACTS } from '@/lib/cities'
import bendNeighborhoodPolygons from '@/data/bend/bend-neighborhood-polygons.json'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { cityHero } from '@/lib/geo-images'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { listingTileHref } from '@/lib/slug'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { buildMarketFaq } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbAbout } from '@/components/site/kb/KbAbout'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbTicker } from '@/components/site/kb/KbTicker.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbCommunities } from '@/components/site/kb/KbCommunities.client'
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbActivity } from '@/components/site/kb/KbActivity.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import CityPageTracker from '@/components/city/CityPageTracker'
import type {
  KbTownItem,
  KbCommunityItem,
  KbTickerItem,
  KbFeaturedItem,
  KbMarketData,
} from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import communityVideoManifest from '@/data/city-hero-videos.resolved.json'
import '@/components/site/kb/kb.css'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

// Bend reuses the homepage Old Mill drone video; other cities use their verified
// cityHero photo (resolved below) with a labeled regional fallback.
const CITY_HERO_VIDEO: Record<string, { videoSrc: string; posterSrc: string }> = {
  bend: { videoSrc: '/videos/hero-optimized.mp4', posterSrc: '/images/hero/hero-old-mill-master-4k.jpg' },
}

// Curated marquee communities per city (img + Area Guide video), resolved against
// live counts from getCommunitiesForIndex — same pattern as the homepage.
const CITY_COMMUNITIES: Record<string, { match: string; img: string; videoSlug?: string }[]> = {
  bend: [
    { match: 'tetherow', img: '/images/kb/tetherow-golf-aerial.jpg', videoSlug: 'tetherow' },
    { match: 'broken top', img: '/images/kb/broken-top.jpg', videoSlug: 'broken-top' },
    { match: 'northwest crossing', img: '/images/kb/northwest-crossing.jpg', videoSlug: 'northwest-crossing' },
  ],
  sunriver: [{ match: 'caldera', img: '/images/kb/caldera-springs.jpg', videoSlug: 'caldera-springs' }],
}

const CENTRAL_OREGON_CITY_SLUGS = new Set([
  'bend', 'redmond', 'sisters', 'la-pine', 'sunriver', 'madras',
  'prineville', 'culver', 'terrebonne', 'tumalo', 'powell-butte',
])

const monthLabel = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) : ''
const fmtK = (n: number | null): string | null => (n != null ? `$${Math.round(n / 1000).toLocaleString()}K` : null)

function openHouseWhen(eventDate: string, start: string | null, end: string | null): string {
  const day = new Date(eventDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  const t = (s: string | null) => {
    if (!s) return ''
    const [h, m] = s.split(':')
    const hr = Number(h)
    const ap = hr >= 12 ? 'pm' : 'am'
    const h12 = hr % 12 === 0 ? 12 : hr % 12
    return m && m !== '00' ? `${h12}:${m}${ap}` : `${h12}${ap}`
  }
  const range = start && end ? `${t(start)}-${t(end)}` : start ? t(start) : ''
  return [day, range].filter(Boolean).join(' · ')
}

const ACTIVITY_KIND: Record<string, { kind: string; label: string }> = {
  new_listing: { kind: 'new', label: 'New' },
  price_drop: { kind: 'price_drop', label: 'Price cut' },
  status_pending: { kind: 'pending', label: 'Pending' },
  status_closed: { kind: 'sold', label: 'Sold' },
  back_on_market: { kind: 'new', label: 'Back on market' },
  status_expired: { kind: 'expired', label: 'Off market' },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  return pageMetadata({
    title: `Homes for Sale in ${cityName}, Oregon`,
    description: `Search homes for sale in ${cityName}, Oregon with live single-family market data, neighborhoods, resort communities, open houses, and recent activity from a local brokerage.`,
    path: `/cities/${slug}`,
  })
}

export default async function CityDetailPage({ params }: Props) {
  const { slug } = await params

  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel

  const [
    pulse, regionPulse, mktStats, priceHist, communities, neighborhoodStats,
    communitySnapshots, allCitySnapshots, blogPosts, openHouses, activity,
    cityMeta, mapTiles, featuredTiles,
  ] = await Promise.all([
    withTimeoutFallback(getMarketPulse({ geoType: 'city', geoSlug: slug }), null, 3500, 'city:pulse'),
    withTimeoutFallback(getRegionPulse(), null, 3000, 'city:regionPulse'),
    withTimeoutFallback(getMarketStatsCacheRowForGeo({ geoSlug: slug }), null, 3000, 'city:mktStats'),
    withTimeoutFallback(getPriceHistory('city', slug, 'monthly', 13), [], 4000, 'city:priceHistory'),
    withTimeoutFallback(getCommunitiesForIndex(), [], 3500, 'city:communities'),
    slug === 'bend'
      ? withTimeoutFallback(getBendNeighborhoodStats(), [], 5000, 'city:nbhStats')
      : Promise.resolve([] as Awaited<ReturnType<typeof getBendNeighborhoodStats>>),
    withTimeoutFallback(getCityCommunitySnapshots(slug), [], 3000, 'city:commSnaps'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'city:allCities'),
    withTimeoutFallback(getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'city:blog'),
    withTimeoutFallback(getOpenHousesWithListings({ city: cityName }), [], 3500, 'city:openHouses'),
    withTimeoutFallback(getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }), [], 3500, 'city:activity'),
    withTimeoutFallback(getCityMetadataByName(cityName), null, 3000, 'city:meta'),
    withTimeoutFallback(getCityListings(cityName, { status: 'active', sort: 'newest', limit: 1500 }), [], 4500, 'city:mapTiles'),
    withTimeoutFallback(getCityListings(cityName, { status: 'active', sort: 'price-desc', limit: 14 }), [], 4500, 'city:featured'),
  ])

  // Hero — Bend reuses the homepage video; otherwise the VERIFIED cityHero photo
  // (a city without one renders the LABELED regional fallback, never a wrong-city
  // photo). DB hero_image_url override wins. (§D86)
  const activeCount = pulse?.activeCount ?? 0
  const curatedHero = cityHero(slug)
  const heroImageUrl = cityMeta?.hero_image_url ?? null
  const heroPhoto = heroImageUrl ? { src: heroImageUrl, verified: true } : curatedHero
  const heroVideoCfg = CITY_HERO_VIDEO[slug]
  const heroVideoSrc = heroVideoCfg?.videoSrc ?? null
  const heroPosterSrc = heroVideoCfg?.posterSrc ?? heroPhoto.src
  const mediaCaption = heroVideoSrc || heroPhoto.verified ? undefined : 'Regional view · Cascade Range'

  // About — hand-written city content where it exists, else data-driven paragraphs.
  const cityContent = getCityContent(cityName)
  const quickFacts = CITY_QUICK_FACTS[cityName] ?? null
  const aboutParagraphs: string[] = cityContent?.description
    ? [cityContent.description]
    : buildDataDrivenCityAbout({
        cityName,
        population: quickFacts?.population ?? null,
        elevation: quickFacts?.elevation ?? null,
        county: quickFacts?.county ?? null,
        schoolDistrict: quickFacts?.schoolDistrict ?? null,
        nearestAirport: quickFacts?.nearestAirport ?? null,
        activeCount,
        medianPrice: pulse?.medianListPrice ?? snapshot.medianListPrice,
        communityCount: communitySnapshots.length,
      }).slice(0, 2)
  const aboutFacts: { label: string; value: string }[] = [
    ...(quickFacts?.population ? [{ label: 'Population', value: quickFacts.population }] : []),
    ...(pulse?.medianListPrice ? [{ label: 'Median list', value: fmtK(pulse.medianListPrice) ?? '—' }] : []),
    { label: 'Active single-family', value: activeCount.toLocaleString('en-US') },
    ...(pulse?.medianDaysToPending != null ? [{ label: 'Median to pending', value: `${Math.round(pulse.medianDaysToPending)} days` }] : []),
    ...(quickFacts?.elevation ? [{ label: 'Elevation', value: quickFacts.elevation }] : []),
    ...(quickFacts?.county ? [{ label: 'County', value: `${quickFacts.county} County` }] : []),
  ]

  // Featured + map + ticker (shared resolver).
  const featuredItems: KbFeaturedItem[] = await resolveFeaturedItems(featuredTiles)
  const mapFeatures = mapTiles
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(t.lng), Number(t.lat)] as [number, number] },
      properties: {
        p: t.listPrice, bd: t.beds, ba: t.baths, sf: t.sqft,
        a: [t.streetNumber, t.streetName].filter(Boolean).join(' '),
        sub: t.subdivisionName ?? '', city: t.city ?? '', img: t.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }
  // Neighborhood boundary polygons drawn on the city map (Bend has them).
  const neighborhoodPolygons =
    slug === 'bend'
      ? {
          type: 'FeatureCollection' as const,
          features: (bendNeighborhoodPolygons.communities as Array<{ name: string; geometry: unknown }>).map((c) => ({
            type: 'Feature' as const,
            geometry: c.geometry,
            properties: { name: c.name },
          })),
        }
      : undefined
  const tickerItems: KbTickerItem[] = mapTiles.slice(0, 6).map((t) => ({
    price: t.listPrice,
    address: [t.streetNumber, t.streetName].filter(Boolean).join(' '),
    town: t.city ?? '',
  }))

  // Neighborhoods ledger — designated Bend polygons + live westside stats. (§D83)
  const liveStatsByHref = new Map(neighborhoodStats.map((r) => [r.href, r]))
  const bendNeighborhoodItems: KbTownItem[] =
    slug === 'bend'
      ? (bendNeighborhoodPolygons.communities as Array<{ slug: string; name?: string }>)
          .filter((c) => c.slug.startsWith('bend-'))
          .map((c) => {
            const nslug = c.slug.replace(/^bend-/, '')
            const href = `/cities/bend/${nslug}`
            const live = liveStatsByHref.get(href)
            return {
              name: live?.label ?? c.name ?? nslug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              href,
              activeCount: live?.activeCount ?? 0,
              medianPrice: live?.medianListPrice ?? null,
              img: '',
            }
          })
      : []

  // Golf & master-planned communities — a SEPARATE ledger from neighborhoods. (§D85)
  const communitySfrBySlug = new Map<string, number>()
  for (const s of communitySnapshots) {
    const rawSlug = s.geoKey.includes(':') ? s.geoKey.split(':')[1]! : s.geoKey
    communitySfrBySlug.set(rawSlug.replace(/\s+/g, '-').toLowerCase(), s.activeSfrCount)
  }
  const golfCommunityItems: KbTownItem[] = (
    resortCommunitiesRegistry.communities as ReadonlyArray<{ slug: string; label: string; city_slug: string }>
  )
    .filter((c) => c.city_slug === slug)
    .map((c) => ({
      name: c.label,
      href: `/communities/${c.slug}`,
      activeCount: communitySfrBySlug.get(c.slug) ?? 0,
      medianPrice: null,
      img: '',
    }))

  // Marquee communities (curated, with video) — the visual rail.
  const cityComms = communities.filter((c) => c.city?.toLowerCase().trim() === cityName.toLowerCase().trim())
  const communityVideos = communityVideoManifest as Record<string, { video?: string } | undefined>
  const communityItems: KbCommunityItem[] = (CITY_COMMUNITIES[slug] ?? [])
    .map((f): KbCommunityItem | null => {
      const c = cityComms.find((x) => x.subdivision.toLowerCase().includes(f.match))
      if (!c) return null
      const cv = f.videoSlug ? communityVideos[f.videoSlug] : undefined
      return {
        name: c.subdivision, activeCount: c.activeCount, town: cityName,
        href: `/communities/${c.slug}`, img: f.img,
        video: cv?.video ? { url: cv.video, embedType: 'video-tag' as const } : null,
      }
    })
    .filter((x): x is KbCommunityItem => x !== null)

  // Explore other cities — editorial index with VERIFIED thumbnails. (§D84, §D87)
  const otherCityItems: KbTownItem[] = allCitySnapshots
    .map((s) => ({ s, citySlug: s.geoKey.replace(/\s+/g, '-') }))
    .filter(({ citySlug }) => citySlug !== slug && CENTRAL_OREGON_CITY_SLUGS.has(citySlug))
    .slice(0, 8)
    .map(({ s, citySlug }) => {
      const hero = cityHero(citySlug)
      return {
        name: s.geoLabel,
        href: `/cities/${citySlug}`,
        activeCount: s.activeSfrCount > 0 ? s.activeSfrCount : 0,
        medianPrice: s.medianListPrice ?? null,
        img: hero.verified ? hero.src : '',
      }
    })

  // Open houses (next, in this city) → KB cards.
  const openHouseItems = openHouses.slice(0, 6).map((oh) => ({
    href: listingTileHref({
      listingKey: oh.listing_key, streetNumber: oh.street_number, streetName: oh.street_name, city: oh.city,
    }),
    photoUrl: oh.photo_url,
    price: oh.list_price,
    address: oh.unparsed_address ?? [oh.street_number, oh.street_name].filter(Boolean).join(' '),
    cityLine: [oh.city, oh.subdivision_name].filter(Boolean).join(' · '),
    beds: oh.beds_total,
    baths: oh.baths_full,
    sqft: oh.living_area,
    whenLabel: openHouseWhen(oh.event_date, oh.start_time, oh.end_time),
  }))

  // Live activity → KB rows.
  const activityItems = activity.slice(0, 8).map((a) => {
    const km = ACTIVITY_KIND[a.event_type] ?? { kind: a.event_type, label: a.event_type }
    return {
      kind: km.kind,
      label: km.label,
      address: [a.StreetNumber, a.StreetName].filter(Boolean).join(' ') || 'Address on request',
      cityLine: [a.City, a.SubdivisionName].filter(Boolean).join(' · '),
      price: a.ListPrice ?? null,
      href: listingTileHref({ listingKey: a.listing_key, streetNumber: a.StreetNumber ?? null, streetName: a.StreetName ?? null, city: a.City ?? null }),
      whenLabel: monthLabel(a.event_at),
    }
  })

  // Guides / blog. (§D80 — getRecentBlogPosts)
  const articlePosts = blogPosts.map((p) => ({
    title: p.title,
    href: `/blog/${p.slug}`,
    excerpt: p.excerpt,
    imageUrl: p.heroImageUrl,
    dateLabel: p.publishedAt
      ? new Date(p.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      : null,
  }))

  // Market HUD.
  const sltRaw = mktStats?.avg_sale_to_list_ratio ?? null
  const marketData: KbMarketData = {
    active: pulse?.activeCount ?? null,
    closed30: pulse?.closedLast30Days ?? null,
    new30: null,
    medianList: pulse?.medianListPrice ?? null,
    saleToList: sltRaw != null ? (sltRaw < 2 ? sltRaw * 100 : sltRaw) : null,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: pulse?.monthsOfSupply ?? null,
    trend: priceHist.filter((p) => p.medianSalePrice != null).map((p) => ({ label: monthLabel(p.periodStart), value: p.medianSalePrice as number })),
    byTown: bendNeighborhoodItems.filter((n) => n.medianPrice != null).map((n) => ({ name: n.name, median: n.medianPrice as number })),
    countyMedian: regionPulse?.medianListPrice ?? null,
  }

  // AI-citability: verified market Q&A + structured data.
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(cityName, pulse)
  const hasMap = mapFeatures.length > 0
  const citySchemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
        { name: cityName, url: `/cities/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'City',
      name: cityName,
      description: `Homes for sale and live single-family market data for ${cityName}, Oregon.`,
      url: `/cities/${slug}`,
      address: { city: cityName, state: 'OR', country: 'US' },
      containedInPlace: 'Central Oregon',
      hasMap: hasMap ? `/cities/${slug}` : undefined,
      additionalProperty: datasetVariables.length > 0 ? datasetVariables : undefined,
    },
  ]
  if (datasetVariables.length > 0) {
    citySchemas.push({
      type: 'dataset',
      name: `${cityName}, Oregon real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description: `Live single-family home market data for ${cityName}, Oregon. Median list price, active inventory, months of supply, and median days to pending. Sourced from the regional MLS via Ryan Realty.`,
      url: `/cities/${slug}`,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  return (
    <main className="kb-root">
      <KbNav />
      <CityPageTracker
        cityName={cityName}
        slug={slug}
        listingCount={activeCount}
        medianPrice={pulse?.medianListPrice ?? null}
        communityCount={communitySnapshots.length}
      />
      <MetadataBlock schemas={citySchemas} />
      <KbBreadcrumb trail={[{ label: 'Cities', href: '/cities' }, { label: cityName }]} />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow={`${cityName} · Oregon`}
          titleTop="Homes in"
          titleBottom={cityName}
          lead={`in ${cityName}, Oregon, with the live market behind every one.`}
          videoSrc={heroVideoSrc}
          posterSrc={heroPosterSrc}
          mediaCaption={mediaCaption}
        />
        {aboutParagraphs.length > 0 ? (
          <KbAbout eyebrow={`${cityName} · Oregon`} heading={`Living in ${cityName}`} paragraphs={aboutParagraphs} facts={aboutFacts} />
        ) : null}
        <KbFeatured items={featuredItems} />
        <KbListingMap
          geojson={mapGeo}
          totalActive={pulse?.activeCount ?? mapFeatures.length}
          fitToFeatures
          showRegionMarkers={false}
          polygons={neighborhoodPolygons}
          eyebrow={cityName}
          title={`Homes in\n${cityName}`}
          subtitle={`Every active single-family listing in ${cityName}, on the real terrain. Click any dot for the price, the beds, and the street.`}
        />
        <KbTicker items={tickerItems} />
        <KbMarketHud data={marketData} />
        <KbExploreTowns
          towns={bendNeighborhoodItems}
          eyebrow={`${cityName} · Neighborhoods`}
          title="Neighborhoods"
          sectionId="neighborhoods"
          cta={{ href: `/homes-for-sale/${slug}`, label: `All ${cityName} homes` }}
        />
        <KbCommunities communities={communityItems} />
        <KbExploreTowns
          towns={golfCommunityItems}
          eyebrow={`${cityName} · Communities`}
          title="Golf and master-planned communities"
          sectionId="communities-ledger"
          cta={{ href: '/communities', label: 'Every community' }}
        />
        <KbOpenHouses items={openHouseItems} eyebrow={`${cityName} · This week`} heading="Open houses" viewAllHref={`/open-houses/${slug}`} />
        <KbActivity items={activityItems} eyebrow={`Live · ${cityName}`} heading={`What is happening in ${cityName}`} viewAllHref="/housing-market" viewAllLabel="Full market pulse" />
        <KbExploreTowns
          towns={otherCityItems}
          eyebrow="Central Oregon"
          title="Explore other cities"
          sectionId="nearby"
          cta={{ href: '/cities', label: 'Every city' }}
        />
        <KbArticles
          posts={articlePosts}
          eyebrow="Guides and insights"
          heading={`${cityName} real estate, explained`}
          subtitle={`Local housing news, neighborhood deep dives, and buyer and seller guides for ${cityName} and Central Oregon.`}
        />
        <KbTestimonials reviews={TESTIMONIALS.slice(0, 8)} />
        <KbTeam />
        <KbSell
          data={{
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: pulse?.closedLast30Days ?? null,
          }}
        />
        {faqs.length > 0 ? (
          <div id="faq">
            <FAQBlock items={faqs} eyebrow="Common questions" title={`${cityName} real estate questions`} />
          </div>
        ) : null}
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
