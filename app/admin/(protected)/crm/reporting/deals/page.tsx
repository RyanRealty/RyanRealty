// @no-parity — internal admin surface
//
// §11.11 Deals Report is explicitly DEFERRED by the CRM build plan (§21:
// "Deals reporting beyond pipeline" — do not build unless told). The sub-nav
// tab must still resolve, so it routes to the live Deals pipeline board, which
// carries the per-stage counts, totals and commission the report would show.

import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function DealsReportRedirect() {
  redirect('/admin/crm/deals')
}
