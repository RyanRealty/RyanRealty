/**
 * Coverage read model for the Vault mail index (docs/TC_MAIL_FILING_RULES.md
 * "Every message reviewed"): per broker mailbox, how many messages Gmail
 * holds, how many the reviewer has looked at, the breakdown by outcome, and
 * whether the full-history walk (lib/tc/mail-index.ts reviewMailbox) has
 * finished. Raw .from() stays here (G1).
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getGmailFor } from '@/lib/crm/gmail'
import { getCrmMailboxes } from '@/lib/data/brokers/directory'

export type MailCoverageRow = {
  mailbox: string
  slug: string
  /** users.getProfile messagesTotal. Null when the mailbox could not be reached. */
  gmailTotal: number | null
  /** Rows in tc_mail_reviews for this mailbox — every message ever looked at, whatever it decided. */
  reviewed: number
  byStatus: Record<string, number>
  lastReviewedAt: string | null
  /** tc_mail_review_cursors.finished_at is set: the full-history walk has reached the end of the mailbox. */
  walkFinished: boolean
  walkStartedAt: string | null
  /** tc_mail_review_cursors.listed: how far the walk has paged into the mailbox. */
  listed: number
}

const READONLY = ['https://www.googleapis.com/auth/gmail.readonly']

function missingTable(message: string): boolean {
  return /does not exist|schema cache/i.test(message)
}

async function gmailTotalFor(mailbox: string): Promise<number | null> {
  try {
    const gmail = getGmailFor(mailbox, READONLY)
    if (!gmail) return null
    const res = await gmail.users.getProfile({ userId: 'me' })
    return typeof res.data.messagesTotal === 'number' ? res.data.messagesTotal : null
  } catch (err) {
    console.warn('[mail-coverage] getProfile failed', mailbox, err instanceof Error ? err.message : err)
    return null
  }
}

type CoverageBucket = { mailbox: string; status: string; reviewed_count: number; last_reviewed_at: string | null }

/**
 * Per-mailbox coverage: the panel on /admin/closings reads this to show
 * whether every message has been reviewed, not just how many were kept.
 * Gmail's own total is fetched live (a cheap getProfile call per mailbox);
 * everything else comes from tc_mail_reviews / tc_mail_review_cursors.
 *
 * tc_mail_reviews holds one row per (mailbox, gmail_id) ever reviewed —
 * ~73,000 as of 2026-09-24 — well past PostgREST's default row cap, so the
 * per-mailbox count and status breakdown are read through
 * `tc_mail_review_coverage()` (migration 20260924060000), a GROUP BY that
 * runs in Postgres and returns only the summary rows, never the table.
 */
export async function getMailCoverage(): Promise<MailCoverageRow[]> {
  const sb = createServiceClient()
  const mailboxes = await getCrmMailboxes()
  const [reviewsRes, cursorsRes, totals] = await Promise.all([
    sb.rpc('tc_mail_review_coverage'),
    sb.from('tc_mail_review_cursors').select('mailbox, listed, started_at, finished_at'),
    Promise.all(mailboxes.map((mb) => gmailTotalFor(mb.email))),
  ])
  const { data: buckets, error: reviewsErr } = reviewsRes as { data: CoverageBucket[] | null; error: { message: string } | null }
  if (reviewsErr && !missingTable(reviewsErr.message)) console.error('[getMailCoverage] reviews', reviewsErr.message)
  const { data: cursors, error: cursorsErr } = cursorsRes
  if (cursorsErr && !missingTable(cursorsErr.message)) console.error('[getMailCoverage] cursors', cursorsErr.message)

  const byMailbox = new Map<string, { count: number; byStatus: Record<string, number>; last: string | null }>()
  for (const b of buckets ?? []) {
    const m = String(b.mailbox)
    const entry = byMailbox.get(m) ?? { count: 0, byStatus: {}, last: null }
    const n = Number(b.reviewed_count) || 0
    entry.count += n
    const status = String(b.status)
    entry.byStatus[status] = (entry.byStatus[status] ?? 0) + n
    const ts = b.last_reviewed_at
    if (ts && (!entry.last || ts > entry.last)) entry.last = ts
    byMailbox.set(m, entry)
  }
  const cursorByMailbox = new Map((cursors ?? []).map((c) => [String(c.mailbox), c]))

  return mailboxes.map((mb, i) => {
    const entry = byMailbox.get(mb.email) ?? { count: 0, byStatus: {}, last: null }
    const cursor = cursorByMailbox.get(mb.email)
    return {
      mailbox: mb.email,
      slug: mb.slug,
      gmailTotal: totals[i],
      reviewed: entry.count,
      byStatus: entry.byStatus,
      lastReviewedAt: entry.last,
      walkFinished: !!cursor?.finished_at,
      walkStartedAt: (cursor?.started_at as string | null) ?? null,
      listed: Number(cursor?.listed ?? 0),
    }
  })
}
