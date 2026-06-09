'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { trackCtaClick } from '@/lib/cta-tracking'
import { H2 } from '@/components/site/primitives'

type Props = {
  cityName: string
  slug: string
}

export default function CityCTA({ cityName, slug }: Props) {
  function handleGetNotified() {
    trackCtaClick({
      label: 'Get Notified of New Listings',
      destination: '/account/saved-searches',
      context: `city_cta:${slug}`,
    })
  }

  function handleTalkExpert() {
    trackCtaClick({
      label: 'Talk to a Local Expert',
      destination: '/about',
      context: `city_cta:${slug}`,
    })
  }

  return (
    <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="city-cta-heading">
      <div className="mx-auto max-w-3xl text-center">
        <H2 id="city-cta-heading" className="text-2xl text-primary-foreground">
          Looking for a Home in {cityName}?
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
          Save your search to get alerts when new homes in {cityName} hit the market.
        </p>
      </div>
    </section>
  )
}
