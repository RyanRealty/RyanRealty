import type { Metadata } from 'next'
import {
  getFeaturedListings,
  getJustListed,
  getRecentlySold,
  getPriceDrops,
  getCommunityHighlights,
  getMarketSnapshot,
  getTrendingListings,
  getBlogPostsForHome,
} from './actions/home'
import { getBrowseCities } from './actions/listings'
import { getSavedCommunityKeys } from './actions/saved-communities'
import { getSession } from './actions/auth'
import { getSavedListingKeys } from './actions/saved-listings'
import { getLikedListingKeys } from './actions/likes'
import { getBuyingPreferences } from './actions/buying-preferences'
import { getOrCreatePlaceBanner } from './actions/banners'
import { subdivisionEntityKey } from '../lib/slug'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '../lib/mortgage'
import HomeHero from '../components/home/HomeHero'
import ExploreOnMap from '../components/home/ExploreOnMap'
import FeaturedListings from '../components/home/FeaturedListings'
import BrowseByCity from '../components/home/BrowseByCity'
import JustListed from '../components/home/JustListed'
import PopularCommunitiesRow from '../components/home/PopularCommunitiesRow'
import PriceDrops from '../components/home/PriceDrops'
import MarketCTA from '../components/home/MarketCTA'
import TrendingListings from '../components/home/TrendingListings'
import RecentlySold from '../components/home/RecentlySold'
import TrustSection from '../components/home/TrustSection'
import BlogTeaser from '../components/home/BlogTeaser'
import EmailSignup from '../components/home/EmailSignup'

const DEFAULT_HOME_CITY = 'Bend'
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/og-home.png`

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ryan Realty — Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
  description:
    'The most comprehensive Central Oregon real estate platform. Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities. Listings, market insights, and local expertise.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Ryan Realty — Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
    description:
      'The most comprehensive Central Oregon real estate platform. Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Ryan Realty — Central Oregon Real Estate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ryan Realty — Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
    description: 'The most comprehensive Central Oregon real estate platform.',
  },
}

export default async function Home() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url?.trim() || !anonKey?.trim()) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Setup required</h1>
          <p className="mt-2 text-sm">
            Add <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{' '}
            <code className="rounded bg-amber-100 px-1">.env.local</code> and restart the dev server.
          </p>
        </div>
      </main>
    )
  }

  const [session, featured, justListed, recentlySold, priceDrops, communityHighlights, marketSnapshot, trending, blogPosts, browseCities] =
    await Promise.all([
      getSession(),
      getFeaturedListings(),
      getJustListed(),
      getRecentlySold(),
      getPriceDrops(),
      getCommunityHighlights(),
      getMarketSnapshot(),
      getTrendingListings(),
      getBlogPostsForHome(),
      getBrowseCities(),
    ])

  const [savedKeys, likedKeys, savedCommunityKeys, prefs, communityBannerUrls] = await Promise.all([
    session?.user ? getSavedListingKeys() : Promise.resolve([]),
    session?.user ? getLikedListingKeys() : Promise.resolve([]),
    session?.user ? getSavedCommunityKeys() : Promise.resolve([]),
    session?.user ? getBuyingPreferences().catch(() => null) : Promise.resolve(null),
    communityHighlights.length > 0
      ? Promise.all(
          communityHighlights.map((c) =>
            getOrCreatePlaceBanner(
              'subdivision',
              subdivisionEntityKey(DEFAULT_HOME_CITY, c.subdivisionName),
              `${c.subdivisionName}, ${DEFAULT_HOME_CITY}`
            ).then((r) => r?.url ?? null)
          )
        )
      : Promise.resolve([] as string[]),
  ])

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  const marketForHero = {
    count: marketSnapshot.count,
    medianPrice: marketSnapshot.medianPrice,
    avgDom: marketSnapshot.avgDom ?? null,
  }

  const marketForCTA = {
    count: marketSnapshot.count,
    medianPrice: marketSnapshot.medianPrice,
    avgDom: marketSnapshot.avgDom ?? null,
    closedLast12Months: marketSnapshot.closedLast12Months,
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'RealEstateAgent',
                name: 'Ryan Realty',
                url: siteUrl,
                areaServed: [
                  { '@type': 'City', name: 'Bend', addressRegion: 'OR' },
                  { '@type': 'City', name: 'Redmond', addressRegion: 'OR' },
                  { '@type': 'City', name: 'Sisters', addressRegion: 'OR' },
                  { '@type': 'City', name: 'Sunriver', addressRegion: 'OR' },
                ],
              },
              {
                '@type': 'WebSite',
                name: 'Ryan Realty',
                url: siteUrl,
                potentialAction: {
                  '@type': 'SearchAction',
                  target: {
                    '@type': 'EntryPoint',
                    urlTemplate: `${siteUrl}/search?keywords={search_term_string}`,
                  },
                  'query-input': 'required name=search_term_string',
                },
              },
            ],
          }),
        }}
      />

      <HomeHero marketSnapshot={marketForHero} />

      <ExploreOnMap />

      {featured.length > 0 && (
        <FeaturedListings
          listings={featured}
          savedKeys={savedKeys}
          likedKeys={likedKeys}
          signedIn={!!session?.user}
          userEmail={session?.user?.email ?? null}
          downPaymentPercent={displayPrefs.downPaymentPercent}
          interestRate={displayPrefs.interestRate}
          loanTermYears={displayPrefs.loanTermYears}
        />
      )}

      {justListed.length > 0 && (
        <JustListed
          listings={justListed}
          savedKeys={savedKeys}
          likedKeys={likedKeys}
          signedIn={!!session?.user}
          userEmail={session?.user?.email ?? null}
          downPaymentPercent={displayPrefs.downPaymentPercent}
          interestRate={displayPrefs.interestRate}
          loanTermYears={displayPrefs.loanTermYears}
        />
      )}

      {communityHighlights.length > 0 && (
        <PopularCommunitiesRow
          city={DEFAULT_HOME_CITY}
          communities={communityHighlights}
          bannerUrls={communityBannerUrls}
          signedIn={!!session?.user}
          savedCommunityKeys={savedCommunityKeys}
        />
      )}

      {priceDrops.length > 0 && (
        <PriceDrops
          listings={priceDrops}
          savedKeys={savedKeys}
          likedKeys={likedKeys}
          signedIn={!!session?.user}
          userEmail={session?.user?.email ?? null}
          downPaymentPercent={displayPrefs.downPaymentPercent}
          interestRate={displayPrefs.interestRate}
          loanTermYears={displayPrefs.loanTermYears}
        />
      )}

      <MarketCTA stats={marketForCTA} />

      {trending.length > 0 && (
        <TrendingListings
          listings={trending}
          savedKeys={savedKeys}
          likedKeys={likedKeys}
          signedIn={!!session?.user}
          userEmail={session?.user?.email ?? null}
          downPaymentPercent={displayPrefs.downPaymentPercent}
          interestRate={displayPrefs.interestRate}
          loanTermYears={displayPrefs.loanTermYears}
        />
      )}

      {recentlySold.length > 0 && (
        <RecentlySold
          listings={recentlySold}
          savedKeys={savedKeys}
          likedKeys={likedKeys}
          signedIn={!!session?.user}
          userEmail={session?.user?.email ?? null}
          downPaymentPercent={displayPrefs.downPaymentPercent}
          interestRate={displayPrefs.interestRate}
          loanTermYears={displayPrefs.loanTermYears}
        />
      )}

      <BrowseByCity cities={browseCities} />

      <TrustSection />

      {blogPosts.length > 0 && <BlogTeaser posts={blogPosts} />}

      <EmailSignup />
    </main>
  )
}
