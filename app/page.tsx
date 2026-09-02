import type { Metadata } from 'next'

import { valuationHref } from '@/lib/site/valuation-href'
import { getListingTiles, getDetachedOverlays, getBrokers, getBoundaryGeoJSON } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getPriceHistory } from '@/lib/data/market/getPriceHistory'
import { buildYearSeries } from '@/lib/kb/year-series'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceExact } from '@/lib/format/money'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { getPublicDetachedMonthly, leftoverOrCacheMonthly, dropCurrentMonth } from '@/lib/data/market-truth/public-monthly'
import {
  placeFigureRows,
  communityRows,
  marketAbsenceItems,
  leftoverMarketFigures,
  placeMedianChart,
  placeMedianChartCaption,
  PLACE_COUNT_TRACE,
  type CityPlaceItem,
  type CityCommunityItem,
} from '@/app/cities/[slug]/_v3/city-sections'
import { zonedDateKey } from '@/lib/format/date'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Stage,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'
import { HomeHomesField } from './_v3/HomeHomesField'
import { HomeHeroSearch } from './_v3/HomeHeroSearch.client'
import { homeFieldPool } from './_v3/home-field-items'
import { liveStamp } from './_v3/live-format'
import {
  HERO_VIDEO,
  HERO_POSTER,
  HOME_FIELD_POOL,
  HOME_TILE_FETCH,
  HOME_COMMUNITY_TRACE,
  HOME_MARKET_TRACE,
  preferPlaceHero,
} from './_v3/home-constants'
import { unionBoundaryGeometry } from '@/app/central-oregon/_v3/union-boundary'
import { TESTIMONIALS } from '@/lib/testimonials'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'
import { SellValueForm } from '@/app/sell/_v3/SellValueForm'
import { HomeAlertSheet } from './_v3/HomeAlertSheet.client'
import communityVideoManifest from '@/data/city-hero-videos.resolved.json'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
// D11 seo-shell lock: this exact town list stays in source (metadata).
const D11_HOMEPAGE_LEAD =
  'Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market.'

/**
 * Homepage. Stage (owned Old Mill / Bend flyover, one line, search action)
 * then Field of homes on the v3 barrel. Chart Room is mid-page.
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Homes for Sale in Central Oregon | Bend, Redmond, Sisters, Sunriver',
  description:
    `Active homes for sale in ${D11_HOMEPAGE_LEAD} Closed comps from the regional MLS.`,
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Homes for Sale in Central Oregon | Ryan Realty',
    description:
      'Active homes for sale in Bend, Redmond, Sisters, and Sunriver. Live list prices, days on market, and closed comps.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Homes for Sale in Central Oregon' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Homes for Sale in Central Oregon | Bend, Redmond, Sisters, Sunriver',
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

const COMM_FEATURED = [
  { match: 'tetherow', town: 'Bend', img: '/images/kb/tetherow-golf-aerial.jpg', videoSlug: 'tetherow' },
  { match: 'caldera', town: 'Sunriver', img: '/images/kb/caldera-springs.jpg', videoSlug: 'caldera-springs' },
  { match: 'broken top', town: 'Bend', img: '/images/kb/broken-top.jpg', videoSlug: 'broken-top' },
  { match: 'northwest crossing', town: 'Bend', img: '/images/kb/northwest-crossing.jpg', videoSlug: 'northwest-crossing' },
]

export default async function Home() {
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [cities, communities, tiles, priceHist, publicPace, leftoverMonthly, regionOverlays, brokers, townBoundaries] = await Promise.all([
    getCitiesForIndex().catch(() => []),
    getCommunitiesForIndex().catch(() => []),
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
    Promise.all(
      TOWN_ORDER.map((slug) =>
        getBoundaryGeoJSON({ geoType: 'city', geoSlug: slug }).catch(() => null),
      ),
    ),
  ])
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

  const testimonialItems: V3QuietItem[] = TESTIMONIALS.slice(0, 8).map((t) => ({
    kind: 'prose' as const,
    term: t.author,
    body: t.quote,
  }))

  const [firstTownRow, ...restTownRows] = placeFigureRows(townItems, 'City').map(
    ({ when: _kind, ...row }) => row,
  )

  const communityVideos = communityVideoManifest as Record<string, { video?: string } | undefined>
  const titleCaseName = (s: string) => s.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
  const communityItems: CityCommunityItem[] = COMM_FEATURED.flatMap((f): CityCommunityItem[] => {
    const c = communities.find((x) => x.subdivision.toLowerCase().includes(f.match))
    if (!c) return []
    const cv = communityVideos[f.videoSlug]
    return [{
      name: titleCaseName(c.subdivision),
      activeCount: c.activeCount,
      medianPrice: c.medianPrice ?? null,
      town: f.town,
      href: `/communities/${c.slug}`,
      img: preferPlaceHero(c.heroImageUrl, f.img),
      video: cv?.video ? { url: cv.video, embedType: 'video-tag' as const } : null,
    }]
  })
  const [firstCommunityRow, ...restCommunityRows] = communityRows(communityItems)

  const fieldItems = homeFieldPool(tiles, HOME_FIELD_POOL)

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
  const HOME_FIGURE_LABELS = new Set([
    'median list price',
    'detached homes for sale',
    'months of supply',
    'median to pending · 90 days',
    'sale to original list · 12 months',
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

  const footerFine = townItems
    .filter((t) => t.activeCount != null && t.medianPrice != null)
    .map((t) => `${t.name} ${(t.activeCount as number).toLocaleString('en-US')} / ${formatPriceExact(t.medianPrice as number)}`)
    .join(' · ')

  const seeAllLabel =
    hud.active != null
      ? `See all ${hud.active.toLocaleString('en-US')} homes`
      : 'See all homes'

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />

        <V3Stage
          id="hero"
          headingLevel={1}
          eyebrow="Central Oregon Real Estate"
          headline={v3Text('Homes for Sale in Central Oregon')}
          posterSrc={HERO_POSTER}
          videoSrc={HERO_VIDEO}
        >
          <HomeHeroSearch />
        </V3Stage>

        <HomeHomesField
          fieldItems={fieldItems}
          boundary={regionBoundary ?? undefined}
          listFlow
          seeAll={{ href: publishRegionalSearchHref(), label: seeAllLabel }}
          emptyMessage="No photographed active home with a list price and a street address returned on this refresh."
        />

        {firstTownRow ? (
          <V3Ledger
            id="towns"
            eyebrow={v3Text('Central Oregon · By town')}
            heading={v3Text('Where the homes are, and what they cost')}
            rows={[firstTownRow, ...restTownRows]}
            source={v3Text(PLACE_COUNT_TRACE)}
            updated={liveStamp(leftoverStamp)}
            action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
          />
        ) : (
          <V3Ledger
            id="towns"
            eyebrow={v3Text('Central Oregon · By town')}
            heading={v3Text('Where the homes are, and what they cost')}
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
            note={verdictSentence ? v3Text(verdictSentence) : undefined}
            figures={[firstMarketFigure, ...restMarketFigures]}
            source={v3Text(marketSource)}
            chart={medianChart}
            updated={liveStamp(leftoverStamp)}
            action={
              // Verdict-aware exit (funnel audit 2026-09-01): the section just
              // told a would-be seller it is a seller's market — the one action
              // answers that reader at that moment. Buyer's/balanced/unknown
              // keep the market-report door. Same single ghost action either way.
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

        {firstCommunityRow ? (
          <V3Ledger
            id="communities"
            eyebrow={v3Text('Central Oregon · Communities')}
            heading={v3Text('Resorts and planned communities')}
            rows={[firstCommunityRow, ...restCommunityRows]}
            source={v3Text(HOME_COMMUNITY_TRACE)}
            updated={liveStamp(leftoverStamp)}
            action={{ label: v3Text('Every community'), href: '/communities' }}
          />
        ) : null}

        <HomeAlertSheet />

        {testimonialItems.length > 0 ? (
          <V3Quiet
            id="reviews"
            heading="What clients say"
            items={testimonialItems}
          />
        ) : null}

        {faces.length > 0 ? (
          <AboutFaces people={faces} heading="The brokers" headingLevel={2} />
        ) : null}

        <section id="sell" className={V3_ROOT_CLASS}>
          <SellValueForm pagePath="/" formId="home-get-value" />
        </section>
      </main>

      <V3Footer
        columns={V3_FOOTER_COLUMNS}
        note={footerFine ? `Active single-family by town: ${footerFine}. Figures from the MLS.` : undefined}
      />
    </>
  )
}
