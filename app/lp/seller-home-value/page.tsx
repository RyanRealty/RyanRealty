import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { SoldStoryCard } from '@/components/seller-lp/SoldStoryCard'
import LandingPageTracker from '@/components/LandingPageTracker'
import SellerLPForm from './SellerLPForm'
import {
  getBendMarketSnapshot,
  getSoldStories,
  getTestimonialAggregate,
  formatPriceCompact,
} from './data'

export const metadata: Metadata = {
  title: 'What’s Your Bend Home Really Worth? — Ryan Realty',
  description:
    'A real comparative market analysis from local Bend sales — not an algorithm. No spam. No obligation. No hard sell.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'What’s Your Bend Home Really Worth?',
    description:
      'A real comparative market analysis from local Bend sales — not an algorithm. No spam. No obligation. No hard sell.',
    type: 'website',
  },
}

// Ryan Realty brand line — paid-traffic / cold-contact surfaces.
const BROKER_PHONE = '(541) 703-3095'
const BROKER_PHONE_TEL = '+15417033095'

export default async function SellerHomeValuePage() {
  // Detect prior identification via the fub_cid cookie. Server-side check
  // so the visible UX adjusts before first paint.
  const cookiePersonId = await getFubPersonIdFromCookie()
  const knownVisitor = cookiePersonId != null && cookiePersonId > 0

  // Live local data — Bend market snapshot + the unified "homes we represent"
  // matrix (active listings + closed sales × optional Google reviews × broker
  // headshots). Each falls back gracefully if Supabase is briefly unreachable.
  const [marketSnapshot, soldStories, aggregate] = await Promise.all([
    getBendMarketSnapshot(),
    getSoldStories(),
    getTestimonialAggregate(),
  ])

  // Visible cards: featured (top 2-up) + compact (next 3-up). schemaOnly
  // stories stay in the JSON-LD review payload for SEO but aren't rendered.
  const featuredStories = soldStories.filter((s) => s.featured)
  const compactStories = soldStories.filter((s) => !s.featured)
  const hasSoldStories = featuredStories.length > 0 || compactStories.length > 0

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
            aria-label="Ryan Realty — Bend, Oregon"
          >
            <span className="relative block h-7 w-[140px] shrink-0 sm:h-9 sm:w-[180px]">
              <Image
                src="/images/brand/logo-horizontal-blue.png"
                alt="Ryan Realty — Bend, Oregon"
                fill
                sizes="(max-width: 640px) 140px, 180px"
                className="object-contain object-left"
                priority
              />
            </span>
          </Link>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            className="rounded-full border border-primary/20 bg-card px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:text-base"
          >
            <span className="hidden sm:inline">Call Matt: </span>
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
        <div className="absolute inset-0 -z-10 bg-primary/70" aria-hidden="true" />

        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <div>
            <div className="mb-5 flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-card ring-2 ring-card/80 sm:h-24 sm:w-24">
                <Image
                  src="/images/brokers/ryan-matt.png"
                  alt="Matt Ryan, Principal Broker at Ryan Realty"
                  fill
                  sizes="(max-width: 640px) 80px, 96px"
                  className="object-cover object-top"
                  priority
                />
              </div>
              <div>
                <p className="font-display text-lg font-semibold leading-tight text-card">Matt Ryan</p>
                <p className="text-sm leading-tight text-card/85">Principal Broker · Bend, Oregon</p>
                <p className="mt-0.5 text-xs uppercase tracking-wider text-card/70">
                  Oregon License #201206613
                </p>
              </div>
            </div>

            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-card/75">
              For Bend, Oregon homeowners
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-card drop-shadow-sm sm:text-5xl lg:text-6xl">
              Your Bend home is probably worth more than Zillow says.
              <br />
              <span className="text-card/90">Here&rsquo;s the real number.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-card/90 sm:text-xl">
              A real comparative market analysis from local sales — not an algorithm. Sent within one business
              day. No spam, no obligation, no hard sell.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-card/20 pt-6 sm:grid-cols-3">
              <TrustStat value={`${aggregate.rating} / 5.0`} label="Google reviews" tone="on-photo" />
              <TrustStat value="100% local" label="Bend principal broker" tone="on-photo" />
              <TrustStat value="Licensed" label="OR #201206613" tone="on-photo" />
            </div>
          </div>

          <div className="lg:pl-4">
            <SellerLPForm knownVisitor={knownVisitor} />
          </div>
        </div>
      </section>

      {/* ─── Trust strap — research-backed conversion lift between hero + steps ───
          Single horizontal line of credibility signals. Mirrors what HomeLight /
          Opendoor use to compress trust into one strip without adding height. */}
      <section className="border-b border-primary/10 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 text-sm font-medium sm:px-6">
          <span className="flex items-center gap-2">
            <StarRow className="text-card" />
            <span>{aggregate.rating} · {aggregate.count} verified Google reviews</span>
          </span>
          <span className="hidden h-3 w-px bg-primary-foreground/30 sm:block" aria-hidden />
          <span>OR Principal Broker #201206613</span>
          <span className="hidden h-3 w-px bg-primary-foreground/30 sm:block" aria-hidden />
          <span>One business day turnaround</span>
          <span className="hidden h-3 w-px bg-primary-foreground/30 sm:block" aria-hidden />
          <span>No obligation · no hard sell</span>
        </div>
      </section>

      {/* ─── What you get ─────────────────────────────────────────────── */}
      <section className="border-b border-primary/10 bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Here&rsquo;s exactly what happens.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-foreground/80">
            Three steps. Nothing hidden. You can stop at any point.
          </p>

          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            <Step
              num="1"
              title="Enter your address"
              body="Takes 30 seconds. No account to create. No credit card. Nothing weird."
            />
            <Step
              num="2"
              title="Get the real number"
              body="A comparative market analysis from actual recent sales near your home — sent within one business day."
            />
            <Step
              num="3"
              title="Decide what to do with it"
              body="No pressure either way. Many of our valuations end with people deciding to stay another year. We're fine with that."
            />
          </ol>
        </div>
      </section>

      {/* ─── Anti-Zillow education ────────────────────────────────────── */}
      <section className="border-b border-primary/10">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Why your Zestimate is probably off.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-foreground/80">
            Zillow&rsquo;s own published median error rate on off-market homes is 7%. On a Bend home worth $850,000,
            that&rsquo;s a $59,500 swing. It doesn&rsquo;t see your remodeled kitchen. It doesn&rsquo;t know your
            neighbor just sold quietly for $87K over asking. It doesn&rsquo;t know your lot backs to open space.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <Compare
              header="What a Zestimate does"
              points={[
                'Pulls public tax-record square footage and bed/bath counts.',
                'Compares to recent sales in a wide radius, often miles away.',
                'Uses a model averaged across millions of homes nationwide.',
                'Updates without ever stepping inside your house.',
              ]}
            />
            <Compare
              header="What a real CMA does"
              points={[
                'Uses only true comparable sales in your specific neighborhood.',
                'Accounts for finishes, view, lot, layout, and improvements.',
                'Factors current Bend market velocity — not a national average.',
                'Comes from a local broker who has walked similar homes recently.',
              ]}
              accent
            />
          </div>
        </div>
      </section>

      {/* ─── Homes we've represented — unified matrix ────────────────────
          One section, nine cards. Top row (3-up on lg) features the highest-
          value properties; bottom rows (3-up) carry the rest. Each card pairs
          a real Ryan Realty transaction (active listing or closed sale, list
          side or buyer side) with the matching broker headshot — and when we
          have a Google review from that seller, the review is attached
          directly under the property. No stock imagery. Pattern modeled on
          Compass spotlights + HomeLight customer cards + the SaaS spotlight
          format used by Vercel and Linear. Pairings verified by Matt
          2026-05-14; see scratch/social-proof-research.md for the brief. */}
      {hasSoldStories && (
        <section className="border-b border-primary/10 bg-[#faf8f4]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary/70">
                  Recent Ryan Realty work
                </p>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                  Homes we&rsquo;ve represented. And what the sellers said next.
                </h2>
                <p className="mt-3 max-w-2xl text-lg text-foreground/80">
                  From $755K river-acreage to architectural estates on Bend&rsquo;s westside. Each
                  home pairs to the broker who worked the deal — and where a seller left a
                  Google review, you&rsquo;ll see it under the property.
                </p>
              </div>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Ryan+Realty+Bend+OR"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Read all reviews on Google →
              </a>
            </div>

            {/* Aggregate trust badge — anchors the section above the cards. */}
            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-primary/15 bg-card px-4 py-2 shadow-sm">
              <GoogleMark className="h-5 w-5" />
              <span className="text-sm font-semibold text-foreground">
                {aggregate.rating} <span className="sr-only">out of 5</span>
              </span>
              <StarRow className="text-primary" />
              <span className="text-sm text-muted-foreground">
                · {aggregate.count} verified seller reviews on Google
              </span>
            </div>

            {/* Featured row — top 2-up. The two highest-value transactions. */}
            {featuredStories.length > 0 && (
              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                {featuredStories.map((story) => (
                  <SoldStoryCard key={story.key} story={story} />
                ))}
              </div>
            )}

            {/* Compact rows — 3-up on lg. The remaining six properties. */}
            {compactStories.length > 0 && (
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {compactStories.map((story) => (
                  <SoldStoryCard key={story.key} story={story} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── Market truth — live Bend snapshot ───────────────────────────── */}
      <section className="border-b border-primary/10">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Where Bend is right now.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-foreground/80">
            Sellers who price right in week one outperform sellers who reach for the top of the market and reduce later.
            That difference is bigger in a balanced market than in a frenzy.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MarketStat
              label="Median list price"
              value={formatPriceCompact(marketSnapshot?.medianListPrice ?? null)}
            />
            <MarketStat
              label="Active listings"
              value={marketSnapshot?.activeCount ? marketSnapshot.activeCount.toLocaleString() : '—'}
            />
            <MarketStat
              label="New last 30 days"
              value={marketSnapshot?.newCount30d ? marketSnapshot.newCount30d.toLocaleString() : '—'}
            />
            <MarketStat label="Market" value={marketSnapshot?.marketHealthLabel ?? '—'} />
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────── */}
      <section className="border-b border-primary/10">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            What you&rsquo;re probably wondering.
          </h2>
          <div className="mt-8 space-y-6">
            <FAQ
              q="Will you spam me or sell my info?"
              a="No. We never sell or share your information. You&rsquo;ll hear from Matt once, with your number. After that, it&rsquo;s up to you whether to talk further."
            />
            <FAQ
              q="Is this a real estimate, or marketing fluff?"
              a="It&rsquo;s a real comparative market analysis from actual recent sales near your home. The truly precise valuation requires a 15-minute walkthrough, which you can decline. The number we send is genuinely useful on its own."
            />
            <FAQ
              q="Do I have to list with you to get the value?"
              a="No. Many of the homeowners we send valuations to decide to stay another year, or longer. We send it anyway. We&rsquo;re here when the timing is right — whether that&rsquo;s next month or three years from now."
            />
          </div>
        </div>
      </section>

      {/* ─── Heritage block ──────────────────────────────────────────── */}
      <section className="border-b border-primary/10 bg-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-16">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-md">
            <Image
              src="/images/brand/signature-lockup.png"
              alt="Ryan Realty — It's About Relationships. With Jax the blue lab."
              fill
              sizes="(max-width: 640px) 90vw, 480px"
              className="object-contain"
            />
          </div>
          <p className="mt-2 font-display text-xl text-primary sm:text-2xl">
            Building community through authentic relationships.
          </p>
          <p className="mt-3 text-sm uppercase tracking-[0.12em] text-muted-foreground">
            Local · Bend · Oregon · Since 2023
          </p>
        </div>
      </section>

      {/* ─── Footer CTA ───────────────────────────────────────────────── */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to know your number?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-primary-foreground/85">
            Enter your address. Get your home value within one business day. No spam, no obligation, no hard sell.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="#seller-lp-address"
              scroll
              className="inline-flex h-14 items-center justify-center rounded-xl bg-card px-7 text-lg font-semibold text-primary transition-colors hover:bg-card/90"
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
          <p>Ryan Realty LLC • Oregon Principal Broker #201206613 • Equal Housing Opportunity</p>
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
            href="#seller-lp-address"
            scroll
            className="flex-1 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
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

function TrustStat({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone?: 'on-photo' | 'on-surface'
}) {
  const onPhoto = tone === 'on-photo'
  return (
    <div>
      <div className={`font-display text-xl font-semibold ${onPhoto ? 'text-card' : 'text-primary'}`}>
        {value}
      </div>
      <div
        className={`mt-0.5 text-xs uppercase tracking-wider ${
          onPhoto ? 'text-card/70' : 'text-muted-foreground'
        }`}
      >
        {label}
      </div>
    </div>
  )
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <li className="rounded-2xl border border-primary/10 bg-card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">
        {num}
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold text-primary">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-foreground/80">{body}</p>
    </li>
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
      <ul className="mt-4 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-base text-foreground/85">
            <span aria-hidden className={accent ? 'text-primary' : 'text-muted-foreground'}>
              •
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MarketStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold tabular-nums text-primary">{value}</div>
    </div>
  )
}

// ─── Trust-strip helpers ──────────────────────────────────────────────────

function StarRow({ className }: { className?: string }) {
  return (
    <span aria-label="Five star rating" className={`text-base leading-none ${className ?? 'text-primary'}`}>
      {'★★★★★'}
    </span>
  )
}

function GoogleMark({ className }: { className?: string }) {
  // Inline Google "G" mark — preserves the official 4-color palette per Google
  // brand guidelines for displaying verified-review attribution.
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Google"
      role="img"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.97 6.97 0 0 1 5.5 12c0-.72.12-1.42.34-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.16-3.16C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
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

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-primary/10 bg-card p-5 open:border-primary/30">
      <summary className="cursor-pointer list-none">
        <span className="flex items-center justify-between gap-4">
          <span className="font-display text-lg font-semibold text-primary">{q}</span>
          <span
            aria-hidden
            className="shrink-0 text-2xl leading-none text-primary/60 transition-transform group-open:rotate-45"
          >
            +
          </span>
        </span>
      </summary>
      <p className="mt-3 text-base leading-relaxed text-foreground/85">{a}</p>
    </details>
  )
}
