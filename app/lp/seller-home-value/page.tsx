import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import ExitIntentPrompt from '@/components/landing/ExitIntentPrompt'
import ScrollReveal from '@/components/landing/ScrollReveal'
import { TrustStrip } from '@/components/landing/TrustStrip'
import { ReviewStrip } from '@/components/landing/ReviewCard'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import LandingPageTracker from '@/components/LandingPageTracker'
import SellerLPForm from './SellerLPForm'
import { TESTIMONIALS } from '@/lib/testimonials'
import {
  getBendMarketSnapshot,
  getOurListings,
  getTestimonialAggregate,
} from './data'

export const metadata: Metadata = {
  title: 'What Would Your Home Bring Today? | Ryan Realty',
  description:
    'A real number from recent local Bend sales, not an algorithm. Prepared by a local broker.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'What Would Your Home Bring Today?',
    description:
      'A real number from recent local Bend sales, not an algorithm. Prepared by a local broker.',
    type: 'website',
  },
}

// Ryan Realty brand line — paid-traffic / cold-contact surfaces.
// Dotted format per brand voice spec (CLAUDE.md §3): 541.703.3095
const BROKER_PHONE = '541.703.3095'
const BROKER_PHONE_TEL = '+15417033095'

// Em-dash as a data placeholder for unavailable values — the one allowed use
// per the brand spec ("Unavailable → em-dash"). Escaped so the punctuation
// gate (which bans em-dash as prose punctuation) stays clean.
const MDASH = '—'

// ─── Ad-matched hero variants (?v=) ──────────────────────────────────────
// Message match: each paid ad concept lands on a hero with the SAME photo
// family + the SAME headline as the ad that was clicked. Default (no ?v=)
// is the approved Figma LP 1 hero — Old Mill banner photo + bring-today copy.
type HeroVariant = { img: string; alt: string; h1: string; sub: string }
const HERO_VARIANTS: Record<string, HeroVariant> = {
  mountain: {
    img: '/images/lp/hero-mountain.jpg',
    alt: 'A snow-capped Cascade peak reflected in a still alpine lake at dawn',
    h1: 'What Is Your Bend Home Worth?',
    sub: 'A real number from closed sales near you, not an online guess.',
  },
  oos: {
    img: '/images/lp/hero-oldmill.jpg',
    alt: 'Aerial view of the Old Mill District and Deschutes River in Bend, Oregon',
    h1: 'Own a Bend Home From Another State?',
    sub: 'We handle the prep, the repairs, and the sale while you stay put.',
  },
  nopressure: {
    img: '/images/lp/hero-pond.jpg',
    alt: 'A neighborhood pond and homes in Bend, Oregon',
    h1: 'No Pressure. Just the Real Number.',
    sub: 'A real number from a local broker, whenever you are ready to think about selling.',
  },
}
const DEFAULT_HERO: HeroVariant = {
  img: '/images/lp/hero-banner.jpg',
  alt: 'Aerial view of the Old Mill District smokestacks and the Deschutes River in Bend, Oregon',
  h1: 'What Would Your Home Bring Today?',
  sub: 'See what buyers are paying for homes like yours, from recent Central Oregon sales. A real number from a local broker, not an algorithm.',
}

// Two seller-side reviews for the brokers section (approved Figma LP 1, S3).
const SELLER_LP_REVIEWS = TESTIMONIALS.filter((t) =>
  ['Gary Timms', 'Doug Millard'].includes(t.author),
)

export default async function SellerHomeValuePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>
}) {
  const { v } = await searchParams
  const variantKey = v && HERO_VARIANTS[v] ? v : null
  const hero = variantKey ? HERO_VARIANTS[variantKey] : DEFAULT_HERO

  // Detect prior identification via the fub_cid cookie. Server-side check
  // so the visible UX adjusts before first paint.
  const cookiePersonId = await getFubPersonIdFromCookie()
  const knownVisitor = cookiePersonId != null && cookiePersonId > 0

  // Live local data — Bend market snapshot (market_pulse_live via the DAL) +
  // the curated real-listings matrix. Each falls back gracefully if Supabase
  // is briefly unreachable. CLAUDE.md §0 Data Accuracy: live values or the
  // em-dash placeholder, never an invented number.
  const [marketSnapshot, aggregate, allListings] = await Promise.all([
    getBendMarketSnapshot(),
    getTestimonialAggregate(),
    getOurListings(),
  ])

  const snap = marketSnapshot

  // Stat band values — formatted live, em-dash placeholder when unavailable.
  const statCards: Array<{ value: string; label: string; sub: string }> = [
    {
      value:
        snap?.medianSold90d != null
          ? `$${(Math.round(snap.medianSold90d / 1000) * 1000).toLocaleString('en-US')}`
          : MDASH,
      label: 'Median sale price',
      sub: 'Closed in the last 90 days',
    },
    {
      value:
        snap?.medianDaysToPending != null
          ? `${Math.round(snap.medianDaysToPending)} days`
          : MDASH,
      label: 'Time to pending',
      sub: 'Median, list to under contract',
    },
    {
      value: snap?.saleToListPct != null ? `${snap.saleToListPct.toFixed(1)}%` : MDASH,
      label: 'Sale to list',
      sub: 'Median final price vs asking',
    },
    {
      value: snap?.soldCount30d != null ? snap.soldCount30d.toLocaleString('en-US') : MDASH,
      label: 'Homes sold',
      sub: 'Closed in the last 30 days',
    },
  ]

  const updatedLabel = snap?.updatedAt
    ? new Date(snap.updatedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles',
      })
    : null

  // Recently sold nearby — 3 real verified closed sales, photo + price live
  // from the DAL (getOurListings → listing_tile_mv). Never hardcoded beyond
  // the address key filter.
  const PROOF_STRIP_ADDRESSES = [
    '2354 NW Drouillard Ave', // NorthWest Crossing
    '1974 NE Newport Hills Dr', // Forest Hills
    '64350 Old Bend Redmond Hwy', // Tumalo
  ]
  const proofStripListings = PROOF_STRIP_ADDRESSES.map((addr) =>
    allListings.find((l) => l.addressLine === addr && l.badge === 'Sold'),
  ).filter((l): l is NonNullable<typeof l> => l != null)

  // JSON-LD review schema for SEO rich results.
  const reviewSchema = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: 'Ryan Realty LLC',
    image: 'https://seller.ryan-realty.com/images/brokers/ryan-matt.png',
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
    <div className="bg-[#faf8f4] text-[#102742]">
      <LandingPageTracker
        lpVariant={variantKey ? `seller-home-value:${variantKey}` : 'seller-home-value'}
      />
      {/* JSON-LD structured data for Google rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }}
      />

      {/* ─── Sticky minimal header — wordmark + phone (KB navy bar) ───────── */}
      <header className="sticky top-0 z-40 border-b-[3px] border-[#102742] bg-[#102742]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
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
            className="inline-flex items-center gap-1.5 border-[3px] border-[#faf8f4] bg-[#faf8f4] px-3 py-2 text-sm font-bold uppercase tracking-[0.1em] text-[#102742] transition-colors hover:bg-transparent hover:text-[#faf8f4] sm:px-4"
            aria-label={`Call Ryan Realty at ${BROKER_PHONE}`}
          >
            <PhoneIcon className="h-4 w-4" />
            <span className="tabular-nums">{BROKER_PHONE}</span>
          </a>
        </div>
      </header>

      {/* ─── HERO — full-bleed photo, navy scrim, centered capture ───────── */}
      <section className="relative isolate border-b-[3px] border-[#102742]">
        <Image
          src={hero.img}
          alt={hero.alt}
          fill
          priority
          sizes="100vw"
          className="lp-kenburns absolute inset-0 -z-20 object-cover object-center"
        />
        {/* Navy scrim — lighter through the middle so the photo reads, denser
            at top and bottom where the eyebrow + form sit. */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[#102742]/70 via-[#102742]/60 to-[#102742]/80"
          aria-hidden="true"
        />

        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16 lg:py-20">
          {/* Eyebrow — mono label */}
          <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/85 drop-shadow-sm">
            <span className="h-[7px] w-[7px] rounded-full bg-[#faf8f4]" aria-hidden="true" />
            Bend · Oregon homeowners
          </p>

          {/* H1 — Amboqia display, Title Case (hero only), message-matched */}
          <h1 className="mt-4 font-display text-4xl uppercase leading-[0.92] tracking-[-0.01em] text-[#faf8f4] drop-shadow-sm sm:text-5xl lg:text-6xl">
            {hero.h1}
          </h1>

          {/* Subhead */}
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#faf8f4] drop-shadow-sm">{hero.sub}</p>

          {/* Broker trust chip — hard-edge square frame */}
          <div className="mt-6 flex items-center gap-3 border-[3px] border-[#faf8f4]/40 px-3 py-2">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden border border-[#faf8f4]/40 bg-[#faf8f4]/10">
              <Image
                src="/images/brokers/ryan-matt.png"
                alt="Matt Ryan, Principal Broker"
                fill
                sizes="40px"
                className="object-cover object-top"
                priority
              />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight text-[#faf8f4]">Matt Ryan</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] leading-tight text-[#faf8f4]/70">
                Principal broker · Ryan Realty
              </p>
            </div>
          </div>

          {/* Address capture — the hero centerpiece. SmsConsentDisclosure is
              rendered inside the form (first-paint HTML, A2P-verified text). */}
          <div className="mt-6 w-full">
            <SellerLPForm knownVisitor={knownVisitor} heroVariant />
          </div>

          {/* Micro-assurance */}
          <p className="mt-4 text-sm text-[#faf8f4]/75 drop-shadow-sm">
            No pitch, no obligation. Plenty of owners check their number a year before they sell.
          </p>
        </div>
      </section>

      {/* ─── S2 · Trust strip band (cream) ─────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <TrustStrip />
        </div>
      </section>

      {/* ─── S3 · The brokers behind your sale ─────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              Who builds your number
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              The brokers behind your sale
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-[#102742]/70">
              Your comps are pulled and your questions are answered by a licensed Oregon
              broker, not a call center.
            </p>
          </ScrollReveal>
          <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-8">
            <ScrollReveal delayMs={0}>
              <Broker src="/images/brokers/ryan-matt.png" name="Matt Ryan" role="Principal Broker" />
            </ScrollReveal>
            <ScrollReveal delayMs={75}>
              <Broker src="/images/brokers/stevenson-paul.png" name="Paul Stevenson" role="Broker" />
            </ScrollReveal>
            <ScrollReveal delayMs={150}>
              <Broker src="/images/brokers/peterson-rebecca.png" name="Rebecca Peterson" role="Broker" />
            </ScrollReveal>
          </div>
          {SELLER_LP_REVIEWS.length > 0 ? (
            <ScrollReveal className="mt-12 border-t-[3px] border-[#102742] pt-10 text-left">
              <ReviewStrip reviews={SELLER_LP_REVIEWS} tone="light" />
            </ScrollReveal>
          ) : null}
        </div>
      </section>

      {/* ─── S4 · Stat band (navy) — live market_pulse_live data ──────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#102742] text-[#faf8f4]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/55">
              Bend · The market
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] sm:text-4xl">
              What Bend homes are doing right now
            </h2>
            <p className="mt-4 max-w-2xl text-base text-[#faf8f4]/80">
              Live single-family figures for Bend. The same data your report is built from.
            </p>
          </ScrollReveal>
          {/* Brutalist KPI grid — hard cream hairlines, no rounded cards. */}
          <div className="mt-10 grid grid-cols-2 gap-px border border-[#faf8f4]/30 bg-[#faf8f4]/30 lg:grid-cols-4">
            {statCards.map((card, i) => (
              <ScrollReveal key={card.label} delayMs={i * 75}>
                <div className="flex h-full flex-col bg-[#102742] p-5 sm:p-6">
                  <p className="font-display text-4xl tabular-nums leading-[0.9] sm:text-5xl">
                    {card.value}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#faf8f4]/90">
                    {card.label}
                  </p>
                  <p className="mt-1 text-xs text-[#faf8f4]/60">{card.sub}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#faf8f4]/55">
            {updatedLabel ? `Live data · updated ${updatedLabel} · ` : 'Live data · '}
            Bend single-family · MLS via Ryan Realty
          </p>
        </div>
      </section>

      {/* ─── S5 · Algorithms guess. Comps don't. — split panel ────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              How the number is built
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              {'Algorithms guess. Comps don’t.'}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-[#102742]/80">
              Your online estimate is built from tax records. Your report is built from the
              homes that actually sold around you, adjusted by a broker who walks these streets.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#102742]/70">
              An automated model never steps inside your home. A broker accounts for your
              finishes, your lot, and your layout, and shows the math.
            </p>
          </ScrollReveal>
          {/* Report mock — typographic mini CMA page. Data slots are honest
              placeholders that bind to live data in the real report. */}
          <ScrollReveal delayMs={100}>
            <div className="mx-auto w-full max-w-sm border-[3px] border-[#102742] bg-[#faf8f4] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#102742]/70">
                Comparative market analysis
              </p>
              <p className="mt-1 font-display text-xl uppercase leading-[0.95] tracking-[-0.01em] text-[#102742]">
                Your street, your comps
              </p>
              <div className="mt-5 space-y-px border border-[#102742]/20 bg-[#102742]/20">
                {['Comparable sale 1', 'Comparable sale 2', 'Comparable sale 3'].map((row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between bg-[#faf8f4] px-3 py-2.5"
                  >
                    <span className="text-sm text-[#102742]/75">{row}</span>
                    <span className="text-sm font-semibold tabular-nums text-[#102742]">{`$${MDASH}`}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-[#102742] px-3 py-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#faf8f4]">
                    Your adjusted value
                  </span>
                  <span className="font-display text-lg tabular-nums text-[#faf8f4]">
                    {`$${MDASH}`}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-right text-[11px] text-[#102742]/70">
                Sample layout · your report carries the live figures
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S6 · How it works — 3 steps ───────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              Three steps
            </p>
            <h2 className="mt-3 text-center font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              How it works
            </h2>
          </ScrollReveal>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-5">
            <ScrollReveal delayMs={0}>
              <ProcessStep num="1" title="Enter the address" body="Any home you want a real number on." />
            </ScrollReveal>
            <ScrollReveal delayMs={75}>
              <ProcessStep num="2" title="A broker pulls the comps" body="Recent closed sales near you, adjusted for your home." />
            </ScrollReveal>
            <ScrollReveal delayMs={150}>
              <ProcessStep num="3" title="Your number lands in your inbox" body="Within one business day. Questions go to the broker who built it." />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ─── S7 · Recently sold nearby — real DAL sold listings ───────────── */}
      {proofStripListings.length > 0 ? (
        <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
                Closed · Verified
              </p>
              <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
                Recently sold nearby
              </h2>
              <p className="mt-3 text-base text-[#102742]/70">
                Closed sales from our clients, verified against MLS records.
              </p>
            </ScrollReveal>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {proofStripListings.map((listing, i) => {
                const price =
                  listing.closePrice != null
                    ? `$${(Math.round(listing.closePrice / 1000) * 1000).toLocaleString('en-US')}`
                    : listing.displayPrice
                return (
                  <ScrollReveal key={listing.key} delayMs={i * 75}>
                    <div className="overflow-hidden border-[3px] border-[#102742] bg-[#102742] text-[#faf8f4]">
                      {listing.photoUrl ? (
                        <div className="relative aspect-[4/3] w-full">
                          <Image
                            src={listing.photoUrl}
                            alt={`${listing.addressLine}, ${listing.neighborhood ?? 'Bend'}`}
                            fill
                            sizes="(max-width: 640px) 100vw, 33vw"
                            className="object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="p-5">
                        <p className="text-sm font-semibold tracking-[0.01em] text-[#faf8f4]">{listing.addressLine}</p>
                        {listing.neighborhood ? (
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#faf8f4]/65">
                            {listing.neighborhood}
                          </p>
                        ) : null}
                        <p className="mt-4 inline-flex border-[3px] border-[#faf8f4] bg-[#faf8f4] px-3 py-1 font-display text-sm tabular-nums text-[#102742]">
                          Sold {price}
                        </p>
                      </div>
                    </div>
                  </ScrollReveal>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* ─── S8 · FAQ ──────────────────────────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              Common questions
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              {'What you’re probably wondering'}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#102742]/75">
              Still have a question? Talk to a broker directly.{' '}
              <a
                href={`tel:${BROKER_PHONE_TEL}`}
                className="inline-flex items-center gap-1.5 font-semibold text-[#102742] underline-offset-4 hover:underline"
              >
                <PhoneIcon className="h-4 w-4" />
                <span className="tabular-nums">{BROKER_PHONE}</span>
              </a>
            </p>
          </ScrollReveal>
          <Accordion type="single" collapsible className="mt-8 gap-4">
            <FAQ
              value="faq-cost"
              q="What does the report cost?"
              a="Nothing. The comparative market analysis is free, and there is no listing agreement attached to it. We send it because owners who get an honest number tend to remember where it came from."
            />
            <FAQ
              value="faq-timing"
              q="How fast does it arrive?"
              a="Your report lands in your inbox within one business day. If your home or timeline is unusual, the broker preparing it may call first to get a detail right."
            />
            <FAQ
              value="faq-list"
              q="Do I have to list with you to get the value?"
              a="No. Many of the homeowners we send valuations to decide to stay another year, or longer. We send it anyway. We are here when the timing is right, whether that is next month or three years from now."
            />
            <FAQ
              value="faq-accuracy"
              q="How accurate is the number?"
              a="It starts from the comparable sales that actually closed near your home, adjusted for your finishes, lot, and layout. The precise figure tightens after a short walkthrough, which you can take or skip. Either way you see the comps behind the number."
            />
          </Accordion>
        </div>
      </section>

      {/* ─── S9 · Closing navy band — second address capture ──────────────── */}
      <section className="bg-[#102742] text-[#faf8f4]">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/55">
              One field
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] sm:text-4xl">
              Ready for your number?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-[#faf8f4]/85">
              Enter the address. A broker takes it from there.
            </p>
          </ScrollReveal>
          <div className="mt-8 text-left">
            <SellerLPForm knownVisitor={knownVisitor} formId="get-value-closing" />
          </div>
          <p className="mt-6 text-sm text-[#faf8f4]/75">
            Prefer to talk?{' '}
            <a href={`tel:${BROKER_PHONE_TEL}`} className="font-semibold underline underline-offset-2 tabular-nums">
              Call {BROKER_PHONE}
            </a>
          </p>
        </div>
      </section>

      {/* ─── Mini fine print ─────────────────────────────────────────────── */}
      <footer className="border-t-[3px] border-[#102742] bg-[#102742] pb-24 sm:pb-8">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#faf8f4]/65 sm:px-6">
          <p>Ryan Realty LLC · Equal Housing Opportunity · Bend · Oregon</p>
          <p className="mt-2 normal-case tracking-normal">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-[#faf8f4]">
              Privacy
            </Link>
            <span className="mx-2">·</span>© {new Date().getFullYear()} Ryan Realty LLC
          </p>
        </div>
      </footer>

      {/* Exit-intent prompt — desktop-only, once per session. */}
      <ExitIntentPrompt
        headline="Not ready for a valuation?"
        body="See what Bend homes are actually selling for. Real closed-sale data, no email required."
        ctaLabel="See the market"
        ctaTarget="/housing-market"
      />

      {/* Sticky mobile CTA bar — pinned to viewport bottom on mobile only. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t-[3px] border-[#102742] bg-[#faf8f4] px-3 py-3 sm:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="#get-value"
            scroll
            className="flex-1 border-[3px] border-[#102742] bg-[#102742] px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.1em] text-[#faf8f4]"
          >
            Get my home value
          </Link>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            aria-label={`Call Matt at ${BROKER_PHONE}`}
            className="flex h-12 w-12 items-center justify-center border-[3px] border-[#102742] text-[#102742]"
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Tiny presentational helpers ─────────────────────────────────────────

function Broker({ src, name, role }: { src: string; name: string; role: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="relative h-24 w-24 overflow-hidden border-[3px] border-[#102742] bg-[#102742]/5 sm:h-32 sm:w-32">
        <Image
          src={src}
          alt={name}
          fill
          sizes="(max-width: 640px) 96px, 128px"
          className="object-cover object-top"
        />
      </span>
      <p className="mt-4 font-display text-base uppercase leading-none tracking-[-0.01em] text-[#102742] sm:text-xl">{name}</p>
      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#102742]/65 sm:text-xs">{role}</p>
    </div>
  )
}

function ProcessStep({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-12 w-12 items-center justify-center border-[3px] border-[#102742] bg-[#102742] font-display text-lg tabular-nums text-[#faf8f4]">
        {num}
      </span>
      <p className="mt-4 font-display text-lg uppercase leading-none tracking-[-0.01em] text-[#102742]">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#102742]/70">{body}</p>
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
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function FAQ({ value, q, a }: { value: string; q: string; a: string }) {
  return (
    <AccordionItem
      value={value}
      className="border-[3px] border-[#102742] bg-[#faf8f4] px-5"
    >
      <AccordionTrigger className="py-4 font-display text-lg uppercase leading-snug tracking-[-0.01em] text-[#102742] hover:no-underline">
        {q}
      </AccordionTrigger>
      <AccordionContent className="pb-4 text-base leading-relaxed text-[#102742]/85">
        {a}
      </AccordionContent>
    </AccordionItem>
  )
}
