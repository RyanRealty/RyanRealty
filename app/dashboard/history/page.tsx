import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getRecentListingViews } from '@/app/actions/dashboard-history'
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
  title: 'Viewing History',
  description: 'Your recently viewed listings at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function DashboardHistoryPage() {
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

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Viewing History</h1>
      <p className="mt-1 text-zinc-600">
        Listings you&apos;ve recently viewed. Limited to the last 100.
      </p>

      {views.length === 0 ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-zinc-600">No viewing history yet.</p>
          <Link
            href="/listings"
            className="mt-4 inline-block rounded-lg bg-[var(--brand-navy)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <div key={v.id}>
                  <ListingTile
                    listing={listing}
                    listingKey={key}
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
          <p className="mt-2 text-sm text-zinc-500">Listings matching your browsing patterns</p>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-zinc-900">Recent views</h2>
            <ul className="mt-3 space-y-3">
              {views.map((v) => {
                const listing = listingMap.get(v.entity_id)
                if (!listing) return null
                const key = (listing.ListingKey ?? listing.ListNumber ?? '').toString().trim()
                return (
                  <li key={v.id} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-3">
                    <Link href={`/listing/${key}`} className="font-medium text-zinc-900 hover:underline">
                      {[listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ').trim() || listing.City || key}
                    </Link>
                    <span className="text-sm text-zinc-500">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                    <Link
                      href={`/listing/${key}`}
                      className="text-sm font-medium text-[var(--accent)] hover:underline"
                    >
                      View again
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </>
  )
}
