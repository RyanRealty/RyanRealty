// brand-voice:exempt
/**
 * Cities index — A–Z directory of Central Oregon cities.
 *
 * PAGE_INVENTORY §3: live counts on the rows, doors. Not a mini-Bend KPI
 * Instrument. The region's months of supply is DRAWN above the rows as
 * V3Drawing's two bars (homes for sale against a month of sales); the caption
 * under the heading names the directory, not the figure.
 *
 * SITE-52 (taste table 2026-09-08, /cities scored 30). Every row draws its
 * count as a bar on the list's shared scale; a hover, a focus, or a hold shows
 * the city's months-of-supply verdict where Market Truth publishes one and the
 * last twelve complete months of closed detached sales as a line; every row
 * carries a photo or the glyph; no row repeats "Oregon"; and a city whose
 * count no source published says so instead of "None listed now".
 *
 * SITE-69: the region pair sits on a labeled 4 / 6 threshold scale
 * (V3MosCompare); a searchable city overlay compares one city's reading to
 * the region (beui:combobox); no-photo rows carry a resting supply reading
 * when Market Truth publishes one.
 *
 * SITE-92: Atlas + InsightCards + MOS + combobox + alerts sentence.
 * SITE-161: the INDEX opens as a directory of cities (photo + name + live
 * count) in the first viewport. Atlas stays the drawing. MOS may stay but
 * cannot be the only object. Catalog: beui infinite-masonry + beui-number
 * on the cards; beui combobox stays the city overlay.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/cities/parity.json
 */

import { valuationHref } from '@/lib/site/valuation-href'
import type { Metadata } from 'next'
import { getCitiesForIndex } from '@/app/actions/cities'
import { sortCitiesWithPrimaryFirst } from '@/lib/cities'
import { getAllCitySnapshots, getBoundaryGeoJSON, getListingTiles } from '@/lib/data'
import { getDetachedOverlays, type DetachedOverlay } from '@/lib/data/market-truth/getSellBendMarket'
import { getPublicDetachedMonthly, type PublicMonthlyPoint } from '@/lib/data/market-truth/public-monthly'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { getCityContent } from '@/lib/city-content'
import { cityHero, preferPlaceHero } from '@/lib/geo-images'
import { runPublishedPageRender } from '@/lib/site/degraded-isr'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { formatCount } from '@/lib/format/count'
import { formatDate, formatMonthYear, zonedDateKey } from '@/lib/format/date'
import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'
import { formatIndexMedianUsd } from '@/lib/market/publish-index-median'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { buildAnswerFigures, salesPerMonthFrom } from '@/lib/site/answer-figures'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3Atlas,
  V3Breadcrumb,
  V3Drawing,
  V3Footer,
  V3Ledger,
  V3MosCompare,
  V3Quiet,
  V3SectionTracker,
  V3_FOOTER_COLUMNS,
  V3_LEDGER_SPARK_MIN,
  V3_ROOT_CLASS,
  v3Text,
  type AtlasRegion,
  type V3LedgerFigureRow,
  type V3LedgerReveal,
  type V3MosCompareCity,
  type V3QuietItem,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import { CitiesInsight } from '@/app/cities/_v3/CitiesInsight.client'
import { CitiesAlertsStrip } from '@/app/cities/_v3/CitiesAlerts.client'
import { CitiesDirectory } from '@/app/cities/_v3/CitiesDirectory'
import {
  buildCitiesInsightBoard,
  citiesInsightDatasetVariables,
  citiesInsightPageCount,
} from '@/app/cities/_v3/cities-insight'
import { HomeHomesRails } from '@/app/_v3/HomeHomesRails'
import { homeRailRows } from '@/app/_v3/home-rail-items'
import { homeRailItemList } from '@/app/_v3/home-jsonld'
import { REGIONAL_SEARCH_HREF } from '@/lib/search/publish-regional-search-href'
import '@/app/cities/_v3/cities-fold.css'
import { cityFeaturedLinks } from '@/app/cities/CityFeaturedLinks'
import {
  CITY_SENTENCE_FALLBACK,
  FEATURED_CITY_SLUGS,
  NO_LIVE_COUNT_LABEL,
  firstSentence,
  indexBarWeight,
  liveForSaleLabel,
} from '@/app/cities/_v3/cities-index-constants'
import { restingCityDetail } from '@/app/cities/_v3/cities-index-resting'
import type { SchemaInput } from '@/lib/site/json-ld'

export const revalidate = 3600

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Central Oregon cities: live inventory in Bend, Redmond, Sisters',
  description:
    'Active single-family homes in Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and the rest of Central Oregon. Live inventory, months of supply, and priced listings from the regional MLS.',
  path: '/cities',
})

const FEATURED_TRACE =
  'live MLS through Oregon Data Share, active single-family listings in each city. The median is the list price of those same listings, and the verdict is the months-of-supply reading behind it'

const OTHERS_TRACE =
  'live MLS through Oregon Data Share, the city snapshot row for each remaining Central Oregon city: active single-family count and the median list price of those listings'

const REVEAL_TRACE =
  'On hover, focus, or a hold, a row shows its months-of-supply verdict where Market Truth publishes one for the city (market_metric, detached, months_of_supply and market_verdict), and the last twelve complete months of closed detached sales as a line (market_metric closed_count, detached, one calendar month each); a month the source withheld breaks the line, and fewer than six published months draws none'

const REGION_SUPPLY_TRACE =
  'Market Truth, detached homes across Central Oregon (market_metric, definition mt-v1, segment detached, region central-oregon): active_count, and months_of_supply as homes for sale divided by closes in the last six months divided by six. The monthly pace drawn here is that division recovered exactly from the two published figures'

/** The twelve complete months a row's run covers. */
const REVEAL_MONTHS = 12

function fmtMedian(n: number | null | undefined): string | null {
  return formatIndexMedianUsd(n)
}

/**
 * What a row reveals, from what the sources published for it. The verdict line
 * only where Market Truth assembled a publishable months-of-supply reading;
 * an honest line where it published inventory but withheld the reading; the
 * run only when at least V3_LEDGER_SPARK_MIN of the twelve months published.
 * A city with nothing published reveals nothing, and the band stays empty.
 */
function cityReveal(layers: DetachedOverlay | undefined, months: readonly PublicMonthlyPoint[]): V3LedgerReveal | undefined {
  const headlines = layers?.headlines ?? null
  // marketVerdict() labels read "seller's market"; the line opens a sentence.
  const verdict = headlines ? headlines.verdictLabel.charAt(0).toUpperCase() + headlines.verdictLabel.slice(1) : null
  const line = headlines
    ? `${verdict} · ${headlines.mosLabel} months of supply`
    : layers?.inventory
      ? 'No published months-of-supply reading for this city'
      : null
  const window = months.slice(-REVEAL_MONTHS)
  const series = window.map((m) => m.closedCount)
  const published = series.filter((v) => v != null).length
  const drawRun = window.length === REVEAL_MONTHS && published >= V3_LEDGER_SPARK_MIN
  if (!line && !drawRun) return undefined
  const first = window[0]
  const last = window[window.length - 1]
  return {
    line: v3Text(line ?? 'Closed sales by month'),
    ...(drawRun && first && last
      ? {
          series,
          seriesLabel: v3Text(`Closes by month, ${formatMonthYear(first.periodStart)} to ${formatMonthYear(last.periodStart)}`),
        }
      : {}),
  }
}

export default async function CitiesPage() {
  return runPublishedPageRender('cities', renderCitiesIndex)
}

async function renderCitiesIndex() {
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [allCities, allSnapshots, regionMonthly, regionPace, atlasPop, listingTiles] = await Promise.all([
    getCitiesForIndex(),
    getAllCitySnapshots(),
    withTimeoutFallback(
      getPublicDetachedMonthly({ geoType: 'region', geoSlug: 'central-oregon', currentMonthKey }),
      [],
      3500,
      'cities:regionMonthly',
    ),
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'region', geoSlug: 'central-oregon' }),
      EMPTY_PUBLIC_PACE,
      3000,
      'cities:regionPace',
    ),
    withTimeoutFallback(
      buildPlaceAtlas({ cities: [], label: 'Central Oregon' }),
      EMPTY_PLACE_ATLAS,
      5000,
      'cities:atlas',
    ),
    withTimeoutFallback(getListingTiles({ propertyType: 'A', limit: 36 }), [], 4000, 'cities:tiles'),
  ])

  const sortedCities = sortCitiesWithPrimaryFirst(allCities)
  const visibleCities = sortedCities.slice(0, 60)
  const directorySlugs = [...new Set<string>([...FEATURED_CITY_SLUGS, ...visibleCities.map((c) => c.slug)])]

  // One Market Truth read for the region and every city on the page, and one
  // monthly read per city for the run under its row. Both are timeboxed: a
  // slow read costs the drawing and the reveals, never the directory.
  const [overlays, monthlyBySlug, cityBoundaries] = await Promise.all([
    withTimeoutFallback(
      getDetachedOverlays([
        { geoType: 'region', geoSlug: 'central-oregon' },
        ...directorySlugs.map((slug) => ({ geoType: 'city' as const, geoSlug: slug })),
      ]),
      new Map<string, DetachedOverlay>(),
      3500,
      'cities:leftoverOverlays',
    ),
    withTimeoutFallback(
      Promise.all(
        directorySlugs.map(
          async (slug) =>
            [slug, await getPublicDetachedMonthly({ geoType: 'city', geoSlug: slug, currentMonthKey })] as const,
        ),
      ).then((pairs) => new Map<string, PublicMonthlyPoint[]>(pairs)),
      new Map<string, PublicMonthlyPoint[]>(),
      4500,
      'cities:monthlyRuns',
    ),
    withTimeoutFallback(
      Promise.all(
        FEATURED_CITY_SLUGS.map(async (slug) => {
          const geometry = await getBoundaryGeoJSON({ geoType: 'city', geoSlug: slug })
          return geometry ? { slug, geometry } : null
        }),
      ),
      [] as Array<{ slug: string; geometry: NonNullable<Awaited<ReturnType<typeof getBoundaryGeoJSON>>> } | null>,
      5000,
      'cities:boundaries',
    ),
  ])
  const regionMt = overlays.get('region:central-oregon')
  const hud = leftoverHudKpis({
    grain: 'region',
    headlines: regionMt?.headlines ?? null,
    inventory: regionMt?.inventory ?? null,
    pace: regionPace,
  })

  const snapshotBySlug = new Map<string, { activeCount: number | null; medianPrice: number | null }>()
  for (const s of allSnapshots) {
    snapshotBySlug.set(s.geoKey.replace(/\s+/g, '-'), {
      activeCount: s.activeSfrCount,
      medianPrice: s.medianListPrice != null ? Math.round(s.medianListPrice) : null,
    })
  }

  const cityNameBySlug = new Map(visibleCities.map((c) => [c.slug, c.name]))

  const featured = FEATURED_CITY_SLUGS.filter(
    (slug) => cityNameBySlug.has(slug) || snapshotBySlug.has(slug) || overlays.has(`city:${slug}`),
  ).map((slug) => {
    const name =
      cityNameBySlug.get(slug) ??
      slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const layers = overlays.get(`city:${slug}`)
    const indexRow = allCities.find((c) => c.slug === slug)
    // Market Truth first, then the snapshot row, then the index's own count.
    // Until SITE-52 a featured city with no Market Truth row (Tumalo, Crooked
    // River Ranch) went null here, printed as "None listed now", and switched
    // the bars off for the whole list.
    const leftoverActive =
      layers?.headlines?.activeCount ??
      layers?.inventory?.activeCount ??
      snapshotBySlug.get(slug)?.activeCount ??
      indexRow?.activeCount ??
      null
    const leftoverMedian =
      layers?.headlines?.medianListPrice ??
      layers?.inventory?.medianListPrice ??
      snapshotBySlug.get(slug)?.medianPrice ??
      indexRow?.medianPrice ??
      null
    const content = getCityContent(name)
    const sentence = content?.description
      ? firstSentence(content.description)
      : CITY_SENTENCE_FALLBACK[slug] ?? null
    const fallbackHero = cityHero(slug)
    const liveHero = indexRow?.heroImageUrl
    const src = preferPlaceHero(liveHero, fallbackHero.src)
    return {
      slug,
      name,
      hero: {
        ...fallbackHero,
        src,
        verified: Boolean(liveHero?.trim()) || fallbackHero.verified,
      },
      sentence,
      activeCount: leftoverActive,
      medianListPrice: leftoverMedian,
    }
  })

  const featuredSlugs = new Set<string>(featured.map((f) => f.slug))
  const others = visibleCities.filter((c) => featuredSlugs.has(c.slug) === false)

  const ledgerSlugs = new Set<string>([...featuredSlugs, ...others.map((c) => c.slug)])
  const ledgerRowStamps = allSnapshots
    .filter((s) => ledgerSlugs.has(s.geoKey.replace(/\s+/g, '-')))
    .map((s) => s.refreshedAt)
    .filter((s): s is string => Boolean(s))
  const ledgerStamp = ledgerRowStamps.length > 0
    ? ledgerRowStamps.reduce((oldest, cur) => (cur < oldest ? cur : oldest))
    : null

  const totalActive: number | null = hud.active
  const leftoverStamp = regionMt?.headlines?.computedAt ?? regionMt?.inventory?.computedAt ?? null
  const pulse: MarketFaqInput | null = {
    grain: 'region',
    source: 'market-truth',
    activeCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: hud.monthsSupply,
    medianDaysToPending: hud.daysToPending,
    soldCount12mo: null,
    pulseActiveCount: hud.active,
    refreshedAt: leftoverStamp,
  }
  const latestSnapshotAt = allSnapshots.reduce<string | null>(
    (latest, s) => (latest == null || s.refreshedAt > latest ? s.refreshedAt : latest),
    null,
  )
  const regionFaqInput: MarketFaqInput = pulse ?? { grain: 'region', activeCount: totalActive, refreshedAt: latestSnapshotAt }
  const {
    datasetVariables: regionDatasetVars,
    asOfIso: regionAsOfIso,
    faqs: regionFaqs,
  } = buildMarketFaq('Central Oregon', regionFaqInput)

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
      ],
    },
  ]

  if (regionDatasetVars.length > 0) {
    schemas.push({
      type: 'dataset',
      name: `Central Oregon cities, Oregon real estate market statistics${regionAsOfIso ? `, ${regionAsOfIso}` : ''}`,
      description:
        'Live single-family home market data across Central Oregon cities. Includes region active inventory, ' +
        'median list price, and months of supply. Sourced from Oregon Data Share via Ryan Realty.',
      url: '/cities',
      dateModified: regionAsOfIso ?? undefined,
      spatialCoverageName: 'Central Oregon, OR',
      variableMeasured: regionDatasetVars,
    })
  }

  if (regionFaqs.length > 0) {
    schemas.push({ type: 'faqPage', items: regionFaqs })
  }

  const directory: Array<{
    slug: string
    name: string
    sentence: string | null
    activeCount: number | null
    medianListPrice: number | null
    mediaSrc: string | undefined
  }> = [
    ...featured.map((city) => ({
      slug: city.slug,
      name: city.name,
      sentence: city.sentence,
      activeCount: city.activeCount,
      medianListPrice: city.medianListPrice,
      mediaSrc: city.hero.verified ? city.hero.src : undefined,
    })),
    ...others.map((city) => {
      const snap = snapshotBySlug.get(city.slug)
      return {
        slug: city.slug,
        name: city.name,
        sentence: null as string | null,
        activeCount: snap ? snap.activeCount : city.activeCount,
        medianListPrice: snap ? snap.medianPrice : city.medianPrice,
        mediaSrc: undefined as string | undefined,
      }
    }),
  ].sort((a, b) => a.name.localeCompare(b.name))

  const publishedCounts = directory.map((row) => row.activeCount).filter((n): n is number => n != null)
  const maxCount = publishedCounts.length > 0 ? Math.max(...publishedCounts) : 0
  // The bars draw whenever any city published a count; a city with none gets
  // no bar and says so, rather than switching the encode off for everyone.
  const countsPublishable = maxCount > 0

  const figureRows: V3LedgerFigureRow[] = directory.map((city) => {
    const median = fmtMedian(city.medianListPrice)
    const layers = overlays.get(`city:${city.slug}`)
    const headlines = layers?.headlines ?? null
    const restingSupply = headlines
      ? `${headlines.verdictLabel.charAt(0).toUpperCase()}${headlines.verdictLabel.slice(1)} · ${headlines.mosLabel} months`
      : null
    const detail = restingCityDetail({
      medianLine: median ? `Median list ${median}` : null,
      sentence: city.sentence,
      hasPhoto: Boolean(city.mediaSrc),
      restingSupply,
    })
    return {
      id: city.slug,
      href: `/cities/${city.slug}`,
      what: v3Text(city.name),
      detail: detail ? v3Text(detail) : undefined,
      value: v3Text(city.activeCount != null ? liveForSaleLabel(city.activeCount) : NO_LIVE_COUNT_LABEL),
      weight: indexBarWeight(city.activeCount, maxCount),
      media: city.mediaSrc ? { src: city.mediaSrc } : undefined,
      reveal: cityReveal(layers, monthlyBySlug.get(city.slug) ?? []),
      ariaLabel: v3Text(`Homes for sale in ${city.name}, Oregon`),
    }
  })
  const [firstFeatured, ...restFeatured] = figureRows

  const cityDoors: V3QuietItem[] = featured.flatMap((city) =>
    cityFeaturedLinks(city.slug, city.name),
  )

  // The region's months of supply as the two-bar drawing, from the same two
  // published figures the old sentence quoted. G68: formatted and classified
  // here, on the server, from one raw value; nothing downstream re-rounds it.
  const mosText = hud.monthsSupply != null ? formatMonthsOfSupply(hud.monthsSupply) : null
  const regionVerdict = monthsOfSupplyVerdict(hud.monthsSupply)
  const regionFigures = buildAnswerFigures({
    placeLabel: 'Central Oregon',
    street: '',
    monthsOfSupply: mosText,
    verdictLabel: regionVerdict?.label ?? null,
    activeCount: hud.active,
    salesPerMonth: salesPerMonthFrom(hud.active, hud.monthsSupply),
    daysToPending: null,
    cityDaysToPending: null,
    cityLabel: null,
    compMarks: [],
    compCount: null,
    subjectFound: false,
    subjectSummary: null,
    asOfLabel: leftoverStamp ? formatDate(leftoverStamp) : null,
    sources: { supply: REGION_SUPPLY_TRACE },
    unmatchedSentence: '',
  })
  const compareCities: V3MosCompareCity[] = directory.map((city) => {
    const headlines = overlays.get(`city:${city.slug}`)?.headlines ?? null
    return {
      slug: city.slug,
      name: city.name,
      mos: headlines?.monthsOfSupply ?? null,
      mosLabel: headlines?.mosLabel ?? null,
      verdictLabel: headlines?.verdictLabel
        ? `${headlines.verdictLabel.charAt(0).toUpperCase()}${headlines.verdictLabel.slice(1)}`
        : null,
      activeLabel: city.activeCount != null ? liveForSaleLabel(city.activeCount) : null,
    }
  })

  const regionScale =
    hud.monthsSupply != null && mosText && regionVerdict ? (
      <V3MosCompare
        regionLabel="Central Oregon"
        regionMos={hud.monthsSupply}
        regionMosLabel={mosText}
        regionVerdict={regionVerdict.label}
        cities={compareCities}
        source={REGION_SUPPLY_TRACE}
      />
    ) : null

  const regionBars =
    regionFigures.length > 0 ? (
      <V3Drawing figures={regionFigures} label="Central Oregon homes for sale against a month of sales" />
    ) : null
  const regionDrawing = regionBars || regionScale

  const insightBoard = buildCitiesInsightBoard({
    monthly: regionMonthly,
    cities: directory.map((city) => ({
      slug: city.slug,
      name: city.name,
      activeCount: city.activeCount,
    })),
  })
  const showInsight = citiesInsightPageCount(insightBoard) >= 2
  if (showInsight) {
    const insightVars = citiesInsightDatasetVariables(insightBoard)
    if (insightVars.length > 0) {
      schemas.push({
        type: 'dataset',
        name: 'Central Oregon cities, closed-sale months and city inventory mix',
        description:
          'Median close price and closing counts by month for Central Oregon, plus each published city\'s share of live single-family inventory.',
        url: '/cities',
        variableMeasured: insightVars,
      })
    }
  }

  const atlasRegions: AtlasRegion[] = cityBoundaries
    .filter((row): row is NonNullable<(typeof cityBoundaries)[number]> => row != null)
    .map((row) => ({
      id: `city:${row.slug}`,
      kind: 'town' as const,
      kindLabel: 'City',
      name:
        cityNameBySlug.get(row.slug) ??
        row.slug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
      href: `/cities/${row.slug}`,
      geometry: row.geometry,
    }))
  const showAtlas = atlasPop.dots.length > 0 || atlasRegions.length > 0

  const foldCities = featured
    .filter(
      (city) =>
        Boolean(city.hero.verified && city.hero.src) &&
        city.activeCount != null &&
        city.activeCount > 0,
    )
    .slice(0, 6)
    .map((city) => ({
      slug: city.slug,
      name: city.name,
      href: `/cities/${city.slug}`,
      photoSrc: city.hero.src,
      photoAlt: city.hero.alt,
      count: city.activeCount != null && city.activeCount > 0 ? city.activeCount : null,
      countLabel:
        city.activeCount != null && city.activeCount > 0
          ? formatCount(city.activeCount)
          : city.activeCount === 0
            ? 'None listed now'
            : NO_LIVE_COUNT_LABEL,
      share: indexBarWeight(city.activeCount, maxCount),
    }))

  const railRows = homeRailRows(listingTiles, {
    nowMs: Date.now(),
    regionalHref: REGIONAL_SEARCH_HREF,
    bendHref: '/cities/bend',
    priceCutsHref: '/price-drops',
    newHref: '/search?sort=newest',
  })
  const listingItemList = homeRailItemList(railRows)
  // When the drawing cannot be drawn, the note carries the figure as before.
  const directoryNote = regionDrawing
    ? `${formatCount(directory.length)} cities, A to Z.`
    : mosText && regionVerdict
      ? `${regionVerdict.label} at ${mosText} months of supply.`
      : ''

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />

        <MetadataBlock schemas={schemas} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: 'Central Oregon cities',
              description: 'Active single-family homes in Bend, Redmond, Sisters, and the rest of Central Oregon. Live inventory from the regional MLS.',
              url: `${siteUrl}/cities`,
              publisher: { '@type': 'Organization', name: 'Ryan Realty' },
              mainEntity: {
                '@type': 'ItemList',
                itemListElement: directory.map((c, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  name: `${c.name}, Oregon`,
                  url: `${siteUrl}/cities/${c.slug}`,
                })),
              },
            }),
          }}
        />

        {listingItemList ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(listingItemList) }}
          />
        ) : null}

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Cities' }]} />

        <section className="cities-fold" aria-labelledby="cities-fold-title">
          <header className="cities-fold__head">
            <p className="cities-fold__eyebrow">Central Oregon</p>
            <h1 id="cities-fold-title" className="cities-fold__title">
              Central Oregon cities
            </h1>
            <p className="cities-fold__note">
              {directoryNote || 'Live single-family inventory from the regional MLS.'}{' '}
              {hud.active != null
                ? `${formatCount(hud.active)} detached single-family homes for sale.`
                : ''}
            </p>
          </header>
          <div className="cities-fold__stage">
            {foldCities.length > 0 ? (
              <div className="cities-fold__directory" id="city-directory">
                <CitiesDirectory cities={foldCities} source={FEATURED_TRACE} />
              </div>
            ) : null}
            {showAtlas ? (
              <div className="cities-fold__drawing">
                <V3Atlas
                  id="atlas"
                  headingLevel={2}
                  headline={v3Text('Cities on the map')}
                  headlineTone="eyebrow"
                  claimText={
                    atlasPop.counts.forSale > 0
                      ? `${formatCount(atlasPop.counts.forSale)} homes of every type for sale on this map.`
                      : 'Homes of every type for sale across the cities on this list.'
                  }
                  keyPlacement="head"
                  sourceName="Oregon Data Share"
                  dots={atlasPop.dots}
                  regions={atlasRegions}
                  types={atlasPop.types}
                  events={atlasPop.events}
                  source={atlasPop.source}
                  stamp={atlasPop.stamp}
                  incomplete={!atlasPop.complete}
                />
              </div>
            ) : null}
            <aside className="cities-fold__figure">
              {regionScale}
              <CitiesAlertsStrip
                newCount30d={hud.new30}
                updatedAt={leftoverStamp}
              />
              {regionBars}
            </aside>
          </div>
        </section>

        {railRows.length > 0 ? (
          <div className="cities-fold__homes">
            <HomeHomesRails
              rows={railRows}
              emptyMessage="No photographed homes with a published price on this refresh."
            />
          </div>
        ) : null}

        {showInsight ? <CitiesInsight board={insightBoard} /> : null}

        {firstFeatured ? (
          <V3Ledger
            id="featured-cities"
            headingLevel={2}
            eyebrow={v3Text('A to Z')}
            heading={v3Text('Every city')}
            note={v3Text(
              directoryNote || 'Live single-family inventory from the regional MLS.',
            )}
            rows={[firstFeatured, ...restFeatured]}
            encode={countsPublishable ? 'bar' : undefined}
            source={v3Text(FEATURED_TRACE + '. Remaining cities: ' + OTHERS_TRACE + '. ' + REVEAL_TRACE)}
            updated={ledgerStamp ? v3Text(formatDate(ledgerStamp)) : undefined}
            action={{ label: v3Text('Search all listings'), href: '/search', variant: 'primary' }}
          />
        ) : (
          <V3Ledger
            id="featured-cities"
            headingLevel={1}
            heading={v3Text('Central Oregon cities')}
            rows={[]}
            emptyMessage={v3Text('The city index returned no city on this refresh.')}
          />
        )}

        {cityDoors.length > 0 ? (
          <V3Quiet
            id="city-doors"
            eyebrow="Straight to the listings"
            heading="Every city, every door"
            items={cityDoors}
          />
        ) : null}

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        <V3Quiet
          id="edges"
          eyebrow="Central Oregon"
          heading="Search every listing in Central Oregon"
          items={[
            { label: 'Search all listings', href: '/search' },
            { label: 'Value my home', href: valuationHref('/cities') },
            { label: 'Communities', href: '/communities' },
            { label: 'Neighborhoods', href: '/neighborhoods' },
            { label: 'Subdivisions', href: '/subdivisions' },
            { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
          ]}
          note="Filter by price, beds, and location across every city on the list. Oregon Data Share is the regional MLS cooperative behind the live listing and market data on this page."
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
