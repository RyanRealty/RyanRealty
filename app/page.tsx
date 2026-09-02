import type { Metadata } from 'next'

import { valuationHref } from '@/lib/site/valuation-href'
import { getListingTiles, getDetachedOverlays, getBrokers, getBoundaryGeoJSON, getAllNeighborhoodsWithCity } from '@/lib/data'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { listingDetailPath } from '@/lib/slug'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { classifyType } from './_v3/home-field-items'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
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
  communityRows,
  marketAbsenceItems,
  leftoverMarketFigures,
  placeMedianChart,
  placeMedianChartCaption,
  PLACE_COUNT_TRACE,
  type CityPlaceItem,
  type CityCommunityItem,
} from '@/app/cities/[slug]/_v3/city-sections'
import { zonedDateKey, formatDateTime } from '@/lib/format/date'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Atlas,
  type V3AtlasVariant,
  type AtlasDot,
  type AtlasEvent,
  type AtlasRegion,
  type AtlasType,
  V3Doors,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { HomeHomesField } from './_v3/HomeHomesField'
import { HomeHeroSearch } from './_v3/HomeHeroSearch.client'
import { homeFieldPool } from './_v3/home-field-items'
import { liveStamp } from './_v3/live-format'
import {
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
import { SellCapture } from '@/app/sell/_v3/SellCapture'
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

/** The Atlas type toggles, in display order. Keys are classifyType's. */
const ATLAS_TYPES: readonly AtlasType[] = [
  { key: 'house', label: 'House' },
  { key: 'condo', label: 'Condo' },
  { key: 'townhouse', label: 'Townhouse' },
  { key: 'manufactured', label: 'Manufactured' },
  { key: 'land', label: 'Land' },
  { key: 'multi', label: 'Multi-family' },
]

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Decision-sheet switch (TASTE.md variants rule): ?opening=dots|choropleth|split.
  // The losers are deleted in the commit that records Matt's pick.
  const sp = await searchParams
  const openingRaw = typeof sp.opening === 'string' ? sp.opening : ''
  const opening: V3AtlasVariant =
    openingRaw === 'heat' || openingRaw === 'split' ? openingRaw : 'dots'
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [cities, communities, tiles, priceHist, publicPace, leftoverMonthly, regionOverlays, brokers, townBoundaries, investSegments, atlasTiles, neighborhoodRows, communityBoundaries] = await Promise.all([
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
    getPublicPlaceSegments({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => []),
    // The Atlas population: every public active listing with a coordinate.
    // PostgREST caps one read at 1,000 rows, so the set is paged and deduped
    // by key; the claim prints what the dots actually hold.
    Promise.all([
      ...[0, 1000, 2000, 3000, 4000].map((offset) =>
        getListingTiles({ status: 'active-and-pending', limit: 1000, offset, sort: 'newest' }).catch(() => []),
      ),
      // The month's closed sales (a close_date window, newest close first),
      // for the heat field and the live line.
      getListingTiles({
        status: 'closed',
        closedFromDate: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
        limit: 1000,
        sort: 'close-newest',
      }).catch(() => []),
    ]).then((pages) => {
      const seen = new Set<string>()
      return pages.flat().filter((t) => (seen.has(t.listingKey) ? false : (seen.add(t.listingKey), true)))
    }),
    getAllNeighborhoodsWithCity().catch(() => []),
    Promise.all(
      getAllResortCommunities().map((c) =>
        getBoundaryGeoJSON({ geoType: 'neighborhood', geoSlug: c.slug })
          .then((geometry) => ({ c, geometry }))
          .catch(() => ({ c, geometry: null })),
      ),
    ),
  ])
  const registrySlugs = new Set(getAllResortCommunities().map((c) => c.slug))
  const bendNeighborhoods = neighborhoodRows.filter((r) => {
    const city = Array.isArray(r.cities) ? r.cities[0] : r.cities
    const citySlug = (city?.slug ?? '').toLowerCase().trim()
    const slug = (r.slug ?? '').toLowerCase().trim()
    return citySlug === 'bend' && slug && r.name && !registrySlugs.has(slug)
  })
  const neighborhoodBoundaries = await Promise.all(
    bendNeighborhoods.map((r) =>
      getBoundaryGeoJSON({ geoType: 'neighborhood', geoSlug: `bend-${(r.slug ?? '').toLowerCase().trim()}` })
        .then((geometry) => ({ r, geometry }))
        .catch(() => ({ r, geometry: null })),
    ),
  )
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

  // The Atlas: dots are the active listings with a coordinate; regions are the
  // six towns, every registry community with a boundary, and every Bend
  // neighborhood with one. Every figure the Atlas prints is a count or median
  // over these dots — one population, one source.
  const nowMs = Date.now()
  const daysAgo = (iso: string | null | undefined): number | null => {
    if (!iso) return null
    const t = Date.parse(iso)
    return Number.isFinite(t) ? Math.max(0, Math.floor((nowMs - t) / 86_400_000)) : null
  }
  const dotStatus = (status: string): AtlasDot['s'] | null => {
    if (status === 'Active') return 'active'
    if (status === 'Active Under Contract' || status === 'Pending') return 'pending'
    if (status === 'Closed') return 'sold'
    return null
  }
  const atlasDots: AtlasDot[] = atlasTiles.flatMap((tile): AtlasDot[] => {
    if (tile.lat == null || tile.lng == null) return []
    const s = dotStatus(tile.status)
    if (!s) return []
    const soldAgo = s === 'sold' ? daysAgo(tile.closeDate) : null
    // Sold dots carry only the month's closes; older closes are not activity.
    if (s === 'sold' && (soldAgo == null || soldAgo > 30)) return []
    const { typeKey } = classifyType({ propertyType: tile.propertyType, propertySubType: tile.propertySubType })
    const raw = s === 'sold' && tile.closePrice != null ? Number(tile.closePrice) : tile.listPrice != null ? Number(tile.listPrice) : null
    return [{
      k: tile.listingKey,
      lat: Number(tile.lat.toFixed(4)),
      lng: Number(tile.lng.toFixed(4)),
      p: raw != null && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null,
      t: typeKey,
      s,
      age: daysAgo(tile.onMarketDate),
      ...(soldAgo != null ? { soldAgo } : {}),
    }]
  })
  // The live line: the newest real events, one line each. Place is the
  // subdivision when the feed names one, else the city.
  const placeOf = (tile: (typeof atlasTiles)[number]) =>
    publishPlatDisplayName(tile.subdivisionName) ?? tile.city ?? 'Central Oregon'
  const priceOf = (tile: (typeof atlasTiles)[number]) => {
    const v = tile.status === 'Closed' && tile.closePrice != null ? Number(tile.closePrice) : tile.listPrice != null ? Number(tile.listPrice) : null
    return v != null && Number.isFinite(v) && v > 0 ? `$${Math.round(v).toLocaleString('en-US')}` : null
  }
  const eventOf = (tile: (typeof atlasTiles)[number], kind: AtlasEvent['kind'], verb: string): AtlasEvent | null => {
    const price = priceOf(tile)
    if (!price) return null
    return {
      key: `${kind}:${tile.listingKey}`,
      kind,
      label: `${verb} in ${placeOf(tile)}, ${price}`,
      href: listingDetailPath(
        tile.listingKey,
        { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
        { city: tile.city, subdivision: tile.subdivisionName },
        { mlsNumber: tile.listNumber },
      ),
    }
  }
  const byNewest = (a: string | null | undefined, b: string | null | undefined) => (Date.parse(b ?? '') || 0) - (Date.parse(a ?? '') || 0)
  const newestListed = [...atlasTiles].filter((t) => t.status === 'Active' && t.onMarketDate).sort((a, b) => byNewest(a.onMarketDate, b.onMarketDate))[0]
  const newestPending = [...atlasTiles].filter((t) => (t.status === 'Pending' || t.status === 'Active Under Contract') && t.modifiedAt).sort((a, b) => byNewest(a.modifiedAt, b.modifiedAt))[0]
  const newestSold = [...atlasTiles].filter((t) => t.status === 'Closed' && t.closeDate).sort((a, b) => byNewest(a.closeDate, b.closeDate))[0]
  const atlasEvents: AtlasEvent[] = [
    newestListed ? eventOf(newestListed, 'new', 'Just listed') : null,
    newestPending ? eventOf(newestPending, 'pending', 'Went pending') : null,
    newestSold ? eventOf(newestSold, 'sold', 'Sold') : null,
  ].filter((e): e is AtlasEvent => e !== null)
  const atlasStamp = formatDateTime(new Date(nowMs))
  const atlasCities = new Set(atlasTiles.map((t) => (t.city ?? '').trim()).filter(Boolean)).size
  const atlasSource =
    `Every active and pending listing of every property type on the regional MLS through Oregon Data Share, ` +
    `across ${atlasCities} Central Oregon cities, plus the closes of the last 30 days. Counts and medians are of the listings on this map.`
  const presentTypes = new Set(atlasDots.filter((d) => d.s !== 'sold').map((d) => d.t))
  const atlasTypes = ATLAS_TYPES.filter((t) => presentTypes.has(t.key))
  const atlasRegions: AtlasRegion[] = [
    ...TOWN_ORDER.flatMap((slug, i): AtlasRegion[] => {
      const geometry = townBoundaries[i]
      if (!geometry) return []
      return [{ id: `town:${slug}`, kind: 'town', name: cityBySlug.get(slug)?.name ?? titleCaseName(slug.replace(/-/g, ' ')), href: `/cities/${slug}`, geometry }]
    }),
    ...communityBoundaries.flatMap(({ c, geometry }): AtlasRegion[] =>
      geometry ? [{ id: `community:${c.slug}`, kind: 'community', name: c.label, href: `/communities/${c.slug}`, geometry }] : [],
    ),
    ...neighborhoodBoundaries.flatMap(({ r, geometry }): AtlasRegion[] => {
      const slug = (r.slug ?? '').toLowerCase().trim()
      return geometry ? [{ id: `neighborhood:${slug}`, kind: 'neighborhood', name: r.name as string, href: `/cities/bend/${slug}`, geometry }] : []
    }),
  ]

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
      fact: v3Text('Every town, community, and neighborhood, mapped above'),
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

        <V3Atlas
          id="hero"
          variant={opening}
          headingLevel={1}
          headline={v3Text('Homes for Sale in Central Oregon')}
          dots={atlasDots}
          regions={atlasRegions}
          types={atlasTypes}
          events={atlasEvents}
          source={atlasSource}
          stamp={atlasStamp}
        >
          <HomeHeroSearch />
        </V3Atlas>

        <V3Doors id="doors" name={v3Text('Start with what you came to do')} doors={doors} />

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
            note={marketNote ? v3Text(marketNote) : undefined}
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

        {/* Seller ask sits right after the market verdict spoke to sellers
            (Matt 2026-09-01: "move it up"). Sheet after Instrument keeps the
            rhythm rule; reviews and brokers close the page instead. */}
        <SellCapture
          id="sell"
          eyebrow="Selling"
          heading="A broker's valuation of your home, within 24 hours"
          headingId="home-sell-heading"
        >
          <SellValueForm pagePath="/" formId="home-get-value" />
        </SellCapture>

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

      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
