/**
 * One-click email unsubscribe endpoint (CONTACT360 Phase 9.3, RFC 8058).
 *
 * The List-Unsubscribe header (built by lib/email/prepare) points here. Gmail /
 * Yahoo / Apple Mail POST with a `List-Unsubscribe=One-Click` body and expect a
 * 2xx, then mark the sender unsubscribed. A human who clicks the in-body footer
 * link GETs here and sees a branded confirm page.
 *
 * A GET must NEVER silently unsubscribe — a mail-client prefetch of the link
 * would opt the person out without intent. So GET only renders the confirm page;
 * the suppression happens on POST (the one-click body, or the confirm button).
 *
 * The suppression is written through the lib/crm/suppressions chokepoint, so a
 * withdrawal only ever STOPS email and is reflected everywhere a send is gated.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { addSuppression } from '@/lib/crm/suppressions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function readToken(request: NextRequest): string {
  return (request.nextUrl.searchParams.get('t') ?? request.nextUrl.searchParams.get('token') ?? '').trim()
}

function htmlPage(title: string, message: string, action?: { token: string }): string {
  const button = action
    ? `<form method="post" action="/api/email/unsubscribe?t=${encodeURIComponent(action.token)}" style="margin-top:20px"><button type="submit" style="background:#102742;color:#fff;border:none;border-radius:10px;padding:12px 22px;font-size:15px;cursor:pointer">Confirm unsubscribe</button></form>`
    : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#faf8f4;color:#102742;margin:0;padding:48px 20px"><div style="max-width:460px;margin:0 auto;background:#fff;border:1px solid #e6e2da;border-radius:14px;padding:32px"><h1 style="font-size:20px;margin:0 0 12px">${title}</h1><p style="font-size:15px;line-height:1.55;color:#3a4757;margin:0">${message}</p>${button}</div></body></html>`
}

function htmlResponse(body: string, status: number): NextResponse {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function POST(request: NextRequest) {
  const payload = verifyUnsubscribeToken(readToken(request))
  if (!payload) {
    return htmlResponse(htmlPage('Link expired', 'This unsubscribe link is invalid or expired. Reply to any email and we will remove you.'), 400)
  }
  await addSuppression({ personId: payload.personId, channel: 'email', reason: 'unsubscribe', source: 'one-click' })
  return htmlResponse(htmlPage('You are unsubscribed', 'You will no longer receive marketing emails from Ryan Realty. It can take a little time for any in-flight email to stop.'), 200)
}

export async function GET(request: NextRequest) {
  const token = readToken(request)
  const payload = verifyUnsubscribeToken(token)
  if (!payload) {
    return htmlResponse(htmlPage('Link expired', 'This unsubscribe link is invalid or expired. Reply to any email and we will remove you.'), 400)
  }
  return htmlResponse(
    htmlPage('Unsubscribe from Ryan Realty emails', 'Confirm below and we will stop sending you marketing emails. You can always opt back in later.', { token }),
    200,
  )
}
