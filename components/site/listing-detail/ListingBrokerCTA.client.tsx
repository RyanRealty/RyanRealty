'use client'

/**
 * Listing-detail broker CTA. ONE card, ONE style, ONE location — the
 * TextMattCTA "Talk to a broker / Questions about this home?" card. The only
 * thing that changes is WHOSE contact it shows:
 *
 *   - Lead has been assigned to a broker (arrived via that broker's CRM link or
 *     ad → rr_agent_attribution cookie): the card shows THAT broker's contact.
 *   - No assignment: the card shows the default principal broker.
 *
 * It never says "your broker" and never changes shape based on assignment, so a
 * visitor cannot tell from the layout whether they have been attributed. The
 * cookie is read client-side so static / ISR listing pages stay static; the card
 * SSRs with the default broker and swaps in place after hydration if attributed.
 *
 * THE MOBILE BAR LEFT THIS FILE (2026-09-02). It rendered here, inside the
 * aside, and an aside that is `display: none` below 64rem takes its fixed
 * children with it — the bar measured 0px high at 390, 1024 and 1440. It is
 * ListingBrokerBar now, mounted in the shell's floating slot; both read
 * useAttributedBroker so they show the same person.
 */
import { TextMattCTA } from './TextMattCTA'
import { useAttributedBroker } from './use-attributed-broker'
import type { Broker } from '@/lib/data/types/broker'
import type { ReviewsSummary } from '@/lib/data/reviews/getReviews'

export default function ListingBrokerCTA({
  defaultBroker,
  brokers,
  listingKey,
  reviews,
  className,
  lockToDefault = false,
}: {
  defaultBroker: Broker
  brokers: Broker[]
  listingKey: string
  /** Brokerage Google reviews for the desktop card's lg-only social-proof block. */
  reviews?: ReviewsSummary | null
  className?: string
  /** True when defaultBroker is the resolved Ryan Realty listing agent for THIS
   *  home — keep them as the contact; never random-reassign over them. */
  lockToDefault?: boolean
}) {
  // assign: true — the card owns the sticky assignment for an unattributed
  // visitor, and the bar reads the cookie it writes.
  const broker = useAttributedBroker({ defaultBroker, brokers, lockToDefault, assign: true })

  return (
    <TextMattCTA
      broker={broker}
      listingKey={listingKey}
      reviews={reviews}
      className={['listing-broker-card', className].filter(Boolean).join(' ')}
    />
  )
}
