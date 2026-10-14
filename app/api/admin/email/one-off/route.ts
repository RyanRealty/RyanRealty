/**
 * POST /api/admin/email/one-off
 *
 * Admin / cron one-off HTML send through the CRM tracked Resend rail.
 * Body is already-hosted HTML (local images rewritten). Never Gmail.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedAdminOrCron } from '@/lib/auth/guards'
import { sendOneOffEmail } from '@/lib/comms/sendOneOffEmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminOrCron(request))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    personId?: number
    to?: string
    subject?: string
    html?: string
    sendKey?: string
    from?: string
    replyTo?: string
    broker?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const personId = Number(body.personId)
  const res = await sendOneOffEmail({
    personId,
    to: body.to ?? '',
    subject: body.subject ?? '',
    html: body.html ?? '',
    sendKey: body.sendKey ?? '',
    from: body.from,
    replyTo: body.replyTo,
    broker: body.broker,
  })
  return NextResponse.json(res, { status: res.ok ? 200 : 400 })
}
