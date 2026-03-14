'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/tracking'

type Props = {
  neighborhoodName: string
  cityName: string
  citySlug: string
}

export default function NeighborhoodCTA({ neighborhoodName, cityName, citySlug }: Props) {
  function handleGetNotified() {
    trackEvent('click_cta', { cta: 'get_notified', context: 'neighborhood', neighborhood_name: neighborhoodName, city_name: cityName })
  }

  function handleTalkExpert() {
    trackEvent('click_cta', { cta: 'talk_expert', context: 'neighborhood', neighborhood_name: neighborhoodName, city_name: cityName })
  }

  return (
    <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="neighborhood-cta-heading">
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="neighborhood-cta-heading" className="text-2xl font-bold tracking-tight text-white">
          Looking for a Home in {neighborhoodName}?
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
          Save your search to get alerts when new homes in {neighborhoodName} or {cityName} hit the market.
        </p>
        <p className="mt-2">
          <Link href={`/cities/${citySlug}`} className="text-sm text-accent-foreground hover:underline">
            View all {cityName} neighborhoods
          </Link>
        </p>
      </div>
    </section>
  )
}
