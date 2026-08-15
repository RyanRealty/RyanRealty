/**
 * /subdivisions/<slug> plat grain. Opens a Ledger of this plat's homes.
 * Field only when pins are a real map. Giant 0 is forbidden. Empty Ledger if
 * none. Parent community or city is the back door. Schools on the first path.
 * The old line "Places open on Instrument then Field" is retired.
 * Parity: design_system/ryan-realty/ui_kits/subdivision/parity.json.
 *
 * NO-404 CONTRACT, CARRIED ACROSS UNTOUCHED. For each incoming slug the page tries
 * three resolution paths in order and renders when ANY succeeds.
 *   1. GIS boundary, getGeoBoundaryMapData geoType='subdivision' returns a polygon.
 *   2. Registry alias, data/resort-communities.json subdivision_aliases contains a
 *      match (slugify(alias) === slug).
 *   3. Active listings tagged with that MLS SubdivisionName.
 * permanentRedirect fires ONLY for marketing-level slugs (resolveSubdivisionAreaRedirect).
 * notFound fires ONLY when all three return empty.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through pageMetadata
 * with the same title, description, path and indexability rule, MetadataBlock JSON-LD
 * (BreadcrumbList plus Place, same payloads, same hasMap condition), a rendered
 * V3SectionTracker with pageType="subdivision", revalidate 60, dynamicParams,
 * generateStaticParams returning [], and the route with its params.
 * MetadataBlock stays on the legacy register (JSON-LD). V3SectionTracker is a
 * v3 island, not a seventh pattern.
 *
 * FOUR POPULATIONS, FOUR TRACES, FOUR STAMPS (CLAUDE.md section 0). Every sentence
 * that describes one lives in _v3/subdivision-traces.ts, and no section prints a
 * figure its own trace does not cover. Two consequences the KB page did not carry.
 *   1. The boundary RPC filters status only, so the plat active count holds every
 *      property type while the Field below it is propertyType 'A'. Two counts, and
 *      the page says so instead of putting one under the other sentence.
 *   2. The market band reads ONE row, chosen in _v3/subdivision-figures.ts. The KB
 *      page took a median from whichever pulse row had one and a days-to-pending
 *      from whichever had that, so two places could print under one heading.
 *
 * ABSENT IS NOT ZERO, IN BOTH PLACES IT CAN BITE. A boundary read that times out
 * leaves the same empty array a genuinely empty plat leaves, so activeCount is null
 * in that case and the page says it has no count rather than publishing a zero under
 * a live-MLS trace. The parent market band carries the same hazard one layer down:
 * the pulse mapper coalesces a NULL sold_count_30d to the number 0, so a zero
 * closings figure is unverifiable here and _v3/subdivision-figures.ts drops it, with
 * the trace composed from the figures that survived.
 *
 * EVERY LINK IS A DOOR THAT OPENS WHERE IT SAYS. The sales-history Ledger sends each
 * year to the closed-sales explorer, which clamps its year parameter, so the years
 * outside that range are split out in _v3/history-door.ts and stated as a count
 * instead of being given a link that lands on a different year. The range is pinned
 * to the explorer's own clamp by ci:subdivision-stats-integrity.
 *
 * NO READ THAT DOES NOT REACH THE SCREEN. The parent pulse rows are read only when
 * the plat has no cache row of its own, because the band renders one population and
 * the plat row wins. They used to be fetched unconditionally, two live queries per
 * request on every plat that had its own row, and discarded.
 *
 * Data ONLY through @/lib/data and @/app/actions. No raw .from().
 */

import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { subdivisionListingsPath } from '@/lib/slug'
import { getCommunityListings } from '@/app/actions/communities'
import { getGeoBoundaryMapData, getListingTiles, getMarketStats } from '@/lib/data'
import { getListingsWithVideos } from '@/app/actions/videos'
import {
  fetchSubdivMarketExtras,
  lifestyleForCentroid,
  mapCentroid,
  peerPlatsForResort,
  subdivisionPlaceContext,
} from '@/lib/explore/subdivision-page-extras'
import { isSubdivisionIndexable } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { getSubdivisionSalesHistory } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { getSubdivisionSchools } from '@/lib/data/subdivisions/getSubdivisionSchools'
import { resolveSubdivisionAreaRedirect } from '@/lib/subdivision-area-redirects'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { formatDate } from '@/lib/format/date'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Field,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3FieldItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'
import { SubdivisionSalesHistory } from './SubdivisionSalesHistory'
import { SubdivisionSchools } from './SubdivisionSchools'
import { buildSubdivisionEdges } from './_v3/subdivision-edges'
import { parentPulseFigures, platStatsFigures, subdivisionSalesChart } from './_v3/subdivision-figures'
import { resolveRegistryAlias, slugToTitle } from './_v3/subdivision-registry'
import { fallbackFieldRows, platHomesMode, toFieldEntry, toLedgerRows, type FieldEntry } from './_v3/subdivision-rows'
import {
  fieldFallbackTrace,
  fieldTrace,
  homesLedgerTrace,
  parentMarketTrace,
  PERIOD_LABEL,
  platStatsTrace,
  type PlatScope,
} from './_v3/subdivision-traces'

export const dynamicParams = true
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

type Props = { params: Promise<{ slug: string }> }

// ---------------------------------------------------------------------------
// Metadata, unchanged from the KB page
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const registryMatch = resolveRegistryAlias(slug)
  const name = registryMatch?.canonicalName ?? slugToTitle(slug)
  const city = registryMatch?.city ?? 'Central Oregon'
  // Indexability threshold (W2.1): a plat earns index,follow only with a GIS
  // polygon AND >= SUBDIVISION_INDEX_MIN_LIFETIME_SALES lifetime closed sales
  // (lib/data/subdivisions/subdivision-index.ts, the same set the sitemap
  // submits and llms.txt enumerates). Below the bar the page still renders,
  // it just carries noindex via the central pageMetadata robots policy so
  // thin plat pages never dilute the programmatic-page quality signal.
  const indexable = await isSubdivisionIndexable(slug)
  return pageMetadata({
    title: `Homes for Sale in ${name} | ${city}, Oregon`,
    description: `Active homes in ${name}, a subdivision in ${city}. Boundary map and live MLS listings.`,
    path: `/subdivisions/${slug}`,
    noindex: indexable === false,
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SubdivisionPage({ params }: Props) {
  const { slug } = await params

  // PATH 1: GIS boundary (plat polygon plus spatial pins)
  const boundaryRead = await withTimeoutFallbackResult(
    getGeoBoundaryMapData({ geoType: 'subdivision', geoSlug: slug }),
    { polygon: null, pins: [] },
    4500,
    'sub:boundary',
  )
  const boundary = boundaryRead.value
  const hasBoundary = Boolean(boundary.polygon)

  // PATH 2: Registry alias (resort-communities.json)
  const registryMatch = resolveRegistryAlias(slug)

  // Redirect: a known marketing-area slug goes to its canonical page. Resolved
  // BEFORE notFound so the permanentRedirect control-flow signal is never
  // swallowed by a try/catch. Same logic as the KB page.
  if (hasBoundary === false && registryMatch === null) {
    const dest = resolveSubdivisionAreaRedirect(slug)
    if (dest) permanentRedirect(dest)
  }

  // PATH 3: Active listings by registry alias or boundary pins.
  const boundaryListingKeys = boundary.pins.map((p) => p.listingKey)

  let featuredTiles: Awaited<ReturnType<typeof getCommunityListings>> = []
  let mapTiles: Awaited<ReturnType<typeof getListingTiles>> = []
  // Section 0, ABSENT IS NOT ZERO, on the registry path. A timed-out fetch and a
  // plat with nothing for sale both leave an empty array, and the count below is
  // this array's length, so the page has to know which of the two happened. The
  // KB page did not, and printed "0 homes for sale" under a live-MLS trace on
  // every slow query. The boundary path already carried this guard.
  let featuredOk = true

  if (registryMatch) {
    const featuredRead = await withTimeoutFallbackResult(
      getCommunityListings(registryMatch.city, registryMatch.canonicalName, 14),
      [],
      4500,
      'sub:featured-registry',
    )
    featuredTiles = featuredRead.value
    featuredOk = featuredRead.ok
    if (boundaryListingKeys.length > 0) {
      // Section 0: the Field trace claims active SINGLE-FAMILY listings. The
      // plat boundary RPC filters only StandardStatus='Active', so
      // propertyType:'A' has to be applied here or that sentence is false.
      mapTiles = await withTimeoutFallback(
        getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', propertyType: 'A', limit: 200 }),
        [],
        4500,
        'sub:map-boundary',
      )
    } else {
      mapTiles = await withTimeoutFallback(
        getListingTiles({ subdivision: registryMatch.canonicalName, city: registryMatch.city, status: 'active', propertyType: 'A', limit: 200 }),
        [],
        4500,
        'sub:map-registry',
      )
    }
  } else if (boundaryListingKeys.length > 0) {
    mapTiles = await withTimeoutFallback(
      // Section 0: the single-family claim in the Field trace, see above.
      getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', propertyType: 'A', limit: 200 }),
      [],
      4500,
      'sub:map-pins',
    )
    featuredTiles = []
  }

  // notFound: no boundary, no registry alias, no listings anywhere.
  const hasListings = featuredTiles.length > 0 || mapTiles.length > 0
  if (hasBoundary === false && registryMatch === null && hasListings === false) {
    notFound()
  }

  // Name and city display.
  const displayName = registryMatch?.canonicalName ?? slugToTitle(slug)
  // Parent city for plain GIS plats (W2.4 parent cross-link): the MODAL city
  // among the plat in-boundary listings, already fetched, derived from data and
  // never guessed (section 0). Claimed only on a strict majority.
  const tileCityCounts = new Map<string, { citySlug: string | null; n: number }>()
  for (const t of mapTiles) {
    if (t.city == null || t.city === '') continue
    const cur = tileCityCounts.get(t.city) ?? { citySlug: t.citySlug ?? null, n: 0 }
    cur.n += 1
    if (cur.citySlug == null && t.citySlug) cur.citySlug = t.citySlug
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
  const placeCity = cityName === 'Central Oregon' ? null : cityName

  const eyebrow = resortLabel
    ? `${displayName} · ${resortLabel} · ${cityName}`
    : `${displayName} · ${cityName}`

  // Active count. Section 0, UNKNOWN IS NOT ZERO: with no polygon and no
  // registry alias the only source left is mapTiles, which is populated ONLY
  // from boundary pins, so a boundary read that timed out leaves it empty and
  // indistinguishable from a real empty plat. null means unknown, and the
  // Instrument below suppresses the claim instead of publishing a zero.
  const activeCount: number | null =
    hasBoundary
      ? boundary.pins.length
      : registryMatch
      ? featuredOk
        ? featuredTiles.length
        : null
      : boundaryRead.ok
      ? mapTiles.length
      : null

  // The population that count covers. Three paths, three different sentences.
  const platScope: PlatScope = hasBoundary
    ? { kind: 'boundary', displayName }
    : registryMatch
      ? { kind: 'registry', subdivisionName: registryMatch.canonicalName, city: registryMatch.city }
      : { kind: 'pins', displayName }

  // Video tours scoped to THIS subdivision. No registry match means no MLS
  // subdivision name to scope on, and the unscoped feed returns top-priced
  // Central Oregon listings from anywhere, so the probe is skipped rather than
  // answered with out-of-area homes (section 0).
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
  const videoKeys = new Set(
    subdivisionVideoTours
      .filter((r) => r.listing_key && (r.video_url ?? '').trim())
      .map((r) => r.listing_key),
  )

  // Field rows and map pins. Pins and list are the same counted set.
  const plotted: FieldEntry[] = []
  for (const tile of mapTiles) {
    const entry = toFieldEntry(tile, videoKeys.has(tile.listingKey))
    if (entry) plotted.push(entry)
  }
  const mapPins = fieldMapPins(plotted)

  // Registry path where the tile fetch returned nothing: the rows fall back to
  // the subdivision-name fetch, which is a different query and says so.
  const usingFallbackRows = plotted.length === 0 && featuredTiles.length > 0
  const fieldItems: V3FieldItem[] = usingFallbackRows
    ? fallbackFieldRows(featuredTiles, videoKeys)
    : plotted

  const mapPolygon = hasBoundary && boundary.polygon ? boundary.polygon : undefined
  const hasMap = plotted.length > 0 || Boolean(mapPolygon)

  const fieldSource =
    usingFallbackRows && registryMatch
      ? fieldFallbackTrace(registryMatch.canonicalName, registryMatch.city)
      : fieldTrace(platScope)

  // Sales history, the plat cached statistics, and the schools. Every result
  // below reaches the screen.
  const [salesHistory, subdivisionStats, subdivisionSchools] = await Promise.all([
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

  // The market band reads ONE population. The plat own cache row when it carries
  // figures, otherwise the community pulse row, otherwise the city pulse row.
  const platFigures = platStatsFigures(subdivisionStats)

  // ...which is why the parent read is CONDITIONAL and sits after that decision
  // rather than inside the Promise.all above. fetchSubdivMarketExtras runs two
  // getMarketPulse queries, and on a plat that carries its own cache row neither
  // of them can reach the screen: the band renders the plat figures. Fetching
  // them anyway cost two live queries per request and bought a discarded result
  // (migration-recipe.md section 3.4, no read left in that is not rendered).
  const { cityPulse, communityPulse } =
    platFigures.length > 0
      ? { cityPulse: null, communityPulse: null }
      : await fetchSubdivMarketExtras({ citySlug, resortSlug })

  const parentPulse = communityPulse ?? cityPulse
  const marketParentHref =
    communityPulse && resortSlug
      ? `/communities/${resortSlug}`
      : citySlug
        ? `/housing-market/${citySlug}`
        : undefined
  // The trace is built from the figures that survived the band's guards, so no
  // sentence covers a number the page suppressed.
  const { figures: parentFigures, covers: parentCovers } = parentPulseFigures(
    parentPulse,
    marketParentHref,
  )
  const statsPeriodLabel = subdivisionStats ? PERIOD_LABEL[subdivisionStats.periodType] : ''
  const [firstPlatFigure, ...restPlatFigures] = platFigures
  const [firstParentFigure, ...restParentFigures] = parentFigures
  const salesChart = subdivisionSalesChart(displayName, salesHistory)

  // The closing block outbound edges.
  const edges = buildSubdivisionEdges({
    displayName,
    cityName,
    citySlug,
    resortLabel,
    resortSlug,
    placeContext: subdivisionPlaceContext({ cityName, citySlug, displayName, slug }),
    lifestyleItems: lifestyleForCentroid(mapCentroid(mapTiles)),
    peerPlats: peerPlatsForResort(resortSlug, slug),
    browseHref: subdivisionListingsPath(cityName, displayName),
    marketHref: citySlug ? `/housing-market/${citySlug}/${slug}` : '/housing-market',
    pagePath: `/subdivisions/${slug}`,
  })

  // JSON-LD. Same types, same payloads, same hasMap condition as the KB page.
  const placeDescription = placeCity
    ? `Homes for sale in ${displayName}, a subdivision in ${placeCity}, with a boundary map and live listings.`
    : `Homes for sale in ${displayName}, a subdivision in Central Oregon, with a boundary map and live listings.`
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Communities', url: '/communities' },
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
      description: placeDescription,
      url: `/subdivisions/${slug}`,
      address: placeCity ? { city: placeCity, state: 'OR', country: 'US' } : undefined,
      containedInPlace: placeCity ?? undefined,
      hasMap: hasMap ? `/subdivisions/${slug}` : undefined,
    },
  ]

  const homesMode = platHomesMode({
    activeCount,
    homeRows: fieldItems.length,
    pinCount: plotted.length,
  })
  const homeRows = toLedgerRows(fieldItems)
  const [firstHome, ...restHomes] = homeRows
  const parentHref = resortSlug
    ? `/communities/${resortSlug}`
    : citySlug
      ? `/cities/${citySlug}`
      : '/communities'
  const parentLabel = resortLabel ?? cityName
  const showParentBand = firstPlatFigure == null && firstParentFigure != null && parentPulse != null

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />

        <V3SectionTracker pageType="subdivision" />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Communities', href: '/communities' },
            ...(resortSlug
              ? [{ label: resortLabel ?? displayName, href: `/communities/${resortSlug}` }]
              : citySlug
                ? [{ label: cityName, href: `/cities/${citySlug}` }]
                : []),
            { label: displayName },
          ]}
        />

        {homesMode === 'field' ? (
          <>
          <V3Quiet
            id="overview"
            heading={`Homes for sale in ${displayName}`}
            headingLevel={1}
            items={[{ label: parentLabel, href: parentHref }]}
          />
          <V3Field
            id="homes"
            ariaLabel={`Homes for sale in ${displayName}`}
            items={fieldItems}
            mapSlot={
              <PlaceFieldMap pins={mapPins} boundary={mapPolygon} placeName={displayName} />
            }
            count={{
              value: fieldItems.length.toLocaleString('en-US'),
              label: fieldItems.length === 1 ? 'home shown here' : 'homes shown here',
              source: fieldSource,
            }}
            mapNote={mapPolygon ? `The outline is the recorded ${displayName} plat boundary.` : undefined}
          />
          </>
        ) : firstHome ? (
          <V3Ledger
            id="homes"
            headingLevel={1}
            eyebrow={v3Text(eyebrow)}
            heading={v3Text(`Homes for sale in ${displayName}`)}
            rows={[firstHome, ...restHomes]}
            source={v3Text(homesLedgerTrace(platScope))}
            action={parentHref ? { label: v3Text(parentLabel), href: parentHref, variant: 'ghost' } : undefined}
          />
        ) : (
          <V3Ledger
            id="homes"
            headingLevel={1}
            eyebrow={v3Text(eyebrow)}
            heading={v3Text(`Homes for sale in ${displayName}`)}
            rows={[]}
            emptyMessage={v3Text(
              homesMode === 'unknown'
                ? `The inventory query for ${displayName} did not return, so this is not a claim that nothing is for sale.`
                : `No single-family home is listed in ${displayName} right now.`,
            )}
            action={parentHref ? { label: v3Text(parentLabel), href: parentHref, variant: 'ghost' } : undefined}
          />
        )}

        <SubdivisionSchools displayName={displayName} schools={subdivisionSchools} edges={edges} />

        {firstPlatFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text(`${displayName} · ${statsPeriodLabel}`)}
            headline={v3Text(`${displayName} sales, ${statsPeriodLabel.toLowerCase()}`)}
            figures={[firstPlatFigure, ...restPlatFigures]}
            source={v3Text(platStatsTrace(displayName, cityName, statsPeriodLabel))}
            updated={
              subdivisionStats?.refreshedAt
                ? v3Text(formatDate(subdivisionStats.refreshedAt))
                : undefined
            }
            chart={salesChart}
          />
        ) : null}

        <SubdivisionSalesHistory
          displayName={displayName}
          history={salesHistory}
          cityName={cityName}
          chart={firstPlatFigure ? undefined : salesChart}
        />

        {showParentBand ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text(`${parentLabel} · Market`)}
            headline={v3Text(`The wider ${parentLabel} market`)}
            figures={[firstParentFigure, ...restParentFigures]}
            source={v3Text(parentMarketTrace(parentLabel, parentCovers))}
            updated={
              parentPulse.refreshedAt ? v3Text(formatDate(parentPulse.refreshedAt)) : undefined
            }
          />
        ) : null}

      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
