import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getRecentListingViews } from '@/app/actions/dashboard-history'
import { getListingsByKeys } from '@/app/actions/listings'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import ListingTile from '@/components/ListingTile'
import RemoveViewedButton from '@/components/dashboard/RemoveViewedButton'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  estimatedMonthlyPayment,
  formatMonthlyPayment,
  DEFAULT_DISPLAY_RATE,
  DEFAULT_DISPLAY_DOWN_PCT,
  DEFAULT_DISPLAY_TERM_YEARS,
} from '@/lib/mortgage'
import { listingDetailPath, listingsBrowsePath } from '@/lib/slug'

export const metadata: Metadata = {
  title: 'Viewing history',
  description: 'Your recently viewed listings at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function AccountHistoryPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const [views, prefs] = await Promise.all([
    getRecentListingViews(100),
    getBuyingPreferences(),
  ])
  const keys = views.map((v) => v.entity_id).filter(Boolean)
  const listings = keys.length > 0 ? await getListingsByKeys(keys) : []
  const listingMap = new Map(listings.map((l) => [(l.ListingKey ?? l.ListNumber ?? '').toString().trim(), l]))
  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }
  const userEmail = session.user.email ?? null

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Viewing history</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Listings you&apos;ve recently viewed. Limited to the last 100.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={listingsBrowsePath()}>Browse homes</Link>
        </Button>
      </header>

      {views.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No viewing history yet.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Homes you open will show up here so you can pick up right where you left off.
          </p>
          <Button asChild size="sm">
            <Link href={listingsBrowsePath()}>Browse homes</Link>
          </Button>
        </Card>
      ) : (
        <>
          {/* ── Top picks from your browsing ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">From your browsing</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {views.slice(0, 4).map((v) => {
                const listing = listingMap.get(v.entity_id)
                if (!listing) return null
                const key = (listing.ListingKey ?? listing.ListNumber ?? '').toString().trim()
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
                    key={v.id}
                    listing={listing}
                    listingKey={key}
                    monthlyPayment={
                      monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined
                    }
                    signedIn
                    userEmail={userEmail}
                  />
                )
              })}
            </div>
          </section>

          {/* ── Recent views ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Recent views</h2>
            <Card className="divide-y divide-border overflow-hidden p-0">
              {views.map((v) => {
                const listing = listingMap.get(v.entity_id)
                if (!listing) return null
                const key = (listing.ListingKey ?? listing.ListNumber ?? '').toString().trim()
                const title =
                  [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ').trim() || listing.City || key
                return (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
                  >
                    <Link
                      href={listingDetailPath(
                        key,
                        { streetNumber: listing.StreetNumber, streetName: listing.StreetName, city: listing.City, state: listing.State, postalCode: listing.PostalCode },
                        { city: listing.City, subdivision: listing.SubdivisionName }
                      )}
                      className="min-w-0 flex-1 break-words text-sm font-medium text-foreground hover:underline"
                    >
                      {title}
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {new Date(v.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          href={listingDetailPath(key, { streetNumber: listing.StreetNumber, streetName: listing.StreetName, city: listing.City, state: listing.State, postalCode: listing.PostalCode })}
                        >
                          View again
                        </Link>
                      </Button>
                      <RemoveViewedButton activityId={v.id} />
                    </div>
                  </div>
                )
              })}
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
