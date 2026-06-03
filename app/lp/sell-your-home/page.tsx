// @no-parity — social-proof conviction LP, no Wave 3 mockup contract
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
import { SoldStoryCard } from '@/components/seller-lp/SoldStoryCard'
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

/** Compact USD formatter — "$12.2M", "$813K". */
function fmtCompact(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000
    const s = m.toFixed(m >= 100 ? 0 : m >= 3 ? 1 : 2).replace(/\.?0+$/, '')
    return `$${s}M`
  }
  const k = Math.round(v / 1000)
  return `$${k}K`
}

export default async function ListYourHomePage() {
  const cookiePersonId = await getFubPersonIdFromCookie()
  const knownVisitor = cookiePersonId != null && cookiePersonId > 0

  const [trackRecord, soldStories, aggregate] = await Promise.all([
    getBrokerageTrackRecord(),
    getSoldStories(),
    getTestimonialAggregate(),
  ])

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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="Ryan Realty · Bend, Oregon">
            <span className="relative block h-7 w-36 shrink-0 sm:h-9 sm:w-44">
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

      {/* 1. Hero */}
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
          className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/65 via-primary/60 to-primary/70"
          aria-hidden="true"
        />
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-card/85 drop-shadow-sm">
            Bend · Oregon
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-card drop-shadow-sm sm:text-5xl lg:text-6xl">
            Sell your Bend home with a team that gets it sold.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-card/90 drop-shadow-sm">
            A full-service local brokerage with the reviews and the results to back it up. Start with a free, no-pressure consultation.
          </p>

          {aggregate.count > 0 && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-card/10 px-4 py-2 ring-1 ring-card/20 backdrop-blur-sm">
              <span className="text-base leading-none text-warning">{'★★★★★'}</span>
              <span className="text-sm font-medium text-card">
                {aggregate.rating} · {aggregate.count} Google reviews
              </span>
            </div>
          )}

          <a
            href="#consult"
            className="mt-7 inline-flex h-14 items-center justify-center rounded-xl bg-warning px-8 text-lg font-semibold text-warning-foreground transition-colors hover:bg-warning/90"
          >
            Book a free consultation
          </a>
          <p className="mt-3 text-sm text-card/70 drop-shadow-sm">
            No pressure, no obligation. A real conversation with a local broker.
          </p>
        </div>
      </section>

      {/* 2. Track-record band */}
      {trackRecord !== null && (
        <section className="border-b border-primary/10 bg-primary text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
            <p className="text-center text-sm font-semibold uppercase tracking-wider text-primary-foreground/75">
              Ryan Realty · verified closed sales
            </p>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <StatBadge figure={fmtCompact(trackRecord.totalVolume)} label="in Bend homes sold" />
              <StatBadge figure={fmtCompact(trackRecord.avgSalePrice)} label="average sale price" />
              <StatBadge figure={`${aggregate.rating}★`} label={`across ${aggregate.count} Google reviews`} />
            </div>
          </div>
        </section>
      )}

      {/* 3. Reviews wall */}
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            What Bend home sellers say
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            Every review below is real, pulled from the Ryan Realty Google Business Profile.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <ReviewCard key={t.author} quote={t.quote} author={t.author} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <a
              href={GOOGLE_REVIEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-card px-5 py-3 text-sm font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <GoogleMark className="h-4 w-4" />
              Read them all on Google
            </a>
          </div>
        </div>
      </section>

      {/* 4. Why list with us */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Why list with Ryan Realty
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
            Four things that matter when you are choosing who to list with.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ValueCard
              num="1"
              title="Pricing from real local sales"
              body="We build your pricing from recent comparable sales near your home, not a national model. You get a real comparative market analysis before we agree on anything."
            />
            <ValueCard
              num="2"
              title="Marketing that gets your home seen"
              body="Professional photography, video, and your listing pushed across the channels buyers actually use. Not just an MLS entry pushed to an aggregator."
            />
            <ValueCard
              num="3"
              title="Hands-on negotiation"
              body="We negotiate with the data in front of us and your interests as the only priority. You know what is happening and why at every step."
            />
            <ValueCard
              num="4"
              title="You work directly with the broker who lists your home"
              body="Not a team hand-off, not a call center. The broker who reviews your comps is the broker on the phone when you have a question."
            />
          </div>

          <div className="mt-8 rounded-2xl border border-primary/10 bg-background p-6">
            <h3 className="font-display text-lg font-semibold text-primary">
              A note on the alternatives
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <AltBlock
                label="Going it alone (FSBO)"
                note="You handle negotiations, disclosure paperwork, and buyer qualification. Most unrepresented sellers net less after the time cost and typical price concessions."
              />
              <AltBlock
                label="Discount or flat-fee brokers"
                note="Lower upfront cost, but often means limited marketing, no negotiation support, and you manage the transaction logistics yourself."
              />
              <AltBlock
                label="iBuyers"
                note="Quick, but iBuyer offers are typically well below market. Convenient if speed is the only goal. Rarely the best net outcome for sellers."
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Recent sales and stories */}
      {soldStories.length > 0 && (
        <section className="border-b border-primary/10 bg-background">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Recent homes we sold in Bend
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Real closed sales. Real clients. Verified against MLS records.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {soldStories.filter((s) => s.featured).map((story) => (
                <SoldStoryCard key={story.key} story={story} />
              ))}
            </div>
            {soldStories.filter((s) => !s.featured).length > 0 && (
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {soldStories.filter((s) => !s.featured).map((story) => (
                  <SoldStoryCard key={story.key} story={story} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. Meet the team */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 sm:py-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            The brokers behind Ryan Realty
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-foreground/80">
            Three active, licensed Oregon brokers. All based in Bend. All personally involved in every transaction we take on.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 sm:gap-8">
            <BrokerCard
              src="/images/brokers/ryan-matt.png"
              name="Matt Ryan"
              role="Principal Broker"
              note="Founder. Principal broker since 2023."
            />
            <BrokerCard
              src="/images/brokers/stevenson-paul.png"
              name="Paul Stevenson"
              role="Broker"
              note="Representing buyers and sellers across Bend."
            />
            <BrokerCard
              src="/images/brokers/peterson-rebecca.png"
              name="Rebecca Peterson"
              role="Broker"
              note="Specializing in NW Crossing and Westside Bend."
            />
          </div>
        </div>
      </section>

      {/* 7. How it works */}
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            How a listing with us works
          </h2>
          <p className="mt-3 text-base leading-relaxed text-foreground/80">
            Four steps from your first call to closing day.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <StepCard
              num="1"
              title="A free consultation"
              body="We talk through your property, your goals, and your timeline. No commitment. You walk away with a real sense of what your home could sell for and what a marketing plan looks like."
            />
            <StepCard
              num="2"
              title="Pricing and a marketing plan from real data"
              body="We pull recent comparable sales near your home and build a comparative market analysis. You see the comps, the reasoning, and the pricing range before we agree on anything."
            />
            <StepCard
              num="3"
              title="Full marketing, showings, and updates"
              body="Professional photography and video, MLS listing with syndication, targeted promotion to buyers already searching in your area. We keep you updated at every step."
            />
            <StepCard
              num="4"
              title="Negotiation and close"
              body="When offers come in, we review every term with you and negotiate with the data in front of us. We manage the paperwork, the timeline, and the contingencies through closing day."
            />
          </div>
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Common questions
          </h2>
          <p className="mt-3 text-base leading-relaxed text-foreground/75">
            Have something not covered here? Call us directly.{' '}
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
              a="Our fee depends on the home, the market, and the plan. We walk through it on the consultation call with no obligation. There is no standard quote we can give without knowing your property and your goals."
            />
            <FAQ
              value="faq-time"
              q="How long will it take to sell?"
              a="It depends on price, condition, and where the market is at the time. Homes priced close to recent comparable sales tend to move quickly. We give you a realistic timeline based on your specific property after reviewing the comps with you."
            />
            <FAQ
              value="faq-marketing"
              q="What do you do to market my home?"
              a="Professional photography and video, a full MLS listing with syndication across the major platforms, and targeted local promotion to buyers already searching in your area. The marketing plan is built around your home, not a template."
            />
            <FAQ
              value="faq-zillow"
              q="Why list with you instead of Zillow or a discount broker?"
              a="Zillow is a lead aggregator, not a brokerage. A discount or flat-fee broker often means you handle showings, negotiations, and paperwork yourself. With us, you have a full-service broker in your corner from pricing through closing, with the reviews and the track record to show what that looks like in practice."
            />
            <FAQ
              value="faq-after"
              q="What happens after I reach out?"
              a="A broker reviews your property and recent comparable sales, then calls you to talk through pricing and a plan. You talk to the broker who would actually list your home, not a scheduler or a call center."
            />
          </Accordion>
        </div>
      </section>

      {/* 9. Consultation form */}
      <section id="consult" className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Book your free listing consultation
          </h2>
          <p className="mt-3 text-base leading-relaxed text-foreground/80">
            Tell us about your home. A broker will reach out to talk through pricing and a plan. No pitch, no pressure, no obligation.
          </p>
          <div className="mt-7">
            <SellerLPForm knownVisitor={knownVisitor} variant="list-now" />
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to talk about listing your home?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-primary-foreground/85">
            A free, no-pressure conversation with a local broker. No obligation.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#consult"
              className="inline-flex h-14 items-center justify-center rounded-xl bg-warning px-7 text-lg font-semibold text-warning-foreground transition-colors hover:bg-warning/90"
            >
              Book a free consultation
            </a>
            <a
              href={`tel:${BROKER_PHONE_TEL}`}
              className="inline-flex h-14 items-center justify-center rounded-xl border-2 border-primary-foreground/30 px-7 text-lg font-semibold text-primary-foreground transition-colors hover:border-primary-foreground"
            >
              Call: {BROKER_PHONE}
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
            <span className="mx-2">·</span>
            {'© '}
            {new Date().getFullYear()} Ryan Realty LLC
          </p>
        </div>
      </footer>

      {/* Sticky mobile CTA bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/15 bg-card/95 px-3 py-3 backdrop-blur sm:hidden">
        <div className="flex items-center gap-2">
          <a
            href="#consult"
            className="flex-1 rounded-xl bg-warning px-4 py-3 text-center text-sm font-semibold text-warning-foreground"
          >
            Book a free consultation
          </a>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            aria-label={`Call Ryan Realty at ${BROKER_PHONE}`}
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

function StatBadge({ figure, label }: { figure: string; label: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="font-display text-3xl font-semibold tabular-nums text-primary-foreground sm:text-4xl">
        {figure}
      </p>
      <p className="mt-1 text-sm text-primary-foreground/75">{label}</p>
    </div>
  )
}

function ReviewCard({ quote, author }: { quote: string; author: string }) {
  return (
    <figure className="flex flex-col rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span aria-label="Five star rating" className="text-base leading-none text-primary">
          {'★★★★★'}
        </span>
        <GoogleMark className="h-4 w-4 opacity-60" />
      </div>
      <blockquote className="mt-3 grow text-base leading-relaxed text-foreground/85 line-clamp-6">
        {'"'}
        {quote}
        {'"'}
      </blockquote>
      <figcaption className="mt-4 border-t border-primary/10 pt-4">
        <p className="text-sm font-semibold text-foreground">{author}</p>
        <p className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">Google review</p>
      </figcaption>
    </figure>
  )
}

function ValueCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-primary/10 bg-background p-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-base font-semibold text-primary-foreground">
        {num}
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-primary">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

function AltBlock({ label, note }: { label: string; note: string }) {
  return (
    <div>
      <p className="font-display text-sm font-semibold text-primary">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{note}</p>
    </div>
  )
}

function BrokerCard({
  src,
  name,
  role,
  note,
}: {
  src: string
  name: string
  role: string
  note: string
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="relative h-28 w-28 overflow-hidden rounded-full bg-primary/5 sm:h-36 sm:w-36">
        <Image
          src={src}
          alt={name}
          fill
          sizes="(max-width: 640px) 112px, 144px"
          className="object-cover object-top"
        />
      </span>
      <p className="mt-3 font-display text-base font-semibold text-primary sm:text-lg">{name}</p>
      <p className="text-xs text-muted-foreground sm:text-sm">{role}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-foreground/70 sm:text-sm">{note}</p>
    </div>
  )
}

function StepCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-primary/10 bg-card p-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-base font-semibold text-primary-foreground">
        {num}
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-primary">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

function FAQ({ value, q, a }: { value: string; q: string; a: string }) {
  return (
    <AccordionItem
      value={value}
      className="rounded-xl border border-primary/10 bg-background px-5 not-last:border-b data-[state=open]:border-primary/30"
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
