// @no-parity - paid-traffic FSBO LP per the approved Figma LP 3 spec (tmp/figma-lp-build/BRIEF.md), no Wave 3 mockup contract
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import LandingPageTracker from '@/components/LandingPageTracker'
import ExitIntentPrompt from '@/components/landing/ExitIntentPrompt'
import ScrollReveal from '@/components/landing/ScrollReveal'
import { ReviewStrip } from '@/components/landing/ReviewCard'
import { TESTIMONIALS } from '@/lib/testimonials'
import { CONTACT } from '@/lib/brand/contact'
import FsboLPForm from './FsboLPForm'

/**
 * FSBO Landing Page — /lp/fsbo (approved Figma "LP 3 · FSBO" spec,
 * tmp/figma-lp-build/BRIEF.md Phase 4).
 *
 * Voice: respectful of the owner's choice to sell on their own. Honest
 * comparison, no fear-mongering, commission conversation stated plainly.
 */
export const metadata: Metadata = {
  title: 'Selling It Yourself? Smart. Here Is Backup | Ryan Realty',
  description:
    'Keep the sale yours. A free pricing report from a Bend broker: what your home should bring, who the buyer pool is, and where FSBO deals lose money.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Selling It Yourself? Smart. Here Is Backup.',
    description:
      'A free pricing report from a Bend broker. Keep the sale yours, and you owe us nothing.',
    type: 'website',
  },
}

// Dotted format per brand voice spec (CLAUDE.md §3): 541.703.3095
const BROKER_PHONE = CONTACT.phoneFub
const BROKER_PHONE_TEL = CONTACT.phoneFubTel

// Seller-side reviews not already carrying the expired LP (Audra Hedberg +
// Douglas Grant are seller-side experiences).
const FSBO_LP_REVIEWS = TESTIMONIALS.filter((t) =>
  ['Audra Hedberg', 'Douglas Grant'].includes(t.author),
)

// Honest comparison rows per the approved Figma spec — no fear-mongering,
// the "On your own" cells say what is genuinely doable solo.
const COMPARISON_ROWS: Array<{ criterion: string; solo: string; withUs: string }> = [
  {
    criterion: 'Pricing data access',
    solo: 'Zillow estimates and county records',
    withUs: 'Closed MLS comps, adjusted by a broker',
  },
  {
    criterion: 'MLS + portal syndication',
    solo: 'Flat-fee MLS entry or yard sign and Craigslist',
    withUs: 'Full MLS listing syndicated to Zillow, Realtor.com, Redfin',
  },
  {
    criterion: 'Buyer screening',
    solo: 'You vet inquiries yourself',
    withUs: 'Pre-qualification checked before a showing is booked',
  },
  {
    criterion: 'Showing coordination',
    solo: 'Your phone, your schedule',
    withUs: 'Scheduled, confirmed, and followed up for feedback',
  },
  {
    criterion: 'Negotiation experience',
    solo: 'Your own judgment under pressure',
    withUs: 'A broker who negotiates contracts every week',
  },
  {
    criterion: 'Oregon forms + disclosure liability',
    solo: 'You carry the paperwork and the liability',
    withUs: 'Every Oregon form completed and every disclosure reviewed before it goes out',
  },
  {
    criterion: 'Closing coordination',
    solo: 'You chase title, lender, and inspections',
    withUs: 'Transaction managed from contract to keys',
  },
]

const REPORT_CONTENTS = [
  'What your home should bring, from closed sales near you',
  'The comps behind the number, listed out',
  'Who the realistic buyer pool is for your home and price point',
  'Where for-sale-by-owner deals most often lose money, and how to avoid it',
]

export default function FsboLPPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <LandingPageTracker lpVariant="fsbo" />

      {/* ─── HERO — warm neighborhood photo, navy scrim, address capture ──── */}
      <section className="relative isolate border-b border-primary/10">
        <Image
          src="/images/lp/hero-pond.jpg"
          alt="A neighborhood pond and homes in Bend, Oregon"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover object-center"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/60 via-primary/55 to-primary/70"
          aria-hidden="true"
        />

        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-card/85 drop-shadow-sm">
            Central Oregon for-sale-by-owner
          </p>

          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-card drop-shadow-sm sm:text-5xl">
            Selling It Yourself? Smart. Here Is Backup.
          </h1>

          <p className="mt-4 max-w-xl text-lg leading-relaxed text-card drop-shadow-sm">
            Keep the sale yours. We will tell you what your home should bring, who the buyer
            pool is, and where for-sale-by-owner deals lose money. Free, and you owe us nothing.
          </p>

          {/* Broker trust chip */}
          <div className="mt-5 flex items-center gap-2.5">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-card/10 ring-2 ring-card/40">
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
              <p className="text-sm font-semibold leading-tight text-card">Matt Ryan</p>
              <p className="text-xs leading-tight text-card/75">Principal broker · Ryan Realty</p>
            </div>
          </div>

          {/* Address capture — consent disclosure renders inside the form on
              BOTH steps (first-paint HTML, A2P-verified text). */}
          <div className="mt-5 w-full">
            <FsboLPForm heroVariant formId="fsbo-form" />
          </div>

          <p className="mt-3 text-sm text-card/70 drop-shadow-sm">
            No listing agreement. No pitch call required. The report is yours either way.
          </p>
        </div>
      </section>

      {/* ─── S2 · Honest-respect band ──────────────────────────────────────── */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-14">
          <ScrollReveal>
            <p className="font-display text-2xl font-semibold leading-snug tracking-tight text-primary sm:text-3xl">
              Plenty of owners sell on their own. The ones who net the most treat it like a
              brokerage would.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S3 · Honest comparison table ──────────────────────────────────── */}
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <ScrollReveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              The honest comparison
            </h2>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              Each of these is doable on your own. The question is what your weekends are worth
              and where the dollars actually move.
            </p>
          </ScrollReveal>
          <ScrollReveal delayMs={100}>
            <div className="mt-8 overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm">
              {/* Header row */}
              <div className="grid grid-cols-3 gap-3 border-b border-primary/10 bg-primary px-4 py-3 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/80" />
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
                  On your own
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                  With Ryan Realty
                </p>
              </div>
              {COMPARISON_ROWS.map((row, i) => (
                <div
                  key={row.criterion}
                  className={
                    i % 2 === 1
                      ? 'grid grid-cols-3 gap-3 bg-secondary/50 px-4 py-4 sm:px-6'
                      : 'grid grid-cols-3 gap-3 px-4 py-4 sm:px-6'
                  }
                >
                  <p className="text-sm font-medium text-foreground">{row.criterion}</p>
                  <p className="text-sm text-muted-foreground">{row.solo}</p>
                  <p className="flex items-start gap-2 text-sm font-medium text-primary">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{row.withUs}</span>
                  </p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S4 · What we hand you, free ───────────────────────────────────── */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2">
          <ScrollReveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              What we hand you, free
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-foreground/80">
              The same pricing analysis we build for our own listings, for the home you are
              selling yourself. No listing agreement attached, no follow-up condition.
            </p>
            <p className="mt-4 text-base leading-relaxed text-foreground/70">
              Why free? Because owners who get an honest number remember where it came from.
              Some keep selling solo and do fine. Some call us later. Both are fine outcomes.
            </p>
          </ScrollReveal>
          <ScrollReveal delayMs={100}>
            <Card className="mx-auto w-full max-w-sm rounded-2xl bg-background p-6 text-base shadow-md ring-primary/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your pricing report
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-primary">
                Built from closed sales, not estimates
              </p>
              <ul className="mt-4 space-y-3">
                {REPORT_CONTENTS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm leading-relaxed text-foreground/85">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S5 · Transition block — commission stated plainly ─────────────── */}
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <ScrollReveal>
            <Card className="rounded-2xl p-7 text-base shadow-sm ring-primary/10 sm:p-10">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                If it stops being worth your weekend
              </h2>
              <div className="mt-5 space-y-4 text-base leading-7 text-foreground/85">
                <p>
                  Some owners run the whole sale themselves and close happy. Others get three
                  weeks in and decide the showings, the screening, and the paperwork are not
                  how they want to spend their time. If that happens, listing with us is a
                  straightforward conversation.
                </p>
                <p>
                  The commission conversation is plain. It is a total commission split between
                  the listing brokerage and the buyer&rsquo;s brokerage, it is negotiable, and we put
                  the exact number in writing before you sign anything. Professional
                  photography, the MLS listing, every showing, and full transaction management
                  from contract to close are included. No add-on fees.
                </p>
                <p>
                  And if you keep selling solo, the pricing report is still yours. We mean
                  that part.
                </p>
              </div>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S6 · Reviews ──────────────────────────────────────────────────── */}
      {FSBO_LP_REVIEWS.length > 0 ? (
        <section className="border-b border-primary/10 bg-card">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14">
            <ScrollReveal>
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What past sellers say
              </p>
              <ReviewStrip reviews={FSBO_LP_REVIEWS} tone="light" />
            </ScrollReveal>
          </div>
        </section>
      ) : null}

      {/* ─── S7 · FAQ ─────────────────────────────────────────────────────── */}
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <ScrollReveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Quick answers
            </h2>
            <p className="mt-3 text-base leading-relaxed text-foreground/75">
              Or ask a broker directly:{' '}
              <a
                href={`tel:${BROKER_PHONE_TEL}`}
                className="font-semibold tabular-nums text-primary underline underline-offset-4"
              >
                {BROKER_PHONE}
              </a>
            </p>
          </ScrollReveal>
          <Accordion type="single" collapsible className="mt-6 gap-4">
            <FAQ
              value="faq-catch"
              q="What is the catch on the free report?"
              a="There is no condition attached. You get the report whether or not you ever talk to us again. Owners who get an honest number remember where it came from. That is the whole business case."
            />
            <FAQ
              value="faq-pitch"
              q="Will you pressure me to list?"
              a="No. The report arrives by email. If you want to talk it through, you call us. If we think you are positioned to keep selling solo, we will say so."
            />
            <FAQ
              value="faq-accuracy"
              q="How is the number different from my Zillow estimate?"
              a="An online estimate is a model built from tax records. Your report starts from the comparable sales that actually closed near your home, adjusted by a broker for your finishes, lot, and layout. You see the comps behind the number."
            />
            <FAQ
              value="faq-listlater"
              q="What happens if I decide to list later?"
              a="Then it is a normal listing conversation. Commission is negotiable and goes in writing before you sign. Photography, MLS, showings, and transaction management are included. Your pricing report becomes the starting point."
            />
          </Accordion>
        </div>
      </section>

      {/* ─── S8 · Closing band ────────────────────────────────────────────── */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6 sm:py-16">
          <ScrollReveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Sell it yourself, with the right number
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-primary-foreground/85">
              Enter the address. The report lands in your inbox within one business day.
            </p>
          </ScrollReveal>
          <div className="mt-7 text-left">
            <FsboLPForm formId="fsbo-form-closing" />
          </div>
          <p className="mt-5 text-sm text-primary-foreground/75">
            Prefer to talk?{' '}
            <a
              href={`tel:${BROKER_PHONE_TEL}`}
              className="font-semibold underline underline-offset-2 tabular-nums"
            >
              Call {BROKER_PHONE}
            </a>
          </p>
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-4 py-8 pb-24 text-center text-sm text-muted-foreground sm:pb-10">
        <p>
          Ryan Realty · Bend · Oregon ·{' '}
          <a href={`tel:${BROKER_PHONE_TEL}`} className="text-primary underline tabular-nums">
            {BROKER_PHONE}
          </a>
        </p>
        <p className="mt-2">
          Equal Housing Opportunity · © {new Date().getFullYear()} Ryan Realty LLC ·{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy
          </Link>
        </p>
      </footer>

      {/* Exit-intent prompt — desktop-only, once per session. */}
      <ExitIntentPrompt
        headline="Keep the report for later?"
        body="See what Bend homes are actually selling for first. Real closed-sale data, no email required."
        ctaLabel="See the market"
        ctaTarget="/housing-market"
      />

      {/* Sticky mobile CTA bar — pinned to viewport bottom on mobile only. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/15 bg-card/95 px-3 py-3 shadow-md backdrop-blur sm:hidden">
        <div className="flex items-center gap-2">
          <Button asChild className="flex-1 rounded-xl text-sm font-semibold">
            <Link href="#fsbo-form" scroll>
              Get my pricing report
            </Link>
          </Button>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            aria-label={`Call Ryan Realty at ${BROKER_PHONE}`}
            className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-primary text-primary"
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </main>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
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
