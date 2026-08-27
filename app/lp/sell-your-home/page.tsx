// @no-parity - proof-led editorial conviction LP, no Wave 3 mockup contract
import type { Metadata } from 'next'
import { V3Footer, V3_FOOTER_COLUMNS } from '@/components/site/v3'
import Image from 'next/image'
import Link from 'next/link'
import ScrollReveal from '@/components/landing/ScrollReveal'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
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
    'Pricing from closed Bend sales. The broker who sets the list price runs the listing. Book a free consultation.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'List Your Bend Home With Ryan Realty',
    description:
      'Pricing from closed Bend sales. The broker who sets the list price runs the listing.',
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
  const cookiePersonId = await getPersonIdFromCookie()
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
    <>
    <main className="bg-cream text-navy">
      <LandingPageTracker lpVariant="sell-your-home" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }}
      />

      {/* ─── Sticky minimal header — wordmark + phone (KB navy bar) ───────── */}
      <header className="sticky top-0 z-40 border-b-[3px] border-navy bg-navy">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="Ryan Realty · Bend, Oregon">
            <span className="relative block h-7 w-[140px] shrink-0 sm:h-9 sm:w-[180px]">
              <Image
                src="/images/brand/logo-horizontal-navy-transparent.png"
                alt="Ryan Realty · Bend, Oregon"
                fill
                sizes="(max-width: 640px) 140px, 180px"
                className="object-contain object-left brightness-0 invert"
                priority
              />
            </span>
          </Link>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            className="inline-flex items-center gap-1.5 border-[3px] border-cream bg-cream px-3 py-2 text-sm font-bold uppercase tracking-[0.1em] text-navy transition-colors hover:bg-transparent hover:text-cream sm:px-4"
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
      <section className="overflow-x-clip border-b-[3px] border-navy bg-cream pt-16 pb-14 sm:pt-24 sm:pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {/* Asymmetric two-column: claim left, stat anchor right */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
            {/* Left: confident claim line */}
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-navy/70">
                Bend · Oregon · List your home
              </p>
              <h1 className="mt-4 font-display text-4xl uppercase leading-[0.92] tracking-[-0.01em] text-navy sm:text-5xl lg:text-6xl">
                List your Bend home with us.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-navy/75">
                Pricing from closed sales near your home. The broker who sets the list price is the one who runs the listing. Book a free consultation and we walk the comps with you.
              </p>
              {aggregate.count > 0 && (
                <p className="mt-4 text-sm tabular-nums text-navy/70">
                  <span className="text-navy" aria-label="Five stars">{'★★★★★'}</span>
                  {'  '}{aggregate.rating} · {aggregate.count} Google reviews
                </p>
              )}
              <div className="mt-8">
                <a
                  href="#consult"
                  className="inline-flex items-center justify-center border-[3px] border-navy bg-navy px-8 py-4 text-sm font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:bg-transparent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
                >
                  Book a free consultation
                </a>
              </div>
            </div>

            {/* Right: oversized typographic volume anchor. Hard navy frame.
                Qualified with the window + sale count (design-audit P3) — all
                three figures come from the same getBrokerageTrackRecord pull
                (closed Ryan Realty listings; the brokerage opened in 2023). */}
            {trackRecord !== null && (
              <div className="shrink-0 border-[3px] border-navy bg-navy p-6 text-cream sm:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/60">
                  In Bend-area homes sold since 2023
                </p>
                <p
                  className="mt-3 font-display tabular-nums leading-none text-cream"
                  style={{ fontSize: 'clamp(4rem, 8vw, 7rem)' }}
                  aria-label={`${fmtCompact(trackRecord.totalVolume)} in Bend-area homes sold since 2023`}
                >
                  {fmtCompact(trackRecord.totalVolume)}
                </p>
                <p className="mt-4 text-sm tabular-nums text-cream/70">
                  {trackRecord.homesSold} sales · avg {fmtCompact(trackRecord.avgSalePrice)} per sale
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: WHY LIST WITH US
          Typographic stacked sequence. NOT three equal cards. NOT tiles.
          No uppercase eyebrow per point. Asymmetric column rhythm. */}
      <section className="border-b-[3px] border-navy bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-navy/70">
              What you get
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-navy sm:text-4xl">
              How a listing with us works
            </h2>
          </ScrollReveal>

          <div className="mt-12 border-t-[3px] border-navy">
            <WhyPoint
              title="One broker, listing to close"
              body="The person who prices your home is the person on the phone when a buyer's agent calls. No handoffs."
            />
            <WhyPoint
              title="Price from closed sales near you"
              body="We pull recent closed sales near your home and walk the comps with you before we agree on a list price."
            />
            <WhyPoint
              title="MLS, photos, and showings"
              body="Professional photography, a full MLS listing with syndication to the major portals, and showings coordinated for feedback."
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: THE TEAM
          Editorial layout: Matt leads by name size + role, portraits share one
          rendered height and one text baseline (design-audit P3).
          Transparent PNGs floating on cream. No rectangular card frames.
          No drop-shadow boxes. */}
      <section className="border-b-[3px] border-navy bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-navy/70">
              Who lists your home
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-navy sm:text-4xl">
              Your broker is based in Bend
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-navy/65">
              Based in Bend. The broker you meet is your broker from listing to close.
            </p>
          </ScrollReveal>

          {/* Equal portrait heights + top-aligned columns so the three name rows
              share one baseline (design-audit P3 — mismatched crops read as
              broken, not as hierarchy; Matt leads via name size + role). */}
          <div className="mt-12 flex flex-col gap-12 sm:flex-row sm:items-start sm:gap-8 lg:gap-14">
            {/* Primary broker: Matt */}
            <ScrollReveal className="flex flex-col sm:w-64" delayMs={0}>
              <span className="relative block h-60 w-40 sm:h-72 sm:w-48">
                <Image
                  src="/images/brokers/ryan-matt.png"
                  alt="Matt Ryan, Principal Broker"
                  fill
                  sizes="(max-width: 640px) 160px, 192px"
                  className="object-contain object-bottom"
                />
              </span>
              <div className="mt-3">
                <p className="font-display text-xl uppercase leading-none tracking-[-0.01em] text-navy">Matt Ryan</p>
                <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy/65">Principal Broker · Founder</p>
                <p className="mt-1.5 text-sm leading-relaxed text-navy/70">Founded Ryan Realty in 2023. Licensed in Oregon since 2021.</p>
              </div>
            </ScrollReveal>

            {/* Secondary brokers: Paul and Rebecca */}
            <div className="flex flex-row gap-8 sm:gap-6 lg:gap-10">
              <ScrollReveal className="flex flex-col" delayMs={75}>
                <span className="relative block h-60 w-40 sm:h-72 sm:w-48">
                  <Image
                    src="/images/brokers/stevenson-paul.png"
                    alt="Paul Stevenson, Broker"
                    fill
                    sizes="(max-width: 640px) 160px, 192px"
                    className="object-contain object-bottom"
                  />
                </span>
                <div className="mt-3">
                  <p className="font-display text-base uppercase leading-none tracking-[-0.01em] text-navy">Paul Stevenson</p>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy/65">Broker</p>
                  <p className="mt-1 text-xs leading-relaxed text-navy/70">Buyers and sellers across Bend.</p>
                </div>
              </ScrollReveal>

              <ScrollReveal className="flex flex-col" delayMs={150}>
                <span className="relative block h-60 w-40 sm:h-72 sm:w-48">
                  <Image
                    src="/images/brokers/peterson-rebecca.png"
                    alt="Rebecca Peterson, Broker"
                    fill
                    sizes="(max-width: 640px) 160px, 192px"
                    className="object-contain object-bottom"
                  />
                </span>
                <div className="mt-3">
                  <p className="font-display text-base uppercase leading-none tracking-[-0.01em] text-navy">Rebecca Peterson</p>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy/65">Broker</p>
                  <p className="mt-1 text-xs leading-relaxed text-navy/70">NW Crossing and Westside Bend.</p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: RECENTLY SOLD IN BEND
          Varied layout: first listing breakout (larger), rest smaller.
          NOT three equal cards. Real address, neighborhood, close price.
          Only verified Bend list-side sales with photos. */}
      {soldListings.length > 0 && (
        <section className="border-b-[3px] border-navy bg-cream py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <ScrollReveal className="mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-navy/70">
                Closed · Verified
              </p>
              {/* "Bend area", not "Bend" — the set includes a Tumalo sale, and a
                  'verified' section cannot contradict its own cards (design-audit P3). */}
              <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-navy sm:text-4xl">
                Recently sold in the Bend area
              </h2>
              <p className="mt-3 text-base text-navy/70">
                Verified against MLS records. Homes we listed.
              </p>
            </ScrollReveal>

            {/* Varied editorial layout: breakout strip on top, two smaller below */}
            <div className="flex flex-col gap-5">
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
                  <ScrollReveal key={story.key}>
                    <div className="overflow-hidden border-[3px] border-navy bg-navy text-cream">
                      <div className="relative h-72 w-full overflow-hidden sm:h-80">
                        <Image
                          src={story.listing.photoUrl}
                          alt={story.listing.addressLine}
                          fill
                          sizes="100vw"
                          className="object-cover object-center"
                        />
                      </div>
                      <div className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cream/65">
                          {story.listing.neighborhood !== null ? story.listing.neighborhood : 'Bend, OR'}
                        </p>
                        <p className="mt-1 text-sm font-semibold tracking-[0.01em] text-cream">
                          {story.listing.addressLine}
                        </p>
                        {cp !== null && (
                          <p className="mt-4 inline-flex border-[3px] border-cream bg-cream px-3 py-1 font-display text-sm tabular-nums text-navy">
                            Sold {fmtFull(cp)}
                          </p>
                        )}
                      </div>
                    </div>
                  </ScrollReveal>
                )
              })()}

              {/* Secondary row: two smaller cards side by side */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {soldListings.slice(1).map((story, i) => {
                  const cp =
                    story.listing.closePrice !== null &&
                    story.listing.closePrice !== undefined &&
                    story.listing.closePrice > 0
                      ? story.listing.closePrice
                      : null
                  return (
                    <ScrollReveal key={story.key} delayMs={i * 75}>
                      <div className="overflow-hidden border-[3px] border-navy bg-navy text-cream">
                        <div className="relative h-52 w-full overflow-hidden">
                          <Image
                            src={story.listing.photoUrl}
                            alt={story.listing.addressLine}
                            fill
                            sizes="(max-width: 640px) 100vw, 50vw"
                            className="object-cover object-center"
                          />
                        </div>
                        <div className="p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cream/65">
                            {story.listing.neighborhood !== null ? story.listing.neighborhood : 'Bend, OR'}
                          </p>
                          <p className="mt-1 text-sm font-semibold tracking-[0.01em] text-cream">
                            {story.listing.addressLine}
                          </p>
                          {cp !== null && (
                            <p className="mt-4 inline-flex border-[3px] border-cream bg-cream px-3 py-1 font-display text-sm tabular-nums text-navy">
                              Sold {fmtFull(cp)}
                            </p>
                          )}
                        </div>
                      </div>
                    </ScrollReveal>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 5: REVIEWS
          Oversized pull-quotes on cream. NOT a wall. NOT a 3-col grid.
          Aggregate from live data. */}
      <section className="border-b-[3px] border-navy bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <ScrollReveal>
            <div className="flex items-baseline justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-navy/70">
                  In their words
                </p>
                <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-navy sm:text-4xl">
                  What sellers say
                </h2>
              </div>
              {aggregate.count > 0 && (
                <a
                  href={GOOGLE_REVIEWS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-semibold text-navy underline-offset-4 hover:underline"
                >
                  {aggregate.rating} ★ · {aggregate.count} reviews
                </a>
              )}
            </div>
          </ScrollReveal>

          {/* Oversized pull-quotes, single column, generous spacing */}
          <div className="mt-10 space-y-px border border-navy/20 bg-navy/20">
            {featuredReviews.map((t) => (
              <figure key={t.author} className="bg-cream p-6 sm:p-8">
                <span className="text-lg leading-none text-navy" aria-label="Five star rating">
                  {'★★★★★'}
                </span>
                {/* Review bodies read in the body face at paragraph length —
                    Amboqia is reserved for the heading + reviewer names
                    (design-audit P2, display-vs-body rule). */}
                <blockquote className="mt-3 max-w-3xl text-lg leading-relaxed text-navy/75">
                  {'"'}{t.quote}{'"'}
                </blockquote>
                <figcaption className="mt-4 font-display text-base uppercase leading-none tracking-[-0.01em] text-navy">
                  {t.author}
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-10 border-t-[3px] border-navy pt-8">
            <a
              href={GOOGLE_REVIEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-navy underline-offset-4 hover:underline"
            >
              <GoogleMark className="h-4 w-4 opacity-60" />
              Read all {aggregate.count} reviews on Google
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 6: CONSULTATION FORM
          The full-bleed navy moment. id="consult".
          The conversion goal. SellerLPForm island + props preserved exactly. */}
      <section id="consult" className="bg-navy py-16 text-cream sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cream/55">
            One conversation
          </p>
          <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] sm:text-4xl">
            Book a listing conversation.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-cream/80">
            Enter the address and a few details. A broker reaches out to walk pricing and a plan. No listing agreement attached to the call.
          </p>
          <div className="mt-8">
            <SellerLPForm knownVisitor={knownVisitor} variant="list-now" />
          </div>
          <p className="mt-6 text-sm text-cream/75">
            Or call us directly.{' '}
            <a
              href={`tel:${BROKER_PHONE_TEL}`}
              className="font-semibold tabular-nums text-cream underline underline-offset-2 hover:no-underline"
            >
              {BROKER_PHONE}
            </a>
          </p>
        </div>
      </section>

      {/* Sticky mobile CTA bar — pinned to viewport bottom on mobile only. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t-[3px] border-navy bg-cream px-3 py-3 sm:hidden">
        <div className="flex items-center gap-2">
          <a
            href="#consult"
            className="flex-1 border-[3px] border-navy bg-navy px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.1em] text-cream"
          >
            Book a free consultation
          </a>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            aria-label={`Call Ryan Realty at ${BROKER_PHONE}`}
            className="flex h-12 w-12 items-center justify-center border-[3px] border-navy text-navy"
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </main>

    {/* THE ONE SITE FOOTER (Matt 2026-08-27). Outside <main> on purpose:
        HTML-AAM maps <footer> to role=contentinfo ONLY when it is not nested in
        sectioning content. Dropped in place of this page's hand-rolled footer it
        landed INSIDE <main>, so the page rendered zero contentinfo landmarks
        while every other public page had one. Held by ci:chrome-single-source. */}
    <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

// Presentational helpers

function WhyPoint({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-b-[3px] border-navy py-8 sm:grid sm:grid-cols-[2fr_3fr] sm:items-start sm:gap-12">
      <p className="font-display text-lg uppercase leading-snug tracking-[-0.01em] text-navy sm:text-xl">
        {title}
      </p>
      <p className="mt-2 text-base leading-relaxed text-navy/70 sm:mt-0">
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
