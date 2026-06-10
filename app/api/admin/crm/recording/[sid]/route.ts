/**
 * Admin-only audio proxy: streams a Twilio call recording so brokers can
 * listen from the CRM without Twilio credentials. Session + admin role gated.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_request: Request, { params }: { params: Promise<{ sid: string }> }) {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sid: recordingSid } = await params
  if (!/^RE[a-f0-9]{32}$/.test(recordingSid)) {
    return NextResponse.json({ error: 'bad recording sid' }, { status: 400 })
  }
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!sid || !token) return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings/${recordingSid}.mp3`, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') },
  })
  if (!res.ok) return NextResponse.json({ error: 'recording not found' }, { status: 404 })
  return new NextResponse(res.body, {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' },
  })
}
