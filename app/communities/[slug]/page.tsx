import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getCommunityBySlug,
  getCommunityListings,
  getCommunitySoldListings,
  getCommunityPriceHistory,
  getCommunityMarketStats,
} from '@/app/actions/communities'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { trackPageView } from '@/lib/followupboss'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import CommunityHero from '@/components/community/CommunityHero'
import CommunityOverview from '@/components/community/CommunityOverview'
import CommunityMarketStats from '@/components/community/CommunityMarketStats'
import CommunityListings from '@/components/community/CommunityListings'
import CommunityMap from '@/components/community/CommunityMap'
import CommunityContext from '@/components/community/CommunityContext'
import CommunityCTA from '@/components/community/CommunityCTA'
import CommunityPageTracker from '@/components/community/CommunityPageTracker'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) return { title: 'Community Not Found' }
  const title = `${community.name} Homes for Sale | ${community.city}, Oregon | Ryan Realty`
  const description = community.activeCount > 0
    ? `${community.activeCount} homes for sale in ${community.name}. Median price ${community.medianPrice != null ? `$${community.medianPrice.toLocaleString()}` : '—'}. Explore listings and market stats.`
    : `Explore ${community.name} in ${community.city}, Oregon. Community info and market overview.`
  const canonical = `${siteUrl}/communities/${slug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: 'Ryan Realty', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export const dynamic = 'force-dynamic'

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()

  const session = await getSession()
  const pageUrl = `${siteUrl}/communities/${slug}`
  const pageTitle = `${community.name} Homes for Sale | ${community.city}, Oregon | Ryan Realty`
  if (session?.user?.email) {
    trackPageView({ user: session.user, pageUrl, pageTitle }).catch(() => {})
  }
  const [listings, soldListings, priceHistory, marketStats, savedKeys, likedKeys, prefs] =
    await Promise.all([
      getCommunityListings(community.city, community.subdivision, 24),
      getCommunitySoldListings(community.city, community.subdivision, 6),
      getCommunityPriceHistory(community.city, community.subdivision),
      getCommunityMarketStats(community.city, community.subdivision),
      session?.user ? getSavedListingKeys() : Promise.resolve([]),
      session?.user ? getLikedListingKeys() : Promise.resolve([]),
      session?.user ? getBuyingPreferences().catch(() => null) : Promise.resolve(null),
    ])

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  const centroid = (() => {
    const withCoords = listings.filter(
      (l) => l.Latitude != null && l.Longitude != null && Number.isFinite(Number(l.Latitude)) && Number.isFinite(Number(l.Longitude))
    )
    if (withCoords.length === 0) return null
    const lat = withCoords.reduce((a, l) => a + Number(l.Latitude), 0) / withCoords.length
    const lng = withCoords.reduce((a, l) => a + Number(l.Longitude), 0) / withCoords.length
    return { lat, lng }
  })()

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: community.name,
            address: { addressLocality: community.city, addressRegion: 'OR' },
            ...(centroid && {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: centroid.lat,
                longitude: centroid.lng,
              },
            }),
            url: `${siteUrl}/communities/${slug}`,
          }),
        }}
      />

      <CommunityPageTracker
        communityName={community.name}
        listingCount={community.activeCount}
        medianPrice={community.medianPrice}
      />

      <CommunityHero
        name={community.name}
        city={community.city}
        heroImageUrl={community.heroImageUrl}
        activeCount={community.activeCount}
        medianPrice={community.medianPrice}
        avgDom={community.avgDom}
        isResort={community.isResort}
      />

      <CommunityOverview
        description={community.description}
        isResort={community.isResort}
        resortContent={community.resortContent}
        communityName={community.name}
        city={community.city}
        listings={listings}
      />

      <CommunityMarketStats
        communityName={community.name}
        slug={slug}
        stats={{
          medianPrice: community.medianPrice,
          count: community.activeCount,
          avgDom: community.avgDom,
          closedLast12Months: community.closedLast12Months,
        }}
        priceHistory={priceHistory}
      />

      <CommunityListings
        communityName={community.name}
        slug={slug}
        city={community.city}
        subdivision={community.subdivision}
        listings={listings}
        soldListings={soldListings}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        displayPrefs={displayPrefs}
      />

      <CommunityMap
        boundaryGeojson={community.boundaryGeojson}
        listings={listings}
        communityName={community.name}
      />

      <CommunityContext
        communityName={community.name}
        city={community.city}
        currentSlug={slug}
      />

      <CommunityCTA communityName={community.name} slug={slug} />
    </main>
  )
}
