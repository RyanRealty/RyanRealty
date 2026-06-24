/**
 * Admin-only MMS media proxy: streams an inbound Twilio MMS attachment (photo,
 * PDF, etc.) so brokers can view client-sent media from the CRM without Twilio
 * credentials. Session + role gated, ownership-scoped like the recording proxy:
 * a per-broker role only fetches media on their own contacts. (Twilio cutover
 * 2026-06-24 — MMS was previously dropped on the floor.)
 */

import { NextResponse } from 'next/server'
import { getCrmAccess } from '@/app/actions/crm'
import { getMmsOwnerBroker } from '@/lib/data/crm/getMmsOwnerBroker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_request: Request, { params }: { params: Promise<{ messageSid: string; mediaSid: string }> }) {
  const access = await getCrmAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageSid, mediaSid } = await params
  if (!/^(MM|SM)[a-f0-9]{32}$/.test(messageSid) || !/^ME[a-f0-9]{32}$/.test(mediaSid)) {
    return NextResponse.json({ error: 'bad sid' }, { status: 400 })
  }

  // Fail closed: superusers see all; any other role only its own contacts; a
  // non-superuser with no broker identity (report_viewer) is denied outright.
  if (access.role !== 'superuser') {
    if (!access.brokerSlug) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const owner = await getMmsOwnerBroker(messageSid)
    if (!owner || owner !== access.brokerSlug) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!sid || !token) return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })

  // Twilio 307-redirects to the CDN binary; fetch follows it. The first hop
  // needs Basic auth; the CDN hop does not.
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${messageSid}/Media/${mediaSid}`, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') },
    redirect: 'follow',
  })
  if (!res.ok) return NextResponse.json({ error: 'media not found' }, { status: 404 })
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
