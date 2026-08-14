// @no-parity — internal admin surface
//
// §11.11 Deals Report is explicitly DEFERRED by the CRM build plan (§21:
// "Deals reporting beyond pipeline" — do not build unless told). The sub-nav
// tab must still resolve. Closings is the one deal list (P3).

import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function DealsReportRedirect() {
  redirect('/admin/closings')
}
