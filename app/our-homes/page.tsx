import type { Metadata } from 'next'
import Link from 'next/link'
import { getListingsWithAdvanced } from '@/app/actions/listings'
import { ArrowRightHugeIcon } from '@/components/icons/HugeIcons'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Our Homes | Listings by Ryan Realty | Ryan Realty',
  description:
    'Browse homes listed for sale by Ryan Realty. Our current listings across Bend, Redmond, Sisters, Sunriver and Central Oregon.',
  alternates: { canonical: `${siteUrl}/our-homes` },
  openGraph: {
    title: 'Our Homes | Ryan Realty',
    url: `${siteUrl}/our-homes`,
    type: 'website',
  },
}

export const revalidate = 60

export default async function OurHomesPage() {
  const { listings } = await getListingsWithAdvanced({
    limit: 24,
    sort: 'newest',
  })

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <section className="bg-primary px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground">
            Our Homes
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Homes Listed by Ryan Realty
          </h1>
          <p className="mt-6 text-lg text-muted/90">
            Explore homes for sale across Central Oregon. We help buyers and sellers with the same
            full plan: professional presentation, targeted outreach, and local expertise from listing to closing.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/listings"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-base font-semibold text-primary shadow-md hover:bg-accent/90"
            >
              View all listings
              <ArrowRightHugeIcon className="h-5 w-5" />
            </Link>
            <Link
              href="/sell"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-white/40 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20"
            >
              Sell with us
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-[var(--card)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="listings-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="listings-heading" className="font-display text-2xl font-bold text-primary sm:text-3xl">
            Featured homes for sale
          </h2>
          {listings.length === 0 ? (
            <div className="mt-8 rounded-xl border border-border bg-muted p-10 text-center">
              <p className="text-[var(--muted-foreground)]">
                No listings are available in the system right now. Browse all Central Oregon
                listings or get in touch to list your home with us.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Link
                  href="/listings"
                  className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-white hover:bg-accent/90"
                >
                  Browse all listings
                </Link>
                <Link
                  href="/contact?inquiry=Selling"
                  className="rounded-lg border-2 border-primary px-5 py-2.5 font-semibold text-primary hover:bg-primary hover:text-white"
                >
                  Contact us
                </Link>
              </div>
            </div>
          ) : (
            <>
            <p className="mt-2 text-[var(--muted-foreground)]">
              {listings.length} home{listings.length !== 1 ? 's' : ''} for sale in Central Oregon.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.slice(0, 12).map((listing) => {
                const href = `/listing/${listing.ListingKey}`
                const price =
                  listing.ListPrice != null
                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(listing.ListPrice)
                    : null
                const address = [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ')
                const loc = [listing.City, listing.State].filter(Boolean).join(', ')
                return (
                  <Link
                    key={listing.ListingKey}
                    href={href}
                    className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-[var(--muted)]">
                      {listing.PhotoURL ? (
                        <img
                          src={listing.PhotoURL}
                          alt={`${address || loc || 'Property'} photo`}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
                          No photo
                        </div>
                      )}
                      {price && (
                        <span className="absolute left-3 top-3 rounded-lg bg-primary px-2.5 py-1 text-sm font-semibold text-white">
                          {price}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      {address && <p className="font-semibold text-primary">{address}</p>}
                      {loc && <p className="text-sm text-[var(--muted-foreground)]">{loc}</p>}
                      <span className="mt-2 inline-block text-sm font-medium text-accent-foreground group-hover:underline">
                        View details →
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
            {listings.length > 12 && (
              <div className="mt-10 text-center">
                <Link
                  href="/listings"
                  className="rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-white"
                >
                  View all {listings.length} listings
                </Link>
              </div>
            )}
            </>
          )}
        </div>
      </section>

      <section className="bg-muted px-4 py-14 sm:px-6" aria-labelledby="sell-cta-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="sell-cta-heading" className="font-display text-2xl font-bold text-primary">
            Ready to list your home?
          </h2>
          <p className="mt-3 text-[var(--muted-foreground)]">
            Get our full plan: pricing, marketing, and local expertise from day one.
          </p>
          <Link
            href="/sell"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-accent/90"
          >
            Sell with us
          </Link>
        </div>
      </section>
    </main>
  )
}
