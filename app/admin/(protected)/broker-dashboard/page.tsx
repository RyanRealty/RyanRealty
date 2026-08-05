// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * P9 roll:today (frozen cut-list, IA lock 2026-08-05): the broker dashboard is
 * absorbed — its queue jobs live at /admin/today; the KPI/feed jobs land in
 * Oversight when that family rolls. This bridge keeps old deep links (alert
 * texts, bookmarks) working. Replaced components deleted same commit
 * (DashboardActivityFeed/Table, DashboardDeliveryAttention,
 * getDashboardRecentActivity) — git history has them.
 */
export default function BrokerDashboardBridge() {
  redirect('/admin/today')
}
