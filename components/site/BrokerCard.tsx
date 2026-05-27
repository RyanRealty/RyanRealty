import Image from 'next/image'
import { CTAButton, TextLink } from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import type { Broker } from '@/lib/data/types/broker'

/**
 * Site v2 broker card — renders a Ryan Realty broker (matt-ryan, paul-stevenson,
 * rebecca-ryser-peterson) with the transparent-PNG headshot so the cutout
 * floats over the surrounding surface with no rectangular frame.
 *
 * Per CLAUDE.md "Broker headshots" rule (locked 2026-05-12 + 2026-05-13):
 *   - Use the .png (transparent bg) version — never .jpg
 *   - Never re-create a rectangular frame around the portrait (no bg fill,
 *     no drop-shadow that fakes a frame, no border ring)
 *   - The transparent edge IS the composition
 *
 * Listing-agent rule: resolve the broker from listing fields via
 * lib/data/brokers/resolveListingAgent then pass the Broker to this card.
 * If resolveListingAgent returns null (listing belongs to another brokerage),
 * the calling page should not render a broker card at all.
 *
 * Variants:
 *   default  — broker info + dotted phone + email, for use in TeamSection / contact
 *   compact  — smaller headshot + name + title only, for listing-detail sidebar
 *   featured — adds primary CTA ("Schedule a call"), for team page lead cards
 *
 * Per plan §9 Layer 3.
 */

type BrokerCardVariant = 'default' | 'compact' | 'featured'

type Props = {
  broker: Broker
  variant?: BrokerCardVariant
  /** Override default CTA href on `featured` variant. */
  ctaHref?: string
  /** Override default CTA label on `featured` variant. */
  ctaLabel?: string
  className?: string
}

const HEADSHOT_SIZE: Record<BrokerCardVariant, number> = {
  default: 120,
  compact: 80,
  featured: 160,
}

export function BrokerCard({
  broker,
  variant = 'default',
  ctaHref = '/contact',
  ctaLabel = 'Schedule a call',
  className,
}: Props) {
  const size = HEADSHOT_SIZE[variant]
  const isCompact = variant === 'compact'

  return (
    <div
      className={cn(
        'flex gap-4 items-start',
        variant === 'featured' && 'flex-col sm:flex-row items-center sm:items-start text-center sm:text-left',
        className,
      )}
    >
      <Image
        src={broker.headshotPng}
        alt={broker.fullName}
        width={size}
        height={size * 1.5}
        className="select-none shrink-0"
        priority={variant === 'featured'}
      />
      <div className="flex-1 min-w-0">
        <div className={cn('font-bold tracking-[-0.01em] text-foreground', isCompact ? 'text-base' : 'text-lg')}>
          {broker.fullName}
        </div>
        <div className={cn('text-muted-foreground', isCompact ? 'text-xs' : 'text-sm')}>
          {broker.title}
          {broker.licenseNumber ? (
            <>
              {' '}
              <span className="tabular-nums">#{broker.licenseNumber}</span>
            </>
          ) : null}
        </div>

        {!isCompact && (broker.phoneDirect || broker.email) ? (
          <div className="mt-2 flex flex-col gap-0.5 text-sm">
            {broker.phoneDirect ? (
              <TextLink
                href={`tel:${broker.phoneDirect.replace(/\./g, '')}`}
                underline="never"
                weight="normal"
                className="tabular-nums"
              >
                {broker.phoneDirect}
              </TextLink>
            ) : null}
            {broker.email ? (
              <TextLink
                href={`mailto:${broker.email}`}
                underline="never"
                weight="normal"
                className="break-words"
              >
                {broker.email}
              </TextLink>
            ) : null}
          </div>
        ) : null}

        {variant === 'featured' ? (
          <div className="mt-4">
            <CTAButton href={ctaHref} tone="primary" size="md">
              {ctaLabel}
            </CTAButton>
          </div>
        ) : null}
      </div>
    </div>
  )
}
