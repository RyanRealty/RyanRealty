import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
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
  title: 'My Collections',
  description: 'Organize your saved homes into collections at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function DashboardCollectionsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const [savedKeys, prefs] = await Promise.all([
    getSavedListingKeys(),
    getBuyingPreferences(),
  ])
  const listings = savedKeys.length > 0 ? await getListingsByKeys(savedKeys) : []
  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">My Collections</h1>
      <p className="mt-1 text-muted-foreground">
        All your saved homes in one place. Share a collection or organize into named groups (coming soon).
      </p>

      {listings.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">You don&apos;t have any saved homes yet.</p>
          <Link
            href="/homes-for-sale"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Browse search
          </Link>
        </div>
      ) : (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">All Saved ({listings.length})</h2>
          <div className="mt-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                <ListingTile
                  key={key}
                  listing={listing}
                  listingKey={key}
                  saved
                  monthlyPayment={
                    monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined
                  }
                  signedIn
                  userEmail={session?.user?.email ?? null}
                />
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}
