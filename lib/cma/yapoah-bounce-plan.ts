/**
 * Plan the one-row backfill for the 2026-09-28 hard bounce.
 *
 * Pure. The script prints this plan and writes only with --apply.
 * A row that is not that send is refused. Nothing here calls the network.
 */

import { mergeCmaDelivery, readCmaDeliveryStatus, type CmaHardBounceStamp } from '@/lib/cma/delivery-status'

export const YAPOAH_SLUG_PREFIX = 'cma-1109-yapoah'
export const YAPOAH_SENT_DAY = '2026-09-28'
export const YAPOAH_MAILBOX = 'matt@ryan-realty.com'

export function backfillWritesEnabled(argv: readonly string[]): boolean {
  return argv.includes('--apply')
}

/** The later readable instant, so a re-stamp is not already older than this send. */
function laterInstant(a: string, b: string): string {
  const am = Date.parse(a)
  const bm = Date.parse(b)
  if (!Number.isFinite(am)) return b
  if (!Number.isFinite(bm)) return a
  return am >= bm ? a : b
}

export function pacificDay(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export type YapoahCmaRow = {
  slug: string
  status: string | null
  deliveredAt: string | null
  clientEmail: string | null
  personId: number | null
  buildSummary: unknown
}

export type YapoahSentEvent = {
  recipientEmail: string | null
  occurredAt: string | null
  transport: string | null
  mailbox: string | null
  messageId: string | null
  emailKey: string | null
}

export type YapoahBouncePlan =
  | { ok: false; slug: string; reason: string }
  | {
      ok: true
      slug: string
      lines: string[]
      summary: Record<string, unknown>
      recipient: string
      personId: number | null
      messageId: string | null
      emailKey: string
      stamp: CmaHardBounceStamp
    }

function skip(slug: string, reason: string): YapoahBouncePlan {
  return { ok: false, slug, reason }
}

/**
 * Accept the row only when it is that Gmail send: slug prefix, delivered on
 * the Pacific day, recipient matches a sent event, transport is gmail, and
 * the mailbox is Matt's when the event recorded one.
 */
export function planYapoahBounceBackfill(
  row: YapoahCmaRow,
  sents: readonly YapoahSentEvent[],
  at: string = '2026-09-28T20:02:00.000Z',
): YapoahBouncePlan {
  const slug = row.slug.trim().toLowerCase()
  if (!slug.startsWith(YAPOAH_SLUG_PREFIX)) {
    return skip(slug, `slug does not start with ${YAPOAH_SLUG_PREFIX}`)
  }
  if (!row.deliveredAt) return skip(slug, 'row is not sent (delivered_at is empty)')
  const sentDay = pacificDay(row.deliveredAt)
  if (sentDay !== YAPOAH_SENT_DAY) {
    return skip(slug, `delivered_at is ${sentDay ?? 'unreadable'} Pacific, not ${YAPOAH_SENT_DAY}`)
  }
  if (readCmaDeliveryStatus(row.buildSummary, row.deliveredAt) === 'bounced') {
    return skip(slug, 'already bounced')
  }
  const recipient = (row.clientEmail ?? '').trim().toLowerCase()
  if (!recipient.includes('@')) return skip(slug, 'row has no recipient')

  const sameRecipient = sents.filter((s) => (s.recipientEmail ?? '').trim().toLowerCase() === recipient)
  if (sameRecipient.length === 0) return skip(slug, 'no sent event for this recipient')

  const onDay = sameRecipient.filter((s) => pacificDay(s.occurredAt) === YAPOAH_SENT_DAY)
  if (onDay.length === 0) return skip(slug, `sent event is not on ${YAPOAH_SENT_DAY} Pacific`)

  const gmail = onDay.filter((s) => (s.transport ?? '').trim().toLowerCase() === 'gmail')
  if (gmail.length === 0) return skip(slug, 'sent event is not the gmail path')

  const mailboxOk = gmail.filter((s) => {
    const mailbox = (s.mailbox ?? '').trim().toLowerCase()
    return mailbox === '' || mailbox === YAPOAH_MAILBOX
  })
  if (mailboxOk.length === 0) return skip(slug, `sent event mailbox is not ${YAPOAH_MAILBOX}`)

  const chosen = mailboxOk[0]!
  const current =
    row.buildSummary && typeof row.buildSummary === 'object' && !Array.isArray(row.buildSummary)
      ? (row.buildSummary as Record<string, unknown>)
      : {}
  const stamp: CmaHardBounceStamp = {
    status: 'bounced',
    at: laterInstant(at, row.deliveredAt),
    enhanced_status: '5.1.1',
    smtp_code: '550',
    recipient,
    diagnostic: '550 5.1.1',
    source: 'gmail-dsn',
  }
  const summary = mergeCmaDelivery(current, stamp)
  const personId = typeof row.personId === 'number' && row.personId > 0 ? row.personId : null
  const emailKey = chosen.emailKey?.trim() || `cma:${slug}`
  const lines = [
    `cmas ${slug}: merge build_summary.delivery.status=bounced (other summary keys kept)`,
    `cmas ${slug}: leave delivered_at=${row.deliveredAt}`,
    `cmas ${slug}: leave status=${row.status ?? 'null'}`,
    `email_events: insert event=bounce email_key=${emailKey} message_id=${chosen.messageId ?? 'none'}`,
  ]
  if (personId) {
    lines.push(`crm_timeline: insert kind=email_bounce person_id=${personId}`)
    lines.push(`crm_suppressions: insert channel=email person_id=${personId}`)
  } else {
    lines.push('crm_timeline: skip (no person on the row)')
    lines.push('crm_suppressions: skip (no person on the row)')
  }
  return {
    ok: true,
    slug,
    lines,
    summary,
    recipient,
    personId,
    messageId: chosen.messageId,
    emailKey,
    stamp,
  }
}
