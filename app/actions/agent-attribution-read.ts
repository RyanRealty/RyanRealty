'use server'

import { cookies } from 'next/headers'
import {
  AGENT_ATTRIB_COOKIE,
  parseAgentAttributionCookie,
  FUB_USER_ID_BY_BROKER,
  type BrokerSlug,
} from '@/lib/agent-attribution'

/**
 * Server-side read of the `rr_agent_attribution` cookie set client-side by
 * `components/AgentAttributionBridge.tsx`. Returns the canonical short
 * broker slug + FUB user ID, or null if no valid attribution.
 *
 * Used by the seller LP + buyer LP server actions to override the default
 * "all to Matt" routing when an explicit `?agent=` param was used in the URL
 * (e.g. broker's personal ad → ryan-realty.com/lp/seller-home-value?agent=rebecca).
 */
export async function readAttributedAgentServer(): Promise<{
  broker: BrokerSlug
  userId: number
} | null> {
  try {
    const c = await cookies()
    const raw = c.get(AGENT_ATTRIB_COOKIE)?.value
    const broker = parseAgentAttributionCookie(raw)
    if (!broker) return null
    return { broker, userId: FUB_USER_ID_BY_BROKER[broker] }
  } catch {
    return null
  }
}
