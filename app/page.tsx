import Link from 'next/link'
import { getListings, getBrowseCities, getTotalListingsCount, getListingKeysWithRecentPriceChange } from './actions/listings'
import { getSession } from './actions/auth'
import { getSavedListingKeys } from './actions/saved-listings'
import { getBuyingPreferences } from './actions/buying-preferences'
import { cityEntityKey } from '../lib/slug'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '../lib/mortgage'
import ListingCard from '../components/ListingCard'
import { getGeocodedListings } from './actions/geocode'
import ListingMap from '../components/ListingMap'

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

  const [listings, cities, totalListings, priceChangeKeys, session] = await Promise.all([
    getListings({ city: 'Bend', limit: 12, sort: 'newest' }),
    getBrowseCities(),
    getTotalListingsCount(),
    getListingKeysWithRecentPriceChange(),
    getSession(),
  ])
  const [savedKeys, prefs] = session?.user
    ? await Promise.all([getSavedListingKeys(), getBuyingPreferences()])
    : [[], null] as [string[], Awaited<ReturnType<typeof getBuyingPreferences>>]

  let listingsWithCoords = listings
  try {
    listingsWithCoords = await getGeocodedListings(listings)
  } catch {
    // Map may show fewer points; page still loads
  }

  return (
    <main className="min-h-screen">
      {nextUrl && !session?.user && (
        <div className="bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white">
          Sign in to save your preferences and get accurate pricing
        </div>
      )}
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-zinc-900 to-zinc-800 px-4 py-16 text-white sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Find your home in Central Oregon
          </h1>
          <p className="mt-4 text-lg text-zinc-300 sm:text-xl">
            Browse {totalListings.toLocaleString()} listings. Search by city, explore on the map, or view full details.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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
        </div>
      </section>

      {/* Map preview */}
      {listingsWithCoords.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="h-[320px] sm:h-[400px]">
              <ListingMap listings={listingsWithCoords} centerOnBend />
            </div>
            <div className="flex justify-center border-t border-zinc-200 bg-zinc-50 py-3">
              <Link href="/listings?view=map" className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
                View full map →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Featured listings */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Featured listings</h2>
          <Link href="/listings" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            See all →
          </Link>
        </div>
        {listings.length === 0 ? (
          <p className="mt-6 text-zinc-500">No listings yet. Sync from Spark to populate.</p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.slice(0, 8).map((listing, i) => {
              const key = listing.ListingKey ?? listing.ListNumber ?? `listing-${i}`
              const price = Number(listing.ListPrice ?? 0)
              const displayPrefs = prefs ?? { downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT, interestRate: DEFAULT_DISPLAY_RATE, loanTermYears: DEFAULT_DISPLAY_TERM_YEARS }
              const monthly = price > 0 ? estimatedMonthlyPayment(price, displayPrefs.downPaymentPercent, displayPrefs.interestRate, displayPrefs.loanTermYears) : null
              return (
                <ListingCard
                  key={key}
                  listing={listing}
                  priority={i < 4}
                  hasRecentPriceChange={key ? priceChangeKeys.has(key) : false}
                  saved={session?.user ? savedKeys.includes(key) : undefined}
                  monthlyPayment={monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined}
                  signedIn={!!session?.user}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Browse by city */}
      {cities.length > 0 && (
        <section className="border-t border-zinc-200 bg-zinc-50 px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Browse by city</h2>
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
              <Link href="/listings" className="mt-4 inline-block text-sm font-medium text-zinc-600 hover:text-zinc-900">
                View all cities →
              </Link>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
