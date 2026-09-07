import type { Metadata } from 'next'

import { valuationHref } from '@/lib/site/valuation-href'
import { getListingTiles, getBrokers, getReviews, attachListingCardExtras } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { loadOpenHouseBadgeLabels } from '@/lib/listing/load-open-house-badge-labels'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Stage,
  V3Doors,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  V3Proof,
} from '@/components/site/v3'
import { HomeHomesRails } from './_v3/HomeHomesRails'
import { HomeHeroSearch } from './_v3/HomeHeroSearch.client'
import { HomeBrowsePlaces } from './_v3/HomeBrowsePlaces'
import { HomeFeaturedCommunity } from './_v3/HomeFeaturedCommunity.client'
import { loadHomeFeaturedCommunitySlides } from './_v3/home-featured-communities'
import { homeRailRows, enrichHomeRailRows } from './_v3/home-rail-items'
import {
  HERO_VIDEO,
  HERO_POSTER,
  HOME_TILE_FETCH,
  preferPlaceHero,
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
 * Homepage. Expanded Home lock 2026-09-06 (Matt): full-bleed search hero with
 * Buy/Sell tabs, buyer H1, stacked house carousels with Field badges,
 * featured community carousel (photo, sales, blurb, prev/next), Buy/Sell/Work-with-us
 * doors with line pictograms, brokers, places, proof. No Atlas, map block, town ledger,
 * market essay, or Invest door on home. Brand stays in
 * metadata title/OG only. absolute title skips the layout suffix.
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

export default async function Home() {
  const [cities, tiles, brokers, openHouseLabels, reviewSummary, featuredCommunitySlides] =
    await Promise.all([
      getCitiesForIndex().catch(() => []),
      getListingTiles({ status: 'active', limit: HOME_TILE_FETCH, sort: 'newest' }).catch(() => []),
      getBrokers().catch(() => []),
      loadOpenHouseBadgeLabels().catch(() => ({})),
      getReviews(6).catch(() => null),
      loadHomeFeaturedCommunitySlides().catch(() => []),
    ])

  const cityBySlug = new Map(cities.map((c) => [c.slug, c]))
  const faces: AboutFace[] = [...brokers]
    .sort((a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9))
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  const railRowsRaw = homeRailRows(tiles, {
    nowMs: Date.now(),
    regionalHref: publishRegionalSearchHref(),
    bendHref: '/homes-for-sale/bend',
    priceCutsHref: '/price-drops',
    newHref: '/homes-for-sale?view=list&sort=newest',
    openHouseLabels,
  })
  const railKeys = railRowsRaw.flatMap((row) => row.cards.map((card) => card.listingKey))
  const railExtras = await attachListingCardExtras(railKeys).catch(
    () => new Map(),
  )
  const railRows = enrichHomeRailRows(railRowsRaw, railExtras)

  const townCount = TOWN_ORDER.filter((slug) => cityBySlug.has(slug)).length || TOWN_ORDER.length

  const doors = [
    {
      kicker: v3Text('Buy'),
      label: v3Text('Buy a home'),
      href: publishRegionalSearchHref(),
      fact: v3Text(`${townCount} towns across Central Oregon`),
      pictogram: 'buy',
    },
    {
      kicker: v3Text('Sell'),
      label: v3Text('Sell a home'),
      href: valuationHref('/'),
      fact: v3Text('Written valuation in 24 hours'),
      pictogram: 'sell',
    },
    {
      kicker: v3Text('Join'),
      label: v3Text('Work with us'),
      href: '/join',
      pictogram: 'work',
    },
  ] as const

  const placeDoors = [
    ...TOWN_ORDER.map((slug) => {
      const live = cityBySlug.get(slug)
      return {
        label: live?.name ?? TOWN_LABEL[slug],
        href: `/cities/${slug}`,
      }
    }),
    ...RESORT_DOORS.map((r) => ({
      label: r.label,
      href: r.href,
    })),
    { label: 'Every city', href: '/cities' },
    { label: 'Resorts and communities', href: '/communities' },
  ]

  // Live Bend place-row hero wins over the static Old Mill poster (G30).
  const heroPosterSrc = preferPlaceHero(cityBySlug.get('bend')?.heroImageUrl, HERO_POSTER)

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
          headline={v3Text('Homes for sale in Central Oregon')}
          posterSrc={heroPosterSrc}
          videoSrc={HERO_VIDEO}
        >
          <HomeHeroSearch valuationHref={valuationHref('/')} />
        </V3Stage>

        <HomeHomesRails
          rows={railRows}
          emptyMessage="No active homes with a photo and list price right now."
        />

        {featuredCommunitySlides.length > 0 ? (
          <HomeFeaturedCommunity id="featured-community" slides={featuredCommunitySlides} />
        ) : null}

        <V3Doors id="doors" name={v3Text('Buy, sell, or work with us')} doors={doors} />

        {faces.length > 0 ? (
          <AboutFaces people={faces} heading="Talk to a broker" headingLevel={2} />
        ) : null}

        <HomeBrowsePlaces id="places" doors={placeDoors} />

        {reviewQuotes.length > 0 ? (
          <V3Proof
            id="proof"
            eyebrow="Google reviews"
            headline="What clients say"
            headingLevel={2}
            claim="Verified Google reviews from closings we handled."
            figures={[
              { value: reviewAverage.toFixed(1), label: 'Average rating' },
              { value: String(reviewCount), label: 'Google reviews' },
            ]}
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
