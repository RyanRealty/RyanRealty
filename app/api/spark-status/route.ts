import { getSparkConnectionStatus, getSparkDataRange } from '../../../lib/spark'
import { NextResponse } from 'next/server'

/**
 * GET /api/spark-status
 * Verifies Spark API connection, total listing count, and date range (no auth required).
 */
export async function GET() {
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
