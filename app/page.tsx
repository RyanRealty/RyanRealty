import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import {
  getBrowseCities,
  getCityCentroid,
  getCityStatusCounts,
  getListingsForHomeTiles,
  getHomeTileRowsByKeys,
  getHotCommunitiesInCity,
} from './actions/listings'
import { getTrendingListingKeys } from './actions/listing-views'
import { getSession } from './actions/auth'
import { getSavedListingKeys } from './actions/saved-listings'
import { getSavedCommunityKeys } from './actions/saved-communities'
import { getBuyingPreferences } from './actions/buying-preferences'
import { getOrCreatePlaceBanner } from './actions/banners'
import { cityEntityKey, subdivisionEntityKey } from '../lib/slug'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '../lib/mortgage'
import ListingMapGoogle from '../components/ListingMapGoogle'
import { getGeocodedListings } from './actions/geocode'
import HeroSearchOverlay from '../components/HeroSearchOverlay'
import HomeTilesSlider from '../components/home/HomeTilesSlider'
import HomeCollapsibleMap from '../components/home/HomeCollapsibleMap'
import AffordabilityRow from '../components/home/AffordabilityRow'
import PopularCommunitiesRow from '../components/home/PopularCommunitiesRow'
import CityTile from '../components/CityTile'

const DEFAULT_HOME_CITY = 'Bend'
const RECENT_VIEWED_COOKIE = 'recent_listing_views'

/** Fallback map center when no listing coords (Central Oregon cities). */
const FALLBACK_CITY_CENTERS: Record<string, { latitude: number; longitude: number; zoom: number }> = {
  bend: { latitude: 44.0582, longitude: -121.3153, zoom: 11 },
  'la-pine': { latitude: 43.6704, longitude: -121.5036, zoom: 11 },
  redmond: { latitude: 44.2726, longitude: -121.1739, zoom: 11 },
  sisters: { latitude: 44.2912, longitude: -121.5492, zoom: 11 },
  sunriver: { latitude: 43.884, longitude: -121.4386, zoom: 12 },
  prineville: { latitude: 44.299, longitude: -120.8345, zoom: 11 },
  madras: { latitude: 44.6335, longitude: -121.1295, zoom: 11 },
  terrebonne: { latitude: 44.3529, longitude: -121.1778, zoom: 12 },
  culver: { latitude: 44.5254, longitude: -121.2114, zoom: 12 },
}

function slugifyCity(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

/** Always render with fresh data so production matches localhost (no stale static build). */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Central Oregon Homes for Sale',
  description: 'Search Central Oregon homes for sale. Browse listings by city and neighborhood, view maps, and find your next home with Ryan Realty.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Ryan Realty | Central Oregon Homes for Sale',
    description: 'Search Central Oregon homes for sale. Browse listings, maps, and find your next home.',
    url: siteUrl,
    type: 'website',
    siteName: 'Ryan Realty',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ryan Realty | Central Oregon Homes for Sale',
    description: 'Search Central Oregon homes for sale. Browse listings, maps, and find your next home.',
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

  const cookieStore = await cookies()
  const [session, cities] = await Promise.all([
    getSession(),
    getBrowseCities(),
  ])

  // Homepage is always static: use default city for main content (Homes for You, map, browse). No profile/cookie for primary content.
  const validCity = cities.find((c) => c.City === DEFAULT_HOME_CITY)?.City ?? DEFAULT_HOME_CITY

  const prefsForFetch = session?.user ? await getBuyingPreferences().catch(() => null) : null
  const homeTilesFilters =
    prefsForFetch && (prefsForFetch.maxPrice != null || prefsForFetch.minBeds != null || prefsForFetch.minBaths != null)
      ? {
          maxPrice: prefsForFetch.maxPrice ?? undefined,
          minBeds: prefsForFetch.minBeds ?? undefined,
          minBaths: prefsForFetch.minBaths ?? undefined,
        }
      : undefined

  const recentViewedRaw = cookieStore.get(RECENT_VIEWED_COOKIE)?.value
  let recentViewedKeys: string[] = []
  try {
    if (recentViewedRaw) {
      const parsed = JSON.parse(decodeURIComponent(recentViewedRaw))
      if (Array.isArray(parsed)) recentViewedKeys = parsed.map((k: unknown) => String(k ?? '').trim()).filter(Boolean)
    }
  } catch { /* ignore */ }

  const [
    homeTilesListings,
    affordabilityPoolListings,
    bannerResult,
    mapCenter,
    cityStatusCounts,
    trendingListings,
    hotCommunities,
    recentViewedListingsRaw,
    fallbackListings,
  ] = await Promise.all([
    getListingsForHomeTiles({
      city: validCity,
      limit: 16,
      ...(homeTilesFilters && {
        maxPrice: homeTilesFilters.maxPrice,
        minBeds: homeTilesFilters.minBeds,
        minBaths: homeTilesFilters.minBaths,
      }),
    }),
    getListingsForHomeTiles({ city: validCity, limit: 40 }),
    getOrCreatePlaceBanner('city', cityEntityKey(validCity), `${validCity} Oregon`),
    getCityCentroid(validCity).then((c) =>
      c ? { latitude: c.lat, longitude: c.lng, zoom: 11 as number } : null
    ),
    getCityStatusCounts({ city: validCity }),
    getTrendingListingKeys(validCity, 16).then(async (keys) => {
      if (keys.length === 0) return []
      const rows = await getHomeTileRowsByKeys(keys)
      return rows.filter(
        (r) =>
          (r.StandardStatus ?? '').toLowerCase().includes('active') ||
          (r.StandardStatus ?? '').toLowerCase().includes('pending') ||
          (r.StandardStatus ?? '').toLowerCase().includes('for sale') ||
          (r.StandardStatus ?? '').toLowerCase().includes('coming soon')
      )
    }),
    getHotCommunitiesInCity(validCity).then((list) => list.slice(0, 12)),
    recentViewedKeys.length > 0 ? getHomeTileRowsByKeys(recentViewedKeys) : Promise.resolve([]),
    recentViewedKeys.length === 0 ? getListingsForHomeTiles({ city: validCity, limit: 16 }) : Promise.resolve([]),
  ])

  const recentlyViewedListings =
    recentViewedListingsRaw.length > 0 ? recentViewedListingsRaw : fallbackListings

  // Banners for popular community tiles (optional; same order as hotCommunities)
  const communityBannerUrls =
    hotCommunities.length > 0
      ? await Promise.all(
          hotCommunities.map((c) =>
            getOrCreatePlaceBanner(
              'subdivision',
              subdivisionEntityKey(validCity, c.subdivisionName),
              `${c.subdivisionName}, ${validCity}`
            ).then((r) => r?.url ?? null)
          )
        )
      : []

  let listingsWithCoords = affordabilityPoolListings
  try {
    listingsWithCoords = await getGeocodedListings(listingsWithCoords)
  } catch {
    // Map may show fewer points
  }
  const hasCoords = (l: (typeof listingsWithCoords)[0]) =>
    l.Latitude != null &&
    l.Longitude != null &&
    Number.isFinite(Number(l.Latitude)) &&
    Number.isFinite(Number(l.Longitude))
  const listingsOnMap = listingsWithCoords.filter(hasCoords)

  const [savedKeys, savedCommunityKeys] = session?.user
    ? await Promise.all([getSavedListingKeys(), getSavedCommunityKeys()])
    : [[], [] as string[]]
  const prefs = prefsForFetch ?? null

  const mapCenterResolved =
    mapCenter ?? (FALLBACK_CITY_CENTERS[cityEntityKey(validCity)] ?? FALLBACK_CITY_CENTERS.bend)
  const bannerUrl = bannerResult?.url ?? null
  const bannerAttribution = bannerResult?.attribution ?? null
  const totalInCity = cityStatusCounts.active + cityStatusCounts.pending
  const displayPrefs =
    prefs ?? {
      downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
      interestRate: DEFAULT_DISPLAY_RATE,
      loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
    }

  const homesForYouLabel = `Homes for You in ${validCity}`
  const searchCityHref = `/search/${cityEntityKey(validCity)}`

  const mapContent = (
    <div className="h-[360px] sm:h-[440px] md:h-[480px]">
      <ListingMapGoogle
        listings={listingsOnMap}
        initialCenter={mapCenterResolved}
        className="h-full w-full rounded-none"
      />
    </div>
  )

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <section className="relative -mx-4 min-h-[440px] sm:-mx-6 sm:min-h-[520px]" aria-label="Home hero">
        {bannerUrl ? (
          <div className="absolute inset-0">
            <Image
              src={bannerUrl}
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--brand-navy)] to-[#1e293b]" />
        )}
        <div className="absolute inset-0 bg-[var(--brand-navy)]/60" aria-hidden />
        {bannerAttribution && (
          <p className="absolute bottom-2 left-2 z-10 text-xs text-white/90 drop-shadow-md">
            {bannerAttribution}
          </p>
        )}
        <div className="relative z-10 flex min-h-[440px] sm:min-h-[520px] w-full flex-col items-center justify-center px-4 py-20 sm:py-28">
          <div className="w-full max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md sm:text-4xl md:text-5xl">
              Find Your Place in Central Oregon
            </h1>
            <p className="mt-3 text-lg text-white/95 sm:text-xl">
              Search homes, neighborhoods, and open listings.
            </p>
            <div className="mt-8">
              <HeroSearchOverlay homesForYouLabel={homesForYouLabel} />
            </div>
            <p className="mt-6 text-base text-white/90">
              <Link href={searchCityHref} className="font-semibold underline decoration-white/60 underline-offset-2 hover:text-white hover:decoration-white">
                {totalInCity} homes for sale in {validCity} and surrounding areas
              </Link>
              {' · '}
              <Link href="/listings" className="font-semibold underline decoration-white/60 underline-offset-2 hover:text-white hover:decoration-white">
                View all listings
              </Link>
            </p>
          </div>
        </div>
      </section>

      <HomeCollapsibleMap
        mapContent={mapContent}
        cityName={validCity}
        totalInCity={totalInCity}
        searchHref={searchCityHref}
      />

      {/* Curated homes slider (newest in city; static default city) */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <HomeTilesSlider
          title={homesForYouLabel}
          listings={homeTilesListings}
          savedKeys={session?.user ? savedKeys : []}
          signedIn={!!session?.user}
          userEmail={session?.user?.email ?? null}
          downPaymentPercent={displayPrefs.downPaymentPercent}
          interestRate={displayPrefs.interestRate}
          loanTermYears={displayPrefs.loanTermYears}
        />
      </section>

      {/* Affordability: target price input + affordable homes row */}
      <AffordabilityRow
        listings={affordabilityPoolListings}
        savedKeys={session?.user ? savedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        downPaymentPercent={displayPrefs.downPaymentPercent}
        interestRate={displayPrefs.interestRate}
        loanTermYears={displayPrefs.loanTermYears}
      />

      {/* Trending Homes in [City], Oregon */}
      {trendingListings.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <HomeTilesSlider
            title={`Trending Homes in ${validCity}, Oregon`}
            listings={trendingListings}
            savedKeys={session?.user ? savedKeys : []}
            signedIn={!!session?.user}
            userEmail={session?.user?.email ?? null}
            downPaymentPercent={displayPrefs.downPaymentPercent}
            interestRate={displayPrefs.interestRate}
            loanTermYears={displayPrefs.loanTermYears}
          />
        </section>
      )}

      {/* Popular Communities (tile-style with image background, share) */}
      {hotCommunities.length > 0 && (
        <PopularCommunitiesRow
          city={validCity}
          communities={hotCommunities}
          bannerUrls={communityBannerUrls}
          signedIn={!!session?.user}
          savedCommunityKeys={savedCommunityKeys}
        />
      )}

      {/* Recently Viewed (only when we have recent views) or Homes you might like */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <HomeTilesSlider
          title={recentViewedListingsRaw.length > 0 ? 'Recently Viewed' : 'Homes you might like'}
          listings={recentlyViewedListings}
          savedKeys={session?.user ? savedKeys : []}
          signedIn={!!session?.user}
          userEmail={session?.user?.email ?? null}
          downPaymentPercent={displayPrefs.downPaymentPercent}
          interestRate={displayPrefs.interestRate}
          loanTermYears={displayPrefs.loanTermYears}
        />
      </section>

      {/* Browse by city — all cities with active listings */}
      {cities.length > 0 && (
        <section className="border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="browse-by-city-heading">
          <div className="mx-auto max-w-7xl">
            <h2 id="browse-by-city-heading" className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Browse by city
            </h2>
            <p className="mt-1.5 text-[var(--text-secondary)]">Explore homes in every city we serve.</p>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {cities.map(({ City, count }) => (
                <CityTile key={City} city={City} count={count} />
              ))}
            </div>
            <Link
              href="/listings"
              className="mt-6 inline-block text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              View all listings →
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
