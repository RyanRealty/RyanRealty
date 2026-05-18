import type { Metadata } from 'next'
import ExpiredLPForm from './ExpiredLPForm'

/**
 * Expired Listings Landing Page — /lp/expired-listing
 *
 * Page structure per docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md
 * task 2 §recommended page structure:
 *   1. Hero — name the situation, set up the free diagnostic
 *   2. The 5 things that usually broke — price, photos, MLS desc, syndication, agent responsiveness
 *   3. What an honest re-list looks like at Ryan Realty
 *   4. When re-list ISN'T the right move
 *   5. CTA block — 3 paths
 *   6. Short FAQ
 *
 * Voice: docs/voice_guidelines.md §4.7 — never pander, never editorialize,
 * authentic, honest, transparent, not salesy. The hero block below is the
 * brand-voice-compliant draft from the research doc, lightly edited.
 */
export const metadata: Metadata = {
  title: 'Your listing expired — here\'s an honest read on what to do next | Ryan Realty',
  description:
    'A free written audit of your prior listing. Pricing, photos, MLS description, syndication, agent responsiveness. We tell you what actually broke. You decide what to do next.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Your listing expired — here\'s an honest read on what to do next',
    description: 'A free written audit. You get the audit either way.',
    type: 'website',
  },
}

const BROKER_PHONE = '(541) 703-3095'
const BROKER_PHONE_TEL = '+15417033095'

export default function ExpiredListingPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pt-12 pb-8 sm:pt-16">
        <div>
          <p className="text-sm font-medium text-muted-foreground">For Bend, Redmond, Sisters, and Central Oregon homeowners.</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Your listing expired. Here&apos;s an honest read on what to do next.
          </h1>
          <div className="mt-6 space-y-4 text-base leading-7 text-foreground/80">
            <p>
              Your home was on the market. It didn&apos;t sell. The listing came down, the sign is gone, and the offers you were expecting never came in. That&apos;s a real outcome to sit with.
            </p>
            <p>
              Most of the time, an expired listing is not about the home. It&apos;s about one or two specific things that broke in the way it was priced, presented, or marketed. Sometimes it&apos;s three. The good news is that those are knowable, and they&apos;re fixable.
            </p>
            <p>
              We do a free diagnostic on every expired listing in Bend, Redmond, Sisters, and the surrounding area. It&apos;s a written one-page audit of your prior listing covering pricing against the comparable sales in your neighborhood at the time, photo and staging quality, the MLS description, where it was syndicated and how often it was updated, and how the agent actually engaged with the buyer pool. You get the audit either way, whether or not you re-list with us.
            </p>
            <p>
              If the audit says the right move is to wait, rent, or hold, we&apos;ll tell you that. If it says re-list, we&apos;ll walk you through what would change, what it would cost, and what the realistic timeline looks like.
            </p>
            <p className="font-medium">No pressure. No long pitch. A 20-minute conversation, on the phone or in person.</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <ExpiredLPForm />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Or call us now:{' '}
          <a href={`tel:${BROKER_PHONE_TEL}`} className="font-medium text-primary underline">
            {BROKER_PHONE}
          </a>
        </p>
      </section>

      {/* ─── The 5 things that usually broke ───────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-12 border-t border-border">
        <h2 className="text-2xl font-semibold tracking-tight">The five things that usually broke</h2>
        <p className="mt-3 text-muted-foreground">
          We&apos;ve looked at a lot of expired listings in Central Oregon. Almost every one comes down to one or two of these.
        </p>
        <div className="mt-8 space-y-6">
          <div>
            <h3 className="font-semibold">Price</h3>
            <p className="mt-2 text-foreground/80">
              Most often it&apos;s a price thesis that wasn&apos;t backed by the specific comparable sales in your immediate neighborhood at the time of list. Sometimes it&apos;s a drop that came too late. The audit pulls the comps that actually closed in your area in the window your home was active.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Photos and staging</h3>
            <p className="mt-2 text-foreground/80">
              Listings with rushed photography lose buyers in the first three seconds on Zillow. The audit covers the quality of the photos that ran and whether anything was missing.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">The MLS description</h3>
            <p className="mt-2 text-foreground/80">
              The MLS description is what the buyer&apos;s agent reads first. Generic copy or copy that misses what your home actually offers costs showings. The audit reviews what was written.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Syndication and exposure</h3>
            <p className="mt-2 text-foreground/80">
              Where the listing actually showed up (Zillow, Realtor.com, Redfin), how often it was updated, and whether it stayed featured or fell to page three. The audit pulls the syndication history.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Agent responsiveness</h3>
            <p className="mt-2 text-foreground/80">
              Buyer&apos;s agents reach out. Inquiries come in. The audit covers how quickly and how completely the prior agent engaged the buyer pool. Slow responses cost offers.
            </p>
          </div>
        </div>
      </section>

      {/* ─── What an honest re-list looks like ─────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-12 border-t border-border">
        <h2 className="text-2xl font-semibold tracking-tight">What an honest re-list looks like with us</h2>
        <p className="mt-3 text-muted-foreground">
          This isn&apos;t a pitch. It&apos;s a description.
        </p>
        <ul className="mt-6 space-y-3 text-foreground/80">
          <li className="flex gap-3">
            <span className="text-primary">·</span>
            <span>A written price thesis with the comps that support it. You see the math.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary">·</span>
            <span>Photography and staging plan if the prior set needs work. We tell you which photos to redo and why.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary">·</span>
            <span>An MLS description and feature list written from your home&apos;s actual differentiators, not boilerplate.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary">·</span>
            <span>Weekly written progress reports. Every showing, every inquiry, every comment we get from buyer&apos;s agents.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary">·</span>
            <span>Every offer reviewed with you in writing, with the price, terms, contingencies, and what we&apos;d counter.</span>
          </li>
        </ul>
      </section>

      {/* ─── When re-list isn't the right move ─────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-12 border-t border-border">
        <h2 className="text-2xl font-semibold tracking-tight">Sometimes re-listing isn&apos;t the right move</h2>
        <p className="mt-3 text-foreground/80">
          If the audit shows the right call is to wait, rent, or hold, we&apos;ll say that. We&apos;re not the right partner for you if you don&apos;t actually need one right now.
        </p>
      </section>

      {/* ─── CTA + FAQ ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-12 border-t border-border">
        <h2 className="text-2xl font-semibold tracking-tight">Three ways to start</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="font-semibold">Free written audit</p>
            <p className="mt-2 text-sm text-foreground/80">
              One-page review of the prior listing. In your inbox within the business day. No commitment.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="font-semibold">20-minute call</p>
            <p className="mt-2 text-sm text-foreground/80">
              On the phone, no pitch. We tell you what we&apos;d do differently if anything.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="font-semibold">In-person walkthrough</p>
            <p className="mt-2 text-sm text-foreground/80">
              We come to the property, walk it with you, and bring comps for your block.
            </p>
          </div>
        </div>

        <div className="mt-10">
          <h3 className="text-xl font-semibold tracking-tight">Quick answers</h3>
          <div className="mt-6 space-y-5">
            <div>
              <p className="font-semibold">How long does this take?</p>
              <p className="mt-2 text-foreground/80">The audit lands in your inbox within the business day. The call is 20 minutes. The walkthrough takes about an hour.</p>
            </div>
            <div>
              <p className="font-semibold">What does it cost?</p>
              <p className="mt-2 text-foreground/80">The audit is free. So is the call. So is the walkthrough. You owe us nothing.</p>
            </div>
            <div>
              <p className="font-semibold">Do I have to list with you to get the audit?</p>
              <p className="mt-2 text-foreground/80">No. You get the audit either way. We&apos;d rather you have honest information than feel cornered into a listing agreement.</p>
            </div>
            <div>
              <p className="font-semibold">What if I&apos;m not ready to re-list yet?</p>
              <p className="mt-2 text-foreground/80">We&apos;re not the right partner if you don&apos;t actually need one. The audit still gives you a picture of what would need to change before you decide.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-4 pb-12 text-center text-sm text-muted-foreground">
        <p>
          Ryan Realty · Bend, Oregon ·{' '}
          <a href={`tel:${BROKER_PHONE_TEL}`} className="text-primary underline">
            {BROKER_PHONE}
          </a>
        </p>
      </footer>
    </main>
  )
}
