'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/tracking'

type Props = {
  cityName: string
  slug: string
}

export default function CityCTA({ cityName, slug }: Props) {
  function handleGetNotified() {
    trackEvent('city_cta_click', { cta: 'get_notified', city_name: cityName })
  }

  function handleTalkExpert() {
    trackEvent('city_cta_click', { cta: 'talk_expert', city_name: cityName })
  }

  return (
    <section className="bg-[var(--brand-navy)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="city-cta-heading">
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="city-cta-heading" className="text-2xl font-bold tracking-tight text-white">
          Looking for a Home in {cityName}?
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/account/saved-searches"
            onClick={handleGetNotified}
            className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]"
          >
            Get Notified of New Listings
          </Link>
          <Link
            href="/about"
            onClick={handleTalkExpert}
            className="inline-flex items-center justify-center rounded-lg border-2 border-white/60 px-6 py-3 font-semibold text-white hover:bg-white/10"
          >
            Talk to a Local Expert
          </Link>
        </div>
        <p className="mt-4 text-sm text-white/80">
          Save your search to get alerts when new homes in {cityName} hit the market.
        </p>
      </div>
    </section>
  )
}
