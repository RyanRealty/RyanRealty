// @no-parity — derived subdivision page (no standalone mockup; reuses KB section library)
// brand-voice:exempt
/**
 * Subdivision detail page — KB (kinetic-brutalist) design system, Phase 9 wave
 * extension. Plat-level subdivision boundary pages linked from KbResortOverview
 * chips (/subdivisions/{slugify(alias)}). Mirrors the community page chrome
 * (KbNav + KbHero + KbListingMap + KbFeatured + KbSell + KbFooter) without the
 * resort-specific sections (KbMarketHud, KbResortOverview, KbAbout) that require
 * community-scoped market data too thin to be honest at plat level (CLAUDE.md §0).
 *
 * NO-404 CONTRACT — for each incoming slug the page tries three resolution paths
 * in order, rendering when ANY succeeds:
 *   1. GIS boundary  — getGeoBoundaryMapData geoType='subdivision' returns a polygon.
 *   2. Registry alias — data/resort-communities.json subdivision_aliases contains a
 *      match (slugify(alias) === slug). Captures the canonical alias name, parent
 *      resort slug, city, and city_slug for listing fetches.
 *   3. Active listings — getCommunityListings(city, canonicalName, limit) finds
 *      active homes tagged with that MLS SubdivisionName in any service-area city.
 * permanentRedirect fires ONLY for marketing-level slugs (resolveSubdivisionAreaRedirect).
 * notFound fires ONLY when all three paths return empty.
 *
 * Section stack (city-page funnel parity, 2026-07-30): breadcrumb · hero ·
 * featured · video tours · map · sales history · schools · SELL · footer.
 * Inventory leads because the page is titled "{name} homes for sale", and the
 * seller CTA closes the page with no exit-link block after it.
 *
 * Data ONLY through @/lib/data and @/app/actions/communities. No raw .from().
 */

import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { slugify, subdivisionListingsPath } from '@/lib/slug'
import { getCommunityListings } from '@/app/actions/communities'
import {
  getGeoBoundaryMapData,
  getListingTiles,
  getMarketStats,
} from '@/lib/data'
import { isSubdivisionIndexable } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { getSubdivisionSalesHistory } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { SubdivisionSalesHistory } from './SubdivisionSalesHistory'
import { getSubdivisionSchools } from '@/lib/data/subdivisions/getSubdivisionSchools'
import { SubdivisionSchools } from './SubdivisionSchools'
import { resolveSubdivisionAreaRedirect } from '@/lib/subdivision-area-redirects'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { getListingsWithVideos } from '@/app/actions/videos'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { cityHero } from '@/lib/geo-images'
import resortCommunitiesData from '@/data/resort-communities.json'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { VideoTourRail } from '@/components/site/VideoTourRail'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { KbFeaturedItem } from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

export const dynamicParams = true
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

type Props = { params: Promise<{ slug: string }> }

// ---------------------------------------------------------------------------
// Registry alias resolution
// ---------------------------------------------------------------------------

interface RegistryMatch {
  canonicalName: string   // the literal alias text, e.g. "Sunrise Village"
  resortSlug: string      // parent resort slug, e.g. "tetherow"
  resortLabel: string     // human-readable resort name, e.g. "Tetherow"
  city: string            // city name, e.g. "Bend"
  citySlug: string        // city slug, e.g. "bend"
}

type ResortEntry = {
  slug: string
  label: string
  city: string
  city_slug: string
  subdivision_aliases: string[]
}

/**
 * Walk data/resort-communities.json and find the first alias whose slugify()
 * matches the incoming URL slug. Returns null when no match.
 */
function resolveRegistryAlias(slug: string): RegistryMatch | null {
  const communities = (resortCommunitiesData as { communities: ResortEntry[] }).communities
  for (const entry of communities) {
    for (const alias of entry.subdivision_aliases) {
      if (slugify(alias) === slug) {
        return {
          canonicalName: alias,
          resortSlug: entry.slug,
          resortLabel: entry.label,
          city: entry.city,
          citySlug: entry.city_slug,
        }
      }
    }
  }
  return null
}

/** Title-case a slug for display when no registry match is found. */
function slugToTitle(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const registryMatch = resolveRegistryAlias(slug)
  const name = registryMatch?.canonicalName ?? slugToTitle(slug)
  const city = registryMatch?.city ?? 'Central Oregon'
  // Indexability threshold (W2.1): a plat earns index,follow only with a GIS
  // polygon AND >= SUBDIVISION_INDEX_MIN_LIFETIME_SALES lifetime closed sales
  // (lib/data/subdivisions/subdivision-index.ts — the same set the sitemap
  // submits and llms.txt enumerates). Below the bar the page still renders,
  // it just carries noindex via the central pageMetadata robots policy so
  // thin plat pages never dilute the programmatic-page quality signal.
  const indexable = await isSubdivisionIndexable(slug)
  return pageMetadata({
    title: `${name} Homes for Sale | ${city}, Oregon`,
    description: `Homes for sale in ${name}, a subdivision in ${city}. Boundary map and live listings from a local brokerage.`,
    path: `/subdivisions/${slug}`,
    noindex: !indexable,
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SubdivisionPage({ params }: Props) {
  const { slug } = await params

  // ── PATH 1: GIS boundary (plat polygon + spatial pins) ───────────────────
  const boundary = await withTimeoutFallback(
    getGeoBoundaryMapData({ geoType: 'subdivision', geoSlug: slug }),
    { polygon: null, pins: [] },
    4500,
    'sub:boundary',
  )
  const hasBoundary = Boolean(boundary.polygon)

  // ── PATH 2: Registry alias (resort-communities.json) ─────────────────────
  const registryMatch = resolveRegistryAlias(slug)

  // ── Redirect: known marketing-area slug → canonical page ─────────────────
  // Resolve BEFORE notFound so the permanentRedirect control-flow signal is
  // never swallowed by a try/catch. (same logic as original page)
  if (!hasBoundary && !registryMatch) {
    const dest = resolveSubdivisionAreaRedirect(slug)
    if (dest) permanentRedirect(dest)
  }

  // ── PATH 3: Active listings by registry alias or boundary pins ────────────
  // If the boundary has spatial pins, hydrate them into tiles.
  // If a registry alias matched, fetch via getCommunityListings(city, alias).
  // If neither, this slug truly 404s.
  const boundaryListingKeys = boundary.pins.map((p) => p.listingKey)

  // Fetch featured/listing data from the best available source.
  // Priority: registry alias (MLS subdivision-name query) > boundary pins.
  let featuredTiles: Awaited<ReturnType<typeof getCommunityListings>> = []
  let mapTiles: Awaited<ReturnType<typeof getListingTiles>> = []

  if (registryMatch) {
    // Registry alias: getCommunityListings gives us MLS-tagged homes across all
    // alias variants via getSubdivisionMatchNames internally.
    featuredTiles = await withTimeoutFallback(
      getCommunityListings(registryMatch.city, registryMatch.canonicalName, 14),
      [],
      4500,
      'sub:featured-registry',
    )
    // Map tiles: if boundary pins exist use them for spatial context;
    // otherwise fetch active listings by the canonical MLS name for pins.
    if (boundaryListingKeys.length > 0) {
      mapTiles = await withTimeoutFallback(
        getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', limit: 200 }),
        [],
        4500,
        'sub:map-boundary',
      )
    } else {
      // Re-fetch via getListingTiles so we get proper ListingTile[] with lat/lng.
      mapTiles = await withTimeoutFallback(
        getListingTiles({ subdivision: registryMatch.canonicalName, city: registryMatch.city, status: 'active', limit: 200 }),
        [],
        4500,
        'sub:map-registry',
      )
    }
  } else if (boundaryListingKeys.length > 0) {
    // Boundary-only path: hydrate pins into tiles.
    mapTiles = await withTimeoutFallback(
      getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', limit: 200 }),
      [],
      4500,
      'sub:map-pins',
    )
    // For the featured rail, reuse these same tiles (no registry match).
    featuredTiles = []
  }

  // notFound: no boundary, no registry alias, no listings anywhere.
  const hasListings = featuredTiles.length > 0 || mapTiles.length > 0
  if (!hasBoundary && !registryMatch && !hasListings) {
    notFound()
  }

  // ── Name + city display ───────────────────────────────────────────────────
  const displayName = registryMatch?.canonicalName ?? slugToTitle(slug)
  // Parent city for plain GIS plats (W2.4 parent cross-link): the MODAL city
  // among the plat's own in-boundary listings, already fetched — derived from
  // data, never guessed (§0). Claimed only when a strict majority agrees.
  const tileCityCounts = new Map<string, { citySlug: string | null; n: number }>()
  for (const t of mapTiles) {
    if (!t.city) continue
    const cur = tileCityCounts.get(t.city) ?? { citySlug: t.citySlug ?? null, n: 0 }
    cur.n += 1
    if (!cur.citySlug && t.citySlug) cur.citySlug = t.citySlug
    tileCityCounts.set(t.city, cur)
  }
  const modalTileCity = [...tileCityCounts.entries()].sort((a, b) => b[1].n - a[1].n)[0]
  const tileTotal = [...tileCityCounts.values()].reduce((s, v) => s + v.n, 0)
  const derivedPlatCity =
    modalTileCity && tileTotal > 0 && modalTileCity[1].n / tileTotal > 0.5
      ? { city: modalTileCity[0], citySlug: modalTileCity[1].citySlug }
      : null
  const cityName = registryMatch?.city ?? derivedPlatCity?.city ?? 'Central Oregon'
  const citySlug = registryMatch?.citySlug ?? derivedPlatCity?.citySlug ?? null
  const resortLabel = registryMatch?.resortLabel ?? null
  const resortSlug = registryMatch?.resortSlug ?? null

  // Eyebrow: "Sunrise Village · Tetherow · Bend" when we know the resort,
  // else "Subdivision · Central Oregon".
  const eyebrow = resortLabel
    ? `${displayName} · ${resortLabel} · ${cityName}`
    : `${displayName} · ${cityName}`

  // ── Active count ─────────────────────────────────────────────────────────
  // Reliable pin count: prefer boundary spatial pins (authoritative for plats)
  // then registry-fetched listing count. Never fabricate.
  const activeCount =
    hasBoundary
      ? boundary.pins.length
      : registryMatch
      ? featuredTiles.length
      : mapTiles.length

  // ── Hero copy ─────────────────────────────────────────────────────────────
  const lede =
    activeCount > 0
      ? `${activeCount} ${activeCount === 1 ? 'home' : 'homes'} for sale in ${displayName}.`
      : `No active listings in ${displayName} right now.`

  // ── Hero image ────────────────────────────────────────────────────────────
  // Use city hero as a sensible default for any subdivision plat. No
  // subdivision-specific hero assets exist, so we use the parent city image
  // with a regional caption so no wrong-place photo is implied. (§0)
  const heroData = citySlug ? cityHero(citySlug) : cityHero('bend')
  const posterSrc = heroData.src
  const mediaCaption = heroData.verified
    ? `${cityName}, Oregon`
    : 'Central Oregon · Cascade Range'

  // ── Featured items ────────────────────────────────────────────────────────
  // If we have registry-fetched featured tiles (ListingRow[]), convert to the
  // ListingTile-compatible shape that resolveFeaturedItems accepts, then resolve.
  // If only boundary-derived mapTiles exist, use those directly.
  let featuredItems: KbFeaturedItem[] = []
  if (mapTiles.length > 0) {
    // mapTiles is always proper ListingTile[] (from getListingTiles or boundary
    // pin hydration). Use it as the canonical source for both paths so
    // resolveFeaturedItems always receives the right type.
    featuredItems = await resolveFeaturedItems(mapTiles.filter((t) => Boolean(t.photoUrl)))
  } else if (featuredTiles.length > 0) {
    // Registry path where mapTiles fetch timed out: fall back to the ListingRow[]
    // from getCommunityListings, converting to the subset resolveFeaturedItems
    // needs. The community page uses the same cast pattern (§ featured rail).
    const tileCandidates = featuredTiles
      .map((r) => ({
        listingKey: r.ListingKey ?? '',
        listNumber: r.ListNumber ?? null,
        listPrice: r.ListPrice,
        beds: r.BedroomsTotal,
        baths: r.BathroomsTotal,
        sqft: r.TotalLivingAreaSqFt ?? null,
        streetNumber: r.StreetNumber,
        streetName: r.StreetName,
        city: r.City,
        postalCode: r.PostalCode,
        subdivisionName: r.SubdivisionName,
        lat: r.Latitude,
        lng: r.Longitude,
        photoUrl: r.PhotoURL,
        status: r.StandardStatus ?? null,
      }))
      .filter((t) => t.listingKey)
    // Cast mirrors the community page's `featuredCommunityTiles as unknown as Parameters<typeof resolveFeaturedItems>[0]` pattern.
    featuredItems = await resolveFeaturedItems(tileCandidates as unknown as Parameters<typeof resolveFeaturedItems>[0])
  }

  // ── Map data ─────────────────────────────────────────────────────────────
  // Build GeoJSON point features from whichever tile source we have.
  const mapFeatures = mapTiles
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(t.lng), Number(t.lat)] as [number, number] },
      properties: {
        p: t.listPrice, bd: t.beds, ba: t.baths, sf: t.sqft,
        a: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' '),
        sub: t.subdivisionName ?? '', city: t.city ?? '', img: t.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  // Polygon: draw only when the boundary exists and was returned.
  const mapPolygons = hasBoundary && boundary.polygon
    ? {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: boundary.polygon as unknown,
            properties: { name: displayName },
          },
        ],
      }
    : undefined

  const hasMap = mapFeatures.length > 0 || Boolean(mapPolygons)

  // ── Video tours scoped to THIS subdivision ───────────────────────────────
  // VideoTourRail falls back to the top-priced site-wide Central Oregon set when
  // its own scoped fetch returns nothing — which would render 24 unrelated
  // luxury listings under a "Walk through homes in {displayName}" header. Probe
  // the same subdivision-scoped feed here (community = the MLS SubdivisionName,
  // city = its parent city) and only render the rail when at least one in-area
  // video tour exists. No registry match => no MLS subdivision name to scope on
  // => never show the rail (the fallback would be unrelated). (§0 — honest scope)
  const subdivisionVideoTours = registryMatch
    ? await withTimeoutFallback(
        getListingsWithVideos({
          community: registryMatch.canonicalName,
          city: registryMatch.city,
          status: 'active',
          limit: 12,
        }),
        [],
        4500,
        'sub:video-tours',
      )
    : []
  const hasSubdivisionVideoTours = subdivisionVideoTours.some(
    (r) => r.listing_key && (r.video_url ?? '').trim(),
  )

  // ── Sales history + per-subdivision market stats (W2.5 depth) ────────────
  // One cached DAL read each (§0 query shapes documented in the DALs):
  // history = yearly closed-SFR aggregates via the get_subdivision_sales_history
  // RPC (fails soft to [] until the migration is applied); stats = the
  // market_stats_cache geo_type='subdivision' row when one exists (most plats
  // have none until the cache backfill — the section feature-detects both).
  const [salesHistory, subdivisionStats, subdivisionSchools] = await Promise.all([
    withTimeoutFallback(getSubdivisionSalesHistory(slug), [], 4500, 'sub:sales-history'),
    withTimeoutFallback(
      // ytd is the stable subdivision stat period (refresh-subdivision-stats writes
      // geo_slug = slugify(alias) = this route slug). Default rolling_90d is too thin
      // for a single subdivision (ODS near-individual risk).
      getMarketStats({ geoType: 'subdivision', geoSlug: slug, periodType: 'ytd' }),
      null,
      4500,
      'sub:market-stats',
    ),
    // Schools (W2.4 MPC parity): city+SubdivisionName scoped modal assignment
    // from the subdivision's OWN listings, §0-thresholded (>=70% of >=10 agree).
    // Registry-only — a GIS plat has no exact (city, name) identity to scope on.
    registryMatch
      ? withTimeoutFallback(
          getSubdivisionSchools(registryMatch.city, registryMatch.canonicalName),
          [],
          4500,
          'sub:schools',
        )
      : Promise.resolve([]),
  ])

  // ── JSON-LD ───────────────────────────────────────────────────────────────
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Communities', url: '/communities' },
        // Parent cross-link (W2.4): resort when registry-matched, else the
        // derived parent city for plain GIS plats.
        ...(resortSlug
          ? [{ name: resortLabel ?? displayName, url: `/communities/${resortSlug}` }]
          : citySlug
            ? [{ name: cityName, url: `/cities/${citySlug}` }]
            : []),
        { name: displayName, url: `/subdivisions/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Place',
      name: displayName,
      description: `Homes for sale in ${displayName}, a subdivision${cityName !== 'Central Oregon' ? ` in ${cityName}` : ' in Central Oregon'}. Boundary map and live listings from a local brokerage.`,
      url: `/subdivisions/${slug}`,
      address: cityName !== 'Central Oregon' ? { city: cityName, state: 'OR', country: 'US' } : undefined,
      containedInPlace: cityName !== 'Central Oregon' ? cityName : undefined,
      hasMap: hasMap ? `/subdivisions/${slug}` : undefined,
    },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="subdivision" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Communities', href: '/communities' },
          // Parent cross-link (W2.4): resort for registry plats, derived city
          // for plain GIS plats (modal city of the plat's own listings).
          ...(resortSlug
            ? [{ label: resortLabel ?? displayName, href: `/communities/${resortSlug}` }]
            : citySlug
              ? [{ label: cityName, href: `/cities/${citySlug}` }]
              : []),
          { label: displayName },
        ]}
      />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount,
            medianListPrice: null,
            medianDaysToPending: null,
          }}
          eyebrow={eyebrow}
          titleTop={displayName}
          titleBottom="Homes for Sale"
          lead={lede}
          videoSrc={null}
          posterSrc={posterSrc}
          mediaCaption={mediaCaption}
        />
        {/* Inventory leads (city-page funnel parity): the page is titled
            "{displayName} homes for sale", so the homes come before the map and
            the history. Graceful empty state when the plat has no active listing. */}
        {featuredItems.length > 0 ? (
          <KbFeatured
            items={featuredItems}
            eyebrow={`${displayName} · For sale`}
            viewAllHref={subdivisionListingsPath(cityName, displayName)}
            viewAllLabel={`See every ${displayName} home for sale`}
            totalCount={activeCount || null}
          />
        ) : (
          <section className="section">
            <div className="wrap" style={{ textAlign: 'center', padding: '2.5rem 0' }}>
              <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--navy-70)', maxWidth: '36rem', margin: '0 auto' }}>
                No active listings in {displayName} right now. New homes come to
                market regularly{resortLabel ? ` in ${resortLabel}` : ''}.
              </p>
            </div>
          </section>
        )}
        {/* Video tours scoped to this subdivision. Gated on hasSubdivisionVideoTours
            so the rail only renders when in-area video tours actually exist — never
            the top-priced site-wide Central Oregon fallback under a "Walk through
            homes in {displayName}" header. We scope on the canonical MLS
            SubdivisionName (community) rather than displayName so the rail's own
            scoped fetch matches the probe above. Tap drops into /feed, where the
            videos keep playing continuously. */}
        {hasSubdivisionVideoTours && registryMatch ? (
          <VideoTourRail
            community={registryMatch.canonicalName}
            city={registryMatch.city}
            eyebrow={`${displayName} · Video tours`}
            title={`Walk through homes in ${displayName}`}
          />
        ) : null}
        {/* Map: draw boundary polygon when present; pins from active listings. */}
        {hasMap ? (
          <KbListingMap
            geojson={mapGeo}
            totalActive={activeCount || mapFeatures.length}
            fitToFeatures
            showRegionMarkers={false}
            polygons={mapPolygons}
            eyebrow={displayName}
            title={`Homes in\n${displayName}`}
            subtitle={`Every active single-family listing in ${displayName}${cityName !== 'Central Oregon' ? `, ${cityName}` : ''}. Click any dot for the price, the beds, and the street.`}
          />
        ) : null}
        {/* Sales history (yearly closed-sale aggregates) + market-stats strip.
            Renders null when neither source has data — ODS-safe: aggregates
            only, never individual sold listings. */}
        <SubdivisionSalesHistory
          displayName={displayName}
          history={salesHistory}
          stats={subdivisionStats}
        />
        {/* Assigned schools (W2.4 MPC parity) — §0-thresholded modal assignment
            from this subdivision's own listings; renders null when no level
            clears the >=70%-of->=10 majority. */}
        <SubdivisionSchools displayName={displayName} schools={subdivisionSchools} />
        <KbSell
          data={{
            medianListPrice: null,
            medianDaysToPending: null,
            soldCount30d: null,
          }}
        />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
