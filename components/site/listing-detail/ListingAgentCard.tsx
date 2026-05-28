import { BrokerCard } from '@/components/site/BrokerCard'
import { Body, Eyebrow, Stack } from '@/components/site/primitives'
import type { Broker } from '@/lib/data/types/broker'
import type { ListingDetail } from '@/lib/data/types/listing'

/**
 * Listing-detail ListingAgentCard — wraps the Layer 3 BrokerCard for
 * the listing-detail sidebar.
 *
 * Resolution upstream: callers MUST resolve the broker via
 * resolveListingAgent({ listAgentEmail, listAgentName }) before passing
 * to this component. When the listing belongs to another brokerage,
 * resolveListingAgent returns null and the component renders a small
 * "Listed by <agent>, <office>" line instead of the BrokerCard.
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
  /** Fallback fields when broker is null. */
  listing: Pick<ListingDetail, 'listAgentName' | 'listOfficeName'>
  className?: string
}

export function ListingAgentCard({ broker, listing, className }: Props) {
  if (broker) {
    return (
      <Stack gap="tight" className={className}>
        <Eyebrow>Listing agent</Eyebrow>
        <BrokerCard broker={broker} variant="compact" />
      </Stack>
    )
  }

  if (listing.listAgentName) {
    return (
      <Stack gap="tight" className={className}>
        <Eyebrow>Listed by</Eyebrow>
        <Body size="small" tone="muted">
          <span className="text-foreground font-semibold">{listing.listAgentName}</span>
          {listing.listOfficeName ? <>, {listing.listOfficeName}</> : null}
        </Body>
      </Stack>
    )
  }

  return null
}
