/**
 * CRM broker RBAC scope policy (CONTACT360 Phase 10.1, Option A).
 *
 * The SINGLE source of truth for "who can see whose leads." Pure + unit-tested,
 * so it lives here (a plain module, not a 'use server' file) and is re-exported
 * from app/actions/crm.ts next to getCrmAccess.
 *
 * Option A (Matt's choice 2026-06-22): Matt is the owner/superuser and sees ALL
 * brokers' data; every other broker (Rebecca, Paul) is scoped to their own
 * assigned_broker.
 *
 * The all-brokers path keys on `role === 'superuser'`, NOT on `brokerSlug == null`
 * — Matt's email maps to the 'matt' slug, so keying on the slug would scope him
 * to matt-assigned leads. Keying on the role keeps Matt unrestricted.
 *
 * Returns:
 *   - `null`  → unrestricted (sees every broker's data) = a superuser (Matt).
 *   - a slug  → restricted to that broker's own assigned_broker (Rebecca, Paul).
 */

import type { CrmBrokerSlug } from '@/lib/crm/constants'

/** The minimal shape scopeBroker needs — matches CrmAccess from app/actions/crm.ts. */
export type ScopeAccess = {
  role: 'superuser' | 'broker' | 'report_viewer'
  brokerSlug: CrmBrokerSlug | null
}

/**
 * The policy decision (Option A). `null` = unrestricted/all-brokers (Matt);
 * a non-superuser returns their own slug (or null if their email maps to none,
 * which leaves an unmapped admin unrestricted — there is no such admin today).
 */
export function scopeBroker(access: ScopeAccess): CrmBrokerSlug | null {
  return access.role === 'superuser' ? null : access.brokerSlug
}

/**
 * The pure ownership decision behind requirePersonInScope (factored out so it is
 * unit-testable without Supabase). Given the scoped slug and the contact's stored
 * assigned_broker, decide whether the caller may act on it.
 *
 *   - slug === null            → ok (superuser is unrestricted).
 *   - assignedBroker === slug  → ok (the contact is the caller's own).
 *   - otherwise                → not authorized (missing owner OR a different broker).
 */
export function isPersonInScope(
  slug: CrmBrokerSlug | null,
  assignedBroker: string | null | undefined,
): boolean {
  if (!slug) return true
  return assignedBroker === slug
}
