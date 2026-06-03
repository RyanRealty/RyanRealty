// @no-parity — new BOFU seller landing page, no Wave 3 mockup contract
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import LandingPageTracker from '@/components/LandingPageTracker'
import SellerLPForm from '@/app/lp/seller-home-value/SellerLPForm'
import SellerSocialProof from '@/components/seller-lp/SellerSocialProof'
import MarketVisuals from '@/components/seller-lp/MarketVisuals'
import type { StatCard } from '@/components/seller-lp/MarketVisuals.client'
import {
  getBendMarketSnapshot,
  getBendPriceTrend,
  getOurListings,
  getSoldStories,
  getTestimonialAggregate,
} from '@/app/lp/seller-home-value/data'

export const metadata: Metadata = {
  title: 'Sell Your Bend Home | Ryan Realty',
  description:
    'Full-service local brokerage for Bend, OR home sellers. Pricing from real local sales, professional marketing, and a broker in your corner through closing.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Sell Your Bend Home | Ryan Realty',
    description:
      'Full-service local brokerage for Bend, OR home sellers. Pricing from real local sales, professional marketing, and a broker in your corner through closing.',
    type: 'website',
  },
}

// Ryan Realty brand line — paid-traffic / cold-contact surfaces.
// Dotted format per brand voice spec (CLAUDE.md §3): 541.703.3095
const BROKER_PHONE = '541.703.3095'
const BROKER_PHONE_TEL = '+15417033095'

export default async function SellYourHomePage() {
  // Detect prior identification via the fub_cid cookie. Server-side check
  // so the visible UX adjusts before first paint.
  const cookiePersonId = await getFubPersonIdFromCookie()
  const knownVisitor = cookiePersonId != null && cookiePersonId > 0

  // Live local data — same sources as the seller-home-value LP.
  const [marketSnapshot, priceTrend, soldStories, aggregate, allListings] = await Promise.all([
    getBendMarketSnapshot(),
    getBendPriceTrend(),
    getSoldStories(),
    getTestimonialAggregate(),
    getOurListings(),
  ])

  // Live Bend market stat cards. Only render a card when the underlying value
  // is present. CLAUDE.md §0 Data Accuracy.
  const snap = marketSnapshot
  let marketCards: StatCard[] = []
  if (snap) {
    const raw: Array<StatCard | null> = [
      snap.medianSold90d != null
        ? { countTo: snap.medianSold90d, format: 'money', label: 'Median sale price', sub: 'Closed in the last 90 days' }
        : null,
      snap.medianDaysToPending != null
        ? { countTo: snap.medianDaysToPending, format: 'days', label: 'Time to pending', sub: 'Median, list to under contract' }
        : null,
      snap.saleToListPct != null
        ? { countTo: snap.saleToListPct, format: 'pct', label: 'Sale to list', sub: 'Median final price vs asking' }
        : null,
      snap.soldCount30d != null
        ? { countTo: snap.soldCount30d, format: 'int', label: 'Homes sold', sub: 'Closed in the last 30 days' }
        : null,
    ]
    marketCards = raw.filter((c): c is StatCard => c !== null)
  }

  const updatedLabel = snap?.updatedAt
    ? new Date(snap.updatedAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Los_Angeles',
      })
    : ''
  const hasMarketVisuals = priceTrend.points.length >= 2 || marketCards.length > 0

  // Proof strip: 3 recently sold Bend listings. Same verified closed sales
  // as the seller-home-value LP. Live from the DAL. CLAUDE.md §0.
  const PROOF_STRIP_ADDRESSES = [
    '2354 NW Drouillard Ave',      // NorthWest Crossing
    '1974 NE Newport Hills Dr',    // Forest Hills
    '64350 Old Bend Redmond Hwy',  // Tumalo
  ]
  const proofStripListings = PROOF_STRIP_ADDRESSES.map((addr) =>
    allListings.find((l) => l.addressLine === addr && l.badge === 'Sold')
  )

  // Market section derived values (computed from live snapshot).
  const mos = marketSnapshot?.monthsOfSupply ?? null
  const mosVerdict =
    mos == null
      ? null
      : mos <= 4
      ? "Seller's market"
      : mos < 6
      ? 'Balanced market'
      : "Buyer's market"
  const yoyDirection =
    priceTrend.yoyPct == null ? null : priceTrend.yoyPct >= 0 ? 'up' : 'down'
  const yoyAbs =
    priceTrend.yoyPct == null ? null : Math.abs(priceTrend.yoyPct).toFixed(1)

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
    review: soldStories
      .filter((s): s is typeof s & { testimonial: NonNullable<typeof s.testimonial> } =>
        s.testimonial !== null
      )
      .map((s) => ({
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
        author: { '@type': 'Person', name: s.testimonial.author },
        reviewBody: s.testimonial.quote,
        itemReviewed: {
          '@type': 'RealEstateListing',
          name: s.listing.addressLine,
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Bend',
            addressRegion: 'OR',
            addressCountry: 'US',
          },
        },
      })),
  }

  return (
    <div className="bg-background text-foreground">
      <LandingPageTracker lpVariant="sell-your-home" />
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }}
      />

      {/* Sticky minimal header */}
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center"
            aria-label="Ryan Realty · Bend, Oregon"
          >
            <span className="relative block h-7 w-[140px] shrink-0 sm:h-9 sm:w-[180px]">
              <Image
                src="/images/brand/logo-horizontal-blue.png"
                alt="Ryan Realty · Bend, Oregon"
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

      {/* Hero */}
      <section className="relative isolate border-b border-primary/10">
        <Image
          src="/images/lp/hero-banner.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="lp-kenburns absolute inset-0 -z-20 object-cover object-center"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/60 via-primary/55 to-primary/65"
          aria-hidden="true"
        />

        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-10 text-center sm:px-6 sm:py-14 lg:py-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-card/85 drop-shadow-sm">
            Bend · Oregon homeowners
          </p>

          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-card drop-shadow-sm sm:text-5xl lg:text-6xl">
            Ready to sell your Bend home?
          </h1>

          <p className="mt-4 text-lg leading-relaxed text-card drop-shadow-sm">
            A full-service local brokerage that prices it right, markets it hard, and negotiates for you. Start with a no-pressure conversation.
          </p>

          <div className="mt-7 w-full" id="start-sale">
            <SellerLPForm knownVisitor={knownVisitor} heroVariant variant="list-now" />
          </div>

          <p className="mt-3 text-sm text-card/70 drop-shadow-sm">
            No pressure, no obligation. Just a real plan from a local broker.
          </p>
        </div>
      </section>

      {/* What you get when you list with us */}
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
          <h2 className="font-display text-center text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            What you get when you list with us
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <ValueProp
              num="1"
              title="Pricing from real local sales"
              body="We price from recent comparable Bend sales, not a national model. You get a real comparative market analysis before we agree on anything."
            />
            <ValueProp
              num="2"
              title="Marketing that gets seen"
              body="Professional photography, video, and your listing pushed across the channels buyers actually use. Not just an MLS entry."
            />
            <ValueProp
              num="3"
              title="A broker in your corner"
              body="You work directly with the broker who lists your home, through negotiation to closing. Not a team, not a call center."
            />
          </div>
        </div>
      </section>

      {/* Work with Bend's trusted team */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 sm:py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            {"Work with Bend’s trusted team"}
          </h2>
          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-8">
            <Broker src="/images/brokers/ryan-matt.png" name="Matt Ryan" role="Principal Broker" />
            <Broker src="/images/brokers/stevenson-paul.png" name="Paul Stevenson" role="Broker" />
            <Broker src="/images/brokers/peterson-rebecca.png" name="Rebecca Peterson" role="Broker" />
          </div>
          <div className="mt-8 flex justify-center border-t border-primary/10 pt-8">
            <SellerSocialProof tone="light" align="center" size="lg" />
          </div>
        </div>
      </section>

      {/* Proof strip — recently sold in Bend
          3 real verified closed sales. Live from getOurListings DAL.
          Full currency per brand voice (rounded to nearest thousand).
          CLAUDE.md §0 Data Accuracy. */}
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Recently sold in Bend
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            Recent closed sales from our clients. Verified against MLS records.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {proofStripListings.map((listing) => {
              if (listing == null) return null
              const price =
                listing.closePrice != null
                  ? `$${(Math.round(listing.closePrice / 1000) * 1000).toLocaleString('en-US')}`
                  : listing.displayPrice
              return (
                <div key={listing.key} className="overflow-hidden rounded-2xl border border-primary/10 bg-card">
                  {listing.photoUrl ? (
                    <div className="relative h-44 w-full">
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
                    <p className="font-semibold text-primary">{listing.addressLine}</p>
                    {listing.neighborhood ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{listing.neighborhood}</p>
                    ) : null}
                    <p className="mt-3 font-display text-xl font-semibold tabular-nums text-foreground">
                      Sold {price}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Where Bend stands — live market chart + stat cards
          Framed toward listing-intent: timing matters, here is the data.
          Every value from Supabase via data.ts. CLAUDE.md §0. */}
      {hasMarketVisuals && (
        <section className="border-b border-primary/10 bg-primary text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Where Bend stands today
            </h2>
            <p className="mt-3 text-lg text-primary-foreground/85">
              Bend homes are still moving. Here is where the market stands.
            </p>
            {yoyDirection !== null && yoyAbs !== null ? (
              <p className="mt-3 text-lg font-medium text-primary-foreground/90">
                {"Bend's median sale price is "}
                {yoyDirection === 'up' ? 'up' : 'down'}{' '}
                {yoyAbs}% over the past year.
              </p>
            ) : null}
            {mosVerdict !== null && mos !== null ? (
              <div className="mt-3">
                <span className="inline-flex items-center rounded-full bg-card/10 px-4 py-1.5 text-sm font-semibold text-primary-foreground ring-1 ring-primary-foreground/20">
                  {mosVerdict} · {mos.toFixed(1)} months of supply
                </span>
              </div>
            ) : null}
            <p className="mt-4 max-w-2xl text-lg text-primary-foreground/85">
              Pricing right in the first week consistently outperforms sellers who test the top of the range and reduce later. Here is what Bend single-family homes are actually doing right now.
            </p>
            <div className="mt-6">
              <MarketVisuals
                points={priceTrend.points}
                latest={priceTrend.latest}
                yoyPct={priceTrend.yoyPct}
                updatedLabel={updatedLabel}
                cards={marketCards}
              />
            </div>
          </div>
        </section>
      )}

      {/* FAQ — listing-specific questions, single column, max-w-3xl */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            What you are probably wondering
          </h2>
          <p className="mt-3 text-base leading-relaxed text-foreground/75">
            Have a question before you reach out? Talk to a broker directly.{' '}
            <a
              href={`tel:${BROKER_PHONE_TEL}`}
              className="inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline"
            >
              <PhoneIcon className="h-4 w-4" />
              {BROKER_PHONE}
            </a>
          </p>
          <Accordion type="single" collapsible className="mt-6 gap-4">
            <FAQ
              value="faq-cost"
              q="What does it cost to list with you?"
              a="Our fee depends on the home and the marketing plan. We walk through it on a quick call, with no obligation. There is no standard quote we can give without knowing your property and your goals."
            />
            <FAQ
              value="faq-time"
              q="How long does it take to sell?"
              a="It depends on price, condition, and the market at the time. Homes priced well relative to recent comparable sales tend to move quickly. We give you a realistic timeline based on your specific property after reviewing the comps together."
            />
            <FAQ
              value="faq-marketing"
              q="What do you do to market my home?"
              a="Professional photography and video, full MLS listing with syndication across the major platforms, and targeted local promotion to buyers already searching in your area. The marketing plan is built around your home specifically."
            />
            <FAQ
              value="faq-after"
              q="What happens after I reach out?"
              a="A broker reviews your home and recent comparable sales, then calls you to talk through pricing and a plan. You talk to the broker who would actually list your home, not a scheduler or a call center."
            />
          </Accordion>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to start your home sale?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-primary-foreground/85">
            Enter your address and a local broker will reach out to talk through pricing and a plan.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="#start-sale"
              scroll
              className="inline-flex h-14 items-center justify-center rounded-xl bg-warning px-7 text-lg font-semibold text-warning-foreground transition-colors hover:bg-warning/90"
            >
              Start my home sale
            </Link>
            <a
              href={`tel:${BROKER_PHONE_TEL}`}
              className="inline-flex h-14 items-center justify-center rounded-xl border-2 border-primary-foreground/30 px-7 text-lg font-semibold text-primary-foreground transition-colors hover:border-primary-foreground"
            >
              Call Matt: {BROKER_PHONE}
            </a>
          </div>
        </div>
      </section>

      {/* Fine print */}
      <footer className="bg-card pb-20 sm:pb-8">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
          <p>Ryan Realty LLC · Equal Housing Opportunity</p>
          <p className="mt-2">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy
            </Link>
            <span className="mx-2">·</span>© {new Date().getFullYear()} Ryan Realty LLC
          </p>
        </div>
      </footer>

      {/* Sticky mobile CTA bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/15 bg-card/95 px-3 py-3 shadow-[0_-4px_12px_-2px_rgba(16,39,66,0.12)] backdrop-blur sm:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="#start-sale"
            scroll
            className="flex-1 rounded-xl bg-warning px-4 py-3 text-center text-sm font-semibold text-warning-foreground"
          >
            Start my home sale
          </Link>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            aria-label={`Call Matt at ${BROKER_PHONE}`}
            className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-primary text-primary"
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </div>
  )
}

// Presentational helpers

function Broker({ src, name, role }: { src: string; name: string; role: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="relative h-24 w-24 overflow-hidden rounded-full bg-primary/5 sm:h-32 sm:w-32">
        <Image src={src} alt={name} fill sizes="(max-width: 640px) 96px, 128px" className="object-cover object-top" />
      </span>
      <p className="mt-3 font-display text-base font-semibold text-primary sm:text-lg">{name}</p>
      <p className="text-xs text-muted-foreground sm:text-sm">{role}</p>
    </div>
  )
}

function ValueProp({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-primary/10 bg-card p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-base font-semibold text-primary-foreground">
        {num}
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-primary">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
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
      className="rounded-xl border border-primary/10 bg-card px-5 not-last:border-b data-[state=open]:border-primary/30"
    >
      <AccordionTrigger className="py-4 font-display text-lg font-semibold text-primary hover:no-underline">
        {q}
      </AccordionTrigger>
      <AccordionContent className="pb-4 text-base leading-relaxed text-foreground/85">
        {a}
      </AccordionContent>
    </AccordionItem>
  )
}
