/**
 * Shared crm_timeline dedupe key for one Gmail message on one person.
 *
 * The mailbox sync and a CMA send on the Gmail rail must write the SAME key,
 * or the same message lands twice (app row `cma:sent:<slug>:<iso>`, then the
 * sync row). Format matches rows the sync has written since the Message-ID
 * key landed: sha1 of the trimmed Message-ID header bytes (not lowercased),
 * first 24 hex chars. No RFC id falls back to the raw Gmail id, never
 * `gmail:gmail:`.
 */
import { createHash } from 'node:crypto'

export type GmailTimelineId = {
  rfcMessageId?: string | null
  gmailId?: string | null
}

function asIds(id: string | GmailTimelineId | null | undefined): { rfc: string | null; gmailId: string | null } {
  if (id == null) return { rfc: null, gmailId: null }
  if (typeof id === 'string') {
    const s = id.trim()
    if (!s) return { rfc: null, gmailId: null }
    // Message-IDs are `<token@host>`. Anything else is a Gmail API id.
    if (s.startsWith('<') || s.includes('@')) return { rfc: s, gmailId: null }
    return { rfc: null, gmailId: s }
  }
  const rfc = typeof id.rfcMessageId === 'string' && id.rfcMessageId.trim() ? id.rfcMessageId.trim() : null
  const gmailId = typeof id.gmailId === 'string' && id.gmailId.trim() ? id.gmailId.trim() : null
  return { rfc, gmailId }
}

/**
 * The middle of the timeline key, also the message half of the
 * `gmail-intent:` classification note. RFC id wins when both are present.
 * Returns null when there is nothing to key on.
 */
export function gmailMessageKey(
  rfcMessageId: string | null | undefined,
  gmailId: string | null | undefined,
): string | null {
  const rfc = typeof rfcMessageId === 'string' && rfcMessageId.trim() ? rfcMessageId.trim() : null
  if (rfc) {
    const hex = createHash('sha1').update(rfc).digest('hex').slice(0, 24)
    return `rfc:${hex}`
  }
  const id = typeof gmailId === 'string' && gmailId.trim() ? gmailId.trim() : null
  return id
}

/** `gmail:rfc:<24 hex>:p<personId>` or `gmail:<gmailId>:p<personId>`. */
export function gmailTimelineDedupeKey(
  id: string | GmailTimelineId | null | undefined,
  personId: number,
): string | null {
  if (!Number.isInteger(personId) || personId <= 0) return null
  const ids = asIds(id)
  const messageKey = gmailMessageKey(ids.rfc, ids.gmailId)
  if (!messageKey) return null
  return `gmail:${messageKey}:p${personId}`
}
