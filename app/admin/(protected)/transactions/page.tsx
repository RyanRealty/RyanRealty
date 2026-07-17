// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Canonical §B1 route bridge (D9.3, admin rebuild spec 01 §13.4):
 * /admin/transactions is the spec-era canonical Transactions path; the live
 * page is /admin/deals until spec 05 moves it. Menus link the live page
 * directly (no hop) — this bridge keeps canonical deep links working.
 */
export default function TransactionsBridge() {
  redirect('/admin/deals')
}
