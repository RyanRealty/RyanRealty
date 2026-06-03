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

export default async function SellerHomeValuePage() {
  // Detect prior identification via the fub_cid cookie. Server-side check
  // so the visible UX adjusts before first paint.
  const cookiePersonId = await getFubPersonIdFromCookie()
  const knownVisitor = cookiePersonId != null && cookiePersonId > 0

  // Live local data — Bend market snapshot + the unified "homes we represent"
  // matrix (active listings + closed sales × optional Google reviews × broker
  // headshots). Each falls back gracefully if Supabase is briefly unreachable.
  const [marketSnapshot, priceTrend, soldStories, aggregate] = await Promise.all([
    getBendMarketSnapshot(),
    getBendPriceTrend(),
    getSoldStories(),
    getTestimonialAggregate(),
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
      <LandingPageTracker lpVariant="seller-home-value" />
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
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <span className="hidden sm:inline">Call </span>
            {BROKER_PHONE}
          </a>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative isolate border-b border-primary/10">
        <Image
          src="/images/lp/hero-banner.jpg"
          alt=""
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

          {/* 2 — H1 (Amboqia) */}
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-card drop-shadow-sm sm:text-5xl lg:text-6xl">
            What’s your home worth in today’s market?
          </h1>

          {/* 3 — Subhead */}
          <p className="mt-4 text-lg leading-relaxed text-card drop-shadow-sm">
            Get real numbers from local pros, not an algorithm.
          </p>

          {/* 4-6 — Address field + button + microcopy: the hero centerpiece */}
          <div className="mt-7 w-full">
            <SellerLPForm knownVisitor={knownVisitor} heroVariant />
          </div>

          {/* 7 — How it works: the three steps, right in the hero area. */}
          <div className="mt-8 grid w-full grid-cols-1 gap-4 border-t border-card/20 pt-6 text-left sm:grid-cols-3 sm:gap-5">
            <HeroStep num="1" title="Enter the address" body="Any home you want a real estimate on." />
            <HeroStep num="2" title="We’ll send you the report" body="Just tell us where to send it." />
            <HeroStep num="3" title="You decide what’s next" body="Schedule a call, ask questions, or just keep it." />
          </div>
        </div>
      </section>

      {/* ─── Work with Bend's trusted team — photos + reviews together ────
          One trust block: the three brokers shown big, paired with a real
          Google review that fades through the set. Faces and words together. */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 sm:py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Work with Bend’s trusted team
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
            Why your Zestimate is probably off.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-foreground/80">
            An online estimate is a guess from public records. It never sees your finishes, your lot, or
            the quiet sale down the street.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Compare
              header="An online estimate"
              points={[
                'Tax-record square footage and bed/bath counts',
                'Comps from a wide radius, often miles away',
                'A national model averaged across millions of homes',
                'Never steps inside your home',
              ]}
            />
            <Compare
              header="A real broker CMA"
              points={[
                'Only true comparable sales in your neighborhood',
                'Adjusts for finishes, view, lot, and layout',
                'Current Bend market velocity, not a national average',
                'From a broker who walked similar homes recently',
              ]}
              accent
            />
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
              Where Bend stands today.
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-primary-foreground/85">
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
          Two-column on desktop so the section uses the full page width: the
          heading anchors the left rail (sticky as the answers expand) while
          the accordion fills the wider right column. Stacks to a single
          column on mobile. */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              What you’re probably wondering.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-foreground/75">
              Still have a question? Talk to a broker directly.
            </p>
            <a
              href={`tel:${BROKER_PHONE_TEL}`}
              className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-primary underline-offset-4 hover:underline"
            >
              <PhoneIcon className="h-4 w-4" />
              {BROKER_PHONE}
            </a>
          </div>
          <Accordion type="single" collapsible className="gap-4 lg:col-span-8">
            <FAQ
              value="faq-how"
              q="How is the number put together?"
              a="A broker pulls the recent comparable sales near your home, then adjusts for your finishes, lot, view, and layout. You get a written comparative market analysis, not an automated guess. The precise figure tightens after a short walkthrough, which you can take or skip."
            />
            <FAQ
              value="faq-real"
              q="Is this a real estimate, or marketing fluff?"
              a="It&rsquo;s a real comparative market analysis from actual recent sales near your home. The precise valuation requires a 15-minute walkthrough, which you can decline. The number we send is genuinely useful on its own."
            />
            <FAQ
              value="faq-list"
              q="Do I have to list with you to get the value?"
              a="No. Many of the homeowners we send valuations to decide to stay another year, or longer. We send it anyway. We&rsquo;re here when the timing is right, whether that&rsquo;s next month or three years from now."
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

      {/* ─── Sticky mobile CTA bar ─────────────────────────────────────
          Pinned to viewport bottom on mobile only. Standard high-converting
          mobile LP pattern — typical 5-15% conversion lift in seller LP
          tests. Hidden on sm+ where the inline form is already visible. */}
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

function HeroStep({ num, title, body }: { num: string; title: string; body: string }) {
  // Compact step for the hero scrim: light text on the navy photo. Badge sits
  // beside the label on mobile, above it on desktop.
  return (
    <div className="flex items-start gap-3 sm:flex-col sm:gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card/15 font-display text-sm font-semibold text-card ring-1 ring-card/30">
        {num}
      </span>
      <div>
        <p className="font-semibold text-card drop-shadow-sm">{title}</p>
        <p className="text-sm leading-relaxed text-card/75 drop-shadow-sm">{body}</p>
      </div>
    </div>
  )
}

function Compare({
  header,
  points,
  accent,
}: {
  header: string
  points: string[]
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        accent ? 'border-primary bg-primary/5' : 'border-primary/10 bg-card'
      }`}
    >
      <h3 className={`font-display text-xl font-semibold ${accent ? 'text-primary' : 'text-foreground/85'}`}>
        {header}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-base text-foreground/85">
            <span
              aria-hidden
              className={
                accent
                  ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground'
                  : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground'
              }
            >
              {accent ? '✓' : '✕'}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
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
