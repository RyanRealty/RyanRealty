/**
 * Which broker the public floating button shows.
 *
 * Same visit-level sources as GA (`resolveVisitBrokerSlug`): `?agent=` then
 * the `rr_agent_attribution` cookie then `utm_content` / `utm_term` `agent-*`.
 * Unknown or missing → Matt. Headshots are the canonical transparent PNGs
 * already in `public/images/brokers/` (not the tight 512 profile squares).
 */
import type { BrokerSlug } from '@/lib/agent-attribution'
import {
  type VisitBrokerSources,
  resolveVisitBrokerSlug,
} from '@/lib/analytics/visit-broker'

export const DEFAULT_FLOATER_BROKER: BrokerSlug = 'matt'

/** Canonical 800x1200 cutouts. Shared head height; crop in V3DogFloater.css. */
export const FLOATER_BROKER_HEADSHOT: Record<BrokerSlug, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

export function floaterBrokerSlug(input: VisitBrokerSources): BrokerSlug {
  return resolveVisitBrokerSlug(input) ?? DEFAULT_FLOATER_BROKER
}

export function floaterBrokerHeadshot(slug: BrokerSlug | null | undefined): string {
  if (slug && slug in FLOATER_BROKER_HEADSHOT) return FLOATER_BROKER_HEADSHOT[slug]
  return FLOATER_BROKER_HEADSHOT[DEFAULT_FLOATER_BROKER]
}
