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
import SellerLPForm from './SellerLPForm'
import SellerSocialProof from '@/components/seller-lp/SellerSocialProof'
import MarketVisuals from '@/components/seller-lp/MarketVisuals'
import type { StatCard } from '@/components/seller-lp/MarketVisuals.client'
import {
  getBendMarketSnapshot,
  getBendPriceTrend,
  getOurListings,
  getSoldStories,
  getTestimonialAggregate,
} from './data'

export const metadata: Metadata = {
  title: 'What’s Your Home Worth in Today’s Market? | Ryan Realty',
  description:
    'A real number from recent local Bend sales, not an algorithm. Prepared by a local broker.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'What’s Your Home Worth in Today’s Market?',
    description:
      'A real number from recent local Bend sales, not an algorithm. Prepared by a local broker.',
    type: 'website',
  },
}

// Ryan Realty brand line — paid-traffic / cold-contact surfaces.
// Dotted format per brand voice spec (CLAUDE.md §3): 541.703.3095
const BROKER_PHONE = '541.703.3095'
const BROKER_PHONE_TEL = '+15417033095'

// ─── Ad-matched hero variants (?v=) ──────────────────────────────────────
// Message match: each paid ad concept lands on a hero with the SAME photo
// family + the SAME headline as the ad that was clicked. Default (no ?v=)
// stays the original Old Mill banner + bring-today copy. Alt text describes
// only what is visibly in frame — no place claims beyond what is provable
// (CLAUDE.md §0).
type HeroVariant = { img: string; alt: string; h1: string; sub: string }
const HERO_VARIANTS: Record<string, HeroVariant> = {
  mountain: {
    img: '/images/lp/hero-mountain.jpg',
    alt: 'A snow-capped Cascade peak reflected in a still alpine lake at dawn',
    h1: 'What is your Bend home worth?',
    sub: 'A real number from closed sales near you, not an online guess.',
  },
  oos: {
    img: '/images/lp/hero-oldmill.jpg',
    alt: 'Aerial view of the Old Mill District and Deschutes River in Bend, Oregon',
    h1: 'Own a Bend home from another state?',
    sub: 'We handle the prep, the repairs, and the sale while you stay put.',
  },
  nopressure: {
    img: '/images/lp/hero-pond.jpg',
    alt: 'A neighborhood pond and homes in Bend, Oregon',
    h1: 'No pressure. Just the real number.',
    sub: 'Honest guidance for your Bend home, whenever you are ready to think about selling.',
  },
}
const DEFAULT_HERO: HeroVariant = {
  img: '/images/lp/hero-banner.jpg',
  alt: '',
  h1: 'What would your Bend home bring today?',
  sub: 'See what buyers are paying for homes like yours, from recent Bend sales. A real number from a local broker, not an algorithm.',
}

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

  // Live local data — Bend market snapshot + the unified "homes we represent"
  // matrix (active listings + closed sales × optional Google reviews × broker
  // headshots). Each falls back gracefully if Supabase is briefly unreachable.
  const [marketSnapshot, priceTrend, soldStories, aggregate, allListings] = await Promise.all([
    getBendMarketSnapshot(),
    getBendPriceTrend(),
    getSoldStories(),
    getTestimonialAggregate(),
    getOurListings(),
  ])

  // Live Bend market stat cards. Only render a card when the underlying value
  // is present — never a placeholder number. Each value is the live SFR pulse
  // from market_pulse_live (see data.ts). CLAUDE.md §0 Data Accuracy.
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

  // Proof strip: 3 recently sold Bend listings, badge==='Sold', photo available.
  // These are the real verified closed sales specified in the LP brief (2026-06-03).
  // We pull from allListings (same getOurListings() source) so photo + address
  // data is live from the DAL — never hardcoded beyond the address key filter.
  const PROOF_STRIP_ADDRESSES = [
    '2354 NW Drouillard Ave',  // NorthWest Crossing · $1,715,000
    '1974 NE Newport Hills Dr', // Forest Hills · $1,191,000
    '64350 Old Bend Redmond Hwy', // Tumalo · $1,030,000
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

  // JSON-LD review schema for SEO rich results. Each review is attached to
  // the property it reviewed via itemReviewed → real-estate-agent's named
  // RealEstateListing. Mirrors the pattern HomeLight uses.
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
      <LandingPageTracker lpVariant={variantKey ? `seller-home-value:${variantKey}` : 'seller-home-value'} />
      {/* JSON-LD structured data for Google rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }}
      />

      {/* ─── Sticky minimal header ───────────────────────────────────────
          Horizontal wordmark (logo-horizontal-blue.png — the 5:1 banner-
          format Ryan Realty wordmark in navy on cream). Canonical pre-
          rendered PNG; never re-typeset. Includes "BEND · OREGON" in the
          art itself so no separate subtitle is needed. */}
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

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative isolate border-b border-primary/10">
        <Image
          src={hero.img}
          alt={hero.alt}
          fill
          priority
          sizes="100vw"
          className="lp-kenburns absolute inset-0 -z-20 object-cover object-center"
        />
        {/* Two-layer navy treatment so the Bend aerial reads as a real feature.
            Base vertical gradient keeps the eyebrow (top) and trust strip
            (bottom) legible while letting the river + Cascades show through the
            middle. A centered radial spotlight concentrates contrast behind the
            headline + address field, then fades to transparent toward the left
            and right edges so the photo opens up at the sides instead of
            sitting under a flat dark box. */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/60 via-primary/55 to-primary/65"
          aria-hidden="true"
        />

        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-10 text-center sm:px-6 sm:py-14 lg:py-16">
          {/* 1 — Eyebrow */}
          <p className="text-sm font-semibold uppercase tracking-wider text-card/85 drop-shadow-sm">
            Bend · Oregon homeowners
          </p>

          {/* 2 — H1 (Amboqia) — message-matched to the ad concept (?v=) */}
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-card drop-shadow-sm sm:text-5xl lg:text-6xl">
            {hero.h1}
          </h1>

          {/* 3 — Subhead */}
          <p className="mt-4 text-lg leading-relaxed text-card drop-shadow-sm">
            {hero.sub}
          </p>

          {/* 4 — Address field + button: the hero centerpiece */}
          <div className="mt-7 w-full">
            <SellerLPForm knownVisitor={knownVisitor} heroVariant />
          </div>

          {/* 5 — Micro-assurance line under the form */}
          <p className="mt-3 text-sm text-card/70 drop-shadow-sm">
            No pitch, no obligation. Plenty of owners check their number a year before they sell.
          </p>
        </div>
      </section>

      {/* ─── What happens next — 3 steps on light/cream bg ──────────────── */}
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
          <h2 className="font-display text-center text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            What happens next
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <NextStep num="1" title="Enter the address" body="Any home you want a real estimate on." />
            <NextStep num="2" title="We'll send you the report" body="Just tell us where to send it." />
            <NextStep num="3" title="You decide what's next" body="Schedule a call, ask questions, or just keep it." />
          </div>
        </div>
      </section>

      {/* ─── The brokers behind your sale — photos + reviews together ────
          One trust block: the three brokers shown big, paired with a real
          Google review that fades through the set. Faces and words together. */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 sm:py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            The brokers behind your sale
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

      {/* ─── Anti-Zillow education ────────────────────────────────────── */}
      <section className="border-b border-primary/10">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Why your Zestimate is probably off
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-foreground/80">
            An online estimate is a guess from public records. It uses tax-record square footage, comps from a wide radius, and a national model averaged across millions of homes. It never steps inside your home.
          </p>
          <p className="mt-4 max-w-2xl text-lg text-foreground/80">
            A real analysis starts from closed sales within a few blocks of yours, then a broker adjusts for your finishes, lot, and layout. That is the number worth knowing before you decide anything.
          </p>
        </div>
      </section>

      {/* ─── Proof strip — recently sold in Bend ─────────────────────────
          3 real verified closed sales (2026-06-03 brief). Address + neighborhood
          + sold price only. Photo from allListings (live DAL). No reviews,
          no broker headshots — keep this section light and credibility-focused. */}
      <section className="border-b border-primary/10 bg-card">
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
              // Every field is live from getOurListings (MLS via the DAL) — never
              // hardcoded. Full currency, rounded to the nearest thousand (brand voice).
              const price =
                listing.closePrice != null
                  ? `$${(Math.round(listing.closePrice / 1000) * 1000).toLocaleString('en-US')}`
                  : listing.displayPrice
              return (
                <div key={listing.key} className="overflow-hidden rounded-2xl border border-primary/10 bg-background">
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

      {/* ─── Where Bend stands — live market chart + stat cards ───────────
          Real Bend single-family data. The trend is market_stats_cache
          monthly median sale price (current partial month dropped); the cards
          are the live market_pulse_live SFR snapshot. Every value traces to
          Supabase via data.ts — never invented. CLAUDE.md §0. */}
      {hasMarketVisuals && (
        <section className="border-b border-primary/10 bg-primary text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Where Bend stands today
            </h2>
            {/* Live YoY headline — computed from getBendPriceTrend(), sign-safe */}
            {yoyDirection !== null && yoyAbs !== null ? (
              <p className="mt-3 text-lg font-medium text-primary-foreground/90">
                {"Bend’s median sale price is "}
                {yoyDirection === 'up' ? 'up' : 'down'}{' '}
                {yoyAbs}% over the past year.
              </p>
            ) : null}
            {/* Market verdict pill — computed from monthsOfSupply against spec thresholds */}
            {mosVerdict !== null && mos !== null ? (
              <div className="mt-3">
                <span className="inline-flex items-center rounded-full bg-card/10 px-4 py-1.5 text-sm font-semibold text-primary-foreground ring-1 ring-primary-foreground/20">
                  {mosVerdict} · {mos.toFixed(1)} months of supply
                </span>
              </div>
            ) : null}
            <p className="mt-4 max-w-2xl text-lg text-primary-foreground/85">
              Price it right in the first week and you tend to outperform sellers who reach for the top
              and reduce later. Here is what Bend single-family homes are actually doing right now.
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

      {/* ─── FAQ ──────────────────────────────────────────────────────────
          Single centered column, max-w-3xl, heading on top, accordion below. */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            What you’re probably wondering
          </h2>
          <p className="mt-3 text-base leading-relaxed text-foreground/75">
            Still have a question? Talk to a broker directly.{" "}
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
              value="faq-how"
              q="How is the number put together?"
              a="A broker pulls the recent comparable sales near your home, then adjusts for your finishes, lot, view, and layout. You get a written comparative market analysis, not an automated guess. The precise figure tightens after a short walkthrough, which you can take or skip."
            />
            <FAQ
              value="faq-real"
              q="Is this a real estimate, or marketing fluff?"
              a="It’s a real comparative market analysis from actual recent sales near your home. The precise valuation requires a 15-minute walkthrough, which you can decline. The number we send is genuinely useful on its own."
            />
            <FAQ
              value="faq-list"
              q="Do I have to list with you to get the value?"
              a="No. Many of the homeowners we send valuations to decide to stay another year, or longer. We send it anyway. We’re here when the timing is right, whether that’s next month or three years from now."
            />
            <FAQ
              value="faq-after"
              q="What happens after I submit?"
              a="A broker pulls the recent comparable sales near your home and builds the analysis, then sends it to you. If you have questions, you talk to the broker who prepared it, not a call center."
            />
          </Accordion>
        </div>
      </section>

      {/* ─── Footer CTA ───────────────────────────────────────────────── */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to know your number?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-primary-foreground/85">
            Enter your address. Get your real home value.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="#get-value"
              scroll
              className="inline-flex h-14 items-center justify-center rounded-xl bg-warning px-7 text-lg font-semibold text-warning-foreground transition-colors hover:bg-warning/90"
            >
              Get my home value
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

      {/* ─── Mini fine print ─────────────────────────────────────────── */}
      <footer className="bg-card pb-20 sm:pb-8">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
          <p>Ryan Realty LLC • Equal Housing Opportunity</p>
          <p className="mt-2">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy
            </Link>
            <span className="mx-2">·</span>© {new Date().getFullYear()} Ryan Realty LLC
          </p>
        </div>
      </footer>

      {/* Sticky mobile CTA bar: pinned to viewport bottom on mobile only.
          Hidden on sm+ where the inline form is already visible. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/15 bg-card/95 px-3 py-3 shadow-[0_-4px_12px_-2px_rgba(16,39,66,0.12)] backdrop-blur sm:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="#get-value"
            scroll
            className="flex-1 rounded-xl bg-warning px-4 py-3 text-center text-sm font-semibold text-warning-foreground"
          >
            Get my home value
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

// ─── Tiny presentational helpers ─────────────────────────────────────────

function Broker({ src, name, role }: { src: string; name: string; role: string }) {
  // Big, face-forward broker headshot. Transparent-PNG portrait on a soft navy
  // disc, circular-cropped to the head + shoulders (object-top). Bigger than a
  // trust-strip dot so visitors actually see who they will be working with.
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

function NextStep({ num, title, body }: { num: string; title: string; body: string }) {
  // Card-style step on the cream/light background below the hero.
  // Navy number badge, display font for the title, Geist body.
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
