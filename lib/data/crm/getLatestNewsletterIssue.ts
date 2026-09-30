/**
 * getLatestNewsletterIssue — the issue a one-off "send newsletter to this
 * contact" would deliver, for the send panel to name before it sends: the
 * current issue Matt approved (sent or going out in the last 45 days, else the
 * next scheduled), never a draft. The selection is
 * getCurrentNewsletterIssueRef, the one the send action uses, so the panel
 * cannot name one issue while another sends. It reads only the reference
 * columns, since this runs on every person page.
 *
 * A failed read shows no issue (the panel disables the send) rather than
 * failing the whole person page.
 */
import { getCurrentNewsletterIssueRef } from '@/lib/data/newsletter/current-issue'

export type LatestNewsletterIssue = {
  id: string
  subject: string
  status: 'sent' | 'scheduled'
  sentAt: string | null
}

export async function getLatestNewsletterIssue(): Promise<LatestNewsletterIssue | null> {
  try {
    const ref = await getCurrentNewsletterIssueRef()
    if (!ref) return null
    return {
      id: ref.id,
      subject: ref.subject,
      status: ref.status === 'scheduled' ? 'scheduled' : 'sent',
      sentAt: ref.sendFinishedAt ?? ref.sendStartedAt,
    }
  } catch (err) {
    console.error('[getLatestNewsletterIssue]', err instanceof Error ? err.message : err)
    return null
  }
}
