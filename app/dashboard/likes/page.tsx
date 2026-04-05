import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSession } from '@/app/actions/auth'
import { getDashboardLikesData } from '@/app/actions/dashboard-likes'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import ListingTile from '@/components/ListingTile'
import RemoveLikeButton from '@/components/dashboard/RemoveLikeButton'
import {
  estimatedMonthlyPayment,
  formatMonthlyPayment,
  DEFAULT_DISPLAY_RATE,
  DEFAULT_DISPLAY_DOWN_PCT,
  DEFAULT_DISPLAY_TERM_YEARS,
} from '@/lib/mortgage'

export const metadata: Metadata = {
  title: 'Things I Like',
  description: 'Listings, cities, and communities you like.',
}

export const dynamic = 'force-dynamic'

export default async function DashboardLikesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const [{ listings, cities, communities }, prefs] = await Promise.all([
    getDashboardLikesData(),
    getBuyingPreferences(),
  ])

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  const totalLikes = listings.length + cities.length + communities.length

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Things I Like</h1>
      <p className="mt-1 text-muted-foreground">
        Everything you like in one place. Remove any listing, city, or community from here.
      </p>

      {totalLikes === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">You have not liked anything yet.</p>
          <Link
            href="/homes-for-sale"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-accent/90"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {listings.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground">Liked Listings</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Homes you have liked or saved.</p>
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
                    <div key={key} className="relative">
                      <ListingTile
                        listing={listing}
                        listingKey={key}
                        monthlyPayment={
                          monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined
                        }
                        signedIn
                        userEmail={session.user.email ?? null}
                      />
                      <div className="absolute right-2 bottom-2 z-10 rounded-md bg-card/95">
                        <RemoveLikeButton kind="listing" id={key} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Liked Cities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No liked cities yet.</p>
                ) : (
                  cities.map((city) => (
                    <div key={city.slug} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                      <Link href={`/cities/${city.slug}`} className="font-medium text-foreground hover:underline">
                        {city.name}
                      </Link>
                      <RemoveLikeButton kind="city" id={city.slug} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Liked Communities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {communities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No liked communities yet.</p>
                ) : (
                  communities.map((community) => (
                    <div key={community.entityKey} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                      <Link
                        href={`/communities/${community.slug}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {community.subdivision}, {community.city}
                      </Link>
                      <RemoveLikeButton kind="community" id={community.entityKey} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </>
  )
}
