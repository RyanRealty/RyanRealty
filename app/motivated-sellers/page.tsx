/**
 * /motivated-sellers — Pillar page for motivated seller homes in Central Oregon.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior HeroBlock/Section/Container layout: every piece of
 * content is preserved.
 *   - getMotivatedListings DAL call (limit 48), wrapped in the same resilient
 *     .catch() empty fallback
 *   - breadcrumb + webPage JSON-LD (MetadataBlock)
 *   - hero copy (H1 + lede)
 *   - the "How it works / What makes a listing show up here" explanation copy
 *     (both paragraphs) PLUS the four score-signal rows (Price cuts / Total drop
 *     / Remarks / DOM)
 *   - the city filter chips (All cities + one per SITE_CITY_SLUGS) linking to
 *     the per-city pages
 *   - the listing grid (every motivated listing rendered, top motivation reason
 *     as a badge, beds/baths/price/address/city) with the honest empty state
 *   - the closing CTA (talk to a broker / call)
 *
 * Only the presentation changed — the page wears the KB shell (KbNav, KbHero,
 * KbFooter, SmoothScrollProvider, KbSectionTracker) and the Amboqia display /
 * hard-edge surfaces of the rest of the migrated site. The listing grid uses
 * the KB poster-grid markup so the motivation badge + photo + numbers all stay.
 *
 * Data ONLY through @/lib/data. No app/actions/* imports.
 * ISR: revalidates every 600 seconds so the grid stays current.
 *
 * SEO: export ASYNC generateMetadata (canonical + OG via pageMetadata),
 * BreadcrumbList + webPage JSON-LD. PAGE CONTRACT: KB design + SEO + tracking
 * (KbSectionTracker pageType="motivated-sellers").
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getMotivatedListings, type MotivatedListing } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { listingDetailPath } from '@/lib/slug'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import { CONTACT } from '@/lib/brand/contact'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import TrackSearchView from '@/components/tracking/TrackSearchView'
import { kbMoneyFull } from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

// ─── ISR ─────────────────────────────────────────────────────────────────

export const revalidate = 600
export const dynamicParams = false

// ─── Metadata ─────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Motivated Seller Homes in Central Oregon',
    description:
      'Browse price-reduced homes and motivated seller listings across Central Oregon. ' +
      'Sorted by most motivated. Real price cuts and listing remarks, no guesswork.',
    path: '/motivated-sellers',
    keywords: [
      'motivated seller homes Central Oregon',
      'price reduced homes Oregon',
      'motivated sellers Bend Oregon',
      'price cut homes Bend',
      'below market homes Central Oregon',
      'seller motivated homes Oregon',
    ],
  })
}

// ─── City display names ────────────────────────────────────────────────────

const CITY_DISPLAY: Record<string, string> = {
  bend: 'Bend',
  redmond: 'Redmond',
  sisters: 'Sisters',
  sunriver: 'Sunriver',
  'la-pine': 'La Pine',
  madras: 'Madras',
  prineville: 'Prineville',
  culver: 'Culver',
  terrebonne: 'Terrebonne',
  'powell-butte': 'Powell Butte',
}

// ─── Listing card (KB poster grid) ──────────────────────────────────────────

/** One motivated listing as a KB poster tile. Keeps the photo, top motivation
 *  reason as a hard-edge badge, price, address, city · neighborhood, and the
 *  beds/baths spec — every field the prior ListingCard carried, restyled. */
function MotivatedTile({ listing }: { listing: MotivatedListing }) {
  const key = (listing.listingKey ?? listing.listNumber ?? '').toString()
  if (!key) return null
  const href = listingDetailPath(
    key,
    { streetNumber: listing.streetNumber, streetName: listing.streetName, city: listing.city, postalCode: listing.postalCode },
    { city: listing.city, subdivision: listing.subdivisionName },
    { mlsNumber: listing.listNumber },
  )
  const addressLine =
    [listing.streetNumber, listing.streetName, listing.streetSuffix].filter(Boolean).join(' ') || 'Address on request'
  const cityParts: string[] = []
  if (listing.city) cityParts.push(`${listing.city}, OR`)
  if (listing.postalCode) cityParts.push(listing.postalCode)
  if (listing.subdivisionName) cityParts.push(listing.subdivisionName)
  const reason = listing.reasons[0]

  return (
    <a className="lst-card" href={href}>
      <div className="lst-media">
        {listing.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="lst-img" src={listing.photoUrl} alt={addressLine} loading="lazy" />
        ) : (
          // No MLS photo — the card's navy background (.lst-card) shows through.
          <div className="lst-img" aria-hidden="true" />
        )}
        {reason ? <span className="lst-badge">{reason}</span> : null}
      </div>
      <div className="lst-info">
        <div>
          <div className="lst-price mono-num">{kbMoneyFull(listing.listPrice) ?? 'Price on request'}</div>
          <div className="lst-addr">
            {addressLine}
            {cityParts.length > 0 ? <span className="sub">{cityParts.join(' · ')}</span> : null}
          </div>
        </div>
        <div className="lst-specs">
          {listing.beds != null ? <span>{listing.beds} bd</span> : null}
          {listing.baths != null ? <span>{listing.baths} ba</span> : null}
        </div>
      </div>
    </a>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function MotivatedSellersPage() {
  const { listings } = await getMotivatedListings({
    limit: 48,
    offset: 0,
  }).catch(() => ({ listings: [], total: 0 }))

  // Structured data
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Motivated sellers', url: '/motivated-sellers' },
      ],
    },
  ]

  if (listings.length > 0) {
    // ItemList / webPage for the listing grid
    schemas.push({
      type: 'webPage',
      name: 'Motivated Seller Homes in Central Oregon',
      description:
        'Price-reduced and motivated seller listings across Bend, Redmond, Sisters, and Central Oregon. Sorted by most motivated.',
      url: '/motivated-sellers',
    })
  }

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="motivated-sellers" />
      <TrackSearchView resultsCount={listings.length} />
      <MetadataBlock schemas={schemas} />

      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Motivated sellers' },
        ]}
      />

      <SmoothScrollProvider>
        {/* Hero — same H1 + lede as the prior HeroBlock, in the KB Amboqia
            display over the brand poster. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Motivated sellers"
          titleTop="Motivated"
          titleBottom="Sellers"
          lead="Active homes with documented price cuts or seller-signaled motivation. Sorted by most motivated, updated hourly from the regional MLS."
          videoSrc={null}
          posterSrc="/images/homepage/tetherow-golf-aerial.jpg"
        />

        {/* How motivation is identified — transparency + keyword relevance.
            Both explanation paragraphs preserved, plus the four score-signal
            rows from the prior sidebar. */}
        <section className="section" id="how-it-works" aria-label="How it works">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">How it works</span>
              <h2 className="sec-title display">
                What makes a
                <br />
                listing show up
              </h2>
            </div>
            <div className="grid gap-10 pt-8 lg:grid-cols-3">
              <div className="lg:col-span-2 flex flex-col gap-5">
                <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.7vw,1.2rem)', lineHeight: 1.55, maxWidth: '60ch' }}>
                  Each listing earns a motivation score from real MLS data only. Three signals
                  drive the score: price cuts from the original list price (the more and the
                  bigger, the higher the score), days on market (a long time on market with
                  no takers is a signal), and specific phrases in the listing remarks
                  (the agent or seller saying things like &quot;seller motivated,&quot; &quot;priced to sell,&quot;
                  or &quot;bring all offers&quot;). No guesswork, no fabrication.
                </p>
                <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.7vw,1.2rem)', lineHeight: 1.55, maxWidth: '60ch' }}>
                  A home with two price cuts totaling 8 percent plus &quot;motivated seller&quot; in the
                  remarks will rank above a home that simply sat 60 days. The score is
                  recalculated every 10 minutes as new price changes come through.
                </p>
              </div>
              <div
                className="flex flex-col gap-3 pt-1"
                style={{ borderTop: 'var(--edge) solid var(--navy)' }}
              >
                <span className="mono-lab" style={{ color: 'var(--navy-70)', paddingTop: '14px' }}>
                  Score signals
                </span>
                <dl className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <dt style={{ fontWeight: 700, width: '6.5rem', flexShrink: 0 }}>Price cuts</dt>
                    <dd style={{ color: 'var(--navy-70)' }}>Number of distinct reductions</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt style={{ fontWeight: 700, width: '6.5rem', flexShrink: 0 }}>Total drop</dt>
                    <dd style={{ color: 'var(--navy-70)' }}>From original list to current price</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt style={{ fontWeight: 700, width: '6.5rem', flexShrink: 0 }}>Remarks</dt>
                    <dd style={{ color: 'var(--navy-70)' }}>Seller motivation phrases in listing text</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt style={{ fontWeight: 700, width: '6.5rem', flexShrink: 0 }}>DOM</dt>
                    <dd style={{ color: 'var(--navy-70)' }}>Days on market (secondary weight)</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* City filter chips — All cities + one per SITE_CITY_SLUGS, linking to
            the per-city pages. */}
        <section className="section" id="filter-by-city" aria-label="Filter by city">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Filter by city</span>
              <h2 className="sec-title display">
                Browse by
                <br />
                area
              </h2>
            </div>
            <nav className="flex flex-wrap gap-2 pt-7" aria-label="Motivated sellers by city">
              <Link
                href="/motivated-sellers"
                aria-current="page"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold"
                style={{
                  background: 'var(--navy)',
                  color: 'var(--cream)',
                  border: 'var(--edge) solid var(--navy)',
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                }}
              >
                All cities
              </Link>
              {SITE_CITY_SLUGS.map((slug) => {
                const label = CITY_DISPLAY[slug] ?? slug
                return (
                  <Link
                    key={slug}
                    href={`/motivated-sellers/${slug}`}
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold"
                    style={{
                      background: 'transparent',
                      color: 'var(--navy)',
                      border: 'var(--edge) solid var(--navy)',
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </section>

        {/* Listing grid — every motivated listing rendered (top motivation
            reason badge + photo + price + address + city + beds/baths). Honest
            empty state when the MLS returns nothing. */}
        <section className="section listings" id="listings" aria-label="Motivated seller homes">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Most motivated</span>
              <h2 className="sec-title display">
                {listings.length > 0 ? (
                  <>
                    {listings.length} motivated
                    <br />
                    seller homes
                  </>
                ) : (
                  <>
                    Motivated
                    <br />
                    seller homes
                  </>
                )}
              </h2>
            </div>
            {listings.length > 0 ? (
              <div className="lst-grid">
                {listings.map((listing) => (
                  <MotivatedTile key={listing.listingKey ?? listing.listNumber} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="pt-8" style={{ maxWidth: '54ch' }}>
                <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.7vw,1.2rem)', lineHeight: 1.55 }}>
                  No motivated seller listings found at the moment. Check back soon as the
                  MLS updates throughout the day.
                </p>
                <div className="sec-cta">
                  <a href="/homes-for-sale" className="btn alt">
                    Browse all homes <span className="arr">→</span>
                  </a>
                </div>
              </div>
            )}
            <div className="lst-foot">
              <a href="/homes-for-sale" className="btn alt">
                All homes for sale <span className="arr">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* Closing CTA — talk to a broker / call (preserved from CTABar). */}
        <section className="section" id="contact-cta" aria-label="Talk to a broker">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Ready to make an offer</span>
              <h2 className="sec-title display">
                Local brokers.
                <br />
                Specific numbers.
              </h2>
            </div>
            <div className="pt-7" style={{ maxWidth: '52ch' }}>
              <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.7vw,1.2rem)', lineHeight: 1.55 }}>
                We know this market. If a motivated seller has priced a home to move, we can tell
                you whether it is actually a deal. No hype, just the facts.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-6">
                <a href="/contact" className="btn alt">
                  Talk to a broker <span className="arr">→</span>
                </a>
                <a
                  href={`tel:${CONTACT.phoneDirectTel}`}
                  className="btn alt"
                  style={{ background: 'transparent', color: 'var(--navy)' }}
                >
                  Call {CONTACT.phoneDirect}
                </a>
              </div>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
