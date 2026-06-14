/**
 * Bend neighborhood detail page — Wave 3 rebuild.
 *
 * Data ONLY through @/lib/data and @/app/actions/cities.
 * Composes the same site-v2 blocks as app/cities/[slug]/page.tsx
 * and app/communities/[slug]/page.tsx.
 *
 * Section order:
 *   1.  MetadataBlock schemas={neighborhoodSchemas}  (PRESERVED VERBATIM)
 *   2.  BreadcrumbNav (site-v2)
 *   3.  HeroBlock — headline + data-driven lede from neighborhood object
 *   4.  Stat band — active listings / median list price / avg DOM
 *   5.  SiteNeighborhoodMap — boundary polygon + in-boundary pins (PRESERVED)
 *   6.  ListingCard grid — in-boundary active listings, cap 24
 *   7.  CommunityRichContent (PRESERVED VERBATIM)
 *   8.  FAQBlock (PRESERVED VERBATIM)
 *   9.  CTABar (site-v2 navy)
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getNeighborhoodBySlug } from '@/app/actions/cities'
import {
  getGeoBoundaryMapData,
  getListingTiles,
  getSurfaceImage,
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { pageMetadata } from '@/lib/site/page-metadata'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { HeroBlock } from '@/components/site/HeroBlock'
import { CTABar } from '@/components/site/CTABar'
import { NeighborhoodMap as SiteNeighborhoodMap } from '@/components/site/NeighborhoodMap'
import { CommunityRichContent } from '@/components/site/CommunityRichContent'
import VideoHomesSection from '@/components/site/VideoHomesSection'
import { FAQBlock } from '@/components/site/FAQBlock'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { VideoTourRail } from '@/components/site/VideoTourRail'
import { Container, Section, Grid, Stack, Eyebrow, H2 } from '@/components/site/primitives'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import MotivatedListings from '@/components/site/MotivatedListings'
import { buildMarketFaq } from '@/lib/site/market-faq'
import { listingTileHref } from '@/lib/slug'
import type { SchemaInput } from '@/lib/site/json-ld'

export const dynamicParams = true
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string; neighborhoodSlug: string }>> {
  return []
}

type Props = { params: Promise<{ slug: string; neighborhoodSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const title =
    neighborhood.seoTitle ||
    `Homes for Sale in ${neighborhood.name} | ${neighborhood.cityName}, Oregon`

  const description =
    neighborhood.seoDescription ||
    (neighborhood.activeCount > 0
      ? `${neighborhood.activeCount} homes for sale in ${neighborhood.name}, ${neighborhood.cityName}. Median list price ${neighborhood.medianPrice != null ? `$${(Math.round(neighborhood.medianPrice / 1000) * 1000).toLocaleString()}` : 'available on request'}. Local market data from Ryan Realty.`
      : `Explore ${neighborhood.name} in ${neighborhood.cityName}, Oregon. Live market data and listings from a local brokerage.`)

  return pageMetadata({
    title,
    description,
    path: `/cities/${citySlug}/${neighborhoodSlug}`,
  })
}

/** Map a listing tile from getListingTiles to ListingCardData for ListingCard. */
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

export default async function NeighborhoodDetailPage({ params }: Props) {
  const { slug: citySlug, neighborhoodSlug } = await params

  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  // Distinct approved hero so each neighborhood does not reuse the Old Mill
  // banner. Prefer a photo tagged for this neighborhood or its city, else a
  // regional Central Oregon shot, seeded by route for a stable per-page choice.
  const neighborhoodHero = await getSurfaceImage('hero', {
    geoTags: [neighborhoodSlug, `${citySlug}-${neighborhoodSlug}`, citySlug],
    seed: `${citySlug}/${neighborhoodSlug}`,
    fallback: '/brand/hero/hero-old-mill-master-4k.jpg',
  })

  // Boundary polygon slug for Bend neighborhoods: "{citySlug}-{neighborhoodSlug}"
  const boundaryNeighborhoodSlug = `${citySlug}-${neighborhoodSlug}`

  const [richContent, boundaryMapData] = await Promise.all([
    // Rich verified content from data/resort-community-[slug].json.
    // Null until a config is authored — CommunityRichContent handles null gracefully.
    getResortCommunityContent(boundaryNeighborhoodSlug).catch(() => null),
    // Boundary polygon + spatially-correct listing pins via listings_in_boundary RPC.
    getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }).catch(
      () => ({ polygon: null, pins: [] })
    ),
  ])

  // In-boundary listing cards. Same pattern as the community page:
  // hand the spatial pin keys to getListingTiles so the shown set is the
  // authoritative boundary-scoped inventory, not a subdivision-name guess.
  const boundaryListingKeys = boundaryMapData.pins.map((p) => p.listingKey)
  const listingTiles =
    boundaryListingKeys.length > 0
      ? await getListingTiles({
          listingKeys: boundaryListingKeys,
          status: 'active',
          // Cover every map pin (not just the 24 shown cards) so each pin can be
          // tagged with its subdivision for the map's hover-highlight legend.
          limit: 250,
        }).catch(() => [])
      : []
  const listingCards: ListingCardData[] = listingTiles.slice(0, 24).map(tileToCardData)
  // listing_key -> subdivision, to group the map pins by subdivision.
  const subdivisionByKey = new Map(
    listingTiles.map((t) => [t.listingKey, t.subdivisionName ?? null] as const),
  )

  // ---------------------------------------------------------------------------
  // Hero lede — single source: the neighborhood object from getNeighborhoodBySlug.
  // Same numbers used in the stat band and JSON-LD below so they always agree.
  // ---------------------------------------------------------------------------
  const activeCount = neighborhood.activeCount
  const medianListPrice = neighborhood.medianPrice

  const ledeParts: string[] = []
  if (activeCount > 0) {
    ledeParts.push(`${activeCount} homes for sale in ${neighborhood.name}.`)
  }
  if (medianListPrice != null) {
    const rounded = Math.round(medianListPrice / 1000) * 1000
    ledeParts.push(`Median list price $${rounded.toLocaleString()}.`)
  }
  const lede = ledeParts.join(' ')

  // Stat band shows the two VERIFIED figures on NeighborhoodDetail: activeCount
  // and medianPrice. There is no verified days-on-market aggregate at the
  // neighborhood level (NeighborhoodDetail carries none), and we will NOT compute
  // one from the 24 shown tiles (ad-hoc + partial-sample). So no DOM stat renders.

  // ---------------------------------------------------------------------------
  // AI citability (D97 / G34): verified market Q&A + structured data.
  // Single source: neighborhood object (activeCount + medianPrice).
  // avgDom intentionally NOT fed — it is average days on market, not median
  // days to pending, and would mislabel the metric in the FAQ text.
  // ---------------------------------------------------------------------------
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(neighborhood.name, {
    activeCount: neighborhood.activeCount,
    medianListPrice: neighborhood.medianPrice,
  })

  // Geo centroid for Place schema: average of in-boundary listing coords.
  const withCoords = boundaryMapData.pins.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  )
  const geo =
    withCoords.length > 0
      ? {
          lat: withCoords.reduce((a, p) => a + p.lat, 0) / withCoords.length,
          lng: withCoords.reduce((a, p) => a + p.lng, 0) / withCoords.length,
        }
      : undefined

  const neighborhoodSchemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
        { name: neighborhood.cityName, url: `/cities/${citySlug}` },
        { name: neighborhood.name, url: `/cities/${citySlug}/${neighborhoodSlug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Neighborhood',
      name: neighborhood.name,
      description: `Homes for sale and live single-family market data for ${neighborhood.name} in ${neighborhood.cityName}, Oregon.`,
      url: `/cities/${citySlug}/${neighborhoodSlug}`,
      address: { city: neighborhood.cityName, state: 'OR', country: 'US' },
      containedInPlace: neighborhood.cityName,
      geo,
      hasMap: boundaryMapData.polygon ? `/cities/${citySlug}/${neighborhoodSlug}` : undefined,
      additionalProperty: datasetVariables.length > 0 ? datasetVariables : undefined,
    },
  ]
  if (datasetVariables.length > 0) {
    neighborhoodSchemas.push({
      type: 'dataset',
      name: `${neighborhood.name} real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description: `Live single-family home market data for ${neighborhood.name} in ${neighborhood.cityName}, Oregon. Includes median list price and active inventory. Sourced from the regional MLS via Ryan Realty.`,
      url: `/cities/${citySlug}/${neighborhoodSlug}`,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${neighborhood.name}, ${neighborhood.cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  return (
    <main className="min-h-screen bg-background">

      {/* 1. AI-citability structured data: breadcrumb + Neighborhood Place + market
             Dataset. FAQPage emitted by FAQBlock below. PRESERVED VERBATIM. */}
      <MetadataBlock schemas={neighborhoodSchemas} />

      <PageBreadcrumb
        trail={[
          { label: 'Cities', href: '/cities' },
          { label: neighborhood.cityName, href: `/cities/${citySlug}` },
          { label: neighborhood.name },
        ]}
        includeJsonLd={false}
      />

      {/* 3. Hero — canonical Old Mill master photo + data-driven lede.
             Numbers come from the neighborhood object (single source). */}
      <HeroBlock
        headline={`Homes for sale in ${neighborhood.name}`}
        lede={lede || undefined}
        photo={{
          src: neighborhoodHero ?? '/brand/hero/hero-old-mill-master-4k.jpg',
          alt: `Central Oregon scenery around ${neighborhood.name}.`,
          priority: true,
        }}
        minHeight={520}
      />

      {/* Video tours scoped to this neighborhood, near the top. Tap drops into /feed. */}
      <VideoTourRail community={neighborhood.name} title={`Walk through homes in ${neighborhood.name}`} />

      {/* 4. Stat band — 3-4 cards from the same neighborhood object.
             Zero / null stats are omitted entirely (data accuracy: never show
             a misleading zero on a consumer-facing surface). */}
      {(activeCount > 0 || medianListPrice != null) ? (
        <Section padding="tight" tone="muted" divider>
          <Container>
            <Grid cols={activeCount > 0 && medianListPrice != null ? 2 : 1}>
              {activeCount > 0 ? (
                <div className="rounded-xl bg-card border border-border shadow-sm px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Active listings
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-foreground">{activeCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Single-family homes</p>
                </div>
              ) : null}
              {medianListPrice != null ? (
                <div className="rounded-xl bg-card border border-border shadow-sm px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Median list price
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-foreground">
                    ${(Math.round(medianListPrice / 1000) * 1000).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Active SFR inventory</p>
                </div>
              ) : null}
            </Grid>
          </Container>
        </Section>
      ) : null}

      {/* 5. Boundary map — neighborhood polygon + spatially-correct listing pins.
             Data via getGeoBoundaryMapData (shared DAL, Gate G31). PRESERVED. */}
      {boundaryMapData.polygon ? (
        <SiteNeighborhoodMap
          polygons={[
            {
              slug: boundaryNeighborhoodSlug,
              name: neighborhood.name,
              geometry: boundaryMapData.polygon,
            },
          ]}
          listings={boundaryMapData.pins.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            href: listingTileHref({
              listingKey: p.listingKey,
              streetNumber: p.streetNumber,
              streetName: p.streetName,
              city: p.city,
            }),
            price: p.price,
            subdivisionName: subdivisionByKey.get(p.listingKey) ?? null,
            photoURL: p.photoUrl,
            streetNumber: p.streetNumber,
            streetName: p.streetName,
            city: p.city,
            state: 'OR',
            postalCode: p.postalCode,
            bedroomsTotal: p.beds,
            bathroomsTotal: p.baths,
            sqft: p.sqft,
          }))}
          zoom={13}
          height={480}
          tone="muted"
        />
      ) : null}

      {/* 6. In-boundary listing cards — spatial boundary set, cap 24.
             Same tileToCardData pattern as app/communities/[slug]/page.tsx. */}
      {listingCards.length > 0 ? (
        <section className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <div className="mb-6 flex items-end justify-between gap-4">
              <Stack gap="tight">
                <Eyebrow>{neighborhood.name}</Eyebrow>
                <H2>Homes for sale in {neighborhood.name}</H2>
              </Stack>
              {boundaryMapData.pins.length > 24 ? (
                <a
                  href={`/search?city=${encodeURIComponent(neighborhood.cityName)}`}
                  className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  View all {boundaryMapData.pins.length}
                </a>
              ) : null}
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listingCards.map((card) => (
                <ListingCard key={card.listingKey} listing={card} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Homes with video tours in this neighborhood. Self-fetching; renders
          nothing if there are too few. */}
      <VideoHomesSection
        scope={{ kind: 'neighborhood', neighborhood: neighborhood.name }}
        heading={`Video tours in ${neighborhood.name}`}
        tone="muted"
      />

      {/* 7. Verified rich neighborhood content (overview + amenities + drive times)
             via the shared CommunityRichContent renderer. PRESERVED VERBATIM. */}
      <CommunityRichContent content={richContent} name={neighborhood.name} />

      {/* Motivated sellers in this city — price-cut + remarks-signal homes. */}
      <MotivatedListings city={neighborhood.cityName} />

      {/* 8. Common questions — direct-answer FAQ + FAQPage JSON-LD (same verified
             numbers as the Dataset above). PRESERVED VERBATIM. */}
      {faqs.length > 0 ? (
        <FAQBlock
          items={faqs}
          eyebrow="Common questions"
          title={`${neighborhood.name} real estate questions`}
        />
      ) : null}

      {/* 9. CTA bar — navy, replaces GeoCTAWithBroker. */}
      <CTABar
        eyebrow={`Looking in ${neighborhood.name}?`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We know ${neighborhood.name} and the surrounding ${neighborhood.cityName} market. If a listing looks interesting, we can pull the comparable sales and tell you what it is actually worth.`}
        primary={{ href: '/search', label: 'Browse listings' }}
        secondary={{ href: '/contact', label: 'Talk to a broker' }}
        tone="navy"
      />

    </main>
  )
}
