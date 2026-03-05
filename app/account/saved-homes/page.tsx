import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getListingsByKeys } from '@/app/actions/listings'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import ListingCard from '@/components/ListingCard'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'

export const metadata: Metadata = {
  title: 'Saved homes',
  description: 'Your saved favorite listings at Ryan Realty.',
}

export default async function SavedHomesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const [savedKeys, prefs] = await Promise.all([
    getSavedListingKeys(),
    getBuyingPreferences(),
  ])
  const listings = savedKeys.length > 0 ? await getListingsByKeys(savedKeys) : []

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Saved homes</h1>
      <p className="mt-1 text-zinc-600">
        Your favorite listings. Remove from this list from the listing page.
      </p>
      {listings.length === 0 ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-zinc-600">You haven’t saved any homes yet.</p>
          <Link
            href="/listings"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => {
            const key = listing.ListingKey ?? listing.ListNumber ?? ''
            const price = Number(listing.ListPrice ?? 0)
            const displayPrefs = prefs ?? { downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT, interestRate: DEFAULT_DISPLAY_RATE, loanTermYears: DEFAULT_DISPLAY_TERM_YEARS }
            const monthly = price > 0 ? estimatedMonthlyPayment(price, displayPrefs.downPaymentPercent, displayPrefs.interestRate, displayPrefs.loanTermYears) : null
            return (
              <div key={key} className="relative">
                <ListingCard
                  listing={listing}
                  saved
                  monthlyPayment={monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined}
                  signedIn
                />
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
