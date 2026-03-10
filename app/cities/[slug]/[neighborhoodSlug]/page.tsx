import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getNeighborhoodBySlug,
  getNeighborhoodListings,
  getNeighborhoodSoldListings,
} from '@/app/actions/cities'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { trackPageView } from '@/lib/followupboss'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import NeighborhoodHero from '@/components/neighborhood/NeighborhoodHero'
import NeighborhoodOverview from '@/components/neighborhood/NeighborhoodOverview'
import NeighborhoodListings from '@/components/neighborhood/NeighborhoodListings'
import NeighborhoodMap from '@/components/neighborhood/NeighborhoodMap'
import NeighborhoodCTA from '@/components/neighborhood/NeighborhoodCTA'
import NeighborhoodPageTracker from '@/components/neighborhood/NeighborhoodPageTracker'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

type Props = { params: Promise<{ slug: string; neighborhoodSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) return { title: 'Neighborhood Not Found' }
  const title = `${neighborhood.name} in ${neighborhood.cityName}, Oregon | Homes for Sale | Ryan Realty`
  const description =
    neighborhood.activeCount > 0
      ? `${neighborhood.activeCount} homes for sale in ${neighborhood.name}, ${neighborhood.cityName}. Median price ${neighborhood.medianPrice != null ? `$${neighborhood.medianPrice.toLocaleString()}` : '—'}.`
      : `Explore ${neighborhood.name} in ${neighborhood.cityName}, Oregon.`
  const canonical = `${siteUrl}/cities/${citySlug}/${neighborhoodSlug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: 'Ryan Realty', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export const dynamic = 'force-dynamic'

export default async function NeighborhoodDetailPage({ params }: Props) {
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const session = await getSession()
  const pageUrl = `${siteUrl}/cities/${citySlug}/${neighborhoodSlug}`
  const pageTitle = `${neighborhood.name} in ${neighborhood.cityName}, Oregon | Ryan Realty`
  if (session?.user?.email) {
    trackPageView({ user: session.user, pageUrl, pageTitle }).catch(() => {})
  }

  const [listings, soldListings, savedKeys, likedKeys, prefs] = await Promise.all([
    getNeighborhoodListings(neighborhood.id, 24),
    getNeighborhoodSoldListings(neighborhood.id, 6),
    session?.user ? getSavedListingKeys() : Promise.resolve([]),
    session?.user ? getLikedListingKeys() : Promise.resolve([]),
    session?.user ? getBuyingPreferences().catch(() => null) : Promise.resolve(null),
  ])

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  const geo = (() => {
    const withCoords = listings.filter(
      (l) =>
        l.Latitude != null &&
        l.Longitude != null &&
        Number.isFinite(Number(l.Latitude)) &&
        Number.isFinite(Number(l.Longitude))
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
            name: neighborhood.name,
            address: {
              addressLocality: neighborhood.cityName,
              addressRegion: 'OR',
              addressCountry: 'US',
            },
            ...(geo && {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: geo.lat,
                longitude: geo.lng,
              },
            }),
            url: `${siteUrl}/cities/${citySlug}/${neighborhoodSlug}`,
          }),
        }}
      />

      <NeighborhoodPageTracker
        neighborhoodName={neighborhood.name}
        cityName={neighborhood.cityName}
        citySlug={citySlug}
        neighborhoodSlug={neighborhoodSlug}
        listingCount={neighborhood.activeCount}
        medianPrice={neighborhood.medianPrice}
      />

      <NeighborhoodHero
        name={neighborhood.name}
        cityName={neighborhood.cityName}
        citySlug={citySlug}
        heroImageUrl={neighborhood.heroImageUrl}
        activeCount={neighborhood.activeCount}
        medianPrice={neighborhood.medianPrice}
      />

      <NeighborhoodOverview
        neighborhoodName={neighborhood.name}
        cityName={neighborhood.cityName}
        citySlug={citySlug}
        description={neighborhood.description}
      />

      <NeighborhoodListings
        neighborhoodName={neighborhood.name}
        citySlug={citySlug}
        listings={listings}
        soldListings={soldListings}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        displayPrefs={displayPrefs}
      />

      <NeighborhoodMap listings={listings} neighborhoodName={neighborhood.name} />

      <NeighborhoodCTA
        neighborhoodName={neighborhood.name}
        cityName={neighborhood.cityName}
        citySlug={citySlug}
      />
    </main>
  )
}
