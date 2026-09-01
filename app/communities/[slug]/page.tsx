/**
 * /communities/[slug] — master-plan grain. First screen is Split + leftover
 * face (count + median list). MOS / sold / verdict / DTP stay off the face.
 * Tetherow leftover is the 16 SFR pile, not alias Field length. Eagle Crest
 * does not seed an unreliable hull. Parity:
 * design_system/ryan-realty/ui_kits/community/parity.json.
 *
 * leftoverHudKpis grain stays 'neighborhood', keyed by the bare community
 * slug. publishPlaceFace({ grain: 'community', hud }) prints that leftover
 * pile. Miss omits. Do not pass alias length as an active override.
 */

import { notFound } from 'next/navigation'
import { readCityOpenHouses, openHouseRows, OPEN_HOUSE_TRACE } from '@/lib/kb/place-open-houses'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { buildActivityItems } from '@/lib/kb/place-sections'
import { activityRows, placeFigureRows, PLACE_COUNT_TRACE, type CityPlaceItem } from '@/app/cities/[slug]/_v3/city-sections'
import { communityImage } from '@/lib/geo-images'
import type { Metadata } from 'next'
import { getCommunityBySlug, getCommunityListings } from '@/app/actions/communities'
import {
  getListingTiles,
  getGeoSnapshot,
  getGeoBoundaryMapData,
  getResortBoundaryGeoJSON,
  getResortCommunityBySlug,
  getBlogPostsBySlugs,
  getPriceHistory,
  getDetachedOverlays,
  cityDetachedSlug,
  getCityHeroUrlsBySlug,
} from '@/lib/data'
import { cityLibraryHero, cityStagePoster } from '@/app/cities/[slug]/_v3/city-opening'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getCommunitySeoAbout } from '@/lib/community-seo-content'
import boundarySanityBaseline from '@/data/boundary-sanity-baseline.json' assert { type: 'json' }
import { GOLF_COURSES } from '@/data/golf/courses'
import { cityResorts, resortActiveSfrCounts, resortTilesForSlug } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { getDistrictForCity } from '@/data/co-schools'
import { getPlaceLinks } from '@/lib/place-links'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { childAliasesOf } from '@/lib/communities/community-own-names'
import { getPlaceDocuments } from '@/lib/data/places/getPlaceDocuments'
import { getPlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace, publicPaceItems } from '@/lib/data/market-truth/public-pace'
import {
  getPublicDetachedMonthly,
  leftoverNeighborhoodOrCityMonthly,
} from '@/lib/data/market-truth/public-monthly'
import { EMPTY_PUBLIC_MIX, getPublicDetachedMix } from '@/lib/data/market-truth/public-mix'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { getCoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { publishPlaceFace } from '@/lib/market/publish-place-face'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { toPublicCoreChartSeries } from '@/lib/market/publish-public-chart-source'
import { isTrendSeriesTooSparse } from '@/lib/kb/place-sections'
import { buildYearSeries } from '@/lib/kb/year-series'
import { pageMetadata } from '@/lib/site/page-metadata'
import { valuationHref } from '@/lib/site/valuation-href'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { skippableRail } from '@/lib/build-phase'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { zonedDateKey, formatDate } from '@/lib/format/date'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3PlaceCharacter,
  V3Quiet,
  V3SectionTracker,
  type V3ChartCardProps,
  type V3InstrumentFigure,
} from '@/components/site/v3'
import { PlaceFaceStrip } from '@/components/place/PlaceFaceStrip'
import { PlaceAreaHero } from '@/components/place/PlaceAreaHero'
import { PlaceTypeSlider } from '@/components/place/PlaceTypeSlider'
import { PlaceSplitView } from '@/components/search/PlaceSplitView'
import {
  placeTypeCoverPhotos,
  publishPlaceTypeCards,
} from '@/lib/place/publish-place-type-cards'
import { loadPlaceTypeCoverPhotos } from '@/lib/place/load-place-type-covers'
import { homesForSalePath, slugify } from '@/lib/slug'
import '@/components/search/search-ledger.css'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import CommunityPageTracker from '@/components/community/CommunityPageTracker'
import { coreChartsCard } from '@/components/market/core-charts'
import { CommunityAlertSheet } from './_v3/CommunityAlertSheet.client'
import { buildCommunitySchemas, communityMetadataInput } from './_v3/community-metadata'
import {
  buildExploreEdges,
  communityDocumentItems,
  reconcileListedVsDetachedFaq,
  reconcilePlaceHoaFaq,
} from './_v3/community-figures'
import { buildPlaceKnowledge } from './_v3/place-knowledge'
import { measuredPlaceHoaInput } from './_v3/place-hoa-measured'
import { publishPlaceHoa } from '@/lib/market/publish-place-hoa'
import {
  belongingHeadline,
  communityLibraryHero,
  communitySplitListings,
  communityTypeStripItems,
  firstAboutParagraph,
  leftoverSoldHistoryFigures,
  stagePoster,
} from './_v3/community-opening'
import { resortQuietItems } from '../_v3/resort-doors'
import {
  leftoverMarketFigures,
  CITY_PACE_KEYS_ON_THE_HUD,
  placeMedianChart,
  placeMedianChartCaption,
} from '@/app/cities/[slug]/_v3/city-sections'
import { buildPublicMixFigures } from '@/app/housing-market/[...slug]/_v3/geo-figures'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return getAllResortCommunities().map((c) => ({ slug: c.slug }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const BOUNDARY_ROW_CAP = 200

const UNRELIABLE_BOUNDARY_SLUGS = new Set(boundarySanityBaseline.allowed as string[])
function isBoundaryReliable(slug: string): boolean {
  return !UNRELIABLE_BOUNDARY_SLUGS.has(slug)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()
  const publicName = getResortCommunityBySlug(slug)?.label ?? community.name
  return pageMetadata(
    communityMetadataInput({
      slug,
      name: publicName,
      city: community.city,
      heroImageUrl: community.heroImageUrl,
    }),
  )
}

export default async function CommunityDetailPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams

  const community = await getCommunityBySlug(slug)
  if (!community) notFound()

  const cityName = community.city

  const [openHouses, communityActivity] = await Promise.all([
    readCityOpenHouses(cityName),
    getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }).catch(() => []),
  ])
  const [firstAct, ...restAct] = activityRows(buildActivityItems(communityActivity, { staleNewAfterDays: 21 }))
  const citySlug = community.citySlug

  const subdivisionLc = community.subdivision.toLowerCase().trim()
  const resortMatch = cityResorts(citySlug).find(
    (r) =>
      r.slug === slug ||
      r.label.toLowerCase().trim() === subdivisionLc ||
      (r.subdivision_aliases ?? []).some((a) => a.toLowerCase().trim() === subdivisionLc),
  )
  const resortSlug = resortMatch?.slug ?? slug
  const registryEntry = getResortCommunityBySlug(resortSlug)
  const isResort = registryEntry?.is_resort === true || community.isResort
  const isResortInCity = Boolean(resortMatch)

  const childAliases = registryEntry
    ? childAliasesOf(registryEntry, registryEntry.subdivision_aliases)
    : []
  const publicName = registryEntry?.label ?? community.name
  const placeAliases = [community.subdivision, publicName, ...childAliases]
  const placeOpenHouses = openHouses.filter((oh) => {
    const sub = oh.subdivisionName?.trim().toLowerCase()
    if (!sub) return false
    return placeAliases.some((alias) => {
      const name = alias.trim().toLowerCase()
      return Boolean(name) && (sub === name || sub.includes(name) || name.includes(sub))
    })
  })
  const [firstOh, ...restOh] = openHouseRows(placeOpenHouses)

  const communityGeoKey = `${cityName.toLowerCase().trim()}:${community.subdivision.toLowerCase().trim()}`
  const neighborhoodSlug = slug

  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [
    snapshot,
    priceHist,
    boundaryRead,
    resortBoundary,
    citySfrRead,
    richContent,
    cityPriceHist,
    commCoreCharts,
    publicPace,
    publicSegments,
    leftoverCityMonthly,
    leftoverNeighborhoodMonthly,
    publicMix,
    commOverlays,
    placeDocuments,
    placeCharacter,
  ] = await Promise.all([
    withTimeoutFallback(getGeoSnapshot({ geoType: 'community', geoKey: communityGeoKey }), null, 3000, 'comm:snapshot'),
    withTimeoutFallback(getPriceHistory('neighborhood', neighborhoodSlug, 'monthly', 60), [], 4500, 'comm:priceHistory'),
    withTimeoutFallbackResult(getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'comm:boundary'),
    withTimeoutFallback(getResortBoundaryGeoJSON(slug), null, 4500, 'comm:resortBoundary'),
    isResortInCity
      ? withTimeoutFallbackResult(
          Promise.all(
            [...new Set([cityName, ...(registryEntry?.mls_cities ?? [])])].map((c) => fetchAllCityActiveSfr(c)),
          ).then((sets) => sets.flat()),
          [], 9000, 'comm:citySfr',
        )
      : Promise.resolve({ value: [] as Awaited<ReturnType<typeof getListingTiles>>, ok: true }),
    withTimeoutFallback(getResortCommunityContent(resortSlug), null, 2500, 'comm:content'),
    withTimeoutFallback(getPriceHistory('city', canonicalCityCacheSlug(citySlug), 'monthly', 60), [], 4500, 'comm:cityPriceHistory'),
    withTimeoutFallback(getCoreChartSeries({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), null, 4500, 'comm:coreCharts'),
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }),
      EMPTY_PUBLIC_PACE,
      3000,
      'comm:publicPace',
    ),
    withTimeoutFallback(
      getPublicPlaceSegments({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }),
      [],
      3000,
      'comm:publicSegments',
    ),
    withTimeoutFallback(
      getPublicDetachedMonthly({ geoType: 'city', geoSlug: citySlug, currentMonthKey }),
      [],
      4500,
      'comm:leftoverCityMonthly',
    ),
    withTimeoutFallback(
      getPublicDetachedMonthly({
        geoType: 'neighborhood',
        geoSlug: neighborhoodSlug,
        currentMonthKey,
      }),
      [],
      4500,
      'comm:leftoverNeighborhoodMonthly',
    ),
    withTimeoutFallback(
      getPublicDetachedMix({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }),
      EMPTY_PUBLIC_MIX,
      3000,
      'comm:publicMix',
    ),
    withTimeoutFallback(
      getDetachedOverlays([{ geoType: 'neighborhood', geoSlug: neighborhoodSlug }]),
      new Map(),
      3000,
      'comm:detachedOverlay',
    ),
    withTimeoutFallback(getPlaceDocuments('community', slug), [], 4000, 'comm:documents'),
    withTimeoutFallback(
      getPlaceCharacter('neighborhood', neighborhoodSlug),
      null,
      4000,
      'comm:character',
    ),
  ])
  const commMt = commOverlays.get(`neighborhood:${cityDetachedSlug(neighborhoodSlug)}`)
  const hud = leftoverHudKpis({
    grain: 'neighborhood',
    headlines: commMt?.headlines ?? null,
    inventory: commMt?.inventory ?? null,
    pace: publicPace,
  })
  // Face is leftover membership (Tetherow 16 SFR), never alias Field length.
  const face = publishPlaceFace({ grain: 'community', hud })
  const libraryHero = await withTimeoutFallback(communityLibraryHero(slug), null, 3000, 'comm:libraryHero')
  const emptyHeroes: Record<string, string> = {}
  const [cityHeroes, cityLibraryHeroUrl] = await Promise.all([
    withTimeoutFallback(getCityHeroUrlsBySlug(), emptyHeroes, 3000, 'comm:cityHeroes'),
    withTimeoutFallback(cityLibraryHero(citySlug), null, 3000, 'comm:cityLibraryHero'),
  ])
  const stagePosterSrc =
    stagePoster(slug, community.heroImageUrl, libraryHero) ??
    cityStagePoster(cityHeroes[citySlug], cityLibraryHeroUrl)
  const headline = belongingHeadline(publicName, richContent)

  const amenityBlogSlugs = (richContent?.amenities ?? [])
    .map((a) => a.blog_slug)
    .filter((s): s is string => Boolean(s))
  const amenityPosts =
    amenityBlogSlugs.length > 0
      ? await skippableRail(() => getBlogPostsBySlugs(amenityBlogSlugs), {}, 2500, 'comm:amenityPosts')
      : {}

  const { measuredAnnual: hoaMeasuredAnnual, measuredBasis: hoaMeasuredBasis } =
    measuredPlaceHoaInput(placeCharacter)
  const resolvedHoa = publishPlaceHoa({
    measuredAnnual: hoaMeasuredAnnual,
    measuredBasis: hoaMeasuredBasis,
    masterAnnual: richContent?.hoaMasterAnnual,
    estimateAnnual: registryEntry?.hoa_annual_estimate,
    subEstimates: registryEntry?.sub_neighborhoods?.map((s) => s.hoa_annual_estimate),
  })

  const boundaryReliable = isBoundaryReliable(slug)
  const boundaryMapData = boundaryRead.value
  const citySfrTiles = citySfrRead.ok ? citySfrRead.value : []
  const boundaryListingKeys = boundaryMapData.pins.map((p) => p.listingKey)

  const resortTiles = isResortInCity ? resortTilesForSlug(citySlug, resortSlug, citySfrTiles) : []
  const useResortTiles = resortTiles.length > 0

  let communityTiles: Awaited<ReturnType<typeof getListingTiles>> = useResortTiles
    ? resortTiles
    : boundaryReliable && boundaryListingKeys.length > 0
      ? await withTimeoutFallbackResult(
          getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', propertyType: 'A', limit: BOUNDARY_ROW_CAP }),
          [],
          4500,
          'comm:tiles',
        ).then((r) => (r.ok ? r.value : []))
      : await withTimeoutFallbackResult(
          getListingTiles({ city: cityName, status: 'active', propertyType: 'A', limit: 1500 }),
          [],
          4500,
          'comm:tiles-fallback',
        ).then((r) => (r.ok ? r.value : []))
  const usedSubdivisionNarrowing = !useResortTiles && (!boundaryReliable || boundaryListingKeys.length === 0)
  if (usedSubdivisionNarrowing) {
    const subListingsRead = await withTimeoutFallbackResult(
      getCommunityListings(cityName, community.subdivision, BOUNDARY_ROW_CAP),
      [],
      4500,
      'comm:sub-listings',
    )
    const subListings = subListingsRead.ok ? subListingsRead.value : []
    const subKeys = new Set(subListings.map((r) => r.ListingKey).filter(Boolean) as string[])
    communityTiles = communityTiles.filter((t) => subKeys.has(t.listingKey))
  }

  const haveCityTiles = citySfrRead.ok && isResortInCity && citySfrTiles.length > 0
  const resortSfrCounts = haveCityTiles ? resortActiveSfrCounts(citySlug, citySfrTiles) : new Map<string, number>()
  const aliasAwareCount = haveCityTiles ? resortSfrCounts.get(resortSlug) ?? null : null

  const activeCount: number | null = hud.active

  // Child subdivisions — the registry's own named subdivisions of this
  // community (childAliasesOf already excludes the community's current and
  // former names), counted from the SAME city SFR set the alias-aware count
  // uses, so the ledger and the face can never disagree about a member.
  // Destination safety: every href resolves through the plat page's registry
  // path, so no card here can serve the refusal. §0: when the city SFR read
  // did not answer, counts are null ("not measured"), never zero.
  const childSubdivisionItems: CityPlaceItem[] = childAliases
    .flatMap((alias) => {
      // The MLS alias stays the ingest key (href + count bin); the visitor
      // name goes through the one display publisher (Triple → Triple Knot,
      // and an MLS abbreviation like BBR publishes nothing rather than junk).
      const displayName = publishPlatDisplayName(alias)
      if (!displayName) return []
      const aliasLc = alias.trim().toLowerCase()
      const prices = haveCityTiles
        ? citySfrTiles
            .filter((t) => (t.subdivisionName ?? '').trim().toLowerCase() === aliasLc)
            .map((t) => Number(t.listPrice))
            .filter((p) => Number.isFinite(p) && p > 0)
            .sort((a, b) => a - b)
        : null
      const medianPrice =
        prices == null || prices.length === 0
          ? null
          : prices.length % 2
            ? prices[Math.floor(prices.length / 2)]!
            : Math.round((prices[prices.length / 2 - 1]! + prices[prices.length / 2]!) / 2)
      return [
        {
          name: displayName,
          href: `/subdivisions/${slugify(alias)}`,
          activeCount: prices == null ? null : prices.length,
          medianPrice,
          img: communityImage(slugify(alias)) ?? '',
        },
      ]
    })
    .sort((a, b) => (b.activeCount ?? 0) - (a.activeCount ?? 0) || a.name.localeCompare(b.name))
  const [firstChildSub, ...restChildSub] = placeFigureRows(
    childSubdivisionItems,
    `${publicName} subdivision`,
  )

  const marketHeadline = `The ${publicName} market`

  const leftoverStamp =
    commMt?.headlines?.computedAt ?? commMt?.inventory?.computedAt ?? snapshot?.refreshedAt ?? null

  const schoolDistrictInfo = getDistrictForCity(slug === 'eagle-crest' ? 'Redmond' : cityName)

  const marketFaqInput: MarketFaqInput = {
    grain: 'neighborhood',
    source: 'market-truth',
    activeCount: hud.active,
    pulseActiveCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: null,
    medianDaysToPending: hud.daysToPending,
    medianDaysOnMarket: null,
    refreshedAt: leftoverStamp,
    soldCount12mo: publicPace.closedCount ?? null,
    subdivisionAliases: childAliases.length > 0 ? childAliases : null,
    hoaMasterAnnual: resolvedHoa?.annual ?? richContent?.hoaMasterAnnual ?? null,
    hoaAnnualEstimate: registryEntry?.hoa_annual_estimate ?? null,
    hoaSubEstimates: registryEntry?.sub_neighborhoods?.map((s) => s.hoa_annual_estimate) ?? null,
    schoolDistrictName: schoolDistrictInfo?.district ?? null,
    schoolDistrictSlug: schoolDistrictInfo?.districtSlug ?? null,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(publicName, marketFaqInput)

  const placeLinks = getPlaceLinks({
    type: 'community',
    slug: resortSlug,
    citySlug: citySlug || undefined,
  })
  const browseHref = placeLinks.browseUrl
  const communityMarketHref = placeLinks.marketUrl
  const cityReportHref = citySlug ? `/housing-market/${citySlug}` : '/housing-market'

  const leftoverFigures: V3InstrumentFigure[] = leftoverMarketFigures(hud, {
    browse: browseHref,
    monthsOfSupply: '/months-of-supply',
  })
  const soldHistory = leftoverSoldHistoryFigures(hud, publicPace)
  const soldLabels = new Set(soldHistory.map((figure) => String(figure.label)))
  const isFaceOrMosLabel = (label: string): boolean =>
    label === 'median list price' ||
    label.includes('for sale') ||
    label === 'months of supply'
  const restMarket: V3InstrumentFigure[] = leftoverFigures.filter((figure) => {
    const label = String(figure.label)
    return !isFaceOrMosLabel(label) && !soldLabels.has(label)
  })
  for (const item of publicPaceItems(publicPace)) {
    if (CITY_PACE_KEYS_ON_THE_HUD.has(item.key)) continue
    if (item.key === 'medClose') continue
    restMarket.push({ value: v3Text(item.value), label: v3Text(item.label) })
  }
  for (const figure of buildPublicMixFigures(publicMix)) {
    if (String(figure.value).startsWith('at least')) continue
    restMarket.push(figure)
  }
  const marketFigures = [...soldHistory, ...restMarket]
  const [firstMarketFigure, ...restMarketFigures] = marketFigures

  const communityCacheSparse = isTrendSeriesTooSparse(priceHist)
  const chartMonths = leftoverNeighborhoodOrCityMonthly({
    leftoverNeighborhood: leftoverNeighborhoodMonthly,
    leftoverCity: leftoverCityMonthly,
    neighborhoodCache: priceHist,
    cityCache: cityPriceHist,
    currentMonthKey,
    neighborhoodCacheSparse: communityCacheSparse,
  })
  const chartIsCityLevel = chartMonths.cityFallback
  const medianChart = chartIsCityLevel
    ? undefined
    : placeMedianChart(
        buildYearSeries(chartMonths.months, 5),
        placeMedianChartCaption(publicName),
      )

  const coreChartsRaw = chartIsCityLevel ? null : commCoreCharts
  const coreCharts = coreChartsRaw ? toPublicCoreChartSeries(coreChartsRaw) : null
  const trendsCard = coreChartsCard(coreCharts, publicName, undefined)
  const marketCards: V3ChartCardProps[] = trendsCard ? [trendsCard] : []

  const fieldTiles = aliasAwareCount != null ? resortTiles : communityTiles
  const listedCount = fieldTiles.length
  const mapPolygon = resortBoundary ?? (boundaryReliable ? boundaryMapData.polygon : null)
  const seedRing = boundaryReliable
  const splitListings =
    !boundaryReliable && fieldTiles.length > 0 ? communitySplitListings(fieldTiles) : undefined
  const hasMap = Boolean(mapPolygon) || fieldTiles.length > 0 || Boolean(splitListings?.length)
  const typeCovers = await withTimeoutFallback(
    loadPlaceTypeCoverPhotos({
      city: cityName,
      subdivision: community.subdivision,
      aliases: [community.subdivision, publicName, ...childAliases],
    }),
    {},
    4500,
    'comm:typeThumbs',
  )
  const typeCards = publishPlaceTypeCards({
    browsePath: homesForSalePath(cityName, community.subdivision),
    placeName: publicName,
    sfrCount: hud.active,
    sfrMedian: hud.medianList,
    sfrMos: null,
    segments: publicSegments,
    covers: { ...placeTypeCoverPhotos(splitListings ?? fieldTiles), ...typeCovers },
  })

  const pageFaqs = reconcilePlaceHoaFaq(
    reconcileListedVsDetachedFaq(faqs, {
      placeName: publicName,
      listedCount,
      detachedCount: hud.active,
    }),
    resolvedHoa,
  )

  const seoAbout = getCommunitySeoAbout(slug)
  const aboutParagraphs: string[] =
    seoAbout ??
    (richContent?.aboutProse.length
      ? richContent.aboutProse
      : [community.description ?? registryEntry?.description ?? ''].filter((p): p is string => Boolean(p && p.trim())))
  const faceAbout = firstAboutParagraph(aboutParagraphs)

  const knowledgeItems = buildPlaceKnowledge({
    name: publicName,
    city: cityName,
    aboutParagraphs: aboutParagraphs,
    content: richContent,
    registry: registryEntry ?? null,
    schoolDistrictName: schoolDistrictInfo?.district ?? null,
    schoolDistrictSlug: schoolDistrictInfo?.districtSlug ?? null,
    isResort,
    countIsAliasAware: aliasAwareCount != null,
    contactHref: `/contact?inquiryType=Buying&message=${encodeURIComponent(
      `I have questions about short-term rental rules in ${publicName}.`,
    )}`,
    amenityPosts,
    character: placeCharacter,
  })

  const typeItems = communityTypeStripItems(publicSegments, citySlug)

  const exploreItems = buildExploreEdges({
    communityName: publicName,
    cityName,
    citySlug,
    browseHref,
    communityMarketHref,
    cityReportHref,
    pagePath: `/communities/${slug}`,
    faqs: pageFaqs,
    documentItems: communityDocumentItems(publicName, placeDocuments),
    golfCourses: GOLF_COURSES.filter((c) => c.communitySlug === slug),
    resortItems: resortQuietItems(),
  })
  exploreItems.push({ label: 'Value my home', href: valuationHref(`/communities/${slug}`) })

  const communitySchemas = buildCommunitySchemas({
    slug,
    name: publicName,
    cityName,
    citySlug,
    hasMap,
    centerLonLat: registryEntry?.center_lon_lat ?? null,
    datasetVariables,
    asOfIso,
    asOfLabel,
    faqs: pageFaqs,
  })

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Communities', href: '/communities' },
    ...(cityName ? [{ label: cityName, href: citySlug ? `/cities/${citySlug}` : '/cities' }] : []),
    { label: publicName },
  ]

  const placeItems = [
    ...(faceAbout ? [{ kind: 'prose' as const, body: faceAbout }] : []),
    { label: `See ${publicName} houses`, href: '#homes' },
    { label: `Search ${publicName} homes`, href: browseHref },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <CommunityPageTracker
          slug={slug}
          communityName={publicName}
          city={cityName}
          activeCount={activeCount}
          medianPrice={hud.medianList}
        />
        <V3SectionTracker />
        <MetadataBlock schemas={communitySchemas} />

        {stagePosterSrc ? (
          <PlaceAreaHero
            eyebrow={`${publicName} · ${cityName}`}
            headline={headline}
            posterSrc={stagePosterSrc}
            trail={trail}
            stats={face.stats}
          />
        ) : (
          <V3Breadcrumb trail={trail} />
        )}
        {stagePosterSrc ? null : (
          <V3Quiet id="place" heading={headline} headingLevel={1} items={placeItems} />
        )}
        {stagePosterSrc ? null : (
          <section className={`${V3_ROOT_CLASS} place-face-block`} aria-label={`${publicName} live inventory`}>
            {face.stats.length > 0 ? <PlaceFaceStrip stats={face.stats} /> : null}
          </section>
        )}
        <PlaceTypeSlider cards={typeCards} label={`${publicName} property types`} />

        <PlaceSplitView
          id="homes"
          city={cityName}
          subdivision={community.subdivision}
          boundaryGeojson={seedRing ? mapPolygon : null}
          seedRing={seedRing}
          placeQuery={publicName}
          listings={splitListings}
          totalCount={splitListings?.length}
          degraded={!citySfrRead.ok && isResortInCity}
          searchParams={sp}
        />

        {firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text(`${publicName} · Sold`)}
            headline={v3Text(marketHeadline)}
            figures={[firstMarketFigure, ...restMarketFigures]}
            foldAfter={5}
            source={v3Text(
              `regional MLS through Oregon Data Share, read through the Market Truth metric layer: ` +
                `detached single-family houses assigned to ${publicName} by boundary membership. ` +
                `Sold history is leftover, not a city monthly chart. Months of supply and a buyer's or seller's verdict stay off this grain.`,
            )}
            chart={medianChart}
            cards={marketCards}
            updated={leftoverStamp ? v3Text(formatDate(leftoverStamp)) : undefined}
            action={{
              label: v3Text(`Search ${publicName} homes`),
              href: browseHref,
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="market"
            heading={`The ${publicName} market`}
            items={[
              {
                kind: 'prose',
                term: 'No live market figures right now',
                body: `The Market Truth metric layer published no figure for ${publicName} on this refresh, so this page is not printing a median, a supply figure, or a verdict.`,
              },
            ]}
          />
        )}

        {knowledgeItems.length > 0 ? (
          <V3Quiet
            id="belonging"
            eyebrow={`${publicName} · Belonging`}
            heading={`Living in ${publicName}`}
            items={knowledgeItems}
          />
        ) : null}

        <V3PlaceCharacter placeName={publicName} character={placeCharacter} />

        {/* Subdivisions inside the community - every row is a door, mirroring
            the neighborhood page's ledger so the two grains read the same. */}
        {firstChildSub ? (
          <V3Ledger
            id="subdivisions"
            eyebrow={v3Text(`${publicName} · Subdivisions`)}
            heading={v3Text('Subdivisions')}
            rows={[firstChildSub, ...restChildSub]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text(`All ${publicName} homes`), href: browseHref }}
          />
        ) : null}

        <CommunityAlertSheet
          communityName={publicName}
          city={cityName}
          subdivision={community.subdivision}
        />

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

        {firstAct ? (
          <V3Ledger
            id="activity"
            layout="pulse"
            eyebrow={v3Text(`Live · ${cityName}`)}
            heading={v3Text('Latest market activity')}
            rows={[firstAct, ...restAct]}
            source={v3Text(
              `live MLS through Oregon Data Share, new listings, price changes, pendings, and closings on ${cityName} homes`,
            )}
            action={{ label: v3Text('Full market pulse'), href: '/housing-market' }}
          />
        ) : null}

        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading={`${publicName} real estate questions`}
          items={exploreItems}
          note={`Market figures on this page come from the regional MLS through Oregon Data Share.${
            asOfLabel ? ` Market data updated ${asOfLabel}.` : ''
          }`}
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
