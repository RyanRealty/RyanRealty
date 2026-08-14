/**
 * Matt-owned mailbox gate for the one-OREF packet.
 *
 * This path emails the filled form to Matt's broker mailbox only. A client
 * (or any other) recipient is a hard refuse — silence is not approval, and
 * this slice is not a client send.
 */

export const MATT_OWNED_MAILBOX = 'matt@ryan-realty.com'

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isMattOwnedMailbox(email: string): boolean {
  return normalizeEmail(email) === MATT_OWNED_MAILBOX
}

export function assertMattOwnedRecipients(
  to: string[],
): { ok: true; to: string[] } | { ok: false; error: string } {
  if (!to.length) return { ok: false, error: 'Recipient required.' }
  const normalized = to.map(normalizeEmail).filter(Boolean)
  if (!normalized.length) return { ok: false, error: 'Recipient required.' }
  const refused = normalized.filter((e) => e !== MATT_OWNED_MAILBOX)
  if (refused.length) {
    return {
      ok: false,
      error: 'Refused: this path emails Matt only. Client recipients are not allowed.',
    }
  }
  return { ok: true, to: [MATT_OWNED_MAILBOX] }
}

/** Default To = Matt. Any caller-supplied list still has to pass the gate. */
export function planOrefMattEmail(requestedTo?: string[]): { ok: true; to: string[] } | { ok: false; error: string } {
  return assertMattOwnedRecipients(requestedTo?.length ? requestedTo : [MATT_OWNED_MAILBOX])
}
