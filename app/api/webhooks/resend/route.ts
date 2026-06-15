import { NextRequest, NextResponse } from 'next/server'
import { recordNewsletterEvent } from '@/lib/data'

/**
 * Resend webhook: delivered, opened, clicked, bounced, complained, unsubscribed.
 * Verify signature, then record newsletter open/click/delivery events against the
 * matching newsletter_recipients row (by resend message id) — the data behind the
 * per-broker delivery/open/click stats + who-clicked-what view.
 */
const EVENT_MAP: Record<string, 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const sig = request.headers.get('svix-signature') ?? request.headers.get('resend-signature') ?? ''
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) {
    if (isProd) {
      console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not set in production — rejecting')
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }
    console.warn('[resend-webhook] RESEND_WEBHOOK_SECRET not set — allowing in dev')
  } else if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  } else if (sig !== secret) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: { type?: string; created_at?: string; data?: { email_id?: string; created_at?: string; click?: { link?: string } } }
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const mapped = EVENT_MAP[body.type ?? '']
  const emailId = body.data?.email_id
  if (mapped && emailId) {
    await recordNewsletterEvent({
      resendMessageId: emailId,
      type: mapped,
      url: mapped === 'clicked' ? body.data?.click?.link ?? null : null,
      isoTs: body.data?.created_at ?? body.created_at ?? null,
    })
  }

  return NextResponse.json({ ok: true })
}
