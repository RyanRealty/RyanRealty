import { BrokerCard } from '@/components/site/BrokerCard'
import { cn } from '@/lib/utils'
import type { Broker } from '@/lib/data/types/broker'
import type { ListingDetail } from '@/lib/data/types/listing'

/**
 * Listing-detail ListingAgentCard — KB-styled sidebar card.
 * Navy border, eyebrow label, BrokerCard compact variant.
 *
 * Resolution upstream: callers resolve the broker via resolveListingAgent
 * before passing to this component. Null broker = null render.
 *
 * Per plan §9 Layer 4.
 */

type Props = {
  broker: Broker | null
  listing: Pick<ListingDetail, 'listAgentName' | 'listOfficeName'>
  className?: string
}

export function ListingAgentCard({ broker, className }: Props) {
  if (!broker) return null

  return (
    <div
      className={cn(className)}
      style={{
        border: '3px solid var(--navy, #102742)',
        background: 'var(--cream, #faf8f4)',
        padding: '18px 20px',
      }}
    >
      <div
        className="eyebrow"
        style={{
          fontSize: '0.62rem',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(16,39,66,0.55)',
          marginBottom: 14,
        }}
      >
        Listing agent
      </div>
      <BrokerCard broker={broker} variant="compact" />
    </div>
  )
}
