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
  /** Optional. sendEmail also resolves the To address to a CRM person and wraps links when omitted. Internal broker mail is skipped. */
  personId?: number
  emailKey?: string
  brokerSlug?: string
  /**
   * Resend's Idempotency-Key. What it guarantees, exactly (Resend's docs,
   * read 2026-09-30): Resend keeps a key for 24 hours; a repeat with the SAME
   * key and the SAME payload inside that window gets the first answer back
   * (the same email id) and nothing is sent again; the same key with a
   * DIFFERENT payload is refused (409 invalid_idempotent_request); a repeat
   * while the first is still in progress is refused (409
   * concurrent_idempotent_requests). So a key protects only a byte-for-byte
   * replay inside 24 hours: a caller that retries must resend the stored
   * request unchanged (pass `exact`), and a new render needs a new key. The
   * market report does both (lib/crm/market-report-send.ts).
   */
  idempotencyKey?: string
  /**
   * Send `html` exactly as given: skip the send-time lead instrumentation.
   * For a caller that stores the request it sends and may replay it byte for
   * byte under the same idempotency key (the payload must not drift).
   */
  exact?: boolean
}

/**
 * sendEmail's answer. `unknown` is true when the email MAY have been accepted
 * even though no answer says so: the request could not be resolved after it
 * began (the SDK's statusCode null, a transport error, a throw), or Resend
 * refused the key because a request under it exists (409
 * concurrent_idempotent_requests / invalid_idempotent_request). An unknown
 * outcome is never a failure to retry with a new render: it may be delivered.
 */
export type SendEmailResult = {
  id?: string
  error?: string
  /** Resend's HTTP status on a refusal; null when no answer came back. */
  statusCode?: number | null
  unknown?: boolean
}

const IDEMPOTENCY_CONFLICTS = new Set(['concurrent_idempotent_requests', 'invalid_idempotent_request'])

function isRateLimited(error: { name?: string; message?: string; statusCode?: number | null }): boolean {
  return error.statusCode === 429 || /rate_limit|too many requests/i.test(`${error.name ?? ''} ${error.message ?? ''}`)
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
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
  let html = options.html
  if (html && !options.exact) {
    const { instrumentLeadHtml } = await import('@/lib/email/auto-track')
    html = await instrumentLeadHtml(html, {
      to: options.to,
      subject: options.subject,
      personId: options.personId,
      emailKey: options.emailKey,
      brokerSlug: options.brokerSlug,
    })
  }
  try {
    const idempotencyKey = options.idempotencyKey?.trim()
    const send = () =>
      client.emails.send(
        {
          from,
          to,
          subject: options.subject,
          html,
          text: options.text,
          replyTo: options.replyTo,
          react: options.react,
          ...(options.attachments?.length ? { attachments: options.attachments } : {}),
          ...(options.headers ? { headers: options.headers } : {}),
        },
        idempotencyKey ? { idempotencyKey: idempotencyKey.slice(0, 256) } : undefined,
      )
    let { data, error } = await send()
    // Resend allows a few requests a second across the whole account, and the
    // live site shares it: a sealed envelope's copies go out back to back. A
    // refused-for-rate send was not sent, so it is safe to try again.
    for (let attempt = 1; error && isRateLimited(error) && attempt <= 2; attempt++) {
      await new Promise((r) => setTimeout(r, 1100 * attempt))
      ;({ data, error } = await send())
    }
    if (error) {
      const g = globalThis as unknown as { captureException?: (e: unknown) => void }
      if (typeof g.captureException === 'function') g.captureException(new Error(`Resend: ${error.message}`))
      const statusCode = typeof error.statusCode === 'number' ? error.statusCode : null
      const unknown = statusCode == null || (statusCode === 409 && IDEMPOTENCY_CONFLICTS.has(String(error.name ?? '')))
      return unknown ? { error: error.message, statusCode, unknown: true } : { error: error.message, statusCode }
    }
    return { id: data?.id }
  } catch (e) {
    // The request may have left before this threw: the outcome is unknown.
    const err = e instanceof Error ? e : new Error(String(e))
    const g = globalThis as unknown as { captureException?: (e: unknown) => void }
    if (typeof g.captureException === 'function') g.captureException(err)
    return { error: err.message, statusCode: null, unknown: true }
  }
}

/**
 * What Resend holds for one email id (GET /emails/{id}): the evidence that
 * settles an attempt whose answer was lost. `notFound` apart from an error
 * that could not read through. Never throws.
 */
export async function getSentEmail(
  id: string,
): Promise<{ ok: true; id: string; createdAt: string | null; lastEvent: string | null } | { ok: false; notFound: boolean; error: string }> {
  const client = getClient()
  if (!client) return { ok: false, notFound: false, error: 'Email not configured' }
  try {
    const { data, error } = await client.emails.get(id)
    if (error || !data) {
      const statusCode = error && typeof error.statusCode === 'number' ? error.statusCode : null
      return { ok: false, notFound: statusCode === 404, error: error?.message ?? 'no data' }
    }
    const d = data as { id?: string; created_at?: string | null; last_event?: string | null }
    return { ok: true, id: d.id ?? id, createdAt: d.created_at ?? null, lastEvent: d.last_event ?? null }
  } catch (e) {
    return { ok: false, notFound: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function sendBatchEmails(
  emails: SendEmailOptions[]
): Promise<SendEmailResult[]> {
  const results: SendEmailResult[] = []
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
