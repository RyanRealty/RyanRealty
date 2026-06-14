// brand-voice:exempt
/**
 * Community (resort / master-planned) detail page -- Geo archetype v3.1.
 *
 * Experience System 1.0.0, 2026-06-09, de-tiling pass 2026-06-09.
 *
 * What changed in v3.1 (de-tiling + interaction):
 *   - ListingLedger replaces the uniform ListingCard grid (1 dominant hero +
 *     hairline ledger rows, Amboqia price big, edge-bleed photo thumb).
 *   - CommunityMapLedgerPane adds the split-scroll spine: map sticky right
 *     (desktop) while ledger scrolls left; mobile stacks normally.
 *   - LiveMarketBand updated: one GIANT living activeCount (Amboqia ~6rem)
 *     counts up on viewport entry; aux stats quiet beside it.
 *   - Overlap moment: LiveMarketBand overlaps the hero bottom edge by 3rem
 *     (-mt-12 applied to the band wrapper).
 *   - PriceHistoryScrubber: scrubbable recharts AreaChart for price history
 *     (lazy-loaded client island, from getPriceHistory DAL).
 *   - PaymentSlider: inline mortgage slider around community median (P&I only,
 *     rate assumption labeled per CLAUDE.md §0).
 *   - useCountUp wired into FlyoverHero activeCount stat.
 *   - All new modules fire module_interact events via useEngagementTracking.
 *
 * Data ONLY through @/lib/data and @/app/actions/communities. No raw .from() calls.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCommunityBySlug } from '@/app/actions/communities'
import {
  getMarketPulse,
  getMarketStats,
  getRecentBlogPosts,
  getGeoTileImages,
  getGeoBoundaryMapData,
  getCommunitySubdivisions,
  getAllCitySnapshots,
  getListingTiles,
  getCommunityListings,
  getResortCommunityBySlug,
  getBlogPostsBySlugs,
  getResortBoundaryGeoJSON,
  getPriceHistory,
} from '@/lib/data'
import type { AmenityBlogPost } from '@/lib/data'
import type { CommunitySubdivision } from '@/lib/data'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { communityImage, pickGeoImage } from '@/lib/geo-images'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { pageMetadata } from '@/lib/site/page-metadata'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import {
  FlyoverHero,
  LiveMarketBand,
  SectionNav,
  InlineValuationHook,
  PriceHistoryScrubber,
  PaymentSlider,
  CommunityMapLedgerPane,
} from '@/components/site/experience'
import PriceRangeTiles from '@/components/site/PriceRangeTiles'
import OpenHousesGrid from '@/components/site/OpenHousesGrid'
import MotivatedListings from '@/components/site/MotivatedListings'
import VideoHomesSection from '@/components/site/VideoHomesSection'
import { RelatedAreas, type RelatedAreaItem } from '@/components/site/RelatedAreas'
import ActivityFeed from '@/components/site/ActivityFeed'
import { ArticleGrid } from '@/components/site/ArticleGrid'
import { CommunityRichContent } from '@/components/site/CommunityRichContent'
import { Container, H2, Eyebrow } from '@/components/site/primitives'
import type { ListingCardData } from '@/components/site/ListingCard'
import { FAQBlock } from '@/components/site/FAQBlock'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { buildMarketFaq } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import { listingTileHref } from '@/lib/slug'

export const dynamicParams = true
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()

  const desc =
    community.activeCount > 0
      ? `${community.activeCount} homes for sale in ${community.name}. Live market stats, open houses, and local market context for ${community.name} in ${community.city}, Oregon.`
      : `Explore ${community.name} in ${community.city}, Oregon. Market overview and recent activity from a local brokerage.`

  return pageMetadata({
    title: `${community.name} Homes for Sale | ${community.city}, Oregon`,
    description: desc,
    path: `/communities/${slug}`,
  })
}

const CENTRAL_OREGON_CITY_SLUGS = new Set([
  'bend', 'redmond', 'sisters', 'la-pine', 'sunriver',
  'madras', 'prineville', 'culver', 'terrebonne', 'tumalo', 'powell-butte',
])

function tileToCardData(tile: Awaited<ReturnType<typeof getListingTiles>>[number]): ListingCardData {
  const streetNum = tile.streetNumber ?? ''
  const streetName = tile.streetName ?? ''
  const addressLine = [streetNum, streetName].filter(Boolean).join(' ') || 'Address on request'

  const cityParts: string[] = []
  if (tile.city) cityParts.push(tile.city + ', OR')
  if (tile.postalCode) cityParts.push(tile.postalCode)
  if (tile.subdivisionName) cityParts.push(tile.subdivisionName)
  const cityLine = cityParts.join(' · ')

  return {
    listingKey: tile.listingKey,
    href: listingTileHref(tile),
    photoUrl: tile.photoUrl ?? null,
    price: tile.listPrice ?? null,
    addressLine,
    cityLine,
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
    badge:
      tile.status === 'Coming Soon'
        ? { kind: 'new' as const, label: 'Coming Soon' }
        : tile.priceDropCount && tile.priceDropCount > 0
        ? { kind: 'drop' as const, label: 'Price reduced' }
        : undefined,
  }
}

function resolveVerdict(mos: number | null): 'seller' | 'balanced' | 'buyer' | null {
  if (mos == null) return null
  if (mos <= 4) return 'seller'
  if (mos >= 6) return 'buyer'
  return 'balanced'
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()

  const cityName = community.city
  const citySlug = community.citySlug

  // Every fetch is timeout-guarded so a slow Supabase query degrades that one
  // section instead of hanging the whole page.
  const [pulse, stats, blogPosts, geoImages, boundaryMapData, allCitySnapshots, communitySubdivisions, resortBoundary, priceHistory] =
    await Promise.all([
      withTimeoutFallback(getMarketPulse({ geoType: 'neighborhood', geoSlug: slug }), null, 3500, 'comm:pulse'),
      // Neighborhood closed-sale stats from market_stats_cache (market_pulse_live
      // has no neighborhood rows) — the verified source for days-on-market +
      // median sold when the pulse band would otherwise show dashes.
      withTimeoutFallback(getMarketStats({ geoType: 'neighborhood', geoSlug: slug, periodType: 'rolling_365d' }), null, 3500, 'comm:stats'),
      withTimeoutFallback(getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'comm:blog'),
      withTimeoutFallback(getGeoTileImages([citySlug, slug, 'central-oregon']), {} as Record<string, string[]>, 3000, 'comm:images'),
      withTimeoutFallback(getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: slug }), { polygon: null, pins: [] }, 4500, 'comm:boundary'),
      withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'comm:cities'),
      withTimeoutFallback(getCommunitySubdivisions({ geoType: 'neighborhood', geoSlug: slug }), [] as CommunitySubdivision[], 3000, 'comm:subs'),
      withTimeoutFallback(getResortBoundaryGeoJSON(slug), null, 4500, 'comm:resortBoundary'),
      withTimeoutFallback(getPriceHistory('neighborhood', slug, 'monthly', 24), [], 4000, 'comm:priceHistory'),
    ])

  const content = await withTimeoutFallback(getResortCommunityContent(slug), null, 2500, 'comm:content')

  const amenityBlogSlugs = (content?.amenities ?? [])
    .map((a) => a.blog_slug)
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
  const postsBySlug: Record<string, AmenityBlogPost> =
    amenityBlogSlugs.length > 0
      ? await getBlogPostsBySlugs(amenityBlogSlugs).catch(() => ({}))
      : {}

  const registryEntry = getResortCommunityBySlug(slug)

  const boundaryListingKeys = boundaryMapData.pins.map((p) => p.listingKey)
  let communityListingTiles =
    boundaryListingKeys.length > 0
      ? await withTimeoutFallback(
          getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', limit: 24 }),
          [],
          4500,
          'comm:tiles',
        )
      : []
  if (communityListingTiles.length === 0) {
    communityListingTiles = await withTimeoutFallback(
      getCommunityListings(community.name, { limit: 24 }),
      [],
      4500,
      'comm:listings',
    )
  }
  const communityListingCards: ListingCardData[] = communityListingTiles.map(tileToCardData)

  const activeCount = pulse?.activeCount ?? community.activeCount
  const medianListPrice = pulse?.medianListPrice ?? community.medianPrice
  // Days: pulse (days-to-pending) for cities; market_stats_cache (days-on-market)
  // for neighborhoods where pulse has no row. Track the source for an honest label.
  const medianDays = pulse?.medianDaysToPending ?? stats?.medianDaysOnMarket ?? null
  const daysLabel = pulse?.medianDaysToPending != null ? 'Days to pending' : 'Days on market'
  const monthsOfSupply = pulse?.monthsOfSupply ?? null
  const marketVerdict = resolveVerdict(monthsOfSupply)

  const mosFmt = monthsOfSupply != null
    ? `${monthsOfSupply.toFixed(1)} mo`
    : null

  const medianPriceK = medianListPrice != null
    ? `$${(Math.round(medianListPrice / 1000) * 1000).toLocaleString()}`
    : null

  // Data-accuracy rule (§0): render ONLY verified stats — never a dash. Build the
  // band from real values in priority order and let LiveMarketBand show however
  // many exist (months-of-supply is unavailable at neighborhood level, so the
  // third slot falls back to verified closed-sale data instead of showing "—").
  type Aux = { label: string; value: string; unit?: string }
  const auxStats: Aux[] = []
  if (medianPriceK) auxStats.push({ label: 'Median list', value: medianPriceK })
  if (medianDays != null) auxStats.push({ label: daysLabel, value: `${Math.round(medianDays)}`, unit: 'days' })
  if (mosFmt) auxStats.push({ label: 'Months of supply', value: mosFmt })
  else if (stats?.medianSalePrice != null) auxStats.push({ label: 'Median sold', value: `$${(Math.round(stats.medianSalePrice / 1000) * 1000).toLocaleString()}` })
  else if (stats?.soldCount != null) auxStats.push({ label: 'Sold, 1 yr', value: `${stats.soldCount}` })

  // FlyoverHero: video by convention at /videos/flyovers/<slug>/hero.mp4
  const heroPhotoSrc =
    communityImage(slug) ??
    pickGeoImage(geoImages[citySlug], slug) ??
    pickGeoImage(geoImages['central-oregon'], slug) ??
    community.heroImageUrl ??
    null

  const mainCommunities: RelatedAreaItem[] = (
    resortCommunitiesRegistry.communities as ReadonlyArray<{
      slug: string
      label: string
      city_slug: string
    }>
  )
    .filter((c) => c.slug !== slug)
    .slice(0, 6)
    .map((c) => ({
      name: c.label,
      href: `/communities/${c.slug}`,
      activeCount: null,
      imageUrl:
        communityImage(c.slug) ??
        pickGeoImage(geoImages[c.city_slug], c.slug) ??
        pickGeoImage(geoImages['central-oregon'], c.slug),
    }))

  const otherCityItems: RelatedAreaItem[] = allCitySnapshots
    .map((s) => ({ s, cs: s.geoKey.replace(/\s+/g, '-') }))
    .filter(({ cs }) => CENTRAL_OREGON_CITY_SLUGS.has(cs))
    .slice(0, 8)
    .map(({ s, cs }) => ({
      name: s.geoLabel,
      href: `/cities/${cs}`,
      activeCount: s.activeSfrCount > 0 ? s.activeSfrCount : null,
      imageUrl:
        pickGeoImage(geoImages[cs], cs) ??
        pickGeoImage(geoImages['central-oregon'], cs),
    }))

  const subNeighborhoods = registryEntry?.sub_neighborhoods ?? []
  const hasSubNeighborhoods = subNeighborhoods.length > 0

  const marketInput = pulse ?? {
    activeCount: community.activeCount ?? null,
    medianListPrice: community.medianPrice ?? null,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(community.name, marketInput)

  const communitySchemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Communities', url: '/communities' },
        { name: community.name, url: `/communities/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Place',
      name: community.name,
      description: `${community.name}, a community in ${cityName}, Oregon. Homes for sale and live single-family market data.`,
      url: `/communities/${slug}`,
      address: { city: cityName, state: 'OR', country: 'US' },
      containedInPlace: cityName,
      hasMap: boundaryMapData.polygon ? `/communities/${slug}` : undefined,
      additionalProperty: datasetVariables.length > 0 ? datasetVariables : undefined,
    },
  ]
  if (datasetVariables.length > 0) {
    communitySchemas.push({
      type: 'dataset',
      name: `${community.name} real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description: `Live single-family home market data for ${community.name} in ${cityName}, Oregon. Includes median list price, active inventory, months of supply, and median days to pending. Sourced from the regional MLS via Ryan Realty.`,
      url: `/communities/${slug}`,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${community.name}, ${cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  // SectionNav items (only show sections that will actually render)
  const hasListings = communityListingCards.length > 0
  const hasMap = !!(resortBoundary || boundaryMapData.polygon)
  const hasPriceHistory = priceHistory.length >= 2
  const navItems = [
    { id: 'market', label: 'Market' },
    { id: 'about', label: 'About' },
    ...(hasSubNeighborhoods ? [{ id: 'neighborhoods', label: 'Neighborhoods' }] : []),
    ...(hasListings ? [{ id: 'listings', label: 'Homes for sale' }] : []),
    ...(communitySubdivisions.length > 0 ? [{ id: 'subdivisions', label: 'Subdivisions' }] : []),
    { id: 'open-houses', label: 'Open houses' },
    { id: 'communities', label: 'Communities' },
    { id: 'faq', label: 'FAQ' },
  ]

  // Map polygons for the split-scroll pane
  const mapPolygons = resortBoundary
    ? [{ slug, name: community.name, geometry: resortBoundary }]
    : communitySubdivisions.length > 0
    ? communitySubdivisions.map((s) => ({
        slug: s.slug,
        name: s.label,
        geometry: s.geometry,
        href: `/subdivisions/${s.slug}`,
      }))
    : boundaryMapData.polygon
    ? [{ slug, name: community.name, geometry: boundaryMapData.polygon }]
    : []

  const mapListings = boundaryMapData.pins.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    href: listingTileHref({ listingKey: p.listingKey }),
    price: p.price,
  }))

  return (
    <main className="min-h-screen bg-background">

      {/* AI-citability structured data: full breadcrumb + community Place + market Dataset. */}
      <MetadataBlock schemas={communitySchemas} />

      {/* Breadcrumb */}
      <PageBreadcrumb trail={[{ label: 'Communities', href: '/communities' },
            { label: community.name }]} includeJsonLd={false} />

      {/* Geo archetype hero: video flyover + Amboqia live stat overlay + count-up */}
      <div id="hero">
        <FlyoverHero
          slug={slug}
          headline={`Homes for Sale in ${community.name}`}
          activeCount={activeCount > 0 ? activeCount : null}
          medianPrice={medianListPrice}
          medianDays={medianDays}
          daysLabel={daysLabel}
          photoSrc={heroPhotoSrc ?? undefined}
          photoAlt={`${community.name} in ${cityName}, Oregon`}
          sectionId="hero"
        />
      </div>

      {/* LiveMarketBand v2: one giant living number (activeCount) + quiet aux stats.
          Overlap moment: -mt-12 pulls the navy band up into the hero bottom edge. */}
      <div id="market" className="-mt-12 relative z-10">
        <LiveMarketBand
          heroStat={activeCount > 0 ? activeCount : null}
          heroLabel="Active homes"
          auxStats={auxStats}
          marketVerdict={marketVerdict}
          reportHref="/housing-market"
          reportLabel="Full market report"
          sectionId="market"
        />
      </div>

      {/* Sticky in-page anchor rail */}
      <SectionNav items={navItems} />

      {/* Rich verified content (overview + amenities + drive times + golf/HOA + builders) */}
      <div id="about">
        <CommunityRichContent content={content} name={community.name} postsBySlug={postsBySlug} />
      </div>

      {/* Scrubbable price history chart + payment slider (editorial data section) */}
      {(hasPriceHistory || medianListPrice != null) ? (
        <section className="border-t border-border bg-secondary/30 py-10 md:py-14">
          <Container>
            <div className="grid gap-10 md:gap-12 lg:grid-cols-2 lg:gap-16">
              {hasPriceHistory ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Price history
                  </p>
                  <H2 className="text-xl text-foreground mb-6">
                    {community.name} median sale price
                  </H2>
                  <PriceHistoryScrubber
                    data={priceHistory}
                    sectionId="price-scrubber"
                    height={220}
                  />
                </div>
              ) : null}
              {medianListPrice != null ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Estimate your payment
                  </p>
                  <H2 className="text-xl text-foreground mb-6">
                    What would a {community.name} home cost you monthly?
                  </H2>
                  <PaymentSlider
                    medianPrice={medianListPrice}
                    label={community.name}
                    sectionId="payment-slider"
                  />
                </div>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Sub-neighborhoods registry content */}
      {registryEntry ? (
        <section id="neighborhoods" className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                About {community.name}
              </p>
              <H2 className="text-2xl text-foreground mb-4">
                {community.name} at a glance
              </H2>

              {hasSubNeighborhoods ? (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Neighborhoods within {community.name}
                  </h3>
                  {/* Two-column editorial index rows instead of tile grid */}
                  <div className="divide-y divide-border">
                    {subNeighborhoods.map((sn) => (
                      <div
                        key={sn.slug}
                        className="py-4 flex items-start gap-6"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-base">{sn.name}</p>
                          {sn.type ? (
                            <p className="text-xs text-muted-foreground mt-0.5">{sn.type}</p>
                          ) : null}
                          {sn.description ? (
                            <p className="text-sm text-foreground leading-relaxed mt-2">
                              {sn.description}
                            </p>
                          ) : null}
                          {sn.lot_size_note ? (
                            <p className="text-xs text-muted-foreground mt-1.5">
                              Lot sizes: {sn.lot_size_note}
                            </p>
                          ) : null}
                        </div>
                        {(sn.hoa_annual_estimate || sn.hoa_master_annual) ? (
                          <div className="flex-shrink-0 text-right">
                            {sn.hoa_annual_estimate ? (
                              <p className="text-sm tabular-nums text-foreground">
                                ${sn.hoa_annual_estimate.toLocaleString()}/yr HOA
                              </p>
                            ) : null}
                            {sn.hoa_master_annual ? (
                              <p className="text-xs text-muted-foreground tabular-nums">
                                +${sn.hoa_master_annual.toLocaleString()}/yr master
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {registryEntry.subdivision_aliases.length > 1 ? (
                <div className="mt-8">
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    MLS subdivision names used within {community.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Listings inside {community.name} may appear under these MLS subdivision names.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {registryEntry.subdivision_aliases.map((alias) => (
                      <span
                        key={alias}
                        className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Split-scroll spine: map sticky right, listing ledger scrolls left.
          This section replaces the old separate map + card-grid sections. */}
      {hasListings ? (
        <section id="listings" className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <Eyebrow className="mb-1">{community.name}</Eyebrow>
                <H2 className="text-2xl text-foreground">
                  Homes for sale
                </H2>
              </div>
              {boundaryMapData.pins.length > communityListingCards.length ? (
                <a
                  href={`/search?subdivision=${encodeURIComponent(community.name)}&city=${encodeURIComponent(cityName)}`}
                  className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  View all {boundaryMapData.pins.length}
                </a>
              ) : null}
            </div>

            <CommunityMapLedgerPane
              listings={communityListingCards}
              polygons={mapPolygons}
              mapListings={mapListings}
              zoom={14}
              mapHeight={600}
              viewAllHref={
                boundaryMapData.pins.length > communityListingCards.length
                  ? `/search?subdivision=${encodeURIComponent(community.name)}&city=${encodeURIComponent(cityName)}`
                  : undefined
              }
              viewAllLabel={
                boundaryMapData.pins.length > communityListingCards.length
                  ? `View all ${boundaryMapData.pins.length} homes`
                  : undefined
              }
              communityName={community.name}
              totalCount={boundaryMapData.pins.length}
            />
          </Container>
        </section>
      ) : hasMap ? (
        /* No listings but we have a boundary -- show the map standalone */
        <div id="map" className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <Eyebrow className="mb-1">{community.name}</Eyebrow>
            <H2 className="text-2xl text-foreground mb-6">Community map</H2>
            <div className="rounded-xl overflow-hidden border border-border shadow-sm">
              {/* NeighborhoodMap server wrapper handles dynamic import */}
              {/* Inline import to avoid a circular reference */}
              <CommunityMapLedgerPane
                listings={[]}
                polygons={mapPolygons}
                mapListings={mapListings}
                zoom={14}
                mapHeight={520}
                communityName={community.name}
              />
            </div>
          </Container>
        </div>
      ) : null}

      {/* Subdivisions within the community (editorial index rows) */}
      {communitySubdivisions.length > 0 ? (
        <section id="subdivisions" className="border-t border-border bg-secondary/40 py-10 md:py-14">
          <Container>
            <div className="mb-6">
              <Eyebrow className="mb-1">{community.name}</Eyebrow>
              <H2 className="text-2xl text-foreground">
                Subdivisions
              </H2>
            </div>
            {/* Two-column editorial index rows */}
            <div className="divide-y divide-border max-w-2xl">
              {communitySubdivisions.map((sub) => (
                <a
                  key={sub.slug}
                  href={`/subdivisions/${sub.slug}`}
                  className="group flex items-center justify-between gap-4 py-3 hover:text-primary transition-colors"
                >
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary">{sub.label}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {sub.activeHomes > 0
                        ? `${sub.activeHomes} ${sub.activeHomes === 1 ? 'home' : 'homes'}`
                        : 'No active listings'}
                    </span>
                    <span aria-hidden className="text-muted-foreground/40 group-hover:text-primary transition-colors">&rarr;</span>
                  </div>
                </a>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Motivated sellers in this city */}
      <MotivatedListings city={cityName} />

      {/* Homes with video tours in this community */}
      <VideoHomesSection
        scope={{ kind: 'community', subdivision: community.name }}
        heading={`Video tours in ${community.name}`}
        tone="muted"
      />

      {/* Browse by price range */}
      <PriceRangeTiles />

      {/* Open houses */}
      <div id="open-houses">
        <OpenHousesGrid
          city={cityName}
          daysAhead={14}
          eyebrow={`Upcoming in ${community.name}`}
          heading="Open houses"
          viewAllHref={`/open-houses/${citySlug}`}
        />
      </div>

      {/* 6 main golf/master-planned communities + view all */}
      {mainCommunities.length > 0 ? (
        <div id="communities">
          <RelatedAreas
            eyebrow="Central Oregon"
            title="Golf and master-planned communities"
            items={mainCommunities}
            tone="default"
            cols={3}
            viewAllHref="/communities"
            viewAllLabel="View all communities"
          />
        </div>
      ) : null}

      {/* Live activity feed */}
      <ActivityFeed
        city={cityName}
        eyebrow={`Live activity · ${cityName}`}
        heading={`What is happening in ${cityName}`}
        viewAllLabel="Full market pulse"
        viewAllHref="/housing-market"
      />

      {/* Cross-nav to other Central Oregon cities */}
      {otherCityItems.length > 0 ? (
        <RelatedAreas
          eyebrow="Central Oregon"
          title="Explore other cities"
          items={otherCityItems}
          cols={4}
        />
      ) : null}

      {/* Blog posts */}
      <ArticleGrid
        items={blogPosts}
        eyebrow="Guides and insights"
        heading={`${community.name} real estate, explained`}
        subtitle={`Local housing news, market data, and buyer and seller guides for ${community.name} and ${cityName}.`}
        tone="muted"
      />

      {/* Common questions: verified market Q&A + FAQPage JSON-LD */}
      {faqs.length > 0 ? (
        <div id="faq">
          <FAQBlock
            items={faqs}
            eyebrow="Common questions"
            title={`${community.name} real estate questions`}
          />
        </div>
      ) : null}

      {/* Community-specific seller CTA band (InlineValuationHook) */}
      <InlineValuationHook
        communityName={community.name}
        sectionId="valuation-hook"
      />

    </main>
  )
}
