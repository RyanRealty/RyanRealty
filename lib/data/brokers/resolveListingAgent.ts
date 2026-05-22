/**
 * resolveListingAgent — given a listing's agent fields, return the
 * matching Ryan Realty broker (or null if the listing is from another
 * brokerage).
 *
 * Strategy (per docs/SITE_SPEC.md "Listing-agent rule"):
 *   1. Match by ListAgentEmail against the brokers table (canonical)
 *   2. Fallback: match by ListAgentFullName against full_name
 *   3. Last resort: null — listing is from another brokerage; the listing
 *      detail page should show no agent card (or show "Listed by <other agent>")
 *
 * Caching: this function does NOT wrap in unstable_cache because callers
 * already cache the listing detail (which transitively caches the result).
 * Wrapping here would double-cache the same data with different keys.
 */

import { getBrokers } from './getBrokers'
import type { Broker } from '@/lib/data/types/broker'

export type ListingAgentInput = {
  listAgentEmail?: string | null
  listAgentName?: string | null
  listAgentFullName?: string | null
}

export async function resolveListingAgent(
  input: ListingAgentInput
): Promise<Broker | null> {
  const email = input.listAgentEmail?.toLowerCase().trim()
  const name = (input.listAgentFullName ?? input.listAgentName ?? '').toLowerCase().trim()

  if (!email && !name) return null

  const brokers = await getBrokers()

  // 1. Email match (exact, case-insensitive)
  if (email) {
    const byEmail = brokers.find((b) => b.email?.toLowerCase().trim() === email)
    if (byEmail) return byEmail
  }

  // 2. Full-name match (exact, case-insensitive)
  if (name) {
    const byName = brokers.find((b) => b.fullName.toLowerCase().trim() === name)
    if (byName) return byName

    // 3. Loose name match — Last-Name match if the full name didn't hit
    //    (handles "Peterson, Rebecca Ryser" MLS variants)
    const lastNameMatch = brokers.find((b) => {
      const brokerLast = b.fullName.split(/\s+/).pop()?.toLowerCase() ?? ''
      return brokerLast.length > 3 && name.includes(brokerLast)
    })
    if (lastNameMatch) return lastNameMatch
  }

  return null
}
