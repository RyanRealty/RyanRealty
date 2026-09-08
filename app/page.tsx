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
  V3Pulse,
} from '@/components/site/v3'
import { HomeHomesRails } from './_v3/HomeHomesRails'
import { loadHomePulse } from './_v3/home-pulse'
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
 * metadata title/OG only, as the tail of the keyword title Matt picked
 * 2026-09-07. absolute title skips the layout suffix.
 */
export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Homes for Sale in Central Oregon | Ryan Realty, Bend' },
  description:
    `Active homes for sale in ${D11_HOMEPAGE_LEAD} Closed comps from the regional MLS.`,
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Homes for Sale in Central Oregon | Ryan Realty, Bend',
    description:
      'Active homes for sale in Bend, Redmond, Sisters, and Sunriver. Live list prices, days on market, and closed comps.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Homes for Sale in Central Oregon | Ryan Realty, Bend' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Homes for Sale in Central Oregon | Ryan Realty, Bend',
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
  const [cities, tiles, brokers, openHouseLabels, reviewSummary, featuredCommunitySlides, pulse] =
    await Promise.all([
      getCitiesForIndex().catch(() => []),
      getListingTiles({ status: 'active', limit: HOME_TILE_FETCH, sort: 'newest' }).catch(() => []),
      getBrokers().catch(() => []),
      loadOpenHouseBadgeLabels().catch(() => ({})),
      getReviews(6).catch(() => null),
      loadHomeFeaturedCommunitySlides().catch((err) => {
        console.error('[home] featured community loader failed', err)
        return []
      }),
      // The same cached region population the chrome already read. SITE-12
      // moved "Central Oregon right now" out of the Homes dropdown to here.
      loadHomePulse().catch((err) => {
        console.error('[home] live pulse loader failed', err)
        return null
      }),
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
      // The third door was the only one with no line under it (2026-09-08
      // evaluator). The count is the live broker roster this page already read
      // and prints as faces below; the rest of the sentence is the brokerage's
      // own description of itself (VOICE.md, Matt 2026-09-07). Omitted rather
      // than guessed when the roster read gives nothing.
      ...(faces.length > 0
        ? {
            fact: v3Text(
              faces.length === 1
                ? 'One broker who lives and works here'
                : `${faces.length} brokers who live and work here`,
            ),
          }
        : {}),
      pictogram: 'work',
    },
  ] as const

  // Two labelled runs, not twelve identical boxes (2026-09-08 evaluator). The
  // town chips carry the live active count from getCitiesForIndex — `activeCount`
  // is null when that city's inventory is unmeasured and 0 is a measured empty,
  // so a null prints nothing rather than a zero (section 0). The resorts run
  // carries no figure because this page holds no per-resort read; /communities
  // owns those.
  const placeRuns = [
    {
      name: 'Towns',
      // What the figures count, said once for the run: `activeCount` is
      // geo_snapshot_mv's active_sfr_count, the detached single-family actives,
      // which is the same figure and the same read /cities publishes per city.
      unit: 'houses for sale',
      seeAll: { label: 'Every city', href: '/cities' },
      doors: TOWN_ORDER.map((slug) => {
        const live = cityBySlug.get(slug)
        const active = live?.activeCount
        return {
          label: live?.name ?? TOWN_LABEL[slug],
          href: `/cities/${slug}`,
          ...(typeof active === 'number' && Number.isFinite(active)
            ? { count: active.toLocaleString('en-US') }
            : {}),
        }
      }),
    },
    {
      name: 'Resorts and communities',
      seeAll: { label: 'Every community', href: '/communities' },
      doors: RESORT_DOORS.map((r) => ({ label: r.label, href: r.href })),
    },
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
          // Sell mode swaps the copy with the panel, so the line over the
          // address field is a seller's question and not a buyer's headline.
          // The h1 above is the page's one heading either way.
          altEyebrow="Selling in Central Oregon"
          altHeadline="What is your home worth?"
          posterSrc={heroPosterSrc}
          videoSrc={HERO_VIDEO}
        >
          <HomeHeroSearch valuationHref={valuationHref('/')} />
        </V3Stage>

        {/* The live read, under the search. Absent — never zeroed — when the
            listing read gives nothing: a count of no listings across Central
            Oregon is a fact about the read, not about the market (section 0). */}
        {pulse ? <V3Pulse {...pulse} id="right-now" /> : null}

        <HomeHomesRails
          rows={railRows}
          emptyMessage="No active homes with a photo and list price right now."
        />

        <HomeFeaturedCommunity id="featured-community" slides={featuredCommunitySlides} />

        <V3Doors id="doors" name={v3Text('Buy, sell, or work with us')} doors={doors} />

        {faces.length > 0 ? (
          <AboutFaces people={faces} heading="Talk to a broker" headingLevel={2} size="compact" />
        ) : null}

        <HomeBrowsePlaces id="places" runs={placeRuns} />

        {reviewQuotes.length > 0 ? (
          <V3Proof
            id="proof"
            eyebrow="Google reviews"
            headline="What clients say"
            headingLevel={2}
            claim="What our clients say about working with us. Every review is from Google, as written."
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
