import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getSavedSearches } from '@/app/actions/saved-searches'
import { getListingsByKeys } from '@/app/actions/listings'
import ListingTile from '@/components/ListingTile'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import {
  estimatedMonthlyPayment,
  formatMonthlyPayment,
  DEFAULT_DISPLAY_RATE,
  DEFAULT_DISPLAY_DOWN_PCT,
  DEFAULT_DISPLAY_TERM_YEARS,
} from '@/lib/mortgage'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your personalized dashboard at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function DashboardOverviewPage() {
  const session = await getSession()
  if (!session?.user) return null

  const [savedKeys, savedSearches, prefs] = await Promise.all([
    getSavedListingKeys(),
    getSavedSearches(),
    getBuyingPreferences(),
  ])
  const savedCount = savedKeys.length
  const searchCount = savedSearches.length
  const newMatchesCount = 0
  const listings = savedKeys.length > 0 ? await getListingsByKeys(savedKeys.slice(0, 12)) : []
  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
      <p className="mt-1 text-zinc-600">Your personalized feed and quick stats.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Saved Homes</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{savedCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Saved Searches</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{searchCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">New Matches This Week</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{newMatchesCount}</p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {savedCount === 0 && searchCount === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
            <p className="text-zinc-600">
              Save some homes or create a search to see personalized updates here.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                href="/listings"
                className="rounded-lg bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
              >
                Browse listings
              </Link>
              <Link
                href="/search"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Create a search
              </Link>
            </div>
          </div>
        ) : (
          listings.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-zinc-900">Saved Homes</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Your saved listings</p>
              <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
                {listings.map((listing) => {
                  const key = (listing.ListNumber ?? listing.ListingKey ?? '').toString().trim()
                  const price = Number(listing.ListPrice ?? 0)
                  const monthly =
                    price > 0
                      ? estimatedMonthlyPayment(
                          price,
                          displayPrefs.downPaymentPercent,
                          displayPrefs.interestRate,
                          displayPrefs.loanTermYears
                        )
                      : null
                  return (
                    <div key={key} className="w-72 shrink-0">
                      <ListingTile
                        listing={listing}
                        listingKey={key}
                        saved
                        monthlyPayment={
                          monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined
                        }
                        signedIn
                        userEmail={session?.user?.email ?? null}
                      />
                    </div>
                  )
                })}
              </div>
              <Link
                href="/dashboard/saved"
                className="mt-2 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
              >
                View all saved homes →
              </Link>
            </section>
          )
        )}
      </div>
    </>
  )
}
