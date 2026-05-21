import { NextResponse } from 'next/server'
import { generateWeeklyMarketReport } from '../../../actions/generate-market-report'

/**
 * Cron endpoint: generate the weekly market report.
 * Schedule (e.g. Vercel Cron): Saturday 6:00 AM PT = 13:00 or 14:00 UTC (depending on DST).
 * Secure with Authorization: Bearer CRON_SECRET (same as sync).
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) {
    if (isProd) return false
    return true
  }
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await generateWeeklyMarketReport()
    if (result.ok) {
      return NextResponse.json({ ok: true, slug: result.slug, url: result.url })
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  } catch (e) {
    console.error('Market report cron error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
