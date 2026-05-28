import {
  Body,
  CTAButton,
  Eyebrow,
  H3,
  Stack,
} from '@/components/site/primitives'
import { BrokerCard } from '@/components/site/BrokerCard'
import type { Broker } from '@/lib/data/types/broker'

/**
 * Listing-detail TextMattCTA — sidebar CTA card for the listing-detail
 * page. Pairs a broker portrait (compact BrokerCard) with a phone +
 * email + "Schedule a tour" button.
 *
 * Per plan §9 Layer 4. Per CLAUDE.md brand voice: the copy stays direct
 * + specific (no marketing slop). The CTA defaults to "Schedule a tour"
 * with an href to /contact?listingKey=<key> so the contact form lands
 * pre-tagged with the listing context.
 *
 * Defaults to Matt Ryan when no broker passed — the homepage and team
 * pages would override per-context. Pass a different Broker to swap
 * the listing-side contact to Paul or Rebecca.
 *
 * No copy uses "approximately", "about" (vague qualifier), "stunning",
 * em-dash, or any other §6.1 / §6.2 banned token.
 */

type Props = {
  broker: Broker
  listingKey: string
  /** Override the default headline. */
  headline?: string
  /** Override the default body line. */
  body?: string
  /** Override the default primary CTA. */
  primaryCta?: { href: string; label: string }
  className?: string
}

export function TextMattCTA({
  broker,
  listingKey,
  headline,
  body,
  primaryCta,
  className,
}: Props) {
  const tourHref = primaryCta?.href ?? `/contact?listingKey=${encodeURIComponent(listingKey)}`
  const tourLabel = primaryCta?.label ?? 'Schedule a tour'
  const textHref = broker.phoneFub
    ? `sms:${broker.phoneFub.replace(/\./g, '')}`
    : broker.phoneDirect
    ? `sms:${broker.phoneDirect.replace(/\./g, '')}`
    : null

  return (
    <Stack
      gap="default"
      className={`bg-card border border-border rounded-[14px] p-6 shadow-sm ${className ?? ''}`}
    >
      <Eyebrow>Talk to a broker</Eyebrow>
      <H3>{headline ?? 'Questions about this home?'}</H3>
      <Body size="small" tone="muted" className="leading-[1.55]">
        {body ?? 'Tour requests usually get a same-day reply. No pressure, no obligation.'}
      </Body>

      <BrokerCard broker={broker} variant="compact" />

      <div className="flex flex-col gap-2 pt-2">
        <CTAButton href={tourHref} tone="primary" size="md">
          {tourLabel}
        </CTAButton>
        {textHref ? (
          <CTAButton href={textHref} tone="outline" size="md" external>
            Text {broker.fullName.split(/\s+/)[0]}
          </CTAButton>
        ) : null}
      </div>
    </Stack>
  )
}
