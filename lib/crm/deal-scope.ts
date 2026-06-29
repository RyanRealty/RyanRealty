import type { CrmBrokerSlug } from '@/lib/crm/constants'

/**
 * Pure broker-scope decision for a deal mutation.
 *
 * An owner / superuser (`scoped === null`) may touch any deal. A restricted
 * broker may only mutate a deal they can see in their scoped pipeline — i.e. the
 * deal's own `assigned_broker` OR its linked person's `assigned_broker` matches
 * their slug (mirrors `listCrmDeals`' GAP-7 person-scope). Deals matching neither
 * are refused, so no broker can edit another broker's financials.
 *
 * Kept pure (no DB, no async) so the authorization rule is unit-tested, not prose.
 */
export function dealInScope(
  scoped: CrmBrokerSlug | null,
  dealBroker: string | null,
  personBroker: string | null,
): boolean {
  if (scoped === null) return true
  return dealBroker === scoped || personBroker === scoped
}
