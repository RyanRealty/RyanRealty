// @data-free - static paid-traffic LP (testimonials from lib/testimonials, no DAL fetch); form posts via action
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
 *
 * Styling: KB (kinetic-brutalist) register — navy #102742 on cream #faf8f4,
 * Amboqia display headings via the global font-display class, hard 3px navy
 * edges, no rounded corners, square brutalist framing. Matches the shipped
 * exemplar app/lp/seller-home-value/page.tsx. LPs do NOT carry the .kb-root
 * shell, so the navy/cream values are applied via Tailwind arbitrary values.
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
    <div className="bg-[#faf8f4] text-[#102742]">
      <LandingPageTracker lpVariant="fsbo" />

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

      {/* ─── HERO — warm neighborhood photo, navy scrim, address capture ──── */}
      <section className="relative isolate border-b-[3px] border-[#102742]">
        <Image
          src="/images/lp/hero-pond.jpg"
          alt="A neighborhood pond and homes in Bend, Oregon"
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
            Central Oregon · For sale by owner
          </p>

          {/* H1 — Amboqia display, Title Case (hero only) */}
          <h1 className="mt-4 font-display text-4xl uppercase leading-[0.92] tracking-[-0.01em] text-[#faf8f4] drop-shadow-sm sm:text-5xl lg:text-6xl">
            Selling It Yourself? Smart. Here Is Backup.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#faf8f4] drop-shadow-sm">
            Keep the sale yours. We will tell you what your home should bring, who the buyer
            pool is, and where for-sale-by-owner deals lose money. Free, and you owe us nothing.
          </p>

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

          {/* Address capture — consent disclosure renders inside the form on
              BOTH steps (first-paint HTML, A2P-verified text). */}
          <div className="mt-6 w-full">
            <FsboLPForm heroVariant formId="fsbo-form" />
          </div>

          <p className="mt-4 text-sm text-[#faf8f4]/75 drop-shadow-sm">
            No listing agreement. No pitch call required. The report is yours either way.
          </p>
        </div>
      </section>

      {/* ─── S2 · Honest-respect band ──────────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#102742] text-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-16">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/55">
              The honest read
            </p>
            <p className="mt-4 font-display text-2xl uppercase leading-[0.95] tracking-[-0.01em] sm:text-3xl">
              Plenty of owners sell on their own. The ones who net the most treat it like a
              brokerage would.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S3 · Honest comparison table ──────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              Side by side
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              The honest comparison
            </h2>
            <p className="mt-4 max-w-2xl text-base text-[#102742]/70">
              Each of these is doable on your own. The question is what your weekends are worth
              and where the dollars actually move.
            </p>
          </ScrollReveal>
          <ScrollReveal delayMs={100}>
            {/* Brutalist matrix — hard navy hairlines, no rounded cards. */}
            <div className="mt-8 overflow-hidden border-[3px] border-[#102742]">
              {/* Header row */}
              <div className="grid grid-cols-3 gap-3 border-b-[3px] border-[#102742] bg-[#102742] px-4 py-3 sm:px-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#faf8f4]/70" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#faf8f4]/70">
                  On your own
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#faf8f4]">
                  With Ryan Realty
                </p>
              </div>
              {COMPARISON_ROWS.map((row, i) => (
                <div
                  key={row.criterion}
                  className={
                    i % 2 === 1
                      ? 'grid grid-cols-3 gap-3 bg-[#102742]/[0.04] px-4 py-4 sm:px-6'
                      : 'grid grid-cols-3 gap-3 bg-[#faf8f4] px-4 py-4 sm:px-6'
                  }
                >
                  <p className="text-sm font-semibold text-[#102742]">{row.criterion}</p>
                  <p className="text-sm text-[#102742]/65">{row.solo}</p>
                  <p className="flex items-start gap-2 text-sm font-semibold text-[#102742]">
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
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              No strings
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              What we hand you, free
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-[#102742]/80">
              The same pricing analysis we build for our own listings, for the home you are
              selling yourself. No listing agreement attached, no follow-up condition.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#102742]/70">
              Why free? Because owners who get an honest number remember where it came from.
              Some keep selling solo and do fine. Some call us later. Both are fine outcomes.
            </p>
          </ScrollReveal>
          <ScrollReveal delayMs={100}>
            <div className="mx-auto w-full max-w-sm border-[3px] border-[#102742] bg-[#faf8f4] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#102742]/70">
                Your pricing report
              </p>
              <p className="mt-1 font-display text-xl uppercase leading-[0.95] tracking-[-0.01em] text-[#102742]">
                Built from closed sales, not estimates
              </p>
              <ul className="mt-5 space-y-px border border-[#102742]/20 bg-[#102742]/20">
                {REPORT_CONTENTS.map((item) => (
                  <li key={item} className="flex items-start gap-3 bg-[#faf8f4] px-3 py-3">
                    <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#102742]" />
                    <span className="text-sm leading-relaxed text-[#102742]/85">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S5 · Transition block — commission stated plainly ─────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <ScrollReveal>
            <div className="border-[3px] border-[#102742] bg-[#faf8f4] p-7 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
                When it changes
              </p>
              <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
                If it stops being worth your weekend
              </h2>
              <div className="mt-5 space-y-4 text-base leading-7 text-[#102742]/85">
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
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S6 · Reviews ──────────────────────────────────────────────────── */}
      {FSBO_LP_REVIEWS.length > 0 ? (
        <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
            <ScrollReveal>
              <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
                What past sellers say
              </p>
              <ReviewStrip reviews={FSBO_LP_REVIEWS} tone="light" />
            </ScrollReveal>
          </div>
        </section>
      ) : null}

      {/* ─── S7 · FAQ ─────────────────────────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              Common questions
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              Quick answers
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#102742]/75">
              Or ask a broker directly.{' '}
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

      {/* ─── S8 · Closing navy band — second address capture ──────────────── */}
      <section className="bg-[#102742] text-[#faf8f4]">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/55">
              One field
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] sm:text-4xl">
              Sell it yourself, with the right number
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-[#faf8f4]/85">
              Enter the address. The report lands in your inbox within one business day.
            </p>
          </ScrollReveal>
          <div className="mt-8 text-left">
            <FsboLPForm formId="fsbo-form-closing" />
          </div>
          <p className="mt-6 text-sm text-[#faf8f4]/75">
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

      {/* ─── Mini fine print ─────────────────────────────────────────────── */}
      <footer className="border-t-[3px] border-[#102742] bg-[#102742] pb-24 sm:pb-8">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#faf8f4]/65 sm:px-6">
          <p>
            Ryan Realty LLC · Bend · Oregon ·{' '}
            <a href={`tel:${BROKER_PHONE_TEL}`} className="tabular-nums underline underline-offset-2 hover:text-[#faf8f4]">
              {BROKER_PHONE}
            </a>
          </p>
          <p className="mt-2 normal-case tracking-normal">
            Equal Housing Opportunity ·{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-[#faf8f4]">
              Privacy
            </Link>
            <span className="mx-2">·</span>© {new Date().getFullYear()} Ryan Realty LLC
          </p>
        </div>
      </footer>

      {/* Exit-intent prompt — desktop-only, once per session. */}
      <ExitIntentPrompt
        headline="Keep the report for later?"
        body="See what Bend homes are actually selling for first. Real closed-sale data, no email required."
        ctaLabel="See the market"
        ctaTarget="/housing-market"
      />

      {/* Sticky mobile CTA bar — pinned to viewport bottom on mobile only. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t-[3px] border-[#102742] bg-[#faf8f4] px-3 py-3 sm:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="#fsbo-form"
            scroll
            className="flex-1 border-[3px] border-[#102742] bg-[#102742] px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.1em] text-[#faf8f4]"
          >
            Get my pricing report
          </Link>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            aria-label={`Call Ryan Realty at ${BROKER_PHONE}`}
            className="flex h-12 w-12 items-center justify-center border-[3px] border-[#102742] text-[#102742]"
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </div>
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
