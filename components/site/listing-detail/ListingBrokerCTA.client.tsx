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
 */
import { useEffect, useState } from 'react'
import { TextMattCTA } from './TextMattCTA'
import type { Broker } from '@/lib/data/types/broker'

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

/** Match a cookie attribution slug (matt / matt-ryan / rebecca / paul / …) to a
 *  real broker row, tolerant of the slug variants the attribution links use. */
function matchBroker(slug: string, brokers: Broker[]): Broker | null {
  const s = slug.toLowerCase()
  return (
    brokers.find((b) => {
      const bs = b.slug.toLowerCase()
      return bs === s || bs.includes(s) || s.includes(bs.split('-')[0])
    }) ?? null
  )
}

export default function ListingBrokerCTA({
  defaultBroker,
  brokers,
  listingKey,
  className,
}: {
  defaultBroker: Broker
  brokers: Broker[]
  listingKey: string
  className?: string
}) {
  const [broker, setBroker] = useState<Broker>(defaultBroker)

  useEffect(() => {
    const slug = readAttributedSlug()
    if (!slug) return
    const match = matchBroker(slug, brokers)
    if (match && match.slug !== defaultBroker.slug) setBroker(match)
  }, [brokers, defaultBroker])

  return <TextMattCTA broker={broker} listingKey={listingKey} className={className} />
}
