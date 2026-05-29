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
  getRecentBlogPosts,
  getGeoTileImages,
} from '@/lib/data'
import bendNeighborhoodPolygons from '@/data/bend/bend-neighborhood-polygons.json'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { golfCommunityImage, pickGeoImage } from '@/lib/geo-images'
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
import { Container } from '@/components/site/primitives'

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
  if (!snapshot) return { title: 'City Not Found' }

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
  const [cityMeta, communitySnapshots, allCitySnapshots, pulse, blogPosts, geoImages] =
    await Promise.all([
      getCityMetadataByName(cityName),
      getCityCommunitySnapshots(slug),
      getAllCitySnapshots(),
      getMarketPulse({ geoType: 'city', geoSlug: slug }).catch(() => null),
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
      ]).catch(() => ({})),
    ])

  // Pick a representative asset_library photo for a place, seeded by its slug
  // (stable, varied across tiles) with the central-oregon region fallback.
  const cityImage = (citySlug: string): string | null =>
    pickGeoImage(geoImages[citySlug], citySlug) ?? pickGeoImage(geoImages['central-oregon'], citySlug)

  const heroImageUrl = cityMeta?.hero_image_url ?? null
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

  return (
    <main className="min-h-screen bg-background">

      {/* Breadcrumb */}
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
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
        photo={
          heroImageUrl
            ? { src: heroImageUrl, alt: `Aerial view of ${cityName}, Oregon.`, priority: true }
            : undefined
        }
        minHeight={560}
      />

      {/* Market snapshot — city-scoped 4-stat cards */}
      <MarketSnapshot citySlug={slug} cityName={cityName} />

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

      {/* CTA bar */}
      <CTABar
        eyebrow={`Why Ryan Realty in ${cityName}`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We close deals across ${cityName} every year. We can tell you what the inspection found last month two blocks over. If a market is soft, we will say so.`}
        primary={{ href: '/contact', label: 'Meet the team' }}
        secondary={{ href: 'tel:5412136706', label: 'Call 541.213.6706' }}
        tone="navy"
      />

    </main>
  )
}
