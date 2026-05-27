import { Suspense } from 'react'
import FubIdentityBridge from '@/components/FubIdentityBridge'
import AgentAttributionBridge from '@/components/AgentAttributionBridge'
import AnalyticsIdentityBridge from '@/components/AnalyticsIdentityBridge'

/**
 * Identity + attribution bridges that run on every route, including LPs.
 *
 * These three components hydrate identity into GA4 user_id + Meta Pixel
 * advanced matching, and write the per-broker attribution cookie
 * (?agent=<slug>) so per-broker ad clicks route to the right person.
 *
 * Each bridge consumes useSearchParams (?_fuid, ?agent, ?eml, ...), so
 * the whole group lives inside a single Suspense boundary so the static
 * shell can still prerender.
 *
 * Used only by RootProvider.
 */
export function IdentityBridges() {
  return (
    <Suspense fallback={null}>
      <FubIdentityBridge />
      <AgentAttributionBridge />
      <AnalyticsIdentityBridge />
    </Suspense>
  )
}
