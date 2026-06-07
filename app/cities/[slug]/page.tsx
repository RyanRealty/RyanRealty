/**
 * City landing page — Wave 3 rebuild.
 *
 * Data ONLY through @/lib/data. No app/actions/* imports.
 * Composes Wave 2 Layer 3 blocks per parity.json contract.
 *
 * Mockup reference: design_system/ryan-realty/ui_kits/city/index.html
 * Parity contract: design_system/ryan-realty/ui_kits/city/parity.json
 *
 * Section order (matches mockup):
 *   1. BreadcrumbNav
 *   2. HeroBlock — city photo + headline + stat band
 *   3. MarketSnapshot — 4 stat cards, city-scoped
 *   4. PriceRangeTiles — browse by budget (city-filtered search links)
 *   5. OpenHousesGrid — upcoming open houses in this city
 *   6. RelatedAreas — communities + neighborhoods within the city
 *   7. ActivityFeed — recent activity scoped to this city
 *   8. CTABar — "Local brokers. Specific numbers. No pressure."
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
} from '@/lib/data'
import bendNeighborhoodPolygons from '@/data/bend/bend-neighborhood-polygons.json'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { golfCommunityImage, pickGeoImage, cityHero } from '@/lib/geo-images'
import { listingTileHref } from '@/lib/slug'
import { getCityMetadataByName } from '@/lib/data/cities/getCityMetadata'
import { pageMetadata } from '@/lib/site/page-metadata'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import PriceRangeTiles from '@/components/site/PriceRangeTiles'
import OpenHousesGrid from '@/components/site/OpenHousesGrid'
import { RelatedAreas, type RelatedAreaItem } from '@/components/site/RelatedAreas'
import ActivityFeed from '@/components/site/ActivityFeed'
import { ArticleGrid } from '@/components/site/ArticleGrid'
import { CTABar } from '@/components/site/CTABar'
import { NeighborhoodMap } from '@/components/site/NeighborhoodMap'
import { PriceChart } from '@/components/site/PriceChart'
import { Container } from '@/components/site/primitives'
import { FAQBlock } from '@/components/site/FAQBlock'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import FeaturedListings from '@/components/site/FeaturedListings'
import MotivatedListings from '@/components/site/MotivatedListings'
import { buildMarketFaq } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import { CONTACT } from '@/lib/brand/contact'

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  // Return empty to skip build-time prerender. Canonical city slugs:
  //   bend, redmond, sisters, la-pine, sunriver, madras, prineville,
  //   culver, terrebonne, tumalo, powell-butte
  // dynamicParams=true + revalidate=60 renders on first request and caches.
  return []
}

export const dynamicParams = true
export const revalidate = 60

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()

  const cityName = snapshot.geoLabel
  // D78/D79: meta description leads with a concrete fact, no count that
  // conflicts with the on-page SFR number, no tone filler.
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

  // geo_snapshot_mv gives us the city label, active count, and median price.
  // Indexed single-row lookup — no raw listings aggregation.
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()

  const cityName = snapshot.geoLabel

  // City metadata (hero image, description) + the canonical market pulse.
  // D78: the hero active count MUST come from the same source the
  // MarketSnapshot card uses — market_pulse_live (SFR, property_type='A').
  // geo_snapshot_mv carries a different active_sfr_count (807 vs 532 for
  // Bend) so we do NOT use it for any consumer-facing count.
  const [cityMeta, communitySnapshots, allCitySnapshots, pulse, priceHistory, blogPosts, geoImages, boundaryMapData] =
    await Promise.all([
      getCityMetadataByName(cityName),
      getCityCommunitySnapshots(slug),
      getAllCitySnapshots(),
      getMarketPulse({ geoType: 'city', geoSlug: slug }).catch(() => null),
      // Verified monthly median SALE price series from market_stats_cache
      // (SFR-only, methodology v3). Renders a trend chart only where the series
      // is rich; thin cities (e.g. La Pine, 2 months) fall below the gate.
      getPriceHistory('city', slug, 'monthly', 24).catch(() => []),
      getRecentBlogPosts({ cityName, limit: 3 }).catch(() => []),
      // Canonical geo imagery from asset_library (getGeoTileImages adds the
      // central-oregon fallback tag itself). Covers the current city + the
      // sibling-city tiles.
      getGeoTileImages([
        slug,
        'bend',
        'redmond',
        'sisters',
        'sunriver',
        'prineville',
        'tumalo',
        'smith-rock',
      ]).catch((): Record<string, string[]> => ({})),
      // Shared boundary map data: authoritative city polygon + spatially-correct
      // listing pins (listings_in_boundary RPC). Replaces the old two-call pattern
      // (getBoundaryGeoJSON + getCityListings). Gate G31 enforces this path.
      getGeoBoundaryMapData({ geoType: 'city', geoSlug: slug }).catch(() => ({ polygon: null, pins: [] })),
    ])

  // Pick a representative asset_library photo for a place, seeded by its slug
  // (stable, varied across tiles) with the central-oregon region fallback.
  const cityImage = (citySlug: string): string | null =>
    pickGeoImage(geoImages[citySlug], citySlug) ?? pickGeoImage(geoImages['central-oregon'], citySlug)

  const heroImageUrl = cityMeta?.hero_image_url ?? null
  // IMG-01: never let a non-Bend city fall back to the hardcoded Bend Old Mill
  // photo. A DB hero wins; otherwise prefer a curated, approved, city-tagged
  // hero from asset_library (also keeps Old Mill OFF the Bend city page —
  // homepage-only); otherwise cityHero(slug)'s verified per-city / regional
  // photo, with accurate alt text.
  // Pass the city slug ONLY — the picker falls back to generic central-oregon
  // internally. This prevents an identifiable OTHER place (e.g. Smith Rock,
  // tagged terrebonne-only) from ever appearing on this city's hero.
  const approvedCityHero = await getSurfaceImage('hero', {
    geoTags: [slug],
    seed: `city/${slug}`,
    fallback: null,
  })
  const heroPhoto = heroImageUrl
    ? { src: heroImageUrl, alt: `${cityName}, Oregon` }
    : approvedCityHero
      ? { src: approvedCityHero, alt: `Central Oregon scenery around ${cityName}.` }
      : cityHero(slug)
  const activeCount = pulse?.activeCount ?? 0
  const medianListPrice = pulse?.medianListPrice ?? snapshot.medianListPrice

  // -------------------------------------------------------------------------
  // Hero lede is data-driven and brand-voice clean. Leads with numbers, never
  // a brand adjective (D79 bans the local-team filler phrasing).
  // -------------------------------------------------------------------------
  const ledeParts: string[] = []
  if (activeCount > 0) {
    ledeParts.push(`${activeCount} single-family homes for sale in ${cityName}.`)
  }
  if (medianListPrice != null) {
    const rounded = Math.round(medianListPrice / 1000) * 1000
    ledeParts.push(`Median list price $${rounded.toLocaleString()}.`)
  }
  if (pulse?.medianDaysToPending != null) {
    ledeParts.push(`Median ${pulse.medianDaysToPending} days to pending.`)
  }
  const lede = ledeParts.join(' ')

  // -------------------------------------------------------------------------
  // AI citability (CLAUDE.md "build for AI agents"): verified market Q&A +
  // structured data. buildMarketFaq is the SINGLE source for the visible FAQ,
  // the FAQPage JSON-LD (emitted by FAQBlock), and the Dataset variableMeasured
  // below, so the markup can never diverge from the visible numbers. Every
  // figure is null-guarded in the helper — nothing is invented. Dataset
  // dateModified is the real market_pulse_live refresh timestamp.
  // -------------------------------------------------------------------------
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
      hasMap: boundaryMapData.polygon ? `/cities/${slug}` : undefined,
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

  // -------------------------------------------------------------------------
  // D85 — TWO distinct in-city sections (Matt directive 2026-05-28):
  //   (1) Defined neighborhoods — the designated district polygons only.
  //   (2) Golf & master-planned communities — the curated resort communities,
  //       a SEPARATE section with their own curated imagery.
  // Both get photos (D86): neighborhoods from asset_library (city pool, seeded
  // per neighborhood for variety); golf communities from GOLF_COMMUNITY_IMAGES
  // with an asset_library city fallback. Communities come from the
  // resort-communities.json registry, never raw geo_snapshot_mv (plat noise).
  // -------------------------------------------------------------------------

  // Active SFR count per community, keyed by normalized slug. The MV geo_key
  // is "city:community name with spaces" — normalize to the registry hyphen slug.
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
        // Curated LP photo, else the city's asset_library photo so the tile is
        // never blank.
        imageUrl: golfCommunityImage(c.slug) ?? cityImage(slug),
      }
    })

  // Defined Bend neighborhoods (the `bend-` prefixed polygons). Link to the
  // canonical /cities/bend/<neighborhood> route. Bend only — other cities
  // don't have a designated-neighborhood polygon set yet. Tile photo is a
  // Bend asset_library shot, seeded per neighborhood so the tiles vary.
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

  // -------------------------------------------------------------------------
  // D84 — separate "Explore other Central Oregon cities" section.
  // getAllCitySnapshots() returns every city in the DB (incl. Medford,
  // Grants Pass) so we filter to the known service-area set.
  // -------------------------------------------------------------------------
  const CENTRAL_OREGON_CITY_SLUGS = new Set([
    'bend', 'redmond', 'sisters', 'la-pine', 'sunriver',
    'madras', 'prineville', 'culver', 'terrebonne', 'tumalo', 'powell-butte',
  ])

  // geo_snapshot_mv geo_key carries spaces for multi-word cities ("la pine",
  // "powell butte"), so slugify before matching + linking — otherwise La Pine
  // (167 active SFR) silently dropped out of the list. SFR count for parity
  // with the SFR-only theme on this page.
  const otherCityItems: RelatedAreaItem[] = allCitySnapshots
    .map((s) => ({ s, citySlug: s.geoKey.replace(/\s+/g, '-') }))
    .filter(({ citySlug }) => citySlug !== slug && CENTRAL_OREGON_CITY_SLUGS.has(citySlug))
    .slice(0, 8)
    .map(({ s, citySlug }) => ({
      name: s.geoLabel,
      href: `/cities/${citySlug}`,
      activeCount: s.activeSfrCount > 0 ? s.activeSfrCount : null,
      imageUrl: cityImage(citySlug),
    }))

  // Drop the in-progress current month from the price series. A partial period
  // (only part of the month has closed) produces a misleading median, so the
  // chart shows COMPLETED months only — never an unfinished spike at the edge.
  const currentMonthKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).slice(0, 7)
  const completePriceMonths = priceHistory.filter((p) => p.periodStart.slice(0, 7) !== currentMonthKey)

  return (
    <main className="min-h-screen bg-background">

      {/* AI-citability structured data: full breadcrumb + City entity + market Dataset.
          BreadcrumbNav's own JSON-LD is suppressed below so this is the single,
          complete BreadcrumbList (including the city leaf). */}
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

      {/* Hero — city photo + headline + stat band */}
      <HeroBlock
        headline={`Homes for sale in ${cityName}, Oregon`}
        lede={lede}
        photo={{ src: heroPhoto.src, alt: heroPhoto.alt, priority: true }}
        minHeight={560}
      />

      {/* Market snapshot — city-scoped 4-stat cards */}
      <MarketSnapshot citySlug={slug} cityName={cityName} />

      {/* Featured listings — premium active inventory in this city. Self-fetching.
          Locked into the city page by the mockup-parity gate. */}
      <FeaturedListings city={cityName} />

      {/* Motivated sellers — price-cut + remarks-signal homes in this city. */}
      <MotivatedListings city={cityName} />

      {/* Price trend — verified monthly median SALE price (market_stats_cache,
          SFR-only, methodology v3). Rendered only when the series is rich enough
          to be an honest trend (>= 6 months); thin cities fall below the gate. */}
      {completePriceMonths.length >= 6 ? (
        <PriceChart
          eyebrow="Price trend"
          title={`${cityName} median sale price`}
          intro="Monthly median sale price for single-family homes, completed months only. Each dot is one month, so the line shows the real month-to-month movement. From the regional MLS."
          data={completePriceMonths}
          tone="muted"
        />
      ) : null}

      {/* Boundary map — city polygon + spatially-correct listing pins.
          Data via getGeoBoundaryMapData (shared DAL, Gate G31).
          Skipped when no boundary row exists for this city. */}
      {boundaryMapData.polygon ? (
        <NeighborhoodMap
          eyebrow={cityName}
          title={`Where ${cityName} listings are`}
          polygons={[
            {
              slug,
              name: cityName,
              geometry: boundaryMapData.polygon,
            },
          ]}
          listings={boundaryMapData.pins.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            href: listingTileHref({ listingKey: p.listingKey }),
            price: p.price,
          }))}
          zoom={12}
          height={520}
          tone="muted"
        />
      ) : null}

      {/* Browse by price range */}
      <PriceRangeTiles />

      {/* Open houses in this city — next 14 days from listings."OpenHouses" */}
      <OpenHousesGrid
        city={cityName}
        daysAhead={14}
        eyebrow={`Upcoming in ${cityName}`}
        heading="Open houses"
        viewAllHref={`/open-houses/${slug}`}
      />

      {/* D85 — defined neighborhoods only (photo tiles) */}
      {bendNeighborhoodItems.length > 0 ? (
        <RelatedAreas
          eyebrow={`${cityName} neighborhoods`}
          title={`Explore ${cityName} neighborhoods`}
          items={bendNeighborhoodItems}
          tone="muted"
          cols={4}
        />
      ) : null}

      {/* D85 — golf & master-planned communities, separate section + curated photos */}
      {golfCommunityItems.length > 0 ? (
        <RelatedAreas
          eyebrow="Golf & master-planned"
          title={`${cityName} golf and master-planned communities`}
          items={golfCommunityItems}
          tone="default"
          cols={4}
        />
      ) : null}

      {/* Live activity feed — city-scoped */}
      <ActivityFeed
        city={cityName}
        eyebrow={`Live activity · ${cityName}`}
        heading={`What is happening in ${cityName}`}
        viewAllLabel="Full market pulse →"
        viewAllHref="/housing-market"
      />

      {/* D84 — separate cross-nav to other Central Oregon cities */}
      {otherCityItems.length > 0 ? (
        <RelatedAreas
          eyebrow="Central Oregon"
          title="Explore other cities"
          items={otherCityItems}
          cols={4}
        />
      ) : null}

      {/* Guides & insights — recent blog posts, city-prioritized */}
      <ArticleGrid
        items={blogPosts}
        eyebrow="Guides & insights"
        heading={`${cityName} real estate, explained`}
        subtitle={`Local housing news, neighborhood deep dives, and buyer and seller guides for ${cityName} and Central Oregon.`}
        tone="muted"
      />

      {/* Common questions — direct-answer content + FAQPage JSON-LD (same
          verified numbers as the Dataset above). Renders nothing when the
          market pulse is unavailable. */}
      {faqs.length > 0 ? (
        <FAQBlock
          items={faqs}
          eyebrow="Common questions"
          title={`${cityName} real estate questions`}
        />
      ) : null}

      {/* CTA bar */}
      <CTABar
        eyebrow={`Why Ryan Realty in ${cityName}`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We close deals across ${cityName} every year. We can tell you what the inspection found last month two blocks over. If a market is soft, we will say so.`}
        primary={{ href: '/lp/buyer-listing-alerts', label: 'Get listing alerts' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: `Call ${CONTACT.phoneDirect}` }}
        tone="navy"
      />

    </main>
  )
}
