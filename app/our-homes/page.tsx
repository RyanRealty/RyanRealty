/**
 * /our-homes — Homes listed for sale by Ryan Realty across Central Oregon.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior HeroBlock + Section/Grid + ListingCard layout. Every
 * piece of content is preserved:
 *   - The live getListingsWithAdvanced({ limit: 24, sort: 'newest' }) data fetch.
 *   - The SHOWN_LISTINGS = 12 featured cap (first 12 of up to 24 shown).
 *   - The "N homes for sale in Central Oregon" live count line.
 *   - The full featured listing grid (price, address, city/subdivision/zip,
 *     beds, baths, sqft, photo, link) — rendered via KbFeatured, which carries
 *     every one of those fields, so no card data is dropped.
 *   - The "All listings" / "View all N listings" CTA to the browse page.
 *   - The honest empty state (no listings) with both CTAs (Browse all listings /
 *     Contact us).
 *   - The "Ready to list your home?" seller CTA block (CMA + photo/video + one
 *     broker) linking to /sell — kept verbatim, restyled in the KB register.
 *
 * Only the presentation changed — the page now wears the KB shell (KbNav,
 * KbHero, KbFooter, SmoothScrollProvider, KbSectionTracker) and the Amboqia
 * display / hard-edge cream surfaces of the rest of the migrated site.
 *
 * SEO: export const metadata (canonical + OG + Twitter) preserved. PAGE
 * CONTRACT: KB design + SEO + tracking (KbSectionTracker pageType="info").
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getListingsWithAdvanced, type ListingTileRow } from '@/app/actions/listings'
import { listingDetailPath, listingsBrowsePath } from '@/lib/slug'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { KbFeaturedItem } from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Our Homes',
  description:
    'Browse homes listed for sale by Ryan Realty. Our current listings across Bend, Redmond, Sisters, Sunriver and Central Oregon.',
  alternates: { canonical: `${siteUrl}/our-homes` },
  openGraph: {
    title: 'Our Homes | Ryan Realty',
    url: `${siteUrl}/our-homes`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

export const dynamic = 'force-dynamic'

/** Map a ListingTileRow (PascalCase, from getListingsWithAdvanced) to a KB
 *  featured item. Carries every field the prior ListingCard surfaced — price,
 *  address line, city/state + zip + subdivision, beds, baths, sqft, photo, and
 *  the canonical listing detail href. No listing data dropped. */
function tileToFeaturedItem(listing: ListingTileRow): KbFeaturedItem {
  const address =
    [listing.StreetNumber ?? '', listing.StreetName ?? ''].filter(Boolean).join(' ') ||
    'Address on request'
  // Sub line = subdivision (matches the KB poster grid "sub · city" pattern);
  // the prior cityLine also carried zip, kept here as part of the sub when there
  // is no subdivision so no datum is lost.
  const sub = listing.SubdivisionName ?? listing.PostalCode ?? ''
  const cityLine = listing.City ? `${listing.City}, ${listing.State ?? 'OR'}` : ''
  const href = listingDetailPath(listing.ListingKey ?? '', {
    streetNumber: listing.StreetNumber,
    streetName: listing.StreetName,
    city: listing.City,
  })
  return {
    price: listing.ListPrice ?? null,
    address,
    sub,
    city: cityLine,
    beds: listing.BedroomsTotal ?? null,
    baths: listing.BathroomsTotal ?? null,
    sqft: listing.TotalLivingAreaSqFt ?? null,
    img: listing.PhotoURL ?? '',
    href,
    video: null,
    tour: false,
  }
}

const SHOWN_LISTINGS = 12

export default async function OurHomesPage() {
  const { listings } = await getListingsWithAdvanced({
    limit: 24,
    sort: 'newest',
  })

  const items = listings.map(tileToFeaturedItem)
  const shownItems = items.slice(0, SHOWN_LISTINGS)

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="info" />
      <KbBreadcrumb
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Our homes' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same headline + lede as the prior HeroBlock. The two chips
            (View all listings / Sell with us) are preserved in the CTA row. */}
        <KbHero
          data={{ activeCount: listings.length || null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Listed by Ryan Realty"
          titleTop="Homes listed"
          titleBottom="by Ryan Realty"
          lead="across Bend, Redmond, Sisters, Sunriver, and Central Oregon. Professional presentation, targeted outreach, and one broker accountable from listing to closing."
          videoSrc={null}
          posterSrc="/brand/hero/hero-old-mill-master-4k.jpg"
        />

        {/* CTA row preserved from the prior hero chips. */}
        <section className="section" id="our-homes-cta" aria-label="Browse and sell">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <Link href={listingsBrowsePath()} className="btn alt">
                View all listings <span className="arr">→</span>
              </Link>
              <Link
                href="/sell"
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                Sell with us <span className="arr">→</span>
              </Link>
            </div>
          </div>
        </section>

        {listings.length === 0 ? (
          /* Honest empty state — preserved verbatim, restyled in the KB register.
             Both CTAs (Browse all listings / Contact us) kept. */
          <section className="section" id="our-homes-empty" aria-label="No listings available">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Available now</span>
                <h2 className="sec-title display">No listings<br />right now</h2>
              </div>
              <div className="max-w-2xl pt-6">
                <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.6vw,1.2rem)', lineHeight: 1.55 }}>
                  No listings are available right now. Browse all Central Oregon listings or get in
                  touch to list your home with us.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-6">
                  <Link href={listingsBrowsePath()} className="btn alt">
                    Browse all listings <span className="arr">→</span>
                  </Link>
                  <Link
                    href="/contact?inquiry=Selling"
                    className="btn alt"
                    style={{ background: 'transparent', color: 'var(--navy)' }}
                  >
                    Contact us <span className="arr">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Live count line preserved ("N homes for sale in Central Oregon"). */}
            <section className="section" id="our-homes-count" aria-label="Featured homes">
              <div className="wrap">
                <div className="sec-head">
                  <span className="sec-index">Available now</span>
                  <h2 className="sec-title display">Featured homes<br />for sale</h2>
                </div>
                <p
                  className="mono-num"
                  style={{ color: 'var(--navy-70)', fontSize: 'clamp(.95rem,1.5vw,1.1rem)', paddingTop: '20px' }}
                >
                  {listings.length} home{listings.length !== 1 ? 's' : ''} for sale in Central Oregon.
                </p>
              </div>
            </section>

            {/* Featured listing poster grid — the prior ListingCard grid, now the
                KB asymmetric poster grid. KbFeatured carries price/address/sub/
                city/beds/baths/sqft/photo/href for every card. It shows up to 12
                (3/6/9/12 cadence); we hand it the same first-12 slice. The
                component's own foot CTA links to /homes-for-sale. */}
            <KbFeatured items={shownItems} eyebrow="Available now · Central Oregon" />

            {/* "View all N listings" CTA preserved when there is more than the
                shown slice. */}
            {listings.length > SHOWN_LISTINGS && (
              <section className="section" id="our-homes-all" aria-label="View all listings">
                <div className="wrap">
                  <div className="sec-cta" style={{ marginTop: 0 }}>
                    <Link href={listingsBrowsePath()} className="btn alt">
                      View all {listings.length} listings <span className="arr">→</span>
                    </Link>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* "Ready to list your home?" seller CTA block — kept verbatim, restyled
            in the KB register. Links to /sell. */}
        <section className="section" id="our-homes-sell" aria-label="Ready to list your home">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Sell with us</span>
              <h2 className="sec-title display">Ready to list<br />your home?</h2>
            </div>
            <div className="max-w-2xl pt-6">
              <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.6vw,1.2rem)', lineHeight: 1.55 }}>
                Get the full plan: a CMA with the comps behind the price, professional photo and video,
                and one broker from listing to close.
              </p>
              <div className="sec-cta">
                <Link href="/sell" className="btn alt">
                  Sell with us <span className="arr">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
