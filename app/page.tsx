import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import {
  getListings,
  getBrowseCities,
  getTotalListingsCount,
  getListingKeysWithRecentPriceChange,
  getCityCentroid,
  getCityStatusCounts,
} from './actions/listings'
import { getActivityFeedWithFallback } from './actions/activity-feed'
import { getSession } from './actions/auth'
import { getSavedListingKeys } from './actions/saved-listings'
import { getBuyingPreferences } from './actions/buying-preferences'
import { getProfile } from './actions/profile'
import { HOME_CITY_COOKIE } from '../lib/home-city'
import { getOrCreatePlaceBanner } from './actions/banners'
import { cityEntityKey } from '../lib/slug'
import {
  estimatedMonthlyPayment,
  formatMonthlyPayment,
  DEFAULT_DISPLAY_RATE,
  DEFAULT_DISPLAY_DOWN_PCT,
  DEFAULT_DISPLAY_TERM_YEARS,
} from '../lib/mortgage'
import ListingCard from '../components/ListingCard'
import ListingMap from '../components/ListingMap'
import { getGeocodedListings } from './actions/geocode'
import HomeCitySelector from '../components/HomeCitySelector'
import HomeListingsSection from '../components/HomeListingsSection'
import ActivityFeedCard from '../components/ActivityFeedCard'

const DEFAULT_HOME_CITY = 'Bend'

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

type HomeProps = { searchParams?: Promise<{ next?: string }> }

export default async function Home({ searchParams }: HomeProps) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sp = searchParams ? await searchParams : undefined
  const nextUrl = sp?.next
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
  const profile = session?.user ? await getProfile().catch(() => null) : null

  const cityFromCookie = cookieStore.get(HOME_CITY_COOKIE)?.value?.trim()
  const rawCity =
    session?.user && profile?.defaultCity
      ? profile.defaultCity.trim()
      : (cityFromCookie || DEFAULT_HOME_CITY).trim()
  const citySlug = slugifyCity(rawCity)
  const validCity =
    cities.find((c) => slugifyCity(c.City) === citySlug || c.City === rawCity)?.City ?? DEFAULT_HOME_CITY

  const HOMEPAGE_LISTING_LIMIT = 30

  const [
    listingsRaw,
    totalListings,
    priceChangeKeys,
    bannerResult,
    mapCenter,
    cityStatusCounts,
    activityFeedItems,
  ] = await Promise.all([
    getListings({
      city: validCity,
      limit: HOMEPAGE_LISTING_LIMIT,
      sort: 'newest',
      includePending: true,
    }),
    getTotalListingsCount(),
    getListingKeysWithRecentPriceChange(),
    getOrCreatePlaceBanner('city', cityEntityKey(validCity), `${validCity} Oregon`),
    getCityCentroid(validCity).then((c) =>
      c ? { latitude: c.lat, longitude: c.lng, zoom: 11 as number } : null
    ),
    getCityStatusCounts({ city: validCity }),
    getActivityFeedWithFallback({ city: validCity, limit: 12 }),
  ])

  let listingsWithCoords = listingsRaw
  try {
    listingsWithCoords = await getGeocodedListings(listingsRaw)
  } catch {
    // Map may show fewer points; page still loads
  }

  const hasCoords = (l: (typeof listingsWithCoords)[0]) =>
    l.Latitude != null &&
    l.Longitude != null &&
    Number.isFinite(Number(l.Latitude)) &&
    Number.isFinite(Number(l.Longitude))
  const listingsOnMap = listingsWithCoords.filter(hasCoords)

  const [savedKeys, prefs] = session?.user
    ? await Promise.all([getSavedListingKeys(), getBuyingPreferences()])
    : [[], null] as [string[], Awaited<ReturnType<typeof getBuyingPreferences>>]

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
  const monthlyPayments = listingsOnMap.map((l) => {
    const price = Number(l.ListPrice ?? 0)
    const monthly =
      price > 0
        ? estimatedMonthlyPayment(
            price,
            displayPrefs.downPaymentPercent,
            displayPrefs.interestRate,
            displayPrefs.loanTermYears
          )
        : null
    return monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined
  })

  return (
    <main className="min-h-screen">
      {nextUrl && !session?.user && (
        <div className="bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white">
          Sign in to save your preferences and get accurate pricing
        </div>
      )}

      {/* Banner with city selector */}
      <section className="relative -mx-4 sm:-mx-6" aria-label="Home hero">
        {bannerUrl ? (
          <div className="relative h-48 w-full overflow-hidden bg-zinc-900 sm:h-56 md:h-64">
            <Image
              src={bannerUrl}
              alt={`Real estate in ${validCity}, Central Oregon – scenic area`}
              width={1200}
              height={336}
              className="h-full w-full object-cover"
              sizes="100vw"
              priority
            />
            {bannerAttribution && (
              <p className="absolute bottom-2 left-2 text-xs text-white/90 drop-shadow-md">
                {bannerAttribution}
              </p>
            )}
            <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
              <HomeCitySelector
                currentCity={validCity}
                cities={cities}
                signedIn={!!session?.user}
              />
            </div>
          </div>
        ) : (
          <div className="relative flex h-48 flex-col items-center justify-center gap-4 bg-gradient-to-b from-zinc-900 to-zinc-800 px-4 py-16 text-white sm:h-56 sm:py-24">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Find your home in Central Oregon
            </h1>
            <p className="text-center text-lg text-zinc-300 sm:text-xl">
              Browse {totalListings.toLocaleString()} listings. Search by city, explore on the map.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/listings"
                className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-100"
              >
                View all listings
              </Link>
              <Link
                href="/listings?view=map"
                className="rounded-xl border border-zinc-500 bg-transparent px-6 py-3 text-base font-semibold text-white transition hover:bg-zinc-700"
              >
                Open map
              </Link>
              {!session?.user && (
                <Link
                  href="/?next=/account"
                  className="rounded-xl border border-emerald-400 bg-emerald-600/90 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-600"
                >
                  Sign in to save homes & searches
                </Link>
              )}
            </div>
            <div className="absolute bottom-4 right-4">
              <HomeCitySelector
                currentCity={validCity}
                cities={cities}
                signedIn={!!session?.user}
              />
            </div>
          </div>
        )}
      </section>

      {/* Map: single source of truth — listings below are only those on the map */}
      <section className="mx-auto max-w-7xl px-4 pt-8 pb-4 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 overflow-hidden shadow-lg">
          <div className="h-[360px] sm:h-[440px] md:h-[480px]">
            <ListingMap
              listings={listingsOnMap}
              initialCenter={mapCenterResolved}
              className="h-full w-full rounded-none"
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
            <Link
              href={`/search/${cityEntityKey(validCity)}`}
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              View all {totalInCity} in {validCity} →
            </Link>
            <Link
              href="/listings?view=map"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Full map view →
            </Link>
          </div>
        </div>
      </section>

      {/* Activity feed: full-bleed 4:5 cards, save on each (price drops, new, just sold) */}
      {activityFeedItems.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6" aria-label="Activity feed">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">Activity</h2>
          <p className="mt-0.5 text-sm text-zinc-600">New listings, price drops, and just sold in {validCity}.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {activityFeedItems.slice(0, 12).map((item) => (
              <ActivityFeedCard
                key={item.id}
                item={item}
                saved={session?.user ? savedKeys.includes(item.listing_key) : false}
                signedIn={!!session?.user}
                userEmail={session?.user?.email ?? null}
              />
            ))}
          </div>
          <Link
            href={`/search/${cityEntityKey(validCity)}`}
            className="mt-4 inline-block text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            View all {totalInCity} in {validCity} →
          </Link>
        </section>
      )}

      {/* Listings on the map only — same set as map pins */}
      <HomeListingsSection
        city={validCity}
        listings={listingsOnMap}
        totalInCity={totalInCity}
        savedKeys={session?.user ? savedKeys : []}
        priceChangeKeys={priceChangeKeys}
        monthlyPayments={monthlyPayments}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
      />

      {/* Browse by city */}
      {cities.length > 0 && (
        <section className="border-t border-zinc-200 bg-zinc-50 px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
              Browse by city
            </h2>
            <p className="mt-1 text-zinc-600">Explore homes in your preferred area.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {cities.slice(0, 24).map(({ City, count }) => (
                <Link
                  key={City}
                  href={`/search/${cityEntityKey(City)}`}
                  className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:shadow"
                >
                  {City} <span className="text-zinc-400">({count})</span>
                </Link>
              ))}
            </div>
            {cities.length > 24 && (
              <Link
                href="/listings"
                className="mt-4 inline-block text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                View all cities →
              </Link>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
