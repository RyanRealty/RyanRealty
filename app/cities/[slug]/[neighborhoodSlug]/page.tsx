/**
 * /cities/[slug]/[neighborhoodSlug] - the neighborhood node, on the
 * components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md §3 Neighborhood.
 * Stage (Imagine/library still) then one Field of its houses. Daily life
 * (schools, parks) only when the library has rows. Section order is the
 * parity contract: design_system/ryan-realty/ui_kits/neighborhood/parity.json.
 *
 * Stage, then one Field (map + list). Email ask after homes. Mid-page market:
 * one sentence, one chart, a few figures. No type H2 run as the opener.
 *
 * TWO SLUGS, TWO POPULATIONS, NEVER MIXED (the metricNeighborhoodSlug
 * convention). GIS, inventory, the map, and getPlaceCharacter key on the
 * prefixed boundary slug `${citySlug}-${neighborhoodSlug}`. Documents key on
 * the METRIC slug.
 *
 * THE PAGE CONTRACT: generateMetadata (seo fields + banned-cliche guard),
 * generateStaticParams over BEND_NEIGHBORHOOD_DISTRICTS with dynamicParams,
 * revalidate 60, MetadataBlock JSON-LD via buildNeighborhoodSchemas, and a
 * rendered V3SectionTracker.
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
  getPriceHistory,
  getListingTiles,
  getGeoBoundaryMapData,
  getAllCitySnapshots,
  getRecentBlogPosts,
  getDetachedOverlays,
  cityDetachedSlug,
  getCityHeroUrlsBySlug,
  getNeighborhoodDirectory,
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
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3PlaceCharacter,
  V3PlaceDocuments,
  V3PlacePropertyTypes,
  V3Quiet,
  V3Stage,
  V3SectionTracker,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { getPlaceDocuments } from '@/lib/data/places/getPlaceDocuments'
import { getPlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { peerNeighborhoodTowns } from '@/lib/explore/neighborhood-peers'
import { buildNeighborhoodSchemas } from './neighborhood-schemas'
import { NeighborhoodAlertsSheet } from './_v3/NeighborhoodAlertsSheet.client'
import { NeighborhoodHomesField } from './_v3/NeighborhoodHomesField'
import { neighborhoodLibraryHero, neighborhoodStagePoster } from './_v3/neighborhood-opening'
import { dailyLifeRows } from './_v3/neighborhood-daily-life'
import {
  nbhFieldItems,
  neighborhoodAboutItems,
  neighborhoodExploreItems,
} from './_v3/neighborhood-sections'
import {
  ABOUT_FOLD_AFTER,
  neighborhoodFaceAbsenceItems,
  neighborhoodFaceFaqs,
  neighborhoodFaceFieldCaption,
  neighborhoodFaceFieldTrace,
  neighborhoodFaceMarketFigures,
  neighborhoodFaceMarketTrace,
} from './_v3/neighborhood-face'
import {
  activityRows,
  areaGuideRow,
  articleRows,
  leftoverMarketFigures,
  PLACE_COUNT_TRACE,
  placeFigureRows,
  placeMedianChart,
  type CityPlaceItem,
} from '@/app/cities/[slug]/_v3/city-sections'

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

  const openHouses = await readCityOpenHouses(neighborhood.cityName)
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
    nbhOverlays,
    placeDocuments,
    placeCharacter,
    indexCities,
    neighborhoodDirectory,
    libraryHero,
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
    withTimeoutFallback(getNeighborhoodDirectory(), [], 3000, 'nbh:nbhDir'),
    withTimeoutFallback(neighborhoodLibraryHero(citySlug, neighborhoodSlug), null, 3000, 'nbh:libraryHero'),
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
  const builtFaq = buildMarketFaq(neighborhood.name, marketFaqInput)
  const faqs = neighborhoodFaceFaqs(builtFaq.faqs)
  const { datasetVariables, asOfIso, asOfLabel } = builtFaq

  const browseHref = subdivisionListingsPath(cityName, neighborhood.name)
  const figures = neighborhoodFaceMarketFigures(
    leftoverMarketFigures(hud, {
      browse: browseHref,
      monthsOfSupply: '/months-of-supply',
    }),
  )
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
    `Median close by month, single-family, ${chartScope}`,
  )

  /* ── The Field ─────────────────────────────────────────────────────────── */

  const fieldItems = nbhFieldItems(listingTiles)
  const fieldQualifyingTotal = inventoryOk ? inventory.pricedCount : listingTiles.length
  const fieldCaption = neighborhoodFaceFieldCaption({
    placeName: neighborhood.name,
    count: fieldItems.length,
    totalQualifying: fieldQualifyingTotal,
    mosLabel,
    verdictKind: verdict.kind,
    verdictLabel: verdict.label,
  })
  const liveHero =
    neighborhoodDirectory.find(
      (row) => row.citySlug === citySlug && row.neighborhoodSlug === neighborhoodSlug,
    )?.heroImageUrl ?? null
  const stagePosterSrc = neighborhoodStagePoster(liveHero, libraryHero)

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

  const neighborhoodOh = openHouses.filter((oh) => boundaryKeySet.has(oh.listingKey))
  const useNbhOh = neighborhoodOh.length > 0
  const [firstOh, ...restOh] = openHouseRows(useNbhOh ? neighborhoodOh : openHouses)
  const ohHeading = useNbhOh ? 'Open houses you can walk through' : 'Open houses across Bend'
  const ohEyebrow = useNbhOh ? `This week · ${neighborhood.name}` : `This week · ${cityName}`

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
  const hasMap = fieldItems.some((item) => item.lat != null && item.lng != null)
  const hasVerdictMarket = hasVerdict
  const marketHeadline = hasVerdictMarket ? 'How tight the market is' : `The ${neighborhood.name} market`
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
          <>
            <V3Breadcrumb
              tone="on-media"
              trail={[
                { label: 'Home', href: '/' },
                { label: cityName, href: `/cities/${citySlug}` },
                { label: neighborhood.name },
              ]}
            />
            <V3Stage
              id="place"
              headingLevel={1}
              height="tall"
              eyebrow={`${neighborhood.name} · ${cityName}`}
              headline={`${neighborhood.name} homes for sale`}
              posterSrc={stagePosterSrc}
              action={{
                label: fieldItems[0]?.title || `See ${neighborhood.name} homes`,
                href: fieldItems[0]?.href || '#homes',
              }}
            />
          </>
        ) : (
          <V3Breadcrumb
            trail={[
              { label: 'Home', href: '/' },
              { label: cityName, href: `/cities/${citySlug}` },
              { label: neighborhood.name },
            ]}
          />
        )}

        <NeighborhoodHomesField
          placeName={neighborhood.name}
          headline={v3Text(`${neighborhood.name} homes for sale`)}
          ownsHeading={!stagePosterSrc}
          fieldItems={fieldItems}
          inventoryOk={inventoryOk}
          caption={fieldCaption}
          source={neighborhoodFaceFieldTrace(neighborhood.name)}
          seeAll={{
            href: browseHref,
            label: `See every ${neighborhood.name} home for sale`,
          }}
        />

        <NeighborhoodAlertsSheet cityName={cityName} neighborhoodName={neighborhood.name} />

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

        {firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text(`${neighborhood.name} · The market`)}
            headline={v3Text(marketHeadline)}
            note={verdictSentence ? v3Text(verdictSentence) : undefined}
            figures={[firstMarketFigure, ...restMarketFigures]}
            source={v3Text(neighborhoodFaceMarketTrace(neighborhood.name, mosLabel != null))}
            chart={medianChart}
            chartFirst
            updated={leftoverStamp ? v3Text(formatDate(leftoverStamp)) : undefined}
            action={{
              label: v3Text(`See every ${neighborhood.name} home for sale`),
              href: browseHref,
              variant: 'ghost',
            }}
          />
        ) : (
          <V3Quiet
            id="market"
            heading={`The ${neighborhood.name} market`}
            items={neighborhoodFaceAbsenceItems(neighborhood.name, fieldItems.length > 0)}
          />
        )}

        {aboutItems.length > 0 ? (
          <V3Quiet
            id="about"
            eyebrow={`${neighborhood.name} · ${cityName}`}
            heading={`${neighborhood.name}, in plain words`}
            items={aboutItems}
            foldAfter={ABOUT_FOLD_AFTER}
          />
        ) : null}

        {firstDaily ? (
          <V3Ledger
            id="daily-life"
            eyebrow={v3Text(`${neighborhood.name} · Daily life`)}
            heading={v3Text('Schools and parks')}
            rows={[firstDaily, ...restDaily]}
            action={{ label: v3Text('Every school'), href: '/schools' }}
          />
        ) : null}

        {firstOh ? (
          <V3Ledger
            id="open-houses"
            eyebrow={v3Text(ohEyebrow)}
            heading={v3Text(ohHeading)}
            rows={[firstOh, ...restOh]}
            source={v3Text(OPEN_HOUSE_TRACE)}
            action={{ label: v3Text(`Every open house in ${cityName}`), href: `/open-houses/${citySlug}` }}
          />
        ) : null}

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

        <V3PlacePropertyTypes
          placeName={neighborhood.name}
          citySlug={citySlug}
          rows={publicSegments}
        />

        <V3PlaceDocuments displayName={neighborhood.name} documents={placeDocuments} />

        <V3PlaceCharacter placeName={neighborhood.name} character={placeCharacter} />

        {firstGuide ? (
          <V3Ledger
            id="guides"
            eyebrow={v3Text('Guides and news')}
            heading={v3Text(`${neighborhood.name} guides`)}
            rows={[firstGuide, ...restGuide]}
            action={{ label: v3Text('Every guide'), href: '/blog' }}
          />
        ) : null}

        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading={`Questions about ${neighborhood.name}`}
          items={faqs.map((item) => ({ kind: 'prose' as const, term: item.question, body: item.answer }))}
        />

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

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
