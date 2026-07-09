/**
 * getLatestNewsletterIssue — the issue a one-off "send newsletter to this
 * contact" would deliver: the most recently SENT newsletter, falling back to
 * the newest draft with a body. Mirrors resolveCurrentNewsletter in
 * app/actions/contact-newsletter.ts (the send side) so the UI shows exactly
 * what that action will send.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type LatestNewsletterIssue = {
  id: string
  subject: string
  status: 'sent' | 'draft'
  sentAt: string | null
}

export async function getLatestNewsletterIssue(): Promise<LatestNewsletterIssue | null> {
  const sb = createServiceClient()
  const { data: sent } = await sb
    .from('newsletters')
    .select('id,subject,status,sent_at')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sent) {
    return { id: String(sent.id), subject: String(sent.subject ?? ''), status: 'sent', sentAt: (sent.sent_at as string | null) ?? null }
  }
  const { data: draft } = await sb
    .from('newsletters')
    .select('id,subject,status,body_html')
    .eq('status', 'draft')
    .not('body_html', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (draft) {
    return { id: String(draft.id), subject: String(draft.subject ?? ''), status: 'draft', sentAt: null }
  }
  return null
}
