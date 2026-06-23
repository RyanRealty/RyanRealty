import type { ReactElement } from 'react'
import { Resend } from 'resend'

/**
 * Resolve the verified From address (CONTACT360 9.1).
 *
 * Order: an explicit per-send `from` → `RESEND_FROM` (the verified
 * mail.ryan-realty.com sender) → in PRODUCTION, FAIL (never send from the
 * `onboarding@resend.dev` sandbox — it lands in spam and fails DKIM, tanking
 * sender reputation). The sandbox is allowed only in development.
 */
export function resolveFrom(explicit?: string): { from: string; error?: undefined } | { from?: undefined; error: string } {
  const ex = explicit?.trim()
  if (ex) return { from: ex }
  const envFrom = process.env.RESEND_FROM?.trim()
  if (envFrom) return { from: envFrom }
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (isProd) {
    return { error: 'RESEND_FROM not set in production — refusing to send from the resend.dev sandbox (spam/DKIM-fail). Set RESEND_FROM to the verified sender.' }
  }
  return { from: 'Ryan Realty <onboarding@resend.dev>' }
}

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
  /** Custom SMTP headers, e.g. List-Unsubscribe for one-click unsubscribe. */
  headers?: Record<string, string>
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
  const fromResolved = resolveFrom(options.from)
  const from = fromResolved.from
  if (!from) {
    const msg = fromResolved.error ?? 'Email sender not configured'
    console.error('[Resend] ' + msg)
    return { error: msg }
  }
  try {
    const { data, error } = await client.emails.send({
      from,
      to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      react: options.react,
      ...(options.attachments?.length ? { attachments: options.attachments } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
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
