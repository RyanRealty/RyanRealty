// @no-parity — internal admin surface
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * One email-performance home (Matt lock 2026-09-01, decisions.md "UX
 * CONSOLIDATION LOCKS" #3): the batch-sends list lives inside
 * /admin/reports/emails now. The per-send funnel detail stays at
 * ./[jobId] — only this LIST route bridges.
 */
export default function BatchEmailsBridge() {
  redirect('/admin/reports/emails')
}
