import type { Metadata } from 'next'
import Image from 'next/image'
import LandingPageTracker from '@/components/LandingPageTracker'
import { Card } from '@/components/ui/card'
import BuyerLPForm from './BuyerLPForm'

export const metadata: Metadata = {
  title: 'Find Your Bend Home, Personalized Listing Alerts | Ryan Realty',
  description:
    'Get matched listings in your inbox within 30 minutes. Real local brokers, not an algorithm. No spam, no pressure.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Find Your Bend Home, Personalized Listing Alerts',
    description: 'Get matched listings in your inbox within 30 minutes.',
    type: 'website',
    images: [
      {
        url: '/images/hero/hero-old-mill-master-4k.jpg',
        width: 1920,
        height: 1080,
        alt: 'Old Mill District, Bend, Oregon',
      },
    ],
  },
}

// Paid-traffic / lead-capture surface uses the FUB-tracked dotted number so
// inbound calls route through Follow Up Boss for attribution (CLAUDE.md §3).
const BROKER_PHONE = '541.703.3095'
const BROKER_PHONE_TEL = '+15417033095'

export default function BuyerLPPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <LandingPageTracker lpVariant="buyer-listing-alerts" />

      {/* ─── Hero ─────────────────────────────────────────────────────────
          Brand hero photo (canonical Old Mill District frame) with a navy
          scrim. On mobile the form sits directly under a short headline so
          the submit button is reachable without scrolling at 390px. On
          desktop the form rides the right column next to the copy. */}
      <section className="relative isolate">
        <Image
          src="/images/hero/hero-old-mill-master-4k.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-primary/75" aria-hidden="true" />

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-12 lg:py-16">
          {/* Copy + trust column */}
          <div className="text-card">
            {/* Broker headshot trust element */}
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-card ring-2 ring-card/80 sm:h-16 sm:w-16">
                <Image
                  src="/images/brokers/ryan-matt.png"
                  alt="Matt Ryan, Principal Broker at Ryan Realty"
                  fill
                  sizes="(max-width: 640px) 56px, 64px"
                  className="object-cover object-top"
                  priority
                />
              </div>
              <div>
                <p className="font-display text-base font-semibold leading-tight text-card sm:text-lg">
                  Matt Ryan
                </p>
                <p className="text-xs leading-tight text-card/85 sm:text-sm">
                  Principal Broker · Bend, Oregon
                </p>
              </div>
            </div>

            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-card drop-shadow-sm sm:text-4xl lg:text-5xl">
              Find Your Bend Home. First Matches in 30 Minutes.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-card/90 sm:text-lg">
              Tell us what you&apos;re looking for. A real Ryan Realty broker pulls listings
              that match, within 30 minutes, not the next business day.
            </p>

            {/* Trust line — built on real local sales, not an algorithm */}
            <p className="mt-4 hidden text-sm text-card/85 sm:block">
              Matched by a licensed Bend broker from real local sales. No spam, no pressure.
            </p>
          </div>

          {/* Form column — above the fold on mobile and desktop */}
          <div className="lg:pl-2">
            <Card className="rounded-2xl border-border bg-card p-5 shadow-sm sm:p-7">
              <BuyerLPForm />
            </Card>
          </div>
        </div>
      </section>

      {/* ─── Below-fold reassurance ───────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-10 text-center sm:py-12">
        <p className="text-sm text-muted-foreground">
          Talk to a broker now:{' '}
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            className="font-medium tabular-nums text-primary underline"
          >
            {BROKER_PHONE}
          </a>
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          No spam. No pressure. Unsubscribe anytime. That is a tag in our system that
          stops every email immediately.
        </p>
      </section>
    </main>
  )
}
