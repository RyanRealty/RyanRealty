import type { ReactElement } from 'react'
import { Resend } from 'resend'

const DEFAULT_FROM = 'Ryan Realty <noreply@mail.ryan-realty.com>'

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key?.trim()) return null
  return new Resend(key)
}

export function getResendClient(): Resend | null {
  return getClient()
}

export type SendEmailOptions = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
  react?: ReactElement
  /** Attachments (e.g. PDF). Content as Buffer. */
  attachments?: { filename: string; content: Buffer }[]
}

export async function sendEmail(options: SendEmailOptions): Promise<{ id?: string; error?: string }> {
  const client = getClient()
  if (!client) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Resend] RESEND_API_KEY not set; email not sent', options.to, options.subject)
      return { id: 'dev-skipped' }
    }
    return { error: 'Email not configured' }
  }
  const to = Array.isArray(options.to) ? options.to : [options.to]
  try {
    const { data, error } = await client.emails.send({
      from: options.from ?? DEFAULT_FROM,
      to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      react: options.react,
      ...(options.attachments?.length ? { attachments: options.attachments } : {}),
    })
    if (error) {
      const g = globalThis as unknown as { captureException?: (e: unknown) => void }
      if (typeof g.captureException === 'function') g.captureException(new Error(`Resend: ${error.message}`))
      return { error: error.message }
    }
    return { id: data?.id }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    const g = globalThis as unknown as { captureException?: (e: unknown) => void }
    if (typeof g.captureException === 'function') g.captureException(err)
    return { error: err.message }
  }
}

export async function sendBatchEmails(
  emails: SendEmailOptions[]
): Promise<Array<{ id?: string; error?: string }>> {
  const results: Array<{ id?: string; error?: string }> = []
  for (const opts of emails) {
    results.push(await sendEmail(opts))
  }
  return results
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.RESEND_ADMIN_EMAIL ?? ''

export async function sendContactNotification(params: {
  name: string
  email: string
  phone?: string
  inquiryType?: string
  message?: string
}): Promise<{ id?: string; error?: string }> {
  if (!ADMIN_EMAIL) return { error: 'No admin email' }
  const body = [
    `Name: ${params.name}`,
    `Email: ${params.email}`,
    params.phone ? `Phone: ${params.phone}` : '',
    params.inquiryType ? `Inquiry: ${params.inquiryType}` : '',
    params.message ? `Message: ${params.message}` : '',
  ].filter(Boolean).join('\n')
  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `Contact form: ${params.inquiryType ?? 'General'} from ${params.name}`,
    text: body,
    replyTo: params.email,
  })
}
