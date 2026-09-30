import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import type { NewsletterRow } from '@/lib/data/newsletter'

/**
 * The issue a broker's one-click "send the newsletter" delivers, and the one
 * the send panel names before it sends: the newest issue Matt approved.
 *
 * Approved means it went to the list (sent, or sending now) or he scheduled it.
 * A draft never qualifies, whoever wrote it: the monthly Bend Brief and the
 * monthly market report email draft themselves for his per-issue approval,
 * the admin Generate button writes one under his name, and none of them is
 * the brokerage's message until he approves it (CLAUDE.md §1; Matt
 * 2026-09-30 on the report email: nothing goes to anyone until he approves
 * that send). Before 2026-09-30 this fell back to the newest draft, and the
 * newest "sent" issue was a July integration-test probe.
 *
 * One selection for both the send action (app/actions/contact-newsletter.ts)
 * and the panel (getLatestNewsletterIssue), so the panel always names what
 * sends. A letter with no body is never "current".
 */
const WENT_OUT = ['sent', 'sending'] as const
const SCAN = 10

function hasBody(row: Pick<NewsletterRow, 'body_html' | 'body_text'>): boolean {
  return Boolean(row.body_html || row.body_text)
}

export async function getCurrentNewsletterIssue(): Promise<NewsletterRow | null> {
  const sb = createServiceClient()
  const { data: sent, error: sentError } = await sb
    .from('newsletters')
    .select('*')
    .in('status', [...WENT_OUT])
    .order('send_finished_at', { ascending: false, nullsFirst: false })
    .order('sent_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(SCAN)
  if (sentError) throw new Error(`getCurrentNewsletterIssue: ${sentError.message}`)
  const latestSent = ((sent ?? []) as NewsletterRow[]).find(hasBody)
  if (latestSent) return latestSent

  // Nothing has gone to the list yet: the next approved issue, if any.
  const { data: scheduled, error: scheduledError } = await sb
    .from('newsletters')
    .select('*')
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(SCAN)
  if (scheduledError) throw new Error(`getCurrentNewsletterIssue: ${scheduledError.message}`)
  return ((scheduled ?? []) as NewsletterRow[]).find(hasBody) ?? null
}
