import { getSparkConnectionStatus, getSparkDataRange } from '../../../lib/spark'
import { NextResponse } from 'next/server'

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

/**
 * GET /api/spark-status
 * Verifies Spark API connection, total listing count, and date range.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [status, dateRange] = await Promise.all([
    getSparkConnectionStatus(),
    getSparkDataRange(),
  ])
  return NextResponse.json({
    ...status,
    ...(dateRange.oldest != null && { oldestOnMarketDate: dateRange.oldest }),
    ...(dateRange.newest != null && { newestOnMarketDate: dateRange.newest }),
    ...(dateRange.error && !status.connected && { dateRangeError: dateRange.error }),
  })
}
