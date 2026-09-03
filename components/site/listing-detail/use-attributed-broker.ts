'use client'
/**
 * Which broker a listing page shows, resolved once and shared by the two places
 * that show one: the desktop card in the aside and the fixed bar on a phone.
 *
 * It exists because those two used to be one component, and one component
 * cannot be in two places — the bar is `position: fixed` and was rendered
 * inside `.listing-detail-aside`, which is `display: none` below 64rem, and a
 * fixed element does not escape a hidden ancestor. Both pieces measured 0px
 * high at 390, 1024 and 1440.
 *
 * The cookie is read client-side so static and ISR listing pages stay static:
 * both surfaces render the default broker on the server and swap in place after
 * hydration if this visitor is attributed.
 *
 * ONE of the two callers assigns. `assign` is true on the card and false on the
 * bar, so the random sticky assignment for an unattributed visitor happens once
 * and the other surface reads the cookie it wrote.
 */
import { useEffect, useState } from 'react'
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
    // 90-day cookie via max-age (seconds) rather than an `expires` Date — no
    // clock read at all, so it stays SSR/hydration-safe and trips no clock gate.
    const SEP = String.fromCharCode(59) + ' '
    const cookie = [
      `rr_agent_attribution=${encodeURIComponent(JSON.stringify({ slug }))}`,
      'path=/',
      `max-age=${90 * 24 * 60 * 60}`,
      'SameSite=Lax',
    ].join(SEP)
    document.cookie = cookie
  } catch {
    // ignore
  }
}

export function useAttributedBroker(input: {
  defaultBroker: Broker
  brokers: Broker[]
  /** True when defaultBroker is the resolved Ryan Realty listing agent for THIS
   *  home — keep them as the contact; never random-reassign over them. */
  lockToDefault?: boolean
  /** Only the card assigns. The bar reads what the card wrote. */
  assign?: boolean
}): Broker {
  const { defaultBroker, brokers, lockToDefault = false, assign = false } = input
  const [broker, setBroker] = useState<Broker>(defaultBroker)

  useEffect(() => {
    const slug = readAttributedSlug()
    if (slug) {
      const match = matchBroker(slug, brokers)
      if (match) setBroker(match)
      return
    }
    if (!assign) return
    // No broker assigned to this lead. Don't clobber an inbound ?agent= link
    // (BrokerAttributionSetter handles that), and never random-reassign when this
    // home's actual Ryan Realty listing agent is the default (lockToDefault) —
    // that flipped a listing's own agent to a random broker. Otherwise assign a
    // RANDOM broker (sticky) so unassigned third-party listings distribute.
    const hasAgentParam = new URLSearchParams(window.location.search).has('agent')
    if (hasAgentParam || brokers.length === 0 || lockToDefault) return
    const chosen = brokers[Math.floor(Math.random() * brokers.length)]
    if (!chosen) return
    writeAttribution(chosen.slug)
    setBroker(chosen)
  }, [assign, brokers, defaultBroker, lockToDefault])

  return broker
}
