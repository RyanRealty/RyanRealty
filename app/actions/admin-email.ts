'use server'

import { sendEmail } from '@/lib/resend'

export async function sendAdminEmail(params: {
  to: string
  subject: string
  body: string
}): Promise<{ id?: string; error?: string }> {
  return sendEmail({
    to: params.to.trim(),
    subject: params.subject.trim(),
    html: params.body.trim() || undefined,
    text: params.body.trim() || undefined,
  })
}
