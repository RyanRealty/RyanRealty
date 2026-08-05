// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * P9 Closings roll (IA lock 2026-08-05): the deal LIST job moved to
 * /admin/closings, which reads TC truth (tc_deals) instead of the retired
 * skyslope_transactions mirror this page rendered (P4 atlas finding). The
 * per-deal page stays at /admin/deals/[key]. The mirror-backed list reader
 * (app/actions/deals.ts getDealDashboard) was deleted same commit — git
 * history has it.
 */
export default function DealsListBridge() {
  redirect('/admin/closings')
}
