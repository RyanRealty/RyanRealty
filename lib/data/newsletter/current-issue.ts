import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { getNewsletter, type NewsletterRow } from '@/lib/data/newsletter'

/**
 * The issue a broker's one-click "send the newsletter" delivers, and the one
 * the send panel names before it sends: the current issue Matt approved.
 *
 * Approved means it went out (sent, or sending now) or he scheduled it. A
 * draft never qualifies, whoever wrote it: the monthly Bend Brief and the
 * monthly market report email draft themselves for his per-issue approval,
 * the admin Generate button writes one under his name, and none of them is
 * the brokerage's message until he approves it (CLAUDE.md §1; Matt
 * 2026-09-30 on the report email: nothing goes to anyone until he approves
 * that send). Before 2026-09-30 this fell back to the newest draft, and the
 * newest "sent" issue was a July integration-test probe.
 *
 * Current means it went out in the last CURRENT_DAYS: both issues are
 * monthly (the Bend Brief on the 1st, the market report on the 8th), and an
 * older one carries last season's figures, like the three July 2026 sends of
 * the Bend Brief (to Matt's own inboxes and one contact), still "sent". The
 * newest send leads (by when it started), so an issue still going out
 * outranks last month's. With nothing current, the next scheduled issue.
 *
 * One selection for the send action (app/actions/contact-newsletter.ts, which
 * loads the whole row) and the panel (getLatestNewsletterIssue, which needs
 * only the reference), so the panel always names what sends.
 */
export const CURRENT_DAYS = 45

export type CurrentNewsletterIssueRef = {
  id: string
  subject: string
  status: 'sent' | 'sending' | 'scheduled'
  sendStartedAt: string | null
  sendFinishedAt: string | null
}

const REF_COLUMNS = 'id,subject,status,send_started_at,send_finished_at'
const HAS_BODY = 'body_html.not.is.null,body_text.not.is.null'

function toRef(row: Record<string, unknown> | null): CurrentNewsletterIssueRef | null {
  if (!row) return null
  return {
    id: String(row.id),
    subject: String(row.subject ?? ''),
    status: row.status as CurrentNewsletterIssueRef['status'],
    sendStartedAt: (row.send_started_at as string | null) ?? null,
    sendFinishedAt: (row.send_finished_at as string | null) ?? null,
  }
}

export async function getCurrentNewsletterIssueRef(now: Date = new Date()): Promise<CurrentNewsletterIssueRef | null> {
  const sb = createServiceClient()
  const since = new Date(now.getTime() - CURRENT_DAYS * 86_400_000).toISOString()
  const { data: out, error: outError } = await sb
    .from('newsletters')
    .select(REF_COLUMNS)
    .in('status', ['sent', 'sending'])
    .gte('send_started_at', since)
    .or(HAS_BODY)
    .order('send_started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (outError) throw new Error(`getCurrentNewsletterIssue: ${outError.message}`)
  if (out) return toRef(out as Record<string, unknown>)

  const { data: next, error: nextError } = await sb
    .from('newsletters')
    .select(REF_COLUMNS)
    .eq('status', 'scheduled')
    .or(HAS_BODY)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (nextError) throw new Error(`getCurrentNewsletterIssue: ${nextError.message}`)
  return toRef(next as Record<string, unknown> | null)
}

/** The whole row of the current issue, for the send. */
export async function getCurrentNewsletterIssue(now: Date = new Date()): Promise<NewsletterRow | null> {
  const ref = await getCurrentNewsletterIssueRef(now)
  return ref ? getNewsletter(ref.id) : null
}
