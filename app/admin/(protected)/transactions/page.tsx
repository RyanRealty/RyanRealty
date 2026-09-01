// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Canonical §B1 route bridge (D9.3, admin rebuild spec 01 §13.4):
 * /admin/transactions is the spec-era canonical Transactions path. Spec 05
 * moved the live page to /admin/closings — point straight there (the old
 * /admin/deals target is itself just a redirect to closings; no double hop).
 */
export default function TransactionsBridge() {
  redirect('/admin/closings')
}
