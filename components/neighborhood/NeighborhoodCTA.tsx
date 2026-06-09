'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { trackCtaClick } from '@/lib/cta-tracking'
import { H2 } from '@/components/site/primitives'

type Props = {
  neighborhoodName: string
  cityName: string
  citySlug: string
}

export default function NeighborhoodCTA({ neighborhoodName, cityName, citySlug }: Props) {
  function handleGetNotified() {
    trackCtaClick({
      label: 'Get Notified of New Listings',
      destination: '/account/saved-searches',
      context: `neighborhood_cta:${citySlug}`,
    })
  }

  function handleTalkExpert() {
    trackCtaClick({
      label: 'Talk to a Local Expert',
      destination: '/about',
      context: `neighborhood_cta:${citySlug}`,
    })
  }

  return (
    <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="neighborhood-cta-heading">
      <div className="mx-auto max-w-3xl text-center">
        <H2 id="neighborhood-cta-heading" className="text-2xl text-primary-foreground">
          Looking for a Home in {neighborhoodName}?
        </H2>
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
        <p className="mt-4 text-sm text-primary-foreground/80">
          Save your search to get alerts when new homes in {neighborhoodName} or {cityName} hit the market.
        </p>
        <p className="mt-2">
          <Link
            href={`/cities/${citySlug}`}
            className="text-sm text-accent-foreground hover:underline"
            onClick={() =>
              trackCtaClick({
                label: `View all ${cityName} neighborhoods`,
                destination: `/cities/${citySlug}`,
                context: `neighborhood_cta:${citySlug}`,
              })
            }
          >
            View all {cityName} neighborhoods
          </Link>
        </p>
      </div>
    </section>
  )
}
