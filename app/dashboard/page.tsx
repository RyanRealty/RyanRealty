import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import { getSavedSearches } from '@/app/actions/saved-searches'
import { getListingsByKeys } from '@/app/actions/listings'
import { getDashboardLikesData } from '@/app/actions/dashboard-likes'
import { getRecentListingViews } from '@/app/actions/dashboard-history'
import ListingTile from '@/components/ListingTile'
import RemoveViewedButton from '@/components/dashboard/RemoveViewedButton'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import {
  estimatedMonthlyPayment,
  formatMonthlyPayment,
  DEFAULT_DISPLAY_RATE,
  DEFAULT_DISPLAY_DOWN_PCT,
  DEFAULT_DISPLAY_TERM_YEARS,
} from '@/lib/mortgage'
import { listingDetailPath, listingsBrowsePath } from '@/lib/slug'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your personalized dashboard at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function DashboardOverviewPage() {
  const session = await getSession()
  if (!session?.user) return null

  const [likesData, recentViews, savedSearches, prefs] = await Promise.all([
    getDashboardLikesData(),
    getRecentListingViews(12),
    getSavedSearches(),
    getBuyingPreferences(),
  ])
  const likedCount = likesData.listings.length + likesData.cities.length + likesData.communities.length
  const viewedCount = recentViews.length
  const searchCount = savedSearches.length
  const viewedListings =
    recentViews.length > 0
      ? await getListingsByKeys(recentViews.map((v) => v.entity_id).filter(Boolean))
      : []
  const viewedMap = new Map(
    viewedListings.map((listing) => [
      (listing.ListNumber ?? listing.ListingKey ?? '').toString().trim(),
      listing,
    ])
  )
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
          <p className="text-sm font-medium text-muted-foreground">Things I Like</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{likedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Viewed Homes</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{viewedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Saved Searches</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{searchCount}</p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {likedCount === 0 && viewedCount === 0 && searchCount === 0 ? (
          <div className="rounded-lg border border-border bg-muted p-8 text-center">
            <p className="text-muted-foreground">
              Like homes, cities, or communities and browse listings to build your personalized dashboard.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                href={listingsBrowsePath()}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent/90"
              >
                Browse listings
              </Link>
              <Link
                href="/dashboard/likes"
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                View likes
              </Link>
            </div>
          </div>
        ) : (
          likesData.listings.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground">Liked Homes</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Homes you like, all in one place.</p>
              <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
                {likesData.listings.slice(0, 8).map((listing) => {
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
                href="/dashboard/likes"
                className="mt-2 inline-block text-sm font-medium text-accent-foreground hover:underline"
              >
                View all things I like →
              </Link>
            </section>
          )
        )}

        {recentViews.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground">Recently Viewed Homes</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Your latest listing views with quick remove.</p>
            <ul className="mt-3 space-y-3">
              {recentViews.slice(0, 8).map((view) => {
                const listing = viewedMap.get(view.entity_id)
                if (!listing) return null
                const key = (listing.ListNumber ?? listing.ListingKey ?? '').toString().trim()
                const title =
                  [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ').trim() ||
                  listing.City ||
                  key
                return (
                  <li
                    key={view.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
                  >
                    <Link
                      href={listingDetailPath(
                        key,
                        {
                          streetNumber: listing.StreetNumber,
                          streetName: listing.StreetName,
                          city: listing.City,
                          state: listing.State,
                          postalCode: listing.PostalCode,
                        },
                        { city: listing.City, subdivision: listing.SubdivisionName },
                        { mlsNumber: listing.ListNumber ?? null }
                      )}
                      className="font-medium text-foreground hover:underline"
                    >
                      {title}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {new Date(view.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    <RemoveViewedButton activityId={view.id} />
                  </li>
                )
              })}
            </ul>
            <Link
              href="/dashboard/history"
              className="mt-2 inline-block text-sm font-medium text-accent-foreground hover:underline"
            >
              View full viewing history →
            </Link>
          </section>
        )}
      </div>
    </>
  )
}
