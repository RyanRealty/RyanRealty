/**
 * getLatestNewsletterIssue — the issue a one-off "send newsletter to this
 * contact" would deliver, for the send panel to name before it sends: the
 * newest issue Matt approved (sent, or scheduled), never a draft. The
 * selection is getCurrentNewsletterIssue, the same one the send action uses,
 * so the panel cannot name one issue while another sends.
 *
 * A failed read shows no issue (the panel disables the send) rather than
 * failing the whole person page.
 */
import { getCurrentNewsletterIssue } from '@/lib/data/newsletter/current-issue'

export type LatestNewsletterIssue = {
  id: string
  subject: string
  status: 'sent' | 'scheduled'
  sentAt: string | null
}

export async function getLatestNewsletterIssue(): Promise<LatestNewsletterIssue | null> {
  try {
    const letter = await getCurrentNewsletterIssue()
    if (!letter) return null
    return {
      id: letter.id,
      subject: letter.subject ?? '',
      status: letter.status === 'scheduled' ? 'scheduled' : 'sent',
      sentAt: letter.send_finished_at ?? letter.sent_at ?? null,
    }
  } catch (err) {
    console.error('[getLatestNewsletterIssue]', err instanceof Error ? err.message : err)
    return null
  }
}
