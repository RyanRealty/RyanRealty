/**
 * Honest "email delivered" rows on the contact timeline.
 *
 * Gmail DWD has no delivery webhook. Delivery is determined later: either the
 * no-bounce job infers it, or an open arrives first. Both paths record through
 * recordEmailEvent; this module is the timeline side of that write. A
 * provider-confirmed Resend delivery already has its own crm_timeline row
 * (the webhook) — we do not add another.
 *
 * ts is left to the table default (now at determination), never back-dated
 * to the send.
 */

export type DeliveredBasis = 'no-bounce' | 'opened'

export function deliveredBasisFromMeta(
  meta: Record<string, unknown> | null | undefined,
): DeliveredBasis | null {
  const inferred = meta?.inferred
  if (inferred === 'opened') return 'opened'
  if (inferred === true) return 'no-bounce'
  return null
}

export function deliveredPreview(basis: DeliveredBasis): string {
  return basis === 'opened' ? 'Delivered (opened)' : 'Delivered (no bounce)'
}

export function deliveredTimelineDedupeKey(personId: number, emailKey: string): string {
  return `track:delivered:${personId}:${emailKey}`
}
