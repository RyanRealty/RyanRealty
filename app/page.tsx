import type { Metadata } from 'next'
import { getBrokerageSettings } from './actions/brokerage'
import {
  getFeaturedListings,
  getRecentlySold,
  getCommunityHighlights,
  getMarketSnapshot,
  getTrendingListings,
  getBlogPostsForHome,
} from './actions/home'
import { getCityFromSlug } from './actions/listings'
import { filterToPrimaryCitiesOnly } from '../lib/cities'
import { getSavedCommunityKeys } from './actions/saved-communities'
import { getSavedCitySlugs } from './actions/saved-cities'
import { getSession } from './actions/auth'
import { getSavedListingKeys } from './actions/saved-listings'
import { getLikedListingKeys } from './actions/likes'
import { getBuyingPreferences } from './actions/buying-preferences'
import { getBannersBatch } from './actions/banners'
import { getCitiesForIndex } from './actions/cities'
import { getEngagementCountsBatch } from './actions/engagement'
import { subdivisionEntityKey } from '../lib/slug'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '../lib/mortgage'
import HomeHero from '../components/home/HomeHero'
import FeaturedListings from '../components/home/FeaturedListings'
import AffordabilityRow from '../components/home/AffordabilityRow'
import TrendingListings from '../components/home/TrendingListings'
import BrowseByCity from '../components/home/BrowseByCity'
import PopularCommunitiesRow from '../components/home/PopularCommunitiesRow'
import RecentlySold from '../components/home/RecentlySold'
import TrustSection from '../components/home/TrustSection'
import BlogTeaser from '../components/home/BlogTeaser'
import EmailSignup from '../components/home/EmailSignup'
const DEFAULT_HOME_CITY = 'Bend'
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/og-home.png`

export const revalidate = 60

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

type HomeProps = { searchParams?: Promise<{ city?: string }> }

export default async function Home(props: HomeProps) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url?.trim() || !anonKey?.trim()) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-6 text-foreground">
          <h1 className="text-xl font-semibold">Setup required</h1>
          <p className="mt-2 text-sm">
            Add <code className="rounded bg-warning/15 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-warning/15 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{' '}
            <code className="rounded bg-warning/15 px-1">.env.local</code> and restart the dev server.
          </p>
        </div>
      </main>
    )
  }

  const searchParams = (await (props.searchParams ?? Promise.resolve({}))) as Record<string, string | string[] | undefined>
  const citySlug = (typeof searchParams?.city === 'string' ? searchParams.city : '') || 'bend'
  const currentCityName = (await getCityFromSlug(citySlug)) ?? DEFAULT_HOME_CITY

  // Single parallel fetch — no waterfall. Session-dependent calls use .then() chaining.
  const sessionPromise = getSession()
  const featuredPromise = getFeaturedListings(currentCityName)
  const trendingPromise = getTrendingListings(currentCityName)
  const recentlySoldPromise = getRecentlySold(currentCityName)
  const communityHighlightsPromise = getCommunityHighlights()

  const [
    session, brokerage, featured, recentlySold, communityHighlights,
    marketSnapshot, trending, blogPosts, citiesForSlider,
    savedKeys, likedKeys, savedCommunityKeys, savedCitySlugs, prefs,
  ] = await Promise.all([
    sessionPromise,
    getBrokerageSettings(),
    featuredPromise,
    recentlySoldPromise,
    communityHighlightsPromise,
    getMarketSnapshot(),
    trendingPromise,
    getBlogPostsForHome(),
    getCitiesForIndex(),
    // User-specific data — chain off session to avoid waterfall
    sessionPromise.then((s) => s?.user ? getSavedListingKeys() : []),
    sessionPromise.then((s) => s?.user ? getLikedListingKeys() : []),
    sessionPromise.then((s) => s?.user ? getSavedCommunityKeys() : []),
    sessionPromise.then((s) => s?.user ? getSavedCitySlugs() : []),
    sessionPromise.then((s) => s?.user ? getBuyingPreferences().catch(() => null) : null),
  ])

  // Engagement counts + community banners — parallel, after listings resolve
  const allListingKeys = [
    ...featured.map((r) => (r.ListingKey ?? r.ListNumber ?? '').toString().trim()).filter(Boolean),
    ...trending.map((r) => (r.ListingKey ?? r.ListNumber ?? '').toString().trim()).filter(Boolean),
    ...recentlySold.map((r) => (r.ListingKey ?? r.ListNumber ?? '').toString().trim()).filter(Boolean),
  ]
  const [engagementCounts, communityBannerUrls] = await Promise.all([
    allListingKeys.length > 0 ? getEngagementCountsBatch(allListingKeys) : {},
    communityHighlights.length > 0
      ? getBannersBatch(
          'subdivision',
          communityHighlights.map((c) => subdivisionEntityKey(currentCityName, c.subdivisionName))
        ).then((bannerMap) =>
          communityHighlights.map((c) => {
            const key = subdivisionEntityKey(currentCityName, c.subdivisionName)
            return bannerMap.get(key)?.url ?? null
          })
        ).catch(() => [] as (string | null)[])
      : Promise.resolve([] as (string | null)[]),
  ])

  // Explore by city / Browse by city: only primary Central Oregon cities (Bend, Redmond, Sisters, etc.)
  const sortedSliderCities = filterToPrimaryCitiesOnly(citiesForSlider)

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
    <main className="min-h-screen bg-background">
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
                    urlTemplate: `${siteUrl}/homes-for-sale?keywords={search_term_string}`,
                  },
                  'query-input': 'required name=search_term_string',
                },
              },
            ],
          }),
        }}
      />

      <HomeHero
        marketSnapshot={marketForHero}
        heroVideoUrl={brokerage?.hero_video_url?.trim() || '/videos/hero.mp4'}
        heroImageUrl={brokerage?.hero_image_url ?? null}
      />

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
          engagementCounts={engagementCounts}
        />
      )}

      {featured.length > 0 && (
        <AffordabilityRow
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
          engagementCounts={engagementCounts}
        />
      )}

      {communityHighlights.length > 0 && (
        <PopularCommunitiesRow
          city={currentCityName}
          communities={communityHighlights}
          bannerUrls={communityBannerUrls}
          signedIn={!!session?.user}
          savedCommunityKeys={savedCommunityKeys}
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
          engagementCounts={engagementCounts}
        />
      )}

      <BrowseByCity
        cities={sortedSliderCities}
        savedSlugs={savedCitySlugs}
        signedIn={!!session?.user}
      />

      <TrustSection />

      {blogPosts.length > 0 && <BlogTeaser posts={blogPosts} />}

      <EmailSignup />
    </main>
  )
}
