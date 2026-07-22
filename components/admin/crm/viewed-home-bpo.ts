/**
 * Pure helper for the ViewedHomeCard "Draft BPO" action (framework-free so the
 * contract is unit-testable — same pattern as composer-submit-guard.ts).
 *
 * The card renders inside /admin/crm/[id]. When the parent does not pass a
 * personId prop explicitly, the route param is the source of truth, so the
 * card works without any parent changes.
 */

/**
 * Resolve the CRM person id for the card: an explicit prop wins, else the
 * /admin/crm/[id] route param. Returns null when neither is a positive
 * integer — the Draft BPO action hides rather than firing with a bad id.
 */
export function resolveViewedHomePersonId(
  explicit: number | null | undefined,
  routeId: string | string[] | undefined,
): number | null {
  if (typeof explicit === 'number' && Number.isInteger(explicit) && explicit > 0) return explicit
  const raw = Array.isArray(routeId) ? routeId[0] : routeId
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
