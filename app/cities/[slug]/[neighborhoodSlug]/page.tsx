/**
 * /cities/[slug]/[neighborhoodSlug] — the neighborhood node.
 *
 * First screen: H1 `{Neighborhood} homes for sale`, PlaceFaceStrip (polygon
 * SFR count + median list only), PlaceSplitView seeded from
 * getGeoBoundaryMapData. Do not write ?shapes= onto this URL. Do not cage the
 * first screen in V3Stage or V3Field.
 *
 * Face SoR is getNeighborhoodPublicInventory. leftoverHudKpis still feeds
 * buildMarketFaq JSON-LD. MOS, sold count, verdict, and DTP do not print on
 * the face. Leftover monthly charts only when cityFallback is false.
 *
 * Section order: design_system/ryan-realty/ui_kits/neighborhood/parity.json.
 */

import { notFound } from 'next/navigation'
import { readCityOpenHouses, openHouseRows, OPEN_HOUSE_TRACE } from '@/lib/kb/place-open-houses'
import type { Metadata } from 'next'
import { getNeighborhoodBySlug, getCommunitiesInNeighborhood } from '@/app/actions/cities'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import {
  getPublicDetachedMonthly,
  leftoverNeighborhoodOrCityMonthly,
} from '@/lib/data/market-truth/public-monthly'
import { zonedDateKey, formatDate } from '@/lib/format/date'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { resolveNeighborhoodMetricSlug } from '@/lib/data/market-truth/neighborhood-metric-slug'
import {
  getAreaGuideVideo,
  getListingTiles,
  getGeoBoundaryMapData,
  getCommunitySubdivisions,
  getAllCitySnapshots,
  getRecentBlogPosts,
  getDetachedOverlays,
  cityDetachedSlug,
  getCityHeroUrlsBySlug,
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getNeighborhoodPublicInventory } from '@/lib/data/geo/neighborhood-public-inventory'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { communityImage, preferPlaceHero } from '@/lib/geo-images'
import { cityLibraryHero, cityStagePoster, placeLibraryHero } from '@/app/cities/[slug]/_v3/city-opening'
import { buildYearSeries } from '@/lib/kb/year-series'
// Row-to-prop shaping shared with the city + community place pages - one copy,
// so a fix cannot land on one of the three and drift on the others.
import {
  buildActivityItems,
  buildArticlePosts,
  buildOtherCityItems,
} from '@/lib/kb/place-sections'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { publishPlaceFace } from '@/lib/market/publish-place-face'
import { slugify, subdivisionListingsPath } from '@/lib/slug'
import { loadSubdivisionTypeBits } from '@/lib/market/publish-subdivision-type-bits'
import { valuationHref } from '@/lib/site/valuation-href'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { skippableRail, skippableRailResult } from '@/lib/build-phase'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  v3Text,
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3Instrument,
  V3Ledger,
  V3PlaceCharacter,
  V3PlaceDocuments,

  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { PlaceFaceStrip } from '@/components/place/PlaceFaceStrip'
import { V3Atlas, type AtlasRegion } from '@/components/site/v3'
import { buildPlaceAtlas } from '@/lib/atlas/build-place-atlas'
import { atlasRegionName } from '@/lib/atlas/place-names'
import { PlaceAreaHero } from '@/components/place/PlaceAreaHero'
import { PlaceTypeSlider } from '@/components/place/PlaceTypeSlider'
import { PlaceSplitView } from '@/components/search/PlaceSplitView'
import {
  placeTypeCoverPhotos,
  publishPlaceTypeCards,
} from '@/lib/place/publish-place-type-cards'
import { loadPlaceTypeCoverPhotos } from '@/lib/place/load-place-type-covers'
import { getPlaceDocuments } from '@/lib/data/places/getPlaceDocuments'
import { getPlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { peerNeighborhoodTowns } from '@/lib/explore/neighborhood-peers'
import { buildNeighborhoodSchemas } from './neighborhood-schemas'
import { neighborhoodMarketChartCards } from './_v3/neighborhood-market-charts'
import { NeighborhoodAlertsSheet } from './_v3/NeighborhoodAlertsSheet.client'
import { dailyLifeRows } from './_v3/neighborhood-daily-life'
import {
  neighborhoodAboutItems,
  neighborhoodExploreItems,
  neighborhoodFaceFigures,
  neighborhoodHeadline,
  neighborhoodMarketTrace,
  neighborhoodSplitListings,
} from './_v3/neighborhood-sections'
import {
  activityRows,
  areaGuideRow,
  articleRows,
  PLACE_COUNT_TRACE,
  placeFigureRows,
  placeMedianChart,
  placeMedianChartCaption,
  type CityPlaceItem,
} from '@/app/cities/[slug]/_v3/city-sections'

export async function generateStaticParams(): Promise<Array<{ slug: string; neighborhoodSlug: string }>> {
  const { BEND_NEIGHBORHOOD_DISTRICTS } = await import('@/lib/data/geo/getBendNeighborhoodLedger')
  return BEND_NEIGHBORHOOD_DISTRICTS.map((n) => ({ slug: 'bend', neighborhoodSlug: n.slug }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = {
  params: Promise<{ slug: string; neighborhoodSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Short form for the character-constrained meta description below ONLY.
const fmtK = (n: number | null): string | null => (n != null ? `$${Math.round(n / 1000).toLocaleString()}K` : null)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const title =
    neighborhood.seoTitle?.trim() ||
    `${neighborhood.name} homes for sale | ${neighborhood.cityName}, Oregon`

  const inventory =
    citySlug === 'bend'
      ? await getNeighborhoodPublicInventory(`${citySlug}-${neighborhoodSlug}`)
      : null
  const generatedDescription =
    inventory != null && inventory.activeCount > 0
      ? `${inventory.activeCount} single-family homes for sale in ${neighborhood.name}, ${neighborhood.cityName}. Median list price ${inventory.medianListPrice != null ? fmtK(inventory.medianListPrice) ?? '' : 'available on request'}. Live market data from the regional MLS.`
      : `Active single-family homes in ${neighborhood.name}, ${neighborhood.cityName}, Oregon. List prices and days on market, pulled live.`
  // Brand voice (CLAUDE.md): a curated DB seo_description carrying a banned
  // cliche (the live "charming" on /cities/bend/old-bend) must never reach the
  // SERP, so a tripped guard falls back to the clean data-driven description.
  const bannedDescRe =
    /\b(charming|stunning|nestled|boasts|pristine|breathtaking|must-see|hidden gem|luxurious|meticulously|gorgeous|immaculate)\b/i
  const description =
    neighborhood.seoDescription && !bannedDescRe.test(neighborhood.seoDescription)
      ? neighborhood.seoDescription
      : generatedDescription

  return pageMetadata({
    title,
    description,
    path: `/cities/${citySlug}/${neighborhoodSlug}`,
  })
}

export default async function NeighborhoodDetailPage({ params, searchParams }: Props) {
  const { slug: citySlug, neighborhoodSlug } = await params
  const sp = await searchParams

  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const cityName = neighborhood.cityName

  // D94 restored 2026-08-27. Open houses are recorded per listing and scoped by
  // CITY -- there is no neighbourhood feed -- so the eyebrow names the city.
  const openHouses = await readCityOpenHouses(neighborhood.cityName)
  const [firstOh, ...restOh] = openHouseRows(openHouses)

  // Boundary polygon slug for neighborhoods: "{citySlug}-{neighborhoodSlug}".
  const boundaryNeighborhoodSlug = `${citySlug}-${neighborhoodSlug}`
  // GIS / inventory / map stay on the prefixed boundary key. Market Truth
  // neighborhood geo_slug is often the community slug (sunriver, not
  // sunriver-sunriver). Identity probe, not a published figure.
  const metricNeighborhoodSlug = await resolveNeighborhoodMetricSlug({
    citySlug,
    neighborhoodSlug,
  })

  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [
    boundaryRead,
    allCitySnapshots,
    blogPosts,
    activity,
    neighborhoodCommunities,
    richContent,
    peerNeighborhoods,
    inventoryRead,
    publicPace,
    publicSegments,
    leftoverCityMonthly,
    leftoverNeighborhoodMonthly,
    nbhOverlays,
    placeDocuments,
    placeCharacter,
    indexCities,
  ] = await Promise.all([
    // Result variant: a timed-out boundary yields `{ pins: [] }`, which is
    // indistinguishable from a genuinely empty neighborhood. `.ok` keeps them
    // apart so a degraded read can never publish a count (§0). Skipped during
    // SSG - the polygon centroid refills on first revalidate; counts come from
    // the inventory read, never from pins.
    skippableRailResult(() => getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'nbh:boundary'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'nbh:cities'),
    skippableRail(() => getRecentBlogPosts({ limit: 24 }), [], 3000, 'nbh:blog'),
    skippableRail(() => getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }), [], 3500, 'nbh:activity'),
    skippableRail(() => getCommunitiesInNeighborhood(neighborhood.id, cityName), [], 3500, 'nbh:communities'),
    withTimeoutFallback(getResortCommunityContent(boundaryNeighborhoodSlug), null, 2500, 'nbh:content'),
    withTimeoutFallback(peerNeighborhoodTowns(citySlug, neighborhoodSlug), [], 3500, 'nbh:peers'),
    getNeighborhoodPublicInventory(boundaryNeighborhoodSlug),
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug }),
      EMPTY_PUBLIC_PACE,
      3000,
      'nbh:publicPace',
    ),
    withTimeoutFallback(
      getPublicPlaceSegments({ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug }),
      [],
      3000,
      'nbh:publicSegments',
    ),
    withTimeoutFallback(
      getPublicDetachedMonthly({ geoType: 'city', geoSlug: citySlug, currentMonthKey }),
      [],
      4500,
      'nbh:leftoverCityMonthly',
    ),
    withTimeoutFallback(
      getPublicDetachedMonthly({
        geoType: 'neighborhood',
        geoSlug: metricNeighborhoodSlug,
        currentMonthKey,
      }),
      [],
      4500,
      'nbh:leftoverNeighborhoodMonthly',
    ),
    withTimeoutFallback(
      getDetachedOverlays([{ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug }]),
      new Map(),
      3000,
      'nbh:detachedOverlay',
    ),
    // metricNeighborhoodSlug, NOT the route param. The route serves 13 Bend
    // districts under short slugs ("mountain-view") while the boundary row that
    // carries the documents is "bend-mountain-view". Using the raw param here
    // would silently find nothing and look exactly like "this place has no
    // CC&Rs".
    withTimeoutFallback(getPlaceDocuments('neighborhood', metricNeighborhoodSlug), [], 4000, 'nbh:documents'),
    // Build years + HOA, measured from member listings (PLACE_CONTENT_RULES
    // R1/R2/R3). boundaryNeighborhoodSlug, NOT the metric slug: place_membership
    // assigns neighborhood membership from the boundaries polygon. Measured
    // 2026-08-26: neighborhood/mountain-view has 0 member listings and
    // neighborhood/bend-mountain-view has 11,663.
    withTimeoutFallback(
      getPlaceCharacter('neighborhood', boundaryNeighborhoodSlug),
      null,
      4000,
      'nbh:character',
    ),
    withTimeoutFallback(getCityHeroUrlsBySlug(), {}, 3000, 'nbh:liveHeroes'),
  ])
  const nbhMt = nbhOverlays.get(`neighborhood:${cityDetachedSlug(metricNeighborhoodSlug)}`)
  const hud = leftoverHudKpis({
    grain: 'neighborhood',
    headlines: nbhMt?.headlines ?? null,
    inventory: nbhMt?.inventory ?? null,
    pace: publicPace,
  })

  const boundaryMapData = boundaryRead.value
  // The living map, scoped to the neighborhood: every listing inside the
  // recorded boundary, its plats as the touchable places. Same builder as
  // the homepage (one source).
  const [atlas, atlasPlats] = boundaryMapData.polygon
    ? await Promise.all([
        withTimeoutFallback(
          buildPlaceAtlas({ cities: [cityName], boundary: boundaryMapData.polygon, label: neighborhood.name }),
          null,
          6000,
          'nbh:atlas',
        ),
        withTimeoutFallback(getCommunitySubdivisions({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), [], 4500, 'nbh:atlasPlats'),
      ])
    : [null, []]
  const atlasRegions: AtlasRegion[] = boundaryMapData.polygon
    ? [
        { id: `neighborhood:${neighborhoodSlug}`, kind: 'town', kindLabel: 'Neighborhood', name: neighborhood.name, href: `/cities/${citySlug}/${neighborhoodSlug}`, geometry: boundaryMapData.polygon },
        ...atlasPlats.slice(0, 80).map(
          (cell): AtlasRegion => ({ id: `subdivision:${cell.slug}`, kind: 'neighborhood', kindLabel: 'Subdivision', name: atlasRegionName(cell.label) ?? cell.label, href: `/subdivisions/${cell.slug}`, geometry: cell.geometry }),
        ),
      ]
    : []
  const inventory = inventoryRead
  // Counted set = SFR + PUBLIC_ACTIVE inside the recorded boundary. Same
  // payload as /neighborhoods and /cities/bend tiles. Do not fall back to pin
  // length, pulse.active_count, or listing_tile_mv tags - those are different
  // populations (Awbrey Butte 52 / 62 / 63, 2026-08-16). A measured empty
  // (inventory present, 0 keys) must not revive pin-only homes.
  const inventoryOk = inventory != null
  const countedKeys = inventoryOk ? inventory.listingKeys : []
  const listingTiles =
    countedKeys.length > 0
      ? await withTimeoutFallback(
          getListingTiles({ listingKeys: countedKeys, status: 'active', propertyType: 'A', limit: 250 }),
          [],
          4500,
          'nbh:tiles',
        )
      : []
  const splitListings = inventoryOk ? neighborhoodSplitListings(listingTiles) : undefined
  const typeCovers = await withTimeoutFallback(
    loadPlaceTypeCoverPhotos({ city: cityName, neighborhood: neighborhood.name }),
    {},
    4500,
    'nbh:typeThumbs',
  )

  const face = publishPlaceFace({
    grain: 'neighborhood',
    hud,
    active: inventoryOk ? inventory.activeCount : null,
    medianList: inventoryOk ? inventory.medianListPrice : null,
  })
  const typeCards = publishPlaceTypeCards({
    browsePath: subdivisionListingsPath(cityName, neighborhood.name),
    placeName: neighborhood.name,
    sfrCount: inventoryOk ? inventory.activeCount : null,
    sfrMedian: inventoryOk ? inventory.medianListPrice : null,
    sfrMos: null,
    segments: publicSegments,
    covers: { ...placeTypeCoverPhotos(listingTiles), ...typeCovers },
  })
  const headline = neighborhoodHeadline(neighborhood.name)
  const trail = [
    { label: 'Home', href: '/' },
    { label: cityName, href: `/cities/${citySlug}` },
    { label: neighborhood.name },
  ]
  const ownedStill = communityImage(neighborhoodSlug) ?? communityImage(neighborhood.name)
  const [cityLibraryHeroUrl, nbhLibraryHeroUrl] = await Promise.all([
    withTimeoutFallback(cityLibraryHero(citySlug), null, 3000, 'nbh:cityLibraryHero'),
    withTimeoutFallback(
      (async () =>
        (await placeLibraryHero('neighborhood', neighborhoodSlug)) ??
        (await placeLibraryHero('neighborhood', boundaryNeighborhoodSlug)))(),
      null,
      3000,
      'nbh:libraryHero',
    ),
  ])
  const stagePosterSrc =
    cityStagePoster(ownedStill, nbhLibraryHeroUrl) ??
    cityStagePoster(indexCities[citySlug], cityLibraryHeroUrl)

  /* ── The market, off the ONE leftover pile ─────────────────────────────── */

  const leftoverStamp = nbhMt?.headlines?.computedAt ?? nbhMt?.inventory?.computedAt ?? null
  const marketFaqInput: MarketFaqInput = {
    grain: 'neighborhood',
    source: 'market-truth',
    activeCount: hud.active,
    pulseActiveCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: null,
    medianDaysToPending: hud.daysToPending,
    soldCount12mo: publicPace.closedCount ?? null,
    refreshedAt: leftoverStamp,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(neighborhood.name, marketFaqInput)

  const browseHref = subdivisionListingsPath(cityName, neighborhood.name)
  const figures = neighborhoodFaceFigures(face.stats)
  const [firstMarketFigure, ...restMarketFigures] = figures

  const chartMonths = leftoverNeighborhoodOrCityMonthly({
    leftoverNeighborhood: leftoverNeighborhoodMonthly,
    leftoverCity: leftoverCityMonthly,
    neighborhoodCache: [],
    cityCache: [],
    currentMonthKey,
    neighborhoodCacheSparse: true,
  })
  const placeMonthly = chartMonths.leftoverUsed && !chartMonths.cityFallback
  const medianChart = placeMonthly
    ? placeMedianChart(
        buildYearSeries(chartMonths.months, 5),
        placeMedianChartCaption(neighborhood.name),
      )
    : undefined

  // The approved chart-room forms (Unit NEIGHBORHOOD 2026-08-19), as Instrument
  // cards. Closed-side cards read the district polygon assignment; the
  // asking-price card reads the same inventory row this page's count comes
  // from. Neighborhood pulse and stats-cache closed figures are not charted.
  const marketCards = await neighborhoodMarketChartCards({
    geoSlug: boundaryNeighborhoodSlug,
    districtName: neighborhood.name,
  })

  /* ── The ledgers ───────────────────────────────────────────────────────── */

  const dailyRows = dailyLifeRows(richContent, cityName)
  const [firstDaily, ...restDaily] = dailyRows

  // Subdivisions inside the boundary. §0: a count the index read did not carry
  // stays null, never a zero. Each row's other-type bits are the destination
  // subdivision's own Market Truth segment counts (one source — the same rows
  // its page prints).
  const neighborhoodChildren = neighborhoodCommunities.slice(0, 12)
  const childTypeBits = await loadSubdivisionTypeBits(neighborhoodChildren.map((c) => slugify(c.subdivision)))
  const subdivisionItems: CityPlaceItem[] = neighborhoodChildren.map((c) => ({
    name: c.subdivision,
    href: `/subdivisions/${slugify(c.subdivision)}`,
    activeCount: c.activeCount ?? null,
    medianPrice: c.medianPrice ?? null,
    img: preferPlaceHero(c.heroImageUrl, communityImage(c.slug) ?? ''),
    typeBits: childTypeBits.get(slugify(c.subdivision)) ?? null,
  }))
  const [firstSub, ...restSub] = placeFigureRows(subdivisionItems, `${neighborhood.name} subdivision`)

  // Live feed - fetched city-wide (the MLS carries no neighborhood scope), so
  // it is labeled with whichever scope the rows actually carry (§0).
  const boundaryKeySet = new Set(countedKeys)
  const activityScoped = activity.filter((a) => boundaryKeySet.has(a.listing_key))
  const useActScoped = activityScoped.length > 0
  const activityItems = buildActivityItems(useActScoped ? activityScoped : activity, {
    staleNewAfterDays: 21,
  })
  const activityEyebrow = useActScoped ? `Live · ${neighborhood.name}` : `Live · ${cityName}`
  const [firstAct, ...restAct] = activityRows(activityItems)

  // Per-neighborhood area-guide clip (EXACT geo match; null for most).
  const areaGuideVideo = await withTimeoutFallback(getAreaGuideVideo(neighborhoodSlug), null, 3000, 'area-guide-video')
  const placeNameNeedle = neighborhood.name.toLowerCase()
  const articlePosts = buildArticlePosts(
    blogPosts.filter((post) => post.title.toLowerCase().includes(placeNameNeedle)),
  )
  const [firstGuide, ...restGuide] = [
    ...areaGuideRow(neighborhood.name, areaGuideVideo),
    ...articleRows(articlePosts),
  ]

  const peerItems: CityPlaceItem[] = peerNeighborhoods.map((p) => ({
    name: p.name,
    href: p.href,
    activeCount: p.activeCount ?? null,
    medianPrice: p.medianPrice ?? null,
    img: p.img ?? '',
  }))
  const [firstPeer, ...restPeer] = placeFigureRows(peerItems, `${cityName} neighborhood`)

  // No excludeSlug: a neighborhood page links its own city on purpose.
  const otherCityItems: CityPlaceItem[] = buildOtherCityItems(allCitySnapshots, {
    liveHeroBySlug: indexCities,
  })
  const [firstOther, ...restOther] = placeFigureRows(otherCityItems, 'Central Oregon city')

  /* ── Quiet content ─────────────────────────────────────────────────────── */

  const aboutItems = neighborhoodAboutItems({
    curatedProse: richContent?.aboutProse,
    description: neighborhood.description,
    cityName,
  })

  const exploreItems = neighborhoodExploreItems({
    placeName: neighborhood.name,
    cityName,
    citySlug,
    links: {
      browse: browseHref,
      valuation: valuationHref(`/cities/${citySlug}/${neighborhoodSlug}`),
    },
  })

  /* ── JSON-LD ───────────────────────────────────────────────────────────── */

  // Geo centroid for Place schema: average of in-boundary listing coords.
  const withCoords = boundaryMapData.pins.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  )
  const geo =
    withCoords.length > 0
      ? {
          lat: withCoords.reduce((a, p) => a + p.lat, 0) / withCoords.length,
          lng: withCoords.reduce((a, p) => a + p.lng, 0) / withCoords.length,
        }
      : undefined
  const hasMap = Boolean(boundaryMapData.polygon) || (splitListings != null && splitListings.length > 0)
  const neighborhoodSchemas: SchemaInput[] = buildNeighborhoodSchemas({
    neighborhoodName: neighborhood.name,
    neighborhoodSlug,
    cityName,
    citySlug,
    hasMap,
    geo,
    datasetVariables,
    asOfIso,
    asOfLabel,
  })
  // FAQPage rides with the schemas (2026-08-27 audit: the visible FAQ rendered
  // with NO FAQPage emission, against this contract's own jsonLd requirement —
  // the items are the same faqs array V3Quiet renders, one source, two sinks).
  if (faqs.length > 0) {
    neighborhoodSchemas.push({
      type: 'faqPage',
      items: faqs.map((f) => ({ question: f.question, answer: f.answer })),
    })
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={neighborhoodSchemas} />

        {stagePosterSrc ? (
          <PlaceAreaHero
            eyebrow={`${neighborhood.name} · ${cityName}`}
            headline={headline}
            posterSrc={stagePosterSrc}
            trail={trail}
            stats={face.stats}
          />
        ) : (
          <V3Breadcrumb trail={trail} />
        )}

        {stagePosterSrc ? null : (
          <div className="place-opening">
            <V3Heading level={1} size="field">
              {headline}
            </V3Heading>
            <PlaceFaceStrip stats={face.stats} />
          </div>
        )}
        {atlas && atlas.dots.length > 0 ? (
          <V3Atlas
            id="atlas"
            variant="dots"
            headingLevel={2}
            headline={v3Text(`${neighborhood.name} right now`)}
            dots={atlas.dots}
            regions={atlasRegions}
            types={atlas.types}
            events={atlas.events}
            source={atlas.source}
            stamp={atlas.stamp}
            incomplete={!atlas.complete}
          />
        ) : null}

        <PlaceTypeSlider cards={typeCards} label={`${neighborhood.name} property types`} />

        <div id="homes">
          <PlaceSplitView
            city={cityName}
            neighborhood={neighborhood.name}
            boundaryGeojson={boundaryMapData.polygon}
            seedRing
            placeQuery={`${neighborhood.name} ${cityName}`}
            listings={splitListings}
            totalCount={inventoryOk ? inventory.activeCount : undefined}
            degraded={!boundaryRead.ok && !inventoryOk}
            searchParams={sp}
          />
        </div>

        {firstMarketFigure && (medianChart || marketCards.length > 0) ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text(`${neighborhood.name} · Market`)}
            headline={v3Text(`${neighborhood.name} market`)}
            figures={[firstMarketFigure, ...restMarketFigures]}
            source={v3Text(neighborhoodMarketTrace(neighborhood.name, false))}
            chart={medianChart}
            cards={marketCards}
            updated={leftoverStamp ? v3Text(formatDate(leftoverStamp)) : undefined}
          />
        ) : null}

        {firstDaily ? (
          <V3Ledger
            id="daily-life"
            eyebrow={v3Text(`${neighborhood.name} · Daily life`)}
            heading={v3Text('Schools')}
            rows={[firstDaily, ...restDaily]}
            action={{ label: v3Text('Every school'), href: '/schools' }}
          />
        ) : null}

        {aboutItems.length > 0 ? (
          <V3Quiet
            id="about"
            eyebrow={`${neighborhood.name} · ${cityName}`}
            heading={`${neighborhood.name}, in plain words`}
            items={aboutItems}
          />
        ) : null}

        {/* Subdivisions inside the boundary - every row is a door. */}
        {firstSub ? (
          <V3Ledger
            id="subdivisions"
            eyebrow={v3Text(`${neighborhood.name} · Subdivisions`)}
            heading={v3Text('Subdivisions')}
            rows={[firstSub, ...restSub]}
            source={v3Text(`${PLACE_COUNT_TRACE}; other property types are that subdivision's own counted segments, the same rows its page prints`)}
            action={{ label: v3Text(`All ${cityName} homes`), href: `/homes-for-sale/${citySlug}` }}
          />
        ) : null}

        {/* Pattern 1 again, as ONE enumeration: one section per other property
            type this neighborhood holds. */}


        {/* The recorded governing documents (Ledger; renders null when the
            place has none on file). Metric slug - see the read above. */}
        <V3PlaceDocuments displayName={neighborhood.name} documents={placeDocuments} />

        {/* Build years + HOA, measured (Quiet; renders null when nothing is
            publishable). */}
        <V3PlaceCharacter placeName={neighborhood.name} character={placeCharacter} />

        {/* D93: the live feed, every row carrying its listing's own photo. */}
        {firstAct ? (
          <V3Ledger
            id="activity"
            layout="pulse"
            eyebrow={v3Text(activityEyebrow)}
            heading={v3Text('Latest market activity')}
            rows={[firstAct, ...restAct]}
            source={v3Text(
              `live MLS through Oregon Data Share, new listings, price changes, pendings, and closings on ${useActScoped ? neighborhood.name : cityName} homes`,
            )}
            action={{ label: v3Text('Full market pulse'), href: '/housing-market' }}
          />
        ) : null}

        {firstOh ? (
          <V3Ledger
            id="open-houses"
            layout="walk"
            eyebrow={v3Text(`This week · ${cityName}`)}
            heading={v3Text('Open houses you can walk through')}
            rows={[firstOh, ...restOh]}
            source={v3Text(OPEN_HOUSE_TRACE)}
            action={{ label: v3Text(`Every open house in ${cityName}`), href: `/open-houses/${citySlug}` }}
          />
        ) : null}

        {/* Pattern 5, Sheet. Same server action, same payload, same honeypot. */}
        <NeighborhoodAlertsSheet cityName={cityName} neighborhoodName={neighborhood.name} />

        {/* Guides - real published posts, never generated filler. */}
        {firstGuide ? (
          <V3Ledger
            id="guides"
            layout="magazine"
            eyebrow={v3Text('Guides and news')}
            heading={v3Text(`${neighborhood.name} guides`)}
            rows={[firstGuide, ...restGuide]}
            action={{ label: v3Text('Every guide'), href: '/blog' }}
          />
        ) : null}

        {/* THE MARKET QUESTION (Matt 2026-08-26: it stays on all five place
            grains). The opening Instrument is the H1 head term, so the
            question renders here, as the FAQ section's own heading, with the
            verdict answer as the first item beneath it. */}
        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading={`Questions about ${neighborhood.name}`}
          items={faqs.map((item) => ({ kind: 'prose' as const, term: item.question, body: item.answer }))}
        />

        {/* Peer neighborhoods - the same designated-district set, minus this
            one. */}
        {firstPeer ? (
          <V3Ledger
            id="peer-neighborhoods"
            layout="places"
            eyebrow={v3Text(`${cityName} · Other neighborhoods`)}
            heading={v3Text('Explore nearby neighborhoods')}
            rows={[firstPeer, ...restPeer]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text(`All of ${cityName}`), href: `/cities/${citySlug}` }}
          />
        ) : null}

        <V3Quiet
          id="explore"
          eyebrow={`${neighborhood.name} · Explore`}
          heading="Where to next"
          items={exploreItems}
        />

        {/* Exit links last: every row leaves this page. */}
        {firstOther ? (
          <V3Ledger
            id="nearby"
            layout="places"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Other cities on the list')}
            rows={[firstOther, ...restOther]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text('Every city'), href: '/cities' }}
          />
        ) : null}
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo
          only when it is NOT nested in sectioning content. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
