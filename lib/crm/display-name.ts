/**
 * Display name for a CRM contact. Imported leads often carry a placeholder name
 * like "Lead anna@example.com" — strip the "Lead " prefix so feeds and lists
 * show the address cleanly instead of the ugly placeholder. Used everywhere a
 * contact name is rendered so the whole CRM is consistent.
 */
export function cleanContactName(name: string | null | undefined, fallbackId?: number | string): string {
  const n = String(name ?? '').trim()
  if (!n) return fallbackId != null ? `Contact #${fallbackId}` : 'Contact'
  if (/^lead\s+\S+@\S+$/i.test(n)) return n.replace(/^lead\s+/i, '')
  return n
}

/**
 * True when a contact is still an unidentified inbound caller — a person auto-
 * created by the inbound-SMS / inbound-voice webhooks (findOrCreatePersonByPhone)
 * that has never been named. Those rows carry a phone-derived placeholder name
 * ("Text lead 5412079190", "Call lead …", "Lead …") or a bare phone number.
 *
 * The inbox uses this to decide whether to surface the "Add as new contact"
 * (Add Person) affordance in the reading pane — FUB's unknown-caller flow
 * (spec §9, AC-19/AC-20). Pure so it is shared by the server page and unit tests
 * and lives in this plain (non-'use client') module.
 */
export function isUnknownCaller(name: string | null | undefined): boolean {
  const n = String(name ?? '').trim()
  if (!n) return true
  // Webhook placeholders stamped by inboundLeadName() + legacy "Lead <x>" rows.
  if (/^(text lead|call lead|lead)\s+/i.test(n)) return true
  // A name that is really just a phone number (digits, spaces, ()+-. only).
  if (/^\+?[\d()\s.\-]{7,}$/.test(n)) return true
  return false
}
