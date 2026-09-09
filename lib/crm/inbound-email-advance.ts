/**
 * Which inbound emails a sync should treat as "a human replied" (Matt's rule
 * 2026-08-26: a two-way conversation IS engagement; engine item 4, 2026-09-09:
 * "inbound email replies advance the CRM"). Pure, so the sync's wiring is
 * unit-testable: the sync hands in the inbound rows it just wrote and gets
 * back one entry per person to pass to handleInboundReply.
 *
 * What is NOT a reply: an autoresponder, a bounce, a calendar or list robot.
 * Those write to the timeline as email_in like everything else; they must not
 * move a stage, pause a sequence, or text the broker.
 */

export type InboundEmailRow = {
  personId: number
  messageKey: string
  subject: string | null
  body: string | null
  /** Gmail internalDate as ISO. */
  ts: string
  fromEmails?: readonly string[]
}

const AUTOMATED_SUBJECT_RE =
  /\b(out of (the )?office|automatic reply|auto-?reply|autoreply|delivery (status|failure)|undeliverable|mail delivery|returned mail|failure notice|vacation|do not reply|read receipt|accepted:|declined:|tentative:|invitation:)\b/i
const AUTOMATED_SENDER_RE = /^(no-?reply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce|notifications?|calendar|noreply)[@.+-]/i
const AUTOMATED_BODY_RE = /^(this is an automatic(ally generated)? (reply|response|message)|i am (currently )?out of (the )?office)/i

export function isAutomatedInboundEmail(row: Pick<InboundEmailRow, 'subject' | 'body' | 'fromEmails'>): boolean {
  if (AUTOMATED_SUBJECT_RE.test(row.subject ?? '')) return true
  if ((row.fromEmails ?? []).some((e) => AUTOMATED_SENDER_RE.test(e.trim()))) return true
  const body = (row.body ?? '').trim()
  if (body && AUTOMATED_BODY_RE.test(body)) return true
  return false
}

/** First line of what they wrote, for the broker's alert. Never more than one line. */
export function replyPreview(body: string | null | undefined, max = 140): string | null {
  const line = (body ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !/^>/.test(l) && !/^on .* wrote:$/i.test(l))
  if (!line) return null
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line
}

/**
 * One entry per person for the emails inside the window: the newest message's
 * preview. Automated mail is skipped; a message older than `freshAfter` is a
 * backfill, not a reply.
 */
export function inboundEmailRepliesToAdvance(
  rows: readonly InboundEmailRow[],
  freshAfter: string,
): Array<{ personId: number; preview: string | null; messageKey: string }> {
  const byPerson = new Map<number, InboundEmailRow>()
  for (const r of rows) {
    if (!Number.isFinite(r.personId) || r.personId <= 0) continue
    if (r.ts < freshAfter) continue
    if (isAutomatedInboundEmail(r)) continue
    const prev = byPerson.get(r.personId)
    if (!prev || r.ts > prev.ts) byPerson.set(r.personId, r)
  }
  return [...byPerson.values()].map((r) => ({ personId: r.personId, preview: replyPreview(r.body), messageKey: r.messageKey }))
}
