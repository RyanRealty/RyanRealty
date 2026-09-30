/**
 * Parse a mailbox bounce / DSN notice (Gmail and Outlook shapes) into the
 * fields the bounce-watch cron uses to match a `sent` row and decide whether
 * the bounce is hard (suppress) or soft (record only).
 *
 * Pure — no Gmail client, no database. The runner feeds it headers + body text.
 */

export type BounceNotice = {
  /** True when the message looks like a delivery-status notice, not a human reply. */
  isBounce: boolean
  failedRecipients: string[]
  /** SMTP status like `5.1.1` or `4.2.2`, when the notice prints one. */
  status: string | null
  /** Permanent (5.x.x) — the address should be suppressed. */
  hard: boolean
  diagnostic: string | null
  /** RFC Message-ID the notice is answering (In-Reply-To), angle-brackets stripped. */
  inReplyTo: string | null
  /** RFC Message-IDs from References, angle-brackets stripped. */
  references: string[]
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const STATUS_RE = /\b([45]\.\d{1,3}\.\d{1,3})\b/
const FINAL_RECIPIENT_RE = /Final-Recipient:\s*(?:rfc822;)\s*(\S+)/i
const ACTION_RE = /^Action:\s*(\S+)/im
const DIAGNOSTIC_RE = /Diagnostic-Code:\s*(?:smtp;)\s*(.+)/i
const X_FAILED_RE = /X-Failed-Recipients:\s*(.+)/i
const ORIGINAL_MSGID_RE = /(?:Original-Message-ID|Message-ID):\s*<([^>]+)>/i

const BOUNCE_FROM =
  /mailer-daemon|postmaster|mail delivery subsystem|microsoft outlook|mail delivery|undeliverable/i
const BOUNCE_SUBJECT =
  /delivery status notification|undeliverable|returned mail|delivery failure|failure notice|mail delivery failed/i

function normId(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  return s.replace(/^<|>$/g, '').trim().toLowerCase() || null
}

function emailsIn(text: string): string[] {
  const found = text.match(EMAIL_RE) ?? []
  const out: string[] = []
  for (const e of found) {
    const n = e.toLowerCase()
    if (n.endsWith('.invalid')) continue
    if (n.includes('mailer-daemon') || n.startsWith('postmaster@')) continue
    if (!out.includes(n)) out.push(n)
  }
  return out
}

function parseReferences(raw: string | null | undefined): string[] {
  const s = (raw ?? '').trim()
  if (!s) return []
  const ids = [...s.matchAll(/<([^>]+)>/g)].map((m) => m[1]!.toLowerCase())
  if (ids.length) return ids
  const one = normId(s)
  return one ? [one] : []
}

function looksLikeBounce(from: string, subject: string, text: string): boolean {
  if (BOUNCE_FROM.test(from) || BOUNCE_SUBJECT.test(subject)) return true
  if (/^Status:\s*[45]\./im.test(text) && /Final-Recipient:/i.test(text)) return true
  if (/Remote Server returned/i.test(text) && /couldn't be delivered|could not be delivered/i.test(text)) {
    return true
  }
  return false
}

/**
 * Parse one bounce notice. Returns `isBounce: false` (and empty recipients)
 * when the message is not a DSN — the runner skips those.
 */
export function parseBounceNotice(input: {
  from?: string | null
  subject?: string | null
  inReplyTo?: string | null
  references?: string | null
  text: string
}): BounceNotice {
  const from = input.from ?? ''
  const subject = input.subject ?? ''
  const text = input.text ?? ''
  const isBounce = looksLikeBounce(from, subject, text)
  if (!isBounce) {
    return {
      isBounce: false,
      failedRecipients: [],
      status: null,
      hard: false,
      diagnostic: null,
      inReplyTo: normId(input.inReplyTo),
      references: parseReferences(input.references),
    }
  }

  const failed: string[] = []
  const final = text.match(FINAL_RECIPIENT_RE)?.[1]
  if (final) {
    const e = final.replace(/[<>]/g, '').trim().toLowerCase()
    if (e.includes('@')) failed.push(e)
  }
  const xFailed = text.match(X_FAILED_RE)?.[1] ?? ''
  for (const e of emailsIn(xFailed)) {
    if (!failed.includes(e)) failed.push(e)
  }
  // Outlook: "Your message to bounce@example.com couldn't be delivered."
  const outlookTo = text.match(/Your message to\s+(\S+@\S+)\s+could(?:n't| not) be delivered/i)?.[1]
  if (outlookTo) {
    const e = outlookTo.replace(/[<>]/g, '').trim().toLowerCase()
    if (e.includes('@') && !failed.includes(e)) failed.push(e)
  }
  if (failed.length === 0) {
    // Last resort: first non-system address in the body that is not the
    // original From we already filtered. Prefer the address after "failed".
    const afterFailed = text.match(/(?:failed|undeliverable)[^\n@]{0,80}([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1]
    if (afterFailed) failed.push(afterFailed.toLowerCase())
  }

  const status = text.match(STATUS_RE)?.[1] ?? null
  const action = text.match(ACTION_RE)?.[1]?.toLowerCase() ?? null
  const diagnostic =
    (text.match(DIAGNOSTIC_RE)?.[1] ?? text.match(/Remote Server returned\s+'([^']+)'/i)?.[1] ?? null)?.trim() ??
    null

  const hard =
    (status != null && status.startsWith('5.')) ||
    action === 'failed' && (status == null || status.startsWith('5.')) ||
    /5\.\d+\.\d+/.test(diagnostic ?? '') ||
    /user unknown|does not exist|recipnotfound|mailbox unavailable|no such user/i.test(
      `${diagnostic ?? ''} ${text.slice(0, 800)}`,
    )

  const inReplyTo = normId(input.inReplyTo) ?? normId(text.match(ORIGINAL_MSGID_RE)?.[1] ?? null)

  return {
    isBounce: true,
    failedRecipients: failed,
    status,
    hard: Boolean(hard),
    diagnostic,
    inReplyTo,
    references: parseReferences(input.references),
  }
}

/** Strip angle brackets and case so In-Reply-To matches the stored RFC id. */
export function normalizeRfcMessageId(id: string | null | undefined): string | null {
  return normId(id)
}

function rfcFromMeta(meta: Record<string, unknown>): string | null {
  const raw = meta.rfcMessageId ?? meta.rfc_message_id
  return normalizeRfcMessageId(typeof raw === 'string' ? raw : null)
}

function threadFromMeta(meta: Record<string, unknown>): string | null {
  const raw = meta.gmailThreadId ?? meta.gmail_thread_id ?? meta.threadId
  const s = typeof raw === 'string' ? raw.trim() : ''
  return s || null
}

/**
 * Match a bounce notice to a `sent` row: Gmail thread id, then
 * In-Reply-To / References against the stored RFC Message-ID, then the
 * failed-recipient address (most recent sent to that address wins).
 */
export function matchSentToBounce<T extends { recipient_email: string; meta: Record<string, unknown> }>(
  sents: T[],
  opts: { threadId?: string | null; notice: BounceNotice },
): T | null {
  const thread = (opts.threadId ?? '').trim()
  if (thread) {
    const byThread = sents.find((s) => threadFromMeta(s.meta) === thread)
    if (byThread) return byThread
  }

  const replyIds = [opts.notice.inReplyTo, ...opts.notice.references]
    .map((id) => normalizeRfcMessageId(id))
    .filter((id): id is string => !!id)
  if (replyIds.length) {
    const byRfc = sents.find((s) => {
      const rfc = rfcFromMeta(s.meta)
      return rfc != null && replyIds.includes(rfc)
    })
    if (byRfc) return byRfc
  }

  for (const recip of opts.notice.failedRecipients) {
    const byAddr = sents.find((s) => s.recipient_email === recip)
    if (byAddr) return byAddr
  }
  return null
}
