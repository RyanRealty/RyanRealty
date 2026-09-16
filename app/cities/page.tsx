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
 * SITE-92 round 5 (judged 63 on sixteen plates): the doors per featured city
 * are a DOOR BOARD (V3DoorBoard) — photograph or drawn outline, the city's
 * live count as the installed digit primitive, its doors each with the count
 * it opens onto — not thirty Quiet rows; the alerts sheet stands on the
 * region's real 30-day count and the towns drawn as a strip of marks
 * (V3PlaceStrip in the Sheet's figure slot); the close is one figured door
 * carrying the region's live total plus one light line of place types, not a
 * second link list; the ledger's counts are live numerals (beui:number), its
 * head sets the supply drawing beside the words, and its reveal run is
 * scrubbable — hover, drag or arrow keys name the nearest month and its count.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/cities/parity.json
 */

import { valuationHref } from '@/lib/site/valuation-href'
import type { Metadata } from 'next'
import { getCitiesForIndex } from '@/app/actions/cities'
import { sortCitiesWithPrimaryFirst } from '@/lib/cities'
import { getAllCitySnapshots } from '@/lib/data'
import { getDetachedOverlays, type DetachedOverlay } from '@/lib/data/market-truth/getSellBendMarket'
import { getPublicDetachedMonthly, type PublicMonthlyPoint } from '@/lib/data/market-truth/public-monthly'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'
import { getCityContent } from '@/lib/city-content'
import { cityHero, preferPlaceHero } from '@/lib/geo-images'
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
  V3Breadcrumb,
  V3DoorBoard,
  V3Drawing,
  V3Footer,
  V3Ledger,
  V3PlaceMark,
  V3Quiet,
  V3SectionTracker,
  V3_FOOTER_COLUMNS,
  V3_LEDGER_SPARK_MIN,
  V3_ROOT_CLASS,
  v3Text,
  type V3DoorBoardTile,
  type V3LedgerFigureRow,
  type V3LedgerReveal,
  type V3LedgerScale,
  type V3MosCompareCity,
  type V3PlaceStripPlace,
  type V3QuietItem,
} from '@/components/site/v3'
import { CitiesMosCompare } from './_v3/CitiesMosCompare.client'
import { silhouetteTile } from '@/lib/atlas/silhouette-tile'
import { getPlacePhotoStrip } from '@/lib/place-photos'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import { V3Atlas, V3Eyebrow, V3Heading } from '@/components/site/v3'
import { basemapForRegions } from '@/lib/geo/basemap-source'
import { buildRegionAtlasRegions } from '@/app/_v3/region-atlas'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { REGIONAL_SEARCH_HREF } from '@/lib/search/publish-regional-search-href'
import { CitiesAlertsStrip } from './_v3/CitiesAlertsStrip.client'
import { countBendLuxury, countOpenHousesByCity } from './_v3/cities-doors'
import {
  LUXURY_DOOR_TRACE,
  OPEN_HOUSE_DOOR_TRACE,
  leadTileId,
  luxuryDoorFigure,
  openHouseDoorFigure,
  tileFigure,
} from './_v3/cities-door-figures'
import './_v3/cities-fold.css'
import { cityFeaturedLinks } from '@/app/cities/CityFeaturedLinks'
import {
  CITY_SENTENCE_FALLBACK,
  FEATURED_CITY_SLUGS,
  INDEX_BAR_SCALE_NOTE,
  NO_LIVE_COUNT_LABEL,
  firstSentence,
  indexBarTicks,
  indexBarWeight,
  liveForSaleLabel,
} from '@/app/cities/_v3/cities-index-constants'
import { restingCityDetail } from '@/app/cities/_v3/cities-index-resting'
import type { SchemaInput } from '@/lib/site/json-ld'

export const revalidate = 3600

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Central Oregon cities: Bend, Redmond, Sisters',
  description:
    'Active single-family homes in Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and the rest of Central Oregon. Live inventory and pricing from the regional MLS.',
  path: '/cities',
})

const FEATURED_TRACE =
  'live MLS through Oregon Data Share, active single-family listings in each city. The median is the list price of those same listings, and the verdict is the months-of-supply reading behind it'

const OTHERS_TRACE =
  'live MLS through Oregon Data Share, the city snapshot row for each remaining Central Oregon city: active single-family count and the median list price of those listings'

const REVEAL_TRACE =
  'On hover, focus, or a hold, a row shows its months-of-supply verdict where our market metric layer publishes one for the city — regional MLS through Oregon Data Share, detached homes (market_metric: months_of_supply and market_verdict), and the last twelve complete months of closed detached sales as a line (market_metric closed_count, detached, one calendar month each) with the window\'s first and last month named under it and the last published month\'s count beside the endpoint; a month the source withheld breaks the line, and fewer than six published months draws none. A hover or a drag across the run, or the arrow keys on a focused row, name the nearest published month and its count beside it. The bars are on a square-root scale of each city\'s share of the largest count, said on the drawing; the figure beside each bar is the count'

/**
 * The ledger's note (SITE-92 round 5). The count and the A-to-Z are already
 * the H1's caption and the heading; the note says what a row does instead of
 * restating them a third time.
 */
const LEDGER_NOTE =
  'Every row is a door to the city\'s own page. Hover, focus or hold a row for its supply reading and its last twelve months of closes; the bar is its live single-family count.'

/** The door board's one sentence: what its figures count, and where each door's count comes from. */
const DOOR_BOARD_LEDE =
  'Each featured city with its live single-family count — the figure its row above prints, and what its guide and its homes open onto — then its doors: the guide, the homes, this week\'s open houses, and for Bend the homes at $1.5M and up, each with the count it opens onto where the calendar or the search published one.'

/** The board's §0 trace: the tile figures are the ledger's; the door figures are the destination pages' own reads. */
const DOOR_BOARD_TRACE = `${FEATURED_TRACE}. ${OPEN_HOUSE_DOOR_TRACE}. ${LUXURY_DOOR_TRACE}`

/** The board tile's drawn mark is 3:2 like its photographs, with the ledger tile's margin. */
const DOOR_TILE_BOX = { w: 66, h: 44, pad: 5 } as const

const REGION_SUPPLY_TRACE =
  'Regional MLS through Oregon Data Share, read through our market metric layer — detached homes across Central Oregon (market_metric, definition mt-v1, segment detached, region central-oregon): active_count, and months_of_supply as homes for sale divided by closes in the last six months divided by six. The monthly pace drawn here is that division recovered exactly from the two published figures'

/**
 * The index draws marks, not the sales-heat wash: at region scale a year of
 * closings covered the town silhouettes and the evaluator read the frame as a
 * heatmap with floating labels (SITE-92 round two). One flag, handed to both
 * the population read (so its source line describes what is drawn) and the
 * Atlas (so nothing is drawn that the line does not describe).
 */
const INDEX_SALES_WASH = false

/**
 * Read budgets for the index's timeboxed reads, in ms. They were 6000 / 3500
 * / 3500 / 4500 and on the PR #252 CI server (b662c40bc, 07:57Z, the :00
 * listing_tile_mv refresh and a second PR's CI on the same database) every one
 * fired: the Atlas rendered with 0 items, the ledger with 13 rows and 276
 * words, the Place ItemList JSON-LD was gone — and `revalidate = 3600` cached
 * that render for an hour. The depth ratchet (contentFloor.sectionDepth) is
 * what caught it. A slow read still costs the drawing, never the directory;
 * these budgets just stop a cold, contended server from paying that price on
 * its first render. The mechanism that should make a degraded render
 * unpersistable is SITE-118's; until it lands, the budget is the fence.
 */
const INDEX_READ_BUDGET_MS = {
  atlas: 20_000,
  regionPace: 8_000,
  overlays: 10_000,
  monthlyRuns: 10_000,
  doors: 8_000,
} as const

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
  // The endpoint the line ends on is the last PUBLISHED month, which is the
  // window's last month unless the source withheld it; its label is that
  // month's own count, the same figure the last drawn point is.
  const lastPublished = [...window].reverse().find((m) => m.closedCount != null)
  return {
    line: v3Text(line ?? 'Closed sales by month'),
    ...(drawRun && first && last
      ? {
          series,
          seriesLabel: v3Text('Closed detached sales by month'),
          seriesEnds: {
            first: v3Text(formatMonthYear(first.periodStart)),
            last: v3Text(formatMonthYear(last.periodStart)),
          },
          ...(lastPublished?.closedCount != null ? { seriesLast: v3Text(formatCount(lastPublished.closedCount)) } : {}),
          // The scrub's readout (SITE-92 round 5): every month named, its
          // count as the reader should see it, null where the source withheld
          // the month — the run draws that month as a gap and names no point.
          points: window.map((m) => ({
            label: v3Text(formatMonthYear(m.periodStart)),
            value: m.closedCount != null ? v3Text(`${formatCount(m.closedCount)} closed`) : null,
          })),
        }
      : {}),
  }
}

export default async function CitiesPage() {
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  // THE FOLD IS A DRAWING AND A FIGURE (SITE-92, 2026-09-16; Matt: "my city
  // pages have to be special"). The table scored this index 30: a supply
  // lecture on cream with no Atlas, no city mark, no photo and no alerts. The
  // same three reads the About page and the community fold make: the region's
  // live listings for the Atlas dots, every recorded town boundary as a
  // touchable region, and the region's own 30-day count for the alerts
  // figure. Each is timeboxed — a slow read costs the drawing, never the
  // directory — and none is a second source for a figure the ledger prints.
  const [allCities, allSnapshots, atlasRead, regionAtlas, regionPace] = await Promise.all([
    getCitiesForIndex(),
    getAllCitySnapshots(),
    withTimeoutFallback(buildPlaceAtlas({ cities: [], label: 'Central Oregon', salesWash: INDEX_SALES_WASH }).catch(() => null), null, INDEX_READ_BUDGET_MS.atlas, 'cities:atlas'),
    buildRegionAtlasRegions().catch(() => null),
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'region', geoSlug: 'central-oregon' }),
      EMPTY_PUBLIC_PACE,
      INDEX_READ_BUDGET_MS.regionPace,
      'cities:regionPace',
    ),
  ])
  const atlas = atlasRead ?? EMPTY_PLACE_ATLAS
  // Towns only on the index — the community and neighborhood outlines belong
  // to the place pages; here every region is a city with its own page.
  const townRegions = (regionAtlas?.regions ?? []).filter((r) => r.kind === 'town')
  const atlasDrawable = townRegions.length > 0 || atlas.dots.length > 0

  const sortedCities = sortCitiesWithPrimaryFirst(allCities)
  const visibleCities = sortedCities.slice(0, 60)
  const directorySlugs = [...new Set<string>([...FEATURED_CITY_SLUGS, ...visibleCities.map((c) => c.slug)])]

  // One Market Truth read for the region and every city on the page, and one
  // monthly read per city for the run under its row. Both are timeboxed: a
  // slow read costs the drawing and the reveals, never the directory.
  const [overlays, monthlyBySlug, openHouseCounts, luxuryCount] = await Promise.all([
    withTimeoutFallback(
      getDetachedOverlays([
        { geoType: 'region', geoSlug: 'central-oregon' },
        ...directorySlugs.map((slug) => ({ geoType: 'city' as const, geoSlug: slug })),
      ]),
      new Map<string, DetachedOverlay>(),
      INDEX_READ_BUDGET_MS.overlays,
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
      INDEX_READ_BUDGET_MS.monthlyRuns,
      'cities:monthlyRuns',
    ),
    // THE DOORS' OWN COUNTS (SITE-92 round 5): what each door on the board
    // opens onto — the open-house calendar's count for this week per featured
    // city (the same read /open-houses/<city> makes) and Bend's count at the
    // luxury floor (the filter /luxury-homes-bend opens onto). Both timeboxed:
    // a slow read costs the door its figure, never the door.
    withTimeoutFallback(
      countOpenHousesByCity(FEATURED_CITY_SLUGS),
      new Map<string, number>(),
      INDEX_READ_BUDGET_MS.doors,
      'cities:openHouseDoors',
    ),
    withTimeoutFallback(
      countBendLuxury().then((n): number | null => n).catch((): number | null => null),
      null,
      INDEX_READ_BUDGET_MS.doors,
      'cities:luxuryDoor',
    ),
  ])
  const regionMt = overlays.get('region:central-oregon')
  const hud = leftoverHudKpis({
    grain: 'region',
    headlines: regionMt?.headlines ?? null,
    inventory: regionMt?.inventory ?? null,
    pace: EMPTY_PUBLIC_PACE,
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
  const { datasetVariables: regionDatasetVars, asOfIso: regionAsOfIso } = buildMarketFaq(
    'Central Oregon',
    regionFaqInput,
  )

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

  // A PHOTOGRAPH FOR THE ROWS THE REGISTRY DOES NOT COVER (SITE-92 round 4).
  // The remaining cities have no curated hero; the asset library may still
  // hold a graded photograph OF the place (approved, geo-tagged with the slug,
  // vision-graded A or B, captioned, unwatermarked, never a generated still —
  // lib/place-photos.ts). One frame per row, from the same rule the community
  // boards use. A city with none draws its recorded outline instead, below.
  const libraryPhotoBySlug = new Map<string, string>()
  await Promise.all(
    others.map(async (city) => {
      const frames = await getPlacePhotoStrip(city.slug, { limit: 1 }).catch(() => [])
      const src = frames[0]?.src
      if (src) libraryPhotoBySlug.set(city.slug, src)
    }),
  )
  // THE DRAWN FALLBACK: the town's recorded outline, the same boundary the
  // Atlas above draws it with, as the row's mark where there is no photograph.
  // A town with no recorded boundary gets the map's point mark — honest about
  // what is not recorded, never a letter and never a picture of somewhere else.
  const townGeometryBySlug = new Map<string, GeoJSON.Geometry>(
    townRegions.map((r) => [r.id.replace(/^town:/, ''), r.geometry] as const),
  )

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
        mediaSrc: libraryPhotoBySlug.get(city.slug),
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
      // The digits as the installed beUI number (beui:number, SITE-92 round
      // 5): the served face is the same figure `value` reads, and nothing
      // counts up on load; the digits move only if the count changes.
      numeral:
        city.activeCount != null && city.activeCount > 0
          ? { value: city.activeCount, formatted: v3Text(formatCount(city.activeCount)), rest: v3Text('for sale') }
          : undefined,
      weight: indexBarWeight(city.activeCount, maxCount),
      media: city.mediaSrc ? { src: city.mediaSrc } : undefined,
      mark: city.mediaSrc ? undefined : <V3PlaceMark silhouette={silhouetteTile(townGeometryBySlug.get(city.slug))} />,
      reveal: cityReveal(layers, monthlyBySlug.get(city.slug) ?? []),
      ariaLabel: v3Text(`Homes for sale in ${city.name}, Oregon`),
    }
  })
  const [firstFeatured, ...restFeatured] = figureRows

  // The bar scale, said on the drawing: the note and the ruler's ticks, each a
  // round count at its position on the same square-root scale the weights use
  // (cities-index-constants.ts). The ledger prints these and computes nothing.
  const ledgerScale: V3LedgerScale | undefined = countsPublishable
    ? {
        note: v3Text(INDEX_BAR_SCALE_NOTE),
        ticks: indexBarTicks(maxCount).map((t) => ({ at: t.at, label: v3Text(formatCount(t.count)) })),
      }
    : undefined

  // THE DOOR BOARD (SITE-92 round 5). The second, third and fourth door per
  // featured city, each carrying the count it opens onto: the tile's figure is
  // the city's live single-family count — the same figure its ledger row
  // prints, and what its guide and its inventory open onto — and the
  // open-house and luxury doors carry their own filtered counts from the
  // destination pages' own reads (cities-doors.ts). A city with no verified
  // photograph draws its recorded outline in the Atlas's language, as its
  // ledger row does. The tile with the largest count leads the board.
  const doorLead = leadTileId(featured.map((c) => ({ id: c.slug, count: c.activeCount })))
  const doorTiles: V3DoorBoardTile[] = featured.map((city) => {
    const headlines = overlays.get(`city:${city.slug}`)?.headlines ?? null
    const median = fmtMedian(city.medianListPrice)
    const supply = headlines
      ? `${headlines.verdictLabel.charAt(0).toUpperCase()}${headlines.verdictLabel.slice(1)} · ${headlines.mosLabel} months of supply`
      : null
    const line = [median ? `Median list ${median}` : null, supply].filter((part): part is string => Boolean(part)).join(' · ')
    const figure = tileFigure(city.activeCount)
    const doors = cityFeaturedLinks(city.slug, city.name).map((door) => {
      const doorFigure =
        door.kind === 'open-houses'
          ? openHouseDoorFigure(openHouseCounts.get(city.slug))
          : door.kind === 'luxury'
            ? luxuryDoorFigure(luxuryCount)
            : null
      return {
        id: door.kind,
        label: v3Text(door.label),
        rest: door.rest ? v3Text(door.rest) : undefined,
        href: door.href,
        figure: doorFigure
          ? { value: doorFigure.value, formatted: v3Text(doorFigure.formatted), unit: v3Text(doorFigure.unit) }
          : undefined,
      }
    })
    return {
      id: city.slug,
      name: v3Text(city.name),
      href: `/cities/${city.slug}`,
      media: city.hero.verified ? { src: city.hero.src } : undefined,
      mark: city.hero.verified
        ? undefined
        : <V3PlaceMark silhouette={silhouetteTile(townGeometryBySlug.get(city.slug), DOOR_TILE_BOX)} />,
      figure: figure ? { value: figure.value, formatted: v3Text(figure.formatted), unit: v3Text(figure.unit) } : undefined,
      absent: figure ? undefined : v3Text(NO_LIVE_COUNT_LABEL),
      line: line ? v3Text(line) : undefined,
      doors,
      lead: city.slug === doorLead,
    }
  })

  // THE ASK STANDS ON ITS DATA (SITE-92 round 5): the region's real 30-day
  // count — the same Market Truth figure the fold's strip prints — and every
  // town the Atlas drew, as its recorded outline, each a door. The same reads
  // as the fold; nothing new is fetched for the foot of the page.
  const alertPlaces: V3PlaceStripPlace[] = townRegions
    .map((r) => ({
      id: r.id.replace(/^town:/, ''),
      name: v3Text(r.name),
      href: r.href,
      silhouette: silhouetteTile(r.geometry),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const alertCount = regionPace.newCount30d
  const alertsFigureSource =
    (alertCount != null
      ? `${formatCount(alertCount)} houses: regional MLS through Oregon Data Share — new listings in the last 30 days across Central Oregon as our market metric layer counts them (detached single-family; Coming Soon excluded), the same figure the strip beside the Atlas prints. `
      : "The region's 30-day count was not published on this refresh, so the ask carries no figure. ") +
    "Each outline is the town's recorded boundary, the same one the Atlas above draws; the alert itself covers every city in Central Oregon, drawn or not."

  // THE CLOSE (SITE-92 round 5): one figured door — the search, carrying the
  // region's live total of every type from the same Atlas read the fold drew,
  // the meter under it the share of live listings still for sale — then the
  // place types and the seller ask as one light line, and the MLS cooperative
  // behind the page. Not a second six-row list under the doors.
  const liveTotal = atlas.complete && atlas.counts.forSale > 0 ? atlas.counts : null
  const edgeItems: V3QuietItem[] = [
    {
      label: 'Search every listing',
      href: REGIONAL_SEARCH_HREF,
      lead: true,
      detail: liveTotal
        ? `${formatCount(liveTotal.pending)} more are pending. The bar is the share of live listings still for sale; filter by price, beds and place from there.`
        : 'Every active listing of every property type on the regional MLS, filterable by price, beds and place.',
      figure: liveTotal
        ? {
            value: formatCount(liveTotal.forSale),
            unit: 'for sale of every type',
            source: `${atlas.source} Read ${atlas.stamp}.`,
            sourceName: 'Oregon Data Share',
            ratio: liveTotal.forSale / (liveTotal.forSale + liveTotal.pending),
          }
        : undefined,
    },
    { label: 'Communities', href: '/communities', weight: 'secondary' },
    { label: 'Neighborhoods', href: '/neighborhoods', weight: 'secondary' },
    { label: 'Subdivisions', href: '/subdivisions', weight: 'secondary' },
    { label: 'Value my home', href: valuationHref('/cities'), weight: 'secondary' },
    { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com', weight: 'secondary', mark: 'external' },
  ]

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
      <CitiesMosCompare
        regionLabel="Central Oregon"
        regionMos={hud.monthsSupply}
        regionMosLabel={mosText}
        regionVerdict={regionVerdict.label}
        cities={compareCities}
        source={REGION_SUPPLY_TRACE}
      />
    ) : null

  const regionDrawing =
    regionFigures.length > 0 ? (
      <>
        <V3Drawing figures={regionFigures} label="Central Oregon homes for sale against a month of sales" />
        {regionScale}
      </>
    ) : null
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
                itemListElement: featured.map((c, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  name: `${c.name}, Oregon`,
                  url: `${siteUrl}/cities/${c.slug}`,
                })),
              },
            }),
          }}
        />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Cities' }]} />

        {/* The H1 and one caption, then the fold: Central Oregon drawn, with
            the ask beside it (layout lock: a drawing and a figure beside the
            alerts sentence). */}
        <header className="cities-opening">
          <V3Eyebrow>Central Oregon</V3Eyebrow>
          <V3Heading level={1} size="field">
            Central Oregon cities
          </V3Heading>
          <p className="cities-opening__caption">
            {directoryNote || 'Live single-family inventory from the regional MLS.'}
          </p>
        </header>

        <div className="cities-fold">
          <div className="cities-fold__stage">
            <div className="cities-fold__drawing">
              {atlasDrawable ? (
                <V3Atlas
                  id="atlas"
                  headingLevel={2}
                  headline={v3Text('Central Oregon right now')}
                  headlineTone="eyebrow"
                  claimText="Every town is a door to its own page; every mark is a live MLS listing of any type. The supply reading below counts detached houses."
                  keyPlacement="head"
                  sourceName="Oregon Data Share"
                  dots={atlas.dots}
                  regions={townRegions}
                  basemap={basemapForRegions(townRegions, { dots: atlas.dots, fit: 'dots' })}
                  fit="dots"
                  salesWash={INDEX_SALES_WASH}
                  townsAs="doors"
                  types={atlas.types}
                  events={atlas.events}
                  source={atlas.source}
                  stamp={atlas.stamp}
                  incomplete={!atlas.complete}
                />
              ) : null}
            </div>
            <aside className="cities-fold__figure">
              <CitiesAlertsStrip
                id="regional-alerts"
                newCount30d={regionPace.newCount30d}
                updatedAt={ledgerStamp ? formatDate(ledgerStamp) : null}
                browseHref={REGIONAL_SEARCH_HREF}
              />
            </aside>
          </div>
        </div>

        {firstFeatured ? (
          <V3Ledger
            id="featured-cities"
            headingLevel={2}
            eyebrow={v3Text('Every city')}
            heading={v3Text('Central Oregon cities, A to Z')}
            note={v3Text(LEDGER_NOTE)}
            drawing={regionDrawing}
            headLayout="beside"
            rows={[firstFeatured, ...restFeatured]}
            encode={countsPublishable ? 'bar' : undefined}
            scale={ledgerScale}
            source={v3Text(FEATURED_TRACE + '. Remaining cities: ' + OTHERS_TRACE + '. ' + REVEAL_TRACE)}
            updated={ledgerStamp ? v3Text(formatDate(ledgerStamp)) : undefined}
            action={{ label: v3Text('Search all listings'), href: '/search', variant: 'primary' }}
          />
        ) : (
          <V3Ledger
            id="featured-cities"
            headingLevel={2}
            heading={v3Text('Central Oregon cities, A to Z')}
            rows={[]}
            emptyMessage={v3Text('The city index returned no city on this refresh.')}
          />
        )}

        <V3DoorBoard
          id="city-doors"
          eyebrow={v3Text('Straight to the listings')}
          heading={v3Text('Every city, every door')}
          lede={v3Text(DOOR_BOARD_LEDE)}
          tiles={doorTiles}
          source={v3Text(DOOR_BOARD_TRACE)}
          sourceName="Oregon Data Share"
          updated={ledgerStamp ? v3Text(formatDate(ledgerStamp)) : undefined}
        />

        <RegionalAlertSheet
          placeLabel="Central Oregon"
          city=""
          figure={{
            newCount30d: regionPace.newCount30d,
            source: alertsFigureSource,
            sourceName: 'Oregon Data Share',
            updatedAt: ledgerStamp,
            places: alertPlaces,
            placesLabel: 'Every town the Atlas draws, each a door',
            scopeLine: 'The alert covers every city in Central Oregon, not only the towns drawn here.',
          }}
        />

        <V3Quiet
          id="edges"
          eyebrow="Central Oregon"
          heading="Search every listing in Central Oregon"
          items={edgeItems}
          note="Filter by price, beds, and location across every city on the list. Oregon Data Share is the regional MLS cooperative behind the live listing and market data on this page."
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
