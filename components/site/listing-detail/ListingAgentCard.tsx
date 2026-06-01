import { BrokerCard } from '@/components/site/BrokerCard'
import { Eyebrow, Stack } from '@/components/site/primitives'
import type { Broker } from '@/lib/data/types/broker'
import type { ListingDetail } from '@/lib/data/types/listing'

/**
 * Listing-detail ListingAgentCard — wraps the Layer 3 BrokerCard for
 * the listing-detail sidebar.
 *
 * Resolution upstream: callers MUST resolve the broker via
 * resolveListingAgent({ listAgentEmail, listAgentName }) before passing
 * to this component. When the listing belongs to another brokerage,
 * resolveListingAgent returns null and this component returns null —
 * the "Listing courtesy of <office>" attribution is now rendered by
 * ListingAttribution in the main column (per Matt's direction to move
 * the listed-by text to sit with core listing info, not under the CTA).
 *
 * Per CLAUDE.md broker-headshots rule: BrokerCard uses the transparent
 * PNG. Listing-agent variant is `compact` so the card fits in the
 * sidebar column.
 *
 * Per plan §9 Layer 4.
 */

type Props = {
  /** Resolved Ryan Realty broker, or null when the listing is from another brokerage. */
  broker: Broker | null
  /** Kept in the prop interface for call-site stability; not rendered here
   *  (attribution moved to ListingAttribution in the main column). */
  listing: Pick<ListingDetail, 'listAgentName' | 'listOfficeName'>
  className?: string
}

export function ListingAgentCard({ broker, className }: Props) {
  if (broker) {
    return (
      <Stack gap="tight" className={className}>
        <Eyebrow>Listing agent</Eyebrow>
        <BrokerCard broker={broker} variant="compact" />
      </Stack>
    )
  }

  return null
}
