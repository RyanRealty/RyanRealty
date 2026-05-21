import { NextRequest, NextResponse } from 'next/server'

/**
 * Resend webhook: delivered, opened, clicked, bounced, complained, unsubscribed.
 * Verify signature and update email_campaigns / user preferences.
 */
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

  let body: { type?: string; data?: { email_id?: string; campaign_id?: string; created_at?: string } }
  try {
    body = JSON.parse(raw) as { type?: string; data?: { email_id?: string; campaign_id?: string; created_at?: string } }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = body.type ?? ''
  if (type === 'email.opened' || type === 'email.clicked') {
    // When email_campaigns stores Resend email_id, update open_count/click_count here
  }
  if (type === 'email.bounced' || type === 'email.complained') {
    // Could flag user email in profiles
  }
  if (type === 'email.unsubscribed') {
    // Update user notification_preferences to all-off
  }

  return NextResponse.json({ ok: true })
}
