/**
 * Email recipient parsing + validation for the CRM composer's To/Cc/Bcc rows.
 * Pure module — shared by the composer (client-side chip validation) and
 * sendCrmEmailAction (server-side re-validation of the posted JSON fields).
 */

/** Pragmatic RFC-5322-subset check — matches the address-extraction regexes elsewhere in lib/crm. */
const EMAIL_RE = /^[\w.+'-]+@[\w-]+\.[\w.-]+$/

export const MAX_RECIPIENTS_PER_FIELD = 10
export const MAX_RECIPIENTS_TOTAL = 20

export function isValidEmailAddress(value: string): boolean {
  const v = value.trim()
  return v.length > 3 && v.length <= 254 && EMAIL_RE.test(v)
}

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase()
}

export type ParsedRecipients = {
  to: string[]
  cc: string[]
  bcc: string[]
  /** Every address across the three fields, deduped, lowercase. */
  all: string[]
}

/**
 * Parse the composer's `to`/`cc`/`bcc` JSON fields (each an array of address
 * strings; empty/missing → []). Dedupes case-insensitively across fields with
 * To taking precedence over Cc over Bcc. Rejects malformed addresses.
 */
export function parseRecipientFields(fields: {
  to?: string | null
  cc?: string | null
  bcc?: string | null
}): { ok: true; recipients: ParsedRecipients } | { ok: false; error: string } {
  const parseOne = (raw: string | null | undefined, label: string): string[] | { error: string } => {
    const text = (raw ?? '').trim()
    if (!text) return []
    let arr: unknown
    try {
      arr = JSON.parse(text)
    } catch {
      return { error: `Malformed ${label} field` }
    }
    if (!Array.isArray(arr)) return { error: `Malformed ${label} field` }
    if (arr.length > MAX_RECIPIENTS_PER_FIELD) return { error: `At most ${MAX_RECIPIENTS_PER_FIELD} ${label} recipients` }
    const out: string[] = []
    for (const entry of arr) {
      if (typeof entry !== 'string' || !isValidEmailAddress(entry)) {
        return { error: `${label}: "${String(entry).slice(0, 60)}" is not a valid email address` }
      }
      out.push(normalizeEmailAddress(entry))
    }
    return out
  }

  const to = parseOne(fields.to, 'To')
  if (!Array.isArray(to)) return { ok: false, error: to.error }
  const cc = parseOne(fields.cc, 'Cc')
  if (!Array.isArray(cc)) return { ok: false, error: cc.error }
  const bcc = parseOne(fields.bcc, 'Bcc')
  if (!Array.isArray(bcc)) return { ok: false, error: bcc.error }

  // Dedupe across fields — To wins over Cc wins over Bcc.
  const seen = new Set<string>()
  const take = (list: string[]) => list.filter((a) => (seen.has(a) ? false : (seen.add(a), true)))
  const dedupedTo = take(to)
  const dedupedCc = take(cc)
  const dedupedBcc = take(bcc)
  const all = [...seen]
  if (all.length > MAX_RECIPIENTS_TOTAL) {
    return { ok: false, error: `At most ${MAX_RECIPIENTS_TOTAL} recipients per send` }
  }
  return { ok: true, recipients: { to: dedupedTo, cc: dedupedCc, bcc: dedupedBcc, all } }
}
