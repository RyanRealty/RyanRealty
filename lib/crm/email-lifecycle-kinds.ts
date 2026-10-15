/**
 * Email lifecycle timeline kinds (Matt 2026-10-15: show every email event on the
 * contact timeline, delivered included).
 *
 * The Resend webhook writes one row per delivered, bounced, complained or
 * unsubscribed email per matched contact; the Gmail bounce watch writes
 * bounces; a listing-alert unsubscribe writes email_unsubscribe. They say what
 * happened to an email we sent, not something the contact or a broker did, so:
 *   - they render on the contact's activity list and timeline,
 *   - they never become the contact's "Last activity" or "Last message",
 *   - they stay out of conversation threads and the AI draft context, where a
 *     daily alert's delivery rows would push real messages out of the window.
 * Delivered is the high-volume one (every send), so the windowed readers drop
 * it at the query and read it separately where they show it.
 *
 * Pure: no imports, safe for client and server.
 */

export const EMAIL_LIFECYCLE_KINDS = ['email_delivered', 'email_bounce', 'email_complaint', 'email_unsubscribe'] as const

export type EmailLifecycleKind = (typeof EMAIL_LIFECYCLE_KINDS)[number]

const LIFECYCLE: ReadonlySet<string> = new Set(EMAIL_LIFECYCLE_KINDS)

export function isEmailLifecycleKind(kind: string | null | undefined): kind is EmailLifecycleKind {
  return typeof kind === 'string' && LIFECYCLE.has(kind)
}

/** One-per-send kind the windowed readers keep out of a fixed-size window. */
export const EMAIL_DELIVERED_KIND = 'email_delivered'

/** PostgREST `not.in` list, e.g. `.not('kind', 'in', postgrestInList([...]))`. */
export function postgrestInList(values: readonly string[]): string {
  return `(${values.join(',')})`
}

/**
 * Delivery rows into a newest-first timeline window that was read without them.
 * When the window is full, a delivery older than its oldest row stays out, so a
 * delivery never sits beside a gap where real history was cut.
 */
export function mergeDeliveredRows<T extends { ts: string }>(window: T[], delivered: T[], windowSize: number): T[] {
  if (delivered.length === 0) return window
  const oldest = window[window.length - 1]
  const floor = window.length >= windowSize && oldest ? new Date(oldest.ts).getTime() : -Infinity
  const kept = delivered.filter((d) => new Date(d.ts).getTime() >= floor)
  return [...window, ...kept].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
}
