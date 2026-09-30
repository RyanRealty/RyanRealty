/**
 * /email-preferences/report?t=<signed view link> — "View this report online".
 *
 * Serves the STORED copy of one market report (crm_report_sends.html), exactly
 * as it went out: the clean copy, with no open pixel and no click wraps, so
 * reading it here never counts as an open or a click. Every figure in the text
 * is the stored copy's; the chart images are drawn on request, pinned to the
 * months the report covered (app/api/email/market-chart `through=`), so a
 * report reread next year still charts that report's window.
 *
 * The signed link names the person and the report; it opens only a report
 * that belongs to that person and actually went out, and a broker's preview
 * copy only from a preview link (lib/data/crm/reportPreferences.ts). A bad or
 * unmatched link goes to the preferences page's plain "could not open" state.
 *
 * Private address (lib/analytics/private-paths.ts): no tracker, no-referrer,
 * noindex, never cached.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { readReportForView } from '@/lib/data/crm/reportPreferences'
import { REPORT_PREFERENCES_PATH } from '@/lib/email/report-link-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

function toPreferences(request: NextRequest, error: 'link' | 'unavailable'): NextResponse {
  const res = NextResponse.redirect(new URL(`${REPORT_PREFERENCES_PATH}?error=${error}`, request.url), 303)
  for (const [k, v] of Object.entries(PRIVATE_HEADERS)) res.headers.set(k, v)
  return res
}

export async function GET(request: NextRequest) {
  const token = (request.nextUrl.searchParams.get('t') ?? '').trim()
  if (!token) return toPreferences(request, 'link')
  let result: Awaited<ReturnType<typeof readReportForView>>
  try {
    result = await readReportForView(token)
  } catch (e) {
    console.error('[email-preferences/report]', e instanceof Error ? e.message : e)
    return toPreferences(request, 'unavailable')
  }
  if (!result.ok) return toPreferences(request, result.reason === 'unavailable' ? 'unavailable' : 'link')
  return new NextResponse(result.html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...PRIVATE_HEADERS },
  })
}
