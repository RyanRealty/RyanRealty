/**
 * /cities/[slug] - the city node, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md §3 City. First screen is
 * V3Stage when a place-owned library still exists, then the Field of this
 * city's houses. Verdict is a caption, never a number hero.
 * Child neighborhoods and master-plans are doors below the fold. Section order
 * is the parity contract: design_system/ryan-realty/ui_kits/city/parity.json.
 *
 * Stage, then one Field (map + list, type chips). Email ask after homes.
 * Mid-page market: one sentence, one chart, a few figures. No type H2 run.
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
} from '@/lib/data'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import {
  getPublicDetachedMonthly,
  leftoverOrCacheMonthly,
  dropCurrentMonth,
} from '@/lib/data/market-truth/public-monthly'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { CITY_TILE_FETCH_LIMIT } from '@/lib/market/publish-city-inventory'
import { CITY_PLACE_LIST_CAP } from '@/lib/explore/subdivision-page-extras'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { getCityContent } from '@/lib/city-content'
import { CITY_QUICK_FACTS, PRIMARY_CITIES } from '@/lib/cities'
import { cityResorts, resortActiveSfrCounts, resortLabelToSlug } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { CITY_MARQUEE_COMMUNITIES, CITY_RESORT_LEDGER_IMG, communityVideoUrl } from '@/lib/kb/city-page-config'
import { preferPlaceHero } from '@/lib/geo-images'
import { buildActivityItems, buildArticlePosts, buildOtherCityItems } from '@/lib/kb/place-sections'
import { buildYearSeries } from '@/lib/kb/year-series'
import { getPlaceLinks } from '@/lib/place-links'
import { homesForSalePath, slugify } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { marketVerdict } from '@/lib/market/classify'
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
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3Stage,
  V3SectionTracker,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import CityPageTracker from '@/components/city/CityPageTracker'
import { CityAlertSheet } from './_v3/CityAlertSheet.client'
import { CityHomesField } from './_v3/CityHomesField'
import { cityLibraryHero, cityStagePoster } from './_v3/city-opening'
import { cityFieldPool } from './_v3/city-field-items'
import { bendNeighborhoodPlaces } from './_v3/city-places'
import {
  activityRows,
  areaGuideRow,
  articleRows,
  cityAboutItems,
  cityActivityTrace,
  cityExploreItems,
  communityRows,
  leftoverMarketFigures,
  PLACE_COUNT_TRACE,
  placeFigureRows,
  placeMedianChart,
  type CityCommunityItem,
  type CityPlaceItem,
} from './_v3/city-sections'
import {
  cityFaceAbsenceItems,
  cityFaceFaqs,
  cityFaceFieldCaption,
  cityFaceFieldTrace,
  cityFaceMarketFigures,
  cityFaceMarketTrace,
} from './_v3/city-face'
import { buildCitySchemas } from './_v3/city-metadata'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return PRIMARY_CITIES.map((name) => ({ slug: slugify(name) }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  return pageMetadata({
    title: `Homes for Sale in ${cityName}, Oregon`,
    description: `Active homes in ${cityName}, Oregon. Live list prices, neighborhoods, open houses, and recent market activity from the regional MLS.`,
    path: `/cities/${slug}`,
  })
}

export default async function CityDetailPage({ params }: Props) {
  const { slug } = await params

  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  const geoSlug = canonicalCityCacheSlug(slug)
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)

  const isBend = slug === 'bend'
  const hasResorts = cityResorts(slug).length > 0

  const [
    detached,
    detachedInv,
    publicPace,
    monthlyRows,
    priceHist,
    tiles,
    bendNeighborhoods,
    communities,
    allCitySnapshots,
    communitySnapshots,
    blogPosts,
    activity,
    resortRead,
    indexCities,
    neighborhoodDirectory,
    libraryHero,
  ] = await Promise.all([
    withTimeoutFallback(getCityDetachedMarket(slug), null, 3000, 'city:detached'),
    withTimeoutFallback(getCityDetachedInventory(slug), null, 3000, 'city:detachedInv'),
    withTimeoutFallback(getPublicDetachedPace({ geoType: 'city', geoSlug: slug }), EMPTY_PUBLIC_PACE, 3000, 'city:publicPace'),
    withTimeoutFallback(
      getPublicDetachedMonthly({ geoType: 'city', geoSlug: slug, currentMonthKey }),
      [],
      4500,
      'city:monthly',
    ),
    withTimeoutFallback(getPriceHistory('city', geoSlug, 'monthly', 60), [], 4500, 'city:priceHistory'),
    withTimeoutFallback(
      getCityListings(cityName, {
        status: 'active',
        sort: 'newest',
        limit: CITY_TILE_FETCH_LIMIT,
      }),
      [],
      4500,
      'city:mapTiles',
    ),
    isBend
      ? withTimeoutFallback(getBendNeighborhoodLedger(), [], 5000, 'city:nbhStats')
      : Promise.resolve([] as Awaited<ReturnType<typeof getBendNeighborhoodLedger>>),
    withTimeoutFallback(getCommunitiesForIndex(), [], 3500, 'city:communities'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'city:allCities'),
    withTimeoutFallback(getCityCommunitySnapshots(slug), [], 3000, 'city:commSnaps'),
    skippableRail(() => getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'city:blog'),
    skippableRail(
      () => getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }),
      [],
      3500,
      'city:activity',
    ),
    hasResorts
      ? withTimeoutFallbackResult(fetchAllCityActiveSfr(cityName), [], 6000, 'city:resortTiles')
      : Promise.resolve({ value: [] as Awaited<ReturnType<typeof fetchAllCityActiveSfr>>, ok: true }),
    withTimeoutFallback(getCityHeroUrlsBySlug(), {}, 3000, 'city:liveHeroes'),
    withTimeoutFallback(getNeighborhoodDirectory(), [], 3000, 'city:nbhDir'),
    withTimeoutFallback(cityLibraryHero(slug), null, 3000, 'city:libraryHero'),
  ])

  const areaGuideVideo = await withTimeoutFallback(getAreaGuideVideo(slug), null, 3000, 'area-guide-video')
  const resortTiles = resortRead.value

  const hud = leftoverHudKpis({
    grain: 'city',
    headlines: detached,
    inventory: detachedInv,
    pace: publicPace,
  })

  const activeCount: number | null = hud.active
  const mosRaw = hud.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
  const verdict = marketVerdict(mosRaw)
  const mosLabel = mosRaw != null ? formatMonthsOfSupply(mosRaw) : null
  const hudStamp = detached?.computedAt ?? detachedInv?.computedAt ?? null

  const marketFaqInput: MarketFaqInput = {
    grain: 'city',
    source: 'market-truth',
    activeCount: hud.active,
    pulseActiveCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: mosRaw,
    medianDaysToPending: hud.daysToPending,
    soldCount12mo: hud.sold12mo,
    refreshedAt: hudStamp,
  }
  const builtFaq = buildMarketFaq(cityName, marketFaqInput)
  const faqs = cityFaceFaqs(builtFaq.faqs)
  const marketFaq = { ...builtFaq, faqs }

  const figures = cityFaceMarketFigures(
    leftoverMarketFigures(hud, {
      browse: homesForSalePath(cityName),
      monthsOfSupply: '/months-of-supply',
    }),
  )
  const [firstMarketFigure, ...restMarketFigures] = figures

  const hasVerdict = verdict.kind !== 'unknown' && mosLabel != null
  const marketHeadline = hasVerdict ? 'How tight the market is' : `The ${cityName} market`
  const verdictSentence = hasVerdict
    ? `${cityName} has ${mosLabel} months of supply, which is a ${verdict.label}.`
    : null

  const chartMonths = leftoverOrCacheMonthly(monthlyRows, dropCurrentMonth(priceHist, currentMonthKey))
  const medianChart = placeMedianChart(
    buildYearSeries(chartMonths.months, 5),
    `Median close by month, single-family, ${cityName}`,
  )

  const fieldItems = cityFieldPool(tiles, CITY_PLACE_LIST_CAP)
  const stagePosterSrc = cityStagePoster(indexCities[slug], libraryHero)
  const fieldCaption = cityFaceFieldCaption({
    cityName,
    count: fieldItems.length,
    mosLabel,
    verdictKind: verdict.kind,
    verdictLabel: verdict.label,
  })

  const cityComms = communities.filter((c) => c.city?.toLowerCase().trim() === cityName.toLowerCase().trim())
  const commImgByName = new Map(cityComms.map((c) => [c.subdivision.toLowerCase(), c.heroImageUrl]))
  const commImgBySlug = new Map(cityComms.map((c) => [c.slug, c.heroImageUrl]))

  const resortSfrCounts = resortRead.ok
    ? resortActiveSfrCounts(slug, resortTiles)
    : new Map<string, number>()
  const resortSlugByLabel = resortLabelToSlug(slug)

  const communitySfrBySlug = new Map<string, number>()
  for (const s of communitySnapshots) {
    const rawSlug = s.geoKey.includes(':') ? s.geoKey.split(':')[1]! : s.geoKey
    if (s.activeSfrCount != null) {
      communitySfrBySlug.set(rawSlug.replace(/\s+/g, '-').toLowerCase(), s.activeSfrCount)
    }
  }

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

  const curatedComms = CITY_MARQUEE_COMMUNITIES[slug] ?? []
  const communityItems: CityCommunityItem[] = cityComms
    .map((c): CityCommunityItem | null => {
      const curated = curatedComms.find((f) => c.subdivision.toLowerCase().includes(f.match))
      const cvUrl = communityVideoUrl(curated?.videoSlug)
      const img = preferPlaceHero(c.heroImageUrl, curated?.img ?? '') || null
      if (!img) return null
      const resortSlug = resortSlugByLabel.get(c.subdivision.toLowerCase().trim())
      const count = resortSlug ? resortSfrCounts.get(resortSlug) ?? c.activeCount : c.activeCount
      return {
        name: c.subdivision,
        activeCount: count,
        medianPrice: null,
        town: cityName,
        href: getPlaceLinks({ type: 'community', slug: resortSlug ?? c.slug, citySlug: slug }).placeUrl,
        img,
        video: cvUrl ? { url: cvUrl, embedType: 'video-tag' as const } : null,
      }
    })
    .filter((x): x is CityCommunityItem => x !== null)
    .sort((a, b) => (a.video ? 0 : 1) - (b.video ? 0 : 1) || (b.activeCount ?? 0) - (a.activeCount ?? 0))
    .filter((item, i, arr) => arr.findIndex((x) => x.href === item.href) === i)

  const railNames = new Set(communityItems.map((c) => c.name.toLowerCase().trim()))
  const golfLedgerItems = golfCommunityItems.filter((t) => !railNames.has(t.name.toLowerCase().trim()))

  const otherCityItems: CityPlaceItem[] = buildOtherCityItems(allCitySnapshots, {
    excludeSlug: slug,
    liveHeroBySlug: indexCities,
  })

  const activityItems = buildActivityItems(activity, { staleNewAfterDays: 21 })
  const articlePosts = buildArticlePosts(blogPosts)

  const [firstNbh, ...restNbh] = placeFigureRows(bendNeighborhoodItems, `${cityName} neighborhood`)
  const [firstRail, ...restRail] = communityRows(communityItems)
  const [firstGolf, ...restGolf] = placeFigureRows(golfLedgerItems, 'Golf and master-planned')
  const [firstOther, ...restOther] = placeFigureRows(otherCityItems, 'Central Oregon city')
  const openHouses = await readCityOpenHouses(cityName)
  const [firstOh, ...restOh] = openHouseRows(openHouses)
  const [firstAct, ...restAct] = activityRows(activityItems)
  const [firstGuide, ...restGuide] = [
    ...areaGuideRow(cityName, areaGuideVideo),
    ...articleRows(articlePosts),
  ]

  const cityContent = getCityContent(cityName)
  const quickFacts = CITY_QUICK_FACTS[cityName] ?? null
  const description = cityContent?.description?.trim()
  const aboutItems = cityAboutItems(description, quickFacts)

  const exploreItems = cityExploreItems(
    cityName,
    slug,
    { browse: homesForSalePath(cityName), valuation: valuationHref(`/cities/${slug}`) },
    Boolean(quickFacts?.population),
  )

  const citySchemas = buildCitySchemas({
    cityName,
    slug,
    faq: marketFaq,
    hasMap: fieldItems.some((item) => item.lat != null && item.lng != null),
  })

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

        {stagePosterSrc ? (
          <>
            <V3Breadcrumb
              tone="on-media"
              trail={[{ label: 'Home', href: '/' }, { label: 'Cities', href: '/cities' }, { label: cityName }]}
            />
            <V3Stage
              id="place"
              headingLevel={1}
              height="tall"
              eyebrow={`${cityName} · Oregon`}
              headline={`${cityName} homes for sale`}
              posterSrc={stagePosterSrc}
              action={{
                label: fieldItems[0]?.title || `See ${cityName} homes`,
                href: fieldItems[0]?.href || '#homes',
              }}
            />
          </>
        ) : (
          <V3Breadcrumb
            trail={[{ label: 'Home', href: '/' }, { label: 'Cities', href: '/cities' }, { label: cityName }]}
          />
        )}

        <CityHomesField
          cityName={cityName}
          headline={v3Text(`${cityName} homes for sale`)}
          ownsHeading={!stagePosterSrc}
          fieldItems={fieldItems}
          tilesLength={tiles.length}
          caption={fieldCaption}
          source={cityFaceFieldTrace(cityName)}
          seeAll={{
            href: homesForSalePath(cityName),
            label: `See every ${cityName} home for sale`,
          }}
        />

        <CityAlertSheet cityName={cityName} />

        {firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text(`${cityName} · The market`)}
            headline={v3Text(marketHeadline)}
            note={verdictSentence ? v3Text(verdictSentence) : undefined}
            figures={[firstMarketFigure, ...restMarketFigures]}
            source={v3Text(cityFaceMarketTrace(cityName, mosLabel != null))}
            chart={medianChart}
            chartFirst
            updated={hudStamp ? v3Text(formatDate(hudStamp)) : undefined}
            action={{
              label: v3Text(`See every ${cityName} home for sale`),
              href: homesForSalePath(cityName),
              variant: 'ghost',
            }}
          />
        ) : (
          <V3Quiet
            id="market"
            heading={`The ${cityName} market`}
            items={cityFaceAbsenceItems(cityName, Boolean(fieldItems.length))}
          />
        )}

        {firstNbh ? (
          <V3Ledger
            id="neighborhoods"
            eyebrow={v3Text(`${cityName} · Neighborhoods`)}
            heading={v3Text('Neighborhoods')}
            rows={[firstNbh, ...restNbh]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{
              label: v3Text(`All ${cityName} homes`),
              href: homesForSalePath(cityName),
            }}
          />
        ) : null}

        {aboutItems.length > 0 ? (
          <V3Quiet
            id="about"
            eyebrow={`${cityName}, Oregon`}
            heading={`${cityName}, in plain words`}
            items={aboutItems}
          />
        ) : null}

        {firstRail ? (
          <V3Ledger
            id="communities"
            eyebrow={v3Text(`${cityName} · Communities`)}
            heading={v3Text('Communities and subdivisions')}
            rows={[firstRail, ...restRail]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text('Every community'), href: '/communities' }}
          />
        ) : null}

        {firstGolf ? (
          <V3Ledger
            id="communities-ledger"
            eyebrow={v3Text(`${cityName} · Communities`)}
            heading={v3Text('Golf and master-planned communities')}
            rows={[firstGolf, ...restGolf]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text('Every community'), href: '/communities' }}
          />
        ) : null}

        {firstAct ? (
          <V3Ledger
            id="activity"
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
            eyebrow={v3Text(`This week · ${cityName}`)}
            heading={v3Text('Open houses you can walk through')}
            rows={[firstOh, ...restOh]}
            source={v3Text(OPEN_HOUSE_TRACE)}
            action={{ label: v3Text(`Every open house in ${cityName}`), href: `/open-houses/${slug}` }}
          />
        ) : null}

        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading={`Questions about ${cityName}`}
          items={faqs.map((item) => ({ kind: 'prose' as const, term: item.question, body: item.answer }))}
        />

        {firstGuide ? (
          <V3Ledger
            id="guides"
            eyebrow={v3Text('Guides and news')}
            heading={v3Text(`${cityName} guides`)}
            rows={[firstGuide, ...restGuide]}
            action={{ label: v3Text('Every guide'), href: '/blog' }}
          />
        ) : null}

        <V3Quiet id="explore" eyebrow={`${cityName} · Explore`} heading="Where to next" items={exploreItems} />

        {firstOther ? (
          <V3Ledger
            id="nearby"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Explore other cities')}
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
