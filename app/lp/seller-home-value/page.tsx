import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import SellerLPForm from './SellerLPForm'
import {
  getBendMarketSnapshot,
  getRecentBendSoldListings,
  formatPriceCompact,
  type RecentSoldListing,
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

// Ryan Realty brand / brokerage line — for paid-traffic and cold-contact
// surfaces like this seller LP. Matt's direct personal line (541) 213-6706
// is reserved for people who already know him.
const BROKER_PHONE = '(541) 703-3095'
const BROKER_PHONE_TEL = '+15417033095'

export default async function SellerHomeValuePage() {
  // Detect prior identification via the fub_cid cookie. Server-side check
  // so the visible UX adjusts before first paint.
  const cookiePersonId = await getFubPersonIdFromCookie()
  const knownVisitor = cookiePersonId != null && cookiePersonId > 0

  // Live local data — Bend market snapshot + recent closings. Pulled at request
  // time (the LP route is rendered on-demand). Both fall back gracefully if
  // Supabase is briefly unreachable — the section just hides itself.
  const [marketSnapshot, recentSold] = await Promise.all([
    getBendMarketSnapshot(),
    getRecentBendSoldListings(),
  ])

  return (
    <div className="bg-background text-foreground">
      {/* ─── Sticky minimal header ───────────────────────────────────────
          Heritage wordmark (logo-blue.png) — the pre-rendered mark from the
          brand kit, NOT re-typeset. Per the design system: "Drop in the
          pre-rendered wordmark from assets/brand/. Do not re-typeset the
          wordmark." */}
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/images/brand/logo-blue.png"
              alt="Ryan Realty"
              width={160}
              height={40}
              priority
              className="h-9 w-auto sm:h-10"
            />
            <span className="hidden text-xs uppercase tracking-[0.12em] text-muted-foreground sm:inline">
              Bend · Oregon
            </span>
          </div>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            className="rounded-full border border-primary/20 bg-card px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:text-base"
          >
            <span className="hidden sm:inline">Call Matt: </span>
            {BROKER_PHONE}
          </a>
        </div>
      </header>

      {/* ─── Hero ──────────────────────────────────────────────────────────
          Documentary Central Oregon photography behind a navy protection
          overlay — per the design system: "No decorative gradients. Only
          the navy protection overlay on the hero image." Image is Matt's
          approved 2048×1152 banner photo from
          design_system/ryan-realty/assets/social/banner-photo/. */}
      <section className="relative isolate border-b border-primary/10">
        {/* Background photo */}
        <Image
          src="/images/lp/hero-banner.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="lp-kenburns absolute inset-0 -z-20 object-cover object-center"
        />
        {/* Navy protection overlay — solid, not a gradient, per design system */}
        <div className="absolute inset-0 -z-10 bg-primary/70" aria-hidden="true" />

        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <div>
            {/* Broker identity strip — verified human face above the fold is the
                #3 ranked trust signal for boomer-seller LPs per the deep research
                (NNG + AnytimeEstimate 2025: 2× CVR with a real broker headshot
                visible). Real photo, not stock. */}
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
                <p className="font-display text-lg font-semibold leading-tight text-card">
                  Matt Ryan
                </p>
                <p className="text-sm leading-tight text-card/85">
                  Principal Broker · Bend, Oregon
                </p>
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

            {/* Trust cluster — sits next to the form, not below the fold. */}
            <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-card/20 pt-6 sm:grid-cols-3">
              <TrustStat value="4.9 / 5.0" label="Google reviews" tone="on-photo" />
              <TrustStat value="100% local" label="Bend principal broker" tone="on-photo" />
              <TrustStat value="Licensed" label="OR #201206613" tone="on-photo" />
            </div>
            <p className="mt-4 text-sm italic text-card/80">
              &ldquo;Matt handled the sale with patience and respect. We&rsquo;d been in our home 22 years and
              he never once pushed us.&rdquo; <span className="not-italic">— Past client, NW Crossing</span>
            </p>
          </div>

          <div className="lg:pl-4">
            <SellerLPForm knownVisitor={knownVisitor} />
          </div>
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

      {/* ─── Recent Bend closings — real social proof ──────────────────────
          Pulled live from the listings table at request time. Up to 6 most
          recent SFR closings in Bend with a photo. If the data fetch fails or
          returns zero rows, the section hides itself — never shows skeletons
          or fake placeholders. */}
      {recentSold.length > 0 && (
        <section className="border-b border-primary/10 bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Recent sales right here in Bend.
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-foreground/80">
              What homes like yours are actually closing for — pulled from local MLS data, refreshed daily.
              No filters. No cherry-picking.
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {recentSold.map((listing, i) => (
                <SoldCard key={`${listing.closedAt}-${i}`} listing={listing} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Market truth — live Bend snapshot ─────────────────────────────
          Pulled from market_pulse_live (the same source the weekly market
          packet uses). Falls back to the placeholder figures only when the
          live row is missing — never invents data. */}
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
            <MarketStat
              label="Market"
              value={marketSnapshot?.marketHealthLabel ?? '—'}
            />
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

      {/* ─── Heritage block — cross-register stamp before the footer CTA ──
          The signature lockup (illustration-05) is the wordmark + Jax + the
          "It's About Relationships." tagline ribbon as a single hand-drawn
          mark. Used here as the one allowed cross-register moment per the
          design system: a heritage block at the end of a web-register page. */}
      <section className="bg-[#faf8f4] border-b border-primary/10">
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
      <footer className="bg-card">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
          <p>
            Ryan Realty LLC • Oregon Principal Broker #201206613 • Equal Housing Opportunity
          </p>
          <p className="mt-2">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy
            </Link>
            <span className="mx-2">·</span>
            © {new Date().getFullYear()} Ryan Realty LLC
          </p>
        </div>
      </footer>
    </div>
  )
}

// ─── Tiny presentational helpers (kept inline for Phase 1) ─────────────────

function TrustStat({ value, label, tone }: { value: string; label: string; tone?: 'on-photo' | 'on-surface' }) {
  const onPhoto = tone === 'on-photo'
  return (
    <div>
      <div className={`font-display text-xl font-semibold ${onPhoto ? 'text-card' : 'text-primary'}`}>{value}</div>
      <div className={`mt-0.5 text-xs uppercase tracking-wider ${onPhoto ? 'text-card/70' : 'text-muted-foreground'}`}>{label}</div>
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
      <h3
        className={`font-display text-xl font-semibold ${accent ? 'text-primary' : 'text-foreground/85'}`}
      >
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

function SoldCard({ listing }: { listing: RecentSoldListing }) {
  const sold = formatPriceCompact(listing.closePrice)
  const list = formatPriceCompact(listing.listPrice)
  const overAsk =
    listing.closePrice && listing.listPrice && listing.closePrice > listing.listPrice
      ? Math.round(((listing.closePrice - listing.listPrice) / listing.listPrice) * 1000) / 10
      : null
  const place = listing.neighborhood?.trim() || listing.city?.trim() || 'Bend'
  return (
    <div className="group overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] w-full bg-primary/5">
        <Image
          src={listing.photoUrl}
          alt={`Recently sold home in ${place}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute bottom-3 left-3 rounded-full bg-card/95 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm">
          Sold {sold}
        </div>
      </div>
      <div className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{place}</p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="font-display text-2xl font-semibold tabular-nums text-primary">{sold}</p>
          {overAsk != null && overAsk > 0 && (
            <p className="text-sm font-semibold text-foreground/85">+{overAsk}% over ask</p>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          Listed {list}
          {listing.beds || listing.baths ? (
            <>
              {' · '}
              {listing.beds ?? '—'} bd · {listing.baths ?? '—'} ba
            </>
          ) : null}
          {typeof listing.domDays === 'number' ? <> · {listing.domDays} days</> : null}
        </p>
      </div>
    </div>
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
