import Image from 'next/image'
import type { Broker } from '@/lib/data/types/broker'

/**
 * Compact broker row near the top of the listing Sheet (390). Desktop
 * Schedule lives on the sidebar card, so this row hides from lg up.
 */
export function ListingBrokerCompact({ broker }: { broker: Broker }) {
  const firstName = broker.fullName.split(/\s+/)[0]
  return (
    <div className="listing-broker-compact">
      <Image
        src={broker.headshotPng}
        alt={broker.fullName}
        width={44}
        height={44}
        className="listing-broker-compact-photo"
      />
      <div className="listing-broker-compact-copy">
        <p className="listing-broker-compact-label">Your broker</p>
        <p className="listing-broker-compact-name">{firstName}</p>
      </div>
    </div>
  )
}
