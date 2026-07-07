/**
 * Subscriber CSV export (spec §9.4). Streams the CURRENT filtered view
 * (q / status / segment / broker query params, same as the list page) as
 * text/csv. Admin-gated with the same access check as the page. Suppression
 * states stay visible: bounced / complained / unsubscribed rows export with
 * their status label, so an exported list is never mistaken for an all-mailable
 * list.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCrmAccess } from '@/app/actions/crm'
import { exportSubscribersWithBroker } from '@/lib/data/newsletter/subscribersAdmin'
import type { NewsletterSegment, SubscriberStatus } from '@/lib/data/newsletter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES = new Set(['active', 'unsubscribed', 'bounced', 'complained'])
const SEGMENTS = new Set(['general', 'buyer', 'seller', 'past-client'])

function csvField(v: string | null | undefined): string {
  const s = v ?? ''
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  const access = await getCrmAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const status = sp.get('status') ?? undefined
  const segment = sp.get('segment') ?? undefined
  const rows = await exportSubscribersWithBroker({
    q: sp.get('q') ?? undefined,
    status: status && STATUSES.has(status) ? (status as SubscriberStatus) : undefined,
    segment: segment && SEGMENTS.has(segment) ? (segment as NewsletterSegment) : undefined,
    broker: sp.get('broker') ?? undefined,
  })

  const header = ['email', 'name', 'status', 'segment', 'broker', 'source', 'last_sent_at', 'created_at']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        csvField(r.email),
        csvField(r.name),
        csvField(r.status),
        csvField(r.segment),
        csvField(r.broker),
        csvField(r.source),
        csvField(r.last_sent_at),
        csvField(r.created_at),
      ].join(','),
    )
  }

  const filename = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(lines.join('\r\n') + '\r\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
