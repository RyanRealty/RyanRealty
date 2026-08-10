/**
 * /motivated-sellers/[city] — Per-city motivated seller listings page.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior HeroBlock/Section/Container layout: every piece of
 * content is preserved.
 *   - generateStaticParams (one page per SITE_CITY_SLUGS) + dynamicParams=false
 *   - getCityName display helper + notFound() guard on unknown cities
 *   - getMotivatedListings({ city }) DAL call (limit 48) with the same resilient
 *     .catch() empty fallback
 *   - breadcrumb + webPage JSON-LD with the city name (MetadataBlock)
 *   - hero copy (city-specific H1 + the dynamic lede that shows the live count)
 *   - the "How scores work / Why these homes are ranked above others" intro
 *     (both paragraphs)
 *   - the listing grid (every motivated listing, top motivation reason badge,
 *     beds/baths/price/address/city) PLUS the "View all Central Oregon" link
 *   - the honest empty state with its "View all" link
 *   - the "Motivated sellers in other cities" sibling-city chips
 *   - the per-city closing CTA (talk to a broker / call)
 *
 * Only the presentation changed — the page wears the KB shell (KbNav, KbHero,
 * KbFooter, SmoothScrollProvider, KbSectionTracker) and the Amboqia display /
 * hard-edge surfaces of the rest of the migrated site.
 *
 * Data ONLY through @/lib/data. No app/actions/* imports.
 *
 * SEO: export ASYNC generateMetadata (canonical + OG via pageMetadata),
 * BreadcrumbList + webPage JSON-LD. PAGE CONTRACT: KB design + SEO + tracking
 * (KbSectionTracker pageType="motivated-sellers-city").
 */

import { notFound } from 'next/navigation'
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
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import TrackSearchView from '@/components/tracking/TrackSearchView'
import { kbMoneyFull } from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

// ─── ISR + static params ──────────────────────────────────────────────────

export const revalidate = 600
export const dynamicParams = false

export function generateStaticParams(): Array<{ city: string }> {
  return SITE_CITY_SLUGS.map((slug) => ({ city: slug }))
}

// ─── City display helpers ─────────────────────────────────────────────────

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

function getCityName(slug: string): string {
  return (
    CITY_DISPLAY[slug] ??
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
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

// ─── Metadata ─────────────────────────────────────────────────────────────

type Props = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params
  if (!SITE_CITY_SLUGS.includes(slug)) notFound()
  const cityName = getCityName(slug)
  return pageMetadata({
    title: `Price-cut and motivated seller homes in ${cityName}, Oregon`,
    description:
      `Active homes in ${cityName}, Oregon with documented MLS price cuts or seller-motivation language in the remarks. ` +
      `Ranked by price cuts, remarks, and days on market.`,
    path: `/motivated-sellers/${slug}`,
    keywords: [
      `motivated seller homes ${cityName} Oregon`,
      `price reduced homes ${cityName}`,
      `motivated sellers ${cityName} OR`,
      `price cut homes ${cityName} Oregon`,
    ],
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function MotivatedSellersCityPage({ params }: Props) {
  const { city: slug } = await params
  if (!SITE_CITY_SLUGS.includes(slug)) notFound()

  const cityName = getCityName(slug)

  const { listings } = await getMotivatedListings({
    // Pass the display-case city name; the DAL uses ilike() for matching
    city: cityName,
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
        { name: cityName, url: `/motivated-sellers/${slug}` },
      ],
    },
    {
      type: 'webPage',
      name: `Price-cut and motivated seller homes in ${cityName}, Oregon`,
      description: `Active homes in ${cityName}, Oregon with MLS price cuts or seller-motivation language in the remarks.`,
      url: `/motivated-sellers/${slug}`,
    },
  ]

  const siblingCities = SITE_CITY_SLUGS.filter((s) => s !== slug)

  const heroLead =
    listings.length > 0
      ? `${listings.length} ${listings.length === 1 ? 'listing' : 'listings'} in ${cityName} with a documented price cut, seller-motivation language in the remarks, or a long time on market. Updated from the regional MLS.`
      : `Active homes in ${cityName} with MLS price cuts or seller-motivation language in the remarks. Updated from the regional MLS.`

  return (
    <main className="kb-root">
      <KbSectionTracker pageType="motivated-sellers-city" />
      <TrackSearchView city={cityName} resultsCount={listings.length} />
      <MetadataBlock schemas={schemas} />

      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Motivated sellers', href: '/motivated-sellers' },
          { label: cityName },
        ]}
      />

      <SmoothScrollProvider>
        {/* Hero — same city-specific H1 + the dynamic count-aware lede as the
            prior HeroBlock, in the KB Amboqia display. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow={`${cityName}, Oregon · MLS price cuts and remarks`}
          titleTop="Price cuts in"
          titleBottom={cityName}
          lead={heroLead}
          videoSrc={null}
          posterSrc="/images/homepage/tetherow-golf-aerial.jpg"
        />

        {/* Intro — transparency + keyword content. Both paragraphs preserved. */}
        <section className="section" id="how-scores-work" aria-label="How scores work">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">How the list is built</span>
              <h2 className="sec-title display">
                What gets a home
                <br />
                on this page
              </h2>
            </div>
            <div className="flex flex-col gap-5 pt-8" style={{ maxWidth: '64ch' }}>
              <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.7vw,1.2rem)', lineHeight: 1.55 }}>
                Every listing here has at least one signal from the MLS: a price reduction
                from the original list price, phrases in the remarks such as &quot;seller motivated,&quot;
                &quot;priced to sell,&quot; or &quot;bring all offers,&quot; or a long time on market. The score
                weights price cuts most heavily, then remarks, then days on market.
              </p>
              <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.7vw,1.2rem)', lineHeight: 1.55 }}>
                The list refreshes every 10 minutes. When a price changes in the MLS, the
                score recalculates and the ranking updates.
              </p>
            </div>
          </div>
        </section>

        {/* Listing grid — every motivated listing in this city. Honest empty
            state. Both states keep the "View all Central Oregon" link. */}
        <section className="section listings" id="listings" aria-label={`Motivated seller homes in ${cityName}`}>
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Ranked by MLS signals</span>
              <h2 className="sec-title display">
                {listings.length > 0 ? (
                  <>
                    {listings.length} {listings.length === 1 ? 'home' : 'homes'} on
                    <br />
                    this list in {cityName}
                  </>
                ) : (
                  <>
                    Homes on this list
                    <br />
                    in {cityName}
                  </>
                )}
              </h2>
              <Link
                href="/motivated-sellers"
                style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--navy-70)', whiteSpace: 'nowrap', textDecoration: 'underline', textUnderlineOffset: '4px' }}
              >
                View all Central Oregon
              </Link>
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
                  No listings in {cityName} currently match the price-cut or motivation signals.
                  The MLS updates throughout the day.
                </p>
                <div className="sec-cta">
                  <Link href="/motivated-sellers" className="btn alt">
                    View all Central Oregon on this list <span className="arr">→</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Other cities — sibling-city chips. */}
        <section className="section" id="other-cities" aria-label="Price-cut homes in other cities">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">
                Same list in
                <br />
                other cities
              </h2>
            </div>
            <nav className="flex flex-wrap gap-2 pt-7" aria-label="Other cities">
              {siblingCities.map((sibling) => {
                const label = CITY_DISPLAY[sibling] ?? sibling
                return (
                  <Link
                    key={sibling}
                    href={`/motivated-sellers/${sibling}`}
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

        {/* Per-city closing CTA — preserved from CTABar. */}
        <section className="section" id="contact-cta" aria-label="Talk to a broker">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Before you write an offer</span>
              <h2 className="sec-title display">
                Put the cut next
                <br />
                to the comps
              </h2>
            </div>
            <div className="pt-7" style={{ maxWidth: '52ch' }}>
              <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.7vw,1.2rem)', lineHeight: 1.55 }}>
                A price cut or a motivated-seller remark does not mean the home is a bargain.
                A broker can set the new ask next to recent closed sales in {cityName} and tell
                you whether it still sits high, lands near market, or already looks soft.
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
