'use server'

/**
 * Return-visit tracking.
 *
 * The FUB "Visited Website" mirror this action used to fire was a dead no-op
 * after the FUB decommission (2026-06-24) and has been deleted. The native
 * replacement already runs server-side: /api/visitors/track fires
 * queueReturnVisitAlert (broker text + CRM deep link, deduped per person per
 * day) on every identified page view, which superseded this client-triggered
 * detector. The action is kept as a stub so the existing client caller
 * (components/VisitTracker.tsx) keeps working; it can be removed together
 * with its call site in a follow-up.
 */
export async function trackReturnVisitAction(_params: {
  userEmail: string
  pageUrl: string
  pageTitle?: string
}): Promise<void> {
  // Intentionally empty — see module doc.
}
