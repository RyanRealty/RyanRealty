'use server'

import { sendEmail } from '@/lib/resend'
import { isSuppressedByEmail } from '@/lib/crm/suppressions'
import { createClient } from '@supabase/supabase-js'

export async function sendAdminEmail(params: {
  to: string
  subject: string
  body: string
}): Promise<{ id?: string; error?: string }> {
  // Suppression chokepoint (fails closed). An admin-composed send can target an
  // arbitrary address that may be a lead who opted out. Resolve the recipient's
  // consent record by email before the send and block if suppressed.
  const sup = await isSuppressedByEmail(params.to.trim(), 'email')
  if (sup.suppressed) {
    return { error: `Recipient is suppressed for email and cannot be sent (${sup.reasons.join(', ')})` }
  }

  const result = await sendEmail({
    to: params.to.trim(),
    subject: params.subject.trim(),
    html: params.body.trim() || undefined,
    text: params.body.trim() || undefined,
  })
  if (result.error) return result

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url?.trim() && key?.trim()) {
    const supabase = createClient(url, key)
    await supabase.from('email_campaigns').insert({
      fub_campaign_id: result.id ?? null,
      template_type: 'manual_admin',
      subject: params.subject.trim(),
      sent_count: 1,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  return result
}
