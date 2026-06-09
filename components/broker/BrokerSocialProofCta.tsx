'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { GOOGLE_REVIEWS_URL, TESTIMONIALS } from '@/lib/testimonials'
import { trackCtaClick } from '@/lib/cta-tracking'
import { H2 } from '@/components/site/primitives'

type Props = {
  title?: string
  subtitle?: string
  primaryCtaHref?: string
  primaryCtaLabel?: string
  secondaryCtaHref?: string
  secondaryCtaLabel?: string
  ctaContext?: string
  brokerSlug?: string
}

export default function BrokerSocialProofCta({
  title = 'Trusted in Bend and Central Oregon',
  subtitle = 'Real client reviews, local experience, and clear next steps. Work with a team that protects your equity and keeps your move on track.',
  primaryCtaHref = '/contact?inquiry=Selling',
  primaryCtaLabel = 'Talk to a Broker',
  secondaryCtaHref = '/sell/valuation',
  secondaryCtaLabel = 'Get a Home Valuation',
  ctaContext = 'broker_social_proof',
  brokerSlug,
}: Props) {
  const featured = TESTIMONIALS.slice(0, 3)

  return (
    <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-social-proof-heading">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <H2 id="broker-social-proof-heading" className="text-2xl sm:text-3xl">
              {title}
            </H2>
            <p className="mt-3 text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">5 star service mindset</Badge>
            <Badge variant="secondary">{TESTIMONIALS.length}+ published client reviews</Badge>
            <Badge variant="secondary">Central Oregon local expertise</Badge>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {featured.map((review) => (
            <Card key={`${review.author}-${review.source}`}>
              <CardContent className="p-5">
                <p className="text-sm text-foreground">&ldquo;{review.quote}&rdquo;</p>
                <Separator className="my-4" />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{review.author}</p>
                  <Badge variant="outline">{review.source}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            onClick={() =>
              trackCtaClick({
                label: primaryCtaLabel,
                destination: primaryCtaHref,
                context: ctaContext,
                brokerSlug,
              })
            }
          >
            <Link href={primaryCtaHref}>{primaryCtaLabel}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            onClick={() =>
              trackCtaClick({
                label: secondaryCtaLabel,
                destination: secondaryCtaHref,
                context: ctaContext,
                brokerSlug,
              })
            }
          >
            <Link href={secondaryCtaHref}>{secondaryCtaLabel}</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            onClick={() =>
              trackCtaClick({
                label: 'See Google Reviews',
                destination: GOOGLE_REVIEWS_URL,
                context: ctaContext,
                brokerSlug,
              })
            }
          >
            <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer">
              See Google Reviews
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
