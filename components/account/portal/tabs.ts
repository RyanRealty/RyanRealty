/**
 * Portal tab vocabulary — shared by the SERVER page (which resolves ?tab= into
 * the initial panel) and the client shell (which renders the triggers).
 *
 * Deliberately its own module with no 'use client' directive: a function
 * exported from a client module cannot be called during a server render, so
 * the resolver has to live outside PortalTabs.tsx.
 */

export const PORTAL_TAB_IDS = ['overview', 'alerts', 'areas', 'homes', 'activity'] as const

export type PortalTabId = (typeof PORTAL_TAB_IDS)[number]

export const PORTAL_TAB_LABELS: Record<PortalTabId, string> = {
  overview: 'Overview',
  alerts: 'Alerts',
  areas: 'Areas',
  homes: 'Homes',
  activity: 'Activity',
}

/** Coerce any ?tab= value (missing, repeated, unknown) to a real tab id. */
export function resolvePortalTab(raw: string | string[] | undefined): PortalTabId {
  const value = Array.isArray(raw) ? raw[0] : raw
  const next = (value ?? '').trim().toLowerCase()
  return (PORTAL_TAB_IDS as readonly string[]).includes(next) ? (next as PortalTabId) : 'overview'
}
