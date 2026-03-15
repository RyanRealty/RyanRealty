'use client'

import Link from 'next/link'
import type { BrokerRow } from '@/app/actions/brokers'
import { Button } from '@/components/ui/button'
import BrokerCardCarousel from './BrokerCardCarousel'

type Props = {
  /** CTA heading, e.g. "Looking for a Home in Bend?" */
  heading: string
  /** Short supporting text below buttons */
  supportingText?: string
  /** Primary CTA */
  primaryCta: { label: string; href: string }
  /** Secondary CTA */
  secondaryCta?: { label: string; href: string }
  brokers: BrokerRow[]
}

/** CTA section with content left and broker card carousel right (like listing detail layout). */
export default function GeoCTAWithBroker({
  heading,
  supportingText,
  primaryCta,
  secondaryCta,
  brokers,
}: Props) {
  return (
    <section className="bg-primary px-4 py-8 sm:px-6 sm:py-12 lg:px-8" aria-labelledby="geo-cta-heading">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
          <div className="lg:col-span-2 flex flex-col justify-center">
            <h2 id="geo-cta-heading" className="text-2xl font-bold tracking-tight text-primary-foreground">
              {heading}
            </h2>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button
                asChild
              >
                <Link href={primaryCta.href}>
                  {primaryCta.label}
                </Link>
              </Button>
              {secondaryCta && (
                <Button
                  asChild
                  variant="outline"
                >
                  <Link href={secondaryCta.href}>
                    {secondaryCta.label}
                  </Link>
                </Button>
              )}
            </div>
            {supportingText && (
              <p className="mt-4 text-sm text-primary-foreground/80">{supportingText}</p>
            )}
          </div>
          <div className="lg:col-span-1">
            <BrokerCardCarousel brokers={brokers} />
          </div>
        </div>
      </div>
    </section>
  )
}
