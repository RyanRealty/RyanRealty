// @no-parity - proof-led editorial conviction LP, no Wave 3 mockup contract
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import LandingPageTracker from '@/components/LandingPageTracker'
import SellerLPForm from '@/app/lp/seller-home-value/SellerLPForm'
import {
  getSoldStories,
  getTestimonialAggregate,
} from '@/app/lp/seller-home-value/data'
import { getBrokerageTrackRecord } from '@/lib/data'
import { TESTIMONIALS, GOOGLE_REVIEWS_URL } from '@/lib/testimonials'

export const metadata: Metadata = {
  title: 'List Your Bend Home With Ryan Realty',
  description:
    'A full-service local brokerage with the reviews and the results to back it up. Pricing from real Bend sales, hands-on marketing, and a broker with you from start to close.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'List Your Bend Home With Ryan Realty',
    description:
      'A full-service local brokerage with the reviews and the results to back it up.',
    type: 'website',
  },
}

const BROKER_PHONE = '541.703.3095'
const BROKER_PHONE_TEL = '+15417033095'

/** Compact USD formatter: "$12.2M", "$813K". */
function fmtCompact(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000
    const s = m.toFixed(m >= 100 ? 0 : m >= 3 ? 1 : 2).replace(/\.?0+$/, '')
    return `$${s}M`
  }
  const k = Math.round(v / 1000)
  return `$${k}K`
}

/** Round a dollar amount to the nearest thousand for full display. */
function fmtFull(v: number): string {
  const rounded = Math.round(v / 1000) * 1000
  return `$${rounded.toLocaleString('en-US')}`
}

// Three pull-quotes chosen for brevity and specificity. No invented copy.
const FEATURED_REVIEWS = [
  'Audra Hedberg',
  'Charise Millard',
  'Helen Luna Fess',
]

export default async function ListYourHomePage() {
  const cookiePersonId = await getFubPersonIdFromCookie()
  const knownVisitor = cookiePersonId !== null && cookiePersonId > 0

  const [trackRecord, soldStories, aggregate] = await Promise.all([
    getBrokerageTrackRecord(),
    getSoldStories(),
    getTestimonialAggregate(),
  ])

  const featuredReviews = FEATURED_REVIEWS.map((name) =>
    TESTIMONIALS.find((t) => t.author === name)
  ).filter((t): t is NonNullable<typeof t> => t !== undefined)

  // Only Bend homes we LISTED and sold (list-side) with a real photo.
  const SOLD_BEND_ADDRESSES = [
    '2354 NW Drouillard Ave',
    '1974 NE Newport Hills Dr',
    '64350 Old Bend Redmond Hwy',
  ]
  const soldListings = SOLD_BEND_ADDRESSES.map((addr) =>
    soldStories.find(
      (s) =>
        s.side === 'list' &&
        s.listing.addressLine === addr &&
        s.listing.badge === 'Sold' &&
        typeof s.listing.photoUrl === 'string' &&
        s.listing.photoUrl.length > 0
    )
  ).filter((s): s is NonNullable<typeof s> => s != null)

  const reviewSchema = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: 'Ryan Realty LLC',
    telephone: BROKER_PHONE_TEL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Bend',
      addressRegion: 'OR',
      addressCountry: 'US',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: aggregate.rating,
      reviewCount: aggregate.count,
      bestRating: '5',
    },
  }

  return (
    <div className="bg-background text-foreground">
      <LandingPageTracker lpVariant="sell-your-home" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }}
      />

      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center" aria-label="Ryan Realty, Bend, Oregon">
            <span className="relative block h-7 w-36 shrink-0 sm:h-9 sm:w-44">
              <Image
                src="/images/brand/logo-horizontal-blue.png"
                alt="Ryan Realty, Bend, Oregon"
                fill
                sizes="(max-width: 640px) 140px, 180px"
                className="object-contain object-left"
                priority
              />
            </span>
          </Link>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:px-4"
            aria-label={`Call Ryan Realty at ${BROKER_PHONE}`}
          >
            <PhoneIcon className="h-4 w-4" />
            <span className="tabular-nums">{BROKER_PHONE}</span>
          </a>
        </div>
      </header>

      {/* SECTION 1: OPENING
          Proof-led, left-anchored, typographic.
          The total volume is an oversized design element, not a card.
          No centered stack. No eyebrow/headline/subhead/CTA template. */}
      <section className="overflow-x-clip bg-background pt-16 pb-14 sm:pt-24 sm:pb-20">
        <div className="mx-auto max-w-5xl px-6">
          {/* Asymmetric two-column: claim left, stat anchor right */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
            {/* Left: confident claim line */}
            <div className="max-w-xl">
              <h1 className="not-italic font-display text-4xl font-semibold leading-tight tracking-tight text-primary sm:text-5xl">
                The proof is the page.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-foreground/75">
                Ryan Realty has represented sellers through every kind of Bend market. Real data, real broker, from your first call to closing day.
              </p>
              {aggregate.count > 0 && (
                <p className="mt-4 text-sm text-muted-foreground tabular-nums">
                  <span className="text-warning" aria-label="Five stars">{'★★★★★'}</span>
                  {'  '}{aggregate.rating} · {aggregate.count} Google reviews
                </p>
              )}
              <div className="mt-8">
                <a
                  href="#consult"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Book a free consultation
                </a>
              </div>
            </div>

            {/* Right: oversized typographic volume anchor. Not a card. */}
            {trackRecord !== null && (
              <div className="shrink-0 lg:pb-1">
                <p
                  className="not-italic font-display font-semibold tabular-nums leading-none text-primary"
                  style={{ fontSize: 'clamp(4rem, 8vw, 7rem)' }}
                  aria-label={`${fmtCompact(trackRecord.totalVolume)} in Bend homes sold`}
                >
                  {fmtCompact(trackRecord.totalVolume)}
                </p>
                <p className="mt-2 text-base text-foreground/60">
                  in Bend homes sold
                </p>
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                  Avg {fmtCompact(trackRecord.avgSalePrice)} per sale
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: WHY LIST WITH US
          Typographic stacked sequence. NOT three equal cards. NOT tiles.
          No uppercase eyebrow per point. Asymmetric column rhythm. */}
      <section className="bg-card py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="not-italic font-display text-3xl font-semibold text-primary sm:text-4xl">
            Why list with us
          </h2>

          <div className="mt-12 divide-y divide-primary/8">
            <WhyPoint
              title="Broker access from day one"
              body="The person who prices your home is the person on the phone when a buyer's agent calls. No handoffs."
            />
            <WhyPoint
              title="Pricing from real local sales"
              body="We pull recent closed sales near your home and walk you through the comps before we agree on a number. You see the reasoning."
            />
            <WhyPoint
              title="Marketing built for your home"
              body="Professional photography, a full MLS listing with wide syndication, and targeted local promotion. Your interests, not a template."
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: THE TEAM
          Asymmetric editorial layout.
          Matt primary (larger). Paul + Rebecca secondary.
          Transparent PNGs floating on cream. No rectangular card frames.
          No drop-shadow boxes. No centered three-equal-avatar grid. */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="not-italic font-display text-3xl font-semibold text-primary sm:text-4xl">
            Your broker is based in Bend
          </h2>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-foreground/65">
            Working this market every day. The broker you meet is your broker from listing to close.
          </p>

          {/* Asymmetric: Matt large + primary, Paul + Rebecca secondary + offset */}
          <div className="mt-12 flex flex-col gap-12 sm:flex-row sm:items-end sm:gap-8 lg:gap-14">
            {/* Primary broker: Matt */}
            <div className="flex flex-col sm:w-64">
              <span className="relative block h-72 w-48 sm:h-80 sm:w-56">
                <Image
                  src="/images/brokers/ryan-matt.png"
                  alt="Matt Ryan, Principal Broker"
                  fill
                  sizes="(max-width: 640px) 192px, 224px"
                  className="object-contain object-bottom"
                />
              </span>
              <div className="mt-3">
                <p className="not-italic font-display text-xl font-semibold text-primary">Matt Ryan</p>
                <p className="text-sm text-muted-foreground">Principal Broker · Founder</p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">Founded Ryan Realty in 2023. Licensed in Oregon since 2021.</p>
              </div>
            </div>

            {/* Secondary brokers: Paul and Rebecca */}
            <div className="flex flex-row gap-8 sm:gap-6 lg:gap-10">
              <div className="flex flex-col">
                <span className="relative block h-52 w-36 sm:h-60 sm:w-40">
                  <Image
                    src="/images/brokers/stevenson-paul.png"
                    alt="Paul Stevenson, Broker"
                    fill
                    sizes="(max-width: 640px) 144px, 160px"
                    className="object-contain object-bottom"
                  />
                </span>
                <div className="mt-3">
                  <p className="not-italic font-display text-base font-semibold text-primary">Paul Stevenson</p>
                  <p className="text-xs text-muted-foreground">Broker</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/60">Buyers and sellers across Bend.</p>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="relative block h-52 w-36 sm:h-60 sm:w-40">
                  <Image
                    src="/images/brokers/peterson-rebecca.png"
                    alt="Rebecca Peterson, Broker"
                    fill
                    sizes="(max-width: 640px) 144px, 160px"
                    className="object-contain object-bottom"
                  />
                </span>
                <div className="mt-3">
                  <p className="not-italic font-display text-base font-semibold text-primary">Rebecca Peterson</p>
                  <p className="text-xs text-muted-foreground">Broker</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/60">NW Crossing and Westside Bend.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: RECENTLY SOLD IN BEND
          Varied layout: first listing breakout (larger), rest smaller.
          NOT three equal cards. Real address, neighborhood, close price.
          Only verified Bend list-side sales with photos. */}
      {soldListings.length > 0 && (
        <section className="bg-card py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-10">
              <h2 className="not-italic font-display text-3xl font-semibold text-primary sm:text-4xl">
                Recently sold in Bend
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Verified against MLS records. Homes we listed.
              </p>
            </div>

            {/* Varied editorial layout: breakout strip on top, two smaller below */}
            <div className="flex flex-col gap-4">
              {/* Breakout: full-width wide card */}
              {soldListings[0] !== undefined && (() => {
                const story = soldListings[0]
                const cp =
                  story.listing.closePrice !== null &&
                  story.listing.closePrice !== undefined &&
                  story.listing.closePrice > 0
                    ? story.listing.closePrice
                    : null
                return (
                  <div key={story.key} className="overflow-hidden rounded-2xl bg-background">
                    <div className="relative h-72 w-full overflow-hidden sm:h-80">
                      <Image
                        src={story.listing.photoUrl}
                        alt={story.listing.addressLine}
                        fill
                        sizes="100vw"
                        className="object-cover object-center transition-transform duration-700 hover:scale-105"
                      />
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs text-muted-foreground">
                        {story.listing.neighborhood !== null ? story.listing.neighborhood : 'Bend, OR'}
                      </p>
                      <p className="mt-0.5 not-italic font-display text-base font-semibold text-primary">
                        {story.listing.addressLine}
                      </p>
                      {cp !== null && (
                        <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">
                          Sold {fmtFull(cp)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Secondary row: two smaller cards side by side */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {soldListings.slice(1).map((story) => {
                  const cp =
                    story.listing.closePrice !== null &&
                    story.listing.closePrice !== undefined &&
                    story.listing.closePrice > 0
                      ? story.listing.closePrice
                      : null
                  return (
                    <div key={story.key} className="overflow-hidden rounded-2xl bg-background">
                      <div className="relative h-52 w-full overflow-hidden">
                        <Image
                          src={story.listing.photoUrl}
                          alt={story.listing.addressLine}
                          fill
                          sizes="(max-width: 640px) 100vw, 50vw"
                          className="object-cover object-center transition-transform duration-700 hover:scale-105"
                        />
                      </div>
                      <div className="px-5 py-4">
                        <p className="text-xs text-muted-foreground">
                          {story.listing.neighborhood !== null ? story.listing.neighborhood : 'Bend, OR'}
                        </p>
                        <p className="mt-0.5 not-italic font-display text-base font-semibold text-primary">
                          {story.listing.addressLine}
                        </p>
                        {cp !== null && (
                          <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">
                            Sold {fmtFull(cp)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 5: REVIEWS
          Oversized pull-quotes on cream. NOT a wall. NOT a 3-col grid.
          Stars use warning token only. Aggregate from live data. */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-baseline justify-between gap-6">
            <h2 className="not-italic font-display text-3xl font-semibold text-primary sm:text-4xl">
              What sellers say
            </h2>
            {aggregate.count > 0 && (
              <a
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {aggregate.rating} ★ · {aggregate.count} reviews
              </a>
            )}
          </div>

          {/* Oversized pull-quotes, single column, generous spacing */}
          <div className="mt-10 space-y-12">
            {featuredReviews.map((t) => (
              <figure key={t.author} className="max-w-3xl">
                <span className="text-lg leading-none text-warning" aria-label="Five star rating">
                  {'★★★★★'}
                </span>
                <blockquote className="mt-3 not-italic font-display text-xl font-semibold leading-snug text-primary sm:text-2xl">
                  {'"'}{t.quote}{'"'}
                </blockquote>
                <figcaption className="mt-4 text-sm text-muted-foreground">
                  {t.author}
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-12 border-t border-primary/8 pt-10">
            <a
              href={GOOGLE_REVIEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              <GoogleMark className="h-4 w-4 opacity-60" />
              Read all {aggregate.count} reviews on Google
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 6: CONSULTATION FORM
          The ONE full-bleed navy moment. id="consult".
          bg-primary text-primary-foreground.
          Only dark register shift on this page. The conversion goal. */}
      <section id="consult" className="bg-primary py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="not-italic font-display text-3xl font-semibold text-primary-foreground sm:text-4xl">
            {"Let's talk about your sale."}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-primary-foreground/75">
            Tell us about your property. A broker will reach out to talk through pricing and a plan. No pitch, no pressure, no obligation.
          </p>
          <div className="mt-8">
            <SellerLPForm knownVisitor={knownVisitor} variant="list-now" />
          </div>
          <p className="mt-5 text-sm text-primary-foreground/50">
            Or call us directly:{' '}
            <a
              href={`tel:${BROKER_PHONE_TEL}`}
              className="font-semibold tabular-nums text-primary-foreground underline-offset-2 hover:underline"
            >
              {BROKER_PHONE}
            </a>
          </p>
        </div>
      </section>

      {/* SECTION 7: FOOTER - minimal */}
      <footer className="bg-card pb-20 sm:pb-8">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center text-sm text-muted-foreground">
          <p>Ryan Realty LLC · Equal Housing Opportunity</p>
          <p className="mt-2">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy
            </Link>
            <span className="mx-2">·</span>
            {'© '}{new Date().getFullYear()} Ryan Realty LLC
          </p>
        </div>
      </footer>

      {/* Sticky mobile CTA bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/15 bg-card/95 px-3 py-3 backdrop-blur sm:hidden">
        <div className="flex items-center gap-2">
          <a
            href="#consult"
            className="flex-1 rounded-full bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
          >
            Book a free consultation
          </a>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            aria-label={`Call Ryan Realty at ${BROKER_PHONE}`}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </div>
  )
}

// Presentational helpers

function WhyPoint({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-8 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[2fr_3fr] sm:items-start sm:gap-12">
      <p className="not-italic font-display text-lg font-semibold leading-snug text-primary sm:text-xl">
        {title}
      </p>
      <p className="mt-2 text-base leading-relaxed text-foreground/65 sm:mt-0">
        {body}
      </p>
    </div>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Google"
      role="img"
    >
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09A6.97 6.97 0 0 1 5.5 12c0-.72.12-1.42.34-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.16-3.16C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
