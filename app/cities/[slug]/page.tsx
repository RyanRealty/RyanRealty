// brand-voice:exempt
/**
 * City landing page — Experience System Geo archetype v3.2 (Family 4 rework).
 *
 * Matt's 2026-06-10 verdict on v3.1 drove three changes here:
 *   1. VERIFIED city photography — the hero resolves through cityHero(), the
 *      Family 4 curated registry (lib/geo-images.ts) backed by per-city
 *      geo_tags in the asset library. Every photo was visually verified to
 *      show the actual city. A city with no verified photo renders the
 *      labeled regional fallback (mediaCaption) — never a wrong-city photo.
 *   2. Layout iteration — the city NAME leads in Amboqia display (FlyoverHero
 *      displayName treatment), an honest editorial "about" section with quick
 *      facts replaces nothing-above-the-grids, stacked tile walls removed
 *      (PriceRangeTiles + RelatedAreas tile grid gone), neighborhoods render
 *      as stat-rich ledger rows, nearby cities as editorial index rows with
 *      verified thumbnails. Phone-first (Matt reviews at 390px).
 *   3. Engagement tracking on every section (EngagedSection wrapper for
 *      server-rendered sections; experience modules track themselves).
 *
 * Section stack:
 *   1. BreadcrumbNav
 *   2. FlyoverHero — verified hero photo, city name HUGE in Amboqia + live
 *      stat overlay (activeCount count-up, median, days) + pulsing live-dot.
 *   3. LiveMarketBand — navy band, -mt-12 overlap moment.
 *   4. SectionNav — sticky anchor rail.
 *   5. About — honest editorial intro (getCityContent / data-driven fallback)
 *      + quick-facts ledger rows.
 *   6. Listings split-scroll spine (CommunityMapLedgerPane: ledger + map).
 *   7. PriceHistoryScrubber + PaymentSlider.
 *   8. MotivatedListings (conditional).
 *   9. Bend neighborhoods — stat ledger rows (live median/count where cached).
 *  10. Golf & master-planned communities — ledger rows.
 *  11. VideoHomesSection (conditional).
 *  12. OpenHousesGrid. 13. ActivityFeed. 14. Nearby cities editorial rows.
 *  15. ArticleGrid. 16. FAQBlock (FAQPage JSON-LD). 17. InlineValuationHook.
 *
 * Data ONLY through @/lib/data. All JSON-LD (City/Dataset/FAQPage/Breadcrumb)
 * retained from v3.1.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/city/parity.json
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getGeoSnapshot,
  getCityCommunitySnapshots,
  getAllCitySnapshots,
  getMarketPulse,
  getPriceHistory,
  getRecentBlogPosts,
  getGeoBoundaryMapData,
  getCityListings,
  getBendNeighborhoodStats,
} from '@/lib/data'
import bendNeighborhoodPolygons from '@/data/bend/bend-neighborhood-polygons.json'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { cityHero } from '@/lib/geo-images'
import { listingTileHref } from '@/lib/slug'
import { getCityMetadataByName } from '@/lib/data/cities/getCityMetadata'
import { getCityContent, buildDataDrivenCityAbout } from '@/lib/city-content'
import { CITY_QUICK_FACTS } from '@/lib/cities'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import {
  FlyoverHero,
  LiveMarketBand,
  SectionNav,
  InlineValuationHook,
  PriceHistoryScrubber,
  PaymentSlider,
  CommunityMapLedgerPane,
  ListingLedger,
  EngagedSection,
} from '@/components/site/experience'
import Image from 'next/image'
import OpenHousesGrid from '@/components/site/OpenHousesGrid'
import ActivityFeed from '@/components/site/ActivityFeed'
import { ArticleGrid } from '@/components/site/ArticleGrid'
import { Container, H2, Eyebrow, DisplayHeading } from '@/components/site/primitives'
import { FAQBlock } from '@/components/site/FAQBlock'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import MotivatedListings from '@/components/site/MotivatedListings'
import VideoHomesSection from '@/components/site/VideoHomesSection'
import { buildMarketFaq } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { ListingCardData } from '@/components/site/ListingCard'

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

export const dynamicParams = true
export const revalidate = 60

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tileToCardData(
  tile: Awaited<ReturnType<typeof getCityListings>>[number],
): ListingCardData {
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

function fmtK(n: number | null): string | null {
  return n != null ? `$${Math.round(n / 1000).toLocaleString()}K` : null
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()

  const cityName = snapshot.geoLabel
  const desc = `Homes for sale in ${cityName}, Oregon. Live market stats, neighborhoods, resort communities, open houses, and recent activity from a local brokerage.`

  return pageMetadata({
    title: `Homes for Sale in ${cityName}, Oregon`,
    description: desc,
    path: `/cities/${slug}`,
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CityDetailPage({ params }: Props) {
  const { slug } = await params

  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()

  const cityName = snapshot.geoLabel

  // Every fetch is timeout-guarded so a slow Supabase query degrades that
  // section instead of hanging the whole page.
  const [
    cityMeta,
    communitySnapshots,
    allCitySnapshots,
    pulse,
    priceHistory,
    blogPosts,
    boundaryMapData,
    bendNeighborhoodStats,
  ] = await Promise.all([
    withTimeoutFallback(getCityMetadataByName(cityName), null, 3000, 'city:meta'),
    withTimeoutFallback(getCityCommunitySnapshots(slug), [], 3000, 'city:commSnaps'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'city:allCities'),
    withTimeoutFallback(
      getMarketPulse({ geoType: 'city', geoSlug: slug }),
      null,
      3500,
      'city:pulse',
    ),
    withTimeoutFallback(
      getPriceHistory('city', slug, 'monthly', 24),
      [],
      4000,
      'city:priceHistory',
    ),
    withTimeoutFallback(getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'city:blog'),
    withTimeoutFallback(
      getGeoBoundaryMapData({ geoType: 'city', geoSlug: slug }),
      { polygon: null, pins: [] },
      4500,
      'city:boundary',
    ),
    slug === 'bend'
      ? withTimeoutFallback(getBendNeighborhoodStats(), [], 3500, 'city:nbhStats')
      : Promise.resolve([]),
  ])

  // Listing tiles for the Ledger (top 8 newest active in city)
  const cityListingTiles = await withTimeoutFallback(
    getCityListings(cityName, { status: 'active', sort: 'newest', limit: 8 }),
    [],
    4500,
    'city:listings',
  )
  const cityListingCards: ListingCardData[] = cityListingTiles.map(tileToCardData)

  // Hero photo — VERIFIED per-city imagery (Family 4 curation, lib/geo-images.ts).
  // DB override (cities.hero_image_url) wins when present; otherwise the curated
  // verified hero; cities without one get the labeled regional fallback.
  const heroImageUrl = cityMeta?.hero_image_url ?? null
  const curatedHero = cityHero(slug)
  const heroPhoto = heroImageUrl
    ? { src: heroImageUrl, alt: `${cityName}, Oregon`, verified: true }
    : curatedHero

  // Market stats
  const activeCount = pulse?.activeCount ?? 0
  const medianListPrice = pulse?.medianListPrice ?? snapshot.medianListPrice
  const medianDays = pulse?.medianDaysToPending ?? null
  const monthsOfSupply = pulse?.monthsOfSupply ?? null
  const marketVerdict = resolveVerdict(monthsOfSupply)

  const medianPriceK = fmtK(medianListPrice)
  const mosFmt = monthsOfSupply != null ? `${monthsOfSupply.toFixed(1)} mo` : null

  const auxStats: [
    { label: string; value: string; unit?: string },
    { label: string; value: string; unit?: string },
    { label: string; value: string; unit?: string },
  ] = [
    { label: 'Median list', value: medianPriceK ?? '—' },
    {
      label: 'Days to pending',
      value: medianDays != null ? `${Math.round(medianDays)}` : '—',
      unit: medianDays != null ? 'days' : undefined,
    },
    { label: 'Supply', value: mosFmt ?? '—' },
  ]

  // Honest editorial about copy: hand-written city content where it exists,
  // data-driven paragraphs (live counts + verified quick facts) otherwise.
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
        medianPrice: medianListPrice,
        communityCount: communitySnapshots.length,
      }).slice(0, 1)
  const quickFactRows: Array<{ label: string; value: string }> = [
    ...(quickFacts?.population ? [{ label: 'Population', value: quickFacts.population }] : []),
    ...(quickFacts?.elevation ? [{ label: 'Elevation', value: quickFacts.elevation }] : []),
    ...(quickFacts?.county ? [{ label: 'County', value: `${quickFacts.county} County` }] : []),
    ...(quickFacts?.schoolDistrict
      ? [{ label: 'School district', value: quickFacts.schoolDistrict }]
      : []),
    ...(quickFacts?.nearestAirport
      ? [{ label: 'Nearest airport', value: quickFacts.nearestAirport }]
      : []),
  ]

  // Drop the in-progress current month from price series — avoids a misleading
  // unfinished spike at the chart edge. Completed months only.
  const currentMonthKey = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    .slice(0, 7)
  const completePriceMonths = priceHistory.filter(
    (p) => p.periodStart.slice(0, 7) !== currentMonthKey,
  )
  const hasPriceHistory = completePriceMonths.length >= 4

  // Communities in this city — ledger rows with live counts
  const communitySfrBySlug = new Map<string, number>()
  for (const s of communitySnapshots) {
    const rawSlug = s.geoKey.includes(':') ? s.geoKey.split(':')[1] : s.geoKey
    communitySfrBySlug.set(rawSlug.replace(/\s+/g, '-').toLowerCase(), s.activeSfrCount)
  }

  const golfCommunityItems = (
    resortCommunitiesRegistry.communities as ReadonlyArray<{
      slug: string
      label: string
      city_slug: string
    }>
  )
    .filter((c) => c.city_slug === slug)
    .map((c) => ({
      name: c.label,
      href: `/communities/${c.slug}`,
      activeCount: communitySfrBySlug.get(c.slug) ?? null,
    }))

  // Bend neighborhoods — merge live westside stats with the full polygon list
  const liveStatsByHref = new Map(bendNeighborhoodStats.map((r) => [r.href, r]))
  const bendNeighborhoodItems =
    slug === 'bend'
      ? (bendNeighborhoodPolygons.communities as Array<{ slug: string; name?: string }>)
          .filter((c) => c.slug.startsWith('bend-'))
          .map((c) => {
            const nslug = c.slug.replace(/^bend-/, '')
            const href = `/cities/bend/${nslug}`
            const live = liveStatsByHref.get(href)
            return {
              name:
                live?.label ??
                c.name ??
                nslug
                  .split('-')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' '),
              href,
              activeCount: live?.activeCount ?? null,
              medianListPrice: live?.medianListPrice ?? null,
            }
          })
      : []

  const CENTRAL_OREGON_CITY_SLUGS = new Set([
    'bend',
    'redmond',
    'sisters',
    'la-pine',
    'sunriver',
    'madras',
    'prineville',
    'culver',
    'terrebonne',
    'tumalo',
    'powell-butte',
  ])

  // Nearby cities — editorial index rows with VERIFIED thumbnails (cityHero
  // registry; a city without a verified photo gets no thumbnail, never a
  // wrong-city image).
  const otherCityItems = allCitySnapshots
    .map((s) => ({ s, citySlug: s.geoKey.replace(/\s+/g, '-') }))
    .filter(({ citySlug }) => citySlug !== slug && CENTRAL_OREGON_CITY_SLUGS.has(citySlug))
    .slice(0, 8)
    .map(({ s, citySlug }) => {
      const hero = cityHero(citySlug)
      return {
        name: s.geoLabel,
        href: `/cities/${citySlug}`,
        activeCount: s.activeSfrCount > 0 ? s.activeSfrCount : null,
        medianListPrice: s.medianListPrice ?? null,
        imageUrl: hero.verified ? hero.src : null,
        imageAlt: hero.verified ? hero.alt : '',
      }
    })

  // Boundary map data
  const hasListings = cityListingCards.length > 0
  const hasMap = !!boundaryMapData.polygon

  const mapPolygons = boundaryMapData.polygon
    ? [{ slug, name: cityName, geometry: boundaryMapData.polygon }]
    : []

  const mapListings = boundaryMapData.pins.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    href: listingTileHref({ listingKey: p.listingKey }),
    price: p.price,
  }))

  // AI citability: verified market Q&A + structured data
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(cityName, pulse)

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
      description: `Live single-family home market data for ${cityName}, Oregon. Includes median list price, active inventory, months of supply, and median days to pending. Sourced from the regional MLS via Ryan Realty.`,
      url: `/cities/${slug}`,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  // SectionNav items — conditional on available content
  const navItems = [
    { id: 'market', label: 'Market' },
    ...(aboutParagraphs.length > 0 ? [{ id: 'about', label: 'About' }] : []),
    ...(hasListings || hasMap ? [{ id: 'listings', label: 'Homes for sale' }] : []),
    ...(hasPriceHistory ? [{ id: 'price-history', label: 'Price history' }] : []),
    ...(bendNeighborhoodItems.length > 0 ? [{ id: 'neighborhoods', label: 'Neighborhoods' }] : []),
    ...(golfCommunityItems.length > 0 ? [{ id: 'communities', label: 'Communities' }] : []),
    { id: 'open-houses', label: 'Open houses' },
    ...(faqs.length > 0 ? [{ id: 'faq', label: 'Questions' }] : []),
  ]

  return (
    <main className="min-h-screen bg-background">

      {/* AI-citability structured data: full breadcrumb + City entity + market Dataset. */}
      <MetadataBlock schemas={citySchemas} />

      <PageBreadcrumb
        trail={[{ label: 'Cities', href: '/cities' }, { label: cityName }]}
        includeJsonLd={false}
      />

      {/* Geo archetype hero: VERIFIED city photo, city name HUGE in Amboqia,
          live stat overlay with count-up. A regional-fallback photo is labeled
          honestly via mediaCaption — never a wrong-city implication. */}
      <div id="hero">
        <FlyoverHero
          slug={slug}
          displayName={cityName}
          headline={`Homes for sale in ${cityName}, Oregon`}
          activeCount={activeCount > 0 ? activeCount : null}
          medianPrice={medianListPrice}
          medianDays={medianDays}
          videoSrc={null}
          photoSrc={heroPhoto.src}
          photoAlt={heroPhoto.alt}
          mediaCaption={heroPhoto.verified ? undefined : 'Regional view · Cascade Range'}
          sectionId="hero"
        />
      </div>

      {/* LiveMarketBand: one giant living number (activeCount) + quiet aux stats.
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

      {/* Honest editorial intro — asymmetric split: prose + quick-facts ledger */}
      {aboutParagraphs.length > 0 ? (
        <EngagedSection
          id="about"
          pageType="geo"
          position={1}
          className="bg-background py-10 md:py-16"
        >
          <Container>
            <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7">
                <Eyebrow className="mb-2">{cityName} · Oregon</Eyebrow>
                <DisplayHeading
                  as="h2"
                  className="text-foreground mb-5"
                  style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.1rem)', letterSpacing: '-0.01em', lineHeight: 1.2 }}
                >
                  Living in {cityName}
                </DisplayHeading>
                {aboutParagraphs.map((p, i) => (
                  <p key={i} className="text-base leading-relaxed text-muted-foreground max-w-prose">
                    {p}
                  </p>
                ))}
              </div>
              {quickFactRows.length > 0 ? (
                <div className="lg:col-span-5">
                  <div className="divide-y divide-border border-t border-b border-border">
                    {quickFactRows.map((row) => (
                      <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
                        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          {row.label}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-foreground text-right">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Container>
        </EngagedSection>
      ) : null}

      {/* Split-scroll spine: listing ledger scrolls left, map pinned right (desktop). */}
      {(hasListings || hasMap) ? (
        <section id="listings" className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <Eyebrow className="mb-1">{cityName}</Eyebrow>
                <H2 className="text-2xl text-foreground">
                  Homes for sale
                </H2>
              </div>
              {boundaryMapData.pins.length > cityListingCards.length ? (
                <a
                  href={`/homes-for-sale/${slug}`}
                  className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  View all {boundaryMapData.pins.length}
                </a>
              ) : null}
            </div>

            <CommunityMapLedgerPane
              listings={cityListingCards}
              polygons={mapPolygons}
              mapListings={mapListings}
              zoom={12}
              mapHeight={600}
              viewAllHref={`/homes-for-sale/${slug}`}
              viewAllLabel={
                boundaryMapData.pins.length > cityListingCards.length
                  ? `View all ${boundaryMapData.pins.length} homes`
                  : `All homes for sale in ${cityName}`
              }
              communityName={cityName}
              totalCount={boundaryMapData.pins.length}
            />
          </Container>
        </section>
      ) : null}

      {/* Scrubbable price history + payment slider — editorial data section */}
      {(hasPriceHistory || medianListPrice != null) ? (
        <section
          id="price-history"
          className="border-t border-border bg-secondary/30 py-10 md:py-14"
        >
          <Container>
            <div className="grid gap-10 md:gap-12 lg:grid-cols-2 lg:gap-16">
              {hasPriceHistory ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Price history
                  </p>
                  <H2 className="text-xl text-foreground mb-6">
                    {cityName} median sale price
                  </H2>
                  <PriceHistoryScrubber
                    data={completePriceMonths}
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
                    What would a {cityName} home cost you monthly?
                  </H2>
                  <PaymentSlider
                    medianPrice={medianListPrice}
                    label={cityName}
                    sectionId="payment-slider"
                  />
                </div>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Motivated sellers — price-cut + remarks-signal homes in this city */}
      <MotivatedListings city={cityName} />

      {/* Bend neighborhoods — stat-rich editorial ledger rows (no tile grid).
          Live median + active count where the pulse cache has the neighborhood. */}
      {bendNeighborhoodItems.length > 0 ? (
        <EngagedSection
          id="neighborhoods"
          pageType="geo"
          position={4}
          className="border-t border-border bg-background py-10 md:py-14"
        >
          <Container>
            <div className="mb-6">
              <Eyebrow className="mb-1">{cityName}</Eyebrow>
              <H2 className="text-2xl text-foreground">
                Neighborhoods
              </H2>
            </div>
            <div className="divide-y divide-border max-w-3xl">
              {bendNeighborhoodItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between gap-4 py-3.5 hover:bg-secondary/40 transition-colors -mx-2 px-2 rounded-md"
                >
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary min-w-0">
                    {item.name}
                  </span>
                  <div className="flex items-baseline gap-4 flex-shrink-0">
                    {item.activeCount != null && item.activeCount > 0 ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {item.activeCount} {item.activeCount === 1 ? 'home' : 'homes'}
                      </span>
                    ) : null}
                    {item.medianListPrice != null ? (
                      <span className="font-display tabular-nums text-foreground text-base leading-none">
                        {fmtK(item.medianListPrice)}
                      </span>
                    ) : null}
                    <span
                      aria-hidden
                      className="text-muted-foreground/40 group-hover:text-primary transition-colors"
                    >
                      &rarr;
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </Container>
        </EngagedSection>
      ) : null}

      {/* Golf & master-planned communities — editorial ledger rows */}
      {golfCommunityItems.length > 0 ? (
        <EngagedSection
          id="communities"
          pageType="geo"
          position={5}
          className="border-t border-border bg-secondary/40 py-10 md:py-14"
        >
          <Container>
            <div className="mb-6">
              <Eyebrow className="mb-1">{cityName}</Eyebrow>
              <H2 className="text-2xl text-foreground">
                Golf and master-planned communities
              </H2>
            </div>
            <div className="divide-y divide-border max-w-3xl">
              {golfCommunityItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between gap-4 py-3.5 hover:bg-background/70 transition-colors -mx-2 px-2 rounded-md"
                >
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {item.activeCount != null && item.activeCount > 0 ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {item.activeCount} {item.activeCount === 1 ? 'home' : 'homes'}
                      </span>
                    ) : null}
                    <span
                      aria-hidden
                      className="text-muted-foreground/40 group-hover:text-primary transition-colors"
                    >
                      &rarr;
                    </span>
                  </div>
                </a>
              ))}
            </div>
            <div className="mt-6">
              <a
                href="/communities"
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                View all Central Oregon communities
              </a>
            </div>
          </Container>
        </EngagedSection>
      ) : null}

      {/* Homes with video tours in this city */}
      <VideoHomesSection
        scope={{ kind: 'city', city: cityName }}
        heading={`Video tours in ${cityName}`}
        viewAllHref={`/homes-for-sale/${slug}`}
        tone="muted"
      />

      {/* Open houses — next 14 days */}
      <div id="open-houses">
        <OpenHousesGrid
          city={cityName}
          daysAhead={14}
          eyebrow={`Upcoming in ${cityName}`}
          heading="Open houses"
          viewAllHref={`/open-houses/${slug}`}
        />
      </div>

      {/* Live activity feed — city-scoped */}
      <ActivityFeed
        city={cityName}
        eyebrow={`Live activity · ${cityName}`}
        heading={`What is happening in ${cityName}`}
        viewAllLabel="Full market pulse"
        viewAllHref="/housing-market"
      />

      {/* Nearby Central Oregon cities — editorial index rows with VERIFIED thumbnails */}
      {otherCityItems.length > 0 ? (
        <EngagedSection
          id="nearby"
          pageType="geo"
          position={8}
          className="border-t border-border bg-secondary/30 py-10 md:py-14"
        >
          <Container>
            <div className="mb-6">
              <Eyebrow className="mb-1">Central Oregon</Eyebrow>
              <H2 className="text-2xl text-foreground">Explore other cities</H2>
            </div>
            <div className="divide-y divide-border max-w-3xl">
              {otherCityItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-4 py-3 hover:bg-background/70 transition-colors -mx-2 px-2 rounded-md"
                >
                  {item.imageUrl ? (
                    <span className="relative block h-12 w-16 flex-shrink-0 overflow-hidden rounded-md">
                      <Image
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </span>
                  ) : (
                    <span className="block h-12 w-16 flex-shrink-0 rounded-md bg-primary/10" aria-hidden />
                  )}
                  <span className="flex-1 min-w-0 text-sm font-semibold text-foreground group-hover:text-primary">
                    {item.name}
                  </span>
                  <div className="flex items-baseline gap-4 flex-shrink-0">
                    {item.activeCount != null ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {item.activeCount} {item.activeCount === 1 ? 'home' : 'homes'}
                      </span>
                    ) : null}
                    {item.medianListPrice != null ? (
                      <span className="font-display tabular-nums text-foreground text-base leading-none hidden sm:inline">
                        {fmtK(item.medianListPrice)}
                      </span>
                    ) : null}
                    <span
                      aria-hidden
                      className="text-muted-foreground/40 group-hover:text-primary transition-colors"
                    >
                      &rarr;
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </Container>
        </EngagedSection>
      ) : null}

      {/* Guides and insights — recent blog posts, city-prioritized */}
      <ArticleGrid
        items={blogPosts}
        eyebrow="Guides and insights"
        heading={`${cityName} real estate, explained`}
        subtitle={`Local housing news, neighborhood deep dives, and buyer and seller guides for ${cityName} and Central Oregon.`}
        tone="muted"
      />

      {/* Common questions: verified market Q&A + FAQPage JSON-LD */}
      {faqs.length > 0 ? (
        <div id="faq">
          <FAQBlock
            items={faqs}
            eyebrow="Common questions"
            title={`${cityName} real estate questions`}
          />
        </div>
      ) : null}

      {/* City-specific seller CTA band (InlineValuationHook) */}
      <InlineValuationHook
        communityName={cityName}
        sectionId="valuation-hook"
      />

    </main>
  )
}
