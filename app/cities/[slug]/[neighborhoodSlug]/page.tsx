/**
 * /cities/[slug]/[neighborhoodSlug] — the neighborhood node.
 *
 * First screen: H1 is the neighborhood name on the photograph, living atlas,
 * PlaceSplitView seeded from getGeoBoundaryMapData. Nested subdivision rings
 * draw as Atlas regions and Split overlayBoundaries, the same class prop
 * community uses. Do not write ?shapes= onto this URL. Do not cage the first
 * screen in V3Stage or V3Field. Do not print leftover KPIs on the photo.
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
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { EMPTY_PUBLIC_MIX, getPublicDetachedMix } from '@/lib/data/market-truth/public-mix'
import { getLiveMortgageRate } from '@/lib/data/market/getLiveMortgageRate'
import { DEFAULT_DISPLAY_RATE } from '@/lib/mortgage'
import { publishPlaceAffordability } from '@/lib/place/publish-place-affordability'
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
  getPlaceOpeningListings,
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
import { buildPlaceMosView } from '@/lib/site/place-mos'
import { buildPlaceAlertTypes } from '@/lib/site/place-alerts'
import { publishPlaceFace } from '@/lib/market/publish-place-face'
import { slugify, subdivisionListingsPath } from '@/lib/slug'
import { loadSubdivisionTypeBits } from '@/lib/market/publish-subdivision-type-bits'
import { valuationHref } from '@/lib/site/valuation-href'
import { pageMetadata } from '@/lib/site/page-metadata'
import { neighborhoodPageTrail } from '@/lib/site/place-trail'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { skippableRail, skippableRailResult } from '@/lib/build-phase'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { answersFaqItems, buildPlaceAnswers } from '@/lib/site/place-answers'
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
  V3Answers,
  V3PlaceAffordability,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { V3Atlas, type AtlasRegion } from '@/components/site/v3'
import { basemapForRegions } from '@/lib/geo/basemap-source'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { PlaceAreaHero } from '@/components/place/PlaceAreaHero'
import { PlaceTypeSlider } from '@/components/place/PlaceTypeSlider'
import { PlaceSplitView } from '@/components/search/PlaceSplitView'
import {
  placeTypeCoverPhotos,
  publishPlaceTypeCards,
} from '@/lib/place/publish-place-type-cards'
import { loadPlaceTypeCoverPhotos } from '@/lib/place/load-place-type-covers'
import { overlaysFromChildCells, regionsFromChildCells } from '@/lib/place/child-rings'
import { getPlaceDocuments } from '@/lib/data/places/getPlaceDocuments'
import { getPlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { peerNeighborhoodTowns } from '@/lib/explore/neighborhood-peers'
import { buildNeighborhoodSchemas } from './neighborhood-schemas'
import { areaGuideVideoSchema } from '@/lib/site/area-guide-schema'
import {
  leftoverClosedCount,
  placeCostChart,
  tooFewSalesItems,
} from '@/app/cities/[slug]/_v3/place-graphics'
import { NeighborhoodAlertsStrip } from './_v3/NeighborhoodAlertsSheet.client'
import { NeighborhoodMosFigure } from './_v3/NeighborhoodMosFigure.client'
import { buildNeighborhoodSupplyPages } from './_v3/neighborhood-mos-insight'
import { dailyLifeRows } from './_v3/neighborhood-daily-life'
import '../_v3/city-fold.css'
import './_v3/neighborhood-fold.css'
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
}

// Short form for the character-constrained meta description below ONLY.
const fmtK = (n: number | null): string | null => (n != null ? `$${Math.round(n / 1000).toLocaleString()}K` : null)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const title =
    neighborhood.seoTitle?.trim() ||
    `${neighborhood.name} · ${neighborhood.cityName}, Oregon`

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
  // SITE-84: when inventory is publishable, the SERP carries the live count and
  // median first — a fluff paragraph without a figure loses the information race.
  const bannedDescRe =
    /\b(charming|stunning|nestled|boasts|pristine|breathtaking|must-see|hidden gem|luxurious|meticulously|gorgeous|immaculate)\b/i
  const curated =
    neighborhood.seoDescription && !bannedDescRe.test(neighborhood.seoDescription)
      ? neighborhood.seoDescription
      : null
  const description =
    inventory != null && inventory.activeCount > 0
      ? generatedDescription
      : curated ?? generatedDescription

  return pageMetadata({
    title:
      inventory != null && inventory.activeCount > 0
        ? `${neighborhood.name} homes for sale · ${neighborhood.cityName}, Oregon`
        : title,
    description,
    path: `/cities/${citySlug}/${neighborhoodSlug}`,
  })
}

export default async function NeighborhoodDetailPage({ params }: Props) {
  const { slug: citySlug, neighborhoodSlug } = await params

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
    cityPace,
    openingListings,
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
    // The parent city's same statistics, ONLY as the context mark on the
    // answer scales (SITE-08). Never as a figure under this neighborhood's
    // name: a city figure printed as a neighborhood's is the founding defect
    // behind lib/market/publish-plat-figures.ts. Every sentence that uses one
    // names the city out loud.
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'city', geoSlug: citySlug }),
      EMPTY_PUBLIC_PACE,
      3000,
      'nbh:cityPace',
    ),
    withTimeoutFallback(
      getPlaceOpeningListings({ city: cityName, neighborhood: neighborhood.name }),
      [],
      3000,
      'nbh:openingListings',
    ),
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
        ...regionsFromChildCells(atlasPlats),
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
  const trail = neighborhoodPageTrail({ label: cityName, slug: citySlug }, neighborhood.name)
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
  const mosAsOf = leftoverStamp ? formatDate(leftoverStamp) : null
  const placeMosBase = buildPlaceMosView({
    active: hud.active,
    monthsSupply: hud.monthsSupply,
    grain: 'neighborhood',
    geoSlug: metricNeighborhoodSlug,
    asOf: mosAsOf,
  })
  // SITE-84 layout lock: do not say bare "Homes for sale" next to a different
  // Atlas / Field count — name the MOS population (detached supply ratio).
  const placeMos = placeMosBase
    ? {
        ...placeMosBase,
        homesName: 'Detached for sale',
        caption: placeMosBase.caption.replace(
          'months of homes on the market',
          'months of detached supply',
        ),
      }
    : null
  // SITE-84/104: opening listings already carry price + beds/baths/sqft + 800×600
  // photos; buildPlaceAlertTypes aligns claim count to the cards shown.
  const alertTypes = buildPlaceAlertTypes({
    placeName: neighborhood.name,
    scopeName: cityName,
    geoType: 'neighborhood',
    geoSlug: metricNeighborhoodSlug,
    leftoverHouses30d: publicPace.newCount30d,
    buckets: openingListings,
  })
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

  /* ── The cited Q&A (SITE-08) ────────────────────────────────────────────
     One array feeds the visible rows AND the FAQPage JSON-LD, so the markup
     cannot describe a sentence the page does not print. Every row carries the
     ONE figure it is about, with its own trace.

     TWO HONEST COUNTS, NAMED APART. The metric layer counts 49 Awbrey Butte
     actives by primary place membership; the recorded polygon holds 60 in a
     publicly active MLS status (measured 2026-09-08). The inventory answer
     publishes the count this PAGE publishes — the one in its own Field — and
     the verdict's trace names the 49 its own ratio was computed on, so the two
     figures can never be read as one number disagreeing with itself (§0 rule 5). */
  const nbhAnswerActive = inventoryOk ? inventory.activeCount : null
  const metricKey = `neighborhood:${metricNeighborhoodSlug}`
  const { answers: placeAnswers, traces: answerTraces, sourceKey: answerSourceKey } = buildPlaceAnswers({
    placeName: neighborhood.name,
    cityName,
    figures: {
      monthsOfSupply: hud.monthsSupply,
      monthsOfSupplyActiveCount: hud.active,
      activeCount: nbhAnswerActive,
      activeCountTrace: `the recorded ${neighborhood.name} boundary, single-family homes in a publicly active MLS status at the last sync`,
      // SAY WHY THE TWO COUNTS DIFFER, IN THE ANSWER. Both traces were already
      // correct and each named its own population, but the verdict row and the
      // inventory row sit a few rows apart and both use the word "active" —
      // 48 in one, 57 in the other on Awbrey Butte. A separate evaluator read
      // that as an unreconciled contradiction (2026-09-08), and it was right
      // that a reader has to be TOLD, not left to reconstruct it from two
      // trace lines. §0 rule 5: reconcile the narrative to the data.
      activeCountNotes:
        nbhAnswerActive != null && hud.active != null && nbhAnswerActive !== hud.active
          ? [
              `The supply verdict above divides ${hud.active}, not this ${nbhAnswerActive}. That ratio counts the homes the market layer assigns to ${neighborhood.name} by place membership; this count is the homes inside its recorded boundary. Two honest counts of two populations, and neither is a correction of the other.`,
            ]
          : null,
      closedCount:
        publicPace.closedCount != null && publicPace.closedCount > 0
          ? { count: publicPace.closedCount, windowLabel: 'over the past 12 months' }
          : null,
      daysToPending: hud.daysToPending,
      cityDaysToPending: cityPace.daysToPending90d,
      saleToOriginal: publicPace.saleToOriginal,
      citySaleToOriginal: cityPace.saleToOriginal,
      cashShare: publicPace.cashShare,
      cityCashShare: cityPace.cashShare,
      medianSalePrice:
        publicPace.medianClose != null && publicPace.medianClose > 0
          ? { price: publicPace.medianClose, windowLabel: 'over the past 12 months' }
          : null,
      medianListPrice: inventoryOk ? inventory.medianListPrice : null,
      // The list median comes off the SAME boundary read as the active count,
      // not off the metric layer, so it carries that read's clause and not the
      // page's default one (§0: one trace per query).
      medianListPriceTrace: `the recorded ${neighborhood.name} boundary, the list prices of the single-family homes in a publicly active MLS status at the last sync`,
    },
    // READER'S WORDS IN THE SENTENCE, MACHINE HANDLE IN THE ATTRIBUTE. This
    // clause used to open "market_metric ${metricKey} through the Market Truth
    // layer" — a table name and a raw slug, read by every visitor, which a
    // separate evaluator flagged on 2026-09-08 as the exact tell TASTE.md bans.
    // §0 still needs the handle, so it goes to `sourceKey` and lands in the
    // served HTML as data-source-key.
    sourceTrace: `regional MLS, detached single-family homes inside the ${neighborhood.name} boundary`,
    sourceKey: `market_metric:${metricKey}`,
    asOfLabel,
    // No SITE-01 address field on this route yet — the site's valuation spine
    // is the same ask one step away, and it carries this page as its source.
    valueAsk: { href: valuationHref(`/cities/${citySlug}/${neighborhoodSlug}`), onPage: false },
    extra: faqs,
  })
  const answerFaqs = answersFaqItems(placeAnswers)
  if (process.env.NODE_ENV !== 'production') {
    for (const line of answerTraces) console.log(`[nbh:${neighborhoodSlug}] ${line}`)
  }

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
  const closedN = leftoverClosedCount(hud, placeMonthly ? chartMonths.months : [])
  const costChart = placeMonthly ? placeCostChart(closedN, medianChart) : undefined
  // SITE-104: year/now InsightPager pages — how sales moved beside the MOS bars.
  // Prefer this neighborhood's leftover months; fall back to the chartMonths set.
  const mosSupplySource =
    leftoverNeighborhoodMonthly.length > 0
      ? leftoverNeighborhoodMonthly.map((row) => ({
          periodStart: row.periodStart,
          soldCount: row.closedCount,
        }))
      : chartMonths.months.map((row) => ({
          periodStart: row.periodStart,
          soldCount: row.soldCount,
        }))
  const mosSupplyPages = placeMos
    ? buildNeighborhoodSupplyPages({
        months: mosSupplySource,
        homesForSale: placeMos.homesForSale,
        monthOfSales: placeMos.monthOfSales,
        mosText: formatMonthsOfSupply(placeMos.mos),
      })
    : []

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
  // Its own children: the rows drop the neighborhood's name where a plat's
  // name opens with it (placeFigureRows, `within`).
  const [firstSub, ...restSub] = placeFigureRows(subdivisionItems, `${neighborhood.name} subdivision`, neighborhood.name)

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

  // Per-neighborhood area-guide clip (EXACT geo match; null for most). SITE-07
  // rides along: the detached financing mix for this neighborhood, and the
  // 30-yr rate READ from market_history_weekly (Freddie Mac PMMS, written every
  // Monday) so the calculator publishes a dated rate rather than an assumption
  // dressed as one. A null rate is not a zero — the section then says the
  // number is the visitor's own.
  const [areaGuideVideo, publicMix, liveRate] = await Promise.all([
    withTimeoutFallback(getAreaGuideVideo(neighborhoodSlug), null, 3000, 'area-guide-video'),
    withTimeoutFallback(
      getPublicDetachedMix({ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug }),
      EMPTY_PUBLIC_MIX,
      3000,
      'nbh:publicMix',
    ),
    withTimeoutFallback(getLiveMortgageRate(), null, 2500, 'nbh:mortgageRate'),
  ])

  // SITE-07: opened at the SAME median this page publishes on its face
  // (getNeighborhoodPublicInventory), over the population that median was
  // actually taken across — pricedCount, never activeCount, which counts
  // listings the median never saw.
  const affordability = publishPlaceAffordability({
    placeName: neighborhood.name,
    placeSlug: `${citySlug}/${neighborhoodSlug}`,
    grain: 'neighborhood',
    medianListPrice: inventoryOk ? inventory.medianListPrice : null,
    activeCount: inventoryOk ? inventory.pricedCount : null,
    computedAt: null,
    browseHref,
    rate: liveRate,
    fallbackRatePct: DEFAULT_DISPLAY_RATE,
    mix: publicMix,
    cashShare: publicPace.cashShare,
  })
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
  const neighborhoodGuideSchema = areaGuideVideoSchema(
    neighborhood.name,
    `/cities/${citySlug}/${neighborhoodSlug}`,
    areaGuideVideo,
  )
  if (neighborhoodGuideSchema) neighborhoodSchemas.push(neighborhoodGuideSchema)
  // FAQPage rides with the schemas (2026-08-27 audit: the visible FAQ rendered
  // with NO FAQPage emission, against this contract's own jsonLd requirement —
  // the items are the same faqs array V3Quiet renders, one source, two sinks).
  // SITE-08: the payload is derived FROM the rendered rows by answersFaqItems,
  // not built beside them from a second array. Two sinks, one source; a schema
  // that can drift from the visible text is the defect this replaces.
  if (answerFaqs.length > 0) {
    neighborhoodSchemas.push({ type: 'faqPage', items: answerFaqs })
  }

  // The read may not have completed: render the Atlas anyway, with its
  // honest sentence, instead of deleting the section (pass five, R7).
  const atlasView = atlas ?? EMPTY_PLACE_ATLAS
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={neighborhoodSchemas} />

        <div
          className={
            stagePosterSrc
              ? 'place-opening place-opening--media place-opening--neighborhood'
              : 'place-opening place-opening--neighborhood'
          }
        >
          <PlaceAreaHero posterSrc={stagePosterSrc} mos={placeMos} />
          {placeMos && mosSupplyPages.length >= 2 ? (
            <div className="place-opening__mos-insight">
              <NeighborhoodMosFigure supplyPages={mosSupplyPages} />
            </div>
          ) : null}
          {stagePosterSrc ? <div className="place-opening__scrim" aria-hidden="true" /> : null}
          <V3Breadcrumb trail={trail} tone={stagePosterSrc ? 'on-media' : 'surface'} />
          <div className="place-opening__copy">
            <V3Heading level={1} size="field" onMedia={Boolean(stagePosterSrc)}>
              {headline}
            </V3Heading>
            {/* SITE-84/104 SEO: crawlable city + inventory doors in the opening. */}
            <p className="place-opening__caption">
              <a href={`/cities/${citySlug}`}>{cityName} real estate</a>
              {' · '}
              <a href={browseHref}>{neighborhood.name} homes for sale</a>
            </p>
          </div>
        </div>

        {/* SITE-04: the ask as the first callout after the opening, with this
            neighborhood's real 30-day count as its claim and the city-scoped
            promise, plus the sticky repeat past #atlas from the same component.
            Same server action, same payload, same honeypot as the sheet it
            replaces. */}
        <NeighborhoodAlertsStrip
          id="alerts"
          cityName={cityName}
          neighborhoodName={neighborhood.name}
          geoSlug={metricNeighborhoodSlug}
          newCount30d={publicPace.newCount30d}
          updatedAt={leftoverStamp}
          browseHref={browseHref}
          types={alertTypes}
        />

        {(
          <V3Atlas
            id="atlas"
            headingLevel={2}
            headline={v3Text(`${neighborhood.name} right now`)}
            dots={atlasView.dots}
            regions={atlasRegions}
            basemap={basemapForRegions(atlasRegions)}
            types={atlasView.types}
            events={atlasView.events}
            source={atlasView.source}
            stamp={atlasView.stamp}
            incomplete={!atlasView.complete}
          />
        )}

        <PlaceTypeSlider cards={typeCards} label={`${neighborhood.name} property types`} />

        <div id="homes">
          <PlaceSplitView
            city={cityName}
            neighborhood={neighborhood.name}
            boundaryGeojson={boundaryMapData.polygon}
            overlayBoundaries={overlaysFromChildCells(atlasPlats)}
            seedRing
            placeQuery={`${neighborhood.name} ${cityName}`}
            listings={splitListings}
            totalCount={inventoryOk ? inventory.activeCount : undefined}
            degraded={!boundaryRead.ok && !inventoryOk}
          />
        </div>

        {/* Subdivisions inside the boundary - every row is a door. */}
        {firstSub ? (
          <V3Ledger
            id="subdivisions"
            eyebrow={v3Text(`${neighborhood.name} · Subdivisions`)}
            heading={v3Text('Subdivisions')}
            rows={[firstSub, ...restSub]}
            // A comparison, so the counts draw as lengths too: TASTE bans a
            // ledger past six rows that encodes nothing. The share comes off
            // the same counts the figures print (placeFigureRows).
            encode="bar"
            source={v3Text(`${PLACE_COUNT_TRACE}; other property types are that subdivision's own counted segments, the same rows its page prints`)}
            action={{ label: v3Text(`All ${cityName} homes`), href: `/homes-for-sale/${citySlug}` }}
          />
        ) : null}

        {costChart && firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text(`${neighborhood.name} · Typical price`)}
            headline={v3Text(`Typical price in ${neighborhood.name}`)}
            figures={[firstMarketFigure, ...restMarketFigures]}
            chartFirst
            foldAfter={0}
            source={v3Text(neighborhoodMarketTrace(neighborhood.name, false))}
            chart={costChart}
            updated={leftoverStamp ? v3Text(formatDate(leftoverStamp)) : undefined}
          />
        ) : placeMonthly && firstMarketFigure && !costChart ? (
          <V3Quiet
            id="market"
            heading={`Typical price in ${neighborhood.name}`}
            items={tooFewSalesItems()}
          />
        ) : null}

        {/* SITE-07: the two-way affordability instrument, after the
            typical-price Instrument and before daily life. Its own pattern, so
            neither neighbour repeats one. */}
        {affordability ? <V3PlaceAffordability id="afford" {...affordability} /> : null}

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
            heading={neighborhood.name}
            items={aboutItems}
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

        {/* D93: only when rows are inside this neighborhood's boundary. A city
            feed on an Awbrey Butte URL is city inventory on the wrong page
            (SITE-84 evaluator). */}
        {firstAct && useActScoped ? (
          <V3Ledger
            id="activity"
            layout="pulse"
            eyebrow={v3Text(activityEyebrow)}
            heading={v3Text('Latest market activity')}
            rows={[firstAct, ...restAct]}
            source={v3Text(
              `live MLS through Oregon Data Share, new listings, price changes, pendings, and closings on ${neighborhood.name} homes`,
            )}
            action={{ label: v3Text('Full market pulse'), href: '/housing-market' }}
          />
        ) : null}

        {/* Open houses are city-scoped in the MLS — name that, never imply this
            neighborhood. Prefer the city door over a misleading local list. */}
        {firstOh ? (
          <V3Ledger
            id="open-houses"
            layout="walk"
            eyebrow={v3Text(`This week · ${cityName}`)}
            heading={v3Text(`Open houses elsewhere in ${cityName}`)}
            rows={[firstOh, ...restOh]}
            source={v3Text(OPEN_HOUSE_TRACE)}
            action={{ label: v3Text(`Every open house in ${cityName}`), href: `/open-houses/${citySlug}` }}
          />
        ) : null}

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
        {/* A question set belongs in the primitive built for question sets. */}
        <V3Answers
          id="faq"
          eyebrow={`${neighborhood.name} · By the numbers`}
          heading={`${neighborhood.name} questions, answered with the number`}
          questions={placeAnswers}
          sourceKey={answerSourceKey}
          doors={[
            ...(browseHref ? [{ label: `Every home for sale in ${neighborhood.name}`, href: browseHref }] : []),
            { label: `${cityName} market report`, href: `/housing-market/${citySlug}` },
            { label: 'How we get our numbers', href: '/how-we-get-our-numbers' },
          ]}
          note={`Each answer carries the one figure it is about and where that figure came from. Figures are read from the regional MLS through Oregon Data Share.${
            asOfLabel ? ` Market data updated ${asOfLabel}.` : ''
          }`}
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
            // A comparison, so the counts draw as lengths too: TASTE bans a
            // ledger past six rows that encodes nothing. The share comes off
            // the same counts the figures print (placeFigureRows).
            encode="bar"
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
            // A comparison, so the counts draw as lengths too: TASTE bans a
            // ledger past six rows that encodes nothing. The share comes off
            // the same counts the figures print (placeFigureRows).
            encode="bar"
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
