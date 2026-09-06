import type { Metadata } from 'next'

import { valuationHref } from '@/lib/site/valuation-href'
import { getListingTiles, getDetachedOverlays, getBrokers, getReviews } from '@/lib/data'
import { buildRegionAtlasRegions } from '@/app/_v3/region-atlas'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getPriceHistory } from '@/lib/data/market/getPriceHistory'
import { buildYearSeries } from '@/lib/kb/year-series'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { getPublicDetachedMonthly, leftoverOrCacheMonthly, dropCurrentMonth } from '@/lib/data/market-truth/public-monthly'
import {
  placeFigureRows,
  marketAbsenceItems,
  leftoverMarketFigures,
  placeMedianChart,
  placeMedianChartCaption,
  PLACE_COUNT_TRACE,
  type CityPlaceItem,
} from '@/app/cities/[slug]/_v3/city-sections'
import { zonedDateKey, formatDate } from '@/lib/format/date'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Stage,
  V3Doors,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  V3Proof,
  V3Eyebrow,
  V3Heading,
} from '@/components/site/v3'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { HomeHomesField } from './_v3/HomeHomesField'
import { HomeExploreMap } from './_v3/HomeExploreMap.client'
import './_v3/home-explore-map.css'
import { HomeHeroSearch } from './_v3/HomeHeroSearch.client'
import { homeFieldPool } from './_v3/home-field-items'
import { liveStamp } from './_v3/live-format'
import {
  HERO_VIDEO,
  HERO_POSTER,
  HOME_FIELD_POOL,
  HOME_TILE_FETCH,
  HOME_MARKET_TRACE,
  preferPlaceHero,
} from './_v3/home-constants'
import { unionBoundaryGeometry } from '@/app/central-oregon/_v3/union-boundary'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
// D11 seo-shell lock: this exact town list stays in source (metadata).
const D11_HOMEPAGE_LEAD =
  'Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market.'

/**
 * Homepage. Stage (owned Old Mill / Bend flyover, job H1, search action),
 * then Buy/Sell/Invest doors, featured homes, a regular Google Map, one town
 * comparison, market Instrument, reviews, and brokers. Atlas stays on place
 * pages — not here. absolute title skips the layout suffix so the SERP is
 * brand once.
 */
export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Ryan Realty, Bend' },
  description:
    `Active homes for sale in ${D11_HOMEPAGE_LEAD} Closed comps from the regional MLS.`,
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Ryan Realty, Bend',
    description:
      'Active homes for sale in Bend, Redmond, Sisters, and Sunriver. Live list prices, days on market, and closed comps.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Ryan Realty, Bend' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ryan Realty, Bend',
    description: 'Active Central Oregon homes for sale. List prices and days on market, town by town.',
  },
}

const TOWN_ORDER = ['bend', 'la-pine', 'redmond', 'sunriver', 'sisters', 'terrebonne']
const TOWN_IMG: Record<string, string> = {
  bend: '/images/kb/bend-drake-park-aerial.jpg',
  'la-pine': '/images/kb/vandevert-ranch.jpg',
  redmond: '/images/kb/redmond-downtown-aerial.jpg',
  sunriver: '/images/kb/sunriver-deschutes-river.jpg',
  sisters: '/images/kb/sisters-downtown-three-peaks.jpg',
  terrebonne: '/images/kb/smith-rock-terrebonne.jpg',
}


export default async function Home() {
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [cities, tiles, priceHist, publicPace, leftoverMonthly, regionOverlays, brokers, regionAtlas, investSegments] = await Promise.all([
    getCitiesForIndex().catch(() => []),
    getListingTiles({ status: 'active', limit: HOME_TILE_FETCH, sort: 'newest' }).catch(() => []),
    getPriceHistory('region', 'central-oregon', 'monthly', 60).catch(() => []),
    getPublicDetachedPace({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => EMPTY_PUBLIC_PACE),
    getPublicDetachedMonthly({
      geoType: 'region',
      geoSlug: 'central-oregon',
      currentMonthKey,
    }).catch(() => []),
    getDetachedOverlays([{ geoType: 'region', geoSlug: 'central-oregon' }]).catch(() => new Map()),
    getBrokers().catch(() => []),
    // Town boundaries for the region outline on the explore map.
    buildRegionAtlasRegions().catch(() => null),
    getPublicPlaceSegments({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => []),
  ])
  // Live Google reviews, the same read /reviews and /about make. The homepage
  // printed eight hardcoded TESTIMONIALS in a Quiet block instead: a section of
  // client words with no source, on the page most people see first.
  const reviewSummary = await getReviews(6).catch(() => null)
  const townBoundaries = regionAtlas?.townBoundaries ?? TOWN_ORDER.map(() => null)
  const regionBoundary = unionBoundaryGeometry(townBoundaries)
  const regionMt = regionOverlays.get('region:central-oregon')
  const chartMonths = leftoverOrCacheMonthly(leftoverMonthly, dropCurrentMonth(priceHist, currentMonthKey))
  const hud = leftoverHudKpis({
    grain: 'region',
    headlines: regionMt?.headlines ?? null,
    inventory: regionMt?.inventory ?? null,
    pace: publicPace,
  })
  const leftoverStamp = regionMt?.headlines?.computedAt ?? regionMt?.inventory?.computedAt ?? null

  const cityBySlug = new Map(cities.map((c) => [c.slug, c]))
  const townItems: CityPlaceItem[] = TOWN_ORDER.flatMap((slug): CityPlaceItem[] => {
    const c = cityBySlug.get(slug)
    if (!c) return []
    return [{
      name: c.name,
      activeCount: c.activeCount,
      medianPrice: c.medianPrice,
      href: `/cities/${slug}`,
      img: preferPlaceHero(c.heroImageUrl, TOWN_IMG[slug] ?? ''),
    }]
  })
  const faces: AboutFace[] = [...brokers]
    .sort((a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9))
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  // Four quotes: Proof features one in full and lists the other three as picks (H11).
  const reviewQuotes = reviewSummary ? toReviewQuotes(reviewSummary.reviews).slice(0, 4) : []
  const reviewCount =
    reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : reviewQuotes.length
  const reviewAverage =
    reviewSummary && reviewSummary.count > 0 ? reviewSummary.averageRating : 5
  const newestReview = reviewQuotes
    .map((q) => q.date)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1)

  const [firstTownRow, ...restTownRows] = placeFigureRows(townItems, 'City').map(
    ({ when: _kind, ...row }) => row,
  )

  const fieldItems = homeFieldPool(tiles, HOME_FIELD_POOL)

  const townRegionCount =
    regionAtlas?.regions?.filter((r) => r.kind === 'town').length ?? TOWN_ORDER.length
  const communityRegionCount =
    regionAtlas?.regions?.filter((r) => r.kind === 'community').length ?? 0

  const mapPins = fieldItems
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .map((item) => ({
      id: item.id,
      href: item.href,
      priceLabel: item.priceLabel,
      title: item.title,
      lat: item.lat,
      lng: item.lng,
    }))

  const mosRaw = hud.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
  const verdict = marketVerdict(mosRaw)
  const mosLabel = mosRaw != null ? formatMonthsOfSupply(mosRaw) : null
  const hasVerdict = verdict.kind !== 'unknown' && mosLabel != null
  const marketHeadline = hasVerdict
    ? `Is Central Oregon a buyer's or seller's market?`
    : 'The Central Oregon market'
  const verdictSentence = hasVerdict
    ? `Central Oregon has ${mosLabel} months of supply, which is a ${verdict.label}.`
    : null
  // The two pace figures read as a sentence, not as a KPI grid (evaluator
  // 2026-09-01: "a number, a percentage, and jargon"). Same pace row, same trace.
  const paceSentence =
    hud.daysToPending != null && hud.saleToList != null
      ? `Homes go pending in a median of ${Math.round(hud.daysToPending)} days and sell for ${hud.saleToList.toFixed(0)}% of the original asking price.`
      : hud.daysToPending != null
        ? `Homes go pending in a median of ${Math.round(hud.daysToPending)} days.`
        : null
  const marketNote = [verdictSentence, paceSentence].filter(Boolean).join(' ')
  const HOME_FIGURE_LABELS = new Set([
    'median list price',
    'detached homes for sale',
    'months of supply',
  ])
  const figures = leftoverMarketFigures(hud, {
    browse: publishRegionalSearchHref(),
    monthsOfSupply: '/months-of-supply',
  }).filter((f) => HOME_FIGURE_LABELS.has(String(f.label)))
  const [firstMarketFigure, ...restMarketFigures] = figures
  const medianChart = placeMedianChart(
    buildYearSeries(chartMonths.months, 5),
    placeMedianChartCaption('Central Oregon'),
  )
  const marketSource = `${HOME_MARKET_TRACE}${mosLabel != null ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : ''}`

  const seeAllLabel =
    hud.active != null
      ? `See all ${hud.active.toLocaleString('en-US')} single-family homes`
      : 'See all homes'

  // The three routes (Matt 2026-09-01). Each fact is the same live figure its
  // destination page prints, or absent — never an estimate (section 0). The
  // investing sum names exactly the segments it counts.
  const investDoorSegments = new Set(['multifamily_2_4', 'commercial_sale', 'land'])
  const investCount = investSegments
    .filter((row) => investDoorSegments.has(row.segment))
    .reduce((sum, row) => sum + (row.activeCount ?? 0), 0)
  const doors = [
    {
      // A buyer does not want every home; a buyer wants THEIR place, price,
      // and type (Matt 2026-09-01). The door is place-first and lands on the
      // map, where the search narrows by town, community, and price.
      kicker: v3Text('Buying'),
      label: v3Text('Find your place'),
      href: '/homes-for-sale?view=map',
      // Only what the map actually holds: the communities and neighborhoods
      // with a recorded boundary (pass two, N8).
      fact: v3Text(
        communityRegionCount > 0
          ? `${townRegionCount} towns and ${communityRegionCount} communities across Central Oregon`
          : `${townRegionCount} towns across Central Oregon`,
      ),
    },
    {
      kicker: v3Text('Selling'),
      label: v3Text('See what your home is worth'),
      href: valuationHref('/'),
      fact: v3Text('A written valuation within 24 hours'),
    },
    {
      kicker: v3Text('Investing'),
      label: v3Text('Income property, with the math'),
      href: '/invest',
      ...(investCount > 0
        ? { fact: v3Text(`${investCount.toLocaleString('en-US')} income and land listings`) }
        : {}),
    },
  ] as const

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />

        <V3Stage
          id="hero"
          headingLevel={1}
          eyebrow="Central Oregon"
          headline={v3Text('Find homes in Central Oregon')}
          posterSrc={HERO_POSTER}
          videoSrc={HERO_VIDEO}
        >
          <HomeHeroSearch />
        </V3Stage>

        <V3Doors id="doors" name={v3Text('Start with what you came to do')} doors={doors} />

        <HomeHomesField
          fieldItems={fieldItems}
          listFlow
          seeAll={{ href: publishRegionalSearchHref(), label: seeAllLabel }}
          emptyMessage="No photographed active home with a list price and a street address returned on this refresh."
        />

        <section
          id="map"
          className={`${V3_ROOT_CLASS} home-explore-map`}
          aria-labelledby="home-map-heading"
        >
          <div className="home-explore-map__head">
            <V3Eyebrow className="home-explore-map__eyebrow">Central Oregon</V3Eyebrow>
            <V3Heading level={2} id="home-map-heading" className="home-explore-map__headline">
              Homes on the map
            </V3Heading>
            <p className="home-explore-map__note">
              Active listings with list prices. Open the full map to filter by town and type.
            </p>
            <ul className="home-explore-map__legend" aria-label="Map legend">
              <li>
                <span className="home-explore-map__legend-mark" aria-hidden="true" />
                <span className="home-explore-map__legend-label">For sale</span>
                <span>— navy pin with price on hover</span>
              </li>
            </ul>
          </div>
          <HomeExploreMap pins={mapPins} boundary={regionBoundary ?? undefined} />
          <a className="home-explore-map__action" href="/homes-for-sale?view=map">
            Explore the full map
          </a>
        </section>

        {firstTownRow ? (
          <V3Ledger
            id="towns"
            eyebrow={v3Text('Central Oregon · Single-family, by town')}
            heading={v3Text('Where the single-family homes are, and what they cost')}
            rows={[firstTownRow, ...restTownRows]}
            source={v3Text(PLACE_COUNT_TRACE)}
            updated={liveStamp(leftoverStamp)}
            encode="bar"
            action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
          />
        ) : (
          <V3Ledger
            id="towns"
            eyebrow={v3Text('Central Oregon · Single-family, by town')}
            heading={v3Text('Where the single-family homes are, and what they cost')}
            rows={[]}
            emptyMessage={v3Text('No town returned a live market row on this refresh.')}
            action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
          />
        )}

        {firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text('Central Oregon · The market')}
            headline={v3Text(marketHeadline)}
            note={marketNote ? v3Text(marketNote) : undefined}
            figures={[firstMarketFigure, ...restMarketFigures]}
            source={v3Text(marketSource)}
            chart={medianChart}
            updated={liveStamp(leftoverStamp)}
            action={
              hasVerdict && verdict.kind === 'sellers'
                ? { label: v3Text('See what your home is worth'), href: valuationHref('/'), variant: 'ghost' as const }
                : { label: v3Text('Full market report'), href: '/housing-market', variant: 'ghost' as const }
            }
          />
        ) : (
          <V3Quiet
            id="market"
            heading="The Central Oregon market"
            items={marketAbsenceItems('Central Oregon', fieldItems.length > 0)}
          />
        )}

        {reviewQuotes.length > 0 ? (
          <V3Proof
            id="reviews"
            eyebrow="Ryan Realty · Google"
            headline={`${reviewCount} Google reviews`}
            headingLevel={2}
            claim={`${reviewAverage.toFixed(1)} of 5 across ${reviewCount} reviews. One featured review in full; three more as picks.`}
            figures={[
              { value: String(reviewCount), label: 'Google reviews' },
              { value: reviewAverage.toFixed(1), label: 'average of 5' },
              ...(newestReview
                ? [
                    {
                      value: formatDate(newestReview, {
                        month: 'short',
                        day: undefined,
                        year: 'numeric',
                      }),
                      label: 'newest',
                    },
                  ]
                : []),
            ]}
            quotes={reviewQuotes}
            source={{ label: 'Every review', href: '/reviews' }}
            record={false}
          />
        ) : null}

        {faces.length > 0 ? (
          <AboutFaces people={faces} heading="The brokers" headingLevel={2} />
        ) : null}

      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
