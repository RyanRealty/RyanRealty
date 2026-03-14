'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
    <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="city-cta-heading">
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="city-cta-heading" className="text-2xl font-bold tracking-tight text-white">
          Looking for a Home in {cityName}?
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button
            asChild
            onClick={handleGetNotified}
          >
            <Link href="/account/saved-searches">
              Get Notified of New Listings
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            onClick={handleTalkExpert}
          >
            <Link href="/about">
              Talk to a Local Expert
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-white/80">
          Save your search to get alerts when new homes in {cityName} hit the market.
        </p>
      </div>
    </section>
  )
}
