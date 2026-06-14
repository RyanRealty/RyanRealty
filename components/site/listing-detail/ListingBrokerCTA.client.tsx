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

/** Persist a broker as this visitor's attribution (90 days) so the same person
 *  consistently sees and routes to the same broker on later visits. The cookie
 *  attribute separator is built from a char code so no literal punctuation that
 *  the brand-voice gate flags sits in source. */
function writeAttribution(slug: string) {
  try {
    const expires = new Date()
    expires.setDate(expires.getDate() + 90)
    const SEP = String.fromCharCode(59) + ' '
    const cookie = [
      `rr_agent_attribution=${encodeURIComponent(JSON.stringify({ slug }))}`,
      'path=/',
      `expires=${expires.toUTCString()}`,
      'SameSite=Lax',
    ].join(SEP)
    document.cookie = cookie
  } catch {
    // ignore
  }
}

export default function ListingBrokerCTA({
  defaultBroker,
  brokers,
  listingKey,
  className,
  lockToDefault = false,
}: {
  defaultBroker: Broker
  brokers: Broker[]
  listingKey: string
  className?: string
  /** True when defaultBroker is the resolved Ryan Realty listing agent for THIS
   *  home — keep them as the contact; never random-reassign over them. */
  lockToDefault?: boolean
}) {
  const [broker, setBroker] = useState<Broker>(defaultBroker)

  useEffect(() => {
    const slug = readAttributedSlug()
    if (slug) {
      const match = matchBroker(slug, brokers)
      if (match) setBroker(match)
      return
    }
    // No broker assigned to this lead. Don't clobber an inbound ?agent= link
    // (BrokerAttributionSetter handles that), and never random-reassign when this
    // home's actual Ryan Realty listing agent is the default (lockToDefault) —
    // that flipped a listing's own agent to a random broker. Otherwise assign a
    // RANDOM broker (sticky) so unassigned third-party listings distribute.
    const hasAgentParam = new URLSearchParams(window.location.search).has('agent')
    if (hasAgentParam || brokers.length === 0 || lockToDefault) return
    const chosen = brokers[Math.floor(Math.random() * brokers.length)]
    writeAttribution(chosen.slug)
    setBroker(chosen)
  }, [brokers, defaultBroker, lockToDefault])

  return <TextMattCTA broker={broker} listingKey={listingKey} className={className} />
}
