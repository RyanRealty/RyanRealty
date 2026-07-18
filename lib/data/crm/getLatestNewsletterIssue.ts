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
  // MUST mirror resolveCurrentNewsletter (app/actions/contact-newsletter.ts) so
  // the subject the SendPanel shows is exactly the issue that sends (audit MED —
  // the display query lacked the created_at tiebreak, the nullsFirst handling,
  // AND the body requirement, so it could show a bodyless/older sent issue while
  // the send actually fell through to a draft).
  const { data: sent } = await sb
    .from('newsletters')
    .select('id,subject,sent_at,body_html,body_text')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sent && (sent.body_html || sent.body_text)) {
    return { id: String(sent.id), subject: String(sent.subject ?? ''), status: 'sent', sentAt: (sent.sent_at as string | null) ?? null }
  }
  const { data: draft } = await sb
    .from('newsletters')
    .select('id,subject,body_html,body_text')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (draft && (draft.body_html || draft.body_text)) {
    return { id: String(draft.id), subject: String(draft.subject ?? ''), status: 'draft', sentAt: null }
  }
  return null
}
