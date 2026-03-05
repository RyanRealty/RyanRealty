import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import {
  getListings,
  getBrowseCities,
  getTotalListingsCount,
  getListingKeysWithRecentPriceChange,
  getListingsForMap,
  getCityCentroid,
} from './actions/listings'
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
import HomeListingsSlider from '../components/HomeListingsSlider'

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

  const [
    listings,
    totalListings,
    priceChangeKeys,
    bannerResult,
    mapListingsRaw,
    mapCenter,
  ] = await Promise.all([
    getListings({
      city: validCity,
      limit: 16,
      sort: 'newest',
      includePending: true,
    }),
    getTotalListingsCount(),
    getListingKeysWithRecentPriceChange(),
    getOrCreatePlaceBanner('city', cityEntityKey(validCity), `${validCity} Oregon`),
    getListingsForMap({ city: validCity }),
    getCityCentroid(validCity).then((c) =>
      c ? { latitude: c.lat, longitude: c.lng, zoom: 11 as number } : null
    ),
  ])

  const [savedKeys, prefs] = session?.user
    ? await Promise.all([getSavedListingKeys(), getBuyingPreferences()])
    : [[], null] as [string[], Awaited<ReturnType<typeof getBuyingPreferences>>]

  let listingsWithCoords = listings
  let mapListingsWithCoords = mapListingsRaw
  try {
    ;[listingsWithCoords, mapListingsWithCoords] = await Promise.all([
      getGeocodedListings(listings),
      getGeocodedListings(mapListingsRaw),
    ])
  } catch {
    // Map may show fewer points; page still loads
  }

  const mapCenterResolved =
    mapCenter ?? (FALLBACK_CITY_CENTERS[cityEntityKey(validCity)] ?? FALLBACK_CITY_CENTERS.bend)
  const bannerUrl = bannerResult?.url ?? null
  const bannerAttribution = bannerResult?.attribution ?? null
  const displayPrefs =
    prefs ?? {
      downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
      interestRate: DEFAULT_DISPLAY_RATE,
      loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
    }
  const monthlyPayments = listings.map((l) => {
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

      {/* Map for selected city */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="h-[320px] sm:h-[400px]">
            <ListingMap
              listings={mapListingsWithCoords}
              initialCenter={mapCenterResolved}
            />
          </div>
          <div className="flex justify-center border-t border-zinc-200 bg-zinc-50 py-3">
            <Link
              href="/listings?view=map"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              View full map →
            </Link>
          </div>
        </div>
      </section>

      {/* Recent & pending listings slider */}
      <HomeListingsSlider
        city={validCity}
        listings={listings}
        savedKeys={session?.user ? savedKeys : []}
        priceChangeKeys={priceChangeKeys}
        monthlyPayments={monthlyPayments}
        signedIn={!!session?.user}
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
