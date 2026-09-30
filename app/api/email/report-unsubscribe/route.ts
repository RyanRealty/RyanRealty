/**
 * RFC 8058 one-click unsubscribe for the MARKET REPORT only (Matt's decision
 * 2026-09-29: "Unsubscribe stops only the market report").
 *
 * The List-Unsubscribe header of every market report points here
 * (lib/email/report-link-token.ts reportOneClickUrl), and Gmail / Yahoo / Apple
 * Mail POST `List-Unsubscribe=One-Click` to it. The POST stops THIS contact's
 * market-report subscription (is_active false, stopped_at, stopped_via
 * 'one-click'), writes an email_events 'unsubscribe' row against the report's
 * email_key and a crm_timeline row, and returns 200. Other email from Ryan
 * Realty keeps working; the global "stop all email" lives on the preferences
 * page behind a confirmation.
 *
 * A GET never changes anything (a mail scanner prefetches links): it sends the
 * reader to the preferences page, opened on "Stop these reports".
 *
 * The signed token is the authorization. A broker's preview token is accepted
 * and does nothing.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { applyReportPreference } from '@/lib/crm/market-report-preferences'
import {
  REPORT_PREFERENCES_PATH,
  signReportLinkToken,
  verifyReportLinkToken,
} from '@/lib/email/report-link-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

function readToken(request: NextRequest): string {
  return (request.nextUrl.searchParams.get('t') ?? '').trim()
}

function text(body: string, status: number): NextResponse {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...NO_STORE } })
}

export async function POST(request: NextRequest) {
  const result = await applyReportPreference(readToken(request), { kind: 'stop' }, 'one-click')
  if (result.ok) {
    if (result.done === 'preview') return text('This is a broker preview. Nothing changed.', 200)
    return text('You are unsubscribed from this market report. Other email from Ryan Realty is not affected.', 200)
  }
  if (result.error === 'unavailable') {
    return text('We could not check this link right now. Try again in a minute, or reply to any of our emails.', 503)
  }
  if (result.error === 'link') {
    return text('This link is no longer valid. Reply to any of our emails and we will take care of it.', 400)
  }
  return text('We could not save that. Try again, or reply to any of our emails.', 500)
}

export async function GET(request: NextRequest) {
  let target = `${REPORT_PREFERENCES_PATH}?error=link`
  try {
    const payload = verifyReportLinkToken(readToken(request))
    if (payload && payload.purpose === 'stop') {
      const manage = signReportLinkToken({
        personId: payload.personId,
        subscriptionId: payload.subscriptionId,
        purpose: 'manage',
        emailKey: payload.emailKey,
        preview: payload.preview,
      })
      target = `${REPORT_PREFERENCES_PATH}?t=${encodeURIComponent(manage)}&stop=1`
    }
  } catch {
    target = `${REPORT_PREFERENCES_PATH}?error=unavailable`
  }
  const res = NextResponse.redirect(new URL(target, request.url), 303)
  for (const [k, v] of Object.entries(NO_STORE)) res.headers.set(k, v)
  return res
}
