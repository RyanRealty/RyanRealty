/**
 * /cities/[slug] - the city node. Same template for Bend, Redmond, every city.
 *
 * First screen: place still owns the fold. H1 `{City} real estate` sits on the
 * photograph (not a cream bar above it). Search owns "homes for sale". Atlas
 * is the inventory graphic. Then living atlas, flagship PlaceSplitView seeded
 * from the city polygon. Nested places draw as Atlas regions and Split
 * overlayBoundaries (Bend neighborhoods, plats elsewhere). Do not write
 * ?shapes= onto this URL. Type chips live on Split, not as first-screen
 * property-type H2s. One typical-price slope sits after the child doors.
 * MOS is a caption, never a five-number HUD.
 *
 * Face numbers are leftover HUD for THIS slug, used by FAQ/schema. Miss omits.
 * Median close 12mo stays on the city chart, never as a fake list price. Do
 * not hardcode a count, MoS, or median. Do not print leftover KPIs on the photo.
 *
 * Section order: design_system/ryan-realty/ui_kits/city/parity.json.
 *
 * THE MARKET SECTION IS THE LEFTOVER HUD, NOT PULSE (MARKET_TRUTH D19/D26/D78).
 * leftoverHudKpis is the one pile; publishPlaceFace filters it for FAQ/schema
 * grain. Pulse and the stats cache never fill a tile. buildMarketFaq is called
 * UNCONDITIONALLY with source 'market-truth' (D91).
 *
 * THE PAGE CONTRACT: generateMetadata through pageMetadata, generateStaticParams
 * over PRIMARY_CITIES with dynamicParams, revalidate 60, MetadataBlock JSON-LD,
 * CityPageTracker, V3SectionTracker.
 */

import { notFound } from 'next/navigation'
import { readCityOpenHouses, openHouseRows, OPEN_HOUSE_TRACE } from '@/lib/kb/place-open-houses'
import type { Metadata } from 'next'
import {
  getGeoSnapshot,
  getCityListings,
  getBendNeighborhoodLedger,
  getAllCitySnapshots,
  getCityCommunitySnapshots,
  getRecentBlogPosts,
  getPriceHistory,
  getCityDetachedMarket,
  getCityDetachedInventory,
  getAreaGuideVideo,
  getNeighborhoodDirectory,
  getCityHeroUrlsBySlug,
  getBoundaryGeoJSON,
  getCityBoundaryGeoJSON,
  getCommunitySubdivisions,
  getAllNeighborhoodsWithCity,
  getIndexableSubdivisions,
} from '@/lib/data'
import { SUBDIVISION_INDEX_MIN_LIFETIME_SALES } from '@/lib/data/subdivisions/subdivision-index'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace, publicPaceItems } from '@/lib/data/market-truth/public-pace'
import {
  getPublicDetachedMonthly,
  leftoverOrCacheMonthly,
  dropCurrentMonth,
} from '@/lib/data/market-truth/public-monthly'
import { EMPTY_PUBLIC_MIX, getPublicDetachedMix } from '@/lib/data/market-truth/public-mix'
import { getLiveMortgageRate } from '@/lib/data/market/getLiveMortgageRate'
import { DEFAULT_DISPLAY_RATE } from '@/lib/mortgage'
import { publishPlaceAffordability } from '@/lib/place/publish-place-affordability'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { publishPlaceFace } from '@/lib/market/publish-place-face'
import { publishPlaceDoor } from '@/lib/market/publish-place-door'
import { CITY_TILE_FETCH_LIMIT } from '@/lib/market/publish-city-inventory'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { getCityContent } from '@/lib/city-content'
import { CITY_QUICK_FACTS, PRIMARY_CITIES } from '@/lib/cities'
import { cityResorts, resortActiveSfrCounts, resortLabelToSlug } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { CITY_MARQUEE_COMMUNITIES, CITY_RESORT_LEDGER_IMG, communityVideoUrl } from '@/lib/kb/city-page-config'
import { preferPlaceHero } from '@/lib/geo-images'
// Row shaping shared with the neighborhood + community place pages - one copy, so a
// fix cannot land on one of the three and drift on the others.
import { buildActivityItems, buildArticlePosts, buildOtherCityItems } from '@/lib/kb/place-sections'
import { buildYearSeries } from '@/lib/kb/year-series'
import { getPlaceLinks } from '@/lib/place-links'
import { homesForSalePath, slugify } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { pageMetadata } from '@/lib/site/page-metadata'
import { cityPageTrail } from '@/lib/site/place-trail'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { latestSaleMedian } from '@/lib/market/latest-sale-median'
import { zonedDateKey, formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { skippableRail } from '@/lib/build-phase'
import {
  v3Text,
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3Instrument,
  V3PlaceDoor,
  V3Ledger,
  V3Answers,
  V3PlaceAffordability,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { V3Atlas, V3PlaceIndex, type AtlasRegion, type V3PlaceIndexEntry } from '@/components/site/v3'
import { basemapForRegions } from '@/lib/geo/basemap-source'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { atlasRegionName, atlasRegionNames } from '@/lib/atlas/place-names'
import { PlaceAreaHero } from '@/components/place/PlaceAreaHero'
import { PlaceTypeSlider } from '@/components/place/PlaceTypeSlider'
import { PlaceSplitView } from '@/components/search/PlaceSplitView'
import {
  placeTypeCoverPhotos,
  publishPlaceTypeCards,
} from '@/lib/place/publish-place-type-cards'
import { loadPlaceTypeCoverPhotos } from '@/lib/place/load-place-type-covers'
import { overlaysFromRegions } from '@/lib/place/child-rings'
import CityPageTracker from '@/components/city/CityPageTracker'
import { CityAlertsStrip } from './_v3/CityAlertSheet.client'
import { cityLibraryHero, cityStagePoster } from './_v3/city-opening'
import { bendNeighborhoodPlaces } from './_v3/city-places'
import {
  activityRows,
  areaGuideRow,
  articleRows,
  cityAboutItems,
  cityActivityTrace,
  cityExploreItems,
  cityMarketTrace,
  communityRows,
  leftoverMarketFigures,
  CITY_PACE_KEYS_ON_THE_HUD,
  PLACE_COUNT_TRACE,
  marketAbsenceItems,
  placeFigureRows,
  placeMedianChart,
  placeMedianChartCaption,
  type CityCommunityItem,
  type CityPlaceItem,
} from './_v3/city-sections'
import {
  PLACE_MART_YEAR,
  cityInstrumentSource,
  pickPlaceMart,
  placeMartFigures,
} from './_v3/city-mart'
import {
  cityVerdictCaption,
  leftoverClosedCount,
  placeCostChart,
  tooFewSalesItems,
  withoutMosTile,
} from './_v3/place-graphics'
import { buildPublicMixFigures } from '@/app/housing-market/[...slug]/_v3/geo-figures'
import { getCoMarketAnnual } from '@/lib/data/analytics/getCoMarketAnnual'
import { getCoMarketAnnualCity } from '@/lib/data/analytics/getCoMarketAnnualCity'
import { buildCitySchemas } from './_v3/city-metadata'
import { areaGuideVideoSchema } from '@/lib/site/area-guide-schema'

/**
 * How many of a city's recorded plats the #plats index prints (SITE-30).
 *
 * Measured 2026-09-09: 2,486 plats clear the indexable floor across Central
 * Oregon, 1,519 of them attributed to Bend. Printing all of them would make the
 * city page a link farm and would move ~1.4 MB of anchors through the payload
 * budget. Sixty is the Atlas's own child cap, so the two sections of this page
 * that name plats agree on how many a page can hold, and /subdivisions carries
 * the rest.
 */
const CITY_PLAT_INDEX_CAP = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  // Seed the primary Central Oregon cities (finite, in-repo). Long-tail city
  // slugs still SSR on demand via dynamicParams. Build-verified resolvable.
  return PRIMARY_CITIES.map((name) => ({ slug: slugify(name) }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = {
  params: Promise<{ slug: string }>
}

/** Polygon / MultiPolygon, or a Feature wrapping one. Miss is null. */
function asPlaceBoundary(value: unknown): { type?: string; coordinates?: unknown } | null {
  if (!value || typeof value !== 'object') return null
  const rec = value as {
    type?: string
    coordinates?: unknown
    geometry?: { type?: string; coordinates?: unknown }
  }
  if ((rec.type === 'Polygon' || rec.type === 'MultiPolygon') && Array.isArray(rec.coordinates)) {
    return rec
  }
  const geom = rec.geometry
  if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon') && Array.isArray(geom.coordinates)) {
    return geom
  }
  return null
}

// Metadata - unchanged from the KB page.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  return pageMetadata({
    title: `Homes for Sale in ${cityName}, Oregon`,
    description: `Active single-family homes in ${cityName}, Oregon. Live list prices, neighborhoods, open houses, and recent market activity from the regional MLS.`,
    path: `/cities/${slug}`,
  })
}

export default async function CityDetailPage({ params }: Props) {
  const { slug } = await params

  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  // market_pulse_live + market_stats_cache store city geo_slug SPACE-separated
  // ("la pine") - normalize for those reads. Market Truth reads take the
  // hyphenated route slug. Keep `slug` for URLs.
  const geoSlug = canonicalCityCacheSlug(slug)
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)

  const isBend = slug === 'bend'
  const hasResorts = cityResorts(slug).length > 0

  // Data, all through the DAL (G8). The reads the page's own answer depends on
  // are resilient-cached with documented fallbacks; the LEDGER reads are
  // wrapped so a slow community index cannot hold the fold, and a ledger whose
  // count read degraded keeps its rows and drops its value column (invariant 1).
  const [
    detached,
    detachedInv,
    publicPace,
    publicSegments,
    publicMix,
    leftoverMonthly,
    priceHist,
    tiles,
    bendNeighborhoods,
    communities,
    allCitySnapshots,
    communitySnapshots,
    blogPosts,
    activity,
    resortRead,
    cityMartRow,
    regionMartRow,
    indexCities,
    neighborhoodDirectory,
    cityBoundary,
    cityBoundaryFallback,
  ] = await Promise.all([
    withTimeoutFallback(getCityDetachedMarket(slug), null, 3000, 'city:detached'),
    withTimeoutFallback(getCityDetachedInventory(slug), null, 3000, 'city:detachedInv'),
    withTimeoutFallback(getPublicDetachedPace({ geoType: 'city', geoSlug: slug }), EMPTY_PUBLIC_PACE, 3000, 'city:publicPace'),
    withTimeoutFallback(getPublicPlaceSegments({ geoType: 'city', geoSlug: slug }), [], 3000, 'city:publicSegments'),
    withTimeoutFallback(getPublicDetachedMix({ geoType: 'city', geoSlug: slug }), EMPTY_PUBLIC_MIX, 3000, 'city:publicMix'),
    withTimeoutFallback(
      getPublicDetachedMonthly({ geoType: 'city', geoSlug: slug, currentMonthKey }),
      [],
      4500,
      'city:leftoverMonthly',
    ),
    withTimeoutFallback(getPriceHistory('city', geoSlug, 'monthly', 60), [], 4500, 'city:priceHistory'),
    // Bend neighborhood hover photos (D89). Split fetches its own viewport set.
    isBend
      ? withTimeoutFallback(
          getCityListings(cityName, {
            status: 'active',
            sort: 'newest',
            propertyType: 'A',
            propertySubType: 'Single Family Residence',
            limit: CITY_TILE_FETCH_LIMIT,
          }),
          [],
          4500,
          'city:mapTiles',
        )
      : Promise.resolve([] as Awaited<ReturnType<typeof getCityListings>>),
    isBend
      ? withTimeoutFallback(getBendNeighborhoodLedger(), [], 5000, 'city:nbhStats')
      : Promise.resolve([] as Awaited<ReturnType<typeof getBendNeighborhoodLedger>>),
    withTimeoutFallback(getCommunitiesForIndex(), [], 3500, 'city:communities'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'city:allCities'),
    withTimeoutFallback(getCityCommunitySnapshots(slug), [], 3000, 'city:commSnaps'),
    skippableRail(() => getRecentBlogPosts({ cityName, limit: 12 }), [], 3000, 'city:blog'),
    skippableRail(
      () => getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }),
      [],
      3500,
      'city:activity',
    ),
    // UNCAPPED active SFR, paginated past PostgREST's 1000-row cap (Bend has
    // ~1044): the alias-aware counts must see the COMPLETE active set or they
    // undercount every resort whose older listings fall past page one. The
    // Result variant is load-bearing - an empty array from a TIMEOUT reads as a
    // city with no inventory, and that all-zero map would put "0 active" under
    // a live-MLS trace (§0).
    hasResorts
      ? withTimeoutFallbackResult(fetchAllCityActiveSfr(cityName), [], 6000, 'city:resortTiles')
      : Promise.resolve({ value: [] as Awaited<ReturnType<typeof fetchAllCityActiveSfr>>, ok: true }),
    getCoMarketAnnualCity({ year: PLACE_MART_YEAR, citySlug: slug, typeScope: 'all' }),
    getCoMarketAnnual({ year: PLACE_MART_YEAR, typeScope: 'all' }),
    withTimeoutFallback(getCityHeroUrlsBySlug(), {}, 3000, 'city:liveHeroes'),
    withTimeoutFallback(getNeighborhoodDirectory(), [], 3000, 'city:nbhDir'),
    withTimeoutFallback(getBoundaryGeoJSON({ geoType: 'city', geoSlug: slug }), null, 2000, 'city:boundary'),
    withTimeoutFallback(getCityBoundaryGeoJSON(cityName), null, 2000, 'city:boundaryFallback'),
  ])

  const cityGeojson = asPlaceBoundary(cityBoundary) ?? asPlaceBoundary(cityBoundaryFallback)
  // The living map, scoped to the city (Matt 2026-09-01: heat maps on every
  // page). Population = every active, pending, and 30-day-closed listing
  // inside the recorded city boundary, through the same builder the homepage
  // uses. Bend's places are its neighborhoods; every other city's are its
  // busiest recorded plats.
  // The Atlas wants a typed geometry; asPlaceBoundary's loose shape is
  // narrowed here to a Polygon/MultiPolygon or nothing.
  const atlasBoundary: GeoJSON.Geometry | null =
    cityGeojson && (cityGeojson.type === 'Polygon' || cityGeojson.type === 'MultiPolygon') && Array.isArray(cityGeojson.coordinates)
      ? (cityGeojson as GeoJSON.Geometry)
      : null
  const [atlas, atlasChildren] = atlasBoundary
    ? await Promise.all([
        withTimeoutFallback(buildPlaceAtlas({ cities: [cityName], boundary: atlasBoundary, label: cityName }), null, 6000, 'city:atlas'),
        isBend
          ? withTimeoutFallback(
              getAllNeighborhoodsWithCity().then((rows) =>
                Promise.all(
                  rows
                    .filter((r) => {
                      const c = Array.isArray(r.cities) ? r.cities[0] : r.cities
                      return (c?.slug ?? '').toLowerCase() === 'bend' && r.slug && r.name
                    })
                    .map((r) =>
                      getBoundaryGeoJSON({ geoType: 'neighborhood', geoSlug: `bend-${(r.slug ?? '').toLowerCase().trim()}` })
                        .then((geometry): AtlasRegion | null =>
                          geometry
                            ? { id: `neighborhood:${r.slug}`, kind: 'neighborhood', name: r.name as string, href: `/cities/bend/${(r.slug ?? '').toLowerCase().trim()}`, geometry }
                            : null,
                        )
                        .catch(() => null),
                    ),
                ),
              ),
              [] as (AtlasRegion | null)[],
              6000,
              'city:atlasNeighborhoods',
            )
          : withTimeoutFallback(
              getCommunitySubdivisions({ geoType: 'city', geoSlug: slug }).then((cells) =>
                [...cells]
                  .sort((a, b) => b.activeHomes - a.activeHomes)
                  .slice(0, 60)
                  .map((cell): AtlasRegion => ({ id: `subdivision:${cell.slug}`, kind: 'neighborhood', kindLabel: 'Subdivision', name: atlasRegionName(cell.label) ?? cell.label, href: `/subdivisions/${cell.slug}`, geometry: cell.geometry })),
              ),
              [] as (AtlasRegion | null)[],
              6000,
              'city:atlasPlats',
            ),
      ])
    : [null, [] as (AtlasRegion | null)[]]
  const atlasRegions: AtlasRegion[] = atlasBoundary
    ? [
        { id: `city:${slug}`, kind: 'town', kindLabel: 'City', name: cityName, href: `/cities/${slug}`, geometry: atlasBoundary },
        ...atlasChildren.filter((r): r is AtlasRegion => r !== null),
      ]
    : []

  // The approved area-guide clip - a guides-Ledger door on this node (the
  // pattern set holds no mid-page media slot here); it plays full-bleed on the
  // community Stage. Null when the geo has none, and the row is then absent.
  // SITE-07: the 30-yr rate is READ, never assumed. market_history_weekly
  // (national/us, mortgage_rate_30yr) is written every Monday from Freddie Mac
  // PMMS, so the calculator can publish a rate with its own week stamp. A null
  // here is not a zero and not a default dressed as a measurement: the section
  // then says the rate is an assumption the visitor sets.
  const [areaGuideVideo, liveRate, indexablePlats] = await Promise.all([
    withTimeoutFallback(getAreaGuideVideo(slug), null, 3000, 'area-guide-video'),
    withTimeoutFallback(getLiveMortgageRate(), null, 2500, 'city:mortgageRate'),
    // SITE-30. The recorded-plat set the sitemap, llms.txt and the
    // /subdivisions robots tag all read. Four scalar columns, no geometry,
    // already cached 6h — this is a page's cheapest way to name its plats.
    withTimeoutFallback(getIndexableSubdivisions(), [], 4000, 'city:indexablePlats'),
  ])

  /**
   * THE PLAT INDEX, IN SERVER HTML (site queue SITE-30, 2026-09-09).
   *
   * The Atlas is a client component: measured on 2026-09-09, the served HTML of
   * /cities/bend held ZERO `<a href="/subdivisions/…">` — its only 22
   * occurrences of that string were storage image URLs — while the page carried
   * 42 crawlable community links, all of them sitewide chrome. The 511
   * sitemapped plat pages therefore had essentially no contextual inbound link
   * from the city that contains them. A link that lives only in a hydration
   * payload is not a link.
   *
   * TWO SOURCES, ONE LIST, AND THEY CANNOT DISAGREE. First the indexable set —
   * every plat in THIS city whose page we submit to Google — each carrying its
   * own lifetime closed sales. Then every plat the Atlas above actually draws,
   * so the map can never show an outline the index omits. The order is the
   * dedupe: a plat in both keeps its figure, and a drawn plat below the
   * publishing floor prints no figure rather than borrowing one (§0 — unknown
   * is not zero, and a noindexed plat still renders its page).
   *
   * On Bend the Atlas draws NEIGHBORHOODS, whose doors are already crawlable
   * (13 of them, in the #neighborhoods Ledger). So the second source
   * contributes nothing there and the index is the plat tier alone, which is
   * the tier that had no inbound links at all.
   */
  const cityIndexablePlats = indexablePlats.filter((p) => p.citySlug === slug)
  const platIndexSource: Array<{ raw: string; href: string; count: number | null }> = [
    ...cityIndexablePlats
      // Deepest sale history first, then capped: Bend alone holds 1,519 plats
      // above the publishing floor, and a page that prints all of them is a
      // link farm, not an index. /subdivisions is the door to the whole set and
      // the section carries it.
      .slice()
      .sort((a, b) => b.closedCount - a.closedCount)
      .slice(0, CITY_PLAT_INDEX_CAP)
      .map((p) => ({ raw: p.name, href: `/subdivisions/${p.slug}`, count: p.closedCount })),
    ...atlasRegions
      .slice(1)
      .filter((r) => r.href?.startsWith('/subdivisions/'))
      .map((r) => ({ raw: r.name, href: r.href as string, count: null })),
  ]
  // Names through the set-aware publisher: stripping the recorder's residue can
  // fold two plats onto one string, and two rows reading the same while opening
  // different pages is worse than a long name.
  const platIndexNames = atlasRegionNames(platIndexSource.map((p) => p.raw))
  const platIndexEntries: V3PlaceIndexEntry[] = platIndexSource.flatMap((p, i) => {
    const name = platIndexNames[i]
    return name ? [{ name, href: p.href, count: p.count }] : []
  })
  const libraryHero = await withTimeoutFallback(cityLibraryHero(slug), null, 3000, 'city:libraryHero')
  const stagePosterSrc = cityStagePoster(indexCities[slug], libraryHero)
  const typeCovers = await withTimeoutFallback(
    loadPlaceTypeCoverPhotos({ city: cityName }),
    {},
    4500,
    'city:typeThumbs',
  )

  const resortTiles = resortRead.value

  /* ── The market, off the ONE leftover pile ─────────────────────────────── */

  const hud = leftoverHudKpis({
    grain: 'city',
    headlines: detached,
    inventory: detachedInv,
    pace: publicPace,
  })
  const face = publishPlaceFace({ grain: 'city', hud })
  const typeCards = publishPlaceTypeCards({
    browsePath: homesForSalePath(cityName),
    placeName: cityName,
    sfrCount: hud.active,
    sfrMedian: hud.medianList,
    sfrMos: hud.monthsSupply,
    segments: publicSegments,
    covers: { ...placeTypeCoverPhotos(tiles), ...typeCovers },
  })
  const trail = cityPageTrail(cityName)
  const headline = `${cityName} real estate`

  // §0 UNKNOWN IS NOT ZERO (D78): the hero count is leftover HUD - never tiles,
  // never a snapshot all-count, never a `?? 0`. displayedActiveCount: hud.active
  // binds the leftover inventory the city chart uses (getSellBendMarket pin).
  const { displayedActiveCount } = { displayedActiveCount: hud.active }
  const activeCount: number | null = displayedActiveCount

  // Face already classifies MOS. Keep the formatted label for the source line.
  const mosRaw = hud.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
  const mosLabel = mosRaw != null ? formatMonthsOfSupply(mosRaw) : null

  // The as-of stamp is leftover membership's own computed_at, so it names the
  // population the figures came from (§0).
  const leftoverStamp = detached?.computedAt ?? detachedInv?.computedAt ?? null

  // buildMarketFaq - the single source for the visible FAQ, the FAQPage
  // JSON-LD, and the Dataset variableMeasured. Called unconditionally with an
  // all-nullable leftover input: a miss omits one figure, never the markup.
  // Median-close year overlay - leftover months first, cache months otherwise,
  // in-progress month dropped so a partial month never plots as a decline.
  // Computed here because the FAQ's sale price is this series' latest
  // complete month, so the FAQ and the chart cannot disagree.
  const chartMonths = leftoverOrCacheMonthly(leftoverMonthly, dropCurrentMonth(priceHist, currentMonthKey))
  const saleMedian = latestSaleMedian(chartMonths.months, currentMonthKey)
  const marketFaqInput: MarketFaqInput = {
    grain: 'city',
    source: 'market-truth',
    activeCount: hud.active,
    pulseActiveCount: hud.active,
    medianListPrice: hud.medianList,
    medianSalePrice: saleMedian?.value ?? null,
    medianSaleMonthLabel: saleMedian?.monthLabel ?? null,
    monthsOfSupply: mosRaw,
    medianDaysToPending: hud.daysToPending,
    soldCount12mo: hud.sold12mo,
    refreshedAt: leftoverStamp,
  }
  const marketFaq = buildMarketFaq(cityName, marketFaqInput)
  const { faqs } = marketFaq

  const mart = pickPlaceMart(cityMartRow, regionMartRow)
  const figures: V3InstrumentFigure[] = leftoverMarketFigures(hud, {
    browse: homesForSalePath(cityName),
    monthsOfSupply: '/months-of-supply',
  })
  // The 12-month leftover pace and the detached mix, each item carrying its own
  // window on its label. The three pace keys the HUD figures above already
  // print are skipped: one figure under two labels reads as two findings.
  for (const item of publicPaceItems(publicPace)) {
    if (CITY_PACE_KEYS_ON_THE_HUD.has(item.key)) continue
    figures.push({ value: v3Text(item.value), label: v3Text(item.label) })
  }
  // ONE FIGURE PER LABEL (2026-08-27 audit). publicPaceItems and
  // buildPublicMixFigures both read the finance cells, so "cash closes ·
  // 12 months" rendered TWICE in this run -- same value, two mounts. And the
  // 2026-08-27 all-property-types financing figures (getFinancingMix) were
  // REMOVED the same day they shipped: they put a SECOND cash share (33.0%)
  // and a second conventional share on the page beside the detached ones
  // (27.5% / 63.5%) under near-identical 12-month labels, and a reader cannot
  // be asked to guess which population a percent covers. The detached cells
  // are the market-truth pipeline's; they stay. The all-types mix belongs on
  // a surface that can give it a full table with its population named, not
  // two figures in a detached run.
  {
    const seen = new Set(figures.map((f) => String(f.label)))
    for (const figure of buildPublicMixFigures(publicMix)) {
      if (seen.has(String(figure.label))) continue
      seen.add(String(figure.label))
      figures.push(figure)
    }
  }
  figures.push(...placeMartFigures(mart, `/housing-market/history?year=${PLACE_MART_YEAR}`))
  const foldedFigures = withoutMosTile(figures)
  const [firstMarketFigure, ...restMarketFigures] = foldedFigures

  const marketHeadline = `Typical price in ${cityName}`
  const verdictCaption = cityVerdictCaption({ mos: mosRaw, verdict: face.verdict })

  // SITE-03: the door beside the H1. ONE live fact — the active count — as the
  // way into this city's own pre-filtered inventory. No median, no months, no
  // days-to-pending: that five-figure strip is the leftover HUD ci:taste-canon
  // fails. AND NO VERDICT: `verdictCaption` below is the verdict's one home
  // (DATA_GRAPHICS.md), and the door printing "in a seller's market" one node
  // above a caption reading "A seller's market." was the duplicate the
  // 2026-09-08 review caught. The count comes off the face this page already
  // published — no new read — and `grain` derives the door's own trace, so the
  // sentence under it always describes the read the count came from.
  // The href goes through publishPlaceBrowseHref inside the publisher, so a
  // candidate that would land on the unfiltered regional index, or that
  // middleware would 301 away, renders no door at all.
  const placeDoor = publishPlaceDoor({
    face,
    grain: 'city',
    placeName: cityName,
    href: homesForSalePath(cityName),
    // The stamp belongs to the same Market Truth read as the count.
    readDate: leftoverStamp ? formatDate(leftoverStamp) : null,
  })

  // SITE-07: the affordability instrument, opened at the SAME median this
  // page's market section prints (hud.medianList), so the calculator can never
  // disagree with the figure above it.
  const affordability = publishPlaceAffordability({
    placeName: cityName,
    placeSlug: slug,
    grain: 'city',
    medianListPrice: hud.medianList,
    activeCount: hud.active,
    computedAt: leftoverStamp,
    browseHref: homesForSalePath(cityName),
    rate: liveRate,
    fallbackRatePct: DEFAULT_DISPLAY_RATE,
    mix: publicMix,
    cashShare: publicPace.cashShare,
  })

  const closedN = leftoverClosedCount(hud, chartMonths.months)
  const medianChart = placeMedianChart(
    buildYearSeries(chartMonths.months, 5),
    placeMedianChartCaption(cityName),
  )
  const costChart = placeCostChart(closedN, medianChart)

  /* ── The place ledgers ──────────────────────────────────────────────────── */

  // Communities in this city. Reused for the rail AND as neighborhood hover
  // imagery where a neighborhood shares a community's name.
  const cityComms = communities.filter((c) => c.city?.toLowerCase().trim() === cityName.toLowerCase().trim())
  const commImgByName = new Map(cityComms.map((c) => [c.subdivision.toLowerCase(), c.heroImageUrl]))
  const commImgBySlug = new Map(cityComms.map((c) => [c.slug, c.heroImageUrl]))

  // ALIAS-AWARE ACTIVE SFR PER RESORT (§0). A resort's homes are MLS-tagged
  // under many subdivision names (Widgi Creek -> "Inn Of The 7th", "Elkai
  // Woods", ...), so a literal-name count undercounts every resort (Widgi 0 vs
  // true 48, Tetherow 14 vs 43). Counted from the UNCAPPED active tiles through
  // the registry aliases - the canonical number used by BOTH the golf ledger
  // and the rail, so no community shows two figures. The map is EMPTY when the
  // uncapped read degraded, not zero-filled: every consumer below then falls
  // through to its next source and finally to null, so a timeout withholds the
  // figure instead of publishing "0 active" under a live-MLS trace (§0).
  const resortSfrCounts = resortRead.ok
    ? resortActiveSfrCounts(slug, resortTiles)
    : new Map<string, number>()
  const resortSlugByLabel = resortLabelToSlug(slug)

  // The community snapshot's own SFR count, the golf ledger's second source.
  // geo_key arrives SPACE-separated for a multi-word community, so it is
  // slugified before the lookup or every multi-word community silently misses (D87).
  const communitySfrBySlug = new Map<string, number>()
  for (const s of communitySnapshots) {
    const rawSlug = s.geoKey.includes(':') ? s.geoKey.split(':')[1]! : s.geoKey
    if (s.activeSfrCount != null) {
      communitySfrBySlug.set(rawSlug.replace(/\s+/g, '-').toLowerCase(), s.activeSfrCount)
    }
  }

  // NEIGHBORHOODS - the DESIGNATED Bend polygons only, never sibling cities and
  // never raw subdivision-plat noise (D83). Every designated district is
  // listed, with a boundary-verified hover photo (D89). The count is withheld
  // rather than zero-filled when the ledger read did not answer - see
  // ./_v3/city-places.ts for that rule.
  const neighborhoodHeroBySlug = new Map(
    neighborhoodDirectory
      .filter((d) => d.citySlug === slug)
      .map((d) => [d.neighborhoodSlug, d.heroImageUrl]),
  )
  const bendNeighborhoodItems: CityPlaceItem[] = bendNeighborhoodPlaces({
    isBend,
    ledgerRows: bendNeighborhoods,
    mapTiles: tiles,
    communityImageByName: commImgByName,
    neighborhoodHeroBySlug,
  })

  // GOLF AND MASTER-PLANNED COMMUNITIES - a SEPARATE ledger from neighborhoods
  // (D85). Membership comes from the registry (is_resort), which drops Three
  // Rivers, and the count is the alias-aware one so the ledger and the rail agree.
  const golfCommunityItems: CityPlaceItem[] = cityResorts(slug).map((c) => ({
    name: c.label,
    href: getPlaceLinks({ type: 'community', slug: c.slug, citySlug: slug }).placeUrl,
    activeCount: resortSfrCounts.get(c.slug) ?? communitySfrBySlug.get(c.slug) ?? null,
    medianPrice: null,
    img: preferPlaceHero(
      commImgBySlug.get(c.slug) ?? commImgByName.get(c.label.toLowerCase().trim()),
      CITY_RESORT_LEDGER_IMG[c.slug] ?? '',
    ),
  }))

  // THE COMMUNITIES RAIL - every community in this city that has a photo, with
  // the curated marquee set (hand-picked still + silent Area Guide clip)
  // floated to the front and the rest by active count (D88). Built from
  // cityComms, never from a curated three.
  const curatedComms = CITY_MARQUEE_COMMUNITIES[slug] ?? []
  const communityItems: CityCommunityItem[] = cityComms
    .map((c): CityCommunityItem | null => {
      const curated = curatedComms.find((f) => c.subdivision.toLowerCase().includes(f.match))
      const cvUrl = communityVideoUrl(curated?.videoSlug)
      const img = preferPlaceHero(c.heroImageUrl, curated?.img ?? '') || null
      if (!img) return null
      // When this community is a resort, show its ALIAS-AWARE count, so the
      // rail card matches the golf ledger and the real MLS total rather than
      // the literal-name undercount (§0).
      const resortSlug = resortSlugByLabel.get(c.subdivision.toLowerCase().trim())
      const activeCount = resortSlug ? resortSfrCounts.get(resortSlug) ?? c.activeCount : c.activeCount
      return {
        name: c.subdivision,
        activeCount,
        medianPrice: null,
        town: cityName,
        href: getPlaceLinks({ type: 'community', slug: resortSlug ?? c.slug, citySlug: slug }).placeUrl,
        img,
        video: cvUrl ? { url: cvUrl, embedType: 'video-tag' as const } : null,
      }
    })
    .filter((x): x is CityCommunityItem => x !== null)
    .sort((a, b) => (a.video ? 0 : 1) - (b.video ? 0 : 1) || (b.activeCount ?? 0) - (a.activeCount ?? 0))
    // ONE ROW PER RESOLVED DOOR: two index rows (a resort and one of its member
    // subdivisions) can both resolve to the same registry slug, and two rows
    // with one href are one place listed twice — and a duplicated React key.
    // The sort above has already put the marquee/high-count row first.
    .filter((item, i, arr) => arr.findIndex((x) => x.href === item.href) === i)

  // Dedupe the ledger against the rail by NAME, not href: the rail's hrefs are
  // city-prefixed index slugs while the ledger's are plain registry slugs for
  // the SAME physical place.
  const railNames = new Set(communityItems.map((c) => c.name.toLowerCase().trim()))
  const golfLedgerItems = golfCommunityItems.filter((t) => !railNames.has(t.name.toLowerCase().trim()))

  // EXPLORE OTHER CITIES - its own section, distinct from every within-city
  // ledger (D84). buildOtherCityItems owns the geo_key slugify, the
  // service-area allowlist, and the verified-cityHero-only imagery rule
  // (D86/D87), shared with the neighborhood and community nodes so one fix
  // lands on all three.
  const otherCityItems: CityPlaceItem[] = buildOtherCityItems(allCitySnapshots, {
    excludeSlug: slug,
    liveHeroBySlug: indexCities,
  })

  // Live activity and city guides.
  const activityItems = buildActivityItems(activity, { staleNewAfterDays: 21 })
  const articlePosts = buildArticlePosts(blogPosts)
    .filter((post) => post.title.toLowerCase().includes(cityName.toLowerCase()))
    .slice(0, 3)

  // V3Ledger's rows prop is a non-empty tuple, so each section destructures a
  // head and renders nothing when there is none.
  // Its own children: a neighborhood named with the city in front drops it
  // (placeFigureRows, `within`); none of Bend's thirteen is, so this is the
  // rule, not a change.
  const [firstNbh, ...restNbh] = placeFigureRows(bendNeighborhoodItems, `${cityName} neighborhood`, cityName)
  const [firstRail, ...restRail] = communityRows(communityItems)
  const [firstGolf, ...restGolf] = placeFigureRows(golfLedgerItems, 'Golf and master-planned')
  const [firstOther, ...restOther] = placeFigureRows(otherCityItems, 'Central Oregon city')
  // D94 restored 2026-08-27. The feed is CITY-scoped, which is what this page is,
  // so the eyebrow and the door both name the city honestly.
  const openHouses = await readCityOpenHouses(cityName)
  const [firstOh, ...restOh] = openHouseRows(openHouses)
  const [firstAct, ...restAct] = activityRows(activityItems)
  const [firstGuide, ...restGuide] = [
    ...areaGuideRow(cityName, areaGuideVideo),
    ...articleRows(articlePosts),
  ]

  // About - the hand-written city description where one exists. NO GENERATED
  // PARAGRAPHS AND NO FIGURES (invariant 1): buildDataDrivenCityAbout stays out
  // because its market sentence restated the count and the median, untraced,
  // inside a V3Quiet.
  const cityContent = getCityContent(cityName)
  const quickFacts = CITY_QUICK_FACTS[cityName] ?? null
  const description = cityContent?.description?.trim()
  const aboutItems = cityAboutItems(description, quickFacts, cityName)

  const exploreItems = cityExploreItems(
    cityName,
    slug,
    // valuationHref, never a bare path: the closing valuation edge carries
    // ?from=/cities/<slug>, which is the seller lead's stored source_url.
    { browse: homesForSalePath(cityName), valuation: valuationHref(`/cities/${slug}`) },
    Boolean(quickFacts?.population),
  )

  const citySchemas = buildCitySchemas({
    cityName,
    slug,
    faq: marketFaq,
    hasMap: true,
  })
  // The area guide as a VideoObject: the file is contentUrl, the channel upload
  // is embedUrl, so the video indexes once and credits the channel.
  const cityGuideSchema = areaGuideVideoSchema(cityName, `/cities/${slug}`, areaGuideVideo)
  if (cityGuideSchema) citySchemas.push(cityGuideSchema)

  // The read may not have completed: render the Atlas anyway, with its
  // honest sentence, instead of deleting the section (pass five, R7).
  const atlasView = atlas ?? EMPTY_PLACE_ATLAS
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <CityPageTracker
          cityName={cityName}
          slug={slug}
          listingCount={activeCount}
          medianPrice={hud.medianList}
          communityCount={communitySnapshots.length}
        />
        <V3SectionTracker />
        <MetadataBlock schemas={citySchemas} />

        <div className={stagePosterSrc ? 'place-opening place-opening--media' : 'place-opening'}>
          <PlaceAreaHero posterSrc={stagePosterSrc} />
          {stagePosterSrc ? <div className="place-opening__scrim" aria-hidden="true" /> : null}
          <V3Breadcrumb trail={trail} tone={stagePosterSrc ? 'on-media' : 'surface'} />
          <div className="place-opening__copy">
            <V3Heading level={1} size="field" onMedia={Boolean(stagePosterSrc)}>
              {headline}
            </V3Heading>
            {placeDoor ? (
              <V3PlaceDoor
                href={placeDoor.href}
                count={placeDoor.count}
                countLabel={placeDoor.countLabel}
                updated={placeDoor.readDate}
                trace={placeDoor.trace}
                onMedia={Boolean(stagePosterSrc)}
              />
            ) : null}
            {verdictCaption ? <p className="place-opening__caption">{verdictCaption}</p> : null}
          </div>
        </div>

        {/* SITE-04: the one on-page ask as the first callout after the opening,
            with the real 30-day count as its claim, and the sticky repeat past
            #atlas from the same component. Same server action, same payload,
            same honeypot as the sheet it replaces. */}
        <CityAlertsStrip
          id="alerts"
          cityName={cityName}
          geoSlug={slug}
          newCount30d={publicPace.newCount30d}
          updatedAt={leftoverStamp}
          browseHref={homesForSalePath(cityName)}
          // ONE filled control in the first viewport, and never none: the strip
          // steps down to the outline only when the door above it actually
          // rendered. A city whose Market Truth read published no active count
          // has no door, and then the strip's submit is the fold's primary.
          demote={placeDoor != null}
        />

        {(
          <V3Atlas
            id="atlas"
            headingLevel={2}
            headline={v3Text(`${cityName} right now`)}
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

        {/* SITE-30: the map's legend, in the served HTML. Every plat the Atlas
            draws plus every plat in this city with a page of its own, each one
            a real anchor a crawler can follow. */}
        <V3PlaceIndex
          id="plats"
          eyebrow={`${cityName} · Recorded plats`}
          heading={`The plats of ${cityName}`}
          lede={
            cityIndexablePlats.length > platIndexEntries.length
              ? `A plat is the subdivision the county recorded when the ground was divided. ${cityName} holds ${cityIndexablePlats.length.toLocaleString('en-US')} of them with a page of their own; these are the ${platIndexEntries.length} with the deepest sale history.`
              : `A plat is the subdivision the county recorded when the ground was divided. Each one below has its own page — what has sold there, what is for sale, and where its lines run.`
          }
          countLabel="lifetime sales"
          entries={platIndexEntries}
          foldAfter={12}
          action={
            cityIndexablePlats.length > platIndexEntries.length
              ? { label: `Every Central Oregon subdivision`, href: '/subdivisions' }
              : undefined
          }
          source={`recorded plat polygons from public.boundaries (geo_type='subdivision', Deschutes County DIAL). The figure is the plat's LIFETIME closed sales from public.subdivision_plat_closed_mv, attributed two ways and unioned over distinct listing: every closed listing in listing_tile_mv whose point falls inside the recorded polygon, plus every closed listing recorded under that plat's own name. Both are needed — a sub-plat's homes are listed under the resort's name and never its own, while a coarse builder geocode can put a correctly-named sale outside its own lines. Every property type, no date filter. This is the same read that decides whether the plat's page is indexable (floor: ${SUBDIVISION_INDEX_MIN_LIFETIME_SALES} lifetime sales), so the figure here and the robots tag there can never disagree. A plat drawn on the map above but below that floor still has a page and still appears here; it prints no figure rather than one measured a different way.`}
        />

        <PlaceTypeSlider cards={typeCards} label={`${cityName} property types`} />

        <PlaceSplitView
          id="homes"
          city={cityName}
          boundaryGeojson={cityGeojson}
          overlayBoundaries={overlaysFromRegions(atlasRegions.slice(1))}
          seedRing
          placeQuery={`${cityName} Oregon`}
        />

        {/* D83: the DESIGNATED Bend polygons, and only those. */}
        {firstNbh ? (
          <V3Ledger
            id="neighborhoods"
            eyebrow={v3Text(`${cityName} · Neighborhoods`)}
            heading={v3Text('Neighborhoods')}
            rows={[firstNbh, ...restNbh]}
            // A comparison, so the counts draw as lengths too: TASTE bans a
            // ledger past six rows that encodes nothing. The share comes off
            // the same counts the figures print (placeFigureRows).
            encode="bar"
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{
              label: v3Text(`All ${cityName} homes`),
              href: homesForSalePath(cityName),
            }}
          />
        ) : null}

        {/* D88: every community in the city that has a photo, marquee first. */}
        {firstRail ? (
          <V3Ledger
            id="communities"
            layout="places"
            eyebrow={v3Text(`${cityName} · Communities`)}
            heading={v3Text('Communities and subdivisions')}
            rows={[firstRail, ...restRail]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text('Every community'), href: '/communities' }}
          />
        ) : null}

        {/* Pattern 1 again, as ONE enumeration: one section per other property
            type this city holds. A type with nothing publishable is absent,
            never an empty section and never a zero. */}
        {/* Property types live on PlaceTypeSlider + Split Home type, not as a stack of identical Instruments. */}

        {/* D85: golf and master-planned communities are their OWN section,
            never folded into the neighborhoods list. The value column publishes
            only when the alias-aware read returned (invariant 1). */}
        {firstGolf ? (
          <V3Ledger
            id="communities-ledger"
            layout="places"
            eyebrow={v3Text(`${cityName} · Communities`)}
            heading={v3Text('Golf and master-planned communities')}
            rows={[firstGolf, ...restGolf]}
            // A comparison, so the counts draw as lengths too: TASTE bans a
            // ledger past six rows that encodes nothing. The share comes off
            // the same counts the figures print (placeFigureRows).
            encode="bar"
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text('Every community'), href: '/communities' }}
          />
        ) : null}

        {costChart && firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text(`${cityName} · Typical price`)}
            headline={v3Text(marketHeadline)}
            figures={[firstMarketFigure, ...restMarketFigures]}
            chartFirst
            foldAfter={0}
            source={v3Text(cityInstrumentSource(cityMarketTrace(cityName, mosLabel != null), mart, cityName))}
            chart={costChart}
            updated={leftoverStamp ? v3Text(formatDate(leftoverStamp)) : undefined}
            // SITE-03: the place door in the opening is the filled control to
            // this exact URL. A second solid navy button to the same href, six
            // sections down, was two primaries to one destination on one page,
            // so the Instrument's way in steps down to the outline. The link,
            // the label and the destination are unchanged.
            action={{
              label: v3Text(`See every ${cityName} home for sale`),
              href: homesForSalePath(cityName),
              variant: 'ghost',
            }}
          />
        ) : firstMarketFigure && !costChart ? (
          <V3Quiet id="market" heading={marketHeadline} items={tooFewSalesItems()} />
        ) : (
          <V3Quiet
            id="market"
            heading={marketHeadline}
            items={marketAbsenceItems(cityName, true)}
          />
        )}

        {/* SITE-07: the two-way affordability instrument. It sits after the
            typical-price Instrument on purpose — the reader has just been told
            what this market costs, and this is where they answer back with
            their own number. Its own pattern, so neither neighbour repeats a
            pattern (Instrument above, Quiet below). */}
        {affordability ? <V3PlaceAffordability id="afford" {...affordability} /> : null}

        {aboutItems.length > 0 ? (
          <V3Quiet
            id="about"
            eyebrow={`${cityName}, Oregon`}
            heading={cityName}
            items={aboutItems}
          />
        ) : null}

        {/* D93: the live feed, every row carrying its listing's own photo. */}
        {firstAct ? (
          <V3Ledger
            id="activity"
            layout="pulse"
            eyebrow={v3Text(`Live · ${cityName}`)}
            heading={v3Text('Latest market activity')}
            rows={[firstAct, ...restAct]}
            source={v3Text(cityActivityTrace(cityName))}
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
            action={{ label: v3Text(`Every open house in ${cityName}`), href: `/open-houses/${slug}` }}
          />
        ) : null}

        {/* A question set belongs in the primitive built for question sets:
            every answer folds, and every answer stays in the served HTML for
            the crawler that never opens one. */}
        <V3Answers
          id="faq"
          eyebrow="Common questions"
          heading={`Questions about ${cityName}`}
          questions={faqs.map((item) => ({ question: item.question, body: item.answer }))}
        />

        {/* D80: real published guides for this city, never generated filler. */}
        {firstGuide ? (
          <V3Ledger
            id="guides"
            layout="magazine"
            eyebrow={v3Text('Guides and news')}
            heading={v3Text(`${cityName} guides`)}
            rows={[firstGuide, ...restGuide]}
            action={{ label: v3Text('Every guide'), href: '/blog' }}
          />
        ) : null}

        <V3Quiet id="explore" eyebrow={`${cityName} · Explore`} heading="Where to next" items={exploreItems} />

        {/* D84: Explore other cities - its own section, not a within-city list. */}
        {firstOther ? (
          <V3Ledger
            id="nearby"
            layout="places"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Explore other cities')}
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
          only when it is NOT nested in sectioning content, and <main> is
          sectioning content, so inside it the element is a generic and the page
          ships no contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
