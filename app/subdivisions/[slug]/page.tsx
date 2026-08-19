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
 *   3. Active listings — getPlatPublicInventory(slug) finds SFR + PUBLIC_ACTIVE
 *      homes tagged with that MLS SubdivisionName in the parent city.
 * permanentRedirect fires ONLY for marketing-level slugs (resolveSubdivisionAreaRedirect).
 * notFound fires ONLY when all three paths return empty.
 *
 * Section stack (Exploration System 2026-08): breadcrumb · hero · featured ·
 * video tours · map · sales history · schools · lifestyle · parents/peers ·
 * SELL · footer. Inventory leads; no dead-end after history.
 *
 * Data ONLY through @/lib/data. No raw .from().
 */

import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { slugify, subdivisionListingsPath } from '@/lib/slug'
import { publishPlaceHeroCta } from '@/lib/search/publish-place-browse-href'
import {
  getGeoBoundaryMapData,
  getListingTiles,
  getMarketStats,
} from '@/lib/data'
import { getPlatPublicInventory } from '@/lib/data/geo/plat-public-inventory'
import { SubdivisionExploreTail } from '@/components/site/explore/SubdivisionExploreTail'
import { PlaceMapListSplit } from '@/components/site/explore/PlaceMapListSplit.client'
import {
  lifestyleForCentroid,
  mapCentroid,
  peerPlatsForResort,
  splitRowsFromTiles,
  subdivisionPlaceContext,
} from '@/lib/explore/subdivision-page-extras'
import { publishPlatFigures } from '@/lib/market/publish-plat-figures'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { isSubdivisionIndexable } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { getSubdivisionSalesHistory } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { SubdivisionSalesHistory } from './SubdivisionSalesHistory'
import { getSubdivisionSchools } from '@/lib/data/subdivisions/getSubdivisionSchools'
import { SubdivisionSchools } from './SubdivisionSchools'
import { resolveSubdivisionAreaRedirect } from '@/lib/subdivision-area-redirects'
import { pageMetadata, publishPlaceHomesTitle } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { getListingsWithVideos } from '@/app/actions/videos'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { placeHeroLead } from '@/lib/kb/place-hero-lead'
import { cityHero } from '@/lib/geo-images'
import resortCommunitiesData from '@/data/resort-communities.json'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { VideoTourRail } from '@/components/site/VideoTourRail'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { KbFeaturedItem } from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

export const dynamicParams = true
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const communities = (resortCommunitiesData as { communities: ResortEntry[] }).communities
  const slugs = new Set<string>()
  for (const entry of communities) {
    for (const alias of entry.subdivision_aliases) {
      const slug = slugify(alias)
      if (!resolveSubdivisionAreaRedirect(slug)) slugs.add(slug)
    }
  }
  return [...slugs].map((slug) => ({ slug }))
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

/** Visitor plat name. MLS alias stays the ingest key; Triple → Triple Knot. */
function publishSubdivisionPageName(slug: string, registryMatch: RegistryMatch | null): string {
  const raw = registryMatch?.canonicalName ?? slugToTitle(slug)
  return publishPlatDisplayName(raw) ?? raw
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const registryMatch = resolveRegistryAlias(slug)
  const name = publishSubdivisionPageName(slug, registryMatch)
  const city = registryMatch?.city ?? 'Central Oregon'
  // Indexability threshold (W2.1): a plat earns index,follow only with a GIS
  // polygon AND >= SUBDIVISION_INDEX_MIN_LIFETIME_SALES lifetime closed sales
  // (lib/data/subdivisions/subdivision-index.ts — the same set the sitemap
  // submits and llms.txt enumerates). Below the bar the page still renders,
  // it just carries noindex via the central pageMetadata robots policy so
  // thin plat pages never dilute the programmatic-page quality signal.
  const indexable = await isSubdivisionIndexable(slug)
  return pageMetadata({
    title: publishPlaceHomesTitle(name, city),
    description: `Active homes in ${name}, a subdivision in ${city}. Boundary map and live MLS listings.`,
    path: `/subdivisions/${slug}`,
    noindex: !indexable,
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SubdivisionPage({ params }: Props) {
  const { slug } = await params

  // ── PATH 1: GIS boundary (plat polygon for the map) ──────────────────────
  // ── PATH 2: Registry alias + the public SFR inventory SoR ────────────────
  const [boundaryRead, inventory] = await Promise.all([
    withTimeoutFallbackResult(
      getGeoBoundaryMapData({ geoType: 'subdivision', geoSlug: slug }),
      { polygon: null, pins: [] },
      4500,
      'sub:boundary',
    ),
    getPlatPublicInventory(slug),
  ])
  const boundary = boundaryRead.value
  const hasBoundary = Boolean(boundary.polygon)

  const registryMatch = resolveRegistryAlias(slug)

  // ── Redirect: known marketing-area slug → canonical page ─────────────────
  // Resolve BEFORE notFound so the permanentRedirect control-flow signal is
  // never swallowed by a try/catch. (same logic as original page)
  if (!hasBoundary && !registryMatch) {
    const dest = resolveSubdivisionAreaRedirect(slug)
    if (dest) permanentRedirect(dest)
  }

  // ── PATH 3: Counted set = registry plat inventory (SFR + PUBLIC_ACTIVE) ──
  // Same payload as /subdivisions tiles (getRegistryPlatPublicInventory).
  // Do not fall back to a capped featured fetch or unfiltered pin count
  // (all property types) — those were the 12 / 14 / 26 split on Ridge At
  // Eagle Crest (2026-08-16). A measured empty must not revive townhouses.
  const inventoryOk = inventory != null
  const countedKeys = inventoryOk ? inventory.listingKeys : []
  const boundaryListingKeys = inventoryOk
    ? countedKeys
    : boundary.pins.map((p) => p.listingKey)

  let mapTiles: Awaited<ReturnType<typeof getListingTiles>> = []
  if (boundaryListingKeys.length > 0) {
    mapTiles = await withTimeoutFallback(
      getListingTiles({
        listingKeys: boundaryListingKeys,
        status: 'active',
        propertyType: 'A',
        limit: 250,
      }),
      [],
      4500,
      inventoryOk ? 'sub:inventory-tiles' : 'sub:map-pins',
    )
  }
  if (inventoryOk) {
    const allowed = new Set(countedKeys)
    mapTiles = mapTiles.filter((t) => allowed.has(t.listingKey))
  }

  // notFound: no boundary, no registry alias, no listings anywhere.
  const hasListings = mapTiles.length > 0
  if (!hasBoundary && !registryMatch && !hasListings) {
    notFound()
  }

  // ── Name + city display ───────────────────────────────────────────────────
  const displayName = publishSubdivisionPageName(slug, registryMatch)
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
  // §0 UNKNOWN IS NOT ZERO. With no polygon and no registry alias the only
  // source left is `mapTiles`, which is populated ONLY from boundary pins — so a
  // boundary read that timed out leaves it `[]`, indistinguishable from a real
  // empty plat, and the lede published "No active listings right now" as fact.
  // null = unknown, and the lede + count below suppress the claim instead.
  const activeCount: number | null = inventory?.activeCount ?? null

  // ── Hero copy ─────────────────────────────────────────────────────────────
  // KbHero already renders "<N> homes for sale" ahead of this text when
  // activeCount is non-null. The continuation names THIS plat, never a
  // coarser city grain (fleet 97c68da5).
  const lede = placeHeroLead({
    placeName: displayName,
    parentName: cityName !== 'Central Oregon' ? cityName : null,
    activeCount,
    knownSuffix: 'Live inventory from the regional MLS.',
    unknownSuffix: 'Live inventory from the regional MLS.',
  })

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
  // Same counted set as the hero and the #homes list.
  let featuredItems: KbFeaturedItem[] = []
  if (mapTiles.length > 0) {
    featuredItems = await resolveFeaturedItems(mapTiles.filter((t) => Boolean(t.photoUrl)))
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
        a:
          publishStreetLine({
            streetNumber: t.streetNumber,
            streetName: t.streetName,
            streetSuffix: t.streetSuffix,
          }) ?? '',
        sub: t.subdivisionName ?? '', city: t.city ?? '', img: t.photoUrl ?? '',
        k: t.listingKey,
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

  const splitRows = splitRowsFromTiles(mapTiles)
  const useSplit = hasMap && splitRows.length > 0

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
  const [salesHistory, subdivisionStats, subdivisionSchools] =
    await Promise.all([
      withTimeoutFallback(getSubdivisionSalesHistory(slug), [], 4500, 'sub:sales-history'),
      withTimeoutFallback(
        getMarketStats({ geoType: 'subdivision', geoSlug: slug, periodType: 'ytd' }),
        null,
        4500,
        'sub:market-stats',
      ),
      registryMatch
        ? withTimeoutFallback(
            getSubdivisionSchools(registryMatch.city, registryMatch.canonicalName),
            [],
            4500,
            'sub:schools',
          )
        : Promise.resolve([]),
    ])
  const placeContext = subdivisionPlaceContext({ cityName, citySlug, displayName, slug })
  const peerPlats = peerPlatsForResort(resortSlug, slug)
  const centroid = mapCentroid(mapTiles)
  const lifestyleItems = lifestyleForCentroid(centroid)
  const platFigures = publishPlatFigures({
    platMedianListPrice: inventory?.medianListPrice,
  })

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
      description: `Homes for sale in ${displayName}, a subdivision${cityName !== 'Central Oregon' ? ` in ${cityName}` : ' in Central Oregon'}, with a boundary map and live listings.`,
      url: `/subdivisions/${slug}`,
      address: cityName !== 'Central Oregon' ? { city: cityName, state: 'OR', country: 'US' } : undefined,
      containedInPlace: cityName !== 'Central Oregon' ? cityName : undefined,
      hasMap: hasMap ? `/subdivisions/${slug}` : undefined,
    },
  ]

  return (
    <main className="kb-root">
      <KbSectionTracker />
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
            medianListPrice: platFigures.medianListPrice,
            medianDaysToPending: platFigures.medianDaysToPending,
          }}
          eyebrow={eyebrow}
          titleTop={`${displayName},`}
          titleBottom="Homes for Sale"
          lead={lede}
          videoSrc={null}
          posterSrc={posterSrc}
          mediaCaption={mediaCaption}
          cta={publishPlaceHeroCta(
            subdivisionListingsPath(cityName, displayName),
            `See ${displayName} homes`,
          )}
        />
        {/* Dual-pane list ↔ map when we have pins; else featured rail or empty. */}
        {useSplit ? (
          <PlaceMapListSplit
            rows={splitRows}
            mapGeo={mapGeo}
            polygons={mapPolygons}
            eyebrow={`${displayName} · For sale`}
            title={`Homes in ${displayName}`}
            subtitle={`Every active single-family listing in ${displayName}${cityName !== 'Central Oregon' ? `, ${cityName}` : ''}. List and map together. Zoom in for photo stamps.`}
            totalActive={activeCount ?? mapFeatures.length}
            viewAllHref={subdivisionListingsPath(cityName, displayName)}
            viewAllLabel={`See every ${displayName} home for sale`}
          />
        ) : featuredItems.length > 0 ? (
          <KbFeatured
            items={featuredItems}
            eyebrow={`${displayName} · For sale`}
            viewAllHref={subdivisionListingsPath(cityName, displayName)}
            viewAllLabel={`See every ${displayName} home for sale`}
            viewAllPlace={displayName}
            totalCount={activeCount || null}
          />
        ) : (
          <section className="section">
            <div className="wrap" style={{ textAlign: 'center', padding: '2.5rem 0' }}>
              <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--navy-70)', maxWidth: '36rem', margin: '0 auto' }}>
                No active listings in {displayName} right now.
                {cityName !== 'Central Oregon'
                  ? ` Browse homes in ${cityName}, or save a search for this plat.`
                  : ' Browse nearby homes, or save a search for this plat.'}
              </p>
            </div>
          </section>
        )}
        {hasSubdivisionVideoTours && registryMatch ? (
          <VideoTourRail
            community={registryMatch.canonicalName}
            city={registryMatch.city}
            eyebrow={`${displayName} · Video tours`}
            title={`Walk through homes in ${displayName}`}
          />
        ) : null}
        {/* Sales history (yearly closed-sale aggregates) + market-stats strip.
            Renders null when neither source has data — ODS-safe: aggregates
            only, never individual sold listings. */}
        <SubdivisionSalesHistory
          displayName={displayName}
          history={salesHistory}
          stats={subdivisionStats}
          cityName={cityName}
        />
        {/* Assigned schools (W2.4 MPC parity) — §0-thresholded modal assignment
            from this subdivision's own listings; renders null when no level
            clears the DAL majority rule. */}
        <SubdivisionSchools displayName={displayName} schools={subdivisionSchools} />
        <SubdivisionExploreTail
          displayName={displayName}
          placeContext={placeContext}
          lifestyleItems={lifestyleItems}
          centroid={centroid}
          peerPlats={peerPlats}
          resortLabel={resortLabel}
          resortSlug={resortSlug}
          cityName={cityName}
          citySlug={citySlug}
          heroMedian={platFigures.medianListPrice}
          heroDom={platFigures.medianDaysToPending}
          soldCount={platFigures.soldCount30d}
        />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
