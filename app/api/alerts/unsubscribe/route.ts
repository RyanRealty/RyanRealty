import { type NextRequest, NextResponse } from 'next/server'
import { deactivateListingAlertByToken } from '@/lib/data'

/**
 * One-click unsubscribe endpoint for the email List-Unsubscribe header
 * (RFC 8058). Mail providers (Gmail, Yahoo, Apple Mail) POST here with a
 * `List-Unsubscribe=One-Click` body and expect a 2xx, then mark the sender
 * unsubscribed.
 *
 * This lives at /api/alerts/unsubscribe — separate from the /alerts/unsubscribe
 * PAGE — for two reasons: Next.js forbids a page.tsx and a route.ts in the same
 * segment, and the page's form Server Action 403s any foreign POST (exactly what
 * a provider sends). The human-facing in-email link still points at the branded
 * /alerts/unsubscribe confirm page; only the List-Unsubscribe header points here.
 *
 * Every alert token (guest or signed-in) lives in the unified listing_alerts
 * table, so one deactivate covers all. The token is a random UUID carried in
 * the URL — knowing it is the authorization, same model as the confirm page.
 */

export const dynamic = 'force-dynamic'

function readToken(request: NextRequest): string {
  return (request.nextUrl.searchParams.get('token') ?? '').trim()
}

export async function POST(request: NextRequest) {
  const token = readToken(request)
  if (!token) {
    return NextResponse.json({ ok: false, error: 'missing token' }, { status: 400 })
  }
  await deactivateListingAlertByToken(token)
  return NextResponse.json({ ok: true })
}

export async function GET(request: NextRequest) {
  // A GET on the header link (clients without one-click POST support) must NOT
  // silently unsubscribe — a prefetch would opt the user out. Send the human to
  // the branded confirm page, which deactivates only on an explicit button POST.
  const token = readToken(request)
  const url = request.nextUrl.clone()
  url.pathname = '/alerts/unsubscribe'
  url.search = ''
  if (token) url.searchParams.set('token', token)
  return NextResponse.redirect(url)
}
