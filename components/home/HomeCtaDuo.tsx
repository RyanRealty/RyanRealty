'use client'

/**
 * Home page CTA duo. Satisfies SITE_SPEC line 69.
 *
 *   - Tile 1: Buyer listing alerts → /lp/buyer-listing-alerts
 *   - Tile 2: Seller home value    → /lp/seller-home-value
 *
 * Both tiles fire `click_cta` via trackCtaClick so attribution lands in GA4
 * and the marketing brain audit (see lib/cta-tracking.ts). No modal popup
 * paywall. Both CTAs go straight to the LP.
 *
 * Voice: sentence case, no banned words, "you/your" subject, period or
 * comma instead of em-dashes (CLAUDE.md §0.6 brand voice).
 */

import Link from 'next/link'
import { trackCtaClick } from '@/lib/cta-tracking'

export default function HomeCtaDuo() {
  return (
    <section
      className="border-b border-border bg-card px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="home-cta-duo-heading"
    >
      <div className="mx-auto max-w-7xl">
        <h2 id="home-cta-duo-heading" className="sr-only">
          Get matched with new listings or find out what your home is worth
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Buyer listing alerts LP */}
          <div className="rounded-xl border border-border bg-background p-6 shadow-sm sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Get the new listings first
            </h3>
            <p className="mt-2 text-muted-foreground">
              Tell us what you are looking for and we will send the homes that fit, the day they hit the market. No spam, no pressure.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/lp/buyer-listing-alerts"
                onClick={() =>
                  trackCtaClick({
                    label: 'Set up listing alerts',
                    destination: '/lp/buyer-listing-alerts',
                    context: 'home_cta_duo',
                  })
                }
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Set up listing alerts
              </Link>
              <Link
                href="/homes-for-sale"
                onClick={() =>
                  trackCtaClick({
                    label: 'Browse listings',
                    destination: '/homes-for-sale',
                    context: 'home_cta_duo',
                  })
                }
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Browse listings
              </Link>
            </div>
          </div>

          {/* Seller home value LP */}
          <div className="rounded-xl border border-border bg-background p-6 shadow-sm sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 12l9-9 9 9" />
                <path d="M5 10v10h14V10" />
                <path d="M9 21v-6h6v6" />
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Find out what your home is worth
            </h3>
            <p className="mt-2 text-muted-foreground">
              Get a real-market valuation from a Ryan Realty broker who lives and works in your neighborhood. Comps, condition, and timing, no obligation.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/lp/seller-home-value"
                onClick={() =>
                  trackCtaClick({
                    label: 'Get your home value',
                    destination: '/lp/seller-home-value',
                    context: 'home_cta_duo',
                  })
                }
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Get your home value
              </Link>
              <Link
                href="/sell"
                onClick={() =>
                  trackCtaClick({
                    label: 'See our seller plan',
                    destination: '/sell',
                    context: 'home_cta_duo',
                  })
                }
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                See our seller plan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
