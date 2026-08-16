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

/** The minimal shape scopeBroker needs — matches CrmAccess from app/actions/crm.ts. */
export type ScopeAccess = {
  role: 'superuser' | 'broker' | 'report_viewer'
  /** Own CRM slug when mapped. Null means unmapped — scopeBroker fail-closes. */
  brokerSlug: string | null
}

/**
 * Sentinel assigned_broker filter for an unmapped non-superuser.
 * Matches no live row. Callers that `.eq('assigned_broker', slug)` when
 * slug is truthy therefore return an empty book — never the company book.
 */
export const UNMAPPED_OWN_BOOK = '__unmapped__'

/**
 * The policy decision (Option A). `null` = unrestricted/all-brokers (Matt).
 * A mapped non-superuser returns their own slug. An unmapped non-superuser
 * returns UNMAPPED_OWN_BOOK (empty book). Never fail open.
 */
export function scopeBroker(access: ScopeAccess): string | null {
  if (access.role === 'superuser') return null
  const slug = (access.brokerSlug ?? '').trim()
  return slug || UNMAPPED_OWN_BOOK
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
  slug: string | null,
  assignedBroker: string | null | undefined,
): boolean {
  if (!slug) return true
  if (slug === UNMAPPED_OWN_BOOK) return false
  return assignedBroker === slug
}
