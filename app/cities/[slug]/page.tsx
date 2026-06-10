// brand-voice:exempt
/**
 * City landing page — Experience System Geo archetype v3.1
 *
 * Experience System 1.0.0, 2026-06-10.
 *
 * Section stack (Geo archetype):
 *   1. BreadcrumbNav
 *   2. FlyoverHero — POSTER mode (no city flyovers rendered yet); passes
 *      the city hero image as photoSrc with videoSrc=null. Live aggregate
 *      numerals overlay (activeCount + medianPrice) + pulsing live-dot.
 *   3. LiveMarketBand — navy band, giant living activeCount count-up, 3 aux
 *      stats; -mt-12 overlap moment pulls band into hero bottom edge.
 *   4. SectionNav — sticky anchor rail, appears on scroll past hero.
 *   5. ListingLedger (top 8 newest active) + CommunityMapLedgerPane —
 *      split-scroll spine: ledger left, map sticky right on desktop.
 *   6. PriceHistoryScrubber — scrubbable recharts AreaChart (completed months).
 *   7. PaymentSlider — inline mortgage estimate around city median.
 *   8. Neighborhoods editorial index — linked rows w/ counts (Bend only).
 *   9. Golf & master-planned communities — ledger rows w/ counts.
 *  10. Open houses grid.
 *  11. ArticleGrid — blog posts city-scoped.
 *  12. FAQBlock — verified market Q&A + FAQPage JSON-LD.
 *  13. InlineValuationHook — replaces CTABar on Geo pages.
 *
 * Data ONLY through @/lib/data. No raw .from() calls.
 *
 * Mockup reference: design_system/ryan-realty/ui_kits/city/index.html
 * Parity contract:  design_system/ryan-realty/ui_kits/city/parity.json
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
  getGeoTileImages,
  getGeoBoundaryMapData,
  getSurfaceImage,
  getCityListings,
  getListingTiles,
} from '@/lib/data'
import bendNeighborhoodPolygons from '@/data/bend/bend-neighborhood-polygons.json'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { golfCommunityImage, pickGeoImage, cityHero } from '@/lib/geo-images'
import { listingTileHref } from '@/lib/slug'
import { getCityMetadataByName } from '@/lib/data/cities/getCityMetadata'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import {
  FlyoverHero,
  LiveMarketBand,
  SectionNav,
  InlineValuationHook,
  PriceHistoryScrubber,
  PaymentSlider,
  CommunityMapLedgerPane,
  ListingLedger,
} from '@/components/site/experience'
import OpenHousesGrid from '@/components/site/OpenHousesGrid'
import { RelatedAreas, type RelatedAreaItem } from '@/components/site/RelatedAreas'
import ActivityFeed from '@/components/site/ActivityFeed'
import { ArticleGrid } from '@/components/site/ArticleGrid'
import { Container, H2, Eyebrow } from '@/components/site/primitives'
import { FAQBlock } from '@/components/site/FAQBlock'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import MotivatedListings from '@/components/site/MotivatedListings'
import VideoHomesSection from '@/components/site/VideoHomesSection'
import PriceRangeTiles from '@/components/site/PriceRangeTiles'
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
    geoImages,
    boundaryMapData,
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
      getGeoTileImages([
        slug,
        'bend',
        'redmond',
        'sisters',
        'sunriver',
        'prineville',
        'tumalo',
        'smith-rock',
      ]),
      {} as Record<string, string[]>,
      3000,
      'city:images',
    ),
    withTimeoutFallback(
      getGeoBoundaryMapData({ geoType: 'city', geoSlug: slug }),
      { polygon: null, pins: [] },
      4500,
      'city:boundary',
    ),
  ])

  // Listing tiles for the Ledger (top 8 newest active in city)
  const cityListingTiles = await withTimeoutFallback(
    getCityListings(cityName, { status: 'active', sort: 'newest', limit: 8 }),
    [],
    4500,
    'city:listings',
  )
  const cityListingCards: ListingCardData[] = cityListingTiles.map(tileToCardData)

  // Hero image resolution — identical to existing page; preserves IMG-01 rule.
  const heroImageUrl = cityMeta?.hero_image_url ?? null
  const approvedCityHero = await withTimeoutFallback(
    getSurfaceImage('hero', { geoTags: [slug], seed: `city/${slug}`, fallback: null }),
    null,
    2500,
    'city:heroImg',
  )
  const heroPhoto = heroImageUrl
    ? { src: heroImageUrl, alt: `${cityName}, Oregon` }
    : approvedCityHero
    ? { src: approvedCityHero, alt: `Central Oregon scenery around ${cityName}.` }
    : cityHero(slug)

  // Market stats
  const activeCount = pulse?.activeCount ?? 0
  const medianListPrice = pulse?.medianListPrice ?? snapshot.medianListPrice
  const medianDays = pulse?.medianDaysToPending ?? null
  const monthsOfSupply = pulse?.monthsOfSupply ?? null
  const marketVerdict = resolveVerdict(monthsOfSupply)

  const medianPriceK =
    medianListPrice != null ? `$${Math.round(medianListPrice / 1000).toLocaleString()}K` : null
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

  // Drop the in-progress current month from price series — avoids a misleading
  // unfinished spike at the chart edge. Completed months only.
  const currentMonthKey = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    .slice(0, 7)
  const completePriceMonths = priceHistory.filter(
    (p) => p.periodStart.slice(0, 7) !== currentMonthKey,
  )
  const hasPriceHistory = completePriceMonths.length >= 4

  // Community data — existing logic unchanged
  const communitySfrBySlug = new Map<string, number>()
  for (const s of communitySnapshots) {
    const rawSlug = s.geoKey.includes(':') ? s.geoKey.split(':')[1] : s.geoKey
    communitySfrBySlug.set(rawSlug.replace(/\s+/g, '-').toLowerCase(), s.activeSfrCount)
  }

  const golfCommunityItems: RelatedAreaItem[] = (
    resortCommunitiesRegistry.communities as ReadonlyArray<{
      slug: string
      label: string
      city_slug: string
    }>
  )
    .filter((c) => c.city_slug === slug)
    .map((c) => {
      const active = communitySfrBySlug.get(c.slug) ?? null
      return {
        name: c.label,
        href: `/communities/${c.slug}`,
        activeCount: active && active > 0 ? active : null,
        imageUrl:
          golfCommunityImage(c.slug) ?? pickGeoImage(geoImages[slug], slug) ?? null,
      }
    })

  // Bend neighborhoods (designated polygons only)
  const bendNeighborhoodItems: RelatedAreaItem[] =
    slug === 'bend'
      ? (bendNeighborhoodPolygons.communities as Array<{ slug: string; name?: string }>)
          .filter((c) => c.slug.startsWith('bend-'))
          .map((c) => {
            const nslug = c.slug.replace(/^bend-/, '')
            return {
              name:
                c.name ??
                nslug
                  .split('-')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' '),
              href: `/cities/bend/${nslug}`,
              activeCount: null,
              imageUrl:
                pickGeoImage(geoImages['bend'], nslug) ??
                pickGeoImage(geoImages['central-oregon'], nslug),
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

  const otherCityItems: RelatedAreaItem[] = allCitySnapshots
    .map((s) => ({ s, citySlug: s.geoKey.replace(/\s+/g, '-') }))
    .filter(({ citySlug }) => citySlug !== slug && CENTRAL_OREGON_CITY_SLUGS.has(citySlug))
    .slice(0, 8)
    .map(({ s, citySlug }) => ({
      name: s.geoLabel,
      href: `/cities/${citySlug}`,
      activeCount: s.activeSfrCount > 0 ? s.activeSfrCount : null,
      imageUrl:
        pickGeoImage(geoImages[citySlug], citySlug) ??
        pickGeoImage(geoImages['central-oregon'], citySlug),
    }))

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

      {/* Breadcrumb */}
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          includeJsonLd={false}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Cities', href: '/cities' },
            { label: cityName },
          ]}
        />
      </Container>

      {/* Geo archetype hero: city photo (POSTER mode — no city flyovers yet) +
          Amboqia live stat overlay + count-up.
          videoSrc=null explicitly disables video; photoSrc is the resolved
          city hero image. FlyoverHero degrades cleanly to the static photo path. */}
      <div id="hero">
        <FlyoverHero
          slug={slug}
          headline={`Homes for sale in ${cityName}, Oregon`}
          activeCount={activeCount > 0 ? activeCount : null}
          medianPrice={medianListPrice}
          medianDays={medianDays}
          videoSrc={null}
          photoSrc={heroPhoto.src}
          photoAlt={heroPhoto.alt}
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

      {/* Split-scroll spine: listing ledger scrolls left, map pinned right (desktop).
          The CommunityMapLedgerPane handles both the ListingLedger and the
          NeighborhoodMap wired for hover sync. */}
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

      {/* Homes with video tours in this city */}
      <VideoHomesSection
        scope={{ kind: 'city', city: cityName }}
        heading={`Video tours in ${cityName}`}
        viewAllHref={`/homes-for-sale/${slug}`}
        tone="muted"
      />

      {/* Browse by price range */}
      <PriceRangeTiles />

      {/* Bend neighborhoods — editorial index rows (not tile grid) */}
      {bendNeighborhoodItems.length > 0 ? (
        <section
          id="neighborhoods"
          className="border-t border-border bg-background py-10 md:py-14"
        >
          <Container>
            <div className="mb-6">
              <Eyebrow className="mb-1">{cityName}</Eyebrow>
              <H2 className="text-2xl text-foreground">
                Neighborhoods
              </H2>
            </div>
            {/* Editorial index rows — hairline rules, no tile grid */}
            <div className="divide-y divide-border max-w-2xl">
              {bendNeighborhoodItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between gap-4 py-3 hover:text-primary transition-colors"
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
          </Container>
        </section>
      ) : null}

      {/* Golf & master-planned communities — editorial index rows */}
      {golfCommunityItems.length > 0 ? (
        <section
          id="communities"
          className="border-t border-border bg-secondary/40 py-10 md:py-14"
        >
          <Container>
            <div className="mb-6">
              <Eyebrow className="mb-1">{cityName}</Eyebrow>
              <H2 className="text-2xl text-foreground">
                Golf and master-planned communities
              </H2>
            </div>
            <div className="divide-y divide-border max-w-2xl">
              {golfCommunityItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between gap-4 py-3 hover:text-primary transition-colors"
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
        </section>
      ) : null}

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

      {/* Cross-nav to other Central Oregon cities */}
      {otherCityItems.length > 0 ? (
        <RelatedAreas
          eyebrow="Central Oregon"
          title="Explore other cities"
          items={otherCityItems}
          cols={4}
        />
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
