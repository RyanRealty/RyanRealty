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
import { listingsBrowsePath } from '@/lib/slug'

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
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Your personalized feed and quick stats.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Saved Homes</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{savedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Saved Searches</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{searchCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">New Matches This Week</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{newMatchesCount}</p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {savedCount === 0 && searchCount === 0 ? (
          <div className="rounded-lg border border-border bg-muted p-8 text-center">
            <p className="text-muted-foreground">
              Save some homes or create a search to see personalized updates here.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                href={listingsBrowsePath()}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent/90"
              >
                Browse listings
              </Link>
              <Link
                href="/homes-for-sale"
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Create a search
              </Link>
            </div>
          </div>
        ) : (
          listings.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground">Saved Homes</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Your saved listings</p>
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
                    <div key={key} className="shrink-0 w-[85vw] min-w-[260px] max-w-[320px] sm:w-[50vw] sm:min-w-[280px] sm:max-w-[360px] lg:w-[33.333vw] lg:min-w-[300px] lg:max-w-[420px]">
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
                className="mt-2 inline-block text-sm font-medium text-accent-foreground hover:underline"
              >
                View all saved homes †’
              </Link>
            </section>
          )
        )}
      </div>
    </>
  )
}
