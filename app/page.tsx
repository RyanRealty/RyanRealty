import type { Metadata } from 'next'

import { getListingTiles, getDetachedOverlays, getBrokers } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getMarketPulseAllCitySnapshots } from '@/lib/data/market/getMarketPulseSnapshot'
import {
  formatPulseCityRemainderPublic,
  namePulseCityRemainder,
  pulseCityHrefSlug,
} from '@/lib/market/pulse-city-remainder'
import { curateFeaturedTiles } from '@/lib/kb/curate-featured'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { formatPriceExact } from '@/lib/format/money'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import {
  placeFigureRows,
  communityRows,
  PLACE_COUNT_TRACE,
  type CityPlaceItem,
  type CityCommunityItem,
} from '@/app/cities/[slug]/_v3/city-sections'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Stage,
  V3Ledger,
  V3Quiet,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'
import { HomeHomesField } from './_v3/HomeHomesField'
import { HomeHeroSearch } from './_v3/HomeHeroSearch.client'
import { homeFieldItems } from './_v3/home-field-items'
import { liveStamp } from './_v3/live-format'
import {
  HERO_VIDEO,
  HERO_POSTER,
  HOME_FIELD_LIMIT,
  HOME_TILE_FETCH,
  HOME_COUNT_TRACE,
  HOME_COMMUNITY_TRACE,
  preferPlaceHero,
} from './_v3/home-constants'
import { TESTIMONIALS } from '@/lib/testimonials'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'
import { HomeAlertSheet } from './_v3/HomeAlertSheet.client'
import communityVideoManifest from '@/data/city-hero-videos.resolved.json'
import './_v3/home-page.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
// D11 seo-shell lock: this exact town list stays in source. The live hero
// count is leftover region inventory, so the count sentence names that grain.
const D11_HOMEPAGE_LEAD =
  'Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market.'
// D19 + ci:seo-shell: the count is the leftover region HUD row, and the
// sentence it sits in names the regional grain, never a town door from
// TOWN_ORDER below. ci:pulse-city-remainder reads both out of this file.
const HERO_COUNT_LEAD = 'homes for sale across Central Oregon. Live list prices and days on market.'

/**
 * Homepage. Search on the first phone screen. Photo-led homes next.
 * Market report lives on /housing-market. Every figure is live from the DAL.
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
  const [cities, communities, tiles, cityPulse, publicPace, regionOverlays, brokers] = await Promise.all([
    getCitiesForIndex().catch(() => []),
    getCommunitiesForIndex().catch(() => []),
    getListingTiles({ status: 'active', propertySubType: 'Single Family Residence', limit: HOME_TILE_FETCH }).catch(() => []),
    getMarketPulseAllCitySnapshots().catch(() => []),
    getPublicDetachedPace({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => EMPTY_PUBLIC_PACE),
    getDetachedOverlays([{ geoType: 'region', geoSlug: 'central-oregon' }]).catch(() => new Map()),
    getBrokers().catch(() => []),
  ])
  const regionMt = regionOverlays.get('region:central-oregon')
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

  const testimonialItems: V3QuietItem[] = TESTIMONIALS.slice(0, 3).map((t) => ({
    kind: 'prose' as const,
    term: t.author,
    body: t.quote,
  }))

  const townRemainder = formatPulseCityRemainderPublic(
    namePulseCityRemainder({
      regionActive: hud.active,
      displayedLabels: townItems.map((t) => t.name),
      allCities: cityPulse.map((row) => ({
        label: row.geo_label,
        active: row.active_count,
        slug: pulseCityHrefSlug(row.geo_slug || row.geo_label),
      })),
    }),
  ).join(' ')
  const [firstTownRow, ...restTownRows] = placeFigureRows(townItems, 'City')

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

  const curated = curateFeaturedTiles(
    tiles,
    townItems.map((t) => ({ name: t.name, medianPrice: t.medianPrice })),
    HOME_FIELD_LIMIT,
  )
  const fieldItems = homeFieldItems(curated, HOME_FIELD_LIMIT)

  const footerFine = townItems
    .filter((t) => t.activeCount != null && t.medianPrice != null)
    .map((t) => `${t.name} ${(t.activeCount as number).toLocaleString('en-US')} / ${formatPriceExact(t.medianPrice as number)}`)
    .join(' · ')

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
          action={{ label: 'See homes', href: publishRegionalSearchHref(), variant: 'ghost' }}
        >
          <HomeHeroSearch />
        </V3Stage>

        <HomeHomesField
          fieldItems={fieldItems}
          towns={townItems.map((t) => ({ label: t.name, href: t.href }))}
          count={
            hud.active != null
              ? {
                  value: hud.active.toLocaleString('en-US'),
                  label: HERO_COUNT_LEAD,
                  source: HOME_COUNT_TRACE,
                  updatedAt: leftoverStamp,
                }
              : undefined
          }
          emptyMessage="No photographed active single-family home with a list price and a street address returned on this refresh."
        />

        {firstTownRow ? (
          <V3Ledger
            id="towns"
            eyebrow={v3Text('Central Oregon · By town')}
            heading={v3Text('Towns')}
            rows={[firstTownRow, ...restTownRows]}
            note={townRemainder ? v3Text(townRemainder) : undefined}
            source={v3Text(PLACE_COUNT_TRACE)}
            updated={liveStamp(leftoverStamp)}
            action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
          />
        ) : (
          <V3Ledger
            id="towns"
            eyebrow={v3Text('Central Oregon · By town')}
            heading={v3Text('Towns')}
            rows={[]}
            emptyMessage={v3Text('No town returned a live market row on this refresh.')}
            action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
          />
        )}

        <V3Quiet
          id="market"
          heading="The Central Oregon market"
          items={[{ label: 'See the Central Oregon housing market', href: '/housing-market' }]}
        />

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

        <V3Quiet
          id="sell"
          heading="Selling a home"
          items={[{ label: 'Value my home', href: '/sell' }]}
        />
      </main>

      <V3Footer
        columns={V3_FOOTER_COLUMNS}
        note={footerFine ? `Active single-family by town: ${footerFine}. Figures from the MLS.` : undefined}
      />
    </>
  )
}
