import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getListingsByKeys } from '@/app/actions/listings'
import { getDashboardLikesData } from '@/app/actions/dashboard-likes'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import ListingTile from '@/components/ListingTile'
import RemoveSavedButton from './RemoveSavedButton'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import { listingsBrowsePath } from '@/lib/slug'

export const metadata: Metadata = {
  title: 'Saved homes',
  description: 'Your saved favorite listings at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function SavedHomesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  // One home for everything you care about: merge the two systems — saved_listings
  // (the save button) and likes (the heart) — deduped by listing key. This is also
  // where /dashboard/likes and /dashboard/saved now redirect.
  const [savedKeys, likesData, prefs] = await Promise.all([
    getSavedListingKeys(),
    getDashboardLikesData(),
    getBuyingPreferences(),
  ])
  const savedListings = savedKeys.length > 0 ? await getListingsByKeys(savedKeys) : []
  const map = new Map<string, (typeof savedListings)[number]>()
  for (const l of [...savedListings, ...likesData.listings]) {
    const k = (l.ListNumber ?? l.ListingKey ?? '').toString().trim()
    if (k && !map.has(k)) map.set(k, l)
  }
  const listings = [...map.values()]
  const displayPrefs = prefs ?? { downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT, interestRate: DEFAULT_DISPLAY_RATE, loanTermYears: DEFAULT_DISPLAY_TERM_YEARS }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Saved homes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you&apos;ve saved or liked. Remove any from here or from the listing page.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={listingsBrowsePath()}>Browse homes</Link>
        </Button>
      </header>

      {/* ── Saved + liked listings grid ── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">
          {listings.length > 0 ? `${listings.length} home${listings.length === 1 ? '' : 's'}` : 'Saved'}
        </h2>
        {listings.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No saved homes yet.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tap the heart on any listing to keep it here and get price-drop and status alerts.
            </p>
            <Button asChild size="sm">
              <Link href={listingsBrowsePath()}>Browse homes</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => {
              const key = (listing.ListNumber ?? listing.ListingKey ?? '').toString().trim()
              const price = Number(listing.ListPrice ?? 0)
              const monthly = price > 0 ? estimatedMonthlyPayment(price, displayPrefs.downPaymentPercent, displayPrefs.interestRate, displayPrefs.loanTermYears) : null
              return (
                <div key={key} className="relative">
                  <ListingTile
                    listing={listing}
                    listingKey={key}
                    saved
                    monthlyPayment={monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined}
                    signedIn
                    userEmail={session?.user?.email ?? null}
                  />
                  <RemoveSavedButton listingKey={key} />
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
