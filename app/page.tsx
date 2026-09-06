import type { Metadata } from 'next'

import { valuationHref } from '@/lib/site/valuation-href'
import { getListingTiles, getBrokers, getReviews } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Stage,
  V3Doors,
  V3Quiet,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  V3Proof,
  type V3QuietItem,
} from '@/components/site/v3'
import { HomeHomesRails } from './_v3/HomeHomesRails'
import { HomeHeroSearch } from './_v3/HomeHeroSearch.client'
import { homeRailRows } from './_v3/home-rail-items'
import {
  HERO_VIDEO,
  HERO_POSTER,
  HOME_TILE_FETCH,
} from './_v3/home-constants'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
// D11 seo-shell lock: this exact town list stays in source (metadata).
const D11_HOMEPAGE_LEAD =
  'Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market.'

/**
 * Homepage. Expanded Home lock 2026-09-06 (Matt, after Zillow+Redfin compare):
 * full-bleed search hero, stacked Zillow-style house carousels, illustrated
 * Buy/Sell/Invest doors, talk to a broker, browse places chips, proof, denser
 * footer. No Atlas, map block, town ledger, or market essay on home. absolute
 * title skips the layout suffix so the SERP is brand once.
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

const TOWN_ORDER = ['bend', 'la-pine', 'redmond', 'sunriver', 'sisters', 'terrebonne'] as const

const TOWN_LABEL: Record<(typeof TOWN_ORDER)[number], string> = {
  bend: 'Bend',
  'la-pine': 'La Pine',
  redmond: 'Redmond',
  sunriver: 'Sunriver',
  sisters: 'Sisters',
  terrebonne: 'Terrebonne',
}

/** Resort doors on home. Names only. Counts live on /communities. */
const RESORT_DOORS = [
  { label: 'Tetherow', href: '/communities/tetherow' },
  { label: 'Broken Top', href: '/communities/broken-top' },
  { label: 'Black Butte Ranch', href: '/communities/black-butte-ranch' },
  { label: 'Eagle Crest', href: '/communities/eagle-crest' },
] as const

const DOOR_ART = {
  buy: '/images/homepage/bend-drake-park-aerial.jpg',
  sell: '/images/homepage/tetherow-golf-aerial.jpg',
  invest: '/images/homepage/smith-rock-terrebonne.jpg',
} as const

export default async function Home() {
  const [cities, tiles, brokers, investSegments, reviewSummary] = await Promise.all([
    getCitiesForIndex().catch(() => []),
    getListingTiles({ status: 'active', limit: HOME_TILE_FETCH, sort: 'newest' }).catch(() => []),
    getBrokers().catch(() => []),
    getPublicPlaceSegments({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => []),
    getReviews(6).catch(() => null),
  ])

  const cityBySlug = new Map(cities.map((c) => [c.slug, c]))
  const faces: AboutFace[] = [...brokers]
    .sort((a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9))
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  const railRows = homeRailRows(tiles, {
    nowMs: Date.now(),
    regionalHref: publishRegionalSearchHref(),
    bendHref: '/homes-for-sale/bend',
    priceCutsHref: '/price-drops',
    newHref: '/homes-for-sale?view=list&sort=newest',
  })

  const investDoorSegments = new Set(['multifamily_2_4', 'commercial_sale', 'land'])
  const investCount = investSegments
    .filter((row) => investDoorSegments.has(row.segment))
    .reduce((sum, row) => sum + (row.activeCount ?? 0), 0)

  const townCount = TOWN_ORDER.filter((slug) => cityBySlug.has(slug)).length || TOWN_ORDER.length

  const doors = [
    {
      kicker: v3Text('Buy'),
      label: v3Text('Find your place'),
      href: '/homes-for-sale?view=map',
      fact: v3Text(`${townCount} towns across Central Oregon`),
      imageSrc: DOOR_ART.buy,
      imageAlt: 'Bend from above at Drake Park',
    },
    {
      kicker: v3Text('Sell'),
      label: v3Text('Value my home'),
      href: valuationHref('/'),
      fact: v3Text('A written valuation within 24 hours'),
      imageSrc: DOOR_ART.sell,
      imageAlt: 'Tetherow fairways in Bend',
    },
    {
      kicker: v3Text('Invest'),
      label: v3Text('Income property, with the math'),
      href: '/invest',
      imageSrc: DOOR_ART.invest,
      imageAlt: 'Smith Rock near Terrebonne',
      ...(investCount > 0
        ? { fact: v3Text(`${investCount.toLocaleString('en-US')} income and land listings`) }
        : {}),
    },
  ] as const

  const placeItems: V3QuietItem[] = [
    ...TOWN_ORDER.map((slug) => {
      const live = cityBySlug.get(slug)
      return {
        label: live?.name ?? TOWN_LABEL[slug],
        href: `/cities/${slug}`,
      }
    }),
    ...RESORT_DOORS.map((r) => ({ label: r.label, href: r.href })),
    { label: 'Every city', href: '/cities' },
    { label: 'Resorts and communities', href: '/communities' },
  ]

  const reviewQuotes = reviewSummary ? toReviewQuotes(reviewSummary.reviews).slice(0, 4) : []
  const reviewCount =
    reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : reviewQuotes.length
  const reviewAverage =
    reviewSummary && reviewSummary.count > 0 ? reviewSummary.averageRating : 5

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />

        <V3Stage
          id="hero"
          headingLevel={1}
          height="tall"
          eyebrow="Central Oregon"
          headline={v3Text('Ryan Realty, Bend')}
          posterSrc={HERO_POSTER}
          videoSrc={HERO_VIDEO}
        >
          <p className="home-hero-search__job">Find homes in Central Oregon</p>
          <HomeHeroSearch />
        </V3Stage>

        <HomeHomesRails
          rows={railRows}
          emptyMessage="No photographed active home with a list price and a street address returned on this refresh."
        />

        <V3Doors id="doors" name={v3Text('Start with what you came to do')} doors={doors} />

        {faces.length > 0 ? (
          <AboutFaces people={faces} heading="Talk to a broker" headingLevel={2} />
        ) : null}

        <V3Quiet
          id="places"
          eyebrow="Central Oregon"
          heading="Browse places"
          headingLevel={2}
          items={placeItems}
        />

        {reviewQuotes.length > 0 ? (
          <V3Proof
            id="proof"
            eyebrow="Ryan Realty · Google"
            headline={`${reviewCount} Google reviews`}
            headingLevel={2}
            claim={`${reviewAverage.toFixed(1)} of 5 across ${reviewCount} reviews. The newest four, in full, as written.`}
            figures={[]}
            quotes={reviewQuotes}
            source={{ label: 'Every review', href: '/reviews' }}
            record={false}
          />
        ) : null}
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
