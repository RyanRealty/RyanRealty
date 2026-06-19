import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import ExpiredLPForm from './ExpiredLPForm'
import { CONTACT } from '@/lib/brand/contact'
import { TESTIMONIALS } from '@/lib/testimonials'
import { ReviewStrip } from '@/components/landing/ReviewCard'
import { ExpiredMarketStatStrip } from '@/components/landing/ExpiredMarketStatStrip'
import ExitIntentPrompt from '@/components/landing/ExitIntentPrompt'
import ScrollReveal from '@/components/landing/ScrollReveal'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'

/**
 * Expired Listings Landing Page — /lp/expired-listing
 *
 * Rebuilt to the approved Figma "LP 2 · Expired" spec (tmp/figma-lp-build/
 * BRIEF.md Phase 4), restyled to the KB kinetic-brutalist design system in
 * place to match app/lp/seller-home-value/page.tsx: navy #102742 / cream
 * #faf8f4, Amboqia headings via font-display, hard 3px navy edges, no rounded
 * corners, mono uppercase tracked eyebrow labels, square brutalist framing.
 *
 * The lead form (ExpiredLPForm) + its CAPI/tracking are revenue machinery and
 * are preserved byte-for-byte. Only page presentation changed.
 *
 * Voice: docs/voice_guidelines.md §4.7 — never pander, never editorialize,
 * authentic, honest, transparent, not salesy.
 */
export const metadata: Metadata = {
  title: 'Your Listing Expired. Here Is the Honest Read | Ryan Realty',
  description:
    'A free written audit of your prior listing. Pricing, photos, syndication, agent responsiveness. You get the audit either way, no listing agreement required.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Your listing expired. Here is the honest read.',
    description: 'A free written audit. You get the audit either way.',
    type: 'website',
  },
}

// Dotted format per brand voice spec (CLAUDE.md §3): 541.703.3095
const BROKER_PHONE = CONTACT.phoneFub
const BROKER_PHONE_TEL = CONTACT.phoneFubTel

// Two reviews from verified TESTIMONIALS that resonate for expired-listing
// sellers (seller-side experience, honest guidance, low-pressure).
const EXPIRED_LP_REVIEWS = TESTIMONIALS.filter((t) =>
  ['Gary Timms', 'Doug Millard'].includes(t.author),
)

const FIVE_CAUSES: Array<{ title: string; body: string }> = [
  {
    title: 'Price vs the comps',
    body: 'Most often it is a price thesis that was not backed by the comparable sales in your immediate neighborhood at the time of list. Sometimes it is a drop that came too late. The audit pulls the comps that actually closed while your home was active.',
  },
  {
    title: 'Photography',
    body: 'Listings with rushed photography lose buyers in the first three seconds on Zillow. The audit covers the quality of the photos that ran and whether anything was missing.',
  },
  {
    title: 'Syndication reach',
    body: 'Where the listing actually showed up (Zillow, Realtor.com, Redfin), how often it was updated, and whether it stayed featured or fell to page three. The audit pulls the syndication history.',
  },
  {
    title: 'Showing access',
    body: 'Restrictive showing windows and slow confirmations quietly kill momentum in the first two weeks. The audit looks at how easy your home actually was to see.',
  },
  {
    title: 'Agent communication',
    body: 'Buyer agents reach out. Inquiries come in. The audit covers how quickly and how completely the prior agent engaged the buyer pool. Slow responses cost offers.',
  },
]

const AUDIT_COVERAGE = [
  'Pricing against the comps that closed while your home was active',
  'Photo and staging quality, frame by frame',
  'The MLS description and feature list that ran',
  'Syndication history across Zillow, Realtor.com, and Redfin',
  'Showing access and how inquiries were handled',
]

export default async function ExpiredListingPage() {
  // Live Bend SFR pulse for the re-list market stat strip.
  // Falls back to null gracefully — strip is suppressed when unavailable.
  const bendPulse = await getMarketPulse({ geoType: 'city', geoSlug: 'bend' })

  return (
    <main className="min-h-screen bg-[#faf8f4] text-[#102742]">
      {/* ─── Sticky minimal header — wordmark + phone (KB navy bar) ───────── */}
      <header className="sticky top-0 z-40 border-b-[3px] border-[#102742] bg-[#102742]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
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

      {/* ─── HERO — darker treatment: dusk photo, heavy navy scrim ────────── */}
      <section className="relative isolate border-b-[3px] border-[#102742]">
        <Image
          src="/images/lp/hero-mountain.jpg"
          alt="A snow-capped Cascade peak reflected in a still alpine lake at dusk"
          fill
          priority
          sizes="100vw"
          className="lp-kenburns absolute inset-0 -z-20 object-cover object-center"
        />
        {/* 80% navy scrim per the approved Figma darker-hero treatment. */}
        <div className="absolute inset-0 -z-10 bg-[#102742]/80" aria-hidden="true" />

        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-12">
          {/* Copy column */}
          <div className="text-[#faf8f4]">
            <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/85 drop-shadow-sm">
              <span className="h-[7px] w-[7px] rounded-full bg-[#faf8f4]" aria-hidden="true" />
              Bend · Redmond · Sisters · Central Oregon
            </p>
            <h1 className="mt-4 font-display text-4xl uppercase leading-[0.92] tracking-[-0.01em] text-[#faf8f4] drop-shadow-sm sm:text-5xl">
              Your Listing Expired. Here Is the Honest Read.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#faf8f4]/90 drop-shadow-sm">
              A free written audit of your prior listing. Pricing, photos, syndication, agent
              responsiveness. You get the audit either way, no listing agreement required.
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#faf8f4]/75 drop-shadow-sm">
              Your home was on the market. It did not sell. Most of the time that is not about
              the home. It is about one or two specific things that broke in the way it was
              priced, presented, or marketed. Those are knowable, and they are fixable.
            </p>
          </div>

          {/* Form column — two-step ExpiredLPForm, Matt chip above, step-1
              consent rendered inside the form (first-paint HTML). */}
          <div className="lg:pl-2" id="expired-lp-form">
            <div className="mb-4 flex items-center gap-3 border-[3px] border-[#faf8f4]/40 px-3 py-2">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-[#faf8f4]/40 bg-[#faf8f4]/10 sm:h-14 sm:w-14">
                <Image
                  src="/images/brokers/ryan-matt.png"
                  alt="Matt Ryan, Principal Broker at Ryan Realty"
                  fill
                  sizes="(max-width: 640px) 48px, 56px"
                  className="object-cover object-top"
                  priority
                />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-[#faf8f4]">
                  Matt Ryan
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] leading-tight text-[#faf8f4]/70">
                  Principal broker · Ryan Realty
                </p>
              </div>
            </div>

            <div className="border-[3px] border-[#102742] bg-[#faf8f4] p-6 sm:p-8">
              <ExpiredLPForm />
            </div>
            <p className="mt-4 text-center text-sm text-[#faf8f4]/80 drop-shadow-sm">
              Or call us now:{' '}
              <a
                href={`tel:${BROKER_PHONE_TEL}`}
                className="font-semibold text-[#faf8f4] underline underline-offset-2 tabular-nums"
              >
                {BROKER_PHONE}
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ─── S2 · Empathy band ─────────────────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-14">
          <ScrollReveal>
            <p className="font-display text-2xl uppercase leading-snug tracking-[-0.01em] text-[#102742] sm:text-3xl">
              The market did not reject your home. The strategy missed. Those are different
              problems with different fixes.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S3 · The five reasons listings expire ─────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              The diagnosis
            </p>
            <h2 className="mt-3 font-display text-2xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-3xl">
              The five reasons listings expire
            </h2>
            <p className="mt-3 max-w-2xl text-base text-[#102742]/70">
              We have looked at a lot of expired listings in Central Oregon. Almost every one
              comes down to one or two of these.
            </p>
          </ScrollReveal>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FIVE_CAUSES.map((cause, i) => (
              <ScrollReveal key={cause.title} delayMs={(i % 3) * 75}>
                <div className="h-full border-[3px] border-[#102742] bg-[#faf8f4] p-6">
                  <span className="flex h-10 w-10 items-center justify-center border-[3px] border-[#102742] bg-[#102742] font-display text-base tabular-nums text-[#faf8f4]">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-display text-lg uppercase leading-none tracking-[-0.01em] text-[#102742]">
                    {cause.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#102742]/80">{cause.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── S4 · What your audit covers — checklist + report mock ────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              What you get
            </p>
            <h2 className="mt-3 font-display text-2xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-3xl">
              What your audit covers
            </h2>
            <ul className="mt-6 space-y-4">
              {AUDIT_COVERAGE.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#102742]" />
                  <span className="text-base leading-relaxed text-[#102742]/85">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-[#102742]/70">
              One written page. In your inbox within the business day. If the right call is to
              wait, rent, or hold, the audit says that too.
            </p>
          </ScrollReveal>
          {/* Mini report mock — typographic, honest placeholder slots. */}
          <ScrollReveal delayMs={100}>
            <div className="mx-auto w-full max-w-sm border-[3px] border-[#102742] bg-[#faf8f4] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#102742]/70">
                Listing audit
              </p>
              <p className="mt-1 font-display text-xl uppercase leading-[0.95] tracking-[-0.01em] text-[#102742]">
                Your prior listing, reviewed
              </p>
              <div className="mt-5 space-y-px border border-[#102742]/20 bg-[#102742]/20">
                {['Pricing vs comps', 'Photography', 'Syndication', 'Buyer-agent response'].map(
                  (row) => (
                    <div
                      key={row}
                      className="flex items-center justify-between bg-[#faf8f4] px-3 py-2.5"
                    >
                      <span className="text-sm text-[#102742]/75">{row}</span>
                      <span className="h-2 w-16 bg-[#102742]/15" aria-hidden="true" />
                    </div>
                  ),
                )}
                <div className="bg-[#102742] px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#faf8f4]">
                    The honest recommendation
                  </p>
                  <p className="mt-1 text-xs text-[#faf8f4]/75">
                    Re-list, wait, rent, or hold. Written out, with the reasoning.
                  </p>
                </div>
              </div>
              <p className="mt-3 text-right text-[11px] text-[#102742]/70">
                Sample layout · your audit carries your listing
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S5 · Re-list proof — live market strip + verified reviews ────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14">
          {bendPulse ? (
            <ScrollReveal>
              <ExpiredMarketStatStrip pulse={bendPulse} />
            </ScrollReveal>
          ) : null}
          {EXPIRED_LP_REVIEWS.length > 0 ? (
            <ScrollReveal className="mt-8 border-t-[3px] border-[#102742] pt-10">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
                What past sellers say
              </p>
              <ReviewStrip reviews={EXPIRED_LP_REVIEWS} tone="light" />
            </ScrollReveal>
          ) : null}
        </div>
      </section>

      {/* ─── S6 · Broker letter block ──────────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <ScrollReveal>
            <div className="border-[3px] border-[#102742] bg-[#faf8f4] p-7 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
                From the broker
              </p>
              <h2 className="mt-3 font-display text-2xl uppercase leading-snug tracking-[-0.01em] text-[#102742] sm:text-3xl">
                If you decide to list again, we would like to earn your business.
              </h2>
              <div className="mt-5 space-y-4 text-base leading-7 text-[#102742]/85">
                <p>
                  An honest re-list starts with a written price thesis and the comps that
                  support it. You see the math. If the prior photo set needs work, we tell you
                  which photos to redo and why. The MLS description gets written from what your
                  home actually offers, not boilerplate.
                </p>
                <p>
                  Then you get weekly written progress reports. Every showing, every inquiry,
                  every comment from buyer agents. Every offer reviewed with you in writing,
                  with the price, terms, contingencies, and what we would counter.
                </p>
                <p>
                  And if the audit says the right move is to wait, rent, or hold, we will tell
                  you that. We are not the right partner for you if you do not actually need
                  one right now.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-4 border-t-[3px] border-[#102742] pt-6">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden border-[3px] border-[#102742] bg-[#102742]/5">
                  <Image
                    src="/images/brokers/ryan-matt.png"
                    alt="Matt Ryan"
                    fill
                    sizes="56px"
                    className="object-cover object-top"
                  />
                </div>
                <div>
                  <p className="font-display text-xl uppercase leading-none tracking-[-0.01em] text-[#102742]">Matt Ryan</p>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#102742]/65">
                    Principal broker · Ryan Realty · Bend, Oregon
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S7 · FAQ ─────────────────────────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              Common questions
            </p>
            <h2 className="mt-3 font-display text-2xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-3xl">
              Quick answers
            </h2>
          </ScrollReveal>
          <Accordion type="single" collapsible className="mt-6 gap-4">
            <FAQ
              value="faq-time"
              q="How long does this take?"
              a="The audit lands in your inbox within the business day. The call is 20 minutes. The walkthrough takes as long as you want to spend on it."
            />
            <FAQ
              value="faq-cost"
              q="What does it cost?"
              a="The audit is free. So is the call. So is the walkthrough. You owe us nothing."
            />
            <FAQ
              value="faq-list"
              q="Do I have to list with you to get the audit?"
              a="No. You get the audit either way. We would rather you have honest information than feel cornered into a listing agreement."
            />
            <FAQ
              value="faq-notready"
              q="What if I am not ready to re-list yet?"
              a="We are not the right partner if you do not actually need one. The audit still gives you a picture of what would need to change before you decide."
            />
          </Accordion>
        </div>
      </section>

      {/* ─── S8 · Closing band ────────────────────────────────────────────── */}
      <section className="bg-[#102742] text-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-16">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/55">
              One written page
            </p>
            <h2 className="mt-3 font-display text-2xl uppercase leading-[0.92] tracking-[-0.01em] sm:text-3xl">
              Get the honest read on your listing
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-[#faf8f4]/85">
              One written page. No pitch attached. You decide what happens next.
            </p>
          </ScrollReveal>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="#expired-lp-form"
              scroll
              className="inline-flex h-14 items-center justify-center border-[3px] border-[#faf8f4] bg-[#faf8f4] px-7 text-lg font-bold uppercase tracking-[0.1em] text-[#102742] transition-colors hover:bg-transparent hover:text-[#faf8f4]"
            >
              Get my free audit
            </Link>
            <a
              href={`tel:${BROKER_PHONE_TEL}`}
              className="inline-flex h-14 items-center justify-center border-[3px] border-[#faf8f4]/40 px-7 text-lg font-semibold text-[#faf8f4] transition-colors hover:border-[#faf8f4]"
            >
              <span className="tabular-nums">Call {BROKER_PHONE}</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t-[3px] border-[#102742] bg-[#102742] pb-24 sm:pb-8">
        <div className="mx-auto max-w-3xl px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#faf8f4]/65 sm:px-6">
          <p>
            Ryan Realty · Bend · Oregon ·{' '}
            <a href={`tel:${BROKER_PHONE_TEL}`} className="underline underline-offset-2 tabular-nums hover:text-[#faf8f4]">
              {BROKER_PHONE}
            </a>
          </p>
          <p className="mt-2 normal-case tracking-normal">
            Equal Housing Opportunity · © {new Date().getFullYear()} Ryan Realty LLC
          </p>
        </div>
      </footer>

      {/* Exit-intent prompt — desktop-only, once per session. */}
      <ExitIntentPrompt
        headline="Want the audit without a conversation?"
        body="It lands in your inbox, no call attached. Enter your address above and we will send it over."
        ctaLabel="Get my free audit"
        ctaTarget="#expired-lp-form"
      />

      {/* Sticky mobile CTA bar — pinned to viewport bottom on mobile only. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t-[3px] border-[#102742] bg-[#faf8f4] px-3 py-3 sm:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="#expired-lp-form"
            scroll
            className="flex-1 border-[3px] border-[#102742] bg-[#102742] px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.1em] text-[#faf8f4]"
          >
            Get my free audit
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
