'use client'

/**
 * Listing-detail broker CTA. ONE card, ONE style, ONE location — the
 * TextMattCTA "Talk to a broker / Questions about this home?" card.
 *
 * Identity is the server-resolved default (listing agent, else principal).
 * An inbound attribution cookie may replace that default. Random assignment
 * is gone: it put Rebecca on desktop and Paul on phone for the same home.
 * The quote is rematched to the face on the card.
 */
import { useEffect, useMemo, useState } from 'react'
import { TextMattCTA } from './TextMattCTA'
import ListingMobileContactBar from './ListingMobileContactBar.client'
import type { Broker } from '@/lib/data/types/broker'
import type { ReviewsSummary } from '@/lib/data/reviews/getReviews'
import {
  publishListingBrokerProof,
  resolveListingPageBroker,
} from '@/lib/listing/publish-listing-broker-proof'

function readAttributedSlug(): string | null {
  try {
    const raw = document.cookie
      .split('; ')
      .find((c) => c.startsWith('rr_agent_attribution='))
      ?.split('=')
      .slice(1)
      .join('=')
    if (!raw) return null
    const parsed = JSON.parse(decodeURIComponent(raw)) as { slug?: string }
    return (parsed.slug ?? '').toLowerCase().trim() || null
  } catch {
    return null
  }
}

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
   *  home — keep them as the contact; do not swap an attribution cookie over them. */
  lockToDefault?: boolean
}) {
  const [broker, setBroker] = useState<Broker>(defaultBroker)

  useEffect(() => {
    setBroker(
      resolveListingPageBroker({
        defaultBroker,
        brokers,
        attributedSlug: readAttributedSlug(),
        lockToDefault,
      }),
    )
  }, [brokers, defaultBroker, lockToDefault])

  const proof = useMemo(
    () => publishListingBrokerProof({ broker, brokers, reviews }),
    [broker, brokers, reviews],
  )

  return (
    <>
      <TextMattCTA broker={broker} listingKey={listingKey} reviews={proof} className={className} />
      {/* Always-reachable mobile bar (hidden on lg+ via CSS) — replaces the CRM
          floating widget; shows the same attributed broker as the card. */}
      <ListingMobileContactBar broker={broker} listingKey={listingKey} />
    </>
  )
}
