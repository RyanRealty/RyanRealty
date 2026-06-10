/**
 * InlineValuationHook — Experience System shared module
 *
 * Quiet navy band CTA: "What is your {name} home worth?"
 * Replaces the generic CTABar at the bottom of Geo archetype pages.
 * Reuses the seller-home-value LP form via a direct link — no embedded form here,
 * just a strong but quiet invitation that respects brand voice.
 *
 * Brand-voice rules applied:
 *   - No em-dash, no semicolons
 *   - No banned words (luxury, premier, stunning, nestled, etc.)
 *   - "You/your" as the subject
 *   - Direct, specific, kind, honest
 *   - No exclamation marks
 */
'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { DisplayHeading, Container } from '@/components/site/primitives'
import { useEngagementTracking } from './useEngagementTracking'

type Props = {
  communityName: string
  /** Overrides the default lede. Keep it honest and direct. */
  lede?: string
  /** Primary CTA href. Default: /lp/seller-home-value */
  primaryHref?: string
  /** Primary CTA label. */
  primaryLabel?: string
  /** Secondary CTA href. Default: /lp/buyer-listing-alerts */
  secondaryHref?: string
  /** Secondary CTA label. */
  secondaryLabel?: string
  sectionId?: string
  className?: string
}

export function InlineValuationHook({
  communityName,
  lede,
  primaryHref = '/lp/seller-home-value',
  primaryLabel = 'Get my home value',
  secondaryHref = '/lp/buyer-listing-alerts',
  secondaryLabel = 'Get listing alerts',
  sectionId = 'valuation-hook',
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { trackInteract } = useEngagementTracking(sectionId, { ref, pageType: 'geo' })

  const defaultLede =
    `A broker prepares a comparative market analysis for your ${communityName} home ` +
    `with recent comparable sales and an honest price range. No cost, no obligation.`

  return (
    <section
      ref={ref}
      id={sectionId}
      aria-labelledby="valuation-hook-heading"
      className={cn('bg-primary py-14 md:py-16', className)}
    >
      <Container>
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/50 mb-3">
            {communityName}
          </p>
          <DisplayHeading
            as="h2"
            id="valuation-hook-heading"
            className="text-white mb-4"
            style={{
              fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
              letterSpacing: '-0.01em',
              lineHeight: 1.18,
            }}
          >
            What is your {communityName} home worth?
          </DisplayHeading>
          <p className="text-white/68 text-base leading-relaxed mb-8 max-w-lg">
            {lede ?? defaultLede}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={primaryHref}
              onClick={() => trackInteract('primary_cta')}
              className={cn(
                'inline-flex items-center px-6 py-3 rounded-xl',
                'bg-background text-primary font-semibold text-sm',
                'hover:bg-white transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
              )}
            >
              {primaryLabel}
            </Link>
            <Link
              href={secondaryHref}
              onClick={() => trackInteract('secondary_cta')}
              className={cn(
                'inline-flex items-center px-6 py-3 rounded-xl',
                'border border-white/28 text-white/88 font-medium text-sm',
                'hover:bg-white/10 hover:text-white transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
              )}
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
