/**
 * /cities/[slug]/[neighborhoodSlug] - the neighborhood node, on the
 * components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md §3 Neighborhood.
 * Instrument (this neighborhood's pace) then Field of its houses. Daily life
 * (schools, parks) on the first path - not amenities or membership. Section
 * order is the parity contract:
 * design_system/ryan-realty/ui_kits/neighborhood/parity.json.
 *
 * LEDGER IS THE PATTERN THIS ROUTE SPENDS ITS FIFTH SLOT ON, under the
 * 2026-08-26 place-family exception (PUBLIC_UI.md §3, Matt): daily life, the
 * subdivisions inside the boundary, the recorded documents, the live feed
 * (D93), the guides, the peer neighborhoods, and the other-cities exit are
 * scannable rows with one door each, and deleting them deleted directives.
 * Declared in parity.json, with the degraded-state adjacency conflicts.
 *
 * TWO SLUGS, TWO POPULATIONS, NEVER MIXED (the metricNeighborhoodSlug
 * convention). market_pulse_live has NO neighborhood rows; every market figure
 * comes from Market Truth leftover membership keyed by
 * resolveNeighborhoodMetricSlug (often the bare community slug), while GIS,
 * inventory, the map, and getPlaceCharacter key on the prefixed boundary slug
 * `${citySlug}-${neighborhoodSlug}`. Documents key on the METRIC slug - the
 * boundary row that carries CC&Rs is bend-mountain-view, not mountain-view.
 *
 * THE MARKET SECTION IS THE LEFTOVER HUD (MARKET_TRUTH): leftoverHudKpis with
 * grain 'neighborhood' is the one pile, the hero count is hud.active, a
 * missing cell is omitted, and pulse and the stats cache never fill a tile -
 * both under-count closings at this grain by 6x to 16x
 * (lib/market/geo-grain-trust.ts). buildMarketFaq runs UNCONDITIONALLY with
 * source 'market-truth' so the Dataset/FAQPage JSON-LD survives a leftover
 * miss at the cost of one figure, never the markup.
 *
 * THE MARKET QUESTION STAYS (Matt 2026-08-26, all five place grains). The
 * opening Instrument is this page's H1 and carries the money head term, so the
 * question renders as the FAQ section's heading - the same h2-question form
 * KbMarketHud carried - whenever the verdict answers it. With no verdict the
 * FAQ heading stays a label, because a question with no answer under it is
 * worse than a label.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata (seo fields +
 * banned-cliche guard), generateStaticParams over BEND_NEIGHBORHOOD_DISTRICTS
 * with dynamicParams, revalidate 60, MetadataBlock JSON-LD via
 * buildNeighborhoodSchemas, and a rendered V3SectionTracker.
 */

import { notFound } from 'next/navigation'
import { readCityOpenHouses, openHouseRows, OPEN_HOUSE_TRACE } from '@/lib/kb/place-open-houses'
import type { Metadata } from 'next'
import { getNeighborhoodBySlug, getCommunitiesInNeighborhood, getCitiesForIndex } from '@/app/actions/cities'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace, publicPaceItems } from '@/lib/data/market-truth/public-pace'
import {
  getPublicDetachedMonthly,
  leftoverNeighborhoodOrCityMonthly,
} from '@/lib/data/market-truth/public-monthly'
import { zonedDateKey, formatDate } from '@/lib/format/date'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { resolveNeighborhoodMetricSlug } from '@/lib/data/market-truth/neighborhood-metric-slug'
import { EMPTY_PUBLIC_MIX, getPublicDetachedMix } from '@/lib/data/market-truth/public-mix'
import {
  getAreaGuideVideo,
  getPriceHistory,
  getListingTiles,
  getGeoBoundaryMapData,
  getAllCitySnapshots,
  getRecentBlogPosts,
  getDetachedOverlays,
  cityDetachedSlug,
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getNeighborhoodPublicInventory } from '@/lib/data/geo/neighborhood-public-inventory'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { communityImage, preferPlaceHero } from '@/lib/geo-images'
import { buildYearSeries } from '@/lib/kb/year-series'
// Row-to-prop shaping shared with the city + community place pages - one copy,
// so a fix cannot land on one of the three and drift on the others.
import {
  buildActivityItems,
  buildArticlePosts,
  buildOtherCityItems,
  isTrendSeriesTooSparse,
} from '@/lib/kb/place-sections'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { slugify, subdivisionListingsPath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { skippableRail, skippableRailResult } from '@/lib/build-phase'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { marketVerdict } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  v3Text,
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Field,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3PlaceCharacter,
  V3PlaceDocuments,
  V3PlacePropertyTypes,
  V3Quiet,
  V3SectionTracker,
  V3SourceLine,
  type V3InstrumentFigure,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { getPlaceDocuments } from '@/lib/data/places/getPlaceDocuments'
import { getPlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { peerNeighborhoodTowns } from '@/lib/explore/neighborhood-peers'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'
import { buildNeighborhoodSchemas } from './neighborhood-schemas'
import { neighborhoodMarketChartCards } from './_v3/neighborhood-market-charts'
import { NeighborhoodAlertsSheet } from './_v3/NeighborhoodAlertsSheet.client'
import { dailyLifeRows } from './_v3/neighborhood-daily-life'
import {
  nbhFieldItems,
  nbhFieldEmptyMessage,
  neighborhoodAboutItems,
  neighborhoodExploreItems,
  neighborhoodFieldCaption,
  neighborhoodFieldTrace,
  neighborhoodMarketAbsenceItems,
  neighborhoodMarketTrace,
} from './_v3/neighborhood-sections'
import {
  activityRows,
  areaGuideRow,
  articleRows,
  leftoverMarketFigures,
  CITY_PACE_KEYS_ON_THE_HUD,
  PLACE_COUNT_TRACE,
  placeFigureRows,
  placeMedianChart,
  type CityPlaceItem,
} from '@/app/cities/[slug]/_v3/city-sections'
import { buildPublicMixFigures } from '@/app/housing-market/[...slug]/_v3/geo-figures'

export async function generateStaticParams(): Promise<Array<{ slug: string; neighborhoodSlug: string }>> {
  const { BEND_NEIGHBORHOOD_DISTRICTS } = await import('@/lib/data/geo/getBendNeighborhoodLedger')
  return BEND_NEIGHBORHOOD_DISTRICTS.map((n) => ({ slug: 'bend', neighborhoodSlug: n.slug }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string; neighborhoodSlug: string }> }

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

export default async function NeighborhoodDetailPage({ params }: Props) {
  const { slug: citySlug, neighborhoodSlug } = await params

  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const cityName = neighborhood.cityName

  // D94 restored 2026-08-27. Open houses are recorded per listing and scoped by
  // CITY -- there is no neighbourhood feed -- so the eyebrow names the parent
  // city rather than this neighbourhood. That mislabel (a city feed under a
  // smaller place's name) is the D93 defect, and naming the scope is the fix.
  const openHouses = await readCityOpenHouses(neighborhood.cityName)
  const [firstOh, ...restOh] = openHouseRows(openHouses)
  // market_stats_cache / price history store city geo_slug SPACE-separated.
  const cityGeoSlug = canonicalCityCacheSlug(citySlug)

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
    priceHist,
    boundaryRead,
    allCitySnapshots,
    blogPosts,
    activity,
    cityPriceHist,
    neighborhoodCommunities,
    richContent,
    peerNeighborhoods,
    inventoryRead,
    publicPace,
    publicSegments,
    leftoverCityMonthly,
    leftoverNeighborhoodMonthly,
    publicMix,
    nbhOverlays,
    placeDocuments,
    placeCharacter,
    indexCities,
  ] = await Promise.all([
    withTimeoutFallback(getPriceHistory('neighborhood', boundaryNeighborhoodSlug, 'monthly', 60), [], 4500, 'nbh:priceHistory'),
    // Result variant: a timed-out boundary yields `{ pins: [] }`, which is
    // indistinguishable from a genuinely empty neighborhood. `.ok` keeps them
    // apart so a degraded read can never publish a count (§0). Skipped during
    // SSG - the polygon centroid refills on first revalidate; counts come from
    // the inventory read, never from pins.
    skippableRailResult(() => getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'nbh:boundary'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'nbh:cities'),
    skippableRail(() => getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'nbh:blog'),
    skippableRail(() => getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }), [], 3500, 'nbh:activity'),
    // Parent-city monthly price history - fallback when this neighborhood's own
    // series is too thin for a real multi-year trend. Relabeled as city-level
    // when used (§0).
    withTimeoutFallback(getPriceHistory('city', cityGeoSlug, 'monthly', 60), [], 4500, 'nbh:cityPriceHistory'),
    // Subdivisions within this neighborhood - the subdivisions Ledger.
    skippableRail(() => getCommunitiesInNeighborhood(neighborhood.id, cityName), [], 3500, 'nbh:communities'),
    // Rich, verified neighborhood depth from
    // data/resort-community-{citySlug}-{neighborhoodSlug}.json, keyed by the
    // boundary slug. Null until authored. Feeds the About prose AND the
    // daily-life Ledger (schools + parks on the first path).
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
      getPublicDetachedMix({ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug }),
      EMPTY_PUBLIC_MIX,
      3000,
      'nbh:publicMix',
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
    withTimeoutFallback(getCitiesForIndex(), [], 3000, 'nbh:indexCities'),
  ])
  const nbhMt = nbhOverlays.get(`neighborhood:${cityDetachedSlug(metricNeighborhoodSlug)}`)
  const hud = leftoverHudKpis({
    grain: 'neighborhood',
    headlines: nbhMt?.headlines ?? null,
    inventory: nbhMt?.inventory ?? null,
    pace: publicPace,
  })

  const boundaryMapData = boundaryRead.value
  const inventory = inventoryRead
  // Counted set = SFR + PUBLIC_ACTIVE inside the recorded boundary. Same
  // payload as /neighborhoods and /cities/bend tiles. Do not fall back to pin
  // length, pulse.active_count, or listing_tile_mv tags - those are different
  // populations (Awbrey Butte 52 / 62 / 63, 2026-08-16). A measured empty
  // (inventory present, 0 keys) must not revive pin-only homes.
  const inventoryOk = inventory != null
  const countedKeys = inventoryOk ? inventory.listingKeys : []
  const boundaryListingKeys = inventoryOk
    ? countedKeys
    : boundaryMapData.pins.map((p) => p.listingKey)
  const listingTiles =
    boundaryListingKeys.length > 0
      ? await withTimeoutFallback(
          getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', propertyType: 'A', limit: 250 }),
          [],
          4500,
          'nbh:tiles',
        )
      : []

  // §0 UNKNOWN IS NOT ZERO. The published count is leftover HUD - never a
  // second population, never a `?? 0`.
  const activeCount: number | null = hud.active

  /* ── The market, off the ONE leftover pile ─────────────────────────────── */

  const mosRaw = hud.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
  const verdict = marketVerdict(mosRaw)
  const mosLabel = mosRaw != null ? formatMonthsOfSupply(mosRaw) : null
  const hasVerdict = verdict.kind !== 'unknown' && mosLabel != null
  const verdictSentence = hasVerdict
    ? `${neighborhood.name} has ${mosLabel} months of supply, which is a ${verdict.label}.`
    : null

  const leftoverStamp = nbhMt?.headlines?.computedAt ?? nbhMt?.inventory?.computedAt ?? null
  const marketFaqInput: MarketFaqInput = {
    grain: 'neighborhood',
    source: 'market-truth',
    activeCount: hud.active,
    pulseActiveCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: mosRaw,
    medianDaysToPending: hud.daysToPending,
    soldCount12mo: publicPace.closedCount ?? null,
    refreshedAt: leftoverStamp,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(neighborhood.name, marketFaqInput)

  const browseHref = subdivisionListingsPath(cityName, neighborhood.name)
  const figures: V3InstrumentFigure[] = leftoverMarketFigures(hud, {
    browse: browseHref,
    monthsOfSupply: '/months-of-supply',
  })
  for (const item of publicPaceItems(publicPace)) {
    if (CITY_PACE_KEYS_ON_THE_HUD.has(item.key)) continue
    figures.push({ value: v3Text(item.value), label: v3Text(item.label) })
  }
  // ONE FIGURE PER LABEL (2026-08-27 audit): pace and mix both read the finance
  // cells, so "cash closes · 12 months" printed twice in this run.
  {
    const seen = new Set(figures.map((f) => String(f.label)))
    for (const figure of buildPublicMixFigures(publicMix)) {
      if (seen.has(String(figure.label))) continue
      seen.add(String(figure.label))
      figures.push(figure)
    }
  }
  // PACE FIRST (this page's own plan: "First screen is this neighborhood's
  // pace (months of supply, then days to pending)"; the audit found months of
  // supply rendering EIGHTH). The two pace figures lead; everything else keeps
  // its builder order behind them.
  {
    const lead = ['months of supply', 'median to pending · 90 days']
    figures.sort((a, b) => {
      const ai = lead.indexOf(String(a.label))
      const bi = lead.indexOf(String(b.label))
      return (ai === -1 ? lead.length : ai) - (bi === -1 ? lead.length : bi)
    })
  }
  const [firstMarketFigure, ...restMarketFigures] = figures

  // City-fallback for a too-sparse neighborhood series; the caption names the
  // scope so a city trend can never read as this neighborhood's (§0).
  const neighborhoodCacheSparse = isTrendSeriesTooSparse(priceHist)
  const chartMonths = leftoverNeighborhoodOrCityMonthly({
    leftoverNeighborhood: leftoverNeighborhoodMonthly,
    leftoverCity: leftoverCityMonthly,
    neighborhoodCache: priceHist,
    cityCache: cityPriceHist,
    currentMonthKey,
    neighborhoodCacheSparse,
  })
  const chartScope = chartMonths.cityFallback
    ? `${cityName} at city scope, not ${neighborhood.name}`
    : neighborhood.name
  const medianChart = placeMedianChart(
    buildYearSeries(chartMonths.months, 5),
    `Median close by month, ${chartMonths.leftoverUsed ? 'Market Truth leftover' : 'single-family'}, ${chartScope}`,
  )

  // The approved chart-room forms (Unit NEIGHBORHOOD 2026-08-19), as Instrument
  // cards. Closed-side cards read the district polygon assignment; the
  // asking-price card reads the same inventory row this page's count comes
  // from. Neighborhood pulse and stats-cache closed figures are not charted.
  const marketCards = await neighborhoodMarketChartCards({
    geoSlug: boundaryNeighborhoodSlug,
    districtName: neighborhood.name,
  })

  /* ── The Field ─────────────────────────────────────────────────────────── */

  const fieldItems = nbhFieldItems(listingTiles)
  // The real total this boundary qualifies, not the secondary live-tile fetch:
  // inventory.pricedCount is the paginated listing_boundary_xref_mv read (SFR,
  // PUBLIC_ACTIVE, a usable price), the same population this Field previews.
  // listingTiles.length can undercount it (a status-filter mismatch between
  // this page's own live tile fetch and the boundary inventory query silently
  // dropped the preview-cap statement below the true total, 2026-08-27 audit).
  const fieldQualifyingTotal = inventoryOk ? inventory.pricedCount : listingTiles.length
  const fieldCaption = neighborhoodFieldCaption({
    placeName: neighborhood.name,
    count: fieldItems.length,
    totalQualifying: fieldQualifyingTotal,
  })
  const fieldPins = fieldMapPins(fieldItems)
  const fieldPoster = fieldItems.find((item) => item.photoSrc)?.photoSrc
  const fieldMissing = fieldItems.length - fieldPins.length

  /* ── The ledgers ───────────────────────────────────────────────────────── */

  const dailyRows = dailyLifeRows(richContent, cityName)
  const [firstDaily, ...restDaily] = dailyRows

  // Subdivisions inside the boundary. §0: a count the index read did not carry
  // stays null, never a zero.
  const subdivisionItems: CityPlaceItem[] = neighborhoodCommunities.slice(0, 12).map((c) => ({
    name: c.subdivision,
    href: `/subdivisions/${slugify(c.subdivision)}`,
    activeCount: c.activeCount ?? null,
    medianPrice: c.medianPrice ?? null,
    img: preferPlaceHero(c.heroImageUrl, communityImage(c.slug) ?? ''),
  }))
  const [firstSub, ...restSub] = placeFigureRows(subdivisionItems, `${neighborhood.name} subdivision`)

  // Live feed - fetched city-wide (the MLS carries no neighborhood scope), so
  // it is labeled with whichever scope the rows actually carry (§0).
  const boundaryKeySet = new Set(boundaryListingKeys)
  const activityScoped = activity.filter((a) => boundaryKeySet.has(a.listing_key))
  const useActScoped = activityScoped.length > 0
  const activityItems = buildActivityItems(useActScoped ? activityScoped : activity, {
    staleNewAfterDays: 21,
  })
  const activityEyebrow = useActScoped ? `Live · ${neighborhood.name}` : `Live · ${cityName}`
  const [firstAct, ...restAct] = activityRows(activityItems)

  // Per-neighborhood area-guide clip (EXACT geo match; null for most).
  const areaGuideVideo = await withTimeoutFallback(getAreaGuideVideo(neighborhoodSlug), null, 3000, 'area-guide-video')
  const articlePosts = buildArticlePosts(blogPosts)
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

  // No excludeSlug: a neighborhood page links its own parent city on purpose.
  const liveCityHero: Record<string, string> = {}
  for (const c of indexCities) {
    const url = c.heroImageUrl?.trim()
    if (url) liveCityHero[c.slug] = url
  }
  const otherCityItems: CityPlaceItem[] = buildOtherCityItems(allCitySnapshots, {
    liveHeroBySlug: liveCityHero,
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
  const hasMap = fieldPins.length > 0
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

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: cityName, href: `/cities/${citySlug}` },
            { label: neighborhood.name },
          ]}
        />

        {/* Pattern 1, Instrument - this neighborhood's pace, the locked
            opening. The H1 carries the money head term; the verdict sentence
            is the note. */}
        {firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={1}
            eyebrow={v3Text(`${neighborhood.name} · ${cityName}`)}
            headline={v3Text(`${neighborhood.name} homes for sale`)}
            note={verdictSentence ? v3Text(verdictSentence) : undefined}
            figures={[firstMarketFigure, ...restMarketFigures]}
            source={v3Text(neighborhoodMarketTrace(neighborhood.name, mosLabel != null))}
            chart={medianChart}
            cards={marketCards}
            updated={leftoverStamp ? v3Text(formatDate(leftoverStamp)) : undefined}
            action={{
              label: v3Text(`See every ${neighborhood.name} home for sale`),
              href: browseHref,
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="market"
            heading={`${neighborhood.name} homes for sale`}
            headingLevel={1}
            items={neighborhoodMarketAbsenceItems(neighborhood.name, fieldItems.length > 0)}
          />
        )}

        {/* Pattern 2, Field. This neighborhood's houses: list + the real map,
            one set, count as caption. */}
        <V3Field
          id="homes"
          ariaLabel={`Homes for sale in ${neighborhood.name}`}
          items={fieldItems}
          mapSlot={
            fieldItems.length > 0 ? (
              <PlaceFieldMap pins={fieldPins} placeName={neighborhood.name} posterSrc={fieldPoster} />
            ) : undefined
          }
          mapNote={fieldCaption ?? undefined}
          footNote={
            fieldMissing > 0 && fieldPins.length > 0
              ? fieldMissing === 1
                ? '1 of these carries no coordinates, so it is listed but not plotted.'
                : `${fieldMissing.toLocaleString('en-US')} of these carry no coordinates, so they are listed but not plotted.`
              : undefined
          }
          emptyMessage={nbhFieldEmptyMessage(neighborhood.name, inventoryOk)}
        />
        {fieldItems.length > 0 ? (
          <V3SourceLine source={neighborhoodFieldTrace(neighborhood.name)} />
        ) : null}

        {/* Pattern 3, Ledger - daily life on the first path: schools and
            parks, never amenities or membership (PUBLIC_UI §3). */}
        {firstDaily ? (
          <V3Ledger
            id="daily-life"
            eyebrow={v3Text(`${neighborhood.name} · Daily life`)}
            heading={v3Text('Schools and parks')}
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
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text(`All ${cityName} homes`), href: `/homes-for-sale/${citySlug}` }}
          />
        ) : null}

        {/* Pattern 1 again, as ONE enumeration: one section per other property
            type this neighborhood holds. */}
        <V3PlacePropertyTypes
          placeName={neighborhood.name}
          citySlug={citySlug}
          rows={publicSegments}
        />

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
          heading={
            hasVerdict
              ? `Is ${neighborhood.name} a buyer's or seller's market?`
              : `Questions about ${neighborhood.name}`
          }
          items={faqs.map((item) => ({ kind: 'prose' as const, term: item.question, body: item.answer }))}
        />

        {/* Peer neighborhoods - the same designated-district set, minus this
            one. */}
        {firstPeer ? (
          <V3Ledger
            id="peer-neighborhoods"
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
